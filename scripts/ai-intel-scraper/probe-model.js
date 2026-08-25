// 用一次真实调用探一个模型：能不能用、多快、推理 token 占多少、
// 接不接受 enable_thinking:false。
//
// ── 为什么要有这个 ──────────────────────────────────────────────────────────
// 2026-08-25 这一天，「换模型 / 加参数」这件事失败了四次，每次的代价都是
// 一整轮 push → 镜像 → 部署 → 作者手动点一次 → 读日志：
//   1. strong 换成 2.4t-a95b     → 交互端点 502（模型太慢）
//   2. 怀疑浏览器扩展            → 排除，白花一轮
//   3. 关思考只改了 functions/api → 爬虫仍然 60 秒超时
//   4. 给 a95b 传 enable_thinking → HTTP 400，这个模型根本不允许关
// 四次里有三次，**一次真实调用就能提前判掉**。
//
// 根本问题不是判断力，是**没有一条便宜的验证路径**：所有假设都只能走生产链路，
// 于是每个假设都要花掉作者一次点击。这个脚本就是那条便宜的路径。
//
// 用法：
//   node probe-model.js --model qwen3.8-27b
//   node probe-model.js --model qwen3.8-27b --no-thinking-off   # 不传那个参数
//   node probe-model.js --model a --model b                     # 一次比几个

const PROMPT = '用一句话说明：为什么冗余的备份策略比单一备份更可靠？';
const TIMEOUT_MS = 90000;

/** 解析参数。纯函数，可单测。 */
function parseArgs(argv) {
  const out = { models: [], thinkingOff: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--model') {
      const v = argv[++i];
      if (!v) return { ...out, error: '--model 后面要跟模型名' };
      out.models.push(v);
    } else if (argv[i] === '--no-thinking-off') {
      out.thinkingOff = false;
    }
  }
  if (!out.models.length) return { ...out, error: '必须指定至少一个 --model' };
  return out;
}

/**
 * 把一次探测结果读成结论。纯函数，可单测。
 *
 * 三种结局要分开，因为它们指向完全不同的处理：
 *   - rejects_flag  模型不允许关思考（a95b 就是），这个项目里不能用
 *   - thinking_on   接受了参数但仍在产推理，说明参数没起作用
 *   - ok            可用
 */
function verdict({ status, providerMessage, usage, thinkingOff }) {
  if (status === 400 && /enable_thinking/i.test(providerMessage || '')) {
    return {
      kind: 'rejects_flag',
      note: '该模型不允许关闭思考 —— 推理 token 无法避免，而我们只读 content，纯浪费',
    };
  }
  if (status !== 200) {
    return { kind: 'error', note: `HTTP ${status}：${providerMessage || '(无响应体信息)'}` };
  }
  const out = usage?.completion_tokens || 0;
  const reasoning = usage?.completion_tokens_details?.reasoning_tokens || 0;
  const ratio = out > 0 ? reasoning / out : 0;
  if (thinkingOff && ratio > 0.2) {
    return {
      kind: 'thinking_on',
      note: `传了 enable_thinking:false 但推理仍占 ${(ratio * 100).toFixed(0)}% —— 参数没生效`,
    };
  }
  return { kind: 'ok', note: `推理占比 ${(ratio * 100).toFixed(0)}%` };
}

module.exports = { parseArgs, verdict, PROMPT, TIMEOUT_MS };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

async function main() {
  const axios = require('axios');
  const { loadModelConfig } = require('../_lib/model-config');
  const { describeCallError } = require('../_lib/llm-retry');

  const args = parseArgs(process.argv.slice(2));
  if (args.error) {
    console.error(args.error);
    console.error('用法：node probe-model.js --model qwen3.8-27b [--no-thinking-off]');
    process.exit(1);
  }
  const { CHAT_ENDPOINT } = await loadModelConfig();
  console.log(
    `探测 ${args.models.length} 个模型，${args.thinkingOff ? '传' : '不传'} enable_thinking:false\n`,
  );

  let bad = 0;
  for (const model of args.models) {
    const body = { model, messages: [{ role: 'user', content: PROMPT }], max_tokens: 200 };
    if (args.thinkingOff) body.enable_thinking = false;

    const t0 = Date.now();
    let status;
    let providerMessage = '';
    let usage = null;
    try {
      const res = await axios.post(CHAT_ENDPOINT, body, {
        headers: {
          Authorization: `Bearer ${process.env.QWEN_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: TIMEOUT_MS,
      });
      status = res.status;
      usage = res.data?.usage;
    } catch (err) {
      status = err.response?.status ?? 0;
      providerMessage = describeCallError(err);
    }
    const ms = Date.now() - t0;
    const v = verdict({ status, providerMessage, usage, thinkingOff: args.thinkingOff });
    const mark = v.kind === 'ok' ? '✓' : '✗';
    console.log(`${mark} ${model}`);
    console.log(`    ${(ms / 1000).toFixed(1)} 秒 · ${v.kind} · ${v.note}`);
    if (usage) {
      console.log(
        `    输入 ${usage.prompt_tokens ?? '?'} / 输出 ${usage.completion_tokens ?? '?'}` +
          `（推理 ${usage.completion_tokens_details?.reasoning_tokens ?? 0}）`,
      );
    }
    console.log('');
    if (v.kind !== 'ok') bad++;
  }

  console.log(bad === 0 ? '全部可用' : `${bad} 个不可用`);
  if (bad > 0) process.exit(1);
}
