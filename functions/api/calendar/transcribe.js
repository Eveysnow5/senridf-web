import { fetchWithTimeout } from '../_lib/fetchWithTimeout.js';
import { MAX_CALENDAR_AUDIO_BYTES, calendarAudioType, calendarVoiceLanguage } from './_voice.js';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function onRequest(context) {
  if (context.request.method !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const apiKey = context.env.DEEPGRAM_API_KEY;
  if (!apiKey) return json(500, { error: '语音服务尚未配置' });

  const contentType = calendarAudioType(context.request.headers.get('Content-Type'));
  if (!contentType) return json(415, { error: '浏览器录音格式不受支持' });

  const declaredSize = Number(context.request.headers.get('Content-Length') || 0);
  if (declaredSize > MAX_CALENDAR_AUDIO_BYTES) return json(413, { error: '录音时间过长' });

  const audio = await context.request.arrayBuffer();
  if (!audio.byteLength) return json(400, { error: '没有收到录音内容' });
  if (audio.byteLength > MAX_CALENDAR_AUDIO_BYTES) return json(413, { error: '录音时间过长' });

  const language = calendarVoiceLanguage(new URL(context.request.url).searchParams.get('language'));
  const params = new URLSearchParams({
    model: 'nova-2',
    language,
    punctuate: 'true',
    smart_format: 'true',
  });

  try {
    const response = await fetchWithTimeout(`https://api.deepgram.com/v1/listen?${params}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        // Deepgram detects the Opus codec from the WebM container. Sending the
        // base media type is more broadly compatible than forwarding codec
        // parameters produced by individual browsers.
        'Content-Type': contentType.split(';')[0],
      },
      body: audio,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[calendar transcribe upstream]', response.status, data.err_code);
      return json(502, { error: '语音识别服务暂时不可用' });
    }
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
    if (!transcript) return json(422, { error: '没有识别到清晰的语音' });
    return json(200, { transcript });
  } catch (error) {
    if (error.name === 'AbortError') return json(504, { error: '语音识别超时，请重试' });
    console.error('[calendar transcribe]', error);
    return json(502, { error: '语音识别失败，请稍后重试' });
  }
}
