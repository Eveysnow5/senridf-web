// Cloudflare Pages Function — streaming proxy for DashScope analysis
import { fetchWithTimeout } from './_lib/fetchWithTimeout.js';
import { CHAT_ENDPOINT, modelFor } from './_lib/models.js';
import { selectRelevantPassages } from './_lib/selectRelevantPassages.js';
import { buildAnalysisSystemPrompt, buildAnalysisUserMessage } from './_lib/buildAnalysisPrompt.js';

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

  // 提示词构造抽到 _lib/buildAnalysisPrompt.js：它是纯函数、有单测钉住那几条
  // 硬规则（关键信息必须带来源、找不到就说找不到不许猜、禁用外部知识、区分
  // "文件没有"与"我没看到"）。这段提示词已改写三次，内联写在这里的话，下一次
  // 改动很容易把上一次加的规则悄悄删掉。
  const systemPrompt = buildAnalysisSystemPrompt(question);
  const userMessage = buildAnalysisUserMessage(docContext, question);

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
