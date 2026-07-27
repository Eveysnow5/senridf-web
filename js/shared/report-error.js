// 统一前端错误上报：监听 JS 报错 / 未处理 promise / CSP 违规，去重后写 Firestore errors 集合。
// 判定逻辑在 error-report-id.js（纯函数、有单测）；这里是接 Firebase 的装配层。
// 沿用 track-visit.js 的模式（确定性ID + setDoc merge + expireAt TTL）。
//
// 用法（在已登录页面脚本开头尽早调用一次）：
//   import { db } from '/js/shared/firebase-init.js';
//   import { initErrorReporting } from '/js/shared/report-error.js';
//   initErrorReporting({ db });
//
// 原则：上报绝不抛错、绝不阻断页面——全程 try/catch + .catch() 静默。
import {
  doc,
  setDoc,
  serverTimestamp,
  increment,
  Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { errorFingerprint, errorDocId, normalizeError } from './error-report-id.js';

// 6个月，配合 Firestore TTL 策略（expireAt 字段）自动清理。沿用 visits 的口径。
const RETENTION_MS = 6 * 30 * 24 * 60 * 60 * 1000;

export function initErrorReporting({ db }) {
  const write = (kind, ev) => {
    try {
      const r = normalizeError(kind, ev);
      const id = errorDocId(errorFingerprint(r));
      setDoc(
        doc(db, 'errors', id),
        {
          type: r.type,
          message: r.message,
          source: r.source,
          line: r.line,
          col: r.col,
          ...r.extra,
          count: increment(1),
          lastSeen: serverTimestamp(),
          lastPage: location.pathname,
          lastEmail: localStorage.getItem('sdf_user_email') || '',
          lastUserAgent: navigator.userAgent,
          expireAt: Timestamp.fromMillis(Date.now() + RETENTION_MS),
        },
        { merge: true },
      ).catch(() => {});
    } catch {
      /* 上报本身绝不抛错 */
    }
  };
  window.addEventListener('error', (e) => write('js', e), true);
  window.addEventListener('unhandledrejection', (e) => write('promise', e));
  document.addEventListener('securitypolicyviolation', (e) => write('csp', e));
}
