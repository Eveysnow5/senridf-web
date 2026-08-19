import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  signInAnonymously,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { trackVisit, updateVisitDuration } from '/js/shared/track-visit.js';
import { createVisitDuration } from '/js/shared/visit-duration.js';

const app = initializeApp(
  {
    apiKey: 'AIzaSyCjtAqIrGkiqDiETUqxcmkhyBVoa2IHQNM',
    authDomain: 'senridfauthentication.firebaseapp.com',
    projectId: 'senridfauthentication',
    storageBucket: 'senridfauthentication.firebasestorage.app',
    messagingSenderId: '86494932585',
    appId: '1:86494932585:web:185b8ed922cd491a63fcf8',
  },
  'tracking',
);

const auth = getAuth(app);
const db = getFirestore(app);

function getPageName() {
  const p = location.pathname;
  if (p.includes('japanese_learner')) return 'japanese_learner';
  if (p.includes('analysis')) return 'analysis';
  if (p.includes('lifestory')) return 'lifestory';
  if (p.includes('translation')) return 'translation';
  if (p.includes('/solutions/demo')) return 'demo-index';
  if (p.includes('/solutions')) return 'solutions';
  if (p.includes('/about')) return 'about';
  if (p.includes('/blog')) return 'blog';
  return 'home';
}

function getAnonId() {
  let id = localStorage.getItem('sdf_anon_id');
  if (!id) {
    id = 'anon_' + Math.random().toString(36).slice(2, 9);
    localStorage.setItem('sdf_anon_id', id);
  }
  return id;
}

const visitDuration = createVisitDuration();
let visitDocIdRef = null;

async function track() {
  try {
    await signInAnonymously(auth);
    const email = localStorage.getItem('sdf_user_email') || null;
    visitDocIdRef = trackVisit({
      db,
      email,
      anonId: getAnonId(),
      page: getPageName(),
      device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    });
  } catch (err) {
    // 不影响页面使用，但不能一声不吭：匿名登录或 visits 写入持续失败时，
    // 后台统计会静静归零——而"没人访问"和"统计坏了"在图表上长得一模一样。
    console.warn('访问统计未记录：', err);
  }
}

function finish() {
  if (!visitDocIdRef) return;
  const duration = visitDuration.hide();
  // null = 这一段没有新增秒数，跳过写入（hidden 与 pagehide 可能都触发）
  if (duration === null) return;
  updateVisitDuration({ db, docId: visitDocIdRef, duration });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') finish();
  else visitDuration.show();
});

// hidden 在部分浏览器的「直接关闭标签页」路径上不保证触发，补一个 pagehide。
// 两者都触发也没关系：hide() 没有新增秒数时返回 null，不会重复写。
window.addEventListener('pagehide', finish);

track();
