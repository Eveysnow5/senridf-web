// Blog 后台草稿箱（2026-10-24）：列表合并与按钮可用性。期待值按作者描述的规则手写：
// 「完成」进草稿箱、「上架」后公众才看得到、「下架」回草稿箱。
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  mergeRows,
  rowActions,
  rowStatus,
  publishProblem,
  newDocId,
  docIdForSlug,
} from '../js/shared/blog-posts-model.js';

const t3 = (s) => ({ zh: s, ja: s, en: s });
const live = (slug, date) => ({ slug, date, tag: '', title: t3('线上' + slug), body: t3('x') });

test('三种状态：只在线上的旧文章、草稿、线上有未上架修改', () => {
  const rows = mergeRows(
    [live('2026-10-21-4b60', '2026-10-21'), live('2025-03-15-aaaa', '2025-03-15')],
    [
      { id: 'p_new1', date: '2025-06-01', title: t3('新草稿') },
      {
        id: 'p_2025-03-15-aaaa',
        slug: '2025-03-15-aaaa',
        date: '2025-03-15',
        title: t3('改过'),
        dirty: true,
      },
    ],
  );
  assert.deepEqual(
    rows.map((r) => [r.key, r.live, r.dirty, rowStatus(r).text, rowActions(r)]),
    [
      ['live:2026-10-21-4b60', true, false, '已上架', { canPublish: false, canUnpublish: true }],
      ['p_new1', false, false, '草稿', { canPublish: true, canUnpublish: false }],
      [
        'p_2025-03-15-aaaa',
        true,
        true,
        '已上架 · 有修改未上架',
        { canPublish: true, canUnpublish: true },
      ],
    ],
  );
});

test('下架后：草稿箱里有档、线上没有 → 回到草稿，可再上架', () => {
  const rows = mergeRows(
    [],
    [{ id: 'p_x', slug: '2026-10-21-4b60', date: '2026-10-21', title: t3('a') }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rowStatus(rows[0]).text, '草稿');
  assert.deepEqual(rowActions(rows[0]), { canPublish: true, canUnpublish: false });
});

test('线上的文章不会因为草稿箱里也有一份而出现两行', () => {
  const rows = mergeRows(
    [live('2026-10-21-4b60', '2026-10-21')],
    [{ id: 'p_2026-10-21-4b60', slug: '2026-10-21-4b60', date: '2026-10-21', title: t3('a') }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].docId, 'p_2026-10-21-4b60');
  assert.equal(rows[0].dirty, false); // 没改过：不用再上架
  assert.deepEqual(rowActions(rows[0]), { canPublish: false, canUnpublish: true });
});

test('dirty 只对线上的有意义：草稿本来就能上架', () => {
  const [r] = mergeRows([], [{ id: 'p_a', date: '2026-01-01', title: t3('a'), dirty: true }]);
  assert.equal(rowStatus(r).text, '草稿');
});

test('上架前检查：缺语种、日期不全、未来日期', () => {
  const ok = { date: '2025-03-15', title: t3('标题'), body: t3('<p>x</p>') };
  assert.equal(publishProblem(ok, '2026-10-24'), '');
  assert.match(
    publishProblem({ ...ok, title: { zh: '标题', ja: ' ', en: 'T' } }, '2026-10-24'),
    /^ja /,
  );
  assert.match(publishProblem({ ...ok, body: { zh: 'x', ja: 'x' } }, '2026-10-24'), /^en /);
  assert.match(publishProblem({ ...ok, date: '' }, '2026-10-24'), /没填完整/);
  assert.match(publishProblem({ ...ok, date: '2026-10-25' }, '2026-10-24'), /未来/);
  assert.equal(publishProblem({ ...ok, date: '2026-10-24' }, '2026-10-24'), ''); // 今天可以
});

test('草稿箱文档 id 不会和自动保存的 current 撞，也能放进 onclick 的引号里', () => {
  const ids = [newDocId(), newDocId(0, () => 0), docIdForSlug('2026-10-21-4b60')];
  for (const id of ids) {
    assert.match(id, /^p_[0-9a-z-]+$/);
    assert.notEqual(id, 'current');
  }
});

// Firestore 规则：草稿箱放在 blog_drafts 下，正是因为那里已经「只有管理员能读写」。
// 哪天有人把规则放宽，草稿（未公开的文章）就会被任何登录用户读到。
test('blog_drafts 仍然只有管理员能读写', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const m = rules.match(/match \/blog_drafts\/\{doc\} \{([\s\S]*?)\}/);
  assert.ok(m, '没找到 blog_drafts 的规则');
  assert.match(m[1].trim(), /^allow read, write: if isAdmin\(\);$/);
});
