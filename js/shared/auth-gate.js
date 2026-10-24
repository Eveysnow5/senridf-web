// 统一登录门控：监听登录态、判定状态、渲染遮罩提示、分发回调。
// 判定逻辑本身在 auth-gate-state.js（纯函数，有单测）；这里是操作 DOM 和 Firebase 的装配层。
//
// 用法：
//   import { auth, db } from '/js/shared/firebase-init.js';
//   import { mountAuthGate } from '/js/shared/auth-gate.js';
//   mountAuthGate({ auth, db, onApproved: (user) => {...}, onAdmin: (user) => {...} });
//
// 页面里需要一个 id="auth-gate" 的遮罩元素；通过后该元素会被移除。
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { ADMINS } from './admins.js?v=4e0c5c325f';
import { resolveGateState } from './auth-gate-state.js?v=0425a9b724';

// 页面语言：与 main.js / account.html 同一顺序（?lang= → localStorage → 日文）。
// 2026-10-19：原来跳登录页时不带语言、提示只有中文——带着 ?lang=en 的链接点进工具页，
// 没登录的新访客看到的是日文登录页；审核中的日英用户看到中文「审核中」。
function pageLang() {
  const p = new URLSearchParams(location.search).get('lang');
  if (['ja', 'zh', 'en'].includes(p)) return p;
  const s = localStorage.getItem('sdf_lang');
  return ['ja', 'zh', 'en'].includes(s) ? s : 'ja';
}

/** 登录页地址：把当前语言带过去（只在 URL 里显式指定了语言时才需要，localStorage 两边共用） */
function accountUrl() {
  const p = new URLSearchParams(location.search).get('lang');
  return ['ja', 'zh', 'en'].includes(p) ? `/account.html?lang=${p}` : '/account.html';
}

function renderMessage(gate, { icon, title, body }) {
  gate.innerHTML = `<div style="text-align:center;max-width:340px;padding:32px 24px;font-family:sans-serif"><div style="font-size:2.5rem;margin-bottom:16px">${icon}</div><h2 style="font-size:18px;font-weight:600;margin-bottom:12px;color:#1f2937">${title}</h2><p style="color:#6b7280;font-size:13px;line-height:1.8">${body}</p><a href="${accountUrl()}" style="display:inline-block;margin-top:20px;color:#9ca3af;font-size:12px;text-decoration:none">← ${BACK[pageLang()]}</a></div>`;
}

const BACK = { ja: '戻る', zh: '返回', en: 'Back' };
const MESSAGES = {
  ja: {
    pending: {
      icon: '⏳',
      title: '審査中',
      body: 'アカウントは審査中です。承認後にご利用いただけます。',
    },
    disabled: {
      icon: '🚫',
      title: 'アカウントは停止されています',
      body: 'このアカウントは停止されています。管理者にお問い合わせください。',
    },
    error: {
      icon: '⚠️',
      title: 'エラーが発生しました',
      body: 'ページの読み込み中に問題が発生しました。ページを再読み込みしてください。',
    },
  },
  zh: {
    pending: { icon: '⏳', title: '审核中', body: '账号正在审核中，审核通过后即可使用。' },
    disabled: { icon: '🚫', title: '账号已停用', body: '您的账号已被停用，请联系管理员。' },
    error: { icon: '⚠️', title: '出错了', body: '页面加载时出现问题，请刷新页面重试。' },
  },
  en: {
    pending: {
      icon: '⏳',
      title: 'Under review',
      body: 'Your account is being reviewed. You can use the tools once it is approved.',
    },
    disabled: {
      icon: '🚫',
      title: 'Account disabled',
      body: 'This account has been disabled. Please contact the administrator.',
    },
    error: {
      icon: '⚠️',
      title: 'Something went wrong',
      body: 'There was a problem loading the page. Please reload and try again.',
    },
  },
};
const msg = (state) => MESSAGES[pageLang()][state];

export function mountAuthGate({ auth, db, gateElId = 'auth-gate', onApproved, onAdmin }) {
  return onAuthStateChanged(auth, async (user) => {
    const gate = document.getElementById(gateElId);
    try {
      // 先判定，再决定要不要读 Firestore。
      //
      // 顺序很重要：原来是「user 非空 → 直接读 users/{uid}」，匿名身份也会走到那一步，
      // 而 users 的读规则要 isMember()，于是抛 PERMISSION_DENIED、渲染成"出错了"。
      // 见 auth-gate-state.js 里那段事故说明。
      if (resolveGateState({ user }) === 'guest') {
        // 匿名会话不该留着：留着的话下一个页面又会看到一个 truthy 的 user。
        localStorage.removeItem('sdf_user_email');
        window.location.replace(accountUrl());
        return;
      }
      localStorage.setItem('sdf_user_email', user.email);

      const isAdminUser = ADMINS.includes(user.email);
      let status;
      if (!isAdminUser) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        status = snap.data()?.status || 'pending';
      }

      const state = resolveGateState({ user, isAdminUser, status });

      if (state === 'admin') {
        gate?.remove();
        (onAdmin || onApproved)?.(user);
        return;
      }
      if (state === 'approved') {
        gate?.remove();
        onApproved?.(user);
        return;
      }
      if (gate) renderMessage(gate, msg(state));
    } catch (err) {
      console.error('[auth-gate]', err);
      if (gate) renderMessage(gate, msg('error'));
    }
  });
}
