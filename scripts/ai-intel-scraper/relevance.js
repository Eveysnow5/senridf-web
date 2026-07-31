// 纯逻辑：判定提示词构造 + Qwen 判定 JSON 解析兜底 + theme 白名单。无网络、无 Firebase。
const THEMES = ['companion', 'hardware', 'policy'];

// 构造单条候选的判定提示词。
function buildJudgmentPrompt(item) {
  return `你是日本 AI 市场情报分析助手。判断下面这条日本资讯是否属于以下三个主题之一，并做中文摘要。

主题定义：
- companion：介护/陪伴机器人、家用陪伴 AI、老龄照护相关机器人产品或研究。
- hardware：AI 芯片、半导体、边缘 AI、AI 计算硬件、机器人硬件。
- policy：日本政府对 AI 的支持政策/补助/战略，以及 AI 监管/规制/指针。

标题：${item.title}
链接：${item.url}
${item.raw ? `内容片段：${item.raw}` : ''}

规则：
- 若不属于以上任一主题，或是纯招聘/广告软文/无实质内容，返回 keep=false。
- 若属于，返回 keep=true，并给出 theme（只能是 companion/hardware/policy 之一）、summary_zh（1～3 句简体中文摘要，禁止日语假名）、可选 key_facts（关键数字/事实数组，每条注明来源标题）。
- 严格输出 JSON，不要代码块，不要多余文字。示例：
{"keep":true,"theme":"companion","summary_zh":"…","key_facts":["…（来源:标题）"]}
或
{"keep":false,"reason":"不属于三主题"}`;
}

// 解析模型返回的判定 JSON，坏数据一律安全兜底。
function parseJudgment(raw) {
  const fail = (reason) => ({ keep: false, theme: null, summary_zh: '', key_facts: [], reason });
  if (!raw || typeof raw !== 'string') return fail('bad_json');

  // 抽取 JSON：优先取 ```json 代码块体，否则从首个 { 到末个 } 切片。容忍前后多余文字。
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    text = fenced[1].trim();
  } else {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return fail('bad_json');
    text = text.slice(start, end + 1);
  }

  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return fail('bad_json');
  }
  if (!obj || typeof obj !== 'object') return fail('bad_json');
  if (obj.keep !== true) return fail('filtered_out');
  if (!THEMES.includes(obj.theme)) return fail('bad_json');

  const summary = typeof obj.summary_zh === 'string' ? obj.summary_zh.trim() : '';
  if (!summary) return fail('bad_json');

  const key_facts = Array.isArray(obj.key_facts)
    ? obj.key_facts.filter((x) => typeof x === 'string')
    : [];

  return { keep: true, theme: obj.theme, summary_zh: summary, key_facts, reason: '' };
}

module.exports = { THEMES, buildJudgmentPrompt, parseJudgment };
