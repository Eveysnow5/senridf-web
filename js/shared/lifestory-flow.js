// 客户端纯逻辑：根据 probe 结果 + 本锚点已追问次数 + 上限，决定追问还是换题。
// 零依赖，可 node --test。DOM/流程胶水留在页面。
export function decideProbe(probeResult, followupCount, cap = 2) {
  const fu = probeResult && probeResult.followup;
  const ask =
    !!fu && fu.ask === true && typeof fu.question === 'string' && fu.question.trim().length > 0;
  return ask && followupCount < cap ? 'ask' : 'advance';
}
