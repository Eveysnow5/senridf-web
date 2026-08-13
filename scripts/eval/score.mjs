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

/** 数字比较要先归一：模型可能写「24,851,813,515.25 元」或加空格。 */
function normalize(s) {
  return String(s || '').replace(/\s+/g, '');
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
export function scoreCase(c, answer) {
  const text = String(answer || '');
  const flat = normalize(text);
  const e = c.expect || {};
  const checks = [];

  for (const n of e.numbers || []) {
    checks.push({ name: `数字 ${n}`, ok: flat.includes(normalize(n)) });
  }

  for (const s of e.mustContain || []) {
    checks.push({ name: `含「${s}」`, ok: text.includes(s) });
  }

  for (const s of e.mustNotContain || []) {
    checks.push({ name: `不含「${s}」`, ok: !text.includes(s) });
  }

  if (e.mustMentionEachFile) {
    for (const f of c.files || []) {
      // 用文件名主干比对：回答里通常写「北京地铁2024财年.pdf」或「北京地铁2024财年」
      const stem = f
        .split('/')
        .pop()
        .replace(/\.[^.]+$/, '');
      checks.push({ name: `提到 ${stem}`, ok: text.includes(stem) });
    }
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

  const needsHuman = Boolean(e.manualReview || e.mustSayNotFound);
  const autoFailed = checks.some((k) => !k.ok);

  return {
    id: c.id,
    checks,
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
  };
}
