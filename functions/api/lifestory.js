// Cloudflare Pages Function — lifestory interview actions
import { buildProbePrompt, parseProbeJson } from './_lib/lifestory-probe.js';
import { normalizeLang, langSpec, langDirective } from './_lib/lifestory-lang.js';
import { recordUsage } from './_lib/usageRecorder.js';
import { CHAT_ENDPOINT, modelFor } from './_lib/models.js';

async function qwen(apiKey, system, user, maxTokens = 800, temp = 0.7, onUsage) {
  const res = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // No env override here: this helper is module-level and never receives env.
      model: modelFor('lifestory'),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature: temp,
      // Qwen3 在 DashScope 上默认开启混合思考模式。开着的话模型会先生成一大段
      // 推理链，而**本端点只读 message.content，推理内容被直接丢弃**——
      // 等于花钱买了扔掉，还把响应拖慢好几倍。
      // 2026-08-25 实测：这个 helper 一次 max_tokens=100 的衔接语调用要 17.6 秒。
      // 两个流式端点早就关了，四个非流式的一直漏着。
      enable_thinking: false,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `API ${res.status}`);
  // 用量回调：这个 helper 是模块级的、拿不到 context，所以由调用方注入
  if (typeof onUsage === 'function') onUsage(data.usage);
  return data.choices[0].message.content.trim();
}

// 2026-08-19 删掉了 action === 'analyze' 分支与它的 SYS_ANALYZE。
// 它是两步走的旧设计（先分析、再决定下一题），后来被 probe 取代（一次调用
// 同时拿回分析与追问）。865a8d7 删掉了前端的 callAnalyze，但只删了一半，
// 服务端分支留了下来，此后一年多零调用者。
// 留着的代价是实打实的：它自带一份分析提示词，而活着的那份（_lib/lifestory-probe.js）
// 后来长出了整块访谈规则；2026-08-19 加语言指令时也只有活的那份跟上了——
// 改活的那份时根本不会想起还有一份死的。未知 action 走末尾的 400，行为干净。
const bridgeSys = (lang) =>
  '你负责生成访谈中的衔接语：读取用户的上一条回答，生成一句连接到下一个问题的过渡句。\n' +
  '规则：\n' +
  `· 只输出一句话，长度 ${langSpec(lang).bridgeLen}\n` +
  '· 从用户回答的具体内容出发（细节、关键词、感受），不要泛泛而谈\n' +
  '· 自然引向下一个问题涉及的主题方向，但不要直接重复问题本身\n' +
  '· 语气克制平实，禁止"太棒了""你真的很勇敢""谢谢你的分享"之类奉承或煽情语\n' +
  '· 只输出这一句话，不要解释，不要换行，不要引号' +
  langDirective(lang);

const storySys = (lang) =>
  '你是传记整理员，将访谈问答整理成第一人称自述文章。\n\n' +
  '═══ 风格规则 ═══\n' +
  '· 写法：白描，纪录片解说词式，克制，不煽情，不渲染\n' +
  '· 语言：口语化短句，像普通人写流水账日记，不是高考作文\n' +
  '· 不用比喻句、排比句、形容词堆砌\n' +
  '· 绝对禁止：时光荏苒、岁月如歌、命运的齿轮、命运的安排、筑梦、逐梦、开启新篇章等一切文学氛围修饰语\n\n' +
  '═══ 事实铁律（最高优先级）═══\n' +
  '1. 只写受访者明确说出的事实，只用他们亲口使用的词\n' +
  '2. 受访者没有提到的人名、地名、职业、机构——一律不得出现\n' +
  '3. 推断、猜测、联想、补全——全部禁止\n' +
  '4. 某个维度没有信息则保持空白，完全不写\n\n' +
  '═══ 结构要求 ═══\n' +
  `· 用 ## 分隔章节，${langSpec(lang).chapterLen}\n` +
  `· ${langSpec(lang).storyLine}，直接开始，不写序言和后记\n` +
  '· 篇幅由素材决定，素材少则写短' +
  langDirective(lang);

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 用量记录回调：本文件的 qwen() 是模块级 helper，拿不到 context，所以在这里注入。
  // 一次请求可能调用多次（分析/追问/衔接/成稿），每次都单独计入。
  const rec = (usage) =>
    recordUsage({
      task: 'lifestory',
      usage,
      idToken: context.data?.idToken,
      waitUntil: context.waitUntil?.bind(context),
    });

  const apiKey = env.QWEN_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: '未配置 API Key' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: '请求格式错误' }), {
      status: 400,
    });
  }

  const { action } = body;
  // 界面语言。认不出就回落 zh —— 这是不可信输入，不能直接拼进提示词。
  const lang = normalizeLang(body.lang);
  const h = { 'Content-Type': 'application/json' };

  try {
    if (action === 'probe') {
      const { question, answer, recentHistory = [], knownTags = [] } = body;
      if (!question || !answer) {
        return new Response(JSON.stringify({ error: '缺少 question/answer' }), {
          status: 400,
          headers: h,
        });
      }
      const raw = await qwen(
        apiKey,
        '你是访谈分析与追问系统，严格按用户消息的要求只输出 JSON。',
        buildProbePrompt(question, answer, recentHistory, knownTags, lang),
        500,
        0.5,
        rec,
      );
      const result = parseProbeJson(raw);
      return new Response(JSON.stringify(result), { headers: h });
    }

    if (action === 'bridge') {
      const { lastAnswer, nextQuestion } = body;
      if (!lastAnswer || !nextQuestion) {
        return new Response(JSON.stringify({ error: '缺少 lastAnswer/nextQuestion' }), {
          status: 400,
          headers: h,
        });
      }
      const bridge = await qwen(
        apiKey,
        bridgeSys(lang),
        `用户刚才的回答：\n${lastAnswer}\n\n即将提出的下一个问题：\n${nextQuestion}\n\n请输出衔接语：`,
        100,
        0.6,
        rec,
      );
      return new Response(JSON.stringify({ bridge: bridge.trim() }), {
        headers: h,
      });
    }

    if (action === 'story') {
      const { answers } = body;
      if (!answers?.length) {
        return new Response(JSON.stringify({ error: '缺少 answers' }), {
          status: 400,
          headers: h,
        });
      }
      const qaText = answers
        .map((a) =>
          a.privacy
            ? `问：${a.question}\n答：[用户选择不分享]`
            : `问：${a.question}\n答：${a.answer}`,
        )
        .join('\n\n');
      const story = await qwen(
        apiKey,
        storySys(lang),
        `以下是受访者亲口说出的所有信息。请严格基于这些内容撰写，禁止添加任何未提及的细节。标记为 [用户选择不分享] 的部分保持空白。\n\n${qaText}`,
        3000,
        0.5,
        rec,
      );
      return new Response(JSON.stringify({ story }), { headers: h });
    }

    return new Response(JSON.stringify({ error: '未知操作' }), {
      status: 400,
      headers: h,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: h,
    });
  }
}
