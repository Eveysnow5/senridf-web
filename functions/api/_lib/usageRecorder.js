// LLM token 用量记录（Pages Functions 侧）。
//
// 为什么写 Firestore 而不是 console.log：这六个端点跑在**同事的 Cloudflare 账号**上，
// 我们看不到它们的日志。把数字写进 Firestore，作者在 Firebase 控制台/后台就能直接看
// "今天烧了多少、哪个端点烧得凶、思考模式到底开没开"。
// 目的是把额度决策从"估"换成"量"——2026-08-13 连续两次证明估算不可靠。
//
// ⚠️ 绝不能影响主流程：整段 try/catch，且尽量走 waitUntil 异步发出。
//    记录失败只在控制台留痕，用户的请求照常返回。
// ⚠️ 抄 rateLimiter.js 顶部那条血泪注释：COMMIT_URL 是要打的 HTTP 端点，
//    transform.document 必须是**资源名**（projects/… 开头）。两者传混会被
//    `if (!res.ok)` 静默吞掉——限流曾因此静默失效六周。
// ⚠️ 流式端点（analyze-stream / translate-stream）**只记调用次数**：它们原样透传
//    upstream.body，要拿 usage 就得插一层 TransformStream 逐块扫描，而那等于把
//    逐字节的工作放回 Workers 免费档 10ms CPU 预算上——2026-08-12 的 502 就是
//    这么来的。少一个数字，好过把线上端点重新推到墙上。

const FIRESTORE_PROJECT = 'senridfauthentication';
const COMMIT_URL = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents:commit`;
const DOC_BASE = `projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;

/** 按天分桶。纯函数，便于测试。 */
export function usageDocName(now = new Date()) {
  const day = now.toISOString().slice(0, 10); // 2026-08-18
  return `${DOC_BASE}/llm_usage/${day}`;
}

function num(v) {
  return Number.isFinite(v) ? v : 0;
}

/**
 * 把一次调用的 usage 转成 Firestore 的 fieldTransforms。
 * 纯函数：这里是最容易写错又最难发现的一段（写错了只是数字不动，不报错）。
 *
 * @param {string} task 端点名（translate / analyze / …），用于分端点统计
 * @param {object|null} usage 上游返回的 usage；拿不到就传 null
 */
export function usageFieldTransforms(task, usage) {
  const inc = (fieldPath, n) => ({
    fieldPath,
    increment: { integerValue: String(Math.round(n)) },
  });
  const t = [inc('calls', 1), inc(`by_task.${task}.calls`, 1)];

  // ⚠️ "没量到"和"量到 0"必须分得开，否则观测盲区会被报成"没有消耗"。
  if (!usage || typeof usage !== 'object') {
    t.push(inc('missing_usage', 1), inc(`by_task.${task}.missing_usage`, 1));
    return t;
  }

  const prompt = num(usage.prompt_tokens);
  const completion = num(usage.completion_tokens);
  const total = num(usage.total_tokens) || prompt + completion;
  const reasoning = num(usage.completion_tokens_details?.reasoning_tokens);
  const cached = num(usage.prompt_tokens_details?.cached_tokens);

  t.push(
    inc('prompt_tokens', prompt),
    inc('completion_tokens', completion),
    inc('total_tokens', total),
    inc(`by_task.${task}.total_tokens`, total),
  );
  // 只在非零时记，免得每天的文档堆一堆 0 字段
  if (reasoning > 0) {
    t.push(inc('reasoning_tokens', reasoning), inc(`by_task.${task}.reasoning_tokens`, reasoning));
  }
  if (cached > 0) t.push(inc('cached_tokens', cached));
  return t;
}

/**
 * 记录一次调用。**永不抛错、永不阻塞主流程。**
 * @param {{task:string, usage?:object|null, idToken?:string, waitUntil?:Function}} opts
 */
export function recordUsage({ task, usage = null, idToken, waitUntil }) {
  if (!task || !idToken) return; // 没 token 就写不了，静静跳过（fail-open）
  const send = fetch(COMMIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({
      writes: [
        {
          transform: {
            document: usageDocName(),
            fieldTransforms: usageFieldTransforms(task, usage),
          },
        },
      ],
    }),
  })
    .then((res) => {
      // fail-open 但**不静默**：写不进去要能看出来，否则又是一个"看起来在记录"的假象
      if (!res.ok) console.error('[usage] Firestore 写入失败', res.status);
    })
    .catch((err) => console.error('[usage] Firestore 写入异常', err.message));

  if (typeof waitUntil === 'function') waitUntil(send);
}
