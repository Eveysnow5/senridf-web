// Cloudflare Pages Function — streaming proxy for DashScope analysis
import { fetchWithTimeout } from './_lib/fetchWithTimeout.js';
import { CHAT_ENDPOINT, modelFor } from './_lib/models.js';
import { selectRelevantPassages } from './_lib/selectRelevantPassages.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200 });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = env.QWEN_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'QWEN_API_KEY not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { files, prompt } = body;
  if (!Array.isArray(files) || files.length === 0) {
    return new Response(JSON.stringify({ error: 'files array required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 每份文件送入的字数预算。此前是 CHAR_LIMIT=30000 且**从开头硬截**——用户上传
  // 187,405 字的年报、问"处置荣耀产生的利润对财报有多大影响"，答案在「合并财务
  // 报表附注」（文档后段）早被截掉，于是模型答"文件未披露"，而那句话是假的：
  // 不是没披露，是没送给它看。现在按提问筛选片段（_lib/selectRelevantPassages）。
  // 80K 字/份 ≈ 单次约 11 万 token ≈ 1.5 元；同一批文档追问时文档前缀命中隐式
  // 缓存（1.5 元/百万，输入原价的 1/8），追问约 0.4 元。
  const CHAR_BUDGET = 80000;
  const question = (prompt || '').trim();

  const picked = files.map((f) =>
    selectRelevantPassages(f.content || '', question, { budget: CHAR_BUDGET }),
  );

  const docContext = files
    .map((f, i) => {
      const pk = picked[i];
      const body = pk.text.trim() || '（内容为空，可能为扫描版 PDF，无法提取文字层）';
      const note =
        pk.mode === 'selected'
          ? `（本文件共 ${pk.totalChars} 字，以下为按本次提问筛选出的 ${pk.usedChars} 字相关片段）`
          : '';
      return `【文件${i + 1}：${f.name}】${note}\n${body}`;
    })
    .join('\n\n---\n\n');

  // 两态提示词。界面上写着「省略时 AI 自动综合分析」，本来就承诺了两种行为，而此前
  // 的提示词只实现综合报告那一种：五条硬性要求（必出概览表、必分析 MD&A、必列异同
  // 点、必出补充清单、必覆盖收入/利润/资产/现金流）写在 system 里，用户的问题只是
  // user message 里的一行——一行对抗五条强制，具体问题于是被降级成末尾的"特别说明"。
  const RULES_COMMON = `【核心规则 — 必须严格遵守，不得绕过】
1. 仅使用用户提供的文件内容中明确记载的数据。禁止用行业经验、外部公开数据、历史惯例、推算或任何估算填补空白。
2. 每引用一个具体数字，必须在其后用括号标注来源（文件名·章节），如"营收 1.2 亿元（文件1·合并利润表）"。
3. ⚠️ 送给你的内容可能是**按提问筛选出的片段**而非全文（文件标题后会注明字数）。因此必须区分两种情况，不得混为一谈：
   · "文件中明确披露为 X" —— 你确实看到了
   · "所提供的片段中未包含该信息，可能存在于未提供的章节" —— 你没看到
   **绝不要把"我没看到"写成"文件未披露"。** 这是本工具曾经犯过的错误。`;

  const systemPrompt = question
    ? `你是专业的财务分析师。用户有一个**具体问题**，你的任务是回答那个问题，不是产出通用年报综述。

${RULES_COMMON}

【本次任务形态 — 针对性回答】
- **开门见山直接回答问题。** 第一段就给结论，不要先铺垫公司概况、不要先列指标总表。
- 只呈现支撑该结论所必需的数据与推理。与问题无关的板块、区域、战略分析**一律不要写**，即使文件里有。
- **不要**输出【关键指标概览】总表、不要逐项分析 MD&A、不要罗列"财务异同点总结"——除非这些正是问题本身所问。
- 结论不确定时说清不确定的来源（数据缺失／口径差异／需要未提供的章节），并只列出**为回答这个问题**还缺哪些资料；不要列与问题无关的补充清单。
- 若确实找不到回答所需的关键数据，直接说明缺什么、通常在年报哪个章节能找到，而不是用其它数据凑一篇长文。
- 篇幅服从问题：一个具体问题能用三段说清就写三段。**不追求大而全。**`
    : `你是专业的财务分析师，擅长解读财务报告、MD&A 及多份财务文件的交叉对比。

${RULES_COMMON}

【本次任务形态 — 综合分析（用户未指定问题）】
- 开头先输出一张【关键指标概览】Markdown 表格：多份文件时列为各文件/主体、行为关键指标（营业收入、净利润、毛利率、同比增长率、总资产、经营现金流等，按实际披露选取），缺披露的填"⚠️未披露"；单份文件时用两列（指标 | 数值）。表格之后再展开文字分析。
- 重点关注：财务数据（收入、利润、资产、现金流）、经营指标、关键比率。
- 分析 MD&A 中的管理层洞察、经营策略与风险因素。
- 明确指出各对象的财务异同点：营收规模、盈利能力、增长率、关键指标对比。
- 结尾输出【需要补充的信息清单】，列出影响分析质量的缺失数据项。`;

  // ⚠️ 顺序有讲究，不要"为了突出问题"把它挪到开头：隐式缓存按请求前缀匹配，文档
  // 在前 → 同一批文档换问题时前缀不变、命中缓存，追问成本从 1.5 元降到 0.4 元。
  // 而模型对结尾内容的注意力本来就高，问题放最后不吃亏，用分隔和措辞强调即可。
  const userMessage = question
    ? `以下是供你参考的财务文件内容：\n\n${docContext}\n\n${'='.repeat(40)}\n\n【本次必须回答的问题】\n${question}\n\n上面的文件内容仅是参考资料。请直接回答这个问题，不要写成通用分析报告。`
    : `以下是需要分析的财务文件内容（包含财务报表和MD&A）：\n\n${docContext}\n\n---\n\n分析要求：请对以上财务报告进行深度对比分析，重点关注财务指标、增长趋势、盈利能力和管理层对经营的分析。`;

  try {
    const upstream = await fetchWithTimeout(CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelFor('analyze', env),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 6000,
        temperature: 0.2,
        stream: true,
        // Same reason as translate-stream: Qwen3 models default to hybrid
        // thinking on DashScope and stream the reasoning as
        // `delta.reasoning_content` first. The client only renders
        // `delta.content` (analysis.html), so the report appears to hang and
        // then land all at once instead of streaming in — which defeats the
        // point of a streaming endpoint. Reasoning tokens also count against
        // the model's free quota while being discarded.
        enable_thinking: false,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: err.error?.message || 'Qwen API error' }), {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 注意：这层 try/catch 只覆盖"建立连接、拿到 headers"这个阶段——一旦下面这行
    // return 执行，函数调用栈就结束了，upstream.body 流式读取是之后由前端消费时才
    // 发生的，如果那时候 DashScope 中途断流，这层 catch 捕获不到。
    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    const msg =
      err.name === 'AbortError' ? '请求超时，请稍后重试' : '分析服务暂时不可用，请稍后重试';
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
