// 唯一一份管理员名单。加减管理员只改这里。
// ⚠️ 这里放的是**登录账号的邮箱**——必须和 Firebase Console → Authentication
// 用户列表里那一行实际存在的邮箱一字不差。minami 后台登录用的就是
// yuki.minami@senridf.com（这个邮箱恰好也是 js/main.js footer 里的公司对外
// 联系方式，但此处认的是「登录账号」这层含义）。
// 教训（2026-09-11）：09-04 曾把她改成一个 Authentication 里根本不存在的
// yukikokoko555@gmail.com，凭记忆没核实，导致她后台 admin 坏了一周。
// admins-consistency 测试没抓到，因为它只比 admins.js↔firestore.rules 是否一致
// ——两处一起错也是「一致」。改名单前先去 Auth 列表看一眼真源。
export const ADMINS = ['sherlockafa@gmail.com', 'yuki.minami@senridf.com'];

export function isAdmin(user) {
  return !!user && ADMINS.includes(user.email);
}
