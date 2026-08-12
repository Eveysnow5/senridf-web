// 客户端 → Cloudflare Function 这一段（"线上"）的文本字节预算。
//
// 为什么需要
// 服务端的 CHAR_BUDGET=80000 是**载荷过完线之后**才生效的，而两道硬限制恰恰卡在
// 线上这一段：analyze-stream.js 在 request.json() 之前的 3MB 闸门，以及 Workers
// 免费档的 10ms CPU/请求（载荷要被扫两遍：一次 parse、一次转发前的 stringify）。
// 2026-08-12 作者线上实跑撞到「请求内容过大（6.8MB，上限 3MB）」，成因就是
// buildFileContent(file, hasQuestion=true) 直接 return 全文、没有任何上限。
//
// 为什么前端敢筛（4c73767 明确写过"不要在前端预筛"）
// 那次的问题不是"前端筛了"，而是前端用的 scoreSection 是**问题盲**的 —— 只按财务
// 关键词密度和数字密度打分，完全不看用户问了什么，于是服务端的精筛还没上场，答案
// 所在的段落已经被粗筛扔掉了（实测：问"处置荣耀的影响"，答案在「其他净收支」附注里，
// 而那段既不匹配 isSectionHeader 的正则、也进不了 SMART_MAX=25000 的预算）。
// 这里前端用的是和服务端**同一个** selectRelevantPassages（同一个 IDF 打分器、同一个
// 问题），只是预算更宽。同一个排序跑两次，第二次从第一次的高分子集里挑，答案块不会
// 在第一级掉队；tests/text-wire-budget.test.mjs 用真实年报切片钉住了这一点。

/** 已知能跑通的量级约 1.1MB（两份华为年报的纯文本，用户实际跑通过多次），取整到 1MB。 */
export const WIRE_BUDGET_BYTES = 1024 * 1024;

/** 汉字在 JSON 里是 3 字节 UTF-8 且不被转义；中文文档按这个换算最接近真实字节数。 */
const CJK_BYTES_PER_CHAR = 3;

/**
 * selectRelevantPassages 的 budget 是**内容预算**，不是输出长度预算。
 *
 * 它的 `used` 只累加 head 与各块的字数，但返回的 text 还额外插入了一行说明
 * （「以下为按本次提问筛选出的相关段落…」）以及**每两块之间**一句约 30 字的
 * 「中间内容与本次提问无关，已省略」。块越碎插得越多：块长下限 300 字，所以
 * 理论上限约 30/300 = 10%。2026-08-12 实测（真实年报夹具，budget=80000）超 4.1%。
 * 取 15% 作留量。
 *
 * 不去改 selectRelevantPassages 让它把分离器算进预算：那会改变**服务端当前可用
 * 路径**的行为（送入模型的块数会少几个），而这次的目标只是把线上载荷限住。
 * 与其让这个已知偏差留在暗处，不如在这里显式扣掉——tests/text-wire-budget.test.mjs
 * 断言的是**真实 UTF-8 字节数**，偏差变大会当场变红。
 */
const SEPARATOR_OVERHEAD = 0.15;

/** 与 functions/api/analyze-stream.js 的 CHAR_BUDGET 保持一致。改一处就要改另一处。 */
export const SERVER_CHAR_BUDGET = 80000;

/**
 * 单份文件低于这个字数就没什么检索价值了，不再往下摊。
 *
 * ⚠️ 这里**曾经**是 SERVER_CHAR_BUDGET（80000），理由是"送得比服务端会用的还少纯属
 * 自伤"。那个理由只管单份质量、不管总量，而当天晚些时候 image-path-viable.js 让
 * 「6 份文件全走文本」从假想变成常态：6 × 80000 字 × 3 字节 ≈ **1.44MB**，而已知能
 * 跑通的量级是 1.1MB。等于为了单份不吃亏，把整次请求推向 10ms CPU 墙。
 * 总量约束优先于单份质量：15 份以内总字节都还压在 WIRE_BUDGET_BYTES 之内。
 */
export const MIN_USEFUL_CHARS = 20000;

/**
 * 每份走文本路径的文件，在线上允许占用的字符预算。
 *
 * 文件多到连 MIN_USEFUL_CHARS 都摊不出来时（>15 份），总量会超出 WIRE_BUDGET_BYTES。
 * 那时不再往下压：真到十几份年报，413 那句"请减少文件数量"本来就是正确的答案，
 * 把每份压到几千字只会让所有文件都答不出来。
 *
 * @param {number} nTextFiles 走文本路径的文件数（走图像路径的不算）
 * @returns {number} 每份文件的字符预算，直接传给 selectRelevantPassages 的 budget
 */
export function textCharBudget(nTextFiles) {
  if (!Number.isFinite(nTextFiles) || nTextFiles <= 0) return SERVER_CHAR_BUDGET;
  const perFileBytes = Math.floor(WIRE_BUDGET_BYTES / nTextFiles);
  const chars = Math.floor(perFileBytes / (CJK_BYTES_PER_CHAR * (1 + SEPARATOR_OVERHEAD)));
  return Math.max(MIN_USEFUL_CHARS, chars);
}
