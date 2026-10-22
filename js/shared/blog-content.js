// Blog 正文的共用规则：后台编辑器（admin/blog/）、文章页（Worker 生成的 solutions/blog/<slug>.html）、
// 博客列表（solutions/blog/index.html）和 sdf-admin Worker 都从这里取，**一处定义**。
//
// 为什么（2026-10-22）：作者要能改字体・字号・颜色，并且「编辑时看到的＝发布后的」。
// 一致性靠三件事同时成立：① 同一份样式（css/main.css 的 .blog-post__body）② 同一组字体（FONT_CSS_URL）
// ③ 同一套 HTML 过滤（PURIFY_CONFIG）。三者任何一个在编辑器和文章页之间分叉，就会「看到的和发出去的不一样」。
//
// 正文格式：新文章存 HTML（编辑器产出）；2026-10-22 之前的稿子是 Markdown，渲染时自动转换（isHtml 判断）。
// 本模块不碰 DOM、不在加载时读 window，Worker（无 DOM）也能 import。

/** 编辑器与文章页加载的同一组网页字体（Google Fonts，CSP 已放行 fonts.googleapis/gstatic）。 */
export const FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+JP:wght@400;700&family=Noto+Serif+SC:wght@400;700&family=Inter:wght@400;500;700&display=swap';

/** 字体选项：value 是写进正文的 font-family（只用上面加载了的字体，否则两边回退字体可能不同）。 */
export const FONT_OPTIONS = [
  { key: 'default', label: '默认字体', value: '' },
  { key: 'sans', label: '黑体（无衬线）', value: "'Noto Sans JP', 'Noto Sans SC', sans-serif" },
  { key: 'serif', label: '明朝／宋体（衬线）', value: "'Noto Serif JP', 'Noto Serif SC', serif" },
  { key: 'latin', label: '英文字体 Inter', value: "Inter, 'Noto Sans JP', sans-serif" },
];

/** 字号选项：value 是 CSS font-size。正文默认 16px（css/main.css .blog-post__body），「标准」与之相同。 */
export const SIZE_OPTIONS = [
  { key: 'small', label: '小', value: '14px' },
  { key: 'normal', label: '标准', value: '' },
  { key: 'large', label: '大', value: '20px' },
  { key: 'xlarge', label: '特大', value: '26px' },
  { key: 'huge', label: '超大', value: '34px' },
];

/** 常用颜色（与站点配色一致）；编辑器另有自选色。value 为空＝恢复默认颜色。 */
export const COLOR_OPTIONS = [
  { key: 'default', label: '默认', value: '' },
  { key: 'accent', label: '深绿', value: '#1D3D2D' },
  { key: 'green', label: '绿', value: '#3A6A4A' },
  { key: 'gray', label: '灰', value: '#8C8C88' },
  { key: 'red', label: '红', value: '#B42318' },
  { key: 'blue', label: '蓝', value: '#1D4ED8' },
  { key: 'orange', label: '橙', value: '#B45309' },
];

/**
 * DOMPurify 配置：编辑器保存、编辑器载入、文章页渲染**用同一份**。
 * 允许 style 属性（字体・字号・颜色就写在这里）；CSP 已允许内联样式（style-src 'unsafe-inline'），
 * 而外部资源仍受 CSP 白名单约束。表格・代码块只为兼容旧 Markdown 稿。
 */
export const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'h2',
    'h3',
    'h4',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'span',
    'a',
    'ul',
    'ol',
    'li',
    'blockquote',
    'img',
    'hr',
    'div',
    'pre',
    'code',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  ALLOWED_ATTR: ['style', 'href', 'src', 'alt', 'title', 'target', 'rel'],
};

/** 正文是不是 HTML（编辑器产出）；否则当旧 Markdown 稿处理。 */
export function isHtml(body) {
  return /^\s*<(p|h[1-6]|div|ul|ol|blockquote|img|span|strong|b|em|i|u|table|pre|hr|br)\b/i.test(
    String(body || ''),
  );
}

/**
 * 正文 → 安全的 HTML。lib = { marked, DOMPurify }（浏览器里传 window 上的两个库）。
 * 编辑器载入和文章页渲染都走这一个函数。
 */
export function bodyToHtml(body, lib) {
  const raw = String(body || '');
  const html = isHtml(raw) ? raw : lib.marked.parse(markdownForBlog(raw));
  return lib.DOMPurify.sanitize(html, PURIFY_CONFIG);
}

/**
 * 旧 Markdown 稿的预处理：去掉行首缩进。
 * Markdown 把缩进 4 格的行当「代码块」——等宽小字、不换行、超出部分被截掉、**加粗**记号原样露出。
 * 博客正文不会写代码，行首缩进只会是从别处复制带来的（2026-10-22 第一篇的「关于X：」五段就是这样）。
 * 用 ``` 围起来的真代码块不动。
 */
export function markdownForBlog(md) {
  let fenced = false;
  return String(md)
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
        return line.trim();
      }
      return fenced ? line : line.replace(/^[ \t\u3000]+/, '');
    })
    .join('\n');
}

/** 列表页摘要：去掉标签和 Markdown 记号，取前 n 个字。 */
export function plainExcerpt(body, n = 80) {
  return String(body || '')
    .replace(/<(br|\/p|\/h[1-6]|\/li|\/div|\/blockquote)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/[#*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n);
}

/**
 * 标签序列（只看标签名）。一键翻译后拿中文和译文比：不一致＝模型改动了格式，后台要提示作者检查，
 * 而不是悄悄发布一份格式丢了一半的译文。
 */
export function tagSequence(html) {
  return [...String(html || '').matchAll(/<(\/?)([a-z][a-z0-9]*)/gi)].map(
    (m) => m[1] + m[2].toLowerCase(),
  );
}
