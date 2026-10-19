// 纯校验逻辑（无 IO），供 sdf-admin Worker 使用，可用 node --test 直接测。

const LANGS = ['ja', 'zh', 'en'];
const MAX_JSON_BYTES = 100_000; // content.json 上限，防误传大对象

export function allowedOrigin(origin) {
  return (
    origin === 'https://www.senridf.com' ||
    origin === 'https://senridf.com' ||
    /^http:\/\/localhost(:\d+)?$/.test(origin)
  );
}

// 大事记的时间点列表（2026-10-18）：[{ id: 'ms5', date: '2026.10' }, ...]，数组顺序＝页面顺序。
// 文字不在这里：msN_event / msN_desc 仍在 ja|zh|en 分组里，和其他文案一样走翻译。
const TIMELINE_MAX = 60;
const TIMELINE_ID = /^ms\d{1,4}$/;
export function validateTimeline(list) {
  if (!Array.isArray(list)) return { ok: false, error: '大事记列表格式错误' };
  if (list.length > TIMELINE_MAX) return { ok: false, error: `大事记最多 ${TIMELINE_MAX} 条` };
  const seen = new Set();
  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: '大事记条目格式错误' };
    }
    if (Object.keys(item).some((k) => k !== 'id' && k !== 'date')) {
      return { ok: false, error: '大事记条目只能有 id 和 date' };
    }
    if (typeof item.id !== 'string' || !TIMELINE_ID.test(item.id)) {
      return { ok: false, error: `大事记条目编号非法：${item.id}` };
    }
    if (seen.has(item.id)) return { ok: false, error: `大事记条目编号重复：${item.id}` };
    seen.add(item.id);
    if (typeof item.date !== 'string' || !item.date.trim() || item.date.length > 30) {
      return { ok: false, error: `大事记日期须为 1〜30 字：${item.id}` };
    }
  }
  return { ok: true };
}

// content.json 载荷形状：{ ja|zh|en|images: { 字段名: 字符串 }, timeline?: [{id,date}] }
export function validateContentPayload(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return { ok: false, error: '内容格式错误' };
  }
  const allowedGroups = [...LANGS, 'images'];
  for (const [group, fields] of Object.entries(content)) {
    if (group === 'timeline') {
      const tl = validateTimeline(fields);
      if (!tl.ok) return tl;
      continue;
    }
    if (!allowedGroups.includes(group)) return { ok: false, error: `未知分组：${group}` };
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return { ok: false, error: `分组 ${group} 格式错误` };
    }
    for (const [key, val] of Object.entries(fields)) {
      if (typeof val !== 'string') return { ok: false, error: `字段 ${group}.${key} 必须是文字` };
    }
  }
  if (JSON.stringify(content).length > MAX_JSON_BYTES) {
    return { ok: false, error: '内容过大，请分次保存' };
  }
  return { ok: true };
}
