import { test } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { pickUnnotified, buildIssue, ADMIN_URL } = require('../scripts/lead-notifier/index.js');

// 公開リポジトリに立てる issue なので、個人情報が漏れないことを最優先で固定する。
const LEAD = {
  id: 'x1',
  name: '見本 太郎',
  company: '株式会社サンプル商事',
  email: 'taro@example.co.jp',
  message: '注文書の転記を自動化したい',
  createdAt: new Date('2026-10-06T01:00:00Z'),
  notifiedAt: null,
};

test('issue に個人情報（氏名・会社・メール・相談内容）が一切入らない', () => {
  const { title, body } = buildIssue([LEAD], new Date('2026-10-06T02:00:00Z'));
  for (const pii of [LEAD.name, LEAD.company, LEAD.email, LEAD.message, 'taro', '@example']) {
    assert.ok(!title.includes(pii) && !body.includes(pii), `issue に個人情報が入っている: ${pii}`);
  }
});

test('issue は件数・作者への @mention・管理画面リンク・返信期限を含む', () => {
  const { title, body } = buildIssue(
    [LEAD, { ...LEAD, id: 'x2' }],
    new Date('2026-10-06T02:00:00Z'),
  );
  assert.match(title, /2 件/);
  assert.match(body, /@sherlockafa007/, '@mention が無いとメールが飛ばない');
  assert.ok(body.includes(ADMIN_URL));
  assert.match(body, /1営業日以内/);
  assert.match(body, /2026-10-06 10:00/, '最も古い受信時刻（JST）');
});

test('未通知だけを選ぶ（notifiedAt があるものは二度通知しない）', () => {
  const docs = [LEAD, { ...LEAD, id: 'x2', notifiedAt: new Date() }, null];
  assert.deepEqual(
    pickUnnotified(docs).map((d) => d.id),
    ['x1'],
  );
});

test('通知の順序：issue 作成に成功してから notifiedAt を付ける（逆だと取りこぼす）', () => {
  const src = readFileSync(new URL('../scripts/lead-notifier/index.js', import.meta.url), 'utf8');
  const issueAt = src.indexOf('await createIssue(');
  const markAt = src.indexOf('notifiedAt: admin.firestore.FieldValue');
  assert.ok(issueAt > 0 && markAt > issueAt, 'notifiedAt の記録が issue 作成より前にある');
});

test('ワークフローは源リポジトリ限定・毎時・issues 書き込み権限あり', () => {
  const yml = readFileSync(
    new URL('../.github/workflows/notify-leads.yml', import.meta.url),
    'utf8',
  );
  assert.match(yml, /github\.repository == 'sherlockafa007\/senridoufuu-web'/);
  assert.match(yml, /cron: '7 \* \* \* \*'/);
  assert.match(yml, /issues: write/);
});
