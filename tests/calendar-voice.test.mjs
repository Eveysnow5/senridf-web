import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_CALENDAR_AUDIO_BYTES,
  calendarAudioType,
  calendarVoiceLanguage,
} from '../functions/api/calendar/_voice.js';

test('Calendar 语音只允许三个界面语言', () => {
  assert.equal(calendarVoiceLanguage('zh-CN'), 'zh-CN');
  assert.equal(calendarVoiceLanguage('ja'), 'ja');
  assert.equal(calendarVoiceLanguage('en-US'), 'en-US');
  assert.equal(calendarVoiceLanguage('other'), 'zh-CN');
});

test('Calendar 语音接受浏览器常见录音格式', () => {
  assert.equal(calendarAudioType('audio/webm; codecs=opus'), 'audio/webm;codecs=opus');
  assert.equal(calendarAudioType('audio/ogg'), 'audio/ogg');
  assert.equal(calendarAudioType('text/plain'), null);
});

test('Calendar 单次录音限制为 10MB', () => {
  assert.equal(MAX_CALENDAR_AUDIO_BYTES, 10 * 1024 * 1024);
});
