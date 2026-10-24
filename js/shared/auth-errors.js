// 登录失败的原因（2026-10-24）。
// 起因：Yuki 反馈「登录不进去」，而 8 个登录页对**任何**失败都显示「邮箱或密码错误」——
// 密码错、尝试太多被 Firebase 暂时锁住、账号被停用、网络/插件拦截，在界面上一模一样，
// 只能靠猜。现在按 Firebase 的错误码说出真实原因，没见过的码原样显示出来。
//
// 注意：Firebase 开着「邮箱枚举保护」，账号不存在和密码不对都是 auth/invalid-credential，分不开
// （这是安全设置，故意的）。

const KIND = {
  'auth/invalid-credential': 'wrong',
  'auth/wrong-password': 'wrong',
  'auth/user-not-found': 'wrong',
  'auth/invalid-email': 'bad_email',
  'auth/missing-password': 'no_password',
  'auth/too-many-requests': 'locked',
  'auth/user-disabled': 'disabled',
  'auth/network-request-failed': 'network',
};

/** 'wrong' | 'bad_email' | 'no_password' | 'locked' | 'disabled' | 'network' | 'other' */
export function loginErrorKind(err) {
  return KIND[err && err.code] || 'other';
}

// 后台各页（只有管理员看，中文）
const ZH = {
  wrong: '邮箱或密码不对。忘了密码：到网站「会员」页登录框点「忘记密码」重设。',
  bad_email: '邮箱格式不对。',
  no_password: '请输入密码。',
  locked:
    '尝试次数太多，Firebase 暂时锁住了这个账号。等 15 分钟左右再试；或到「会员」页点「忘记密码」重设，重设后可立即登录。',
  disabled: '这个账号在 Firebase 里被停用了，请管理员到 Firebase 控制台 → Authentication 里启用。',
  network:
    '连不上登录服务（网络不通，或浏览器插件/公司网络拦截了 Google 的登录地址）。换个网络或关掉拦截插件再试。',
};

/** 后台页用：返回给人看的中文原因；没见过的错误码原样带上，方便截图给我们查。 */
export function loginErrorText(err) {
  const kind = loginErrorKind(err);
  if (kind !== 'other') return ZH[kind];
  return `登录失败（${(err && (err.code || err.message)) || '原因未知'}）。请把这句截图发给管理员。`;
}
