import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVisitDuration } from '../js/shared/visit-duration.js';

// 旧实现记下来的是「到第一次切走为止的秒数」，不是停留时长：hidden 时写一次
// 就把 docId 置空，之后切回来读多久都不再记。字段一直有值、从不报错，
// 只是**系统性偏小**——而且越投入的读者越容易切走再回来，偏得最狠的正是
// 最该被看见的那批访问。下面每条测的都是这个语义，不是"函数能跑"。
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 可控时钟：测时间逻辑不能用真时钟，否则又慢又飘。 */
function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

test('单段：打开 30 秒后切走，记 30', () => {
  const c = clock();
  const d = createVisitDuration(c.now);
  c.advance(30_000);
  assert.equal(d.hide(), 30);
});

// ★ 这是旧实现丢掉的那一段。
test('★ 切走再回来继续读，第二段也要被算进去', () => {
  const c = clock();
  const d = createVisitDuration(c.now);
  c.advance(30_000);
  assert.equal(d.hide(), 30);

  d.show();
  c.advance(600_000); // 回来又读了十分钟
  assert.equal(d.hide(), 630, '旧实现在这里会永远停在 30');
});

test('后台停留的时间不计入（切走期间不算在页面上）', () => {
  const c = clock();
  const d = createVisitDuration(c.now);
  c.advance(10_000);
  assert.equal(d.hide(), 10);

  c.advance(3_600_000); // 在后台挂了一小时
  d.show();
  c.advance(5_000);
  assert.equal(d.hide(), 15, '后台那一小时不该被算进停留时长');
});

// visibilitychange→hidden 与 pagehide 在关闭路径上可能都触发。
// visits 是高频写入源，白写一次就是白花一次。
test('没有新增秒数时返回 null，调用方据此跳过写入', () => {
  const c = clock();
  const d = createVisitDuration(c.now);
  c.advance(20_000);
  assert.equal(d.hide(), 20);
  assert.equal(d.hide(), null, '连续两次 hide 不该重复写');
  d.show();
  assert.equal(d.hide(), null, '回到前台但立刻又走，没有新增秒数');
});

test('show 重复调用无副作用（visible 事件可能连着来）', () => {
  const c = clock();
  const d = createVisitDuration(c.now);
  c.advance(10_000);
  d.hide();
  d.show();
  c.advance(1_000);
  d.show(); // 不该把计时起点重置掉
  c.advance(9_000);
  assert.equal(d.hide(), 20);
});

test('不足一秒的抖动不会产生写入', () => {
  const c = clock();
  const d = createVisitDuration(c.now);
  c.advance(200);
  assert.equal(d.hide(), null, '0 秒不该写');
});

// 下面两条盯接线：逻辑对了但页面没用上，等于没改。
test('tracking.js 用了累加器，且不再自行计算 now - startTime', () => {
  const s = readFileSync(path.join(ROOT, 'js', 'tracking.js'), 'utf8');
  assert.match(s, /createVisitDuration\(\)/, '没有创建累加器');
  assert.match(s, /visitDuration\.hide\(\)/, 'finish 没有走累加器');
  assert.match(s, /visitDuration\.show\(\)/, '切回前台时没有恢复计时');
  assert.doesNotMatch(s, /Date\.now\(\) - startTime/, '还在用旧的单段算法');
  // 旧实现写完就把引用清空，后续时间永远丢失
  assert.doesNotMatch(s, /visitDocIdRef = null;\s*\n}/, '写完仍在清空 docId，第二段会再次丢失');
});

test('关闭标签页也会结算（hidden 在部分浏览器的关闭路径上不触发）', () => {
  const s = readFileSync(path.join(ROOT, 'js', 'tracking.js'), 'utf8');
  assert.match(s, /addEventListener\('pagehide', finish\)/, '缺少 pagehide 兜底');
});
