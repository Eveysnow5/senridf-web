// 错误上报的纯判定逻辑：指纹（去重键）、文档ID、事件归一化。
// 零依赖，可 node --test 直接测；写 Firestore 的装配层在同目录 report-error.js。
// 参照 track-visit-id.js 的分层习惯（纯逻辑可测、IO/DOM 胶水不测）。

// 轻度归一化消息：把行内数字、URL query 换成占位符，避免同一错误因动态数字/参数被算成多条。
function normalizeMessage(msg) {
  return String(msg == null ? '' : msg)
    .replace(/\?[^\s]*/g, '') // 去掉 URL query
    .replace(/\d+/g, '#') // 数字归一
    .slice(0, 300)
    .trim();
}

// 简单稳定字符串 hash（base36）。只求同输入同输出，无需加密强度。
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// 指纹：同类型 + 同（归一化后）消息 + 同来源 + 同行号 → 同指纹。以类型前缀开头便于肉眼分辨。
export function errorFingerprint({ type, message, source, line }) {
  const key = [type, normalizeMessage(message), source || '', line == null ? '' : line].join('|');
  return `${type}-${hash(key)}`;
}

// 文档ID：指纹 + 当天日期，同一错误一天去重到一条。
export function errorDocId(fingerprint, now = new Date()) {
  return `${fingerprint}_${now.toISOString().slice(0, 10)}`;
}

// 把浏览器事件（或等价的普通对象）归一化成待写入的报告对象。
export function normalizeError(kind, ev) {
  if (kind === 'js') {
    // 资源加载失败：无 message、target 是元素（img/script/link 等）
    if (ev && !ev.message && ev.target && ev.target.tagName) {
      return {
        type: 'resource',
        message: `resource load failed: ${ev.target.tagName}`,
        source: ev.target.src || ev.target.href || '',
        line: null,
        col: null,
        extra: {},
      };
    }
    return {
      type: 'js',
      message: ev.message || 'Unknown error',
      source: ev.filename || '',
      line: ev.lineno == null ? null : ev.lineno,
      col: ev.colno == null ? null : ev.colno,
      extra: {},
    };
  }
  if (kind === 'promise') {
    const reason = ev.reason;
    const message = reason && reason.message ? reason.message : String(reason);
    return {
      type: 'promise',
      message: message || 'Unhandled rejection',
      source: '',
      line: null,
      col: null,
      extra: {},
    };
  }
  if (kind === 'csp') {
    return {
      type: 'csp',
      message: ev.violatedDirective || 'CSP violation',
      source: ev.sourceFile || '',
      line: ev.lineNumber == null ? null : ev.lineNumber,
      col: ev.columnNumber == null ? null : ev.columnNumber,
      extra: {
        violatedDirective: ev.violatedDirective || '',
        blockedURI: ev.blockedURI || '',
        disposition: ev.disposition || '',
      },
    };
  }
  return { type: 'unknown', message: 'unknown', source: '', line: null, col: null, extra: {} };
}
