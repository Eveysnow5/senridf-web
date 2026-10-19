// 后台保存协议（2026-10-18）：只发改动、服务端在最新版上合并 + 大事记时间点列表。
// 起因：2026-10-18 01:17 后台用「打开时读到的整份旧副本」覆盖了刚同步的日英成员简介。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateContentPayload, validateTimeline } from '../workers/sdf-admin/src/validate.js';
import {
  CONTENT_API_VERSION,
  mergeContent,
  saveContentChanges,
  ConflictError,
} from '../workers/sdf-admin/src/content-save.js';

// ── 时间点列表的校验 ──
test('validateTimeline 接受合法列表（含空列表）', () => {
  assert.equal(validateTimeline([]).ok, true);
  assert.equal(
    validateTimeline([
      { id: 'ms1', date: '2025.02' },
      { id: 'ms12', date: '2026.05–06' },
    ]).ok,
    true,
  );
});

test('validateTimeline 拒绝：非数组、编号非法/重复、日期空或过长、多余字段', () => {
  assert.equal(validateTimeline({}).ok, false);
  assert.equal(validateTimeline([{ id: 'x1', date: '2026' }]).ok, false);
  assert.equal(validateTimeline([{ id: 'ms1_event', date: '2026' }]).ok, false);
  assert.equal(
    validateTimeline([
      { id: 'ms1', date: '2025' },
      { id: 'ms1', date: '2026' },
    ]).ok,
    false,
  );
  assert.equal(validateTimeline([{ id: 'ms1', date: '  ' }]).ok, false);
  assert.equal(validateTimeline([{ id: 'ms1', date: 'x'.repeat(31) }]).ok, false);
  assert.equal(validateTimeline([{ id: 'ms1', date: '2025', html: '<b>' }]).ok, false);
  assert.equal(
    validateTimeline(Array.from({ length: 61 }, (_, i) => ({ id: `ms${i}`, date: 'd' }))).ok,
    false,
  );
});

test('validateContentPayload 接受 timeline 分组，并对它套用列表校验', () => {
  assert.equal(
    validateContentPayload({ zh: {}, timeline: [{ id: 'ms1', date: '2025.02' }] }).ok,
    true,
  );
  assert.equal(validateContentPayload({ timeline: 'ms1' }).ok, false);
});

// ── 合并 ──
test('★ mergeContent 保留 changes 里没提到的键（不会用旧副本盖掉别人刚改的）', () => {
  const latest = {
    zh: { team1_bio: '中文新版', footer_copy: '© 2025' },
    ja: { team1_bio: '日本語・新版' }, // 别人在我打开后台之后同步的
    images: { team1_photo: 'a.webp' },
  };
  const merged = mergeContent(latest, { zh: { vision_title: '让AI融入日常' } });
  assert.equal(merged.ja.team1_bio, '日本語・新版');
  assert.equal(merged.zh.team1_bio, '中文新版');
  assert.equal(merged.zh.vision_title, '让AI融入日常');
  assert.equal(merged.images.team1_photo, 'a.webp');
});

test('mergeContent：改动覆盖同名键；timeline 整体替换并去掉日期首尾空白；不改入参', () => {
  const latest = { zh: { a: '1' }, timeline: [{ id: 'ms1', date: '2025' }] };
  const snapshot = JSON.stringify(latest);
  const merged = mergeContent(latest, {
    zh: { a: '2' },
    timeline: [
      { id: 'ms2', date: ' 2026.10 ' },
      { id: 'ms1', date: '2025' },
    ],
  });
  assert.equal(merged.zh.a, '2');
  assert.deepEqual(merged.timeline, [
    { id: 'ms2', date: '2026.10' },
    { id: 'ms1', date: '2025' },
  ]);
  assert.equal(JSON.stringify(latest), snapshot);
});

test('mergeContent：没传 timeline 时保留原列表', () => {
  const merged = mergeContent({ timeline: [{ id: 'ms1', date: '2025' }] }, { zh: { a: 'x' } });
  assert.deepEqual(merged.timeline, [{ id: 'ms1', date: '2025' }]);
});

// ── 保存流程（IO 用假的 GitHub）──
function fakeRepo(initial) {
  let text = JSON.stringify(initial);
  let sha = 'v1';
  let n = 1;
  const writes = [];
  return {
    writes,
    get json() {
      return JSON.parse(text);
    },
    // 模拟「读完之后、写之前，别人抢先保存了一次」
    sneak(edit) {
      const cur = JSON.parse(text);
      edit(cur);
      text = JSON.stringify(cur);
      sha = 'v' + ++n;
    },
    io(hooks = {}) {
      return {
        read: async () => ({ text, sha }),
        write: async (newText, expectSha) => {
          if (hooks.beforeWrite) hooks.beforeWrite();
          if (expectSha !== sha) throw new ConflictError();
          text = newText;
          sha = 'v' + ++n;
          writes.push(newText);
          return { commitSha: 'c' + n };
        },
      };
    },
  };
}

test('saveContentChanges 正常保存：在最新版上合并并写回，返回合并结果', async () => {
  const repo = fakeRepo({ zh: { a: '1' }, en: { b: 'B' } });
  const r = await saveContentChanges({ zh: { c: '3' } }, repo.io());
  assert.equal(r.ok, true);
  assert.deepEqual(repo.json, { zh: { a: '1', c: '3' }, en: { b: 'B' } });
  assert.deepEqual(r.content, repo.json);
});

test('★ 写入瞬间别人抢先保存：重读最新版重合并，对方的改动和我的改动都在', async () => {
  const repo = fakeRepo({ zh: { a: '1' } });
  let once = true;
  const io = repo.io({
    beforeWrite: () => {
      if (!once) return;
      once = false;
      repo.sneak((c) => {
        c.ja = { a: '別の人の更新' };
      });
    },
  });
  const r = await saveContentChanges({ zh: { mine: '我的改动' } }, io);
  assert.equal(r.ok, true);
  assert.equal(repo.json.ja.a, '別の人の更新');
  assert.equal(repo.json.zh.mine, '我的改动');
  assert.equal(repo.writes.length, 1);
});

test('一直冲突：重试有上限，返回 409，不会无限循环', async () => {
  const repo = fakeRepo({});
  const io = repo.io({
    beforeWrite: () => repo.sneak((c) => (c.zh = { n: String(Math.random()) })),
  });
  const r = await saveContentChanges({ zh: { a: '1' } }, io, { attempts: 3 });
  assert.equal(r.ok, false);
  assert.equal(r.status, 409);
  assert.equal(repo.writes.length, 0);
});

test('改动本身不合法：返回 400，一次都不写', async () => {
  const repo = fakeRepo({ zh: { a: '1' } });
  const r = await saveContentChanges({ timeline: [{ id: 'bad', date: '2026' }] }, repo.io());
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.equal(repo.writes.length, 0);
});

test('非冲突的写入错误原样抛出（不被当成冲突重试吞掉）', async () => {
  const io = {
    read: async () => ({ text: '{}', sha: 'v1' }),
    write: async () => {
      throw new Error('GitHub 写入失败（500）');
    },
  };
  await assert.rejects(saveContentChanges({ zh: { a: '1' } }, io), /500/);
});

// ── 前后端协议的接线（防止有人改回「整份内容」的写法）──
const admin = readFileSync(new URL('../admin/index.html', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../workers/sdf-admin/src/index.js', import.meta.url), 'utf8');

test('后台保存发的是 changes，不是整份 content；且保存前先确认 Worker 协议版本', () => {
  const save = admin.slice(admin.indexOf('window.save = async function'));
  const body = save.slice(0, save.indexOf('\n};'));
  assert.match(body, /const payload = \{ changes \}/);
  assert.doesNotMatch(body, /content: ov|\{ content:/);
  assert.ok(
    body.indexOf('await ensureSaveApi()') > -1 &&
      body.indexOf('await ensureSaveApi()') < body.indexOf("api('PUT', '/content'"),
    '必须先 ensureSaveApi 再 PUT',
  );
  assert.match(admin, /Number\(data\.api\) >= 2/);
  assert.equal(CONTENT_API_VERSION >= 2, true);
});

test('Worker：/health 报协议版本；旧格式 body.content 被拒绝（409），走 saveContentChanges', () => {
  assert.match(worker, /\/health'\) return json\(200, \{ ok: true, api: CONTENT_API_VERSION \}/);
  assert.match(worker, /body\.content !== undefined \|\| !body\.changes/);
  assert.match(worker, /saveContentChanges\(changes,/);
  assert.match(worker, /expectSha: sha/);
});
