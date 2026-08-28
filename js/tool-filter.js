/* 工具目录的功能标签筛选（/solutions/demo）。
 *
 * 设计取舍（2026-08-27）：
 * - 分类不按 toB/toC，按**功能标签**（语音识别 / 文档解析 / 自动采集…）。
 *   一个工具可以同时属于多个标签——「中日翻译·语音口译」既是语音识别也是翻译，
 *   硬塞进单一分区只会丢信息。
 * - 默认全部显示。筛选是**减法**，不是进入页面的前置步骤：作者的要求是
 *   「尽量把六个工具放在一个页面上」，所以第一眼必须看得见全部。
 * - 没有匹配结果时给出提示并保留「全部」的退路，不留空白页。
 * - 筛选状态写进 URL（`?tag=speech`），这样「你看下语音相关的工具」能直接发链接。
 *   用 replaceState 不用 pushState：筛选不该往浏览历史里塞一堆条目。
 *
 * 标签文案走 data-i18n / window.sdfSetText，由 main.js 的 T 翻译；
 * 本文件不硬编码任何面向用户的文案（切语言时状态行也要跟着变）。
 */
(function () {
  'use strict';

  const root = document.querySelector('[data-tool-filter]');
  const grid = document.querySelector('[data-tool-grid]');
  if (!root || !grid) return; // 别的页面引到了也不出错

  const chips = Array.from(root.querySelectorAll('[data-tag]'));
  const cards = Array.from(grid.querySelectorAll('[data-tags]'));
  const empty = document.querySelector('[data-tool-empty]');
  const status = document.querySelector('[data-tool-status]');
  const KNOWN = new Set(chips.map((c) => c.dataset.tag || '').filter(Boolean));

  /** 卡片的标签集合。data-tags 是空格分隔。 */
  function tagsOf(card) {
    return (card.dataset.tags || '').split(/\s+/).filter(Boolean);
  }

  /** 只把 tag 这一个参数写进（或抹掉）URL，其余参数原样保留（?lang= 要活着）。 */
  function syncUrl(tag) {
    if (!window.history || !window.history.replaceState) return;
    const url = new URL(window.location.href);
    if (tag) url.searchParams.set('tag', tag);
    else url.searchParams.delete('tag');
    window.history.replaceState(null, '', url.toString());
  }

  function apply(tag, opts) {
    let shown = 0;
    for (const card of cards) {
      const hit = !tag || tagsOf(card).includes(tag);
      // ⚠️ 靠 hidden 属性隐藏，前提是 CSS 里有 .tool-card[hidden]{display:none}。
      //    浏览器内置的 [hidden] 是标签选择器，会输给 .tool-card{display:flex}。
      //    2026-08-27 线上就是这么坏的：属性设上了，卡片一张没少。
      card.hidden = !hit;
      if (hit) shown++;
    }
    for (const chip of chips) {
      const on = (chip.dataset.tag || '') === tag;
      chip.classList.toggle('is-on', on);
      chip.setAttribute('aria-pressed', String(on));
    }
    if (empty) empty.hidden = shown > 0;

    // 筛选是纯视觉变化，读屏软件不会自己播报。没有这一行，用它的人点完
    // 标签得不到任何反馈——按钮"按下去了"，然后什么也没发生。
    if (status && window.sdfSetText) {
      window.sdfSetText(status, 'tag_status', { n: shown, total: cards.length });
    }

    if (!opts || opts.url !== false) syncUrl(tag);
  }

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      // 再点一次已选中的标签＝取消筛选，回到全部
      const next = chip.classList.contains('is-on') ? '' : chip.dataset.tag || '';
      apply(next);
    });
  }

  // 初始状态来自 URL。认不出的 tag 一律当「全部」——别人手改链接不该看到空白页。
  const wanted = new URLSearchParams(window.location.search).get('tag') || '';
  apply(KNOWN.has(wanted) ? wanted : '', { url: false });

  // 就绪标记：给渲染验证用。DOM 解析完 ≠ 脚本跑完，探针必须等这个而不是等元素出现
  // （第一版探针就是等错了信号，量到了 CSS 还没应用的中间态）。
  root.setAttribute('data-filter-ready', '');
})();
