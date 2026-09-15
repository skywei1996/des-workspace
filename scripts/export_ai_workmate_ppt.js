const pptxgen = require('pptxgenjs');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'AI WorkMate';
pptx.subject = 'AI WorkMate 企业级数字员工团队';
pptx.title = 'AI WorkMate：面向企业的数字员工团队';
pptx.company = 'SoftStone';
pptx.lang = 'zh-CN';
pptx.theme = {
  headFontFace: 'Microsoft YaHei',
  bodyFontFace: 'Microsoft YaHei',
  lang: 'zh-CN'
};
pptx.defineSlideMaster({
  title: 'MASTER',
  background: { color: 'FFFFFF' },
  objects: [
    { rect: { x: 0, y: 0, w: 13.333, h: 0.03, fill: { color: 'D5D8DC' }, line: { color: 'D5D8DC' } } },
    { text: { text: 'SOFTSTONE', options: { x: 11.35, y: 0.38, w: 0.95, h: 0.2, fontFace: 'Arial', fontSize: 12, bold: true, color: '5B5B5B', margin: 0, align: 'right' } } },
    { text: { text: '数字转型新动力', options: { x: 12.36, y: 0.39, w: 0.72, h: 0.18, fontSize: 7.5, bold: true, color: 'D92929', margin: 0, fit: 'shrink' } } }
  ],
  slideNumber: { x: 12.95, y: 7.32, color: '999999', fontSize: 7 }
});

const C = { ink: '242424', muted: '666666', red: 'D92929', redDark: '771919', pink: 'FFE6E6', pink2: 'FFF7F7', line: 'D8DCE2', soft: 'FFFAFA', white: 'FFFFFF' };
const slide = pptx.addSlide('MASTER');
slide.background = { color: C.white };

function text(value, x, y, w, h, options = {}) {
  slide.addText(value, { x, y, w, h, fontFace: 'Microsoft YaHei', margin: 0, breakLine: false, fit: 'shrink', valign: 'mid', color: C.ink, ...options });
}
function box(x, y, w, h, fill, line = C.line, radius = 0.06) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: radius, fill: { color: fill }, line: { color: line, width: 0.8 } });
}
function sectionBar(x, title, number, w) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y: 1.63, w, h: 0.43, rectRadius: 0.05, fill: { color: C.red }, line: { color: C.red } });
  slide.addShape(pptx.ShapeType.ellipse, { x: x + 0.11, y: 1.70, w: 0.28, h: 0.28, fill: { color: C.red }, line: { color: C.white, width: 1.2 } });
  text(String(number), x + 0.11, 1.70, 0.28, 0.28, { fontSize: 12, bold: true, color: C.white, align: 'center' });
  text(title, x + 0.48, 1.68, w - 0.58, 0.28, { fontSize: 13, bold: true, color: C.white });
}
function chip(label, x, y, w, fill = C.white) {
  box(x, y, w, 0.34, fill, 'E5B3B3');
  text(label, x, y + 0.01, w, 0.3, { fontSize: 9, bold: true, color: C.red, align: 'center' });
}

slide.addShape(pptx.ShapeType.rect, { x: 0.22, y: 0.50, w: 0.04, h: 0.49, fill: { color: C.red }, line: { color: C.red } });
text('AI WorkMate：面向企业的数字员工团队', 0.38, 0.48, 7.7, 0.42, { fontSize: 24, bold: true });
text('连接企业知识、业务数据、工作流程与专业角色，让 AI 从辅助问答走向协同工作与任务执行', 0.4, 0.93, 7.5, 0.22, { fontSize: 9.5, color: '555555' });

slide.addShape(pptx.ShapeType.roundRect, { x: 0.40, y: 1.10, w: 12.52, h: 0.43, rectRadius: 0.04, fill: { color: C.pink }, line: { color: 'F0B7B7', width: 0.7 } });
text('核心判断', 0.53, 1.17, 0.72, 0.25, { fontSize: 8.5, bold: true, color: C.white, align: 'center', fill: { color: C.red }, margin: 0.04 });
text('AI WorkMate 不是一个单点 AI 工具，而是一支能够理解业务、协同工作并交付结果的企业级数字员工团队', 1.38, 1.15, 11.25, 0.27, { fontSize: 12, bold: true, color: C.redDark });

const cols = [0.40, 4.54, 10.28];
const widths = [3.96, 5.50, 2.64];
sectionBar(cols[0], '回到主线：企业为什么需要数字员工', 1, widths[0]);
sectionBar(cols[1], '更进一步：从问答走向完成工作', 2, widths[1]);
sectionBar(cols[2], '企业级数字员工必须可信', 3, widths[2]);
text('把零散事务整合成可衡量的产出', cols[0], 2.18, widths[0], 0.34, { fontSize: 14, bold: true, color: C.red });
text('从“它能干啥”变成“它干完了”', cols[1], 2.18, widths[1], 0.34, { fontSize: 14, bold: true, color: C.red });
text('进核心业务的前提条件', cols[2], 2.18, widths[2], 0.34, { fontSize: 14, bold: true, color: C.red });
text('◆ 企业的制度、经验和业务数据，长期分散在文档、系统和个人手中。AI WorkMate 的目标，是把这些隐性的、因人而异的工作能力组织起来，变成可理解、可协同、可交付的数字员工团队。', cols[0], 2.56, widths[0], 0.78, { fontSize: 9.2, bold: true, color: '303030', breakLine: true, valign: 'top' });
text('◆ 让 Agent 沿着清晰的工作链路，把业务目标转化为计划，把计划转化为协作，把协作转化为可复核、可交付的结果。', cols[1], 2.56, widths[1], 0.78, { fontSize: 9.2, bold: true, color: '303030', breakLine: true, valign: 'top' });
text('◆ 数据安全、流程合规、结果准确，是数字员工进入企业核心业务的三条底线。', cols[2], 2.56, widths[2], 0.78, { fontSize: 9.2, bold: true, color: '303030', breakLine: true, valign: 'top' });

box(cols[0], 3.42, widths[0], 3.58, C.soft);
text('从分散的企业信息，到统一的数字员工工作语境', cols[0] + 0.12, 3.55, widths[0] - 0.24, 0.25, { fontSize: 9, bold: true, color: C.red });
const nodes = [['企业知识', '制度 / 流程\n项目经验', 0.15, 0.62], ['业务数据', '客户 / 项目\n合同 / 指标', 2.03, 0.62], ['岗位能力', '分析 / 执行\n审核 / 管理', 0.15, 2.62], ['工作成果', '报告 / 方案\n任务 / 决策', 2.03, 2.62]];
nodes.forEach(([title, body, dx, dy]) => { box(cols[0] + dx, 3.42 + dy, 1.62, 0.63, C.white, 'E5B3B3'); text(title, cols[0] + dx, 3.52 + dy, 1.62, 0.18, { fontSize: 9, bold: true, color: C.red, align: 'center' }); text(body, cols[0] + dx, 3.72 + dy, 1.62, 0.25, { fontSize: 7.5, color: C.muted, align: 'center', breakLine: true }); });
slide.addShape(pptx.ShapeType.ellipse, { x: cols[0] + 1.55, y: 5.15, w: 0.86, h: 0.86, fill: { color: C.red }, line: { color: C.red } });
text('数字\n员工', cols[0] + 1.55, 5.31, 0.86, 0.36, { fontSize: 11, bold: true, color: C.white, align: 'center', breakLine: true });
text('理解 · 协作 · 执行', cols[0] + 0.92, 6.38, 2.1, 0.2, { fontSize: 8, color: C.muted, align: 'center' });

box(cols[1], 3.42, widths[1], 3.58, C.soft);
text('示例：重点客户经营分析', cols[1] + 0.16, 3.56, 2.5, 0.28, { fontSize: 9, bold: true, color: C.white, fill: { color: C.red }, margin: 0.05, align: 'center' });
text('“分析本季度重点客户经营情况，并形成管理层汇报”', cols[1] + 0.16, 3.98, widths[1] - 0.32, 0.3, { fontSize: 12, bold: true, color: C.ink, align: 'center' });
const tasks = [['① 理解', '识别范围、周期、维度'], ['② 规划', '拆解数据与报告任务'], ['③ 协同', '多个员工按角色推进'], ['④ 执行', '调用数据与业务工具'], ['⑤ 校验', '检查来源、口径、结论'], ['⑥ 交付', '输出报告与跟进任务']];
tasks.forEach(([title, body], i) => { const x = cols[1] + 0.16 + i * 0.87; box(x, 4.56, 0.87, 1.00, C.white, 'E6B6B6', 0); text(title, x + 0.05, 4.67, 0.77, 0.2, { fontSize: 8.5, bold: true, color: C.red, align: 'center' }); text(body, x + 0.07, 4.95, 0.73, 0.42, { fontSize: 7.2, color: C.muted, align: 'center', breakLine: true, valign: 'top' }); if (i < tasks.length - 1) text('›', x + 0.78, 4.88, 0.20, 0.25, { fontSize: 18, bold: true, color: C.red, align: 'center' }); });
text('AI WorkMate 交付的不是一个答案，而是一项有计划、有依据、有过程、有检查的完整工作。', cols[1] + 0.16, 6.15, widths[1] - 0.32, 0.48, { fontSize: 9.5, bold: true, color: C.redDark, breakLine: true, valign: 'mid' });

box(cols[2], 3.42, widths[2], 3.58, C.soft);
const trusts = [['⌁', '数据安全', '按用户、岗位、部门和任务控制访问，关键过程全程留痕。', '权限治理  ·  访问审计'], ['✓', '流程合规', '建设中：把制度、审批条件和风险红线变成可执行约束。', '规则引擎  ·  流程编排'], ['◎', '结果准确', '建设中：统一业务对象及关系，让 AI 基于企业语义和真实数据生成结果。', '企业本体  ·  结果校验']];
trusts.forEach(([icon, title, body, caps], i) => { const y = 3.58 + i * 1.12; slide.addShape(pptx.ShapeType.ellipse, { x: cols[2] + 0.15, y: y + 0.13, w: 0.47, h: 0.47, fill: { color: C.red }, line: { color: C.red } }); text(icon, cols[2] + 0.15, y + 0.20, 0.47, 0.20, { fontSize: 15, bold: true, color: C.white, align: 'center' }); text(title, cols[2] + 0.78, y + 0.13, 1.65, 0.2, { fontSize: 10.5, bold: true, color: C.red }); text(body, cols[2] + 0.78, y + 0.38, 1.62, 0.38, { fontSize: 7.4, color: C.muted, breakLine: true, valign: 'top' }); text(caps, cols[2] + 0.78, y + 0.82, 1.65, 0.16, { fontSize: 7.3, bold: true, color: C.redDark, fit: 'shrink' }); });

slide.addShape(pptx.ShapeType.roundRect, { x: 0.40, y: 7.16, w: 12.52, h: 0.42, rectRadius: 0.03, fill: { color: C.pink }, line: { color: 'F0B7B7', width: 0.7 } });
text('AI WorkMate', 0.56, 7.25, 0.88, 0.2, { fontSize: 8.5, bold: true, color: C.white, fill: { color: C.red }, align: 'center', margin: 0.03 });
text('面向企业的数字员工团队平台', 1.56, 7.25, 2.8, 0.2, { fontSize: 9, color: C.redDark });

pptx.writeFile({ fileName: 'HTML/ai_workmate_page1_editable.pptx' });