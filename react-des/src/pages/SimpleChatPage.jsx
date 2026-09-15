import React, { useEffect, useRef, useState } from "react";

const EQUIPMENT_NAME = "一号生产线·数控加工中心 CNC-03";

const SCENARIOS = [
  {
    id: "fault",
    label: "设备故障",
    title: "生产计划异常协同",
    subtitle: "设备故障影响确认与计划重排模拟",
    accent: "rose",
  },
  {
    id: "plan",
    label: "主计划编制",
    title: "主计划编制模拟",
    subtitle: "聚焦订单、产能与交付约束的主计划评估",
    accent: "blue",
  },
];

const SendIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
  </svg>
);

const initialFaultMessage = () => ({
  id: "fault-alert",
  role: "assistant",
  content: `${EQUIPMENT_NAME} 出现故障，请问是否要确认影响和重排计划？`,
  card: "alert",
  actions: [
    { id: "assess", label: "确认影响并评估", primary: true },
    { id: "defer", label: "暂不处理" },
  ],
});

const initialPlanMessage = () => ({
  id: "plan-start",
  role: "assistant",
  content: "主计划编制需要先确认订单需求、物料与资源约束，以及交付窗口。请选择事件开始评估？",
  card: "plan-start",
  actions: [
    { id: "start-plan-assessment", label: "开始评估主计划", primary: true },
    { id: "start-from-order-change", label: "从订单变更开始" },
  ],
});

const simulationResponses = {
  assess: {
    user: "确认影响并评估",
    steps: [
      { kind: "ACTION", name: "上报设备故障处理编排", detail: "启动 handleEquipmentFaultReport，触发事件：设备故障上报" },
      { kind: "STEP 1", name: "创建故障事务并锁定资源", detail: "TransactionContext.begin()；锁定故障产线和受影响订单，防止并发计划写入" },
      { kind: "OBJECT", name: "设备 / 生产线", detail: "将设备状态置为 fault，关联产线可用产能降为 0，并创建设备故障 ChangeEvent" },
    ],
    message: {
      id: "capacity-data-confirmation",
      role: "assistant",
      content: "设备故障影响评估需要先查询产能相关数据：生产设备小时产能、预计停机时长、生产线计划负载，以及替代生产线可用产能。是否确认查询？",
      actions: [{ id: "confirm-capacity-data", label: "确认查询产能数据", primary: true }, { id: "defer-capacity-data", label: "暂不查询" }],
    },
  },
  "confirm-capacity-data": {
    user: "确认查询产能数据",
    steps: [
      { kind: "RULE", name: "权限检查", expression: "hasPermission(user, '生产计划查询') AND hasPermission(user, '产能分析')", detail: "逐项检查当前用户的角色授权，两个权限必须同时具备。", result: "生产计划查询=true，产能分析=true" },
      { kind: "RULE", name: "权限校验", expression: "production_plan_query = true AND capacity_analysis = true → ALLOW", detail: "权限条件全部成立，允许进入生产设备与产线产能数据查询。", result: "规则通过 · ALLOW" },
      { kind: "ACTION", name: "开始查询", detail: "权限校验通过后，启动查询生产设备和生产线产能数据" },
      { kind: "OBJECT", name: "生产设备", detail: "读取小时产能 80 件、预计停机 6 小时和当前故障状态" },
      { kind: "OBJECT", name: "生产线 / 资源日历", detail: "读取一号线计划负载，以及替代生产线可用产能 420 件" },
      { kind: "FUNCTION", name: "设备故障产能影响评估", expression: "lost_capacity = hourly_capacity × downtime_hours = 80 × 6 = 480 件", detail: "先计算停机窗口内的产能损失，再用 lost_capacity ÷ planned_capacity 得到影响率。", result: "impact_rate=480÷1,200=40% · risk_level=high" },
      { kind: "FUNCTION", name: "设备故障替代产能恢复评估", expression: "coverage_rate = recoverable_capacity ÷ lost_capacity = 420 ÷ 480 = 87.5%", detail: "用替代产线可承接产能覆盖故障损失，并计算仍需重排或补产的缺口。", result: "recoverable_capacity=420 · remaining_capacity_gap=480−420=60 件" },
      { kind: "RULE", name: "设备故障产能锁定规则", expression: "equipment.status = 'fault' → productionLine.capacityPerDay = 0", detail: "设备处于故障态时立即锁定关联产线产能，阻止新计划继续占用不可用资源。", result: "条件成立 · 规则通过 · capacityPerDay=0" },
    ],
    message: {
      id: "order-data-confirmation",
      role: "assistant",
      content: "产能影响与替代产能恢复已完成。订单交付风险评估还需要查询销售订单数据：受影响订单、紧急订单、承诺交付日期和当前排产时间。是否确认查询？",
      actions: [{ id: "confirm-order-data", label: "确认查询订单数据", primary: true }, { id: "defer-order-data", label: "暂不查询" }],
    },
  },
  "confirm-order-data": {
    user: "确认查询订单数据",
    steps: [
      { kind: "RULE", name: "订单数据权限检查", expression: "hasPermission(user, '订单数据查询') AND hasPermission(user, '交付风险分析')", detail: "订单明细与合同交付风险均属于受控数据，两个权限必须同时具备。", result: "订单数据查询=true，交付风险分析=true" },
      { kind: "RULE", name: "订单数据权限校验", expression: "order_query = true AND delivery_risk_analysis = true → ALLOW", detail: "权限条件全部成立，允许查询受影响订单及其承诺交付日期。", result: "规则通过 · ALLOW" },
      { kind: "ACTION", name: "开始查询订单数据", detail: "权限校验通过后，启动查询受影响订单、紧急订单和交付时间数据" },
      { kind: "OBJECT", name: "销售订单", detail: "查询受影响订单 3 单、紧急订单 1 单，以及承诺交付日期和当前排产时间" },
      { kind: "FUNCTION", name: "计算受影响计划项延期", expression: "delay_days = max(0, rescheduled_finish − promised_finish)", detail: "扫描占用故障产线的 ScheduleItem，将重排完成时间与原承诺完成时间逐项比较。", result: "affected_items=3 · max_delay_days=2 天" },
      { kind: "FUNCTION", name: "重算产线负荷", expression: "load_rate = assigned_quantity ÷ available_capacity × 100%", detail: "故障产线可用产能按 0 处理，并把可转移工单加入替代产线及修复后时间窗口重新计算。", result: "fault_line_capacity=0 · replacement_capacity=420 件" },
      { kind: "RULE", name: "检查跨事业部依赖", expression: "predecessor.completed = true AND support_task.finish ≤ required_time", detail: "检查前后工序、配套任务和跨事业部交付窗口是否全部满足。", result: "1 条依赖未满足 · 需要创建协调任务" },
      { kind: "FUNCTION", name: "识别合同交付风险", expression: "risk_days = projected_finish − contract_delivery_date", detail: "逐单比较延期后的预计完成时间与合同承诺日期，正值代表存在逾期风险。", result: "high_risk_contracts=1 · max_risk_days=2 天" },
      { kind: "RULE", name: "设备故障高产能影响预警", expression: "impact_rate ≥ 30% AND risk_level = 'high'", detail: "当前产能影响率为 40%，且风险等级为 high，两个预警条件同时成立。", result: "40% ≥ 30% · 规则命中" },
      { kind: "RULE", name: "设备故障关键订单交付风险", expression: "urgent_order_count ≥ 1 AND max_delay_days ≥ 2", detail: "当前存在 1 个紧急订单，最大预计延期为 2 天，达到关键订单风险阈值。", result: "1 ≥ 1 AND 2 ≥ 2 · 规则命中" },
      { kind: "RULE", name: "设备故障可本地消化", expression: "replacement_coverage_rate ≥ 80% AND severity ≠ 'high'", detail: "替代产能覆盖率虽达到 87.5%，但事件严重等级为 high，不满足本地消化条件。", result: "87.5% ≥ 80%，severity=high · 未命中" },
    ],
    message: {
      id: "impact-result",
      role: "assistant",
      content: "已完成产能数据和订单数据查询，以及产能、替代恢复与订单交付风险评估。",
      card: "impact",
      actions: [{ id: "replan", label: "生成重排方案", primary: true }, { id: "notify", label: "仅通知计划员" }],
    },
  },
  "defer-capacity-data": {
    user: "暂不查询产能数据",
    steps: [{ kind: "ACTION", name: "上报设备故障处理编排", detail: "暂停产能数据查询，保留 MES 设备故障告警" }],
    message: { id: "capacity-data-deferred", role: "assistant", content: "已暂停查询产能数据，暂不执行影响评估。", actions: [{ id: "restart", label: "重新开始", primary: true }] },
  },
  "defer-order-data": {
    user: "暂不查询订单数据",
    steps: [{ kind: "ACTION", name: "上报设备故障处理编排", detail: "保留产能评估结果，暂停订单数据查询" }],
    message: { id: "order-data-deferred", role: "assistant", content: "已暂停查询订单数据，暂不执行订单交付风险评估和规则判断。", actions: [{ id: "restart", label: "重新开始", primary: true }] },
  },
  defer: {
    user: "暂不处理",
    steps: [{ kind: "ACTION", name: "上报设备故障处理编排", detail: "暂停后续步骤，保留 MES 故障告警和生产设备故障状态" }],
    message: { id: "deferred", role: "assistant", content: "已保留故障告警，暂未执行影响评估。", actions: [{ id: "restart", label: "重新开始", primary: true }] },
  },
  "start-plan-assessment": {
    user: "开始评估主计划",
    steps: [
      { kind: "ACTION", name: "启动主计划编制 Harness", detail: "创建本周主计划编制任务，准备开启事务并汇聚 SAP、MES、SRM、HR 数据" },
    ],
    message: {
      id: "plan-order-data-confirmation",
      role: "assistant",
      content: "主计划需求评估需要先查询销售预测、待排产订单、库存、在制任务和历史计划。是否确认查询这些业务数据？",
      actions: [{ id: "confirm-plan-order-data", label: "确认查询订单与计划数据", primary: true }, { id: "defer-plan-order-data", label: "暂不查询" }],
    },
  },
  "start-from-order-change": {
    user: "从订单变更开始",
    steps: [
      { kind: "EVENT", name: "订单变更事件", detail: "识别新增、改期和取消订单，创建主计划重新评估任务" },
    ],
    message: {
      id: "plan-change-data-confirmation",
      role: "assistant",
      content: "订单变更会影响当前主计划。需要查询变更订单、关联订单、库存、在制任务和当前计划版本，是否确认查询？",
      actions: [{ id: "confirm-plan-order-data", label: "确认查询变更相关数据", primary: true }, { id: "defer-plan-order-data", label: "暂不查询" }],
    },
  },
  "confirm-plan-order-data": {
    user: "确认查询订单与计划数据",
    steps: [
      { kind: "STEP 1", name: "开启事务并锁定数据同步", detail: "TransactionContext.begin()；acquireLock(dataSync)，将本轮多系统数据快照存入 txContext" },
      { kind: "RULE", name: "多系统数据访问权限", expression: "SAP.read AND MES.read AND SRM.read AND HR.read → ALLOW", detail: "校验计划员对订单、生产、供应和人员数据的只读权限。", result: "4/4 数据源授权通过" },
      { kind: "RULE", name: "R009 / R010 LLM 输出校验", expression: "schema_valid = true AND ontology_entities_exist = true", detail: "规则引擎校验结构化格式以及解释引用的订单、物料和产线实体。", result: "格式有效 · 0 个虚构实体 · 等待人工审核" },
      { kind: "OBJECT", name: "销售订单 / 产品", detail: "读取 SAP 已签约订单 42 单：订单号、客户、产品、数量、交期和优先级；展开对应 BOM 与工艺路线" },
      { kind: "OBJECT", name: "生产线 / 在制品", detail: "读取 MES 三条产线状态、设备日历与 1,420 件在制任务，保留已开工订单冻结标记" },
      { kind: "OBJECT", name: "物料 / 到货计划", detail: "读取 SRM 库存、在途和到货周期；18 项关键物料中 2 项存在短缺风险" },
      { kind: "OBJECT", name: "人员 / 技能", detail: "读取 HR 班次、技能和本周可用工时，可提供 3 个弹性班次" },
      { kind: "FUNCTION", name: "主计划需求汇总评估", expression: "net_demand = signed_orders − available_inventory − WIP = 5,260 − 860 − 1,420", detail: "按订单优先级、交付周和产品类型汇总净需求。", result: "净需求 2,980 件 · 优先保障 920 件 · 峰值位于第 2 周" },
      { kind: "RULE", name: "形式化本体一致性校验", expression: "TBox_consistent AND ABox_constraints_satisfied", detail: "校验汇聚数据的类型、属性、关系及时间范围是否符合本体约束。", result: "校验通过 · 数据快照 DS-20260814-01" },
    ],
    message: {
      id: "plan-resource-data-confirmation",
      role: "assistant",
      content: "订单与计划数据已查询完成。下一步需要查询产线产能、资源日历、人员班次和关键物料齐套情况，是否确认查询？",
      actions: [{ id: "confirm-plan-resource-data", label: "确认查询资源与物料数据", primary: true }, { id: "defer-plan-resource-data", label: "暂不查询" }],
    },
  },
  "confirm-plan-resource-data": {
    user: "确认查询资源与物料数据",
    steps: [
      { kind: "STEP 2", name: "物料齐套预校验", detail: "遍历 SalesOrder → Product.requiredMaterials[]，为可排订单执行 Material.allocate(orderId, qty) 预留" },
      { kind: "FUNCTION", name: "物料可用性检查", expression: "isAvailable(requiredQty, requiredDate) = stock + inbound − allocated ≥ requiredQty", detail: "逐订单检查关键物料库存、在途到货日和已分配数量。", result: "整体齐套率 93% · 高优先级订单 100% 齐套" },
      { kind: "OBJECT", name: "物料预留记录", detail: "创建 40 个可排订单的临时物料预留，并向补偿栈压入 deallocateMaterial；2 个缺料订单标记等待物料" },
      { kind: "RULE", name: "R003 缺料不得排产", expression: "material_ready = false → exclude_from_solver", detail: "缺料订单不进入本次求解集合，并生成采购补料通知。", result: "排除 2 单 · 40 单进入求解" },
      { kind: "RULE", name: "R008 下发前必须齐套", expression: "release_plan → all_selected_orders.material_ready = true", detail: "记录下发前强制复核条件，后续规则引擎再次逐单检查。", result: "预校验通过" },
      { kind: "FUNCTION", name: "产能负荷评估", expression: "capacity_gap = peak_demand − available_capacity", detail: "结合生产线、设备、人员技能和资源日历计算四周负荷。", result: "第 2 周缺口 380 件 · 二号线可承接 260 件 · 一号线峰值 94%" },
    ],
    message: {
      id: "plan-constraint-result",
      role: "assistant",
      content: "订单、产能、资源与物料约束已评估完成。当前存在第 2 周产能峰值，但可通过跨产线调配和弹性班次消化。是否生成多个主计划候选方案？",
      card: "plan-assessment",
      actions: [{ id: "generate-plan-options", label: "生成主计划候选方案", primary: true }, { id: "restart", label: "结束本次评估" }],
    },
  },
  "generate-plan-options": {
    user: "生成主计划候选方案",
    steps: [
      { kind: "STEP 3", name: "构建 CP-SAT 求解模型", detail: "调用 MasterProductionSchedule.solveOptimization(constraints, objectives)，定义订单分配、起止时间、批次与顺序变量" },
      {
        kind: "SOLVER",
        name: "调用主计划最优解接口",
        endpoint: "POST /api/optimization/master-production-schedule/solve",
        request: "orders(40) + lines(3) + equipment + personnelSkills + calendars + materialReservations + R001-R010",
        objective: "max(交付达成率 × 0.45 + 产能均衡度 × 0.30 − 额外成本 × 0.15 − 库存占用 × 0.10)",
        detail: "Google OR-Tools CP-SAT 执行主求解，Gurobi MILP 使用同一约束独立复算；结果仅写入 txContext 临时区。",
        result: "OPTIMAL · CP-SAT 2.46s · MILP KPI 差异 1.8% · 返回 3 个可行方案",
        options: [
          "A · 均衡排产：按期率 98.6%，峰值负载 86%",
          "B · 交付优先：按期率 99.2%，峰值负载 91%",
          "C · 库存优化：按期率 96.8%，库存降低 14%",
        ],
      },
      { kind: "RULE", name: "无可行解降级策略", expression: "solver_status = INFEASIBLE → relax_soft_constraints → split_batches → defer_low_priority", detail: "若硬约束下无解，依次放宽库存目标和负荷均衡软约束、拆分生产批次、顺延低优先级订单；仍无解则回滚物料预留并转人工编制。", result: "本次未触发 · 降级链已注册" },
      { kind: "RULE", name: "独立求解器复算校验", expression: "abs(KPI_CP-SAT − KPI_MILP) ≤ 5%", detail: "比较交付率、均衡度和成本，差异超过阈值时转人工复核。", result: "最大差异 1.8% · 验证通过" },
      { kind: "FUNCTION", name: "多方案 KPI 对比", expression: "compareAlternatives(plans[A,B,C])", detail: "计算交付达成率、产能均衡度、成本、加班时长和瓶颈数量。", result: "方案 A 综合评分最高 · 推荐均衡排产" },
      { kind: "ACTION", name: "Harness 挂起事务", detail: "候选方案存入 txContext 临时区，挂起事务等待计划员选择，2 小时提醒、4 小时自动回滚" },
    ],
    message: {
      id: "plan-options",
      role: "assistant",
      content: "已完成本体关系查询、函数评估和外部最优解计算，共生成 3 个可执行方案。请查看方案差异并选择。",
      card: "plan-proposal-choice",
      actions: [{ id: "select-main-plan-a", label: "选择方案 A（推荐）", primary: true }, { id: "select-main-plan-b", label: "选择方案 B" }, { id: "select-main-plan-c", label: "选择方案 C" }],
    },
  },
  "select-main-plan-a": {
    user: "选择方案 A（推荐）",
    steps: [
      { kind: "ACTION", name: "确认方案 A · 均衡排产", detail: "Harness 恢复挂起事务，锁定计划员选择的方案 A，准备执行独立规则校验" },
      { kind: "RULE", name: "R001-R010 硬约束逐条校验", expression: "violations(selectedPlan, R001...R010) = 0", detail: "Drools 独立检查已开工订单冻结、产线互斥、物料齐套、技能、加班与 LLM 输出。", result: "10/10 规则通过 · 0 个阻断项" },
      { kind: "ACTION", name: "DeepSeek V4 生成方案解释", detail: "依据求解器变量赋值和本体实例生成排产理由：关键订单优先、260 件转移二号线、增加 2 个弹性班次" },
      { kind: "RULE", name: "方案解释受控校验", expression: "R009(schema) AND R010(entity_grounding) AND human_review", detail: "核查解释中的订单、产线、数量和日期均存在且与求解结果一致。", result: "规则通过 · 等待计划科长人工审核" },
      { kind: "STEP 7", name: "主计划下发审批门禁", detail: "ApprovalGate 由计划科长审批；4 小时未处理自动升级事业部总监" },
      { kind: "OBJECT", name: "主生产计划 / 计划项", detail: "写入方案 A：生成 MPS-20260814-V2，更新 40 个 ScheduleItem 的产线、起止时间、批次与顺序" },
      { kind: "ACTION", name: "事务化下发 SAP", detail: "锁定计划版本并写入 SAP 订单生产节点；执行前压入 undoSAPWrite 补偿操作" },
      { kind: "ACTION", name: "事务化下发 MES", detail: "下发 MES 派工单与产线顺序；执行前压入 undoMESDispatch 补偿操作" },
      { kind: "OBJECT", name: "主计划发布状态", detail: "更新计划 status=released、版本号 +1，并记录 SAP/MES 同步回执" },
      { kind: "STEP 8", name: "提交事务并通知相关方", detail: "TransactionContext.commit()，释放数据、订单与产线锁；异步通知销售、采购、生产和仓储" },
      { kind: "DASHBOARD", name: "主生产计划看板已更新", detail: "方案 A 下发结果已同步到看板，可查看订单排程、产线负荷、物料齐套和交付节点。", href: "/html/production-plan-mps-v2.html", updatedAt: "2026-08-14 15:10:36", scope: "MPS-20260814-V2 · 40 个订单 · 3 条产线 · 未来 4 周" },
    ],
    message: { id: "main-plan-a-result", role: "assistant", content: "方案 A 已完成规则校验、人工审批与事务化下发。关键订单均可按期交付，第 2 周峰值负载降至 86%。", card: "plan-execution-a", actions: [{ id: "restart", label: "重新演示", primary: true }] },
  },
  "select-main-plan-b": {
    user: "选择方案 B",
    steps: [
      { kind: "ACTION", name: "确认方案 B · 交付优先", detail: "Harness 恢复挂起事务，锁定方案 B，准备校验 3 个弹性班次和人员加班约束" },
      { kind: "RULE", name: "R001-R010 硬约束逐条校验", expression: "violations(selectedPlan, R001...R010) = 0", detail: "Drools 检查订单冻结、物料齐套、技能和最大加班工时。", result: "10/10 规则通过 · 加班需计划科长审批" },
      { kind: "ACTION", name: "DeepSeek V4 生成方案解释", detail: "解释原产线执行、提高交付率与增加人员成本之间的权衡" },
      { kind: "RULE", name: "方案解释受控校验", expression: "R009(schema) AND R010(entity_grounding) AND human_review", detail: "校验解释引用的人员、班次、订单及 KPI 与本体事实一致。", result: "规则通过 · 等待人工审核" },
      { kind: "STEP 7", name: "主计划下发审批门禁", detail: "ApprovalGate 由计划科长审批方案与加班安排；4 小时未处理升级总监" },
      { kind: "OBJECT", name: "主生产计划 / 资源日历", detail: "写入方案 B：订单保持原产线，新增 3 个弹性班次，生成 MPS-20260814-V2" },
      { kind: "ACTION", name: "事务化下发 SAP", detail: "写入订单生产节点并压入 undoSAPWrite 补偿操作" },
      { kind: "ACTION", name: "事务化下发 MES", detail: "下发派工单和新增班次并压入 undoMESDispatch 补偿操作" },
      { kind: "OBJECT", name: "主计划发布状态", detail: "更新计划 status=released、版本号 +1，并记录 SAP/MES 同步回执" },
      { kind: "STEP 8", name: "提交事务并通知相关方", detail: "TransactionContext.commit()，释放全部锁并异步通知相关岗位" },
      { kind: "DASHBOARD", name: "主生产计划看板已更新", detail: "方案 B 下发结果已同步到看板，可查看交付优先排程与弹性班次。", href: "/html/production-plan-mps-v2.html", updatedAt: "2026-08-14 15:10:36", scope: "MPS-20260814-V2 · 40 个订单 · 3 个弹性班次" },
    ],
    message: { id: "main-plan-b-result", role: "assistant", content: "方案 B 已完成规则校验、人工审批与事务化下发。订单按期率 99.2%，人员成本增加 8%。", card: "plan-execution-b", actions: [{ id: "restart", label: "重新演示", primary: true }] },
  },
  "select-main-plan-c": {
    user: "选择方案 C",
    steps: [
      { kind: "ACTION", name: "确认方案 C · 库存优化", detail: "Harness 恢复挂起事务，锁定方案 C，准备校验低优先级订单顺延约束" },
      { kind: "RULE", name: "R001-R010 硬约束逐条校验", expression: "violations(selectedPlan, R001...R010) = 0", detail: "Drools 检查冻结订单、齐套、交期及顺延订单的优先级。", result: "10/10 规则通过 · 2 个低优先级订单可顺延" },
      { kind: "ACTION", name: "DeepSeek V4 生成方案解释", detail: "解释降低提前生产量、库存占用下降 14% 与按期率 96.8% 的权衡" },
      { kind: "RULE", name: "方案解释受控校验", expression: "R009(schema) AND R010(entity_grounding) AND human_review", detail: "校验解释中的订单、库存指标和交付窗口均与本体事实一致。", result: "规则通过 · 等待人工审核" },
      { kind: "STEP 7", name: "主计划下发审批门禁", detail: "ApprovalGate 由计划科长审批顺延范围；4 小时未处理升级总监" },
      { kind: "OBJECT", name: "主生产计划 / 计划项", detail: "写入方案 C：降低提前生产量，2 个低优先级订单顺延，生成 MPS-20260814-V2" },
      { kind: "ACTION", name: "事务化下发 SAP", detail: "更新订单生产节点和交付窗口并压入 undoSAPWrite 补偿操作" },
      { kind: "ACTION", name: "事务化下发 MES", detail: "下发库存优化后的派工顺序并压入 undoMESDispatch 补偿操作" },
      { kind: "OBJECT", name: "主计划发布状态", detail: "更新计划 status=released、版本号 +1，并记录 SAP/MES 同步回执" },
      { kind: "STEP 8", name: "提交事务并通知相关方", detail: "TransactionContext.commit()，释放全部锁并异步通知相关岗位" },
      { kind: "DASHBOARD", name: "主生产计划看板已更新", detail: "方案 C 下发结果已同步到看板，可查看库存优化排程和顺延订单。", href: "/html/production-plan-mps-v2.html", updatedAt: "2026-08-14 15:10:36", scope: "MPS-20260814-V2 · 库存占用降低 14% · 2 个顺延订单" },
    ],
    message: { id: "main-plan-c-result", role: "assistant", content: "方案 C 已完成规则校验、人工审批与事务化下发。库存占用降低 14%，关键订单零延期。", card: "plan-execution-c", actions: [{ id: "restart", label: "重新演示", primary: true }] },
  },
  "defer-plan-order-data": {
    user: "暂不查询订单与计划数据",
    steps: [{ kind: "ACTION", name: "暂停主计划编制", detail: "保留当前编制任务，等待用户确认数据查询" }],
    message: { id: "plan-order-deferred", role: "assistant", content: "已暂停主计划编制。未查询订单与计划数据，不会生成候选方案。", actions: [{ id: "restart", label: "重新开始", primary: true }] },
  },
  "defer-plan-resource-data": {
    user: "暂不查询资源与物料数据",
    steps: [{ kind: "ACTION", name: "暂停约束评估", detail: "保留订单需求汇总结果，等待资源与物料查询确认" }],
    message: { id: "plan-resource-deferred", role: "assistant", content: "已保留订单需求汇总结果。由于缺少资源与物料数据，暂不生成主计划候选方案。", actions: [{ id: "restart", label: "重新开始", primary: true }] },
  },
  replan: {
    user: "生成重排方案",
    steps: [
      { kind: "STEP 2", name: "传播故障影响", detail: "扫描故障产线上的 ScheduleItem，计算延期天数、合同违约风险和跨事业部连锁影响" },
      { kind: "EVENT", name: "变更事件 / 设备故障", detail: "更新 EVT-EQUIP-20260813-001，关联故障设备、产线、受影响订单和影响报告" },
      {
        kind: "SOLVER",
        name: "调用重排运筹最优解接口",
        endpoint: "POST /api/optimization/production-plan/replan",
        request: "changeEvent + affectedOrders(3) + availableCapacity(420) + resourceCalendar + R001-R010",
        objective: "min(订单延期天数 × 0.45 + 产能缺口 × 0.30 + 额外成本 × 0.15 + 跨部门复杂度 × 0.10)",
        detail: "将转移产线、顺序重排、加班补产和跨事业部协同作为可选决策变量，提交 CP-SAT 求解器进行组合寻优。",
        result: "OPTIMAL · 计算耗时 1.28s · 搜索 36 个组合 · 返回 3 个可行方案",
        options: [
          "A · 转移产线：评分 92，关键订单延期 0 天",
          "B · 加班重排：评分 84，关键订单延期 1 天",
          "C · 跨部协同：评分 87，关键订单延期 0-1 天",
        ],
      },
      { kind: "FUNCTION", name: "主计划滚动调整", detail: "调用 MasterProductionSchedule.rollAdjust(changeEvent, txContext)，锁定已开工订单后运行 CP-SAT" },
      { kind: "ACTION", name: "策略 A · 转移产线", detail: "检查同类型空闲产线和工艺能力，优先转移紧急订单至二号生产线" },
      { kind: "ACTION", name: "策略 B · 顺序重排", detail: "在可用产线上调整订单顺序，优先保障 urgent 订单" },
      { kind: "ACTION", name: "策略 C · 加班补产", detail: "调用 Calendar.addSpecialWorkday() 与 Personnel.assignOvertime()，标记需要审批" },
      { kind: "ACTION", name: "策略 D · 跨事业部协同", detail: "调用 CoordinationTask.proposeCrossDeptSolution()，标记需要会签" },
      { kind: "RULE", name: "R001-R010 硬约束校验", detail: "校验已开工订单、设备故障、物料齐套、跨事业部依赖和 LLM 输出格式" },
      { kind: "ACTION", name: "生成候选方案", detail: "CP-SAT 返回 3 个可行方案：方案 A 转移产线、方案 B 加班重排、方案 C 跨事业部协同" },
    ],
    message: {
      id: "replan-proposal",
      role: "assistant",
      content: "已调用外部重排运筹策略最优解接口并生成 3 个重排方案，其中方案 A 为推荐方案。请对比方案指标后选择你要执行的方案。",
      card: "proposal-choice",
      actions: [{ id: "select-plan-a", label: "选择方案 A（推荐）", primary: true }, { id: "select-plan-b", label: "选择方案 B" }, { id: "select-plan-c", label: "选择方案 C" }, { id: "adjust", label: "返回调整" }],
    },
  },
  "select-plan-a": {
    user: "选择方案 A（推荐）",
    steps: [
      { kind: "ACTION", name: "方案 A 执行确认", detail: "确认执行推荐方案：优先转移紧急订单至二号生产线，并安排 2 小时加班" },
      { kind: "STEP 5", name: "人工审批门禁", detail: "ApprovalGate 由计划科长审批；方案包含加班与产线转移，审批通过后才允许写入计划" },
      { kind: "OBJECT", name: "销售订单 / 生产线", detail: "写入调整：SO-260813-018 转移至二号生产线，普通订单顺延 1 个班次" },
      { kind: "OBJECT", name: "资源日历", detail: "二号生产线增加 2 小时加班产能" },
      { kind: "FUNCTION", name: "设备故障产能影响评估", detail: "重算后 remaining_capacity_gap=60，产能约束校验通过" },
      { kind: "FUNCTION", name: "设备故障订单交付风险评估", detail: "重算后紧急订单按期，交付约束校验通过" },
      { kind: "ACTION", name: "数据回写", detail: "将重排后的计划版本 MPS-20260813-V2 回写至主生产计划系统和设备排产系统" },
      { kind: "OBJECT", name: "计划回写结果", detail: "更新成功：主生产计划已写回，变更事件 EVT-EQUIP-20260813-001 已落库" },
      { kind: "STEP 6", name: "提交事务并同步维修", detail: "TransactionContext.commit()，释放锁；同步 CMMS 维修工单，设备状态进入 maintenance" },
      {
        kind: "DASHBOARD",
        name: "生产计划安排看板已更新",
        detail: "本次主生产计划回写结果已同步到看板，可查看重排后的产线安排、工单顺序和交付节点。",
        href: "/html/production-plan-mps-v2.html",
        updatedAt: "2026-08-14 14:32:18",
        scope: "主生产计划 MPS-2026-08 · 3 个受影响订单 · 12 道工序",
      },
    ],
    message: {
      id: "execution-result-a",
      role: "assistant",
      content: "已执行推荐方案 A：紧急订单转移至二号生产线并增加加班，当前计划已满足交付约束，并已回写系统。",
      card: "exec-summary",
      actions: [{ id: "restart", label: "重新演示", primary: true }],
    },
  },
  "select-plan-b": {
    user: "选择方案 B",
    steps: [
      { kind: "ACTION", name: "方案 B 执行确认", detail: "确认执行备选方案：保留本线生产，增加临时加班并顺延非紧急订单" },
      { kind: "STEP 5", name: "人工审批门禁", detail: "ApprovalGate 由计划科长审批；交付风险较高，需确认延期 1 天可接受" },
      { kind: "OBJECT", name: "销售订单 / 生产线", detail: "维持本线优先级，紧急订单仍在一号线处理，普通订单顺延至下一班次" },
      { kind: "OBJECT", name: "资源日历", detail: "二号生产线临时加班 2 小时，提高备份产能 40 件" },
      { kind: "FUNCTION", name: "设备故障产能影响评估", detail: "重算后 remaining_capacity_gap=40，产能约束校验通过但交付风险略高" },
      { kind: "FUNCTION", name: "设备故障订单交付风险评估", detail: "重算后紧急订单延期 1 天，交付约束校验待计划员确认" },
    ],
    message: {
      id: "execution-result-b",
      role: "assistant",
      content: "已执行方案 B：保留本线生产并增加临时加班，方案可行但紧急订单存在 1 天交付风险。",
      card: "success",
      actions: [{ id: "restart", label: "重新演示", primary: true }],
    },
  },
  "select-plan-c": {
    user: "选择方案 C",
    steps: [
      { kind: "ACTION", name: "方案 C 执行确认", detail: "确认执行保守方案：跨事业部协同调度，保留关键订单交付优先级" },
      { kind: "STEP 5", name: "人工审批门禁", detail: "ApprovalGate 需要计划科长与关联事业部会签，确认协同窗口和依赖责任人" },
      { kind: "OBJECT", name: "销售订单 / 事业部计划", detail: "锁定紧急订单交付节点，将配套工序同步到协同事业部计划" },
      { kind: "OBJECT", name: "协调任务", detail: "创建跨事业部协调任务 CT-20260814-003，等待双方计划员确认" },
      { kind: "FUNCTION", name: "跨事业部协同产能评估", detail: "校验配套产线可用产能，确认依赖工序能够在承诺窗口内完成" },
      { kind: "FUNCTION", name: "设备故障订单交付风险评估", detail: "重算后最大延期 1 天，关键订单交付风险降为中" },
      { kind: "ACTION", name: "提交会签", detail: "候选方案已提交计划科长与关联事业部负责人审批，暂不自动写入生产计划" },
    ],
    message: {
      id: "execution-result-c",
      role: "assistant",
      content: "已选择方案 C：跨事业部协同方案已提交会签。审批通过后将同步更新主计划和配套工序。",
      card: "success",
      actions: [{ id: "restart", label: "重新演示", primary: true }],
    },
  },
  notify: {
    user: "仅通知计划员",
    steps: [{ kind: "ACTION", name: "高风险告警通知", detail: "生成产能与交付风险摘要" }, { kind: "OBJECT", name: "员工", detail: "通知生产计划员、设备维修负责人" }],
    message: { id: "notified", role: "assistant", content: "已向生产计划员和设备维修负责人发送高风险告警，当前计划保持不变。", actions: [{ id: "restart", label: "重新开始", primary: true }] },
  },
  execute: {
    user: "确认执行重排",
    steps: [
      { kind: "ACTION", name: "局部重排 localReplan", detail: "确认执行，锁定当前计划版本 MPS-20260813-V1" },
      { kind: "OBJECT", name: "销售订单 / 生产线", detail: "写入调整：紧急订单 SO-260813-018 转移至二号生产线" },
      { kind: "OBJECT", name: "资源日历", detail: "二号生产线增加 2 小时加班产能" },
      { kind: "FUNCTION", name: "设备故障产能影响评估", detail: "重算后 remaining_capacity_gap=60，产能约束校验通过" },
      { kind: "FUNCTION", name: "设备故障订单交付风险评估", detail: "重算后紧急订单按期，交付约束校验通过" },
      { kind: "OBJECT", name: "主生产计划", detail: "生成新版本 MPS-20260813-V2，状态：待发布" },
      { kind: "EVENT", name: "变更事件", detail: "EVT-EQUIP-20260813-001 更新为已完成，等待计划员发布" },
    ],
    message: { id: "execution-result", role: "assistant", content: "重排已完成，新计划已生成并进入待发布状态。", card: "success", actions: [{ id: "restart", label: "重新演示", primary: true }] },
  },
  adjust: {
    user: "返回调整",
    steps: [{ kind: "ACTION", name: "局部重排 localReplan", detail: "撤回执行确认" }, { kind: "EVENT", name: "变更事件", detail: "保留影响评估结果，状态更新为等待方案调整" }],
    message: { id: "adjustment", role: "assistant", content: "已撤回执行确认。你可以重新生成方案，或结束本次模拟。", actions: [{ id: "replan", label: "重新生成方案", primary: true }, { id: "restart", label: "结束并重置" }] },
  },
};

const DetailRow = ({ label, value, tone = "text-[#303740]" }) => (
  <div className="flex items-start justify-between gap-6 border-t border-[#edf0f2] py-2.5 first:border-t-0">
    <span className="text-xs text-[#7a838e]">{label}</span>
    <span className={`text-right text-xs font-medium ${tone}`}>{value}</span>
  </div>
);

const OntologyStep = ({ message }) => {
  const isRule = message.kind === "RULE";
  const isFunction = message.kind === "FUNCTION";
  const isObject = message.kind === "OBJECT";
  const isSolver = message.kind === "SOLVER";
  const isDashboard = message.kind === "DASHBOARD";

  if (!isRule && !isFunction && !isObject && !isSolver && !isDashboard) {
    return (
      <div className="flex items-start gap-3 px-1 text-sm leading-6 text-[#77818c]">
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#9aa3ad]" />
        <span className="min-w-0">
          <span className="mr-2 inline-block w-[76px] font-semibold text-[#37414c]">{message.kind}</span>
          <strong className="mr-2 font-semibold text-[#4c5661]">{message.name}</strong>
          <span>{message.detail}</span>
        </span>
      </div>
    );
  }

  if (isDashboard) {
    return (
      <div className="relative border-l-4 border-[#23815b] bg-[#f4faf7] px-5 py-5 shadow-[0_4px_14px_rgba(28,92,66,0.08)]">
        <span className="absolute -left-[7px] top-6 h-2.5 w-2.5 rounded-full bg-[#23815b] ring-4 ring-[#f7f8fa]" />
        <div className="flex flex-wrap items-center gap-3">
          <span className="bg-[#207653] px-2.5 py-1 text-xs font-bold tracking-wide text-white">DASHBOARD</span>
          <strong className="text-base font-semibold leading-6 text-[#245f49]">{message.name}</strong>
          <span className="ml-auto border border-[#c8e2d6] bg-white px-2 py-1 text-xs font-semibold text-[#287457]">已同步</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#53685f]">{message.detail}</p>
        <div className="mt-3 grid gap-2 border border-[#d5e7de] bg-white px-3 py-3 text-xs text-[#64736d] sm:grid-cols-2">
          <span><strong className="mr-2 text-[#476358]">更新范围</strong>{message.scope}</span>
          <span><strong className="mr-2 text-[#476358]">更新时间</strong>{message.updatedAt}</span>
        </div>
        <a
          href={message.href}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 border border-[#23815b] bg-[#23815b] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#196947]"
        >
          打开更新后的生产计划看板
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    );
  }

  if (isSolver) {
    return (
      <div className="relative border-l-4 border-[#5c67a8] bg-[#f7f8fd] px-5 py-5 shadow-[0_4px_14px_rgba(44,52,96,0.09)]">
        <span className="absolute -left-[7px] top-6 h-2.5 w-2.5 rounded-full bg-[#5c67a8] ring-4 ring-[#f7f8fa]" />
        <div className="flex flex-wrap items-center gap-3">
          <span className="bg-[#4f5a98] px-2.5 py-1 text-xs font-bold tracking-wide text-white">OPTIMIZER API</span>
          <strong className="text-base font-semibold leading-6 text-[#3d477f]">{message.name}</strong>
          <span className="ml-auto bg-[#e2e6f7] px-2 py-1 text-xs font-semibold text-[#46528d]">求解完成</span>
        </div>
        <div className="mt-4 grid gap-2.5 text-sm">
          <div className="border border-[#d9ddef] bg-white px-3 py-2.5">
            <span className="mr-3 inline-block w-[72px] text-xs font-semibold text-[#7b84a8]">接口地址</span>
            <code className="font-mono font-semibold text-[#3f4a81]">{message.endpoint}</code>
          </div>
          <div className="border border-[#d9ddef] bg-white px-3 py-2.5 leading-6">
            <span className="mr-3 inline-block w-[72px] text-xs font-semibold text-[#7b84a8]">请求约束</span>
            <code className="font-mono text-xs font-medium text-[#4c566f]">{message.request}</code>
          </div>
          <div className="border border-[#d9ddef] bg-white px-3 py-2.5 leading-6">
            <span className="mr-3 inline-block w-[72px] text-xs font-semibold text-[#7b84a8]">优化目标</span>
            <code className="font-mono text-xs font-medium text-[#4c566f]">{message.objective}</code>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#596379]">{message.detail}</p>
        <div className="mt-3 border-l-2 border-[#6974b1] bg-white px-3 py-2 text-sm font-semibold text-[#3f4a81]">{message.result}</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(message.options || []).map((option, index) => (
            <div key={option} className={`border px-3 py-2 text-xs font-medium leading-5 ${index === 0 ? "border-[#b9d8c6] bg-[#f4faf7] text-[#2f6e4e]" : "border-[#dfe2ed] bg-white text-[#596379]"}`}>{option}</div>
          ))}
        </div>
      </div>
    );
  }

  if (isObject) {
    const isWrite = /写入|置为|降为|更新|创建|锁定|增加|生成新版本|用户已确认变更/.test(message.detail || "");
    const operationLabel = isWrite ? "对象写入 / 状态变更" : "对象读取 / 关系查询";
    const objectTone = isWrite
      ? { border: "border-[#e5b8b4]", background: "bg-[#fff8f7]", badge: "bg-[#a13d35]", title: "text-[#7f302a]", panel: "border-[#efd0cd] bg-white", dot: "bg-[#c34e45]", status: "text-[#a13d35]" }
      : { border: "border-[#b9cee8]", background: "bg-[#f6f9fd]", badge: "bg-[#356aa0]", title: "text-[#2d5c8a]", panel: "border-[#cfdded] bg-white", dot: "bg-[#4b7fb2]", status: "text-[#356aa0]" };

    return (
      <div className={`relative border-l-4 px-5 py-4 shadow-[0_2px_8px_rgba(30,41,59,0.05)] ${objectTone.border} ${objectTone.background}`}>
        <span className={`absolute -left-[7px] top-5 h-2.5 w-2.5 rounded-full ring-4 ring-[#f7f8fa] ${objectTone.dot}`} />
        <div className="flex flex-wrap items-center gap-3">
          <span className={`px-2.5 py-1 text-xs font-bold tracking-wide text-white ${objectTone.badge}`}>OBJECT</span>
          <strong className={`text-base font-semibold leading-6 ${objectTone.title}`}>{message.name}</strong>
          <span className={`ml-auto text-xs font-semibold ${objectTone.status}`}>{operationLabel}</span>
        </div>
        <div className={`mt-3 border px-4 py-3 ${objectTone.panel}`}>
          <div className="flex items-start gap-3">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${objectTone.dot}`} />
            <p className="text-sm font-medium leading-6 text-[#46515d]">{message.detail}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs leading-5 text-[#74808c]">
          <span><strong className="font-medium text-[#53606c]">本体对象</strong> {message.name}</span>
          <span><strong className="font-medium text-[#53606c]">操作类型</strong> {isWrite ? "属性更新与关系联动" : "属性读取与关系解析"}</span>
          <span><strong className="font-medium text-[#53606c]">状态</strong> {isWrite ? "等待/已确认写入" : "读取完成"}</span>
        </div>
      </div>
    );
  }

  const tone = isRule
    ? { border: "border-[#efc7b8]", background: "bg-[#fff9f5]", badge: "bg-[#9a3f24]", title: "text-[#71301d]", formula: "border-[#f0d6cb] bg-white text-[#6f321f]", dot: "bg-[#c25d3d]" }
    : { border: "border-[#b9d9db]", background: "bg-[#f5fbfb]", badge: "bg-[#167179]", title: "text-[#145d64]", formula: "border-[#c9e1e2] bg-white text-[#155f66]", dot: "bg-[#238b92]" };

  return (
    <div className={`relative border-l-4 px-5 py-4 shadow-[0_2px_8px_rgba(30,41,59,0.05)] ${tone.border} ${tone.background}`}>
      <span className={`absolute -left-[7px] top-5 h-2.5 w-2.5 rounded-full ring-4 ring-[#f7f8fa] ${tone.dot}`} />
      <div className="flex flex-wrap items-center gap-3">
        <span className={`px-2.5 py-1 text-xs font-bold tracking-wide text-white ${tone.badge}`}>{message.kind}</span>
        <strong className={`text-base font-semibold leading-6 ${tone.title}`}>{message.name}</strong>
      </div>
      {message.expression && (
        <div className={`mt-3 overflow-x-auto border px-3 py-2.5 font-mono text-sm font-semibold leading-6 ${tone.formula}`}>
          <span className="mr-2 font-sans text-xs font-medium text-[#84909b]">{isRule ? "规则条件" : "函数表达式"}</span>
          {message.expression}
        </div>
      )}
      <p className="mt-3 text-sm leading-6 text-[#596570]">{message.detail}</p>
      {message.result && (
        <div className="mt-2 flex items-start gap-2 text-sm font-semibold leading-6 text-[#303a44]">
          <span className="shrink-0 text-xs font-medium text-[#84909b]">{isRule ? "判断结果" : "计算输出"}</span>
          <span>{message.result}</span>
        </div>
      )}
    </div>
  );
};

const getVisibleActions = (message) => {
  const actions = message.actions || [];
  if (message.card !== "proposal-choice" || actions.some((action) => action.id === "select-plan-c")) return actions;
  const adjustIndex = actions.findIndex((action) => action.id === "adjust");
  const optionC = { id: "select-plan-c", label: "选择方案 C" };
  if (adjustIndex < 0) return [...actions, optionC];
  return [...actions.slice(0, adjustIndex), optionC, ...actions.slice(adjustIndex)];
};

const PLAN_APPROVALS = {
  "select-main-plan-a": {
    gateIndex: 4,
    plan: "方案 A · 均衡排产（推荐）",
    approver: "生产计划科长",
    scope: "关键订单优先，260 件转移至二号线，增加 2 个弹性班次",
    impact: "下发 MPS-20260814-V2，更新 40 个计划项并同步 SAP/MES",
    risk: "订单按期率 98.6%，峰值负载 86%，关键订单零延期",
    writeOrders: "更新 40 个 ScheduleItem 的产线、起止时间、批次与顺序",
    writeResources: "二号线承接 260 件；资源日历增加 2 个弹性班次",
    writeVersion: "MPS-20260814-V1 → MPS-20260814-V2",
  },
  "select-main-plan-b": {
    gateIndex: 4,
    plan: "方案 B · 交付优先",
    approver: "生产计划科长",
    scope: "订单保持原产线，增加 3 个弹性班次，优先保障全部交付节点",
    impact: "下发 MPS-20260814-V2，并同步人员加班与 SAP/MES 派工",
    risk: "订单按期率 99.2%，峰值负载 91%，人员成本增加 8%",
    writeOrders: "保持订单原产线，更新 40 个计划项的生产时间与顺序",
    writeResources: "资源日历增加 3 个弹性班次并写入人员加班安排",
    writeVersion: "MPS-20260814-V1 → MPS-20260814-V2",
  },
  "select-main-plan-c": {
    gateIndex: 4,
    plan: "方案 C · 库存优化",
    approver: "生产计划科长",
    scope: "降低提前生产量，2 个低优先级订单顺延至下一交付窗口",
    impact: "下发 MPS-20260814-V2，更新 SAP 交付窗口与 MES 派工顺序",
    risk: "订单按期率 96.8%，库存占用降低 14%，关键订单零延期",
    writeOrders: "更新库存优化排程；2 个低优先级订单顺延",
    writeResources: "调整三条产线生产顺序，不新增加班日",
    writeVersion: "MPS-20260814-V1 → MPS-20260814-V2",
  },
  "select-plan-a": {
    plan: "方案 A · 转移产线（推荐）",
    approver: "生产计划科长",
    scope: "紧急订单转移至二号生产线，并安排 2 小时加班",
    impact: "写入 MPS-20260813-V2，调整销售订单、生产线与资源日历",
    risk: "关键订单零延期，预计剩余产能缺口 60 件",
  },
  "select-plan-b": {
    plan: "方案 B · 加班重排",
    approver: "生产计划科长",
    scope: "保留本线生产，增加临时加班并顺延非紧急订单",
    impact: "调整资源日历与订单顺序，紧急订单可能延期 1 天",
    risk: "加班成本较高，交付风险需由计划员确认",
  },
  "select-plan-c": {
    plan: "方案 C · 跨事业部协同",
    approver: "生产计划科长 + 关联事业部负责人",
    scope: "同步配套工序与协同事业部产能，锁定关键订单交付节点",
    impact: "创建跨事业部协调任务，审批后再写入主计划",
    risk: "依赖协同窗口，需要双方完成会签",
  },
};

const SimulationCard = ({ type, onOpenDetail }) => {
  if (type === "alert") return (
    <div className="mt-3 border-l-4 border-[#dc4036] bg-[#fff7f6] px-4 py-3">
      <div className="mb-2 flex items-center justify-between"><strong className="text-sm text-[#a8322b]">MES 设备故障告警</strong><span className="bg-[#f5d3d0] px-2 py-0.5 text-[11px] font-medium text-[#a8322b]">高优先级</span></div>
      <DetailRow label="故障设备" value={EQUIPMENT_NAME} /><DetailRow label="故障类型" value="主轴驱动异常" /><DetailRow label="预计停机" value="6 小时" tone="text-[#c43e35]" /><DetailRow label="当前状态" value="已停机" tone="text-[#c43e35]" />


    </div>
  );
  if (type === "plan-start") return (
    <div className="mt-3 border-l-4 border-[#4b67b0] bg-[#f5f7fc] px-4 py-3">
      <div className="mb-2 flex items-center justify-between"><strong className="text-sm text-[#3d5797]">主计划编制任务</strong><span className="bg-[#dfe6f8] px-2 py-0.5 text-[11px] font-medium text-[#3d5797]">待评估</span></div>
      <DetailRow label="编制范围" value="本周主生产计划" /><DetailRow label="评估对象" value="订单、物料、产能与交付" /><DetailRow label="流程步骤" value="8 个业务步骤" /><DetailRow label="当前状态" value="等待选择启动事件" tone="text-[#3d5797]" />
    </div>
  );
  if (type === "plan-result") return (
    <div className="mt-3 border border-[#d7e1f5] bg-[#f7f9fd] p-4">
      <div className="mb-3 flex items-center justify-between"><strong className="text-sm text-[#344f91]">主计划编制结果</strong><span className="bg-[#dce9e1] px-2 py-0.5 text-[11px] font-medium text-[#347053]">8/8 已完成</span></div>
      <div className="grid grid-cols-3 gap-3">{[["订单校验", "已完成"], ["约束校验", "已通过"], ["计划状态", "待发布"]].map(([label, value]) => <div key={label} className="border border-[#e0e6f1] bg-white p-3"><div className="text-[11px] text-[#7d8690]">{label}</div><div className="mt-1 text-sm font-semibold text-[#344f91]">{value}</div></div>)}</div>
      <div className="mt-3 border-t border-[#e2e7f0] pt-3 text-xs leading-5 text-[#4f5964]">推荐优先保障高优先级订单，并将非关键订单安排到备用产能窗口。</div>
    </div>
  );
  if (type === "plan-assessment") return (
    <div className="mt-3 border border-[#dfe3e7] bg-[#fafbfc] p-4">
      <div className="mb-3 flex items-center justify-between"><strong className="text-sm">主计划约束评估</strong><span className="bg-[#f7dfbb] px-2 py-0.5 text-[11px] font-medium text-[#855915]">需优化</span></div>
      <div className="grid grid-cols-3 gap-3">{[["净需求", "2,980 件"], ["产能缺口", "380 件"], ["物料齐套率", "93%"]].map(([label, value]) => <div key={label} className="border border-[#e3e6ea] bg-white p-3"><div className="text-[11px] text-[#7d8690]">{label}</div><div className="mt-1 text-lg font-semibold text-[#292f36]">{value}</div></div>)}</div>
      <div className="mt-3 border-t border-[#e5e8eb] pt-3 text-xs leading-5 text-[#4f5964]"><div><span className="font-medium text-[#347053]">已通过</span> 高优先级订单物料齐套保障</div><div><span className="font-medium text-[#c43e35]">已命中</span> 第 2 周一号线产能峰值预警</div><div><span className="font-medium text-[#347053]">可消化</span> 二号线承接与弹性班次组合可覆盖缺口</div></div>
    </div>
  );
  if (type === "plan-proposal-choice") return (
    <div className="mt-3 border border-[#dfe3e7] bg-[#fafbfc] p-4">
      <div className="mb-3 flex items-center justify-between"><strong className="text-sm">主计划候选方案</strong><span className="bg-[#dce9e1] px-2 py-0.5 text-[11px] font-medium text-[#347053]">3 个可执行</span></div>
      <div className="overflow-x-auto border border-[#dfe3e7] bg-white">
        <table className="w-full min-w-[860px] border-collapse text-left text-[11px] text-[#46515d]">
          <thead className="bg-[#f2f4f6] text-[#697582]">
            <tr>
              <th className="border-b border-[#dfe3e7] px-3 py-2 font-medium">候选方案</th>
              <th className="border-b border-[#dfe3e7] px-3 py-2 font-medium">按期率</th>
              <th className="border-b border-[#dfe3e7] px-3 py-2 font-medium">峰值负载</th>
              <th className="border-b border-[#dfe3e7] px-3 py-2 font-medium">成本变化</th>
              <th className="border-b border-[#dfe3e7] px-3 py-2 font-medium">加班时长</th>
              <th className="border-b border-[#dfe3e7] px-3 py-2 font-medium">瓶颈数量</th>
              <th className="border-b border-[#dfe3e7] px-3 py-2 font-medium">库存变化</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-[#f4faf7]">
              <td className="border-b border-[#cfe2d6] px-3 py-3"><div className="font-semibold text-[#2f6e4e]">方案 A · 均衡排产</div><div className="mt-1 text-[10px] text-[#65716d]">260 件转移二号线 · 推荐</div></td>
              <td className="border-b border-[#cfe2d6] px-3 py-3 font-semibold text-[#2f6e4e]">98.6%</td>
              <td className="border-b border-[#cfe2d6] px-3 py-3 font-semibold">86%</td>
              <td className="border-b border-[#cfe2d6] px-3 py-3 font-semibold">+3.2%</td>
              <td className="border-b border-[#cfe2d6] px-3 py-3 font-semibold">16 小时</td>
              <td className="border-b border-[#cfe2d6] px-3 py-3 font-semibold">1 个</td>
              <td className="border-b border-[#cfe2d6] px-3 py-3 font-semibold">-6.0%</td>
            </tr>
            <tr>
              <td className="border-b border-[#e3e6e9] px-3 py-3"><div className="font-semibold text-[#292f36]">方案 B · 交付优先</div><div className="mt-1 text-[10px] text-[#7d8690]">保持原产线 · 交付最佳</div></td>
              <td className="border-b border-[#e3e6e9] px-3 py-3 font-semibold text-[#2f6e4e]">99.2%</td>
              <td className="border-b border-[#e3e6e9] px-3 py-3 font-semibold text-[#a35a24]">91%</td>
              <td className="border-b border-[#e3e6e9] px-3 py-3 font-semibold text-[#a35a24]">+8.0%</td>
              <td className="border-b border-[#e3e6e9] px-3 py-3 font-semibold">24 小时</td>
              <td className="border-b border-[#e3e6e9] px-3 py-3 font-semibold">2 个</td>
              <td className="border-b border-[#e3e6e9] px-3 py-3 font-semibold">-2.0%</td>
            </tr>
            <tr>
              <td className="px-3 py-3"><div className="font-semibold text-[#292f36]">方案 C · 库存优化</div><div className="mt-1 text-[10px] text-[#7d8690]">2 单顺延 · 库存最低</div></td>
              <td className="px-3 py-3 font-semibold text-[#a35a24]">96.8%</td>
              <td className="px-3 py-3 font-semibold text-[#2f6e4e]">83%</td>
              <td className="px-3 py-3 font-semibold text-[#2f6e4e]">-5.6%</td>
              <td className="px-3 py-3 font-semibold">0 小时</td>
              <td className="px-3 py-3 font-semibold">1 个</td>
              <td className="px-3 py-3 font-semibold text-[#2f6e4e]">-14.0%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10px] text-[#7d8690]">成本与库存变化均以当前已发布计划 MPS-20260814-V1 为基线。</div>
    </div>
  );
  if (["plan-execution-a", "plan-execution-b", "plan-execution-c"].includes(type)) {
    const result = {
      "plan-execution-a": ["方案 A · 均衡排产", "98.6%", "86%", "关键订单零延期"],
      "plan-execution-b": ["方案 B · 交付优先", "99.2%", "91%", "人员成本增加 8%"],
      "plan-execution-c": ["方案 C · 库存优化", "96.8%", "83%", "库存占用降低 14%"],
    }[type];
    return (
      <div className="mt-3 border-l-4 border-[#3e8b64] bg-[#f4faf7] px-4 py-3">
        <div className="mb-2 flex items-center justify-between"><strong className="text-sm text-[#2f6e4e]">主计划审批发布完成</strong><span className="bg-[#dce9e1] px-2 py-0.5 text-[11px] font-medium text-[#347053]">8/8 已完成</span></div>
        <DetailRow label="已选方案" value={result[0]} /><DetailRow label="订单按期率" value={result[1]} /><DetailRow label="峰值产线负载" value={result[2]} /><DetailRow label="方案效果" value={result[3]} tone="text-[#347053]" />
      </div>
    );
  }
  if (type === "impact") return (
    <div className="mt-3 border border-[#dfe3e7] bg-[#fafbfc] p-4">
      <div className="mb-3 flex items-center justify-between"><strong className="text-sm">影响评估结果</strong><span className="bg-[#f7dfbb] px-2 py-0.5 text-[11px] font-medium text-[#855915]">高风险</span></div>
      <div className="grid grid-cols-3 gap-3">{[["产能损失", "480 件"], ["受影响订单", "3 单"], ["最大延期", "2 天"]].map(([label, value]) => <div key={label} className="border border-[#e3e6ea] bg-white p-3"><div className="text-[11px] text-[#7d8690]">{label}</div><div className="mt-1 text-lg font-semibold text-[#292f36]">{value}</div></div>)}</div>
      <div className="mt-3 border-t border-[#e5e8eb] pt-3 text-xs leading-5 text-[#4f5964]"><div><span className="font-medium text-[#c43e35]">已命中</span> 设备故障高产能影响预警</div><div><span className="font-medium text-[#c43e35]">已命中</span> 设备故障关键订单交付风险</div><div><span className="font-medium text-[#707984]">未命中</span> 设备故障可本地消化</div></div>
      <button type="button" onClick={() => onOpenDetail("impact")} className="mt-4 border border-[#d7dce2] bg-white px-3 py-2 text-xs font-medium text-[#4f5964] hover:bg-[#f3f5f7]">查看影响传播明细</button>
    </div>
  );
  if (type === "proposal") return (
    <div className="mt-3 border border-[#dfe3e7] bg-[#fafbfc] p-4">
      <div className="mb-3 flex items-center justify-between"><strong className="text-sm">主计划调整方案</strong><span className="bg-[#dce9e1] px-2 py-0.5 text-[11px] font-medium text-[#347053]">建议执行</span></div>
      <DetailRow label="优先级最高订单" value="优先保证关键交付订单" /><DetailRow label="次优先订单" value="顺延到备用产能窗口" /><DetailRow label="资源调整" value="增加人员和临时产能支持" /><DetailRow label="预计效果" value="关键订单可按期交付，整体风险下降" tone="text-[#347053]" />
    </div>
  );
  if (type === "proposal-choice") return (
    <div className="mt-3 border border-[#dfe3e7] bg-[#fafbfc] p-4">
      <div className="mb-3 flex items-center justify-between"><strong className="text-sm">故障重排方案对比</strong><span className="bg-[#dce9e1] px-2 py-0.5 text-[11px] font-medium text-[#347053]">3 个可执行</span></div>
      <div className="overflow-x-auto border border-[#e2e6ea] bg-white">
        <table className="w-full min-w-[620px] table-fixed border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#e2e6ea] bg-[#f4f6f8] text-[#5c6773]">
              <th className="w-[22%] px-3 py-2.5 font-medium">对比维度</th>
              <th className="w-[26%] border-l border-[#e2e6ea] bg-[#f4faf7] px-3 py-2.5 font-semibold text-[#2f6e4e]">方案 A · 转移产线 <span className="ml-1 bg-[#dce9e1] px-1.5 py-0.5 text-[10px]">推荐</span></th>
              <th className="w-[26%] border-l border-[#e2e6ea] px-3 py-2.5 font-medium">方案 B · 加班重排</th>
              <th className="w-[26%] border-l border-[#e2e6ea] px-3 py-2.5 font-medium">方案 C · 跨部协同</th>
            </tr>
          </thead>
          <tbody className="text-[#46515d]">
            {[
              ["核心策略", "紧急订单转移至二号线", "保留本线并增加加班", "同步配套事业部产能"],
              ["关键订单延期", "0 天", "1 天", "0-1 天"],
              ["产能缺口", "60 件", "40 件", "20 件"],
              ["交付风险", "低", "中", "中"],
              ["额外成本", "中", "高", "中"],
              ["审批要求", "计划科长", "计划科长", "跨事业部会签"],
              ["综合评分", "92", "84", "87"],
            ].map((row, rowIndex) => (
              <tr key={row[0]} className={rowIndex < 6 ? "border-b border-[#edf0f2]" : ""}>
                <th className="bg-[#fafbfc] px-3 py-2.5 font-medium text-[#68737f]">{row[0]}</th>
                <td className="border-l border-[#edf0f2] bg-[#f8fcfa] px-3 py-2.5 font-medium text-[#2f6e4e]">{row[1]}</td>
                <td className="border-l border-[#edf0f2] px-3 py-2.5">{row[2]}</td>
                <td className="border-l border-[#edf0f2] px-3 py-2.5">{row[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] leading-5 text-[#596572]">
        <div className="border-l-2 border-[#3e8b64] bg-[#f4faf7] px-3 py-2"><strong className="block text-[#2f6e4e]">方案 A</strong>交付保障与执行复杂度最均衡。</div>
        <div className="border-l-2 border-[#9aa3ad] bg-white px-3 py-2"><strong className="block text-[#303740]">方案 B</strong>落地最快，但加班成本和延期风险更高。</div>
        <div className="border-l-2 border-[#4b67b0] bg-[#f5f7fc] px-3 py-2"><strong className="block text-[#3d5797]">方案 C</strong>产能缺口最小，但需要跨事业部会签。</div>
      </div>
    </div>
  );
  if (type === "success") return (
    <div className="mt-3 border-l-4 border-[#3e8b64] bg-[#f4faf7] px-4 py-3"><strong className="text-sm text-[#2f6e4e]">主计划已生效</strong><div className="mt-2"><DetailRow label="调整方案" value="已确认执行" /><DetailRow label="交付状态" value="优先保障关键订单" /><DetailRow label="计划状态" value="待计划员发布" tone="text-[#347053]" /></div></div>
  );
  if (type === "exec-summary") return (
    <div className="mt-3 border border-[#dfe3e7] bg-[#f4faf7] p-4">
      <div className="mb-3 flex items-center justify-between"><strong className="text-sm text-[#2f6e4e]">主计划已执行</strong><span className="bg-[#dce9e1] px-2 py-0.5 text-[11px] font-medium text-[#347053]">已确认</span></div>
      <div className="space-y-3">
        <div className="rounded border border-[#dbe9df] bg-white p-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#768190]">执行结果</div>
          <div className="grid grid-cols-2 gap-3 text-xs text-[#394452]">
            <div><span className="block text-[#7a838e]">计划状态</span><span className="mt-1 block font-semibold text-[#2f6e4e]">已生效</span></div>
            <div><span className="block text-[#7a838e]">关键订单</span><span className="mt-1 block font-semibold text-[#2f6e4e]">优先保障</span></div>
            <div><span className="block text-[#7a838e]">资源调整</span><span className="mt-1 block font-semibold text-[#2f6e4e]">已分配</span></div>
            <div><span className="block text-[#7a838e]">交付风险</span><span className="mt-1 block font-semibold text-[#2f6e4e]">已控制</span></div>
          </div>
        </div>
        <div className="rounded border border-[#dbe9df] bg-[#edf8f2] p-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#768190]">执行结论</div>
          <div className="text-xs leading-5 text-[#46515d]">已形成稳定的主计划安排，关键交付节点已优先保护，非关键订单在备用窗口执行。</div>
        </div>
        <button type="button" onClick={() => onOpenDetail("execution")} className="border border-[#c8dfd0] bg-white px-3 py-2 text-xs font-medium text-[#2f6e4e] hover:bg-[#f4faf7]">查看事务执行明细</button>
      </div>
    </div>
  );
  return null;
};

const SimpleChatPage = ({ isZh }) => {
  const [scenario, setScenario] = useState("fault");
  const [messages, setMessages] = useState(() => [initialFaultMessage()]);
  const [loading, setLoading] = useState(false);
  const [detailPanel, setDetailPanel] = useState(null);
  const [candidatePlanMessage, setCandidatePlanMessage] = useState(null);
  const [impactResultMessage, setImpactResultMessage] = useState(null);
  const [faultChangeConfirmation, setFaultChangeConfirmation] = useState(null);
  const [planApproval, setPlanApproval] = useState(null);
  const [planWriteConfirmation, setPlanWriteConfirmation] = useState(null);
  const timerRef = useRef(null);
  const endRef = useRef(null);

  const scenarioMeta = SCENARIOS.find((item) => item.id === scenario) || SCENARIOS[0];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [loading, messages]);

  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (latestMessage?.card === "proposal-choice" || latestMessage?.card === "plan-proposal-choice") {
      setCandidatePlanMessage(latestMessage);
    }
    if (latestMessage?.card === "impact") {
      setImpactResultMessage(latestMessage);
    }
  }, [messages]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setDetailPanel(null);
        setCandidatePlanMessage(null);
        setImpactResultMessage(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const resetSimulation = (nextScenario = scenario) => {
    (timerRef.current || []).forEach((timerId) => window.clearTimeout(timerId));
    timerRef.current = [];
    setLoading(false);
    setCandidatePlanMessage(null);
    setImpactResultMessage(null);
    setFaultChangeConfirmation(null);
    setPlanApproval(null);
    setPlanWriteConfirmation(null);
    setMessages([
      nextScenario === "plan" ? initialPlanMessage() : initialFaultMessage(),
    ]);
  };

  const handleScenarioSelect = (nextScenario) => {
    setScenario(nextScenario);
    resetSimulation(nextScenario);
  };

  const handleAction = (actionId) => {
    if (loading) return;
    if (actionId === "restart") return resetSimulation();
    const response = simulationResponses[actionId];
    if (!response) return;
    setMessages((current) => [...current.map((message) => ({ ...message, actions: [] })), { id: `user-${actionId}-${Date.now()}`, role: "user", content: response.user }]);
    setLoading(true);
    const steps = response.steps || [];
    if (actionId === "assess") {
      const preparatorySteps = steps.slice(0, 2);
      timerRef.current = preparatorySteps.map((step, index) => window.setTimeout(() => {
        setMessages((current) => [...current, { id: `thinking-${actionId}-${index}-${Date.now()}`, role: "thinking", ...step }]);
      }, 450 * (index + 1)));
      timerRef.current.push(window.setTimeout(() => {
        setFaultChangeConfirmation({ step: steps[2], message: response.message });
        setLoading(false);
        timerRef.current = [];
      }, 450 * (preparatorySteps.length + 1)));
      return;
    }
    if (PLAN_APPROVALS[actionId]) {
      const approval = PLAN_APPROVALS[actionId];
      const gateIndex = approval.gateIndex ?? 1;
      const preparatorySteps = steps.slice(0, gateIndex);
      timerRef.current = preparatorySteps.map((step, index) => window.setTimeout(() => {
        setMessages((current) => [...current, { id: `thinking-${actionId}-${index}-${Date.now()}`, role: "thinking", ...step }]);
      }, 450 * (index + 1)));
      timerRef.current.push(window.setTimeout(() => {
        setPlanApproval({
          actionId,
          approval,
          gateStep: steps[gateIndex],
          remainingSteps: steps.slice(gateIndex + 1),
          message: response.message,
        });
        setLoading(false);
        timerRef.current = [];
      }, 450 * (preparatorySteps.length + 1)));
      return;
    }
    timerRef.current = steps.map((step, index) => window.setTimeout(() => {
      setMessages((current) => [...current, { id: `thinking-${actionId}-${index}-${Date.now()}`, role: "thinking", ...step }]);
    }, 450 * (index + 1)));
    timerRef.current.push(window.setTimeout(() => {
      setMessages((current) => [...current, response.message]);
      setLoading(false);
      timerRef.current = [];
    }, 450 * (steps.length + 1)));
  };

  const selectCandidatePlan = (actionId) => {
    setCandidatePlanMessage(null);
    handleAction(actionId);
  };

  const confirmFaultStateChange = () => {
    if (!faultChangeConfirmation) return;
    const { step, message } = faultChangeConfirmation;
    setFaultChangeConfirmation(null);
    setLoading(true);
    setMessages((current) => [...current, { id: `thinking-assess-confirmed-${Date.now()}`, role: "thinking", ...step, detail: `用户已确认变更。${step.detail}` }]);
    timerRef.current = [window.setTimeout(() => {
      setMessages((current) => [...current, message]);
      setLoading(false);
      timerRef.current = [];
    }, 450)];
  };

  const cancelFaultStateChange = () => {
    setFaultChangeConfirmation(null);
    setLoading(false);
    setMessages((current) => [...current, {
      id: `fault-change-cancelled-${Date.now()}`,
      role: "assistant",
      content: "已取消设备状态与产线产能变更。设备保持当前状态，未创建 ChangeEvent，本次影响评估已停止。",
      actions: [{ id: "restart", label: "重新开始", primary: true }],
    }]);
  };

  const approvePlanExecution = () => {
    if (!planApproval) return;
    const { actionId, approval, gateStep, remainingSteps, message } = planApproval;
    setPlanApproval(null);
    setMessages((current) => [...current, {
      id: `thinking-${actionId}-approved-${Date.now()}`,
      role: "thinking",
      ...gateStep,
      detail: `审批已通过。${gateStep.detail}`,
    }]);
    setPlanWriteConfirmation({ actionId, approval, remainingSteps, message });
    setLoading(false);
  };

  const confirmPlanWrite = () => {
    if (!planWriteConfirmation) return;
    const { actionId, remainingSteps, message } = planWriteConfirmation;
    setPlanWriteConfirmation(null);
    setLoading(true);
    timerRef.current = remainingSteps.map((step, index) => window.setTimeout(() => {
      setMessages((current) => [...current, { id: `thinking-${actionId}-${index + 2}-${Date.now()}`, role: "thinking", ...step }]);
    }, 450 * (index + 1)));
    timerRef.current.push(window.setTimeout(() => {
      setMessages((current) => [...current, message]);
      setLoading(false);
      timerRef.current = [];
    }, 450 * (remainingSteps.length + 1)));
  };

  const cancelPlanWrite = () => {
    if (!planWriteConfirmation) return;
    const cancelledPlan = planWriteConfirmation.approval.plan;
    setPlanWriteConfirmation(null);
    setLoading(false);
    setMessages((current) => [...current, {
      id: `plan-write-cancelled-${Date.now()}`,
      role: "assistant",
      content: `${cancelledPlan}已审批通过，但你取消了数据写入。订单、生产线、资源日历和主生产计划均保持原值。`,
      actions: [{ id: "replan", label: "返回候选方案", primary: true }, { id: "restart", label: "结束并重置" }],
    }]);
  };

  const rejectPlanExecution = () => {
    if (!planApproval) return;
    const rejectedPlan = planApproval.approval.plan;
    setPlanApproval(null);
    setLoading(false);
    setMessages((current) => [...current, {
      id: `plan-approval-rejected-${Date.now()}`,
      role: "assistant",
      content: `${rejectedPlan}审批未通过，未写入订单、生产线、资源日历或主生产计划。你可以返回候选方案重新选择。`,
      actions: [{ id: "replan", label: "返回候选方案", primary: true }, { id: "restart", label: "结束并重置" }],
    }]);
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f7f8fa] text-[#252a32]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#e5e8ec] bg-white px-8">
        <div>
          <h1 className="text-lg font-semibold">{scenarioMeta.title}</h1>
          <p className="mt-0.5 text-xs text-[#7b8490]">{scenarioMeta.subtitle}</p>
        </div>
        <button type="button" onClick={() => resetSimulation()} title={isZh ? "重置模拟" : "Reset simulation"} className="flex h-9 w-9 items-center justify-center border border-[#dce1e6] bg-white text-[#68717c] hover:bg-[#f3f5f7]">
          <TrashIcon />
        </button>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto flex min-h-full max-w-[1400px] items-start justify-center gap-6">
          <div className="flex-1 max-w-3xl">
            <div className="space-y-6 pb-6">
              {messages.map((message, index) => (
                message.role === "thinking" ? (
                  <OntologyStep key={message.id || `thinking-${index}`} message={message} />
                ) : (
                <div key={message.id || `${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] px-4 py-3 ${message.role === "user" ? "bg-[#252b33] text-white" : "w-full border border-[#e1e5e9] bg-white text-[#303740]"}`}>
                    <div className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</div>
                    {message.card === "impact" ? (
                      <div className="mt-3 border-l-4 border-[#d59a3a] bg-[#fffaf0] px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <strong className="text-sm text-[#855915]">影响评估已完成</strong>
                            <p className="mt-1 text-xs leading-5 text-[#75654c]">识别 480 件产能损失、3 个受影响订单和 2 天最大延期。</p>
                          </div>
                          <button type="button" onClick={() => setImpactResultMessage(message)} className="border border-[#b9822d] bg-white px-3 py-2 text-xs font-semibold text-[#855915] hover:bg-[#fff7e7]">查看评估结果</button>
                        </div>
                      </div>
                    ) : message.card === "proposal-choice" || message.card === "plan-proposal-choice" ? (
                      <div className="mt-3 border-l-4 border-[#4b67b0] bg-[#f5f7fc] px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <strong className="text-sm text-[#344f91]">候选方案已生成</strong>
                            <p className="mt-1 text-xs leading-5 text-[#657083]">共 3 个可执行方案，打开弹窗查看指标对比并选择执行方案。</p>
                          </div>
                          <button type="button" onClick={() => setCandidatePlanMessage(message)} className="border border-[#4b67b0] bg-white px-3 py-2 text-xs font-semibold text-[#3d5797] hover:bg-[#edf2ff]">查看并选择方案</button>
                        </div>
                      </div>
                    ) : (
                      <SimulationCard type={message.card} onOpenDetail={setDetailPanel} />
                    )}
                    {message.card !== "proposal-choice" && message.card !== "plan-proposal-choice" && !!getVisibleActions(message).length && <div className="mt-4 flex flex-wrap gap-2 border-t border-[#edf0f2] pt-3">{getVisibleActions(message).map((action) => <button key={action.id} type="button" onClick={() => handleAction(action.id)} className={`h-9 px-4 text-sm font-medium ${action.primary ? "bg-[#252b33] text-white hover:bg-[#11161c]" : "border border-[#d7dce2] bg-white text-[#4f5964] hover:bg-[#f4f6f8]"}`}>{action.label}</button>)}</div>}
                  </div>
                </div>
                )
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 px-1 text-xs text-[#8b949e]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#9aa3ad]" />{isZh ? "正在执行下一步..." : "Running next step..."}</div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          <aside className="w-[340px] shrink-0">
            <div className="rounded-xl border border-[#e3e7ec] bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#2b323b]">可评估事件</h2>
                <span className="rounded-full bg-[#f3f5f7] px-2 py-0.5 text-[10px] font-medium text-[#596675]">{SCENARIOS.length} 项</span>
              </div>
              <div className="space-y-3">
                {SCENARIOS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleScenarioSelect(item.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                      scenario === item.id
                        ? item.id === "fault"
                          ? "border-[#f0c9c5] bg-[#fff7f6]"
                          : "border-[#cdd9ff] bg-[#f3f7ff]"
                        : "border-[#e5e8ec] bg-[#f9fafb] hover:bg-[#f3f5f7]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[#2f3740]">{item.label}</span>
                      {scenario === item.id && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#4b5b7a]">已选</span>}
                    </div>
                    <div className="mt-2 text-xs leading-5 text-[#697684]">{item.id === "fault" ? "设备异常触发产能与交付风险评估" : "从订单/资源/交付约束入手编制主计划"}</div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {impactResultMessage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1d252d]/50 px-4 py-6" onMouseDown={(event) => event.target === event.currentTarget && setImpactResultMessage(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="impact-result-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col border border-[#d8dee4] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.28)]">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#e5e8ec] px-5 py-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#b16e18]">Impact assessment</div>
                <h2 id="impact-result-title" className="mt-1 text-lg font-semibold text-[#252b33]">设备故障影响评估结果</h2>
                <p className="mt-1 text-xs text-[#707b87]">评估产能损失、订单延期与交付风险，确认后可继续生成重排方案。</p>
              </div>
              <button type="button" onClick={() => setImpactResultMessage(null)} aria-label="关闭影响评估弹窗" className="flex h-8 w-8 items-center justify-center border border-[#dce1e6] text-lg text-[#68717c] hover:bg-[#f3f5f7]">×</button>
            </div>
            <div className="min-h-0 overflow-y-auto px-5 pb-5">
              <SimulationCard type="impact" onOpenDetail={(detail) => { setImpactResultMessage(null); setDetailPanel(detail); }} />
            </div>
            <div className="flex shrink-0 justify-end border-t border-[#e5e8ec] bg-[#fafbfc] px-5 py-4">
              <button type="button" onClick={() => setImpactResultMessage(null)} className="bg-[#252b33] px-4 py-2 text-sm font-medium text-white hover:bg-[#11161c]">确认评估结果</button>
            </div>
          </div>
        </div>
      )}

      {candidatePlanMessage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1d252d]/50 px-4 py-6" onMouseDown={(event) => event.target === event.currentTarget && setCandidatePlanMessage(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="candidate-plan-title" className="flex max-h-[92vh] w-full max-w-4xl flex-col border border-[#d8dee4] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.28)]">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#e5e8ec] px-5 py-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#4b67b0]">Optimization result</div>
                <h2 id="candidate-plan-title" className="mt-1 text-lg font-semibold text-[#252b33]">选择候选执行方案</h2>
                <p className="mt-1 text-xs text-[#707b87]">对比交付、产能、成本与审批要求后选择方案，选择后将进入执行审批。</p>
              </div>
              <button type="button" onClick={() => setCandidatePlanMessage(null)} aria-label="关闭候选方案弹窗" className="flex h-8 w-8 items-center justify-center border border-[#dce1e6] text-lg text-[#68717c] hover:bg-[#f3f5f7]">×</button>
            </div>
            <div className="min-h-0 overflow-y-auto px-5 py-2">
              <SimulationCard type={candidatePlanMessage.card} onOpenDetail={setDetailPanel} />
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[#e5e8ec] bg-[#fafbfc] px-5 py-4">
              {getVisibleActions(candidatePlanMessage).map((action) => (
                <button key={action.id} type="button" onClick={() => selectCandidatePlan(action.id)} className={`h-9 px-4 text-sm font-medium ${action.primary ? "bg-[#252b33] text-white hover:bg-[#11161c]" : "border border-[#d7dce2] bg-white text-[#4f5964] hover:bg-[#f4f6f8]"}`}>{action.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {faultChangeConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1d252d]/45 px-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="fault-change-title" aria-describedby="fault-change-description" className="w-full max-w-lg border border-[#e2d4d2] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#edf0f2] pb-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#a8322b]">需要人工确认</div>
                <h2 id="fault-change-title" className="mt-1 text-base font-semibold text-[#252b33]">确认设备故障状态变更</h2>
              </div>
              <span className="bg-[#f5d3d0] px-2 py-1 text-[11px] font-medium text-[#a8322b]">高影响操作</span>
            </div>
            <p id="fault-change-description" className="mt-4 text-sm leading-6 text-[#4f5964]">该操作将修改设备与生产线运行状态，并触发后续故障影响评估。请确认变更内容。</p>
            <div className="mt-4 border border-[#e5e8eb] bg-[#fafbfc] px-4 py-1">
              <DetailRow label="设备" value={EQUIPMENT_NAME} />
              <DetailRow label="设备状态" value="normal → fault" tone="text-[#c43e35]" />
              <DetailRow label="关联产线产能" value="可用 → 0" tone="text-[#c43e35]" />
              <DetailRow label="变更事件" value="创建 equipmentFault ChangeEvent" />
              <DetailRow label="事务保护" value="锁定产线与受影响订单" tone="text-[#347053]" />
            </div>
            <div className="mt-4 border-l-2 border-[#d59a3a] bg-[#fffaf0] px-3 py-2 text-xs leading-5 text-[#765418]">确认后将立即锁定故障产线产能；后续计划调整仍需单独审批。</div>
            <div className="mt-5 flex justify-end gap-2 border-t border-[#edf0f2] pt-4">
              <button type="button" onClick={cancelFaultStateChange} className="border border-[#d7dce2] bg-white px-4 py-2 text-sm font-medium text-[#4f5964] hover:bg-[#f4f6f8]">取消变更</button>
              <button type="button" onClick={confirmFaultStateChange} className="bg-[#b73b33] px-4 py-2 text-sm font-medium text-white hover:bg-[#992f29]">确认并锁定产能</button>
            </div>
          </div>
        </div>
      )}

      {planApproval && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1d252d]/45 px-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="plan-approval-title" aria-describedby="plan-approval-description" className="w-full max-w-xl border border-[#d8dee4] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#edf0f2] pb-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8a5a16]">Approval gate</div>
                <h2 id="plan-approval-title" className="mt-1 text-lg font-semibold text-[#252b33]">重排方案执行审批</h2>
              </div>
              <span className="bg-[#fff0c9] px-2.5 py-1 text-xs font-semibold text-[#805713]">等待审批</span>
            </div>
            <p id="plan-approval-description" className="mt-4 text-sm leading-6 text-[#4f5964]">方案包含生产计划写入和资源调整。审批通过前，系统不会修改订单、产线、资源日历或主计划。</p>
            <div className="mt-4 border border-[#e3e7eb] bg-[#fafbfc] px-4 py-1">
              <DetailRow label="待审批方案" value={planApproval.approval.plan} tone="text-[#2f3740]" />
              <DetailRow label="审批人" value={planApproval.approval.approver} tone="text-[#805713]" />
              <DetailRow label="执行范围" value={planApproval.approval.scope} />
              <DetailRow label="写入影响" value={planApproval.approval.impact} tone="text-[#a13d35]" />
              <DetailRow label="风险结论" value={planApproval.approval.risk} />
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-medium text-[#68737f]">审批意见</span>
              <textarea defaultValue="方案约束校验完成，同意按当前方案执行。" rows={2} className="mt-2 w-full resize-none border border-[#d8dde3] bg-white px-3 py-2 text-sm leading-5 text-[#38434e] outline-none focus:border-[#9b6b21]" />
            </label>
            <div className="mt-4 border-l-2 border-[#d59a3a] bg-[#fffaf0] px-3 py-2 text-xs leading-5 text-[#765418]">点击“审批通过并执行”后，才会继续对象写入、函数复核与事务提交。</div>
            <div className="mt-5 flex justify-end gap-2 border-t border-[#edf0f2] pt-4">
              <button type="button" onClick={rejectPlanExecution} className="border border-[#d7dce2] bg-white px-4 py-2 text-sm font-medium text-[#4f5964] hover:bg-[#f4f6f8]">驳回方案</button>
              <button type="button" onClick={approvePlanExecution} className="bg-[#8b5d17] px-4 py-2 text-sm font-medium text-white hover:bg-[#724b11]">审批通过并执行</button>
            </div>
          </div>
        </div>
      )}

      {planWriteConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1d252d]/45 px-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="plan-write-title" aria-describedby="plan-write-description" className="w-full max-w-xl border border-[#d7dfe5] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#edf0f2] pb-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#a13d35]">Write confirmation</div>
                <h2 id="plan-write-title" className="mt-1 text-lg font-semibold text-[#252b33]">确认写入生产计划变更</h2>
              </div>
              <span className="bg-[#f7d9d6] px-2.5 py-1 text-xs font-semibold text-[#96372f]">不可自动撤销</span>
            </div>
            <p id="plan-write-description" className="mt-4 text-sm leading-6 text-[#4f5964]">方案已审批通过。请再次核对即将写入的对象和字段，确认后系统才会提交计划变更。</p>
            <div className="mt-4 border border-[#e3e7eb] bg-[#fafbfc] px-4 py-1">
              <DetailRow label="执行方案" value={planWriteConfirmation.approval.plan} />
              <DetailRow label="销售订单" value={planWriteConfirmation.approval.writeOrders || (planWriteConfirmation.actionId === "select-plan-a" ? "SO-260813-018：一号线 → 二号线；普通订单顺延 1 个班次" : planWriteConfirmation.actionId === "select-plan-b" ? "维持本线优先级；普通订单顺延至下一班次" : "锁定紧急订单交付节点；同步配套工序")} tone="text-[#a13d35]" />
              <DetailRow label="生产线 / 资源" value={planWriteConfirmation.approval.writeResources || (planWriteConfirmation.actionId === "select-plan-a" ? "二号生产线增加 2 小时加班产能" : planWriteConfirmation.actionId === "select-plan-b" ? "二号生产线临时增加 2 小时、40 件备份产能" : "写入跨事业部协同产能窗口")} tone="text-[#a13d35]" />
              <DetailRow label="主计划版本" value={planWriteConfirmation.approval.writeVersion || (planWriteConfirmation.actionId === "select-plan-a" ? "MPS-20260813-V1 → MPS-20260813-V2" : "当前版本生成待发布变更")} tone="text-[#a13d35]" />
              <DetailRow label="事务策略" value="原子写入；失败时整体回滚" tone="text-[#347053]" />
            </div>
            <label className="mt-4 flex items-start gap-3 border border-[#e1e5e9] bg-white px-3 py-3 text-sm leading-5 text-[#46515d]">
              <input type="checkbox" required defaultChecked className="mt-0.5 h-4 w-4 accent-[#9f3d35]" />
              <span>我已核对上述写入内容，并确认按已审批方案更新业务对象与主生产计划。</span>
            </label>
            <div className="mt-4 border-l-2 border-[#c43e35] bg-[#fff7f6] px-3 py-2 text-xs leading-5 text-[#81352f]">确认写入后将执行对象更新、函数复核和事务提交；若任一步骤失败，事务将整体回滚。</div>
            <div className="mt-5 flex justify-end gap-2 border-t border-[#edf0f2] pt-4">
              <button type="button" onClick={cancelPlanWrite} className="border border-[#d7dce2] bg-white px-4 py-2 text-sm font-medium text-[#4f5964] hover:bg-[#f4f6f8]">取消写入</button>
              <button type="button" onClick={confirmPlanWrite} className="bg-[#a13d35] px-4 py-2 text-sm font-medium text-white hover:bg-[#87312b]">确认写入并执行</button>
            </div>
          </div>
        </div>
      )}

      {detailPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d252d]/40 px-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailPanel(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="simulation-detail-title" className="w-full max-w-lg border border-[#dfe3e7] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#edf0f2] pb-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8a949f]">Simulation detail</div>
                <h2 id="simulation-detail-title" className="mt-1 text-base font-semibold text-[#252b33]">{detailPanel === "impact" ? "故障影响传播分析" : "事务执行明细"}</h2>
              </div>
              <button type="button" onClick={() => setDetailPanel(null)} aria-label="关闭弹窗" className="flex h-8 w-8 items-center justify-center border border-[#dce1e6] text-lg leading-none text-[#68717c] hover:bg-[#f3f5f7]">×</button>
            </div>
            {detailPanel === "impact" ? (
              <div className="mt-4 space-y-3 text-sm text-[#46515d]">
                <div className="border-l-2 border-[#c43e35] bg-[#fff7f6] px-3 py-2"><strong className="text-[#a8322b]">计算受影响计划项延期</strong><div className="mt-1 text-xs leading-5">扫描 3 个 ScheduleItem，最大延期 2 天，紧急订单 SO-260813-018 被标记为优先保障对象。</div></div>
                <div className="border-l-2 border-[#855915] bg-[#fffaf0] px-3 py-2"><strong className="text-[#855915]">重算产线负荷</strong><div className="mt-1 text-xs leading-5">故障产线可用产能降为 0，损失 480 件；替代产能 420 件，剩余缺口 60 件。</div></div>
                <div className="border-l-2 border-[#4b67b0] bg-[#f5f7fc] px-3 py-2"><strong className="text-[#3d5797]">检查跨事业部依赖</strong><div className="mt-1 text-xs leading-5">发现 1 条待协调依赖，需要同步前后工序和成套项目交付节点。</div></div>
                <div className="border-l-2 border-[#c43e35] bg-[#fff7f6] px-3 py-2"><strong className="text-[#a8322b]">识别合同交付风险</strong><div className="mt-1 text-xs leading-5">对比承诺交付日期与延期后的完成时间，识别 1 个高风险合同交付节点。</div></div>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-[#46515d]">
                <DetailRow label="事务状态" value="已提交" tone="text-[#347053]" />
                <DetailRow label="计划版本" value="MPS-20260813-V2" />
                <DetailRow label="产线锁" value="已释放" tone="text-[#347053]" />
                <DetailRow label="SAP / MES" value="已同步" tone="text-[#347053]" />
                <DetailRow label="CMMS 维修工单" value="已创建" tone="text-[#347053]" />
              </div>
            )}
            <div className="mt-5 flex justify-end border-t border-[#edf0f2] pt-4"><button type="button" onClick={() => setDetailPanel(null)} className="bg-[#252b33] px-4 py-2 text-sm font-medium text-white hover:bg-[#11161c]">完成</button></div>
          </div>
        </div>
      )}

      <footer className="shrink-0 border-t border-[#e5e8ec] bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3 border border-[#e0e4e8] bg-[#f7f8fa] px-4 py-3 text-xs text-[#7d8690]">
          <SendIcon />
          <span>{isZh ? "这是固定流程模拟，请通过消息卡片中的按钮推进下一步。" : "This is a scripted simulation. Use the card actions to continue."}</span>
        </div>
      </footer>
    </main>
  );
};

export default SimpleChatPage;