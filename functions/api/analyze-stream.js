// Cloudflare Pages Function — streaming proxy for DashScope analysis
import { fetchWithTimeout } from './_lib/fetchWithTimeout.js';
import { CHAT_ENDPOINT, modelFor } from './_lib/models.js';
import { selectRelevantPassages } from '../../js/shared/select-relevant-passages.js';
import {
  buildAnalysisSystemPrompt,
  buildAnalysisUserMessage,
  buildQuestionTail,
} from './_lib/buildAnalysisPrompt.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200 });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = env.QWEN_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'QWEN_API_KEY not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 体积闸门必须在 request.json() **之前**，因为撑死这个函数的正是解析本身。
  // Workers 免费档给每个请求 10ms CPU（请求体上限 100MB、内存 128MB 都不是瓶颈），
  // 而 V8 的 JSON 吞吐约 100–300MB/s，且载荷要被扫两遍：一次 parse、一次转发前的
  // stringify。已知能跑的量级约 1.1MB（两份年报的纯文本）；2026-08-11 图像路径第一版
  // 送 5.3MB（PNG@scale2 × 16 页）时 Cloudflare 在我们的代码执行前就回了 HTML 502——
  // 于是下面那个 catch 里的中文错误信息根本没机会发出去，用户只看到"服务器错误"。
  // 这里提前用 content-length 拦一刀（几乎不耗 CPU），把不可诊断的 502 换成可诊断的 413。
  const declaredLen = Number(request.headers.get('content-length') || 0);
  const MAX_BODY = 3 * 1024 * 1024;
  if (declaredLen > MAX_BODY) {
    return new Response(
      JSON.stringify({
        error: `请求内容过大（${(declaredLen / 1048576).toFixed(1)}MB，上限 3MB）。请减少文件数量或把问题拆开后重试。`,
      }),
      { status: 413, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { files, prompt } = body;

  // 多轮取页（docs/plans/2026-08-12-analysis-multiround-plan.md）。
  // ⚠️ **不传 round 就是今天的单轮路径，一个字节都不变**——单轮是已知可用的，
  // 客户端任一轮出问题都靠"不传这几个字段重跑一次"退回它。
  //
  // roundState / pageIndex 各自设长度上限：多轮把请求次数乘 5，任何无上限的字段
  // 都会被放大 5 倍，而卡人的是 10ms CPU 和 3MB 闸门（见上面的体积闸门注释）。
  const CARRY_LIMIT = 20000;
  const round = Number.isFinite(body.round) && body.round >= 1 ? body.round : null;
  const maxRounds = Number.isFinite(body.maxRounds) ? body.maxRounds : 5;
  const pageIndex = round ? String(body.pageIndex || '').slice(0, CARRY_LIMIT) : '';
  const roundState = round ? String(body.roundState || '').slice(0, CARRY_LIMIT) : '';

  // 多轮的第 1 轮在文件多时**只发页面索引、一份文件都不发**（预算摊到每份 1 页时，
  // 启发式猜的那 1 页大概率不对，不如让模型看着索引自己挑）。所以 files 允许为空——
  // 但仅限"有 round 且有索引"这一种情形，别把真正的空请求也放进来。
  if (!Array.isArray(files) || (files.length === 0 && !(round && pageIndex))) {
    return new Response(JSON.stringify({ error: 'files array required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 每份文件送入的字数预算。此前是 CHAR_LIMIT=30000 且**从开头硬截**——用户上传
  // 187,405 字的年报、问"处置荣耀产生的利润对财报有多大影响"，答案在「合并财务
  // 报表附注」（文档后段）早被截掉，于是模型答"文件未披露"，而那句话是假的：
  // 不是没披露，是没送给它看。现在按提问筛选片段（_lib/selectRelevantPassages）。
  // 80K 字/份 ≈ 单次约 11 万 token ≈ 1.5 元；同一批文档追问时文档前缀命中隐式
  // 缓存（1.5 元/百万，输入原价的 1/8），追问约 0.4 元。
  const CHAR_BUDGET = 80000;
  const question = (prompt || '').trim();

  // 图像路径：前端在有提问时，会用文本层选出相关页码、把那几页渲染成 JPEG 送来
  // （JPEG@scale1.2 而非 PNG@scale2：实测同一页年报 base64 后 92–179KB vs 152–305KB，
  // 而 715×1011 下表格里的「–」「55,853」和附注文字仍准确可读；上面的 CPU 闸门说明了
  // 为什么必须省这个体积）。前端还带了 800KB 字节预算和 5xx/413 退回文本路径的重试，
  // 参数与实测数字见 solutions/demo/analysis.html 的 IMG_* 常量注释。
  // 财报的答案几乎都在表格里，而文本抽取会把表格压平成一维字符串——2026-08-11
  // 实测同一张「其他净收支」表，抽成文本模型读不出来，渲染成图片一眼可读。
  // 所以分工是：文本层定位页码，视觉读内容。文本路径保留给 docx/xlsx/csv、
  // 无提问的综合分析，以及图像路径不可用时的兜底。
  const imageFiles = files.filter((f) => Array.isArray(f.pages) && f.pages.length > 0);
  const textFiles = files.filter((f) => !(Array.isArray(f.pages) && f.pages.length > 0));

  const picked = textFiles.map((f) =>
    selectRelevantPassages(f.content || '', question, { budget: CHAR_BUDGET }),
  );

  const docContext = textFiles
    .map((f, i) => {
      const pk = picked[i];
      const body = pk.text.trim() || '（内容为空，可能为扫描版 PDF，无法提取文字层）';
      // 字数优先用客户端送来的 totalChars（原文字数）。2026-08-12 起前端会先按提问
      // 粗筛一遍再上传（线上载荷曾无上限，撞过 6.8MB 的 413），所以 pk.totalChars 是
      // **粗筛后**的长度，不是原文长度。system prompt 第 9 条要模型据这个数字区分
      // "文件没有"与"我没看到"，报小了就是在削弱那条规则。老客户端不带此字段，回落。
      const note =
        pk.mode === 'selected'
          ? `（本文件共 ${f.totalChars || pk.totalChars} 字，以下为按本次提问筛选出的 ${pk.usedChars} 字相关片段）`
          : '';
      return `【文件${i + 1}：${f.name}】${note}\n${body}`;
    })
    .join('\n\n---\n\n');

  // 提示词构造抽到 _lib/buildAnalysisPrompt.js：它是纯函数、有单测钉住那几条
  // 硬规则（关键信息必须带来源、找不到就说找不到不许猜、禁用外部知识、区分
  // "文件没有"与"我没看到"）。这段提示词已改写三次，内联写在这里的话，下一次
  // 改动很容易把上一次加的规则悄悄删掉。
  // 命中最强的片段单独汇总一份，放在紧贴问题之前。
  // 2026-08-11 实测：「荣耀」在送入的 8 万字里只出现 1 次、位于 77% 处、毫无标记，
  // 模型直接没看见，于是照着"找不到就说找不到"答了"未包含"——检索是对的，是注意力
  // 不够。所以把 top 命中块复制一份到显眼处；完整片段仍作背景保留。
  // 注意用 textFiles[i] 而不是 files[i]：picked 是从 textFiles 映射来的，混合场景
  // （一份 PDF 走图像路径 + 一份 xlsx 走文本路径）下 files 的下标和它对不上，
  // 会把命中片段挂到别的文件名下。
  const highlightBlock = picked
    .map((pk, i) =>
      pk.highlights?.length
        ? `【文件${i + 1}：${textFiles[i].name}】命中片段\n${pk.highlights.join('\n---\n')}`
        : '',
    )
    .filter(Boolean)
    .join('\n\n');

  const systemPrompt = round
    ? buildAnalysisSystemPrompt(question, { round, maxRounds })
    : buildAnalysisSystemPrompt(question);
  const userMessage = buildAnalysisUserMessage(docContext, question, highlightBlock);

  // 有页面图像时把 user content 换成多模态数组：图像在前、问题在最后
  // （既保持缓存前缀稳定，又让问题处在注意力最高的位置）。
  //
  // 多轮时的顺序：[页面索引] → [本轮页面图像] → [已结转 findings] → [问题]。
  // 索引摆最前是为了让它落进隐式缓存的稳定前缀（每轮都一样）；findings 贴着问题，
  // 因为那是模型这一轮唯一还能看到的、关于前几轮的证据。
  let userContent = userMessage;
  if (imageFiles.length > 0) {
    const parts = [];
    if (pageIndex) {
      parts.push({
        type: 'text',
        text: `【页面索引】以下是各文件每一页的开头摘要，**不是全文**，只用来定位该看哪几页：\n\n${pageIndex}`,
      });
    }
    for (const f of imageFiles) {
      const nums = f.pages.map((p) => p.page).join('、');
      parts.push({
        type: 'text',
        text: `【文件：${f.name}】以下是按本次提问筛选出的相关页面图像（原文第 ${nums} 页${
          f.totalPages ? `，共 ${f.totalPages} 页` : ''
        }）。请直接看图读数，表格里的行名与数字以图为准。`,
      });
      for (const pg of f.pages) {
        parts.push({ type: 'image_url', image_url: { url: pg.dataUrl } });
      }
    }
    if (docContext) {
      parts.push({ type: 'text', text: `另有以下文本类文件内容供参考：\n\n${docContext}` });
      if (highlightBlock) {
        parts.push({
          type: 'text',
          text: `【上述文本类文件里与本次提问命中最强的片段】\n${highlightBlock}`,
        });
      }
    }
    if (roundState) {
      parts.push({
        type: 'text',
        text: `【前几轮你已经摘录的内容（图像不会重发，这是你唯一还能看到的证据）】\n${roundState}`,
      });
    }
    parts.push({ type: 'text', text: buildQuestionTail(question, 'image') });
    userContent = parts;
  } else if (round && (pageIndex || roundState)) {
    // 多轮但本轮一页图都没渲染出来（渲染失败或模型只索要了越界页码）。仍要把索引和
    // 结转内容带上，否则这一轮的模型既没有图、也不知道前几轮发生过什么，只能瞎答。
    // ⚠️ 两块都放在 userMessage **之前**：userMessage 末尾就是问题块，追加在它后面
    // 会把问题挤到中间，而"问题在最后"是刻意的（模型对结尾注意力最高）。
    const head = pageIndex
      ? `【页面索引】以下是各文件每一页的开头摘要，**不是全文**：\n\n${pageIndex}\n\n`
      : '';
    const carried = roundState
      ? `【前几轮你已经摘录的内容（图像不会重发，这是你唯一还能看到的证据）】\n${roundState}\n\n`
      : '';
    userContent = `${head}${carried}${userMessage}`;
  }

  try {
    const upstream = await fetchWithTimeout(CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelFor('analyze', env),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: 6000,
        temperature: 0.2,
        stream: true,
        // Same reason as translate-stream: Qwen3 models default to hybrid
        // thinking on DashScope and stream the reasoning as
        // `delta.reasoning_content` first. The client only renders
        // `delta.content` (analysis.html), so the report appears to hang and
        // then land all at once instead of streaming in — which defeats the
        // point of a streaming endpoint. Reasoning tokens also count against
        // the model's free quota while being discarded.
        enable_thinking: false,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: err.error?.message || 'Qwen API error' }), {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 注意：这层 try/catch 只覆盖"建立连接、拿到 headers"这个阶段——一旦下面这行
    // return 执行，函数调用栈就结束了，upstream.body 流式读取是之后由前端消费时才
    // 发生的，如果那时候 DashScope 中途断流，这层 catch 捕获不到。
    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    const msg =
      err.name === 'AbortError' ? '请求超时，请稍后重试' : '分析服务暂时不可用，请稍后重试';
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
