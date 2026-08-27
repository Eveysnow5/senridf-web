/* 工具目录的功能标签筛选（/solutions/demo）。
 *
 * 设计取舍（2026-08-27）：
 * - 分类不按 toB/toC，按**功能标签**（语音识别 / 文档解析 / 自动采集…）。
 *   一个工具可以同时属于多个标签——「中日翻译·语音口译」既是语音识别也是翻译，
 *   硬塞进单一分区只会丢信息。
 * - 默认全部显示。筛选是**减法**，不是进入页面的前置步骤：作者的要求是
 *   「尽量把六个工具放在一个页面上」，所以第一眼必须看得见全部。
 * - 没有匹配结果时给出提示并保留「全部」的退路，不留空白页。
 *
 * 标签文案走 data-i18n，由 main.js 的 T 翻译；本文件只管显示/隐藏，不碰文案。
 */
(function () {
  'use strict';

  const root = document.querySelector('[data-tool-filter]');
  const grid = document.querySelector('[data-tool-grid]');
  if (!root || !grid) return; // 别的页面引到了也不出错

  const chips = Array.from(root.querySelectorAll('[data-tag]'));
  const cards = Array.from(grid.querySelectorAll('[data-tags]'));
  const empty = document.querySelector('[data-tool-empty]');

  /** 卡片的标签集合。data-tags 是空格分隔。 */
  function tagsOf(card) {
    return (card.dataset.tags || '').split(/\s+/).filter(Boolean);
  }

  function apply(tag) {
    let shown = 0;
    for (const card of cards) {
      const hit = !tag || tagsOf(card).includes(tag);
      card.hidden = !hit;
      if (hit) shown++;
    }
    for (const chip of chips) {
      const on = (chip.dataset.tag || '') === tag;
      chip.classList.toggle('is-on', on);
      chip.setAttribute('aria-pressed', String(on));
    }
    if (empty) empty.hidden = shown > 0;
  }

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      // 再点一次已选中的标签＝取消筛选，回到全部
      const next = chip.classList.contains('is-on') ? '' : chip.dataset.tag || '';
      apply(next);
    });
  }

  apply(''); // 初始：全部显示

  // 就绪标记：给渲染验证用。DOM 解析完 ≠ 脚本跑完，探针必须等这个而不是等元素出现
  // （第一版探针就是等错了信号，量到了 CSS 还没应用的中间态）。
  root.setAttribute('data-filter-ready', '');
})();
