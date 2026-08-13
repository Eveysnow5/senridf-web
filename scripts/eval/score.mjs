// 评估用例的打分逻辑。**纯函数**，因此可以进 `npm run check`。
//
// 为什么把"跑"和"判"分开：整条流水线（pdf.js 抽取、canvas 渲染、多轮循环）都在浏览器里，
// Node 复刻不了。硬要在 Node 里重实现一份，测的就不是生产路径了——这个项目已经在
// 「用非生产工具代替测量」上栽过两次（PIL 代替 canvas 差 2 倍；pdftotext 代替 pdf.js
// 差 15,000 字）。所以：**跑**是人在真工具里跑、把回答贴进文件；**判**是这里，确定性、
// 可单测、免费、能进闸门。
//
// 判据的设计原则：**宁可判"需要人看"，也不要猜。** 判错比没有基线更糟——一个会误报的
// 基线会让人开始忽略它，那时它就等于不存在。
import { BANNED_HEDGES } from '../../functions/api/_lib/buildAnalysisPrompt.js';
import { analyzeAnchors } from './anchor-check.mjs';

/** 多轮的输出里，最终回答和追查过程拼在一起，分隔标记由 analysis.html 写死。 */
const TRAIL_MARKER = '### 追跡プロセス';

/** 数字比较要先归一：模型可能写「24,851,813,515.25 元」或加空格。 */
function normalize(s) {
  return String(s || '').replace(/\s+/g, '');
}

/**
 * 拆出最终回答与追查过程。
 *
 * 为什么必须分开：追查过程是模型的**工作笔记**，里面出现"推测模式类似，需补充 p68"
 * 这种话是合理的中间状态；而最终结论里出现推测性措辞才是违规。混在一起判，会把
 * "过程中谨慎、结论里克制"这种**正确行为**判成失败。
 */
export function splitAnswer(raw) {
  const text = String(raw || '');
  const i = text.indexOf(TRAIL_MARKER);
  return i < 0 ? { answer: text, trail: '' } : { answer: text.slice(0, i), trail: text.slice(i) };
}

/**
 * 从回答里抽出所有引用的页码。
 * 匹配 `（文件1·p70 印刷70·合并利润表）` 这类，也容忍缺印刷页码的 `（文件1·p86）`。
 * @returns {{file:number, pdf:number, printed:number|null}[]}
 */
export function extractCitations(answer) {
  const out = [];
  const text = String(answer || '');
  for (const m of text.matchAll(
    /文件\s*(\d+)\s*[·・.]?\s*p\s*(\d+)(?:\s*[·・,，]?\s*印刷\s*(\d+))?/gi,
  )) {
    out.push({
      file: Number(m[1]),
      pdf: Number(m[2]),
      printed: m[3] === undefined ? null : Number(m[3]),
    });
  }
  return out;
}

/**
 * 给一条用例打分。
 * @param {object} c 用例（docs/eval/analysis-cases.json 里的一条）
 * @param {string} answer 在真工具里跑出来的回答原文
 * @returns {{id:string, verdict:'pass'|'fail'|'manual', checks:object[], needsHuman:boolean}}
 */
export function scoreCase(c, raw) {
  const { answer: text, trail } = splitAnswer(raw);
  const flat = normalize(text);
  const e = c.expect || {};
  const checks = [];

  for (const n of e.numbers || []) {
    checks.push({ name: `数字 ${n}`, ok: flat.includes(normalize(n)) });
  }

  for (const s of e.mustContain || []) {
    checks.push({ name: `含「${s}」`, ok: text.includes(s) });
  }

  // 违禁词表**从提示词取**（BANNED_HEDGES），用例里的只是额外补充。
  // 2026-08-13 基线首次实跑时发现：提示词禁 8 个词，用例只手抄了 6 个，漏掉的恰好是
  // 模型那次真正违反的那个（「通常包含」）。**手抄的清单必然漂移，且方向总是"基线比
  // 规则松"**——于是基线全绿而规则已经被违反。
  const banned = [...new Set([...BANNED_HEDGES, ...(e.mustNotContain || [])])];
  for (const s of banned) {
    checks.push({ name: `不含「${s}」`, ok: !text.includes(s) });
  }

  if (e.mustMentionEachFile) {
    // ⚠️ 按**文件编号**比对，不是文件名。工具在提示词里把文件编成「文件1…文件N」，
    // 模型引用时用的也是这个编号；2026-08-13 第一版按文件名主干比对，六条全判失败，
    // 而模型其实覆盖了几乎所有文件——**打分器自己犯了它要防的那个错**（把对的判成错的）。
    // 这条守的是"某份文件悄悄一点贡献都没有"：它没被引用过，就等于没被读过。
    (c.files || []).forEach((f, i) => {
      const stem = f
        .split('/')
        .pop()
        .replace(/\.[^.]+$/, '');
      checks.push({
        name: `覆盖 文件${i + 1}（${stem}）`,
        ok: new RegExp(`文件\\s*${i + 1}(?![0-9])`).test(text),
        kind: 'coverage',
      });
    });
  }

  // 引用页码：**单独看**。答对但引错页说明它是蒙的。
  if ((e.citedPages || []).length) {
    const got = extractCitations(text);
    for (const want of e.citedPages) {
      const hit = got.find((g) => g.file === want.file && g.pdf === want.pdf);
      checks.push({
        name: `引用 文件${want.file}·p${want.pdf}`,
        ok: Boolean(hit),
        kind: 'citation',
      });
      if (want.printed != null) {
        // 印刷页码给错了不会报错，只会让人核不到——所以单独一条
        checks.push({
          name: `印刷页码 ${want.printed}`,
          ok: Boolean(hit && hit.printed === want.printed),
          kind: 'citation',
          note: hit && hit.printed !== want.printed ? `实际给的是 ${hit.printed}` : undefined,
        });
      }
    }
  }

  // 回答为空 = 直接失败，别让它靠"没有违禁词"混过去
  if (!text.trim()) {
    checks.push({ name: '回答非空', ok: false });
  }

  // 追查过程里的推测性措辞**只报不判**：那是工作笔记，不是给用户的结论。
  // 但要显眼地报出来——过程里频繁出现推测，往往预示结论正在往没有依据的方向硬化。
  const trailHedges = trail ? BANNED_HEDGES.filter((w) => trail.includes(w)) : [];

  // 锚点覆盖率：判断句里有多少能指到出处。
  // ⚠️ **先当报告项，不当失败项。** 新指标刚上线时不知道正常值是多少，直接当闸门
  // 必然误伤——而误伤会让人不再看它，那时它等于不存在。基线（2026-08-13 三次实跑）
  // 是 0% / 0% / 17%，等积累够几轮再决定要不要设阈值。
  const anchors = analyzeAnchors(text);

  const needsHuman = Boolean(e.manualReview || e.mustSayNotFound);
  const autoFailed = checks.some((k) => !k.ok);

  return {
    id: c.id,
    checks,
    anchors,
    trailHedges,
    needsHuman,
    // 人工判的用例：自动检查仍然跑（违禁词之类照样有意义），但最终判定留给人。
    // 自动检查已经挂了的，直接 fail——那种情况不用人看也知道不对。
    verdict: autoFailed ? 'fail' : needsHuman ? 'manual' : 'pass',
  };
}

/** 汇总。manual 不计入通过率——把"没判"混进分数里，分数就没意义了。 */
export function summarize(results) {
  const pass = results.filter((r) => r.verdict === 'pass').length;
  const fail = results.filter((r) => r.verdict === 'fail').length;
  const manual = results.filter((r) => r.verdict === 'manual').length;
  const citationChecks = results.flatMap((r) => r.checks.filter((k) => k.kind === 'citation'));
  return {
    total: results.length,
    pass,
    fail,
    manual,
    autoRate: pass + fail > 0 ? pass / (pass + fail) : null,
    citationRate: citationChecks.length
      ? citationChecks.filter((k) => k.ok).length / citationChecks.length
      : null,
    trailHedgeCases: results.filter((r) => (r.trailHedges || []).length > 0).length,
    anchorRate: (() => {
      const j = results.reduce((n, r) => n + (r.anchors?.judgments || 0), 0);
      const a = results.reduce((n, r) => n + (r.anchors?.anchored || 0), 0);
      return j > 0 ? a / j : null;
    })(),
  };
}
