const pptxgen = require('pptxgenjs');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'AI WorkMate';
pptx.company = 'SoftStone';
pptx.title = 'AgentOS 企业级智能体平台技术架构';
pptx.subject = 'WorkMate AgentOS';
pptx.lang = 'zh-CN';
pptx.theme = { headFontFace: 'Microsoft YaHei', bodyFontFace: 'Microsoft YaHei', lang: 'zh-CN' };

const C = {
	ink: '182333', sub: '657183', red: 'C90008', red2: 'E0212B',
	blue: 'EEF2FB', blueLine: 'C6D1E7', green: '6DBD00', greenDark: '4B9000',
	greenBg: 'EDF8DF', orange: 'EFA318', orangeBg: 'FFF6DF', white: 'FFFFFF',
	line: 'CBD3DF', foundation: 'F2F5FF', foundationLine: 'AFC0ED'
};
const slide = pptx.addSlide();
slide.background = { color: C.white };

function text(value, x, y, w, h, options = {}) {
	slide.addText(value, { x, y, w, h, margin: 0, fit: 'shrink', valign: 'mid', fontFace: 'Microsoft YaHei', color: C.ink, ...options });
}
function box(x, y, w, h, fill, line = C.line, radius = 0.05, width = 0.7) {
	slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: radius, fill: { color: fill }, line: { color: line, width } });
}
function status(label, x, y, planned = false) {
	box(x, y, 0.53, 0.18, planned ? 'F5F7F9' : 'FFF8F8', planned ? 'D3D9E1' : 'FFADB3', 0.08, 0.45);
	text(label, x, y + 0.015, 0.53, 0.12, { fontSize: 5.7, color: planned ? '808995' : C.red2, bold: true, align: 'center' });
}
function card(x, y, w, h, title, lines, planned = false, fill = C.white, line = C.line, bodySize = 7.3) {
	box(x, y, w, h, fill, line, 0.05, 0.7);
	text(title, x + 0.12, y + 0.10, w - 0.82, 0.20, { fontSize: 10.2, bold: true });
	status(planned ? '规划中' : '已完成', x + w - 0.66, y + 0.10, planned);
	text(lines.map(item => `•  ${item}`).join('\n'), x + 0.12, y + 0.36, w - 0.24, h - 0.42, { fontSize: bodySize, color: C.sub, valign: 'top', breakLine: true, paraSpaceAfterPt: 2 });
}
function layer(label, no, y, h, fill = C.blue, line = C.blueLine, accent = C.red) {
	box(0.43, y, 1.18, h, fill, line, 0.06, 0.7);
	slide.addShape(pptx.ShapeType.line, { x: 0.43, y, w: 0, h, line: { color: accent, width: 3.2 } });
	text(label, 0.57, y + 0.27, 0.82, 0.25, { fontSize: 13, bold: true, align: 'center' });
	text(no, 1.38, y + 0.12, 0.18, 0.12, { fontFace: 'Arial', fontSize: 6.2, bold: true, color: accent, align: 'right' });
	text(label === '接入层' ? 'ACCESS' : label === '协同层' ? 'COLLABORATION' : label === '能力层' ? 'CAPABILITY' : label === '数据层' ? 'DATA' : label === '治理层' ? 'GOVERNANCE' : 'CORE', 0.55, y + h - 0.24, 0.9, 0.12, { fontFace: 'Arial', fontSize: 5.5, bold: true, color: C.sub, align: 'center' });
	box(1.72, y, 11.0, h, fill, line, 0.06, 0.7);
}

text('产品介绍', 0.54, 0.27, 1.3, 0.30, { fontSize: 24, bold: true });
slide.addShape(pptx.ShapeType.rect, { x: 0.43, y: 0.25, w: 0.05, h: 0.42, fill: { color: C.red }, line: { color: C.red } });
text('AGENTOS · 企业级智能体平台技术架构', 2.05, 0.35, 4.3, 0.18, { fontFace: 'Arial', fontSize: 9.5, color: C.sub, bold: true, charSpacing: 1.2 });
text('SOFTSTONE', 11.15, 0.31, 1.35, 0.18, { fontFace: 'Arial', fontSize: 13, bold: true, color: '50545A', align: 'right' });
text('数字转型新动力', 12.55, 0.34, 0.65, 0.12, { fontSize: 5.8, bold: true, color: C.red, align: 'right' });

const x = 1.82;
layer('接入层', '01', 0.88, 0.75);
card(x, 0.96, 5.23, 0.58, '企业业务系统接入', ['CRM、ERP、进销存、OA、企业门户、IM、开放 API'], false, C.white, C.line, 7.2);
card(x + 5.42, 0.96, 5.28, 0.58, '端侧与感知接入', ['工程端侧硬件、2D / 3D 摄像头、传感器、IoT 设备'], true, C.white, C.line, 7.2);

layer('协同层', '02', 1.72, 0.84);
card(x, 1.81, 3.37, 0.66, '数字员工', ['岗位 Agent、专家 Agent、管理 Agent', '按角色理解目标并执行任务']);
card(x + 3.55, 1.81, 3.37, 0.66, '人类员工', ['人工确认、审批、接管与反馈', '关键节点保留责任边界']);
card(x + 7.10, 1.81, 3.60, 0.66, '群体协同', ['人机协作、Agent 团队、群聊与任务分派', '跨部门共享上下文与成果'], true, C.white, C.line, 6.8);

layer('能力层', '03', 2.65, 0.84);
card(x, 2.74, 2.48, 0.66, '工具', ['MCP Toolsets、Builtin Tools', '企业系统与外部服务调用'], false, C.white, C.line, 6.7);
card(x + 2.65, 2.74, 2.48, 0.66, '技能', ['Skills、岗位技能、用户定义 Function', '沉淀可复用工作方法'], false, C.white, C.line, 6.6);
card(x + 5.30, 2.74, 2.48, 0.66, '插件', ['扩展 Agent 的连接、处理与交付能力', '支持第三方能力接入'], false, C.white, C.line, 6.6);
card(x + 7.95, 2.74, 2.75, 0.66, 'SOP / 流程能力', ['将标准作业程序转化为可执行步骤', '支持任务拆解与流程复用'], true, C.white, C.line, 6.4);

layer('数据层', '04', 3.58, 0.84, C.greenBg, 'ACD782', C.green);
card(x, 3.67, 3.38, 0.66, 'AI 数据中台', ['多模态数据、业务数据、运行数据', '治理、检索、分析与服务'], false, 'F7FCED', 'ACD782', 6.7);
card(x + 3.55, 3.67, 3.38, 0.66, '企业本体 / 业务语义', ['对象、属性、关系与统一业务口径', '连接组织、人员、项目与资产'], false, 'F7FCED', 'ACD782', 6.7);
card(x + 7.10, 3.67, 3.60, 0.66, '知识库与长期记忆', ['企业知识、案例经验、对话记忆', '支持私有化或云端知识服务接入'], false, 'F7FCED', 'ACD782', 6.7);

layer('治理层', '05', 4.51, 0.84);
card(x, 4.60, 2.48, 0.66, '权限', ['用户、角色、组织、租户与资源权限', '最小权限与隔离访问'], false, C.white, C.line, 6.6);
card(x + 2.65, 4.60, 2.48, 0.66, '审计', ['调用日志、操作留痕、结果追溯', '过程、依据与责任可查'], false, C.white, C.line, 6.6);
card(x + 5.30, 4.60, 2.48, 0.66, '策略', ['规则、审批、风险红线与人工确认', '支撑流程合规与异常升级'], true, C.white, C.line, 6.6);
card(x + 7.95, 4.60, 2.75, 0.66, '安全', ['数据安全、模型安全、工具安全', '敏感操作防护与输出检查'], false, C.white, C.line, 6.6);

layer('内核层', '06', 5.44, 0.84, C.orangeBg, 'EFC15A', C.orange);
card(x, 5.53, 3.38, 0.66, 'Agent Runtime', ['Agent 生命周期、上下文、记忆与状态', '任务规划、工具调用、消息与事件循环'], false, 'FFFDF8', 'EFC15A', 6.4);
card(x + 3.55, 5.53, 3.38, 0.66, '模型运行时', ['模型路由、推理、流式输出与多模型适配', '支持私有化部署与云端 API'], false, 'FFFDF8', 'EFC15A', 6.4);
card(x + 7.10, 5.53, 3.60, 0.66, '编排与可观测运行时', ['任务执行图、状态管理、监控、评估与故障恢复', '为上层 Agent 提供统一运行能力'], true, 'FFFDF8', 'EFC15A', 6.2);

box(0.43, 6.55, 12.28, 0.34, C.foundation, C.foundationLine, 0.05, 0.7);
status('规划中', 5.04, 6.63, true);
text('WorkMate 软件治理底座：统一模型、数据、权限、安全、审计与租户隔离', 5.70, 6.64, 5.9, 0.14, { fontSize: 8.4, bold: true, align: 'center' });
box(0.43, 6.98, 12.28, 0.34, 'FFF7F7', 'FFB0B4', 0.05, 0.7);
status('已完成', 5.28, 7.06, false);
text('天璇企业级 AI Foundation：硬件资源、算力基础设施与端侧设备底座', 5.75, 7.07, 5.8, 0.14, { fontSize: 8.4, bold: true, align: 'center' });

text('©2026 文本版权归软通动力信息技术（集团）股份有限公司所有，并保留所有权利。', 0.50, 7.42, 5.8, 0.12, { fontSize: 6.2, color: C.sub });
text('已完成', 11.30, 7.42, 0.50, 0.12, { fontSize: 6.2, color: C.red2, bold: true, align: 'right' });
text('规划中', 11.92, 7.42, 0.52, 0.12, { fontSize: 6.2, color: '808995', bold: true, align: 'right' });

pptx.writeFile({ fileName: 'HTML/workmate_architecture_editable.pptx' });
