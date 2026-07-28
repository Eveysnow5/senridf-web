// 校对结果原文高亮的纯逻辑：定位片段、合并重叠 span、切成标注段序列。
// 零依赖，可 node --test；DOM 组装（<mark>/转义）留在页面。

// 在 text 里找 snippet 首次出现，返回 {index, length} 或 null。
export function locateSnippet(text, snippet) {
  if (!text || !snippet) return null;
  const i = text.indexOf(snippet);
  return i === -1 ? null : { index: i, length: snippet.length };
}

// 按 index 排序，合并重叠（含交叠）的 span；相邻但不重叠保持独立。
export function mergeSpans(spans) {
  const sorted = spans
    .filter((s) => s && s.length > 0)
    .map((s) => ({ index: s.index, length: s.length }))
    .sort((a, b) => a.index - b.index);
  const merged = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && s.index < last.index + last.length) {
      const end = Math.max(last.index + last.length, s.index + s.length);
      last.length = end - last.index;
    } else {
      merged.push({ index: s.index, length: s.length });
    }
  }
  return merged;
}

// 按合并后的 span 把 text 切成 [{text, highlighted}] 段序列。
export function buildAnnotatedSegments(text, spans) {
  const merged = mergeSpans(spans);
  const segs = [];
  let pos = 0;
  for (const s of merged) {
    if (s.index > pos) segs.push({ text: text.slice(pos, s.index), highlighted: false });
    segs.push({ text: text.slice(s.index, s.index + s.length), highlighted: true });
    pos = s.index + s.length;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos), highlighted: false });
  if (segs.length === 0) segs.push({ text, highlighted: false });
  return segs;
}
