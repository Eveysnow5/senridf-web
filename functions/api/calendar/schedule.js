import {
  deleteCalendarDocument,
  getCalendarDocument,
  listCalendarDocuments,
  saveCalendarDocument,
} from './_store.js';
import { validateCalendarProposal } from './_parse.js';

function normalizedText(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase();
}

export function recurringRuleFingerprint(rule) {
  const recurrence = rule.recurrence || {};
  return JSON.stringify({
    title: normalizedText(rule.title),
    location: normalizedText(rule.location),
    timezone: rule.timezone || 'Asia/Tokyo',
    weekdays: [...(recurrence.weekdays || [])].sort((a, b) => a - b),
    startsOn: recurrence.startsOn || null,
    endsOn: recurrence.endsOn || null,
    startTime: recurrence.startTime || null,
    endTime: recurrence.endTime || null,
  });
}

export function calendarExceptionFingerprint(exception) {
  return JSON.stringify({
    ruleId: exception.ruleId || null,
    startDate: exception.startDate || null,
    endDate: exception.endDate || null,
    resumeDate: exception.resumeDate || null,
  });
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function onRequest(context) {
  const common = {
    request: context.request,
    user: context.data.calendarUser,
  };

  try {
    if (context.request.method === 'GET') {
      const [rules, exceptions] = await Promise.all([
        listCalendarDocuments({ ...common, collection: 'calendarRules' }),
        listCalendarDocuments({ ...common, collection: 'calendarExceptions' }),
      ]);
      return json(200, { rules, exceptions });
    }

    if (context.request.method === 'DELETE') {
      const id = new URL(context.request.url).searchParams.get('id');
      if (!id) return json(400, { error: '缺少要删除的日程' });
      const rule = await getCalendarDocument({
        ...common,
        collection: 'calendarRules',
        id,
      });
      if (!rule) return json(404, { error: '没有找到这条日程' });

      const exceptions = await listCalendarDocuments({
        ...common,
        collection: 'calendarExceptions',
      });
      await Promise.all(
        exceptions
          .filter((exception) => exception.ruleId === id)
          .map((exception) =>
            deleteCalendarDocument({
              ...common,
              collection: 'calendarExceptions',
              id: exception.id,
            }),
          ),
      );
      await deleteCalendarDocument({ ...common, collection: 'calendarRules', id });
      return json(200, { deleted: { id, title: rule.title } });
    }

    if (context.request.method !== 'POST') {
      return json(405, { error: 'Method Not Allowed' });
    }

    const body = await context.request.json();
    const proposal = validateCalendarProposal(body.proposal);
    if (proposal.needsConfirmation) {
      return json(400, { error: '请先确认日程中不确定的信息' });
    }

    if (proposal.intent === 'create_recurring_event') {
      const existingRules = await listCalendarDocuments({
        ...common,
        collection: 'calendarRules',
      });
      const duplicate = existingRules.find(
        (rule) => recurringRuleFingerprint(rule) === recurringRuleFingerprint(proposal),
      );
      if (duplicate) {
        return json(200, {
          duplicate: true,
          saved: { type: 'recurringRule', value: duplicate },
        });
      }

      const saved = await saveCalendarDocument({
        ...common,
        collection: 'calendarRules',
        value: {
          title: proposal.title,
          location: proposal.location,
          category: proposal.category,
          subcategory: proposal.subcategory,
          notes: proposal.notes,
          timezone: proposal.timezone,
          recurrence: proposal.recurrence,
          active: true,
          createdAt: new Date().toISOString(),
        },
      });
      return json(201, { saved: { type: 'recurringRule', value: saved } });
    }

    if (proposal.intent === 'add_exception') {
      const rule = await getCalendarDocument({
        ...common,
        collection: 'calendarRules',
        id: proposal.exception.ruleId,
      });
      if (!rule) return json(404, { error: '没有找到要暂停的重复日程' });

      const existingExceptions = await listCalendarDocuments({
        ...common,
        collection: 'calendarExceptions',
      });
      const duplicate = existingExceptions.find(
        (exception) =>
          calendarExceptionFingerprint(exception) ===
          calendarExceptionFingerprint(proposal.exception),
      );
      if (duplicate) {
        return json(200, {
          duplicate: true,
          saved: { type: 'exception', value: duplicate },
        });
      }

      const saved = await saveCalendarDocument({
        ...common,
        collection: 'calendarExceptions',
        value: {
          ruleId: rule.id,
          ruleTitle: rule.title,
          action: 'pause',
          startDate: proposal.exception.startDate,
          endDate: proposal.exception.endDate,
          resumeDate: proposal.exception.resumeDate,
          createdAt: new Date().toISOString(),
        },
      });
      return json(201, { saved: { type: 'exception', value: saved } });
    }

    return json(400, { error: '当前只能保存重复日程或放假安排' });
  } catch (error) {
    if (error instanceof SyntaxError || error.name === 'CalendarProposalError') {
      return json(400, { error: error.message || '日程内容不正确' });
    }
    console.error('[calendar schedule]', error);
    return json(502, { error: '日程保存失败，请稍后重试' });
  }
}
