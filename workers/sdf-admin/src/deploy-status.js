// 「这次保存上线了没有」的判定。只做判断，不做 IO（IO 在 github.js 的 listWorkflowRuns）。
//
// 以前后台直接轮询同事那个镜像仓库的 HEAD（未认证、要求仓库公开）。仓库转私有后那条路就断了，
// 而且它只能回答「到了」或「没到」：被上线检查拦下时，作者只看到「几分钟内没有上线」。
// 现在改看源仓库里 Mirror to deploy repo（sync-upstream.yml）的运行记录，能直接说出「被拦下」。
//
// 为什么不能只看本次提交自己的那次运行：
//   - 那个 workflow 每次都 checkout main 的**当前**末端再推（不是触发它的提交），
//   - 并且 cancel-in-progress：一次 blog 发布连着几个提交时，前面的运行会被后面的取消。
// 所以提交 X 的运行被取消很正常，X 是被之后某次运行一起推上去的。判定规则：
//   在「X 自己的运行，以及它之后触发的运行」里——
//     有一次成功              → live（X 已经在 main 上，之后任何一次成功的推送都包含它）
//     否则还有没跑完的        → pending
//     否则有失败的            → blocked（检查没过，网站停在上一个版本）
//   X 的运行还没出现在列表里   → pending（推送后要过几秒 GitHub 才登记）

export const DEPLOY_WORKFLOW = 'sync-upstream.yml';

export function deployState(runs, sha) {
  const own = runs.filter((r) => r.head_sha === sha);
  if (own.length === 0) return { state: 'pending' };
  // run id 单调递增：id 不小于 X 那次运行的，都是 X 已经在 main 上之后触发的
  const fromId = Math.min(...own.map((r) => r.id));
  const relevant = runs.filter((r) => r.id >= fromId);

  if (relevant.some((r) => r.status === 'completed' && r.conclusion === 'success')) {
    return { state: 'live' };
  }
  if (relevant.some((r) => r.status !== 'completed')) return { state: 'pending' };
  const failed = relevant.filter((r) => r.conclusion === 'failure').sort((a, b) => b.id - a.id)[0];
  if (failed) return { state: 'blocked', runUrl: failed.html_url };
  // 全部被取消、又没有更新的运行：不该发生，按「没跑完」处理，让前端等到超时
  return { state: 'pending' };
}
