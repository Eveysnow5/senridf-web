// 后台「保存并发布」的合并逻辑（2026-10-18）。IO 由调用方注入，node --test 可直接测。
//
// 为什么改：原来前端把「打开后台那一刻读到的整份 content.json」＋本次改动整份 PUT 回来，
// 服务端原样覆盖。打开后台之后若有别人（或我）改过内容，保存就会用旧副本把新内容盖掉、
// 不报错——2026-10-18 01:17 实际发生过，日英成员简介被打回旧版。
// 现在前端只发「改了哪几项」（changes），服务端读最新版、在其上合并、带着读到的 sha 写回；
// 写入时若 GitHub 报冲突（期间又有人保存），重读重合并，最多 3 次。

import { validateContentPayload } from './validate.js';

// 前端保存前先查 /health 的 api 版本。旧 Worker 不认 changes，会把它当成整份内容
// 存成 {images:{}} ——等于清空全站文案。所以版本对不上，前端必须拒绝保存。
export const CONTENT_API_VERSION = 2;

const MERGE_GROUPS = ['ja', 'zh', 'en', 'images'];

/** 在 current 上应用 changes，返回新对象（不改入参）。timeline 整体替换（由编辑器维护完整顺序）。 */
export function mergeContent(current, changes) {
  const out = { ...(current || {}) };
  for (const g of MERGE_GROUPS) {
    if (changes[g] && Object.keys(changes[g]).length) out[g] = { ...(out[g] || {}), ...changes[g] };
  }
  if (Array.isArray(changes.timeline)) {
    out.timeline = changes.timeline.map(({ id, date }) => ({ id, date: date.trim() }));
  }
  return out;
}

export class ConflictError extends Error {
  constructor() {
    super('保存冲突');
    this.code = 'CONFLICT';
  }
}

/**
 * @param {object} changes  已含新上传图片路径的改动：{ ja?, zh?, en?, images?, timeline? }
 * @param {{ read: () => Promise<{text:string|null, sha:string|null}>,
 *           write: (text:string, sha:string|null) => Promise<{commitSha:string}> }} io
 *        write 遇到 sha 过期必须抛 ConflictError
 * @returns {Promise<{ok:true, commitSha:string, content:object} | {ok:false, status:number, error:string}>}
 */
export async function saveContentChanges(changes, io, { attempts = 3 } = {}) {
  const shape = validateContentPayload(changes);
  if (!shape.ok) return { ok: false, status: 400, error: shape.error };
  for (let i = 0; i < attempts; i++) {
    const { text, sha } = await io.read();
    const current = text ? JSON.parse(text) : {};
    const merged = mergeContent(current, changes);
    const check = validateContentPayload(merged);
    if (!check.ok) return { ok: false, status: 400, error: check.error };
    try {
      const { commitSha } = await io.write(JSON.stringify(merged, null, 2) + '\n', sha);
      return { ok: true, commitSha, content: merged };
    } catch (err) {
      if (err && err.code === 'CONFLICT') continue;
      throw err;
    }
  }
  return {
    ok: false,
    status: 409,
    error: '保存时恰好有其他人也在保存，请稍等几秒再点一次「保存并发布」',
  };
}
