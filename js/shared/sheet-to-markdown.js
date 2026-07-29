// 纯函数：把二维表格行（如 SheetJS `sheet_to_json(sheet, {header:1})` 的输出）转成 Markdown 表格。
// 零依赖，可 node --test。空表/非数组返回空串；参差行按最大列数补齐；单元格转义 | 与换行。
function cell(v) {
  return String(v == null ? '' : v)
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

export function sheetRowsToMarkdown(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const cols = Math.max(...rows.map((r) => (Array.isArray(r) ? r.length : 0)));
  if (cols === 0) return '';
  const pad = (r) => {
    const arr = (Array.isArray(r) ? r : []).slice(0, cols).map(cell);
    while (arr.length < cols) arr.push('');
    return arr;
  };
  const line = (cells) => `| ${cells.join(' | ')} |`;
  const header = pad(rows[0]);
  const sep = header.map(() => '---');
  const body = rows.slice(1).map((r) => line(pad(r)));
  return [line(header), line(sep), ...body].join('\n');
}
