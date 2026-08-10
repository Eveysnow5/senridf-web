import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCalendarIcs, calendarIcsFilename } from '../js/admin/calendar/ics.mjs';

const rule = {
  id: 'rule-1',
  title: '日语课',
  location: 'YWCA, Osaka',
  notes: '每周课程',
  recurrence: {
    weekdays: [1, 2, 3, 4, 5],
    startsOn: '2026-08-17',
    endsOn: null,
    startTime: '10:00',
    endTime: '12:00',
  },
};

test('Apple Calendar 文件包含重复规则和东京时区', () => {
  const ics = buildCalendarIcs(rule, [], new Date('2026-08-10T00:00:00Z'));
  assert.match(ics, /DTSTART;TZID=Asia\/Tokyo:20260817T100000/);
  assert.match(ics, /DTEND;TZID=Asia\/Tokyo:20260817T120000/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR/);
  assert.match(ics, /SUMMARY:日语课/);
  assert.match(ics, /LOCATION:YWCA\\, Osaka/);
});

test('Apple Calendar 文件把放假期间的上课日写为例外', () => {
  const ics = buildCalendarIcs(
    rule,
    [
      {
        ruleId: 'rule-1',
        startDate: '2026-09-20',
        endDate: '2026-10-05',
        resumeDate: '2026-10-06',
      },
    ],
    new Date('2026-08-10T00:00:00Z'),
  );
  assert.match(ics, /EXDATE;TZID=Asia\/Tokyo:/);
  assert.match(ics, /20260921T100000/);
  assert.match(ics, /20261005T100000/);
  assert.doesNotMatch(ics, /20260920T100000/);
  assert.doesNotMatch(ics, /20261006T100000/);
});

test('Apple Calendar 下载文件名过滤 Windows 非法字符', () => {
  assert.equal(calendarIcsFilename({ title: '日语/课程:测试' }), '日语-课程-测试.ics');
});
