// 页面可见时长的累加器。纯逻辑、零依赖，可 node --test。
//
// 原实现（2026-08-19 之前）：visibilitychange→hidden 时算一次
// `now - startTime` 写进去，然后把 docId 置空。于是记下来的其实是
// **「到第一次切走为止的秒数」**，不是停留时长——用户切出去再回来读十分钟，
// 那十分钟一秒都不会被记下。
//
// 它不报错、字段也一直有值，只是**系统性偏小**；而且越投入的读者越容易
// 切走再切回来，所以偏得最狠的正是最该被看见的那批访问。
//
// 现在改成累加「可见」的那几段，每次切走结算一次。

export function createVisitDuration(now = () => Date.now()) {
  let visibleSince = now();
  let accumulatedMs = 0;
  let lastWrittenSec = 0;

  return {
    /**
     * 切到后台 / 页面卸载：结算当前这一段。
     * 返回应写入的秒数；**没有新增就返回 null**，调用方据此跳过写入
     * ——visibilitychange 与 pagehide 在关闭路径上可能都触发，
     * 不做这个判断就会白写一次（visits 是高频写入源，能省则省）。
     */
    hide() {
      if (visibleSince !== null) {
        accumulatedMs += now() - visibleSince;
        visibleSince = null;
      }
      const sec = Math.round(accumulatedMs / 1000);
      if (sec <= lastWrittenSec) return null;
      lastWrittenSec = sec;
      return sec;
    },

    /** 切回前台：重新开始计这一段。重复调用无副作用。 */
    show() {
      if (visibleSince === null) visibleSince = now();
    },
  };
}
