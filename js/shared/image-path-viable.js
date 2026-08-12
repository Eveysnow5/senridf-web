// 图像路径值不值得走，取决于每份文件分到的字节预算够不够看**两页**。
//
// 背景：`IMG_TOTAL_BUDGET`（800KB，受 Workers 10ms CPU 配额支配）在候选文件间均分。
// 文件一多，每份分到的额度就掉到单页量级，而 renderPagesToImages 里的 `used &&`
// 又保证"至少送一页"——于是每份文件正好送 1 页。
//
// 2026-08-12 实测（地铁研究样本，6 份年报，问"对政府补助的依赖有多大"）：
//   每份预算 floor(800KB/6)=133KB，单页 JPEG 实测 92–179KB → 每份 1 页。
//   北京地铁年报 75 页，模型看到的是第 31 页（债券条款），全不相关；香港地铁看到的
//   是业务回顾。6 份里 4 份哑掉，模型只能答"所提供的片段中未包含"。
//
// 关键在于：**走图像路径的文件不发 content 字段**（buildPayload 里 push 完 pages 就
// continue），所以选错那 1 页 ≠ 少看几页，而是**这份文件归零**。相比之下文本路径能在
// 全文 75 页里按提问做 IDF 检索，命中利润表的机会大得多。
// 所以预算撑不起 2 页时退回文本路径，不是退化，是选了更好的那条路。
//
// ⚠️ 这是多轮取页落地前的过渡措施，但**不是一次性的**：多轮的第 1 轮同样要靠启发式
// 选页（计划里"首轮就给启发式选出的页，省一轮"），同样会遇到这个饥饿问题。
// 多轮真正解决它的方式是第 2 轮起**不再按文件均分**——模型索要哪几页，就把整份 800KB
// 花在那几页上，文件数不再是惩罚。

/**
 * 单份文件走图像路径的最低预算：2 × 单页**中位**体积（约 130KB）。
 *
 * 不取单页上限 179KB：那会让 3 份文件也被判成不可行（800/3=266KB < 358KB），
 * 而实测记录是"1 份约 5 页、2 份各约 3 页、**3 份各约 2 页**"——3 份是能work的，
 * 按上限取就会否掉一个已知可用的场景。阈值要贴实测的中位数，不是最坏情况。
 */
export const IMG_MIN_PER_FILE = 260 * 1024;

/**
 * @param {number} nCandidates 有资格走图像路径的文件数
 * @param {number} totalBudget 图像总字节预算（IMG_TOTAL_BUDGET）
 * @returns {boolean} 为 false 时整次请求全走文本路径
 */
export function imagePathViable(nCandidates, totalBudget) {
  if (!Number.isFinite(nCandidates) || nCandidates <= 0) return false;
  if (!Number.isFinite(totalBudget) || totalBudget <= 0) return false;
  return Math.floor(totalBudget / nCandidates) >= IMG_MIN_PER_FILE;
}
