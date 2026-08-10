import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calendarExceptionFingerprint,
  recurringRuleFingerprint,
} from '../functions/api/calendar/schedule.js';

test('相同的重复日程生成相同指纹', () => {
  const first = {
    title: '日语课',
    location: 'YWCA',
    timezone: 'Asia/Tokyo',
    recurrence: {
      weekdays: [1, 2, 3, 4, 5],
      startsOn: '2026-08-17',
      endsOn: null,
      startTime: '10:00',
      endTime: '12:00',
    },
  };
  const second = {
    ...first,
    title: ' 日语课 ',
    location: 'ywca',
    recurrence: { ...first.recurrence, weekdays: [5, 4, 3, 2, 1] },
  };
  assert.equal(recurringRuleFingerprint(first), recurringRuleFingerprint(second));
});

test('时间不同的重复日程不会被误判为重复', () => {
  const first = {
    title: '日语课',
    location: 'YWCA',
    recurrence: { weekdays: [1], startsOn: '2026-08-17', startTime: '10:00', endTime: '12:00' },
  };
  const second = {
    ...first,
    recurrence: { ...first.recurrence, startTime: '13:00', endTime: '15:00' },
  };
  assert.notEqual(recurringRuleFingerprint(first), recurringRuleFingerprint(second));
});

test('相同日程和日期范围的放假安排生成相同指纹', () => {
  const first = {
    ruleId: 'rule-1',
    startDate: '2026-09-20',
    endDate: '2026-10-05',
    resumeDate: '2026-10-06',
  };
  assert.equal(calendarExceptionFingerprint(first), calendarExceptionFingerprint({ ...first }));
});

test('不同日程的放假安排不会被误判为重复', () => {
  const first = {
    ruleId: 'rule-1',
    startDate: '2026-09-20',
    endDate: '2026-10-05',
    resumeDate: '2026-10-06',
  };
  assert.notEqual(
    calendarExceptionFingerprint(first),
    calendarExceptionFingerprint({ ...first, ruleId: 'rule-2' }),
  );
});
