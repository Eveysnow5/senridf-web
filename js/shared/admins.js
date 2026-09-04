// 唯一一份管理员名单。加减管理员只改这里。
// ⚠️ 这里放的是**登录账号的邮箱**，不是对外联系方式。
// minami 用的是个人 Gmail 登录，不是 @senridf.com 那个 —— 后者仍然是公司
// 对外的联系邮箱，写在 js/main.js 的 footer 里，两者不要互相替换。
export const ADMINS = ['sherlockafa@gmail.com', 'yukikokoko555@gmail.com'];

export function isAdmin(user) {
  return !!user && ADMINS.includes(user.email);
}
