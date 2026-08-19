/**
 * 发布后轮询镜像仓库 HEAD，确认本次提交是否已经上线。
 *
 * 为什么要把"查不到"和"还没同步"分开：这两件事在界面上曾经是同一句话
 * （「上线状态未确认」），于是 CSP 拦截、GitHub 限流、网络断，全都表现成
 * "部署有点慢"。作者等满 15 次 x 20 秒 = 5 分钟，只换来一句不含任何信息的提示。
 * 2026-08-19 发现 `api.github.com` 根本不在 CSP `connect-src` 白名单里，
 * 正是被这句话盖住的——原代码 `catch { /* 网络抖动，继续轮询 *\/ }` 把
 * 「请求被浏览器拦下」和「服务器还没准备好」吞成了同一种情况。
 *
 * 三种结局必须可区分：
 *   'synced'      镜像 HEAD == 本次提交，确认上线
 *   'unconfirmed' 查得到镜像，但一直没等到本次提交 —— 部署确实还没跑完
 *   'unreachable' 一次成功响应都没拿到 —— 这不是慢，是请求本身没通
 */
export async function pollMirrorHead({
  url,
  commitSha,
  fetchImpl,
  sleep,
  attempts = 15,
  intervalMs = 20000,
}) {
  let okResponses = 0;
  let lastError = null;

  for (let i = 0; i < attempts; i++) {
    await sleep(intervalMs);
    try {
      const res = await fetchImpl(url);
      if (!res.ok) {
        // 未认证的 GitHub API 是 60 次/小时/IP，超了会返回 **格式完全正常的 JSON**，
        // 所以"解析成功"不能算作"查到了"，必须先看状态码。
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      okResponses++;
      if (data.sha === commitSha) {
        return { state: 'synced', sha: data.sha, attempts: i + 1, okResponses, lastError };
      }
    } catch (err) {
      lastError = err;
    }
  }

  return {
    state: okResponses === 0 ? 'unreachable' : 'unconfirmed',
    sha: null,
    attempts,
    okResponses,
    lastError,
  };
}
