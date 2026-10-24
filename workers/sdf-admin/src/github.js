// GitHub Contents API 薄封装。只做 IO，不含业务判断。

const GH = 'https://api.github.com';

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'sdf-admin-worker', // GitHub API 必须带 UA
  };
}

function b64encodeUtf8(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  const CHUNK = 8192; // 分块防调用栈溢出
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function b64decodeUtf8(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

// 读文件。文件不存在时返回 { text: null, sha: null }（首次保存场景）。
export async function getFile(repo, path, token) {
  const res = await fetch(`${GH}/repos/${repo}/contents/${path}`, { headers: ghHeaders(token) });
  if (res.status === 404) return { text: null, sha: null };
  if (!res.ok) throw new Error(`GitHub 读取失败（${res.status}）`);
  const data = await res.json();
  return { text: b64decodeUtf8(data.content), sha: data.sha };
}

// 读二进制文件（图片）原样字节。不存在返回 null。
export async function getFileBytes(repo, path, token) {
  const res = await fetch(`${GH}/repos/${repo}/contents/${path}`, {
    headers: { ...ghHeaders(token), Accept: 'application/vnd.github.raw' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub 读取失败（${res.status}）`);
  return res.arrayBuffer();
}

// 写文件：每次现取最新 sha 再提交；409/422 视为并发冲突，重取一次再试。
// content 默认当文本处理（UTF-8→base64）；alreadyBase64=true 时按图片等二进制数据处理，
// content 本身已经是算好的 base64 字符串，直接透传给 GitHub API。
// expectSha（2026-10-18）：传了就**只用这个 sha 写一次**，不再现取最新——内容是基于这个版本
// 合并出来的，若期间文件被别人改过（409/422），抛 code='CONFLICT' 让调用方重读重合并。
// 不传时保持原行为（现取 sha 覆盖），图片等新文件用这条路。
export async function putFile(
  repo,
  path,
  content,
  message,
  token,
  { alreadyBase64 = false, expectSha } = {},
) {
  const pinned = expectSha !== undefined;
  for (let attempt = 0; attempt < (pinned ? 1 : 2); attempt++) {
    const sha = pinned ? expectSha : (await getFile(repo, path, token)).sha;
    const body = { message, content: alreadyBase64 ? content : b64encodeUtf8(content) };
    if (sha) body.sha = sha;
    const res = await fetch(`${GH}/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      return { commitSha: data.commit.sha };
    }
    if (res.status !== 409 && res.status !== 422) {
      let detail = '';
      try {
        detail = (await res.json()).message || '';
      } catch {
        /* 响应非 JSON 时只报状态码 */
      }
      throw new Error(`GitHub 写入失败（${res.status}${detail ? `：${detail}` : ''}）`);
    }
  }
  const err = new Error('保存冲突，请刷新页面重试');
  err.code = 'CONFLICT';
  throw err;
}

async function gh(method, url, token, body) {
  const res = await fetch(`${GH}${url}`, {
    method,
    headers: { ...ghHeaders(token), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 响应非 JSON 时只报状态码 */
  }
  return { res, data };
}

// 多个文件**一次提交**（Git Data API：blob → tree → commit → 移动分支）。2026-10-22。
// 为什么：发布一篇 blog 原来是 3〜4 次提交（封面、文章页、posts.json），每次提交都触发一次上线检查，
// 而「有文章页、posts.json 还没更新」这种中间状态本身就过不了检查。一次提交＝要么全上、要么全不上。
//
// buildChanges()：每次尝试都重新调用（分支在这期间被别人推进时要基于最新内容重算，例如 posts.json），
//   返回 [{ path, text } | { path, base64 } | { path, delete: true }]。
// 分支移动不是快进（期间有别的提交）→ 重来；三次都不行抛 CONFLICT。
export async function commitFiles(repo, buildChanges, message, token, branch = 'main') {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await gh('GET', `/repos/${repo}/git/ref/heads/${branch}`, token);
    if (!ref.res.ok) throw new Error(`GitHub 读取分支失败（${ref.res.status}）`);
    const headSha = ref.data.object.sha;
    const head = await gh('GET', `/repos/${repo}/git/commits/${headSha}`, token);
    if (!head.res.ok) throw new Error(`GitHub 读取提交失败（${head.res.status}）`);

    const changes = await buildChanges();
    const tree = [];
    for (const c of changes) {
      if (c.delete) {
        tree.push({ path: c.path, mode: '100644', type: 'blob', sha: null });
        continue;
      }
      const blob = await gh('POST', `/repos/${repo}/git/blobs`, token, {
        content: c.base64 !== undefined ? c.base64 : b64encodeUtf8(c.text),
        encoding: 'base64',
      });
      if (!blob.res.ok) throw new Error(`GitHub 写入失败（blob ${c.path}：${blob.res.status}）`);
      tree.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.data.sha });
    }
    const t = await gh('POST', `/repos/${repo}/git/trees`, token, {
      base_tree: head.data.tree.sha,
      tree,
    });
    if (!t.res.ok) {
      const why = t.data && t.data.message ? `：${t.data.message}` : '';
      throw new Error(`GitHub 写入失败（tree：${t.res.status}${why}）`);
    }
    const commit = await gh('POST', `/repos/${repo}/git/commits`, token, {
      message,
      tree: t.data.sha,
      parents: [headSha],
    });
    if (!commit.res.ok) throw new Error(`GitHub 写入失败（commit：${commit.res.status}）`);
    const move = await gh('PATCH', `/repos/${repo}/git/refs/heads/${branch}`, token, {
      sha: commit.data.sha,
      force: false,
    });
    if (move.res.ok) return { commitSha: commit.data.sha };
    if (move.res.status !== 422 && move.res.status !== 409) {
      throw new Error(`GitHub 写入失败（ref：${move.res.status}）`);
    }
    // 422：不是快进（期间有人推了），基于新的 HEAD 重来
  }
  const err = new Error('保存冲突，请刷新页面重试');
  err.code = 'CONFLICT';
  throw err;
}

// 删除文件（下架文章用）。文件已不存在时视为已删除，幂等返回。
export async function deleteFile(repo, path, message, token) {
  const { sha } = await getFile(repo, path, token);
  if (!sha) return { deleted: false };
  const res = await fetch(`${GH}/repos/${repo}/contents/${path}`, {
    method: 'DELETE',
    headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha }),
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).message || '';
    } catch {
      /* 响应非 JSON 时只报状态码 */
    }
    throw new Error(`GitHub 删除失败（${res.status}${detail ? `：${detail}` : ''}）`);
  }
  return { deleted: true };
}

// 某个 workflow 在 main 上最近的运行记录（查上线状态用，见 deploy-status.js）。
// 需要令牌有 Actions: Read；没有时 GitHub 回 403（细粒度令牌缺权限也可能回 404），
// 抛 code='NO_ACTIONS_PERMISSION'，让前端说清楚是令牌少了权限，而不是「部署慢」。
export async function listWorkflowRuns(repo, workflow, token) {
  const { res, data } = await gh(
    'GET',
    `/repos/${repo}/actions/workflows/${workflow}/runs?branch=main&per_page=30`,
    token,
  );
  if (res.status === 403 || res.status === 404) {
    const err = new Error(`GitHub 拒绝读取运行记录（${res.status}）`);
    err.code = 'NO_ACTIONS_PERMISSION';
    throw err;
  }
  if (!res.ok) throw new Error(`GitHub 读取运行记录失败（${res.status}）`);
  return data.workflow_runs || [];
}
