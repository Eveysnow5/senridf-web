// 人生故事访谈的输出语言约束。零依赖，可 node --test。
//
// 为什么不给每种语言各写一份完整提示词：三份提示词会各自演化，产出格式慢慢分叉，
// 而且**不报错**——招标回填那边已经吃过一次亏（见 scripts/bid-scraper/index.js 末尾）。
// 访谈规则（追问原则、事实铁律、禁用文学腔）只保留一份中文，语言只作为一条
// 输出约束追加在末尾。改访谈规则时不需要同步三处。

export const LANGS = ['zh', 'ja', 'en'];

/** 语言参数是从请求体来的，必须当作不可信输入：认不出就回落到 zh。 */
export function normalizeLang(x) {
  return LANGS.includes(x) ? x : 'zh';
}

const SPEC = {
  zh: {
    name: '简体中文',
    // 衔接语长度：三种语言的"一句话"字面长度差很远，不能共用一个数。
    bridgeLen: '20 到 35 个汉字',
    register: '第二人称「你」，平实口语，不奉承',
    storyLine: '用简体中文写作',
    chapterLen: '章节名不超过 6 个汉字',
  },
  ja: {
    name: '日本語',
    bridgeLen: '40〜60 文字',
    // 受访者常常是年长者，日语里对年长者用简体是失礼的——这条不是文体偏好，是必须。
    register:
      '聞き手としての丁寧語（ですます調）。相手は年配の方であることが多い。お世辞や大げさな共感は禁止',
    storyLine: '日本語で執筆する。本人の語りなので「ですます調」で統一する',
    chapterLen: '章タイトルは 8 文字以内',
  },
  en: {
    name: 'English',
    bridgeLen: '20 to 35 words',
    register: 'second person, plain spoken English, no flattery',
    storyLine: 'Write in English',
    chapterLen: 'chapter titles of at most 4 words',
  },
};

export function langSpec(lang) {
  return SPEC[normalizeLang(lang)];
}

/**
 * 追加在提示词末尾的语言指令。
 *
 * 「无论受访者用什么语言作答」这句是必需的：界面语言才是用户选的语言，
 * 受访者可能用另一种语言作答（日语界面下用中文讲述完全可能），
 * 产出仍应跟随界面语言，否则同一篇稿子里会中日混排。
 */
export function langDirective(lang) {
  const s = langSpec(lang);
  return (
    '\n\n【输出语言 — 最高优先级，覆盖以上所有措辞示例】\n' +
    `· 一律用${s.name}输出，无论受访者用什么语言作答。\n` +
    `· 语域：${s.register}\n`
  );
}
