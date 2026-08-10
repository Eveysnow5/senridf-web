import { fetchWithTimeout } from '../_lib/fetchWithTimeout.js';
import {
  buildCalendarParsePrompt,
  parseCalendarModelResponse,
  resolveCalendarExceptionRule,
} from './_parse.js';
import { listCalendarDocuments } from './_store.js';

const QWEN_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json(400, { error: '请求格式错误' });
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return json(400, { error: '请输入日程描述' });
  if (text.length > 1000) return json(400, { error: '日程描述过长，请缩短后重试' });

  const apiKey = context.env.QWEN_API_KEY;
  if (!apiKey) return json(500, { error: 'AI 服务尚未配置' });

  try {
    let knownRules = [];
    try {
      knownRules = await listCalendarDocuments({
        request: context.request,
        user: context.data.calendarUser,
        collection: 'calendarRules',
      });
    } catch (error) {
      // Parsing one-off or new recurring events remains available before the
      // Calendar Firestore collections are enabled. Existing-rule exceptions
      // will correctly require confirmation when no rule can be loaded.
      console.warn('[calendar parse rules]', error);
    }
    const upstream = await fetchWithTimeout(QWEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          { role: 'user', content: buildCalendarParsePrompt(text, undefined, knownRules) },
        ],
        max_tokens: 1200,
        temperature: 0.1,
      }),
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      return json(upstream.status, { error: data.error?.message || 'AI 服务暂时不可用' });
    }
    const raw = data.choices?.[0]?.message?.content;
    const event = resolveCalendarExceptionRule(parseCalendarModelResponse(raw), text, knownRules);
    return json(200, { event });
  } catch (error) {
    if (error.name === 'AbortError') return json(504, { error: 'AI 解析超时，请重试' });
    console.error('[calendar parse]', error);
    return json(502, { error: 'AI 没有返回可用的日程，请重新描述或重试' });
  }
}
