import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCalendarParsePrompt,
  parseCalendarModelResponse,
  resolveCalendarExceptionRule,
  tokyoNow,
} from '../functions/api/calendar/_parse.js';

const completeEvent = {
  intent: 'create_event',
  title: '游泳',
  start: '2026-08-13T13:00:00+09:00',
  end: '2026-08-13T15:00:00+09:00',
  timezone: 'Asia/Tokyo',
  location: '扇町公园附近的游泳馆',
  category: 'personal',
  subcategory: 'exercise',
  confidence: 0.9,
  notes: '结束时间按游泳常见时长2小时建议，可修改。',
  needsConfirmation: false,
  confirmationQuestions: [],
  durationMinutes: 120,
  durationSource: 'suggested',
  recurrence: null,
  exception: null,
};

test('tokyoNow 使用 Asia/Tokyo 生成明确当前时间', () => {
  assert.deepEqual(tokyoNow(new Date('2026-08-09T03:34:56Z')), {
    iso: '2026-08-09T12:34:56+09:00',
    weekday: 'Sunday',
  });
});

test('prompt 注入服务端当前时间、时区与原始输入', () => {
  const prompt = buildCalendarParsePrompt('明天下午2点游泳', {
    iso: '2026-08-09T12:00:00+09:00',
    weekday: 'Sunday',
  });
  assert.match(prompt, /2026-08-09T12:00:00\+09:00/);
  assert.match(prompt, /Asia\/Tokyo/);
  assert.match(prompt, /明天下午2点游泳/);
});

test('解析合法的结构化日程', () => {
  assert.deepEqual(parseCalendarModelResponse(JSON.stringify(completeEvent)), completeEvent);
});

test('容忍 JSON 代码块，但仍执行完整校验', () => {
  assert.deepEqual(
    parseCalendarModelResponse(`\`\`\`json\n${JSON.stringify(completeEvent)}\n\`\`\``),
    completeEvent,
  );
});

test('缺少具体时间时允许 null，并要求用户确认', () => {
  const event = {
    ...completeEvent,
    start: null,
    end: null,
    durationMinutes: null,
    durationSource: 'unknown',
    needsConfirmation: true,
    confirmationQuestions: ['下午具体几点开始？'],
  };
  assert.deepEqual(parseCalendarModelResponse(JSON.stringify(event)), event);
});

test('非法 JSON 明确失败', () => {
  assert.throws(() => parseCalendarModelResponse('not-json'), /invalid JSON/);
});

test('拒绝非 Asia/Tokyo 时间和倒置时间', () => {
  assert.throws(
    () =>
      parseCalendarModelResponse(
        JSON.stringify({ ...completeEvent, start: '2026-08-13T13:00:00Z' }),
      ),
    /Asia\/Tokyo ISO 8601/,
  );
  assert.throws(
    () =>
      parseCalendarModelResponse(
        JSON.stringify({
          ...completeEvent,
          start: '2026-08-13T15:00:00+09:00',
          end: '2026-08-13T13:00:00+09:00',
        }),
      ),
    /end must be after start/,
  );
});

test('解析每周重复日程并规范星期顺序', () => {
  const event = parseCalendarModelResponse(
    JSON.stringify({
      ...completeEvent,
      intent: 'create_recurring_event',
      start: null,
      end: null,
      title: '日语课',
      durationMinutes: 120,
      durationSource: 'explicit',
      recurrence: {
        frequency: 'weekly',
        weekdays: [5, 1, 3, 2, 4, 1],
        startsOn: '2026-08-17',
        endsOn: null,
        startTime: '10:00',
        endTime: '12:00',
      },
    }),
  );
  assert.deepEqual(event.recurrence.weekdays, [1, 2, 3, 4, 5]);
  assert.equal(event.intent, 'create_recurring_event');
});

test('重复日程缺少开始日期时必须要求确认', () => {
  assert.throws(
    () =>
      parseCalendarModelResponse(
        JSON.stringify({
          ...completeEvent,
          intent: 'create_recurring_event',
          start: null,
          end: null,
          recurrence: {
            frequency: 'weekly',
            weekdays: [1, 2, 3, 4, 5],
            startsOn: null,
            endsOn: null,
            startTime: '10:00',
            endTime: '12:00',
          },
        }),
      ),
    /Incomplete recurrence/,
  );
});

test('放假例外必须指向已有规则并包含日期范围', () => {
  const event = parseCalendarModelResponse(
    JSON.stringify({
      ...completeEvent,
      intent: 'add_exception',
      title: '日语课放假',
      start: null,
      end: null,
      durationMinutes: null,
      durationSource: 'unknown',
      exception: {
        ruleId: 'rule-1',
        startDate: '2026-09-20',
        endDate: '2026-10-05',
        resumeDate: '2026-10-06',
      },
    }),
  );
  assert.equal(event.exception.ruleId, 'rule-1');
  assert.equal(event.exception.resumeDate, '2026-10-06');
});

test('用户明确说出唯一已有日程名称时自动关联放假规则', () => {
  const event = resolveCalendarExceptionRule(
    {
      ...completeEvent,
      intent: 'add_exception',
      title: '未识别日程',
      needsConfirmation: true,
      confirmationQuestions: ['请确认要暂停哪条日程'],
      exception: {
        ruleId: null,
        startDate: '2026-09-20',
        endDate: '2026-10-05',
        resumeDate: '2026-10-06',
      },
    },
    '日语课9月20日开始放假，10月6日开学',
    [{ id: 'rule-1', title: '日语课' }],
  );
  assert.equal(event.exception.ruleId, 'rule-1');
  assert.equal(event.needsConfirmation, false);
  assert.deepEqual(event.confirmationQuestions, []);
});

test('没有明确说出日程名称时不擅自关联', () => {
  const event = {
    ...completeEvent,
    intent: 'add_exception',
    needsConfirmation: true,
    confirmationQuestions: ['请确认要暂停哪条日程'],
    exception: {
      ruleId: null,
      startDate: '2026-09-20',
      endDate: '2026-10-05',
      resumeDate: '2026-10-06',
    },
  };
  assert.equal(
    resolveCalendarExceptionRule(event, '9月20日开始放假', [{ id: 'rule-1', title: '日语课' }])
      .exception.ruleId,
    null,
  );
});
