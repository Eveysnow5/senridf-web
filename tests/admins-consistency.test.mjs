import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── 为什么有这条 ────────────────────────────────────────────────────────────
// 2026-09-04 把 minami 的管理员邮箱换成她实际登录用的 Gmail，**只改了
// js/shared/admins.js**。Firestore 规则里的同一份名单没动，而
// docs/FIRESTORE-RULES.md 自己写着「名单与 js/shared/admins.js 保持一致，
// 加管理员两处都要改」——**那句话没有任何强制力，三周内就被违反了。**
//
// 后果不是报错，是**前端放行、后端拒绝**：她能看见后台界面（客户端
// ADMINS.includes 通过），但面板上每一次 Firestore 读写都被规则拒掉，
// 其中包括「通过新会员审核」。
//
// ⚠️ **这条断言只能定罪，不能免罪。**
// 它比的是「代码」和「规则副本」。副本不是生效来源，**控制台才是**。
// 两边一致**不代表**控制台也一致；两边不一致则一定有问题。
// 想真正确认，只能人去 Firebase 控制台看，见 FIRESTORE-RULES.md 的核对流程。

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** docs/ 是另一个私有仓库（主仓库 .gitignore 里排除），CI 上不存在。 */
const RULES_COPY = path.join(ROOT, 'docs', 'FIRESTORE-RULES.md');
const ARCH_DOC = path.join(ROOT, 'docs', 'tools', '00-architecture.md');

function codeAdmins() {
  const src = readFileSync(path.join(ROOT, 'js', 'shared', 'admins.js'), 'utf8');
  const m = /export const ADMINS\s*=\s*\[([^\]]*)\]/.exec(src);
  assert.ok(m, 'admins.js 里找不到 ADMINS —— 这个测试已经失去了对象');
  return new Set([...m[1].matchAll(/['"]([^'"]+@[^'"]+)['"]/g)].map((x) => x[1]));
}

/** 从规则副本的 isAdmin() 里取邮箱名单。 */
function rulesAdmins() {
  const src = readFileSync(RULES_COPY, 'utf8');
  const m = /request\.auth\.token\.email in \[([^\]]*)\]/.exec(src);
  assert.ok(m, '规则副本里找不到 isAdmin 的邮箱名单 —— 副本格式变了，这条要跟着改');
  return new Set([...m[1].matchAll(/['"]([^'"]+@[^'"]+)['"]/g)].map((x) => x[1]));
}

const haveDocs = existsSync(RULES_COPY);

// ── 已登记的漂移（2026-09-10）────────────────────────────────────────────────
// 现状：代码是 yukikokoko555@gmail.com（09-04 改的，正确），
//       规则副本是 yuki.minami@senridf.com（08-19 同步，之后没动过）。
//
// **不把副本直接改成和代码一致来"修绿"**：那等于断言控制台里是新邮箱，
// 而这一点在本机无法验证（没有 firebase CLI / gcloud 登录态）。
// 把看得见的漂移改成假绿灯，比红着更坏。
//
// 只有作者能去 Firebase 控制台确认并修，所以先登记、不阻塞推送。
// ⚠️ **带到期日**：过期之后这条会自己红起来。
//    无限期的豁免就是绿灯，[[corpus MANIFEST 的 waived]] 也该照这个改。
const WAIVER = {
  until: '2026-09-24',
  why: '控制台真实名单未知，只有作者能看；见 docs/FIRESTORE-RULES.md 的核对流程',
};
const waived = new Date() < new Date(WAIVER.until + 'T23:59:59Z');

test('豁免必须有到期日，且不能已经过期还挂着', () => {
  assert.match(WAIVER.until, /^\d{4}-\d{2}-\d{2}$/, '豁免没写到期日');
  assert.ok(
    waived,
    `管理员名单的漂移豁免已于 ${WAIVER.until} 到期，而问题还没解决。\n` +
      '要么去 Firebase 控制台把名单对齐并同步副本，要么明确延期（改 WAIVER.until 并写明理由）。',
  );
});

test('护栏自身有效：能从代码里解析出非空的管理员名单', () => {
  const a = codeAdmins();
  // ⚠️ 退化输入检查：两边都解析成空集合的话，下面的"一致"会自动成立而什么都没测到。
  assert.ok(a.size > 0, 'ADMINS 解析出来是空的 —— 一致性判据会被空集架空');
});

test('★ 管理员名单：代码与 Firestore 规则副本必须一致', { skip: !haveDocs || waived }, () => {
  const code = codeAdmins();
  const rules = rulesAdmins();
  assert.ok(rules.size > 0, '规则副本里的名单解析出来是空的');

  const onlyCode = [...code].filter((e) => !rules.has(e));
  const onlyRules = [...rules].filter((e) => !code.has(e));

  assert.deepEqual(
    { onlyCode, onlyRules },
    { onlyCode: [], onlyRules: [] },
    [
      '管理员名单在两处不一致：',
      `  只在 js/shared/admins.js：${onlyCode.join(', ') || '（无）'}`,
      `  只在 docs/FIRESTORE-RULES.md：${onlyRules.join(', ') || '（无）'}`,
      '',
      '症状是**前端放行、后端拒绝**：本人能看见后台界面，但每一次 Firestore',
      '读写都被规则拒掉（含「通过新会员审核」）。',
      '',
      '⚠️ 改规则只能在 Firebase 控制台改，改完回来同步副本并更新同步日期。',
      '   本条断言比的是副本，副本不是生效来源。',
    ].join('\n'),
  );
});

test('★ 架构文档里的管理员名单也要跟着改', { skip: !haveDocs || waived }, () => {
  const doc = readFileSync(ARCH_DOC, 'utf8');
  const line = doc.split('\n').find((l) => l.includes('管理员（硬编码）'));
  assert.ok(line, '00-architecture.md 里找不到「管理员（硬编码）」那一行');
  for (const email of codeAdmins()) {
    assert.ok(
      line.includes(email),
      `架构文档那一行没有 ${email}：\n  ${line.trim()}\n（同一份名单散在三处，改一处不够）`,
    );
  }
});

if (!haveDocs) {
  // 跳过要**说出来**。静默跳过的护栏和不存在的护栏是一回事。
  console.log(
    '[admins-consistency] docs/ 不存在（CI 环境：docs 是另一个私有仓库），' +
      '名单一致性只在本地 npm run check 时生效。',
  );
}
