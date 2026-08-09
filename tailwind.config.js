/** @type {import('tailwindcss').Config} */
// 只扫描这 5 个用 Tailwind 的页面，生成它们实际用到的 class（含 JS 字符串里的、
// 方括号任意值的）。默认主题、无 safelist——safelist 全量生成会把 CLI 卡死。
module.exports = {
  content: [
    './bids/index.html',
    './solutions/demo/admin.html',
    './solutions/demo/ai-intel.html',
    './solutions/demo/japanese_learner.html',
    './solutions/demo/proofreader.html',
  ],
  theme: { extend: {} },
  plugins: [],
};
