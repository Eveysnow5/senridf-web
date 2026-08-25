// 读取 /api/* 的响应，并把「响应不是我们发的」这件事说清楚。
//
// 我们的端点在**任何路径上都返回 JSON** —— 包括出错时（校验失败、上游报错、
// 超时，全都是 `{error: "…"}`）。所以拿到**非 JSON** 就意味着这个响应
// **不是我们的代码发的**：Cloudflare 的 502/504 错误页、路由不存在时的 404 页、
// 或者被中间设备改写过。这两类的处理方式完全不同，混在一起就无从下手。
//
// 为什么要有这个模块：这个判据在本仓库里**已经被发现过两次，两次都没推广**——
// `analysis.html` 在 2026-08-12 那次 502 之后加了 content-type 判断；
// `translation.html` 有一行 catch 后面写着 `/* HTML error page */`。
// 于是 2026-08-25 同一件事第三次发生时，其余页面仍然直接 `res.json()`，
// 报出 `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` ——
// **把「平台把我们掐了」伪装成「解析错误」**。真实信息（HTTP 502）只在 F12 里，
// 界面上完全看不出来，来回问了四轮才定位。
//
// 文案走 T（`api_*` 三个键）。main.js 没加载时回落中文，不让错误消息本身消失。

const fallback = {
  api_bad_gateway:
    '服务器暂时无法处理请求（HTTP {status}）。这不是本站服务返回的，通常是上游超时或被平台拦下，请稍后重试。',
  api_not_found: '接口地址不存在（HTTP {status}）。多半是部署或路由的问题，不是你的操作有误。',
  api_not_json: '服务器返回了预期之外的内容（HTTP {status}）。这不是本站服务返回的。',
};

function t(key, status) {
  const raw = (window.sdfT ? window.sdfT(key, fallback[key]) : fallback[key]) || fallback[key];
  return raw.replace('{status}', status);
}

/**
 * 读取一个 /api/* 响应体。
 *
 * - 是 JSON → 返回解析后的对象（**不判断 res.ok**，调用方按自己的语义处理
 *   `data.error`；很多端点用 4xx + `{error}` 表达业务错误）。
 * - 不是 JSON → 抛出带 `status` 的 Error，消息里点明「不是本站服务返回的」。
 *
 * @param {Response} res
 * @returns {Promise<object>}
 */
export async function readApiJson(res) {
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch {
    const key =
      res.status === 502 || res.status === 504 || res.status === 503
        ? 'api_bad_gateway'
        : res.status === 404
          ? 'api_not_found'
          : 'api_not_json';
    const err = new Error(t(key, res.status));
    err.status = res.status;
    // 原文开头留给控制台：Cloudflare 的错误页里常带 Error 1101/1102 或 Ray ID，
    // 那是同事在她自己后台查这次请求的唯一凭据。
    err.rawHead = String(raw).trim().slice(0, 200);
    console.error('[api] 非 JSON 响应', res.status, err.rawHead);
    throw err;
  }
}
