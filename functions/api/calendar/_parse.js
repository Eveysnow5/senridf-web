export const CALENDAR_TIME_ZONE = 'Asia/Tokyo';

const INTENTS = new Set(['create_event', 'create_recurring_event', 'add_exception', 'unknown']);
const CATEGORIES = new Set(['work', 'study', 'personal', 'health', 'social', 'travel', 'other']);
const DURATION_SOURCES = new Set(['explicit', 'suggested', 'unknown']);
const ISO_TOKYO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY = /^([01]\d|2[0-3]):[0-5]\d$/;

export function tokyoNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CALENDAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'long',
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return {
    iso: `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}:${value('second')}+09:00`,
    weekday: value('weekday'),
  };
}

export function buildCalendarParsePrompt(text, now = tokyoNow(), knownRules = []) {
  const rules = knownRules.map((rule) => ({
    id: rule.id,
    title: rule.title,
    location: rule.location,
    recurrence: rule.recurrence,
  }));

  return `你是日历理解助手。只理解用户想对日历做什么，不写数据库，也不调用地图。
服务端当前时间：${now.iso}
当前星期：${now.weekday}
固定时区：${CALENDAR_TIME_ZONE}
当前用户已有的重复日程：${JSON.stringify(rules)}

把用户输入转换成一个严格 JSON 对象，不输出 Markdown、解释或第二个对象：
{
  "intent": "create_event" | "create_recurring_event" | "add_exception" | "unknown",
  "title": string | null,
  "start": "YYYY-MM-DDTHH:mm:ss+09:00" | null,
  "end": "YYYY-MM-DDTHH:mm:ss+09:00" | null,
  "timezone": "Asia/Tokyo",
  "location": string | null,
  "category": "work" | "study" | "personal" | "health" | "social" | "travel" | "other",
  "subcategory": string | null,
  "confidence": number,
  "notes": string | null,
  "needsConfirmation": boolean,
  "confirmationQuestions": string[],
  "durationMinutes": number | null,
  "durationSource": "explicit" | "suggested" | "unknown",
  "recurrence": null | {
    "frequency": "weekly",
    "weekdays": number[],
    "startsOn": "YYYY-MM-DD" | null,
    "endsOn": "YYYY-MM-DD" | null,
    "startTime": "HH:mm" | null,
    "endTime": "HH:mm" | null
  },
  "exception": null | {
    "ruleId": string | null,
    "startDate": "YYYY-MM-DD" | null,
    "endDate": "YYYY-MM-DD" | null,
    "resumeDate": "YYYY-MM-DD" | null
  }
}

规则：
1. 今天、明天、后天、本周X、下周X必须根据服务端当前时间计算。
2. 上午、下午、晚上要结合用户说出的小时转换；没有具体小时就留空并询问。
3. 用户说“每周一到周五”等重复安排时，intent=create_recurring_event，weekdays 用1至7代表周一至周日。
4. 重复日程没有开始日期、开始时间或结束时间时不要猜，needsConfirmation=true并提出简短问题。
5. 用户说放假、停课、暂停某段已有重复日程时，intent=add_exception。根据已有规则选择 ruleId；无法唯一确定时 ruleId=null 并询问。
6. “几号开学/恢复”写入 resumeDate；放假结束日通常是恢复日前一天。不要删除原规则。
7. 用户明确说时长时 durationSource=explicit。只说开始时间时，可建议：吃饭60分钟、喝酒120分钟、游泳120分钟，并在notes说明可修改。
8. 其他活动无法可靠估计时长时，不猜测结束时间，要询问用户。
9. 地点只提取用户亲自说出的文字，不虚构搜索结果。
10. 不确定或缺失的必要信息必须 needsConfirmation=true，并写入 confirmationQuestions。
11. confidence 范围是0到1。标题保持简短。

用户输入：${JSON.stringify(text)}`;
}

export function resolveCalendarExceptionRule(event, text, knownRules = []) {
  if (event.intent !== 'add_exception' || !event.exception || event.exception.ruleId) return event;
  const normalizedInput = String(text || '').toLocaleLowerCase();
  const matches = knownRules.filter((rule) => {
    const title = String(rule.title || '')
      .trim()
      .toLocaleLowerCase();
    return title && normalizedInput.includes(title);
  });
  if (matches.length !== 1) return event;

  const resolved = {
    ...event,
    title: `${matches[0].title}放假`,
    location: matches[0].location || event.location,
    exception: { ...event.exception, ruleId: matches[0].id },
  };
  if (resolved.exception.startDate && resolved.exception.endDate) {
    resolved.needsConfirmation = false;
    resolved.confirmationQuestions = [];
  }
  return resolved;
}

function proposalError(message) {
  const error = new Error(message);
  error.name = 'CalendarProposalError';
  throw error;
}

function nullableString(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') proposalError(`${field} must be a string or null`);
  return value.trim() || null;
}

function nullablePattern(value, field, pattern) {
  const normalized = nullableString(value, field);
  if (normalized !== null && !pattern.test(normalized)) {
    proposalError(
      pattern === ISO_TOKYO ? `${field} must be an Asia/Tokyo ISO 8601 value` : `Invalid ${field}`,
    );
  }
  return normalized;
}

function normalizeRecurrence(value) {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    proposalError('Invalid recurrence');
  }
  if (value.frequency !== 'weekly') proposalError('Invalid recurrence frequency');
  if (
    !Array.isArray(value.weekdays) ||
    value.weekdays.length === 0 ||
    value.weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)
  ) {
    proposalError('Invalid recurrence weekdays');
  }
  return {
    frequency: 'weekly',
    weekdays: [...new Set(value.weekdays)].sort((a, b) => a - b),
    startsOn: nullablePattern(value.startsOn, 'recurrence.startsOn', DATE_ONLY),
    endsOn: nullablePattern(value.endsOn, 'recurrence.endsOn', DATE_ONLY),
    startTime: nullablePattern(value.startTime, 'recurrence.startTime', TIME_ONLY),
    endTime: nullablePattern(value.endTime, 'recurrence.endTime', TIME_ONLY),
  };
}

function normalizeException(value) {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    proposalError('Invalid exception');
  }
  return {
    ruleId: nullableString(value.ruleId, 'exception.ruleId'),
    startDate: nullablePattern(value.startDate, 'exception.startDate', DATE_ONLY),
    endDate: nullablePattern(value.endDate, 'exception.endDate', DATE_ONLY),
    resumeDate: nullablePattern(value.resumeDate, 'exception.resumeDate', DATE_ONLY),
  };
}

export function validateCalendarProposal(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    proposalError('Calendar proposal must be an object');
  }
  if (!INTENTS.has(value.intent)) proposalError('Invalid intent');
  if (!CATEGORIES.has(value.category)) proposalError('Invalid category');
  if (!DURATION_SOURCES.has(value.durationSource)) proposalError('Invalid durationSource');
  if (value.timezone !== CALENDAR_TIME_ZONE) proposalError('Invalid timezone');
  if (typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 1) {
    proposalError('Invalid confidence');
  }
  if (typeof value.needsConfirmation !== 'boolean') {
    proposalError('Invalid needsConfirmation');
  }
  if (!Array.isArray(value.confirmationQuestions)) {
    proposalError('Invalid confirmationQuestions');
  }
  const confirmationQuestions = value.confirmationQuestions.map((question) => {
    if (typeof question !== 'string' || !question.trim()) {
      proposalError('Invalid confirmation question');
    }
    return question.trim();
  });
  const durationMinutes = value.durationMinutes;
  if (
    durationMinutes !== null &&
    durationMinutes !== undefined &&
    (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440)
  ) {
    proposalError('Invalid durationMinutes');
  }

  const result = {
    intent: value.intent,
    title: nullableString(value.title, 'title'),
    start: nullablePattern(value.start, 'start', ISO_TOKYO),
    end: nullablePattern(value.end, 'end', ISO_TOKYO),
    timezone: CALENDAR_TIME_ZONE,
    location: nullableString(value.location, 'location'),
    category: value.category,
    subcategory: nullableString(value.subcategory, 'subcategory'),
    confidence: value.confidence,
    notes: nullableString(value.notes, 'notes'),
    needsConfirmation: value.needsConfirmation,
    confirmationQuestions,
    durationMinutes: durationMinutes ?? null,
    durationSource: value.durationSource,
    recurrence: normalizeRecurrence(value.recurrence),
    exception: normalizeException(value.exception),
  };

  if (result.start && result.end && new Date(result.end) <= new Date(result.start)) {
    proposalError('Calendar event end must be after start');
  }
  if (result.intent === 'create_event' && !result.title) {
    proposalError('Calendar event title is required');
  }
  if (result.intent === 'create_recurring_event') {
    if (!result.title || !result.recurrence) proposalError('Recurring event details are required');
    const recurrenceComplete =
      result.recurrence.startsOn && result.recurrence.startTime && result.recurrence.endTime;
    if (!recurrenceComplete && !result.needsConfirmation) {
      proposalError('Incomplete recurrence must require confirmation');
    }
    if (
      result.recurrence.startTime &&
      result.recurrence.endTime &&
      result.recurrence.endTime <= result.recurrence.startTime
    ) {
      proposalError('Recurring event end must be after start');
    }
  }
  if (result.intent === 'add_exception') {
    if (!result.exception) proposalError('Exception details are required');
    const exceptionComplete =
      result.exception.ruleId && result.exception.startDate && result.exception.endDate;
    if (!exceptionComplete && !result.needsConfirmation) {
      proposalError('Incomplete exception must require confirmation');
    }
    if (
      result.exception.startDate &&
      result.exception.endDate &&
      result.exception.endDate < result.exception.startDate
    ) {
      proposalError('Exception end must not be before start');
    }
  }
  return result;
}

export function parseCalendarModelResponse(raw) {
  if (typeof raw !== 'string') proposalError('Calendar model response must be text');
  let cleaned = raw.trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) cleaned = fenced[1].trim();
  if (!cleaned.startsWith('{')) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
  }

  let value;
  try {
    value = JSON.parse(cleaned);
  } catch {
    proposalError('Calendar model returned invalid JSON');
  }
  return validateCalendarProposal(value);
}
