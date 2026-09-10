// 人生故事存档的合并逻辑。**纯函数，无 IO**，所以能在 node 里直接测。
//
// 为什么需要它：访谈状态此前只在 localStorage（`lifestory_v2`）。清缓存归零、
// 换设备归零，而且出事之后**谁都救不回来**——用户花几小时讲完自己一辈子，
// 浏览器一清就没了。存到服务端之后，两边就可能各有一份，必须定合并规则。
//
// ── 不变式（这是判据，不是偏好）──────────────────────────────────────────
// **答过的问题不会变回没答。**
// 所以数组一律取并集，绝不取"较新的那一份"——后者会让另一台设备上的回答消失，
// 而那正是这次要消灭的故障。标量（当前筛选、追问计数这类瞬时 UI 状态）没有
// 这个问题，按 updatedAt 取新的即可。
//
// ⚠️ **本地未提交的草稿永远赢。** 用户正在输入框里打字的东西不受远端影响——
// 被一次后台同步抹掉正在写的答案，比数据丢失更让人当场崩溃。

/** 一条回答的去重键。同一条记录在两边应当算同一条。 */
export function answerKey(a) {
  if (!a || typeof a !== 'object') return '';
  // id + 时间戳足以标识一次写入；再带上答案正文前 64 字，
  // 是为了让"同一道题在另一台设备上答了不同内容"被当作**两条**保留下来
  // ——那确实是两次不同的回答，合并时丢掉任何一条都是数据丢失。
  const text = typeof a.answer === 'string' ? a.answer.slice(0, 64) : '';
  return [a.id ?? '', a.timestamp ?? '', text].join('|');
}

/** 数组并集，保序（先 base 后 extra），按 keyOf 去重。 */
function unionBy(base, extra, keyOf) {
  const out = [];
  const seen = new Set();
  for (const list of [base, extra]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const k = keyOf(item);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

const identity = (v) => (typeof v === 'object' ? JSON.stringify(v) : String(v));

function ts(s) {
  const v = s && s.updatedAt;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** 本地草稿里有没有真正在写的东西。 */
export function hasDraftText(s) {
  return !!(s && s.draft && typeof s.draft.text === 'string' && s.draft.text.trim());
}

/**
 * 这份存档是不是"还什么都没有"。
 * 用来判断能不能直接采用远端（清缓存/换设备之后的恢复场景）。
 */
export function isBlank(s) {
  if (!s || typeof s !== 'object') return true;
  const emptyArr = (a) => !Array.isArray(a) || a.length === 0;
  return (
    emptyArr(s.answers) &&
    emptyArr(s.usedIds) &&
    emptyArr(s.anchorsDone) &&
    !hasDraftText(s) &&
    !s.lastStory
  );
}

/**
 * 合并远端与本地。
 *
 * @param {object|null} remote 服务端那份（可能不存在）
 * @param {object|null} local  本地那份
 * @returns {object} 合并结果；两边都为空时返回 local（调用方自己兜底成 defState）
 */
export function mergeState(remote, local) {
  if (!remote || typeof remote !== 'object') return local;
  if (!local || typeof local !== 'object') return remote;

  const localNewer = ts(local) >= ts(remote);
  const newer = localNewer ? local : remote;

  return {
    ...remote,
    ...local,

    // ── 并集：这几项掉一条就是数据丢失 ──
    answers: unionBy(remote.answers, local.answers, answerKey),
    usedIds: unionBy(remote.usedIds, local.usedIds, identity),
    anchorsDone: unionBy(remote.anchorsDone, local.anchorsDone, identity),
    tags: unionBy(remote.tags, local.tags, identity),

    // ── 取大：历史题用了几次，两边都用过就该按多的算，否则会超过上限 ──
    historicalUsed: Math.max(Number(remote.historicalUsed) || 0, Number(local.historicalUsed) || 0),

    // ── 瞬时 UI 状态：按 updatedAt 取新的 ──
    followupCount: Number(newer.followupCount) || 0,
    themeFilter: newer.themeFilter ?? null,
    lastAnalysis: newer.lastAnalysis ?? null,

    // ── 成文：宁可留着也不要丢；两边都有就取新的 ──
    lastStory: newer.lastStory ?? remote.lastStory ?? local.lastStory ?? null,

    // ⚠️ 本地正在写的草稿永远赢，不看时间戳。
    draft: hasDraftText(local) ? local.draft : (newer.draft ?? local.draft ?? null),

    updatedAt: Math.max(ts(remote), ts(local)),
  };
}
