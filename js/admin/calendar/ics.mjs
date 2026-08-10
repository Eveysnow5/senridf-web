const WEEKDAYS = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

function escapeIcs(value) {
  return String(value || '')
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;');
}

function compactDate(value) {
  return value.replaceAll('-', '');
}

function localDateTime(date, time) {
  return `${compactDate(date)}T${time.replace(':', '')}00`;
}

function utcStamp(date = new Date()) {
  return date
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function localDateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function exceptionDates(rule, exceptions) {
  const dates = [];
  const weekdays = new Set(rule.recurrence.weekdays);
  exceptions
    .filter((exception) => exception.ruleId === rule.id)
    .forEach((exception) => {
      const cursor = new Date(`${exception.startDate}T00:00:00Z`);
      const end = new Date(`${exception.endDate}T00:00:00Z`);
      while (cursor <= end) {
        const weekday = cursor.getUTCDay() || 7;
        const key = localDateKey(cursor);
        if (
          weekdays.has(weekday) &&
          key >= rule.recurrence.startsOn &&
          (!rule.recurrence.endsOn || key <= rule.recurrence.endsOn)
        ) {
          dates.push(key);
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    });
  return [...new Set(dates)].sort();
}

export function buildCalendarIcs(rule, exceptions = [], now = new Date()) {
  const recurrence = rule.recurrence;
  const rrule = [
    'FREQ=WEEKLY',
    `BYDAY=${recurrence.weekdays.map((day) => WEEKDAYS[day]).join(',')}`,
  ];
  if (recurrence.endsOn) {
    rrule.push(`UNTIL=${compactDate(recurrence.endsOn)}T145959Z`);
  }
  const excluded = exceptionDates(rule, exceptions);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Senridf//AI Calendar//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(rule.id)}@senridf.com`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART;TZID=Asia/Tokyo:${localDateTime(recurrence.startsOn, recurrence.startTime)}`,
    `DTEND;TZID=Asia/Tokyo:${localDateTime(recurrence.startsOn, recurrence.endTime)}`,
    `RRULE:${rrule.join(';')}`,
    `SUMMARY:${escapeIcs(rule.title)}`,
  ];
  if (rule.location) lines.push(`LOCATION:${escapeIcs(rule.location)}`);
  if (rule.notes) lines.push(`DESCRIPTION:${escapeIcs(rule.notes)}`);
  if (excluded.length) {
    lines.push(
      `EXDATE;TZID=Asia/Tokyo:${excluded
        .map((date) => localDateTime(date, recurrence.startTime))
        .join(',')}`,
    );
  }
  lines.push('END:VEVENT', 'END:VCALENDAR', '');
  return lines.join('\r\n');
}

export function calendarIcsFilename(rule) {
  const safeTitle = String(rule.title || 'calendar')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .slice(0, 60);
  return `${safeTitle || 'calendar'}.ics`;
}
