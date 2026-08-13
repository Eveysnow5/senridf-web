// 锚点检查：找出"做了判断、却指不到出处"的句子。**纯函数**，进 `npm run check`。
//
// 为什么需要它：三次实跑证明 prompt 里的「禁止使用外部知识」拦不住——每跑换一个说法，
// 行为一次都没变（在会计实务中 → 在中国企业会计准则下 → 属于典型的政策性融资平台）。
// 措辞层面的规则永远列不全，而且列举本身在暗示"没列到的可以用"。
// 所以判据改成确定性的：**不管怎么措辞，做判断就必须能指到一个出处。**
//
// ⚠️ 设计原则：**宁可漏判，绝不误判。**
// 漏判只是少抓一个；误判会惩罚正确行为——"文件未提供附注，无法确认"这种带保留的句子
// 恰恰是我们想要的，判成违规就是在打击它。而且一个会误报的指标，人很快就不看了，
// 那时它等于不存在。所以下面的判断词表刻意保守，宁可召回低。

/** 句内锚点：`（文件2·p68 印刷68）` / `（文件2）` / `（准则库·企业会计准则第16号）` */
const ANCHOR_RE =
  /[（(]\s*(?:文件\s*\d+|准则库)[^）)]*[）)]|文件\s*\d+\s*[·・]\s*p\s*\d+|准则库\s*[·・]/;

/** 「来源：…」这类行，排版上归属**紧邻的上一句**（三次实跑里最常见的写法）。 */
const SOURCE_LINE_RE = /^\s*(?:来源|出处|依据|数据来源)\s*[:：]/;

/**
 * 做判断的标志词：因果、归类、程度、反事实。
 * 这张表**刻意保守**——每加一个词都要问"它会不会命中一句本来正确的话"。
 */
const JUDGMENT_MARKERS = [
  // 因果与推论
  '表明',
  '说明',
  '意味着',
  '因此',
  '由此',
  '可见',
  '导致',
  '使得',
  // 归类与断定（"这个数字是什么"——三次实跑违规的主要形态）
  '属于',
  '主要为',
  '主要核算',
  '主要由',
  '绝大部分',
  '实质上',
  '本质上',
  // 程度判断
  '依赖程度',
  '高度依赖',
  '完全依赖',
  '极度依赖',
  '生存级',
  '核心来源',
  '不具备',
  // 泛化（不针对具体措辞，只认"把个例说成通例"这个动作）
  '通常',
  '一般来说',
  '惯例',
  '常见模式',
  '典型的',
  // 概率化的猜测
  '极大概率',
  '大概率',
  // 反事实
  '若无',
  '若剔除',
  '若假设',
];

/**
 * 豁免词：这些是**缺失声明或保留**，不是判断。
 * 只要句子里有其中之一，就整句豁免——这是刻意的粗糙：宁可放过一个含判断的长句，
 * 也不要把一句"我查不到"判成违规。
 */
const ABSENCE_MARKERS = [
  '未披露',
  '未见',
  '未包含',
  '未列示',
  '未提供',
  '未显示',
  '未单列',
  '未找到',
  '无法确认',
  '无法计算',
  '无法判断',
  '无法读取',
  '不可见',
  '缺失',
  '需查看',
  '需补充',
  '需确认',
  '待确认',
  '需附注',
];

/** 中文切句。小数点不算句末——财报里到处是 24,851,813,515.25。 */
export function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[。！？；])|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 转折词。**有转折就不豁免**——转折后面那句才是真正的断言。
 *
 * 为什么需要这一条：v1 实跑里出现过
 * 「文件未提供附注，无法确认…，**但**基于科目性质，依赖程度极高的结论成立。」
 * 一句话里既有保留又有断言。只看缺失词就整句放过，等于让一个保留把后半句的
 * 无据判断**洗白**了。而反过来
 * 「文件未披露该数据，**因此**无法计算依赖程度。」
 * 是完全正确的行为，不能误伤——区别就在于有没有转折。
 */
const CONTRAST_MARKERS = ['但', '然而', '不过', '尽管如此', '话虽如此'];

/**
 * 不承载断言的行，整行豁免。两类都来自真实输出，不豁免就是纯误报：
 *   · 开场白：「…针对三家公司对政府补助的依赖程度分析如下：」——它在宣布要讲什么，
 *     不是在断言什么。
 *   · 表头：「公司 | 政府补助金额 | 净利润 | 依赖程度判断 | 依据来源」——列名而已。
 *     判据是"多个竖线分隔且整行没有数字"；数据行有数字，不会被误伤。
 */
function isNonAssertive(s) {
  if (/(?:如下|以下)\s*[:：。]?\s*$/.test(s)) return true;
  const cells = s.split('|').length - 1;
  // 表头 vs 数据行的判据是**有没有金额**，不是"有没有数字"——表头里会出现
  // 「2025财年」这样的年份。数据行必然带金额（253.03 亿元 / 16,067 百万港元 / 3.5%）。
  if (cells >= 3 && !/\d[\d,]*\.?\d*\s*(?:亿|万|百万|元|円|%)/.test(s)) return true;
  return false;
}

function isJudgment(sentence) {
  if (isNonAssertive(sentence)) return false;
  const hasAbsence = ABSENCE_MARKERS.some((w) => sentence.includes(w));
  const hasContrast = CONTRAST_MARKERS.some((w) => sentence.includes(w));
  if (hasAbsence && !hasContrast) return false;
  return JUDGMENT_MARKERS.some((w) => sentence.includes(w));
}

/**
 * @param {string} text 最终回答（不含追查过程）
 * @returns {{sentences:number, judgments:number, anchored:number,
 *            anchorRate:number|null, unanchored:string[]}}
 */
export function analyzeAnchors(text) {
  const sentences = splitSentences(text);

  // 先把「来源：…」行并进上一句：排版上它就是上一句的出处。
  // ⚠️ 只并给**紧邻**的上一句，不许往上蔓延——否则一行来源能把前面一整段都"洗白"。
  const units = [];
  for (const s of sentences) {
    if (SOURCE_LINE_RE.test(s) && units.length > 0) {
      units[units.length - 1] += ' ' + s;
    } else {
      units.push(s);
    }
  }

  const unanchored = [];
  let judgments = 0;
  let anchored = 0;
  for (const u of units) {
    if (!isJudgment(u)) continue;
    judgments++;
    if (ANCHOR_RE.test(u)) anchored++;
    else unanchored.push(u);
  }

  return {
    sentences: units.length,
    judgments,
    anchored,
    anchorRate: judgments > 0 ? anchored / judgments : null,
    unanchored,
  };
}
