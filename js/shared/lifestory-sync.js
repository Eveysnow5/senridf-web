// 人生故事存档的服务端同步。合并逻辑在 lifestory-merge.js（纯函数、可测），
// 这里只管 IO。
//
// ── 设计约束（每一条都是踩过的坑）────────────────────────────────────────
//
// 1. **本地先行，服务端后到。** 渲染绝不等网络。页面照旧从 localStorage 起，
//    远端回来了再合并。网络慢/断/规则没配，用户看到的都和现在完全一样。
//
// 2. **失败一律吞掉。** 这是个**增量**能力：坏了应当退回"和以前一样"，
//    而不是让一个能用的工具变成不能用的。所以每条路径都 try/catch，
//    只在 console 留痕。
//
// 3. **规则没加之前它就是不工作，而且不报错。** 存档写在
//    `users/{uid}/lifestory/current`，这个路径当前的 Firestore 规则**不放行**
//    （见 docs/FIRESTORE-RULES.md）。规则只能由项目所有者在 Firebase 控制台加。
//    在那之前 pull 拿到 null、push 被拒，工具行为 == 现状。
//
// 4. **存成 JSON 字符串而不是嵌套对象。** Firestore 拒绝 undefined 字段，
//    而访谈状态里 `lastAnalysis` / `themeFilter` 这些天然会是 null/undefined；
//    整份序列化就没有这个问题，也不用担心字段名。代价是不能按字段查询——
//    我们不需要查询。
//
// 5. **时间戳用客户端时间。** 两台设备时钟不一致时，受影响的只有"当前筛选"
//    这类瞬时标量；**回答本身走并集，跟时间戳无关**，所以偏差不会造成数据丢失。

import { mergeState } from './lifestory-merge.js';

/** Firestore 单文档上限 1 MiB，留出余量。超了就不写，并且**说出来**。 */
const MAX_BYTES = 800 * 1024;

/** 攒一会儿再写：答一道题会连着触发好几次 saveState。 */
const DEBOUNCE_MS = 3000;

const SCHEMA = 1;

export function lifestoryDocPath(uid) {
  return ['users', uid, 'lifestory', 'current'];
}

/**
 * @param {object} opts
 * @param {object} opts.db        Firestore 实例
 * @param {string} opts.uid       当前用户
 * @param {object} opts.fs        firestore SDK 的 { doc, getDoc, setDoc }
 * @param {function} [opts.onError] 出错回调（只用于记录，不影响主流程）
 */
export function createLifestorySync({ db, uid, fs, onError }) {
  const note = (where, err) => {
    // 规则没配时这里每次都会响一声，这是**预期**的，不是故障。
    console.warn(`[lifestory-sync] ${where}:`, err && err.message ? err.message : err);
    try {
      onError && onError(where, err);
    } catch {
      /* 记录失败不许影响主流程 */
    }
  };

  const ref = () => fs.doc(db, ...lifestoryDocPath(uid));

  /** 读远端存档。拿不到（不存在/被拒/网络坏）一律返回 null。 */
  async function pull() {
    try {
      const snap = await fs.getDoc(ref());
      if (!snap.exists()) return null;
      const raw = snap.data();
      if (!raw || typeof raw.state !== 'string') return null;
      return JSON.parse(raw.state);
    } catch (err) {
      note('pull', err);
      return null;
    }
  }

  /** 立刻写一次。返回是否写成功（调用方不必关心）。 */
  async function pushNow(state) {
    try {
      const json = JSON.stringify(state);
      const bytes = new TextEncoder().encode(json).length;
      if (bytes > MAX_BYTES) {
        // ⚠️ 不能静默跳过：那样用户以为存上了，其实一个字没存。
        note('push', new Error(`存档 ${bytes} 字节，超过 ${MAX_BYTES} 上限，本次未上传`));
        return false;
      }
      await fs.setDoc(
        ref(),
        {
          schema: SCHEMA,
          state: json,
          // 冗余两个字段，纯粹是为了在 Firebase 控制台里一眼看得出进度，
          // 不参与任何逻辑。
          answerCount: Array.isArray(state.answers) ? state.answers.length : 0,
          updatedAt: Number(state.updatedAt) || Date.now(),
        },
        { merge: true },
      );
      return true;
    } catch (err) {
      note('push', err);
      return false;
    }
  }

  let timer = null;
  let pending = null;

  /** 防抖写入。同一次答题的连续 saveState 只会产生一次网络写。 */
  function push(state) {
    pending = state;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const s = pending;
      pending = null;
      if (s) pushNow(s);
    }, DEBOUNCE_MS);
  }

  /**
   * 删除服务端那份（用户点「重置」时）。
   *
   * ⚠️ 必须先把防抖里攒着的那次**丢掉**：不丢的话计时器会在删除之后
   * 把刚清掉的存档原样写回去，表现是「重置了一下，过三秒它自己回来了」。
   * 这个竞态只在删除路径上存在，而删除路径平时没人走，最容易漏。
   */
  async function clear() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
    try {
      await fs.deleteDoc(ref());
      return true;
    } catch (err) {
      note('clear', err);
      return false;
    }
  }

  /** 立刻把攒着的那次写出去（页面要走了的时候用）。 */
  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const s = pending;
    pending = null;
    if (s) return pushNow(s);
    return Promise.resolve(false);
  }

  return { pull, push, pushNow, clear, flush, mergeState };
}
