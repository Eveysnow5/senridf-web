// 浏览器 TTS 朗读封装（speechSynthesis）。零成本、离线、纯客户端。
// 语音口译模式原本就有内联 TTS，这里抽成共享供文本模式复用、统一语言映射。
const LANG_TTS = { ja: 'ja-JP', zh: 'zh-CN', en: 'en-US' };

export function ttsSupported() {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

export function speak(text, lang) {
  if (!ttsSupported() || !text) return;
  window.speechSynthesis.cancel(); // 取消上一条，避免叠读
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = LANG_TTS[lang] || 'zh-CN';
  utt.rate = 0.95;
  window.speechSynthesis.speak(utt);
}
