// 文档分析提示词的规则守护测试。
//
// 这段提示词已改写三次，每次都可能不小心删掉上一次加的硬规则。作者 2026-08-11
// 明确要求两条：① 找到关键信息必须列出来源 ② 确实找不到就说找不到、千万不要猜。
// 这里把它们钉住——不是测"模型会不会遵守"（那要实跑），而是测"这些指令还在不在"。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnalysisSystemPrompt,
  buildAnalysisUserMessage,
  buildQuestionTail,
  buildRoundTail,
} from '../functions/api/_lib/buildAnalysisPrompt.js';

const Q = '华为处置子公司荣耀产生的利润，对财务报表有多大影响';

test('两态确实分叉：有提问不强制通用结构，无提问才要概览表', () => {
  const withQ = buildAnalysisSystemPrompt(Q);
  const noQ = buildAnalysisSystemPrompt('');

  assert.ok(withQ.includes('开门见山'), '针对性模式应要求开门见山');
  assert.ok(withQ.includes('不追求大而全'), '针对性模式应明确不追求大而全');
  assert.ok(
    withQ.includes('**不要**输出【关键指标概览】总表'),
    '针对性模式必须明确禁止那张总表——正是它把具体问题挤成了脚注',
  );

  assert.ok(noQ.includes('【关键指标概览】Markdown 表格'), '综合模式应保留概览表');
  assert.ok(!noQ.includes('开门见山'), '综合模式不该带针对性模式的指令');
});

// 作者要求 ①：找到就列来源
test('两态都要求给出来源，且要求覆盖"关键信息"而不只是数字', () => {
  for (const p of [buildAnalysisSystemPrompt(Q), buildAnalysisSystemPrompt('')]) {
    assert.ok(p.includes('每一条关键信息都要标注来源'), '必须要求关键信息都带来源，不能只限于数字');
    assert.ok(p.includes('（文件N·章节名或表名）'), '必须给出来源格式');
    assert.ok(p.includes('给不出来源的信息不要写'), '必须堵住"说不清哪来的就别写"这个口子');
  }
});

// 作者要求 ②：找不到就说找不到，千万不要猜
test('两态都禁止用推测填补数据缺口，并逐条列出被禁的说法', () => {
  for (const p of [buildAnalysisSystemPrompt(Q), buildAnalysisSystemPrompt('')]) {
    assert.ok(p.includes('禁止用推测填补数据缺口'), '必须有这条禁令');
    // 泛泛地说"不要猜"没用，得把具体措辞列出来
    for (const phrase of ['可能是', '极有可能', '通常包含', '按惯例']) {
      assert.ok(p.includes(phrase), `应把「${phrase}」这类填空写法明确列为禁止`);
    }
    assert.ok(
      p.includes('是一个完整、合格的回答'),
      '必须明确"找不到"本身就是合格答案，否则模型会凑长度',
    );
  }
});

// 真实违规案例：模型写出了"2020年出售荣耀"，而那个事实不在上传的年报里
test('明确禁止使用外部知识，并保留那个真实反面例子', () => {
  const p = buildAnalysisSystemPrompt(Q);
  assert.ok(p.includes('禁止使用你自己知道的任何外部事实'), '必须禁止外部知识');
  assert.ok(p.includes('2020年出售荣耀'), '应保留这个真实反面例子——具体案例比抽象禁令更能约束模型');
});

// 复刻作者的人工分析方法（行项目 → 附注 → 同一行项目跨年对比）。
// 关键点：同一附注编号在不同年度可能解释不同事项——2024 年报的
// 「处置子公司及业务形成的金融工具的公允价值变动」归因于出售荣耀业务，
// 2025 年报同一行归因于出售服务器业务，是两件事。
test('针对性模式教会"追查附注 + 跨年对比"的方法', () => {
  const p = buildAnalysisSystemPrompt(Q);
  assert.ok(p.includes('金额在附注里，不在正文'), '必须提示答案通常在附注而非正文');
  assert.ok(p.includes('必须去读对应附注'), '必须要求跟进附注引用');
  assert.ok(
    p.includes('可能解释的是不同事项'),
    '必须警告同一附注编号跨年含义会变——这是本案例的关键',
  );
  assert.ok(p.includes('服务器业务'), '应保留真实对照案例（荣耀 vs 服务器业务）');
  assert.ok(
    p.includes('不等于那一年没有相关影响'),
    '必须堵住"该年附注没提到关键词就答未披露"这个错法',
  );
  assert.ok(p.includes('以行项目名称对齐'), '应说明跨年对齐要按行项目名而非附注编号');
});

// PDF 表格抽取后行名与数字被拆成两段，这是本案例里最容易读错数的地方
test('针对性模式提醒表格抽取后行名与数字会错位', () => {
  const p = buildAnalysisSystemPrompt(Q);
  assert.ok(p.includes('行名和数字常常被拆成两段'), '必须提醒这个抽取特性');
  assert.ok(p.includes('按顺序位置对齐'), '必须给出对齐方法');
  assert.ok(p.includes('用附注文字交叉验证'), '必须要求交叉验证读数');
  assert.ok(p.includes('表示该年为零/无'), '必须说明「–」的含义，否则会被当成缺失数据');
  assert.ok(p.includes('不要猜数字'), '无法对齐时必须禁止猜数字');
});

test('综合模式不夹带针对性模式的追查方法（避免两态混淆）', () => {
  const noQ = buildAnalysisSystemPrompt('');
  assert.ok(!noQ.includes('金额在附注里，不在正文'), '综合模式不该带这套追查指令');
});

test('保留"文件没有"与"我没看到"的区分', () => {
  for (const p of [buildAnalysisSystemPrompt(Q), buildAnalysisSystemPrompt('')]) {
    assert.ok(p.includes('绝不要把"我没看到"写成"文件未披露"'), '这条区分必须保留');
  }
});

test('综合模式也受"不许为填满结构而推测"约束', () => {
  const noQ = buildAnalysisSystemPrompt('');
  assert.ok(
    noQ.includes('不要为了填满结构而推测'),
    '综合模式的固定小节最容易诱发推测，必须单独堵一次',
  );
});

// 缓存约束：文档必须在问题之前，否则同一批文档追问时前缀变化、缓存失效，
// 追问成本从约 0.4 元回升到约 1.5 元。
test('user 消息把文档放在问题之前（隐式缓存前缀不变）', () => {
  const msg = buildAnalysisUserMessage('【文件1：年报.pdf】内容内容', Q);
  const iDoc = msg.indexOf('年报.pdf');
  const iQ = msg.indexOf(Q);
  assert.ok(iDoc !== -1 && iQ !== -1, '文档与问题都应出现在消息里');
  assert.ok(iDoc < iQ, '文档必须在问题之前——否则隐式缓存前缀改变，同一批文档追问的成本会翻几倍');
});

test('user 消息在有提问时重申来源与不猜的要求', () => {
  const msg = buildAnalysisUserMessage('文档', Q);
  assert.ok(msg.includes('每条关键信息都要带来源'));
  assert.ok(msg.includes('不要猜'));
});

test('无提问时 user 消息不塞入空的问题块', () => {
  const msg = buildAnalysisUserMessage('文档', '');
  assert.ok(!msg.includes('本次必须回答的问题'), '未提问时不该出现问题块');
});

// 图像路径把问题块作为多模态数组的最后一个 text part 追加在图片之后，用的是
// buildQuestionTail(question, 'image')。它必须指向**页面图像**：图像路径没有
// 【命中最强片段】那个小节（highlights 只从文本类文件里摘），照抄文本版措辞会让
// 模型去找一个不存在的小节，而这条恰好是"下结论说查不到之前先看完"的关键指令。
test('图像模式的问题块指向页面图像，不提不存在的【命中最强片段】', () => {
  const tail = buildQuestionTail(Q, 'image');
  assert.ok(tail.includes('逐页看完上面的页面图像'), '图像模式应要求逐页看图');
  assert.ok(
    !tail.includes('【命中最强片段】'),
    '图像模式不该提【命中最强片段】——那个小节在图像路径里不存在',
  );
  assert.ok(tail.includes('表格里的每一行'), '答案在表格里，应明确要求逐行看');
});

test('文本模式的问题块仍指向【命中最强片段】', () => {
  const tail = buildQuestionTail(Q, 'text');
  assert.ok(tail.includes('【命中最强片段】'));
  assert.ok(!tail.includes('页面图像'));
  assert.equal(buildQuestionTail(Q), tail, '默认应为文本模式');
});

// 两种模式都不能丢掉作者那两条硬要求——问题块是它们最后一次出现的位置
test('两种模式都保留"带来源"和"不要猜"', () => {
  for (const mode of ['text', 'image']) {
    const tail = buildQuestionTail(Q, mode);
    assert.ok(tail.includes('每条关键信息都要带来源'), `${mode} 模式丢了来源要求`);
    assert.ok(tail.includes('不要猜'), `${mode} 模式丢了不要猜`);
    assert.ok(tail.includes(Q), `${mode} 模式没带上提问本身`);
  }
});

// 文本路径的 user 消息必须和问题块保持同一份定义，否则改了一处忘了另一处
test('文本路径的 user 消息末尾就是文本模式问题块（同一份定义）', () => {
  const msg = buildAnalysisUserMessage('文档', Q);
  assert.ok(msg.endsWith(buildQuestionTail(Q, 'text')), '两处应共用同一份问题块定义');
});

/* ── 多轮取页态（Task 4）───────────────────────────────────────────────────
 * 多轮把请求次数乘以 5，任何被悄悄删掉的硬规则都会被放大 5 倍。所以这一组的第一条
 * 就是"不传 multiRound 时与今天逐字节相同"——单轮路径是已知可用的，不许有任何回归。
 *
 * 第二条同样重要且更隐蔽：**system prompt 必须逐轮逐字节相同**。隐式缓存按请求前缀
 * 匹配，system 排在最前面，它一变整个前缀就失配。早先这里写了「第 N/5 轮」，导致
 * 页面索引那 1.4 万 token 每轮全价重付，缓存一次都没命中（命中价是原价的 1/8）。
 */

test('不传 multiRound 时与今天逐字节相同——单轮路径不许有回归', () => {
  assert.equal(buildAnalysisSystemPrompt(Q), buildAnalysisSystemPrompt(Q, {}));
  assert.equal(buildAnalysisSystemPrompt(''), buildAnalysisSystemPrompt('', {}));
  const single = buildAnalysisSystemPrompt(Q);
  assert.ok(!single.includes('NEED_PAGES'), '单轮态不该出现取页指令');
  assert.ok(!single.includes('页面索引'), '单轮态不该提页面索引');
});

test('★ system prompt 逐轮逐字节相同——轮次号一进来就毁掉整个缓存前缀', () => {
  const p = buildAnalysisSystemPrompt(Q, { multiRound: true });
  assert.ok(!/第\s*\d+\s*\/\s*\d+\s*轮/.test(p), `system 里不许出现轮次号：${p.slice(900, 1100)}`);
  assert.ok(!p.includes('最后一轮'), 'system 里不许出现最后一轮的措辞——那也是逐轮变化的');
});

test('多轮态保留全部四条硬规则（多轮不是删规则的借口）', () => {
  const p = buildAnalysisSystemPrompt(Q, { multiRound: true });
  assert.ok(p.includes('禁止使用你自己知道的任何外部事实'), '缺：禁用外部知识');
  assert.ok(p.includes('每一条关键信息都要标注来源'), '缺：必须给来源');
  assert.ok(p.includes('禁止用推测填补数据缺口'), '缺：不许猜');
  assert.ok(p.includes('绝不要把"我没看到"写成"文件未披露"'), '缺：区分没有与没看到');
  for (const banned of ['可能是', '极有可能', '按惯例']) {
    assert.ok(p.includes(banned), `被禁说法清单里缺：${banned}`);
  }
});

test('多轮态说清索引不是全文，并给出索要页面的格式', () => {
  const p = buildAnalysisSystemPrompt(Q, { multiRound: true });
  assert.ok(p.includes('不是全文'), '必须说清索引只是每页开头');
  assert.ok(p.includes('NEED_PAGES'), '必须给出索要指令');
});

// 最有价值的一条：把 prompt 里给模型看的**那个示例**真的喂给解析器。
// 两边的契约靠这条锁死，不靠人记得同步——示例改了而解析器没改（或反过来），
// 循环会安静地永远解析不出页码，然后每次都空转到轮数上限。
test('prompt 里的示例能被 parsePageRequest 真正解析出来（跨模块契约）', async () => {
  const { parsePageRequest } = await import('../js/shared/parse-page-request.js');
  const p = buildAnalysisSystemPrompt(Q, { multiRound: true });
  const lines = p.split('\n').filter((l) => l.includes('NEED_PAGES') && /\d/.test(l));
  assert.ok(lines.length > 0, 'prompt 里应有带页码的 NEED_PAGES 示例');
  for (const line of lines) {
    const r = parsePageRequest(line, 3, [148, 148, 148]);
    assert.equal(r.done, false, `解析器认不出 prompt 里的示例：${line}`);
    assert.ok(r.requests.length > 0, `示例解析出空请求：${line}`);
  }
});

test('多轮态要求只用 p 后面那个数索要页面（印刷页码是陷阱）', () => {
  // 索引给的是 `p86 (印刷84)`，两个数都是合法页码，取错页事后无从发现。
  const p = buildAnalysisSystemPrompt(Q, { multiRound: true });
  assert.ok(p.includes('印刷'), '必须提到印刷页码的存在');
  assert.ok(/只.*p\b|p 后面|不要用印刷/.test(p), `必须讲清索要时用哪个数，实际：${p}`);
});

test('多轮态要求引文标页码，且结转的是引文不是结论', () => {
  const p = buildAnalysisSystemPrompt(Q, { multiRound: true });
  assert.ok(p.includes('p86') || p.includes('·p'), '来源格式里应含页码形态');
  // 这里曾经写成 /原文|引文|原句/ —— 太松：删掉「摘原文，不要只写结论」那句后，
  // 段落别处还有「摘录原文」，正则照样匹配，突变验证当场露馅。断言要贴**对比本身**。
  assert.ok(p.includes('摘录原文'), '必须要求摘录原文');
  assert.ok(p.includes('不要只写结论'), '必须点明"不是写结论" —— 这是结转规则的全部意义');
});

test('无提问时不进入多轮——综合分析没有可追查的问题', () => {
  const p = buildAnalysisSystemPrompt('', { multiRound: true });
  assert.ok(p.includes('关键指标概览'), '应仍是综合分析形态');
  assert.ok(!p.includes('NEED_PAGES'), '综合分析不该出现取页指令');
});

/* ── buildRoundTail：逐轮变化的部分，摆在用户消息最末尾 ── */

test('轮次尾巴带当前轮次与剩余轮数', () => {
  const t2 = buildRoundTail(2, 5);
  assert.ok(/第\s*2\s*\/\s*5\s*轮/.test(t2), `应含第 2/5 轮，实际：${t2}`);
  assert.ok(t2.includes('NEED_PAGES'), '非最后一轮要给出索要方式');
  assert.ok(t2.includes('ANSWER'), '非最后一轮也允许直接作答');
});

test('最后一轮必须作答，且整段不再出现 NEED_PAGES', () => {
  const last = buildRoundTail(5, 5);
  assert.ok(last.includes('ANSWER'), '最后一轮必须要求 ANSWER 作答');
  assert.ok(last.includes('不能再索要页面'), '最后一轮必须明说不能再索要');
  // 断言整段没有 NEED_PAGES —— 比"没有邀请的措辞"强得多：只要示例还在，
  // 模型就可能照着用。
  assert.ok(!last.includes('NEED_PAGES'), '最后一轮不该出现任何 NEED_PAGES');
});

test('超出上限的轮次也按最后一轮处理（别靠调用方保证 round<=maxRounds）', () => {
  const over = buildRoundTail(9, 5);
  // ⚠️ 不能只断言 includes('ANSWER') —— **普通轮次里也有 ANSWER:**，
  // 那样的断言对"是不是最后一轮"毫无分辨力（突变把 >= 改成 === 时它照样绿）。
  assert.ok(over.includes('不能再索要页面'), '越界轮次也要按最后一轮处理');
  assert.ok(!over.includes('NEED_PAGES'), '越界轮次不该还给索要格式');
});

test('轮次尾巴催收敛：明说能答就答，别为多看几页拖延', () => {
  // 实测隐患：模型可能每次都打满 5 轮。这句是 prompt 侧唯一的抑制手段。
  assert.ok(/能答就答|别.*拖延/.test(buildRoundTail(2, 5)), '缺少催收敛的措辞');
});

// 2026-08-13 基线两跑发现的两件事，这一组同时守住：
//
// ① **结论跨轮硬化**：第 2 轮模型写了"由于没有附注页，我只能报告这个数字的存在"，
//    第 3 轮却硬化成"绝大部分为政府补贴，因此存在生存级依赖"。看到的证据没增加，
//    确定性却增加了。
// ② **点名句式会被绕过**：第一版 prompt 点名禁了「这类公司通常…」「在会计实务中…」，
//    结果模型换成「在中国企业会计准则下…」、把「极有可能」换成「极大概率」，
//    违规行为一次都没少，只是换了皮。**禁行为，不禁措辞。**
test('最后一轮压硬化：区分"转述数字"与"解释数字"，判据是能否指到原文', () => {
  const last = buildRoundTail(5, 5);
  assert.ok(last.includes('转述'), '缺少"转述数字"这一侧');
  assert.ok(last.includes('解释'), '缺少"解释数字"这一侧');
  assert.ok(last.includes('未披露'), '缺少"指不到就写未披露"的替代写法');
  assert.ok(
    last.includes('不许把它悄悄去掉'),
    '缺少"前几轮的保留不许在最后一轮消失"——这是硬化的具体形态',
  );
});

// ★ 回归护栏：**这一条禁的必须是行为，不是措辞。**
// 第一版在这里点名了两个句式，模型换个句式就绕过去了。列举永远列不全，
// 而列举本身还会暗示"没列到的就可以"。
test('★ 压硬化那条必须说清"禁行为不禁措辞"，且不许退回点名句式', () => {
  const last = buildRoundTail(5, 5);
  assert.ok(last.includes('禁的是'), '必须明说禁的是什么');
  assert.ok(last.includes('不是措辞'), '必须明说不是禁措辞');
  assert.ok(/唯一的判据/.test(last), '必须给出唯一判据，否则又变成靠举例');
  // 反向：不许再出现被绕过的那种"点名句式"写法
  for (const phrase of ['这类公司通常', '在会计实务中', '在中国企业会计准则下']) {
    assert.ok(
      !last.includes(phrase),
      `不许再点名具体句式（${phrase}）——列举会被换个说法绕过，且暗示没列到的可以用`,
    );
  }
});

// 2026-08-13 第二跑的回归：最终回答只报了 2024 一期，文件2/文件4（两份 2025 年报）
// 一次都没被引用，而用户问的是"两期"。默默略过等于让用户以为你看过了。
test('最后一轮要求覆盖每一份文件与每一个期间', () => {
  const last = buildRoundTail(5, 5);
  assert.ok(last.includes('每一份文件'), '缺少逐文件覆盖的要求');
  assert.ok(last.includes('每一个期间'), '缺少逐期间覆盖的要求');
  assert.ok(/无法回答|未取到/.test(last), '要给出"没取到就明说"的写法，否则它会选择沉默');
});

test('催收敛与压硬化是两回事，别互相顶掉', () => {
  // 非最后一轮催"能答就答"，最后一轮压"别把话说满"。两条同时存在才对。
  assert.ok(/能答就答/.test(buildRoundTail(2, 5)), '非最后一轮应催收敛');
  assert.ok(!/能答就答/.test(buildRoundTail(5, 5)), '最后一轮不该再催收敛——它已经必须作答了');
  assert.ok(/唯一的判据/.test(buildRoundTail(5, 5)));
  assert.ok(!/唯一的判据/.test(buildRoundTail(2, 5)), '中间轮不必压硬化，它还会继续取证');
});

// 准则库接入后，「必须给出处」这条规则才**可能被满足**——在此之前，解释一个科目的
// 含义必然无出处可引，模型只能在"违规"和"给个没用的答案"之间选，三次实跑它每次都选违规。
test('提示词说明准则库也是一种合法出处，且不提供数字', () => {
  const p = buildAnalysisSystemPrompt(Q);
  assert.ok(p.includes('准则库'), '缺少准则库的说明');
  assert.ok(p.includes('不提供任何公司的任何数字'), '必须说清它不给数字');
  assert.ok(p.includes('（准则库·XXX）'), '必须给出引用格式');
});

test('★ 提示词点明不许越过 doesNotSay 的边界', () => {
  const p = buildAnalysisSystemPrompt(Q);
  assert.ok(p.includes('没有**说什么'), '缺少对边界的说明');
  assert.ok(p.includes('把单向规则读成双向'), '要点名这个真实犯过的错，否则边界只是一句空话');
});
