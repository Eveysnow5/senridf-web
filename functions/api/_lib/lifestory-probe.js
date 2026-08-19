// 服务端纯逻辑：拼「分析+追问」提示词、解析 LLM 输出成 {analysis, followup}。
// 零依赖，可 node --test。
import { langDirective } from './lifestory-lang.js';

const TAG_VOCAB =
  'entrepreneur startup quit_job career_change fired achievement parent_conflict family_pressure ' +
  'expectation sibling marriage divorce partner loneliness isolation friendship betrayal migration ' +
  'moved abroad cultural_shock belonging death loss grief illness health art music writing creative ' +
  'design performance study university teacher finance debt wealthy poor investment faith religion ' +
  'belief spiritual identity culture heritage fairness justice courage sacrifice risk';

export function buildProbePrompt(
  question,
  answer,
  recentHistory = [],
  knownTags = [],
  lang = 'zh',
) {
  const hist = (Array.isArray(recentHistory) ? recentHistory : [])
    .slice(-4)
    .map((a) => `问：${a.question}\n答：${a.answer}`)
    .join('\n\n');
  const known =
    Array.isArray(knownTags) && knownTags.length ? `\n已知标签：${knownTags.join('、')}` : '';
  return `你是访谈分析与追问系统。先分析受访者对当前问题的回答，再决定是否顺着回答追问一句。

【追问原则 — 像一个克制、专业的访谈者】
- 逼细节：顺着受访者刚说的具体的人/事/词，追问一个具体的东西——某一件事、某个场景、当时什么样、后来怎样、那一刻的感受。一次只问一个。
- 顺带澄清：回答含糊、跳跃、前后不清时，改问温和的澄清（时间先后、指代对象、关系），而不是深挖。
- 尊重回避：若受访者在回避（isEvasion=true），不要追问、不要在伤口上追，followup.ask 设为 false。
- 老人友好：追问要短、具体、口语，避免抽象宏大的提问。
- 克制：不奉承、不煽情，不说"你真勇敢/谢谢分享"，平实白描。
- 若回答已足够具体、或再问也问不出更多，followup.ask 设为 false。

严格输出以下 JSON（不要代码块，不要多余文字）：
{
  "tags": [],
  "year": null,
  "location": null,
  "isEvasion": false,
  "evasionType": null,
  "softLanding": null,
  "followup": { "ask": false, "question": "" }
}
tags 从以下词汇中选择：${TAG_VOCAB}

${hist ? `最近的对话：\n${hist}\n\n` : ''}当前问答：\n问：${question}\n答：${answer}${known}
${langDirective(lang)}
注意：followup.question 与 softLanding 是**直接说给受访者听的话**，必须用上面指定的语言；
tags 仍从上面那份英文词表里选，不翻译。

请分析并输出 JSON：`;
}

export function parseProbeJson(raw) {
  const safe = {
    analysis: {
      tags: [],
      year: null,
      location: null,
      isEvasion: false,
      evasionType: null,
      softLanding: null,
    },
    followup: { ask: false, question: '' },
  };
  try {
    const obj = JSON.parse(
      String(raw)
        .replace(/```(?:json)?\n?/g, '')
        .replace(/```/g, '')
        .trim(),
    );
    const fu = obj.followup && typeof obj.followup === 'object' ? obj.followup : {};
    return {
      analysis: {
        tags: Array.isArray(obj.tags) ? obj.tags : [],
        year: obj.year ?? null,
        location: obj.location ?? null,
        isEvasion: obj.isEvasion === true,
        evasionType: obj.evasionType ?? null,
        softLanding: obj.softLanding ?? null,
      },
      followup: {
        ask: fu.ask === true,
        question: typeof fu.question === 'string' ? fu.question : '',
      },
    };
  } catch {
    return { analysis: { ...safe.analysis }, followup: { ...safe.followup } };
  }
}
