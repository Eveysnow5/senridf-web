const state = {
  cursor: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  pendingProposal: null,
  rules: [],
  exceptions: [],
};

let auth;
let voiceSocket;
let voiceRecorder;
let voiceStream;
let voiceStopping = false;
let voiceInterimText = '';
let voiceAudioBytes = 0;
let voiceTranscriptBefore = '';
let voiceFinishTimer;

function isLocalPreview() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

const monthFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'long',
});

function setGateState(kind, message) {
  const gate = document.getElementById('calendar-gate');
  gate.dataset.state = kind;
  document.getElementById('gate-message').textContent = message;
}

async function authenticatedApi(url, options = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('登录状态已失效');

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `请求失败（${response.status}）`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function calendarApi(path = '', options = {}) {
  return authenticatedApi(`/api/calendar${path}`, options);
}

function setAssistantStatus(message, error = false) {
  const status = document.getElementById('assistant-status');
  status.textContent = message;
  status.classList.toggle('is-error', error);
}

function setAssistantEnabled(enabled) {
  document.getElementById('event-input').disabled = !enabled;
  document.getElementById('voice-language').disabled = !enabled;
  document.getElementById('parse-button').disabled = !enabled;
  document.getElementById('voice-button').disabled =
    !enabled || !(navigator.mediaDevices && window.MediaRecorder && window.WebSocket);
  if (!enabled) document.getElementById('confirm-button').disabled = true;
}

function previewDate(iso) {
  return iso ? iso.slice(0, 10) : '待确认';
}

function previewTime(start, end) {
  if (!start) return '待确认';
  const startTime = start.slice(11, 16);
  const endTime = end ? end.slice(11, 16) : '结束时间待确认';
  return `${startTime}–${endTime}`;
}

function recurrenceDescription(recurrence) {
  const weekday = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return recurrence.weekdays.map((day) => weekday[day]).join('、');
}

function setPreviewRow(rowId, valueId, value) {
  const row = document.getElementById(rowId);
  row.hidden = !value;
  if (value) document.getElementById(valueId).textContent = value;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ruleOccursOn(rule, date) {
  if (!rule.active || !rule.recurrence) return false;
  const key = localDateKey(date);
  const weekday = date.getDay() || 7;
  if (rule.recurrence.startsOn && key < rule.recurrence.startsOn) return false;
  if (rule.recurrence.endsOn && key > rule.recurrence.endsOn) return false;
  if (!rule.recurrence.weekdays.includes(weekday)) return false;
  return !state.exceptions.some(
    (exception) =>
      exception.ruleId === rule.id && key >= exception.startDate && key <= exception.endDate,
  );
}

async function loadSavedSchedule() {
  const schedule = await calendarApi('/schedule');
  state.rules = schedule.rules;
  state.exceptions = schedule.exceptions;
}

function renderEventPreview(event) {
  const categoryLabels = {
    work: '工作',
    study: '学习',
    personal: '个人',
    health: '健康',
    social: '社交',
    travel: '出行',
    other: '其他',
  };
  document.getElementById('preview-title').textContent = event.title || '未识别日程';
  document.getElementById('preview-date').textContent = previewDate(event.start);
  document.getElementById('preview-time').textContent = previewTime(event.start, event.end);
  document.getElementById('preview-location').textContent = event.location || '未指定';
  document.getElementById('preview-category').textContent =
    categoryLabels[event.category] || event.category;
  document.getElementById('preview-subcategory').textContent = event.subcategory || '未指定';
  document.getElementById('preview-notes').textContent = event.notes || '无';
  document.getElementById('preview-confidence').textContent =
    `AI 置信度 ${Math.round(event.confidence * 100)}%`;

  const questions = document.getElementById('preview-questions');
  const list = document.getElementById('preview-question-list');
  list.replaceChildren();
  event.confirmationQuestions.forEach((question) => {
    const item = document.createElement('li');
    item.textContent = question;
    list.appendChild(item);
  });
  questions.hidden = !event.needsConfirmation;

  let type = '单次日程预览';
  let repeat = '';
  let range = '';
  if (event.intent === 'create_recurring_event' && event.recurrence) {
    type = '重复日程预览';
    repeat = `${recurrenceDescription(event.recurrence)} ${event.recurrence.startTime || '时间待确认'}–${event.recurrence.endTime || '时间待确认'}`;
    range = `${event.recurrence.startsOn || '开始日期待确认'}起${event.recurrence.endsOn ? `，至${event.recurrence.endsOn}` : ''}`;
  } else if (event.intent === 'add_exception' && event.exception) {
    type = '放假 / 停课预览';
    range = `${event.exception.startDate || '开始日期待确认'} 至 ${event.exception.endDate || '结束日期待确认'}${event.exception.resumeDate ? `，${event.exception.resumeDate}恢复` : ''}`;
  }
  document.getElementById('preview-type').textContent = type;
  setPreviewRow('preview-repeat-row', 'preview-repeat', repeat);
  setPreviewRow('preview-range-row', 'preview-range', range);

  const saveable =
    !event.needsConfirmation &&
    (event.intent === 'create_recurring_event' || event.intent === 'add_exception');
  state.pendingProposal = saveable ? event : null;
  const confirmButton = document.getElementById('confirm-button');
  confirmButton.hidden = !saveable;
  confirmButton.disabled = !saveable;
  document.getElementById('preview-notice').textContent = saveable
    ? '请检查上面的内容。点击确认后才会保存。'
    : event.needsConfirmation
      ? '请补充上面的问题，再让 AI 理解一次。'
      : '当前只保存重复日程和放假安排。';
  document.getElementById('event-preview').hidden = false;
}

async function savePendingProposal() {
  if (!state.pendingProposal) return;
  const button = document.getElementById('confirm-button');
  button.disabled = true;
  button.textContent = '正在保存…';
  setAssistantStatus('正在安全保存日程…');
  try {
    const data = await calendarApi('/schedule', {
      method: 'POST',
      body: JSON.stringify({ proposal: state.pendingProposal }),
    });
    state.pendingProposal = null;
    if (data.saved.type === 'exception') state.exceptions.push(data.saved.value);
    else state.rules.push(data.saved.value);
    renderMonth();
    button.hidden = true;
    document.getElementById('preview-notice').textContent =
      data.saved.type === 'exception'
        ? '放假安排已保存，原来的重复课程规则仍然保留。'
        : '重复日程已经保存。';
    setAssistantStatus('保存完成。你可以继续说下一条安排。');
  } catch (error) {
    setAssistantStatus(error.message || '保存失败，请稍后重试。', true);
    button.disabled = false;
  } finally {
    button.textContent = '确认并保存';
  }
}

async function parseEventInput() {
  const input = document.getElementById('event-input');
  const button = document.getElementById('parse-button');
  const text = input.value.trim();
  if (!text) {
    setAssistantStatus('请先输入或说出一条日程。', true);
    input.focus();
    return;
  }

  button.disabled = true;
  button.textContent = '解析中…';
  document.getElementById('event-preview').hidden = true;
  state.pendingProposal = null;
  setAssistantStatus('AI 正在整理日期、时间和地点…');
  try {
    const data = await calendarApi('/parse', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    renderEventPreview(data.event);
    setAssistantStatus(
      data.event.needsConfirmation ? '预览已生成，请确认不确定的信息。' : '预览已生成。',
    );
  } catch (error) {
    setAssistantStatus(error.message || '解析失败，请重试。', true);
  } finally {
    button.disabled = false;
    button.textContent = '让 AI 理解';
  }
}

function appendVoiceText(text) {
  const input = document.getElementById('event-input');
  const separator = input.value.trim() ? ' ' : '';
  input.value = `${input.value.trim()}${separator}${text.trim()}`;
}

function finishVoiceCapture() {
  clearTimeout(voiceFinishTimer);
  voiceFinishTimer = undefined;
  if (voiceInterimText) {
    appendVoiceText(voiceInterimText);
    voiceInterimText = '';
  }
  if (voiceRecorder && voiceRecorder.state !== 'inactive') voiceRecorder.stop();
  voiceRecorder = undefined;
  if (voiceSocket) {
    voiceSocket.onclose = null;
    voiceSocket.close();
    voiceSocket = undefined;
  }
  if (voiceStream) {
    voiceStream.getTracks().forEach((track) => track.stop());
    voiceStream = undefined;
  }
  voiceStopping = false;
  const button = document.getElementById('voice-button');
  button.classList.remove('is-recording');
  button.innerHTML = '<span aria-hidden="true">●</span> 按这里开始说话';
  const transcript = document.getElementById('event-input').value.trim();
  const recognized = transcript !== voiceTranscriptBefore;
  const message = recognized
    ? '语音已经转成文字，可以修改或让 AI 理解。'
    : voiceAudioBytes > 0
      ? '声音已经发送，但语音服务没有识别出文字。'
      : '麦克风没有录到声音，请检查权限。';
  setAssistantStatus(message, !recognized);
}

function closeVoiceSocketAfterAudio() {
  if (voiceSocket?.readyState !== WebSocket.OPEN) {
    finishVoiceCapture();
    return;
  }
  voiceSocket.send(JSON.stringify({ type: 'Finalize' }));
  voiceFinishTimer = setTimeout(finishVoiceCapture, 5000);
}

function stopVoiceCapture() {
  if (!voiceSocket || voiceStopping) return;
  voiceStopping = true;
  setAssistantStatus('正在整理语音文字…');
  if (voiceRecorder && voiceRecorder.state !== 'inactive') {
    voiceRecorder.addEventListener('stop', closeVoiceSocketAfterAudio, { once: true });
    voiceRecorder.stop();
  } else {
    closeVoiceSocketAfterAudio();
  }
}

async function startVoiceCapture() {
  const button = document.getElementById('voice-button');
  button.disabled = true;
  voiceInterimText = '';
  voiceAudioBytes = 0;
  voiceTranscriptBefore = document.getElementById('event-input').value.trim();
  setAssistantStatus('正在连接语音服务…');
  try {
    const [tokenData, stream] = await Promise.all([
      authenticatedApi('/api/deepgram-token'),
      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      }),
    ]);
    voiceStream = stream;
    const params = new URLSearchParams({
      model: 'nova-2',
      language: document.getElementById('voice-language').value,
      punctuate: 'true',
      smart_format: 'true',
      interim_results: 'true',
      endpointing: '600',
    });
    voiceSocket = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, [
      'bearer',
      tokenData.access_token,
    ]);
    voiceSocket.onopen = () => {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      voiceRecorder = new MediaRecorder(voiceStream, { mimeType });
      voiceRecorder.ondataavailable = (event) => {
        if (voiceSocket?.readyState === WebSocket.OPEN && event.data.size > 0) {
          voiceAudioBytes += event.data.size;
          voiceSocket.send(event.data);
        }
      };
      voiceRecorder.start(250);
      button.disabled = false;
      button.classList.add('is-recording');
      button.innerHTML = '<span aria-hidden="true">●</span> 停止录音';
      setAssistantStatus('正在听，请说出日程…');
    };
    voiceSocket.onmessage = (message) => {
      let data;
      try {
        data = JSON.parse(message.data);
      } catch {
        return;
      }
      if (data.type !== 'Results') return;
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      if (data.is_final && transcript) {
        appendVoiceText(transcript);
        voiceInterimText = '';
        setAssistantStatus('已识别语音，正在等待结束…');
      } else if (transcript) {
        voiceInterimText = transcript;
        setAssistantStatus(`正在听：${transcript}`);
      }
      if (voiceStopping && data.from_finalize) {
        if (voiceSocket?.readyState === WebSocket.OPEN) {
          voiceSocket.send(JSON.stringify({ type: 'CloseStream' }));
        }
        voiceFinishTimer = setTimeout(finishVoiceCapture, 200);
      }
    };
    voiceSocket.onerror = () => {
      setAssistantStatus('语音连接失败，请重试或直接打字。', true);
      finishVoiceCapture();
    };
    voiceSocket.onclose = () => {
      if (!voiceStopping) finishVoiceCapture();
    };
  } catch (error) {
    finishVoiceCapture();
    const message =
      error.name === 'NotAllowedError'
        ? '麦克风权限被拒绝，请在浏览器设置中允许。'
        : error.message || '语音服务暂时不可用。';
    setAssistantStatus(message, true);
  } finally {
    if (!voiceSocket) button.disabled = false;
  }
}

function bindAssistantControls() {
  document.getElementById('assistant-form').addEventListener('submit', (event) => {
    event.preventDefault();
    parseEventInput();
  });
  document.getElementById('voice-button').addEventListener('click', () => {
    if (voiceSocket) stopVoiceCapture();
    else startVoiceCapture();
  });
  document.getElementById('confirm-button').addEventListener('click', savePendingProposal);
}

function renderMonth() {
  const year = state.cursor.getFullYear();
  const month = state.cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPreviousMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const grid = document.getElementById('calendar-grid');

  document.getElementById('month-title').textContent = monthFormatter.format(state.cursor);
  grid.replaceChildren();

  for (let cell = 0; cell < 42; cell += 1) {
    const offset = cell - firstWeekday + 1;
    let day = offset;
    let relativeMonth = 0;
    if (offset < 1) {
      day = daysInPreviousMonth + offset;
      relativeMonth = -1;
    } else if (offset > daysInMonth) {
      day = offset - daysInMonth;
      relativeMonth = 1;
    }

    const date = new Date(year, month + relativeMonth, day);
    const cellEl = document.createElement('div');
    cellEl.className = 'calendar-cell';
    if (relativeMonth !== 0) cellEl.classList.add('is-outside');
    if (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    ) {
      cellEl.classList.add('is-today');
    }
    cellEl.setAttribute('role', 'gridcell');
    cellEl.setAttribute('aria-label', date.toLocaleDateString('ja-JP'));
    cellEl.innerHTML = `<span class="calendar-cell__day">${day}</span>`;
    if (relativeMonth === 0) {
      state.rules
        .filter((rule) => ruleOccursOn(rule, date))
        .forEach((rule) => {
          const event = document.createElement('div');
          event.className = 'calendar-cell__event';
          event.textContent = `${rule.recurrence.startTime} ${rule.title}`;
          event.title = `${rule.recurrence.startTime}–${rule.recurrence.endTime} ${rule.title}`;
          cellEl.appendChild(event);
        });
    }
    grid.appendChild(cellEl);
  }
}

function bindCalendarControls() {
  document.getElementById('previous-month').addEventListener('click', () => {
    state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() - 1, 1);
    renderMonth();
  });
  document.getElementById('next-month').addEventListener('click', () => {
    state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 1);
    renderMonth();
  });
  document.getElementById('today').addEventListener('click', () => {
    const now = new Date();
    state.cursor = new Date(now.getFullYear(), now.getMonth(), 1);
    renderMonth();
  });
}

function bindSessionControls(signOut) {
  document.getElementById('logout').addEventListener('click', async () => {
    await signOut(auth);
    window.location.replace('/account.html');
  });
}

async function unlockCalendar(user) {
  const session = await calendarApi();
  if (!session.accessGranted || session.user.uid !== user.uid) {
    throw new Error('Calendar entitlement response mismatch');
  }
  document.getElementById('calendar-account').textContent = session.user.email || session.user.uid;
  document.getElementById('calendar-gate').hidden = true;
  document.getElementById('calendar-app').hidden = false;
  document.getElementById('signed-in-email').textContent = user.email || user.uid;
  setAssistantEnabled(true);
  try {
    await loadSavedSchedule();
  } catch (error) {
    console.warn('[calendar schedule load]', error);
    setAssistantStatus('日程页面可用，但已保存的重复日程暂时无法读取。', true);
  }
  renderMonth();
}

async function initializeProductionSession() {
  const [firebase, authSdk] = await Promise.all([
    import('/js/shared/firebase-init.js'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
  ]);
  auth = firebase.auth;
  bindSessionControls(authSdk.signOut);

  authSdk.onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace('/account.html');
      return;
    }

    setGateState('checking', '正在验证日历访问权限…');
    try {
      await unlockCalendar(user);
    } catch (error) {
      if (error.status === 403) {
        setGateState('denied', '当前账号尚未启用 Calendar，或账号仍在审核中。');
        return;
      }
      console.error('[calendar]', error);
      setGateState('error', '权限验证失败，请刷新页面重试。');
    }
  });
}

bindCalendarControls();
bindAssistantControls();

if (isLocalPreview()) {
  // Static local servers cannot run Cloudflare Pages Functions. This branch only
  // reveals the empty UI shell on exact loopback hostnames; production always
  // continues through Firebase Auth and the server-side entitlement check below.
  document.getElementById('calendar-gate').hidden = true;
  document.getElementById('calendar-app').hidden = false;
  document.getElementById('signed-in-email').textContent = 'Local preview';
  document.getElementById('calendar-account').textContent = '静态界面预览（未连接用户数据）';
  const logoutButton = document.getElementById('logout');
  logoutButton.disabled = true;
  logoutButton.title = '本地预览不会操作 Firebase 登录状态';
  setAssistantEnabled(false);
  setAssistantStatus('本地模式只预览界面；登录线上环境后可使用 AI 和语音。');
  renderMonth();
} else {
  initializeProductionSession().catch((error) => {
    console.error('[calendar auth]', error);
    setGateState('error', '登录服务加载失败，请刷新页面重试。');
  });
}
