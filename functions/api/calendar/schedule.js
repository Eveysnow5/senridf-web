import { getCalendarDocument, listCalendarDocuments, saveCalendarDocument } from './_store.js';
import { validateCalendarProposal } from './_parse.js';

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

    if (context.request.method !== 'POST') {
      return json(405, { error: 'Method Not Allowed' });
    }

    const body = await context.request.json();
    const proposal = validateCalendarProposal(body.proposal);
    if (proposal.needsConfirmation) {
      return json(400, { error: '请先确认日程中不确定的信息' });
    }

    if (proposal.intent === 'create_recurring_event') {
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
