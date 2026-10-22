// sdf-admin Worker — 管理后台的写入通道。
// 部署在站长自己的 Cloudflare 账号，持有 GITHUB_TOKEN（细粒度、仅本仓库 Contents:RW）。
// 复用主仓库的 token 校验与管理员名单，保证前后端同一份逻辑。
// 注意：ADMINS 名单变更后需重新 `npx wrangler deploy`（名单在部署时打包进 Worker）。

import { verifyFirebaseToken } from '../../../functions/api/_lib/verifyFirebaseToken.js';
import { CHAT_ENDPOINT, modelFor } from '../../../functions/api/_lib/models.js';
import { isAdmin } from '../../../js/shared/admins.js';
import { allowedOrigin, validateContentPayload } from './validate.js';
import { CONTENT_API_VERSION, saveContentChanges } from './content-save.js';
import { createRateLimiter } from './rateLimit.js';
import { getFile, putFile, commitFiles, listWorkflowRuns } from './github.js';
import { DEPLOY_WORKFLOW, deployState } from './deploy-status.js';
import { readFingerprints } from '../../../scripts/qa/cache-bust-core.mjs';
import {
  validateTranslateFields,
  buildTranslatePrompt,
  parseTranslateResponse,
} from './translate.js';
import {
  generateSlug,
  validatePublishPayload,
  upsertPost,
  removePost,
  renderArticleHtml,
  addToSitemap,
  removeFromSitemap,
  ARTICLE_ASSETS,
  LISTING_PATH,
  SITEMAP_PATH,
} from './blog.js';
import {
  validateImageKey,
  validateImageDataUrl,
  siteImagePath,
  blogInlineImagePath,
} from './images.js';

const REPO = 'sherlockafa007/senridoufuu-web';
const CONTENT_PATH = 'content.json';
const POSTS_PATH = 'solutions/blog/posts.json';
// slug 会拼进文件路径：只接受 generateSlug 产出的形状（日期-4位十六进制），防止 ../ 之类写到别处
const SLUG_RE = /^\d{4}-\d{2}-\d{2}-[0-9a-f]{4}$/;

const isLimited = createRateLimiter({ limit: 30 });

function json(status, body, cors = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = allowedOrigin(origin)
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        }
      : {};

    // CORS 预检 —— 无 token，必须在鉴权前放行
    if (request.method === 'OPTIONS') {
      if (!cors['Access-Control-Allow-Origin']) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors });
    }

    // api：保存协议版本。后台保存前先查它——旧 Worker 不认 changes，会把它当整份内容存下（清空全站文案）
    if (url.pathname === '/health') return json(200, { ok: true, api: CONTENT_API_VERSION }, cors);

    // ── 鉴权：Firebase ID token 有效 + 在管理员名单 ──
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) return json(401, { error: '未登录' }, cors);

    let user;
    try {
      user = await verifyFirebaseToken(token);
    } catch {
      return json(401, { error: '登录已过期或无效，请刷新页面重新登录' }, cors);
    }
    if (!isAdmin(user)) return json(403, { error: '该账号无管理员权限' }, cors);
    if (isLimited(user.uid)) return json(429, { error: '操作过于频繁，请稍后再试' }, cors);

    try {
      if (url.pathname === '/content' && request.method === 'GET') {
        const { text } = await getFile(REPO, CONTENT_PATH, env.GITHUB_TOKEN);
        return json(200, { content: text ? JSON.parse(text) : {} }, cors);
      }

      if (url.pathname === '/content' && request.method === 'PUT') {
        let body;
        try {
          body = await request.json();
        } catch {
          return json(400, { error: '请求格式错误' }, cors);
        }

        // 旧版后台（2026-10-18 之前打开、没刷新的页面）发的是整份内容 content——
        // 那正是「用打开时的旧副本覆盖别人刚改的内容」的来源，直接拒绝，请对方刷新。
        if (body.content !== undefined || !body.changes) {
          return json(
            409,
            {
              error: '后台页面已更新：请先把刚改的文字复制保存好，再刷新后台页面后重新修改、保存。',
            },
            cors,
          );
        }
        if (typeof body.changes !== 'object' || Array.isArray(body.changes)) {
          return json(400, { error: '请求格式错误' }, cors);
        }

        // images 是本次新上传的图片（{key: dataURL}），与已有的图片路径分开传，
        // 避免把整段 base64 存进 content.json——这里先落库拿到路径，再并入 changes.images。
        const images =
          body.images && typeof body.images === 'object' && !Array.isArray(body.images)
            ? body.images
            : {};
        const changes = { ...body.changes, images: { ...(body.changes.images || {}) } };

        // 先把每张图片的格式校验完、把最终要写入的图片路径也算好，全部通过之后才开始真正落库——
        // 避免"某张图片已经上传成功、但后面发现别的字段不合法"这种半成功的孤儿文件。
        const uploads = [];
        for (const [key, dataUrl] of Object.entries(images)) {
          if (!validateImageKey(key)) {
            return json(400, { error: `图片字段名非法：${key}` }, cors);
          }
          const imgCheck = validateImageDataUrl(dataUrl);
          if (!imgCheck.ok) return json(400, { error: imgCheck.error }, cors);
          const path = siteImagePath(key);
          uploads.push({ key, path, base64: imgCheck.base64 });
          changes.images[key] = path;
        }

        const check = validateContentPayload(changes);
        if (!check.ok) return json(400, { error: check.error }, cors);

        // 校验全部通过，这里才开始有副作用的写入。注意：GitHub Contents API 不支持多文件原子提交，
        // 如果图片都传成功但下面 content.json 那次写入失败（如网络抖动），图片会成为孤儿文件——
        // 这是已知取舍，和 Blog 模块"发布产生多次独立 commit"是同一类限制，不在这里解决。
        for (const { key, path, base64 } of uploads) {
          await putFile(REPO, path, base64, `content: upload image ${key}`, env.GITHUB_TOKEN, {
            alreadyBase64: true,
          });
        }

        // 在最新版 content.json 上合并本次改动（见 content-save.js 顶部说明）
        const result = await saveContentChanges(changes, {
          read: () => getFile(REPO, CONTENT_PATH, env.GITHUB_TOKEN),
          write: (text, sha) =>
            putFile(REPO, CONTENT_PATH, text, 'content: update via admin panel', env.GITHUB_TOKEN, {
              expectSha: sha,
            }),
        });
        if (!result.ok) return json(result.status, { error: result.error }, cors);
        // 带回合并后的完整内容：前端拿它当新的基线（含别人刚改的、和刚上传图片的最终路径）
        return json(
          200,
          {
            ok: true,
            commitSha: result.commitSha,
            content: result.content,
            images: result.content.images,
          },
          cors,
        );
      }

      if (url.pathname === '/translate' && request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return json(400, { error: '请求格式错误' }, cors);
        }
        const check = validateTranslateFields(body.fields);
        if (!check.ok) return json(400, { error: check.error }, cors);

        const qwenRes = await fetch(CHAT_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.QWEN_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // 内容编辑/Blog 翻译调用频率低（非实时口译场景），要的是质量，故走
            // 最强档；模型名与端点统一由 functions/api/_lib/models.js 决定，
            // 免费额度按模型分桶，换模型只改那一处。
            model: modelFor('adminTranslate', env),
            messages: [{ role: 'user', content: buildTranslatePrompt(body.fields) }],
            // 2026-10-22：4000 → 8000。一篇 1750 字的中文博客，日英译文合计就接近 4000 token，
            // 正文改成 HTML（带格式标签）后必然截断，截断的 JSON 解析失败＝「返回格式异常」。
            max_tokens: 8000,
            // Qwen3 在 DashScope 上默认开混合思考。本调用只读 message.content，
            // 推理内容被直接丢弃——花钱买了扔掉，还慢好几倍。
            // 2026-08-25：六个 Pages Functions 端点关掉了，但**爬虫和 Worker 漏了**，
            // 于是情报简报仍然 60 秒超时（那一轮判定只剩 1 次报错，唯独简报没生成）。
            // 当天写的护栏只扫了 functions/api/ —— 护栏本身也只覆盖了作者当时想到的范围。
            enable_thinking: false,
          }),
        });
        if (!qwenRes.ok) return json(502, { error: '翻译服务暂时不可用，请稍后重试' }, cors);
        const data = await qwenRes.json();
        const parsed = parseTranslateResponse(
          data.choices?.[0]?.message?.content || '',
          body.fields.map((f) => f.key),
        );
        if (!parsed) return json(502, { error: '翻译服务返回格式异常，可重试' }, cors);
        return json(200, parsed, cors);
      }

      // 上线状态：前端保存/发布后轮询（deploy-status.js）。sha 只收 40 位十六进制
      if (url.pathname === '/deploy-status' && request.method === 'GET') {
        const sha = url.searchParams.get('sha') || '';
        if (!/^[0-9a-f]{40}$/.test(sha)) return json(400, { error: 'sha 格式不对' }, cors);
        try {
          const runs = await listWorkflowRuns(REPO, DEPLOY_WORKFLOW, env.GITHUB_TOKEN);
          return json(200, deployState(runs, sha), cors);
        } catch (err) {
          if (err.code === 'NO_ACTIONS_PERMISSION')
            return json(200, { state: 'no_permission' }, cors);
          throw err;
        }
      }

      if (url.pathname === '/blog/posts' && request.method === 'GET') {
        const { text } = await getFile(REPO, POSTS_PATH, env.GITHUB_TOKEN);
        return json(200, { posts: text ? JSON.parse(text) : [] }, cors);
      }

      if (url.pathname === '/blog/publish' && request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return json(400, { error: '请求格式错误' }, cors);
        }
        const check = validatePublishPayload(body);
        if (!check.ok) return json(400, { error: check.error }, cors);

        if (body.slug !== undefined && !SLUG_RE.test(body.slug)) {
          return json(400, { error: 'slug 格式错误' }, cors);
        }
        const slug = body.slug || generateSlug(body.date);
        const tag = typeof body.tag === 'string' ? body.tag.trim() : '';
        const coverUpload = body.cover ? body.cover.replace(/^data:image\/\w+;base64,/, '') : null;

        // 封面・文章页・posts.json・sitemap **一次提交**（见 github.js commitFiles）。
        // 每次尝试都重读 posts.json / sitemap / 列表页指纹：期间有人推了别的提交时基于最新内容重算。
        const { commitSha } = await commitFiles(
          REPO,
          async () => {
            const [{ text: postsText }, { text: listing }, { text: sitemap }] = await Promise.all([
              getFile(REPO, POSTS_PATH, env.GITHUB_TOKEN),
              getFile(REPO, LISTING_PATH, env.GITHUB_TOKEN),
              getFile(REPO, SITEMAP_PATH, env.GITHUB_TOKEN),
            ]);
            const posts = postsText ? JSON.parse(postsText) : [];
            const existing = posts.find((p) => p.slug === slug);
            const want = readFingerprints(listing || '', ARTICLE_ASSETS);
            const lacking = ARTICLE_ASSETS.filter((a) => !want[a]);
            // 读不到指纹就停：写出没有 ?v= 的页面只会被上线检查拦下，作者看到的是「发布成功但前台空白」
            if (lacking.length) throw new Error(`读不到资源指纹（${lacking.join('、')}），未发布`);
            if (!sitemap) throw new Error('读不到 sitemap.xml，未发布');

            const coverPath = coverUpload
              ? `assets/images/blog/${slug}-cover.webp`
              : (existing && existing.cover) || null;
            const entry = {
              slug,
              date: body.date,
              tag,
              title: body.title,
              body: body.body,
              cover: coverPath,
            };
            const changes = [
              {
                path: `solutions/blog/${slug}.html`,
                text: renderArticleHtml(entry, want),
              },
              { path: POSTS_PATH, text: JSON.stringify(upsertPost(posts, entry), null, 2) + '\n' },
              { path: SITEMAP_PATH, text: addToSitemap(sitemap, slug, body.date) },
            ];
            if (coverUpload) changes.push({ path: coverPath, base64: coverUpload });
            return changes;
          },
          `blog: publish ${slug}`,
          env.GITHUB_TOKEN,
        );

        return json(200, { ok: true, slug, commitSha }, cors);
      }

      if (url.pathname === '/blog/unpublish' && request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return json(400, { error: '请求格式错误' }, cors);
        }
        if (typeof body.slug !== 'string' || !SLUG_RE.test(body.slug)) {
          return json(400, { error: '缺少 slug 或格式错误' }, cors);
        }
        const slug = body.slug;
        const articlePath = `solutions/blog/${slug}.html`;

        // 文章页・posts.json・sitemap 一次提交（封面图留着：之后重新发布还能用）
        const { commitSha } = await commitFiles(
          REPO,
          async () => {
            const [{ text }, { text: sitemap }, { sha: articleSha }] = await Promise.all([
              getFile(REPO, POSTS_PATH, env.GITHUB_TOKEN),
              getFile(REPO, SITEMAP_PATH, env.GITHUB_TOKEN),
              getFile(REPO, articlePath, env.GITHUB_TOKEN),
            ]);
            const posts = text ? JSON.parse(text) : [];
            const changes = [
              { path: POSTS_PATH, text: JSON.stringify(removePost(posts, slug), null, 2) + '\n' },
            ];
            if (sitemap)
              changes.push({ path: SITEMAP_PATH, text: removeFromSitemap(sitemap, slug) });
            if (articleSha) changes.push({ path: articlePath, delete: true });
            return changes;
          },
          `blog: unpublish ${slug}`,
          env.GITHUB_TOKEN,
        );

        return json(200, { ok: true, commitSha }, cors);
      }

      if (url.pathname === '/blog/image' && request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return json(400, { error: '请求格式错误' }, cors);
        }
        const imgCheck = validateImageDataUrl(body.image);
        if (!imgCheck.ok) return json(400, { error: imgCheck.error }, cors);
        const path = blogInlineImagePath();
        await putFile(REPO, path, imgCheck.base64, 'blog: upload inline image', env.GITHUB_TOKEN, {
          alreadyBase64: true,
        });
        return json(200, { ok: true, path }, cors);
      }
    } catch (e) {
      return json(502, { error: e.message || '保存服务出错，请稍后重试' }, cors);
    }

    return json(404, { error: 'not found' }, cors);
  },
};
