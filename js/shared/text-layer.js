// 文字层体检：一份 PDF 到底有多少页是能读的文字，多少页只是图片。
//
// 修的是什么（2026-08-13 韩红样本实测）：那批 13 份里一多半是纯扫描件，文字层抽出来
// 是空的。后果不是"读不出内容"这么简单——**索引为空、FIND 永远未命中，而 FIND 的回执
// 写的是「全文未命中」**。于是工具把「我读不了」表达成了「文件里没有」，正是核心规则
// 第九条要防的那件事，只不过这次是系统层面造成的，模型再守规矩也没用。
//
// 设计取向：**让数字本身承担说明责任，标签只决定警告强度。**
// 阈值是拍的（没有真实扫描件夹具可定标，见 memory「单样本定标必崩」），所以回执里
// 一律写明「N 页中 M 页没有文字层」这种可自证的事实；万一阈值定歪，模型看到的仍是
// 真实数字，不至于被一个错标签把话说反。

/** 一页要有多少个非空白字符才算"有文字层"。低于此数的页（空白页、只有 logo 的封面）不计。 */
const MIN_CHARS_PER_PAGE = 20;

/** 有文字层的页占比低于此值 → 视作扫描件，查找/索引对它基本无效。 */
const SCANNED_MAX_RATIO = 0.1;
/** 低于此值 → 文字层残缺，可用但要提醒"没搜到可能只是那几页没文字"。 */
const THIN_MAX_RATIO = 0.6;

/**
 * @param {string[]} pageTexts 每页文字层，下标 0 = 第 1 页
 * @param {{minChars?:number}} [opts]
 * @returns {{pages:number, withText:number, withoutText:number, ratio:number, kind:'text'|'thin'|'scanned'|'empty'}}
 */
export function assessTextLayer(pageTexts, opts = {}) {
  const pages = Array.isArray(pageTexts) ? pageTexts : [];
  const minChars = Number.isFinite(opts.minChars) ? opts.minChars : MIN_CHARS_PER_PAGE;

  if (pages.length === 0) {
    return { pages: 0, withText: 0, withoutText: 0, ratio: 0, kind: 'empty' };
  }

  let withText = 0;
  for (const p of pages) {
    if (String(p || '').replace(/\s/g, '').length >= minChars) withText++;
  }
  const ratio = withText / pages.length;

  let kind = 'text';
  if (ratio <= SCANNED_MAX_RATIO) kind = 'scanned';
  else if (ratio < THIN_MAX_RATIO) kind = 'thin';

  return { pages: pages.length, withText, withoutText: pages.length - withText, ratio, kind };
}

/**
 * 给模型看的一句话说明。正常文件返回空串（不占预算、不加噪声）。
 *
 * ⚠️ 措辞的要害在最后半句：**"查不到" ≠ "文件里没有"**。
 * 少了这半句，模型面对一份扫描件会诚实地报告"该文件中未提及"，
 * 而那句话本身就是错的——它只是没被读到。
 */
export function describeTextLayer(assessment) {
  if (!assessment || assessment.kind === 'text' || assessment.pages === 0) return '';
  if (assessment.kind === 'scanned') {
    return (
      `⚠️ 本文件共 ${assessment.pages} 页，其中 ${assessment.withoutText} 页没有文字层（扫描件）。` +
      `索引与关键词查找对这些页**无效**：查不到不等于文件里没有，只能靠取页看图像。`
    );
  }
  return (
    `⚠️ 本文件 ${assessment.pages} 页中有 ${assessment.withoutText} 页没有文字层。` +
    `这些页查找不到，未命中不等于文件里没有。`
  );
}

/** FIND 回执的尾注。与 describeTextLayer 分开：回执里要更短，且只在真会误导时才加。 */
export function findCaveat(assessment) {
  if (!assessment || assessment.kind === 'text' || assessment.pages === 0) return '';
  if (assessment.kind === 'scanned') {
    return `  ⚠️ 该文件 ${assessment.pages} 页中 ${assessment.withoutText} 页无文字层，查找对其无效——以上"未命中"不能作为"文件里没有"的证据。`;
  }
  return `  ⚠️ 该文件有 ${assessment.withoutText}/${assessment.pages} 页无文字层，未命中不代表文件里没有。`;
}

export const TEXT_LAYER_THRESHOLDS = { MIN_CHARS_PER_PAGE, SCANNED_MAX_RATIO, THIN_MAX_RATIO };
