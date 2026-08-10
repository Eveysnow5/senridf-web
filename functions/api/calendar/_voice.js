export const MAX_CALENDAR_AUDIO_BYTES = 10 * 1024 * 1024;

const LANGUAGES = new Set(['zh-CN', 'ja', 'en-US']);
const AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/mp4',
]);

export function calendarVoiceLanguage(value) {
  return LANGUAGES.has(value) ? value : 'zh-CN';
}

export function calendarAudioType(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .replaceAll(' ', '');
  return AUDIO_TYPES.has(normalized) ? normalized : null;
}
