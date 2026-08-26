// 登录门控的纯判定逻辑：不碰 DOM、不碰 Firebase，只根据已知信息决定当前应该
// 进入哪个状态。零依赖，可以被 node --test 直接测试。
// 实际接 Firebase 事件、操作 DOM 的装配层在同目录的 auth-gate.js。
export function resolveGateState({ user, isAdminUser, status }) {
  if (!user) return 'guest';
  // 匿名身份等同未登录。
  //
  // 2026-08-26 线上事故：japanese_learner 在**默认 app** 上做了匿名登录，而同源所有
  // 页面共用这个 app 的会话。于是别的工具页拿到的 user 是匿名对象 —— **truthy**，
  // 于是不跳登录页，直接去读 users/{uid}；那条规则要 isMember()，匿名被拒、抛错，
  // 页面渲染成"出错了"，而且**再也回不到登录页**（登出后就彻底进不来了）。
  //
  // 根因在调用方（不该污染默认 app 的会话），但这里也必须堵死：
  // "user 非空就等于真用户"是个太容易犯的假设，让它在判定层就不成立。
  if (user.isAnonymous) return 'guest';
  if (isAdminUser) return 'admin';
  if (status === 'approved') return 'approved';
  if (status === 'disabled') return 'disabled';
  return 'pending';
}
