import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── 为什么有这条 ────────────────────────────────────────────────────────────
// 2026-09-04 把 minami 的管理员邮箱换成她实际登录用的 Gmail，**只改了
// js/shared/admins.js**。Firestore 规则里的同一份名单没跟着改——后端 _middleware
// 的准入按邮箱认管理员，两处不一致就会「前端放行、后端拒绝」（她能进界面，
// 但每次 Firestore 读写被规则拒，含「通过新会员审核」）。
//
// 2026-09-11 起规则进了仓库（firestore.rules，唯一真源，由 deploy workflow 上线），
// 所以这条测试现在比的是**代码 vs 真正会部署的规则文件**——不再是一份会漂移的副本。
// 链条：code == firestore.rules（本测试保证）→ firestore.rules == 控制台（部署保证）。
// 两段都有机制，漂移根治。

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const RULES_FILE = path.join(ROOT, 'firestore.rules'); // 真源，主仓库、CI 里都有
const ARCH_DOC = path.join(ROOT, 'docs', 'tools', '00-architecture.md'); // docs 是另一个私有仓库，CI 上没有

function adminsFrom(src, whatFailed) {
  const m = /request\.auth\.token\.email in \[([^\]]*)\]/.exec(src);
  assert.ok(m, whatFailed);
  return new Set([...m[1].matchAll(/['"]([^'"]+@[^'"]+)['"]/g)].map((x) => x[1]));
}

function codeAdmins() {
  const src = readFileSync(path.join(ROOT, 'js', 'shared', 'admins.js'), 'utf8');
  const m = /export const ADMINS\s*=\s*\[([^\]]*)\]/.exec(src);
  assert.ok(m, 'admins.js 里找不到 ADMINS —— 这个测试已经失去了对象');
  return new Set([...m[1].matchAll(/['"]([^'"]+@[^'"]+)['"]/g)].map((x) => x[1]));
}

function rulesAdmins() {
  const src = readFileSync(RULES_FILE, 'utf8');
  return adminsFrom(src, 'firestore.rules 里找不到 isAdmin 的邮箱名单 —— 格式变了，这条要跟着改');
}

test('护栏自身有效：代码和规则文件都解析出非空名单', () => {
  // 退化输入检查：任一边解析成空集合，下面的"一致"会自动成立而什么都没测到。
  assert.ok(codeAdmins().size > 0, 'ADMINS 解析出来是空的');
  assert.ok(rulesAdmins().size > 0, 'firestore.rules 的名单解析出来是空的');
});

test('★ 管理员名单：js/shared/admins.js 与 firestore.rules 必须一致', () => {
  const code = codeAdmins();
  const rules = rulesAdmins();
  const onlyCode = [...code].filter((e) => !rules.has(e));
  const onlyRules = [...rules].filter((e) => !code.has(e));

  assert.deepEqual(
    { onlyCode, onlyRules },
    { onlyCode: [], onlyRules: [] },
    [
      '管理员名单在两处不一致：',
      `  只在 js/shared/admins.js：${onlyCode.join(', ') || '（无）'}`,
      `  只在 firestore.rules：${onlyRules.join(', ') || '（无）'}`,
      '',
      '不一致的后果：某管理员前端能进、后端每次 Firestore 读写被规则拒（含通过审核）。',
      '两处改一处就会这样——改一处务必改另一处。',
    ].join('\n'),
  );
});

// docs/ 是另一个私有仓库，CI 上没有——有才查，且跳过要说出来。
const haveArchDoc = existsSync(ARCH_DOC);

test('★ 架构文档里的管理员名单也要跟着改', { skip: !haveArchDoc }, () => {
  const doc = readFileSync(ARCH_DOC, 'utf8');
  const line = doc.split('\n').find((l) => l.includes('管理员（硬编码）'));
  assert.ok(line, '00-architecture.md 里找不到「管理员（硬编码）」那一行');
  for (const email of codeAdmins()) {
    assert.ok(
      line.includes(email),
      `架构文档那一行没有 ${email}：\n  ${line.trim()}\n（同一份名单散在多处，改一处不够）`,
    );
  }
});

if (!haveArchDoc) {
  console.log(
    '[admins-consistency] docs/ 不存在（CI：docs 是另一个私有仓库），' +
      '架构文档那条只在本地 npm run check 时生效；代码 vs firestore.rules 那条始终生效。',
  );
}
