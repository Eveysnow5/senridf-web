import { fetchWithTimeout } from './_lib/fetchWithTimeout.js';
import { recordUsage } from './_lib/usageRecorder.js';
import { buildProofreadPrompt } from './_lib/buildProofreadPrompt.js';
import { CHAT_ENDPOINT, modelFor } from './_lib/models.js';

const MAX_CHARS = 20000;

export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
    });
  }

  const text = (body.text || '').trim();
  if (!text) {
    return new Response(JSON.stringify({ error: '未提供文本' }), {
      status: 400,
    });
  }

  const truncated = text.length > MAX_CHARS;
  const input = truncated ? text.slice(0, MAX_CHARS) : text;

  const refRaw = typeof body.reference === 'string' ? body.reference.trim() : '';
  const refTruncated = refRaw.length > MAX_CHARS;
  const reference = refTruncated ? refRaw.slice(0, MAX_CHARS) : refRaw;

  try {
    const qwenRes = await fetchWithTimeout(CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.env.QWEN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelFor('proofread', context.env),
        messages: [{ role: 'user', content: buildProofreadPrompt(input, reference) }],
        max_tokens: 6000,
        // Qwen3 在 DashScope 上默认开启混合思考模式。开着的话模型会先生成一大段
        // 推理链，而**本端点只读 message.content，推理内容被直接丢弃**——
        // 等于花钱买了扔掉，还把响应拖慢好几倍。
        // 2026-08-25 实测：一次 max_tokens=100 的调用要 17.6 秒；校对（max_tokens 6000）
        // 因此超过 30 秒超时，被 Cloudflare 掐成 502。两个流式端点早就关了，
        // 这四个非流式的一直漏着——models.js 里"最便宜的止血"那条待办说的就是这个。
        enable_thinking: false,
      }),
    });

    if (!qwenRes.ok) {
      const err = await qwenRes.text();
      return new Response(JSON.stringify({ error: `AI 服务错误：${err}` }), {
        status: 502,
      });
    }

    const data = await qwenRes.json();
    recordUsage({
      task: 'proofread',
      usage: data.usage,
      idToken: context.data?.idToken,
      waitUntil: context.waitUntil?.bind(context),
    });

    const result = data.choices?.[0]?.message?.content?.trim() || '';

    return new Response(
      JSON.stringify({ result, truncated, ref_truncated: refTruncated, char_count: text.length }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg =
      err.name === 'AbortError' ? '请求超时，请稍后重试' : '校对服务暂时不可用，请稍后重试';
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
