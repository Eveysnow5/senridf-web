// Blog 后台的所见即所得编辑器（2026-10-22）。被 admin/blog/index.html 以 module 加载，挂到 window.sdfBlogEd。
//
// 作者的要求：① 能改字体・字号・颜色 ② 改完当场看到 ③ 发布后和看到的一致 ④ 日英版本同样能改。
// 一致性的做法：编辑区是 iframe（admin/blog/frame.html），和文章页加载同一份 main.css、同一组字体；
// 保存时用和文章页同一套 DOMPurify 配置过滤（js/shared/blog-content.js）。所以编辑区里的 DOM
// 就是发布出去的 HTML，不存在「编辑器的内部格式」→「输出格式」这一层转换。
//
// 格式命令用浏览器自带的 execCommand（不引第三方编辑器）。字体・字号・颜色的「恢复默认」浏览器没有现成命令：
// 先用一个哨兵值执行，再把带哨兵值的 span 改成目标值或去掉该属性（applyStyle）。

import {
  FONT_OPTIONS,
  SIZE_OPTIONS,
  COLOR_OPTIONS,
  PURIFY_CONFIG,
  bodyToHtml,
  tagSequence,
} from '/js/shared/blog-content.js?v=7eeefd1b98';
import { blogImagePathOf } from '/js/shared/blog-posts-model.js?v=dc577c8610';

const LANGS = ['zh', 'ja', 'en'];
const PLACEHOLDER = { zh: '在这里写中文正文…', ja: '日本語の本文', en: 'English body' };
const frames = {};
let onChange = () => {};
let lastLang = 'zh';
const ready = {};
// 网站还没构建完的博客图片：编辑区里显示 Worker 取来的原图，原路径记在这个属性上，getBody 时还原。
const LOCAL_ATTR = 'data-sdf-path';
let resolveAsset = null;

const doc = (lang) => frames[lang].contentDocument;
const root = (lang) => doc(lang).getElementById('ed');
const lib = () => ({ marked: window.marked, DOMPurify: window.DOMPurify });

function fitHeight(lang) {
  const f = frames[lang];
  if (!f || !f.contentDocument) return;
  f.style.height = `${Math.max(420, f.contentDocument.documentElement.scrollHeight)}px`;
}

function escapeText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 粘贴一律按纯文本：Word / 网页带进来的字体・颜色・奇怪的标签会让「看到的」和过滤后的结果不一致。
// 空行分段落，单个换行变 <br>。格式用工具栏加。
function onPaste(lang, e) {
  e.preventDefault();
  const text = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
  if (!text) return;
  const paras = text.replace(/\r\n?/g, '\n').split(/\n{2,}/);
  const html =
    paras.length === 1
      ? escapeText(paras[0]).replace(/\n/g, '<br>')
      : paras.map((p) => `<p>${escapeText(p).replace(/\n/g, '<br>')}</p>`).join('');
  doc(lang).execCommand('insertHTML', false, html);
}

// 编辑区里的图片加载失败（多半是刚上传、网站还没构建完）：改用 Worker 取的原图显示
function onImgError(e) {
  const img = e.target;
  if (!img || img.tagName !== 'IMG' || img.hasAttribute(LOCAL_ATTR) || !resolveAsset) return;
  const path = blogImagePathOf(img.getAttribute('src'));
  if (!path) return;
  img.setAttribute(LOCAL_ATTR, path);
  resolveAsset(path)
    .then((url) => {
      if (img.getAttribute(LOCAL_ATTR) === path) img.src = url;
    })
    .catch((err) => {
      // 取不到原图：这张图在编辑区里显示为破图，正文里的路径不受影响（上线后就正常了）
      console.warn('[blog] 编辑区图片取不到', path, err);
    });
}

function wire(lang) {
  const d = doc(lang);
  d.addEventListener('error', onImgError, true);
  d.execCommand('defaultParagraphSeparator', false, 'p');
  const r = root(lang);
  r.dataset.placeholder = PLACEHOLDER[lang];
  r.addEventListener('input', () => {
    fitHeight(lang);
    onChange(lang);
  });
  r.addEventListener('focus', () => {
    lastLang = lang;
  });
  r.addEventListener('paste', (e) => onPaste(lang, e));
  new (frames[lang].contentWindow.ResizeObserver || ResizeObserver)(() => fitHeight(lang)).observe(
    d.body,
  );
  fitHeight(lang);
}

/** frame 元素登记；返回全部载入完成的 Promise。 */
export function init(frameEls, changeCb, opts = {}) {
  onChange = changeCb || onChange;
  resolveAsset = opts.resolveAsset || null;
  for (const lang of LANGS) {
    frames[lang] = frameEls[lang];
    ready[lang] = new Promise((resolve) => {
      const f = frames[lang];
      const done = () => {
        wire(lang);
        resolve();
      };
      if (
        f.contentDocument &&
        f.contentDocument.readyState === 'complete' &&
        f.contentDocument.getElementById('ed')
      )
        done();
      else f.addEventListener('load', done, { once: true });
    });
  }
  return Promise.all(LANGS.map((l) => ready[l]));
}

/** 写入正文（HTML 或旧 Markdown 稿，都先过滤）。 */
export async function setBody(lang, body) {
  await ready[lang];
  const html = bodyToHtml(body || '', lib());
  root(lang).innerHTML = html || '';
  fitHeight(lang);
}

/** 取正文：与文章页同一套过滤后的 HTML；只有空段落时算空。 */
export function getBody(lang) {
  if (!frames[lang] || !frames[lang].contentDocument) return '';
  const r = root(lang);
  if (!r) return '';
  let src = r.innerHTML;
  if (r.querySelector(`img[${LOCAL_ATTR}]`)) {
    const c = r.cloneNode(true);
    for (const img of c.querySelectorAll(`img[${LOCAL_ATTR}]`)) {
      img.setAttribute('src', '/' + img.getAttribute(LOCAL_ATTR));
      img.removeAttribute(LOCAL_ATTR);
    }
    src = c.innerHTML;
  }
  const html = window.DOMPurify.sanitize(src, PURIFY_CONFIG).trim();
  const text = (r.textContent || '').trim();
  return text || /<img\b/i.test(html) ? html : '';
}

// ── 格式命令 ───────────────────────────────────────────────────────────────

function focus(lang) {
  frames[lang].contentWindow.focus();
}

function exec(lang, cmd, value = null, css = false) {
  const d = doc(lang);
  focus(lang);
  d.execCommand('styleWithCSS', false, css);
  d.execCommand(cmd, false, value);
  fixFontTags(lang);
  onChange(lang);
}

// 个别浏览器在 styleWithCSS 下仍会产出 <font>（过滤规则不允许，会丢格式）：转成 span。
function fixFontTags(lang) {
  const d = doc(lang);
  for (const f of [...root(lang).querySelectorAll('font')]) {
    const s = d.createElement('span');
    if (f.color) s.style.color = f.color;
    if (f.face) s.style.fontFamily = f.face;
    if (f.size === '7') s.style.fontSize = 'xxx-large';
    while (f.firstChild) s.appendChild(f.firstChild);
    f.replaceWith(s);
  }
}

const SENTINEL = {
  fontFamily: { cmd: 'fontName', arg: 'sdfsentinel', match: (v) => /sdfsentinel/.test(v) },
  fontSize: { cmd: 'fontSize', arg: '7', match: (v) => v === 'xxx-large' },
  color: { cmd: 'foreColor', arg: '#010203', match: (v) => /rgb\(1,\s*2,\s*3\)|#010203/i.test(v) },
};

/** 设字体 / 字号 / 颜色；value 为空＝恢复默认（去掉该属性）。 */
export function applyStyle(lang, prop, value) {
  const s = SENTINEL[prop];
  exec(lang, s.cmd, s.arg, true);
  for (const el of [...root(lang).querySelectorAll('[style]')]) {
    if (!s.match(el.style[prop])) continue;
    if (value) el.style[prop] = value;
    else el.style.removeProperty(prop.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()));
    if (el.tagName === 'SPAN' && !el.getAttribute('style').trim()) el.replaceWith(...el.childNodes);
  }
  onChange(lang);
}

export const commands = {
  bold: (l) => exec(l, 'bold'),
  italic: (l) => exec(l, 'italic'),
  underline: (l) => exec(l, 'underline'),
  h2: (l) => exec(l, 'formatBlock', 'h2'),
  h3: (l) => exec(l, 'formatBlock', 'h3'),
  p: (l) => exec(l, 'formatBlock', 'p'),
  quote: (l) => exec(l, 'formatBlock', 'blockquote'),
  ul: (l) => exec(l, 'insertUnorderedList'),
  ol: (l) => exec(l, 'insertOrderedList'),
  clear: (l) => {
    exec(l, 'removeFormat');
    exec(l, 'formatBlock', 'p');
  },
  link: (l) => {
    const url = window.prompt('链接地址（https://…）');
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
      window.alert('请输入以 https:// 开头的地址');
      return;
    }
    exec(l, 'createLink', url);
  },
};

/** 在某语言编辑区的光标处插入图片（已上传，path 是仓库内路径）。
 *  localSrc：刚上传时手上的 data: URL——网站还没构建完，先用它显示，正文里存的仍是 /path。 */
export function insertImage(lang, path, localSrc) {
  exec(
    lang,
    'insertHTML',
    localSrc
      ? `<img src="${localSrc}" ${LOCAL_ATTR}="${path}" alt="">`
      : `<img src="/${path}" alt="">`,
  );
}

export function lastFocused() {
  return lastLang;
}

/** 工具栏：挂在 container 里，作用于 getLang() 返回的那个编辑区。 */
export function buildToolbar(container, getLang, { onImage } = {}) {
  container.innerHTML = '';
  const el = (tag, attrs = {}, text = '') => {
    const e = document.createElement(tag);
    Object.assign(e, attrs);
    if (text) e.textContent = text;
    return e;
  };
  const btn = (label, title, fn) => {
    const b = el('button', { type: 'button', title }, label);
    // mousedown 不抢焦点，编辑区里的选区留着
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => fn(getLang()));
    container.appendChild(b);
    return b;
  };
  const select = (title, options, prop) => {
    const s = el('select', { title });
    s.appendChild(el('option', { value: '__' }, title));
    options.forEach((o, i) => s.appendChild(el('option', { value: String(i) }, o.label)));
    s.addEventListener('change', () => {
      if (s.value !== '__') applyStyle(getLang(), prop, options[Number(s.value)].value);
      s.value = '__';
    });
    container.appendChild(s);
  };
  select('字体', FONT_OPTIONS, 'fontFamily');
  select('字号', SIZE_OPTIONS, 'fontSize');
  const colors = el('span', { className: 'ed-colors' });
  for (const c of COLOR_OPTIONS) {
    const b = el('button', {
      type: 'button',
      title: `文字颜色：${c.label}`,
      className: 'ed-swatch',
    });
    b.style.background = c.value || '#1C1C1C';
    if (!c.value) b.textContent = 'A';
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => applyStyle(getLang(), 'color', c.value));
    colors.appendChild(b);
  }
  const pick = el('input', { type: 'color', title: '自选颜色', value: '#1d3d2d' });
  pick.addEventListener('change', () => applyStyle(getLang(), 'color', pick.value));
  colors.appendChild(pick);
  container.appendChild(colors);
  btn('B', '加粗', commands.bold).style.fontWeight = '700';
  btn('I', '斜体', commands.italic).style.fontStyle = 'italic';
  btn('U', '下划线', commands.underline).style.textDecoration = 'underline';
  btn('大标题', '小节标题', commands.h2);
  btn('小标题', '小标题', commands.h3);
  btn('正文', '恢复成普通段落', commands.p);
  btn('• 列表', '项目符号列表', commands.ul);
  btn('1. 列表', '编号列表', commands.ol);
  btn('引用', '引用', commands.quote);
  btn('链接', '把选中的文字做成链接', commands.link);
  if (onImage) btn('🖼 插图', '在光标处插入图片', onImage);
  btn('清除格式', '去掉选中文字的字体・字号・颜色・加粗等', commands.clear);
}

/**
 * 一键翻译之后：译文的标签序列和中文不一致＝模型改动了格式。返回不一致的语言列表，
 * 后台据此提示作者逐段检查（不悄悄发布格式丢了一半的译文）。
 */
export function formatMismatch(zhHtml, translated) {
  const want = tagSequence(zhHtml).join(',');
  return ['ja', 'en'].filter((l) => translated[l] && tagSequence(translated[l]).join(',') !== want);
}
