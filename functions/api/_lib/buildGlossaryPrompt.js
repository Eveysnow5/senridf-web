// 纯函数：术语表 + 会前上下文（第二梯队钩子）→ 追加进 system prompt 的注入文本。
// 零依赖，可 node --test。空表且空 context 返回空串（不改变原 prompt 行为）。
export function buildGlossaryPrompt(glossary, context = '') {
  const terms = Array.isArray(glossary) ? glossary.filter((t) => t && t.zh && t.ja) : [];
  const parts = [];
  if (terms.length > 0) {
    const lines = terms.map((t) => {
      const en = t.en ? ` / English: ${t.en}` : '';
      const note = t.note ? `（${t.note}）` : '';
      return `- 中文「${t.zh}」= 日本語「${t.ja}」${en}${note}`;
    });
    parts.push(
      'The following are fixed translations for proper nouns (company/product/people names, domain terms). ' +
        'Always render these terms with their given equivalent, adapting inflection and particles to context. ' +
        'Apply in whichever direction matches the source and target language:\n' +
        lines.join('\n'),
    );
  }
  const ctx = typeof context === 'string' ? context.trim() : '';
  if (ctx) {
    parts.push(
      'Meeting context (background for disambiguation only, do not translate or output this):\n' +
        ctx,
    );
  }
  return parts.length > 0 ? '\n\n' + parts.join('\n\n') : '';
}
