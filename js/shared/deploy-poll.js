/**
 * 保存/发布后轮询 sdf-admin Worker 的 /deploy-status，确认本次提交是否已经上线。
 *
 * 2026-10-22 以前是直接轮询同事那个镜像仓库的 HEAD（未认证的 GitHub API，要求仓库公开）。
 * 仓库转私有后那条路会断；而且它只分得出「到了 / 没到」，被上线检查拦下时作者只看到
 * 「几分钟内没有上线」（10-21 blog 发布就是这样）。现在由 Worker 带令牌去查上线任务的
 * 运行记录，判定规则见 workers/sdf-admin/src/deploy-status.js。
 *
 * 为什么要把"查不到"和"还没同步"分开：这两件事在界面上曾经是同一句话
 * （「上线状态未确认」），于是 CSP 拦截、GitHub 限流、网络断，全都表现成
 * "部署有点慢"。2026-08-19 发现请求其实被 CSP 拦下了，正是被这句话盖住的——原代码
 * `catch { /* 网络抖动，继续轮询 *\/ }` 把「请求被浏览器拦下」和「服务器还没准备好」
 * 吞成了同一种情况。
 *
 * 结局必须可区分：
 *   'synced'        上线任务成功，本次提交已推到部署仓库
 *   'blocked'       上线前的检查没过，网站停在上一个版本（runUrl＝那次运行）
 *   'no_permission' Worker 的 GitHub 令牌没有 Actions 读权限，查不了
 *   'unconfirmed'   查得到，但一直没等到结果 —— 部署确实还没跑完
 *   'unreachable'   一次成功响应都没拿到 —— 这不是慢，是请求本身没通
 *
 * fetchStatus()：返回 Worker 的 JSON（{ state, runUrl? }），失败时抛错。
 */
export async function pollDeployStatus({ fetchStatus, sleep, attempts = 15, intervalMs = 20000 }) {
  let okResponses = 0;
  let lastError = null;

  for (let i = 0; i < attempts; i++) {
    await sleep(intervalMs);
    let data;
    try {
      data = await fetchStatus();
    } catch (err) {
      lastError = err;
      continue;
    }
    okResponses++;
    if (data.state === 'live') return { state: 'synced', attempts: i + 1, okResponses, lastError };
    if (data.state === 'blocked' || data.state === 'no_permission') {
      return {
        state: data.state,
        runUrl: data.runUrl || null,
        attempts: i + 1,
        okResponses,
        lastError,
      };
    }
    // 'pending' 或不认识的值：继续等
  }

  return {
    state: okResponses === 0 ? 'unreachable' : 'unconfirmed',
    attempts,
    okResponses,
    lastError,
  };
}
