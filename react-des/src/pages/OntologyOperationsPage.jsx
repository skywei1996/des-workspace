import React, { useEffect, useMemo, useRef, useState } from "react";
import { loadOntologyEvents, saveOntologyEvents, subscribeOntologyEvents } from "../utils/ontologyEventStorage";
import { loadOntologyDesignCollection } from "../utils/ontologyDesignStorage";
import { deleteOntologyDefinition, fetchOntologyDefinitions, migrateOntologyDefinitions, saveOntologyDefinition } from "../utils/ontologyDefinitionsApi";

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const ACTION_STEP_TYPES = [
  { value: "read_external", zh: "读取外部系统数据", en: "Read external data" },
  { value: "query_objects", zh: "查询 Ontology 对象", en: "Query Ontology objects" },
  { value: "update_object", zh: "更新对象属性", en: "Update object property" },
  { value: "calculate", zh: "计算字段或指标", en: "Calculate value or metric" },
  { value: "evaluate_rule", zh: "评估业务规则", en: "Evaluate business rule" },
  { value: "link_objects", zh: "建立对象关系", en: "Link objects" },
  { value: "create_event", zh: "创建业务事件", en: "Create business event" },
  { value: "trigger_action", zh: "触发后续流程", en: "Trigger downstream workflow" },
  { value: "notify", zh: "发送通知", en: "Send notification" },
];

const createActionStep = (type = "read_external") => ({
  id: makeId("step"),
  name: "",
  type,
  config: {},
});

const findByName = (items, name) => items.find((item) => item.name === name);
const findPropertyByName = (properties, objectTypes, objectName, propertyNames) => {
  const objectType = findByName(objectTypes, objectName);
  return properties.find((property) => property.objectTypeId === objectType?.id && propertyNames.includes(property.apiName || property.name));
};

const buildEquipmentFaultAction = (objectTypes, properties, events, functions, rules) => {
  const faultEvent = events.find((event) => event.id === "event-equipment-fault" || event.name?.includes("故障"));
  const equipmentStatus = findPropertyByName(properties, objectTypes, "生产设备", ["status", "状态"]);
  const equipmentEtaRepair = findPropertyByName(properties, objectTypes, "生产设备", ["etaRepair", "预计修复时间"]);
  const impactFunction = functions.find((item) => item.id === "function-equipment-fault-capacity-impact");
  const deliveryFunction = functions.find((item) => item.id === "function-equipment-fault-delivery-risk");
  const recoveryFunction = functions.find((item) => item.id === "function-equipment-fault-recovery");
  const impactRule = rules.find((rule) => rule.id === "rule-equipment-fault-high-capacity-impact");
  const deliveryRule = rules.find((rule) => rule.id === "rule-equipment-fault-delivery-risk");
  const recoveryRule = rules.find((rule) => rule.id === "rule-equipment-fault-local-recovery");
  if (!faultEvent || !impactFunction || !impactRule) return null;
  const step = (name, type, config) => ({ ...createActionStep(type), name, config });
  return normalizeAction({
    id: "action-equipment-fault-reporting",
    name: "上报设备故障处理编排",
    apiName: "handleEquipmentFaultReport",
    description: "接收 MES 设备故障上报，更新设备状态，重算产能与交付风险，生成变更事件并触发后续重排。",
    objectTypeId: findByName(objectTypes, "生产设备")?.id || objectTypes[0]?.id || "",
    triggerEventId: faultEvent.id,
    steps: [
      step("读取 MES 故障设备", "read_external", { sourceSystem: "MES", resource: "/equipment/faults", syncMode: "single", outputVariable: "faultEquipment" }),
      ...(equipmentStatus ? [step("更新设备故障状态", "update_object", { objectTypeId: equipmentStatus.objectTypeId, propertyId: equipmentStatus.id, targetExpression: "${faultEquipment}", valueExpression: "fault" })] : []),
      ...(equipmentEtaRepair ? [step("写入预计修复时间", "update_object", { objectTypeId: equipmentEtaRepair.objectTypeId, propertyId: equipmentEtaRepair.id, targetExpression: "${faultEquipment}", valueExpression: "${faultEquipment.etaRepair}" })] : []),
      step("查找受影响生产线", "query_objects", { objectTypeId: findByName(objectTypes, "生产线")?.id || "", outputVariable: "affectedLines", filterExpression: "equipmentId == ${faultEquipment.equipmentId}" }),
      ...(impactFunction ? [step("评估产能影响", "calculate", { calculationSource: "function", functionId: impactFunction.id, functionName: impactFunction.name, connectionType: impactFunction.connectionType || "api", endpoint: impactFunction.endpoint || "" })] : []),
      ...(deliveryFunction ? [step("评估订单交付风险", "calculate", { calculationSource: "function", functionId: deliveryFunction.id, functionName: deliveryFunction.name, connectionType: deliveryFunction.connectionType || "api", endpoint: deliveryFunction.endpoint || "" })] : []),
      ...(recoveryFunction ? [step("评估替代产能恢复", "calculate", { calculationSource: "function", functionId: recoveryFunction.id, functionName: recoveryFunction.name, connectionType: recoveryFunction.connectionType || "api", endpoint: recoveryFunction.endpoint || "" })] : []),
      ...(impactRule ? [step("判断产能影响规则", "evaluate_rule", { ruleId: impactRule.id, ruleName: impactRule.name, inputExpression: "{ event: equipmentFault, impact: capacityImpact }", outputVariable: "capacityImpactMatched" })] : []),
      ...(deliveryRule ? [step("判断订单交付规则", "evaluate_rule", { ruleId: deliveryRule.id, ruleName: deliveryRule.name, inputExpression: "{ event: equipmentFault, delivery: deliveryRisk }", outputVariable: "deliveryRiskMatched" })] : []),
      ...(recoveryRule ? [step("判断本地恢复规则", "evaluate_rule", { ruleId: recoveryRule.id, ruleName: recoveryRule.name, inputExpression: "{ event: equipmentFault, recovery: recoveryCapacity }", outputVariable: "localRecoveryMatched" })] : []),
      step("回溯受影响订单", "link_objects", { sourceExpression: "${affectedLines}", targetExpression: "${affectedLines.assignedOrders}", relationApiName: "affectedOrders" }),
      step("生成设备故障变更事件", "create_event", { eventType: "equipmentFault", outputVariable: "changeEvent", payloadExpression: "{ equipment: faultEquipment, lines: affectedLines, capacity: capacityImpact, delivery: deliveryRisk }" }),
      step("触发后续生产重排", "trigger_action", { actionKey: "localReplan", executionMode: "async", inputExpression: "{ event: changeEvent, localRecovery: localRecoveryMatched, deliveryRisk: deliveryRiskMatched }" }),
    ],
  }, objectTypes);
};

const buildMainPlanCompilationEvent = (objectTypes) => normalizeEvent({
  id: "event-main-plan-compilation",
  name: "主计划编制",
  subjectObjectTypeId: findByName(objectTypes, "主生产计划")?.id || findByName(objectTypes, "生产计划")?.id || findByName(objectTypes, "计划")?.id || objectTypes[0]?.id || "",
  triggerSource: "scheduled_check",
  triggerConfig: {
    intervalMinutes: 10080,
    triggerMode: "monthly_or_weekly",
  },
  enabled: true,
}, objectTypes);

const buildMainPlanCompilationAction = (objectTypes, properties, events) => {
  const compilationEvent = events.find((event) => event.id === "event-main-plan-compilation" || event.name?.includes("主计划") || event.name?.includes("生产计划"));
  const planObjectType = findByName(objectTypes, "主生产计划") || findByName(objectTypes, "生产计划") || findByName(objectTypes, "计划") || objectTypes[0];
  const orderObjectType = findByName(objectTypes, "销售订单") || findByName(objectTypes, "订单");
  const lineObjectType = findByName(objectTypes, "生产线") || findByName(objectTypes, "资源");
  if (!compilationEvent || !planObjectType) return null;
  const step = (name, type, config) => ({ ...createActionStep(type), name, config });
  return normalizeAction({
    id: "action-main-plan-compilation",
    name: "编制主生产计划（MPS）",
    apiName: "compileMainProductionPlan",
    description: "在固定时间或手动发起时，汇总订单、产能和约束条件，生成最优主生产计划，并在审批后下发至 SAP 和 MES。",
    objectTypeId: planObjectType.id,
    triggerEventId: compilationEvent.id,
    steps: [
      step("读取多源计划数据", "read_external", { sourceSystem: "SAP+MES+ERP", resource: "/mps/compile", syncMode: "incremental", outputVariable: "mpsInputs" }),
      ...(orderObjectType ? [step("查询待排产订单", "query_objects", { objectTypeId: orderObjectType.id, outputVariable: "pendingOrders", filterExpression: "status == 'approved' && dueDate >= today" })] : []),
      ...(lineObjectType ? [step("查询产线产能与资源日历", "query_objects", { objectTypeId: lineObjectType.id, outputVariable: "lineCapacity", filterExpression: "status != 'offline'" })] : []),
      step("应用多重约束条件", "calculate", { calculationSource: "expression", outputVariable: "feasiblePlan", expression: "applyOrderPriority + applyCapacityBalance + applyMaterialConstraint + applyLeadTimeWindow" }),
      step("生成最优主生产计划候选", "calculate", { calculationSource: "expression", outputVariable: "candidatePlans", expression: "optimizeByPriorityAndCapacity(mpsInputs, pendingOrders, lineCapacity)" }),
      step("校验产能与交付约束", "evaluate_rule", { ruleId: "mps-constraint-check", ruleName: "主计划约束校验", inputExpression: "{ plan: candidatePlans, constraints: mpsInputs }", outputVariable: "constraintPassed" }),
      step("生成主计划变更事件", "create_event", { eventType: "mainPlanCompilation", outputVariable: "mpsEvent", payloadExpression: "{ orders: pendingOrders, lines: lineCapacity, candidatePlan: candidatePlans }" }),
      step("审批后下发 SAP / MES", "trigger_action", { actionKey: "approveAndDispatchMps", executionMode: "async", inputExpression: "{ event: mpsEvent, plan: candidatePlans }" }),
    ],
  }, objectTypes);
};

const normalizeAction = (item = {}, objectTypes = []) => {
  let steps = Array.isArray(item.steps) ? item.steps : [];
  if (!steps.length && item.executionType) {
    const legacyType = item.executionType === "update-ontology"
      ? "update_object"
      : item.executionType === "notify"
        ? "notify"
        : "read_external";
    steps = [{
      ...createActionStep(legacyType),
      name: item.name || "",
      config: legacyType === "read_external"
        ? { sourceSystem: item.sourceSystem || "", syncMode: item.syncMode || "incremental" }
        : {},
    }];
  }
  return {
    ...item,
    id: item.id || makeId("action"),
    name: item.name || "",
    description: item.description || "",
    objectTypeId: item.objectTypeId || objectTypes[0]?.id || "",
    apiName: item.apiName || "",
    triggerEventId: item.triggerEventId || "",
    steps: steps.map((step) => ({
      id: step.id || makeId("step"),
      name: step.name || "",
      type: step.type || "read_external",
      config: step.config || {},
    })),
    enabled: item.enabled !== false,
  };
};

const CONFIG = {
  events: {
    title: "Event Type",
    zhTitle: "事件类型",
    description: "定义对象在什么情况下触发后续规则。",
    storageKey: "workmate-ontology-event-types",
    prefix: "event",
  },
  actions: {
    title: "Workflow Type",
    zhTitle: "流程类型",
    description: "定义事件触发后的业务流程，编排数据读取、规则判断、对象更新与通知等步骤。",
    storageKey: "workmate-ontology-action-types",
    prefix: "action",
  },
};

const loadItems = (key) => {
  try {
    return JSON.parse(window.sessionStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
};

const normalizeEvent = (item = {}, objectTypes = []) => {
  const legacySource = item.triggerType === "schedule" ? "scheduled_check" : "object_change";
  const triggerSource = item.triggerSource || legacySource;
  let triggerConfig = item.triggerConfig || {};
  if (!item.triggerConfig && item.triggerType === "created") triggerConfig = { changeType: "created" };
  if (!item.triggerConfig && item.triggerType === "updated") triggerConfig = { changeType: "field_changed", propertyId: item.propertyId || "" };
  if (!item.triggerConfig && item.triggerType === "schedule") triggerConfig = { intervalMinutes: Number(item.scheduleInterval || 15) };
  return {
    id: item.id || makeId("event"),
    name: item.name || "",
    subjectObjectTypeId: item.subjectObjectTypeId || item.objectTypeId || objectTypes[0]?.id || "",
    triggerSource,
    triggerConfig,
    enabled: item.enabled !== false,
  };
};

const newItem = (mode, objectTypes) => mode === "events" ? {
  ...normalizeEvent({}, objectTypes),
} : normalizeAction({ steps: [createActionStep()] }, objectTypes);

const ActionStepConfig = ({ step, objectTypes, properties, functions, rules, isZh, inputClass, labelClass, onChange }) => {
  const config = step.config || {};
  const patchConfig = (patch) => onChange({ ...step, config: { ...config, ...patch } });
  const objectProperties = properties.filter((property) => property.objectTypeId === config.objectTypeId);

  return <div className="grid grid-cols-2 gap-4">
    {step.type === "read_external" && <>
      <label><span className={labelClass}>{isZh ? "来源系统 *" : "Source system *"}</span><input value={config.sourceSystem || ""} onChange={(event) => patchConfig({ sourceSystem: event.target.value })} placeholder="MES / SAP / WMS" className={inputClass} /></label>
      <label><span className={labelClass}>{isZh ? "资源或接口 *" : "Resource or API *"}</span><input value={config.resource || ""} onChange={(event) => patchConfig({ resource: event.target.value })} placeholder="/equipment/faults" className={inputClass} /></label>
      <label><span className={labelClass}>{isZh ? "读取方式" : "Read mode"}</span><select value={config.syncMode || "incremental"} onChange={(event) => patchConfig({ syncMode: event.target.value })} className={inputClass}><option value="incremental">{isZh ? "增量读取" : "Incremental"}</option><option value="full">{isZh ? "全量读取" : "Full"}</option><option value="single">{isZh ? "读取单条" : "Single record"}</option></select></label>
      <label><span className={labelClass}>{isZh ? "输出变量 *" : "Output variable *"}</span><input value={config.outputVariable || ""} onChange={(event) => patchConfig({ outputVariable: event.target.value })} placeholder="faultEquipment" className={inputClass} /></label>
    </>}
    {step.type === "query_objects" && <>
      <label><span className={labelClass}>{isZh ? "查询对象类型 *" : "Object type *"}</span><select value={config.objectTypeId || ""} onChange={(event) => patchConfig({ objectTypeId: event.target.value })} className={inputClass}><option value="">{isZh ? "选择对象类型" : "Select object type"}</option>{objectTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span className={labelClass}>{isZh ? "输出变量 *" : "Output variable *"}</span><input value={config.outputVariable || ""} onChange={(event) => patchConfig({ outputVariable: event.target.value })} placeholder="affectedLines" className={inputClass} /></label>
      <label className="col-span-2"><span className={labelClass}>{isZh ? "过滤表达式 *" : "Filter expression *"}</span><input value={config.filterExpression || ""} onChange={(event) => patchConfig({ filterExpression: event.target.value })} placeholder="equipmentId == ${faultEquipment.id}" className={inputClass} /></label>
    </>}
    {step.type === "update_object" && <>
      <label><span className={labelClass}>{isZh ? "目标对象类型 *" : "Target object type *"}</span><select value={config.objectTypeId || ""} onChange={(event) => patchConfig({ objectTypeId: event.target.value, propertyId: "" })} className={inputClass}><option value="">{isZh ? "选择对象类型" : "Select object type"}</option>{objectTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span className={labelClass}>{isZh ? "更新属性 *" : "Property *"}</span><select value={config.propertyId || ""} onChange={(event) => patchConfig({ propertyId: event.target.value })} className={inputClass}><option value="">{isZh ? "选择属性" : "Select property"}</option>{objectProperties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span className={labelClass}>{isZh ? "目标对象表达式 *" : "Target expression *"}</span><input value={config.targetExpression || ""} onChange={(event) => patchConfig({ targetExpression: event.target.value })} placeholder="${faultEquipment}" className={inputClass} /></label>
      <label><span className={labelClass}>{isZh ? "赋值表达式 *" : "Value expression *"}</span><input value={config.valueExpression || ""} onChange={(event) => patchConfig({ valueExpression: event.target.value })} placeholder="fault" className={inputClass} /></label>
    </>}
    {step.type === "calculate" && <>
      <label><span className={labelClass}>{isZh ? "计算来源 *" : "Calculation source *"}</span><select value={config.calculationSource || "expression"} onChange={(event) => patchConfig({ calculationSource: event.target.value, functionId: "", functionName: "", connectionType: "", endpoint: "" })} className={inputClass}><option value="expression">{isZh ? "表达式计算" : "Expression"}</option><option value="function">{isZh ? "引用 Function 指标" : "Function metric"}</option></select></label>
      {config.calculationSource === "function" && <label><span className={labelClass}>{isZh ? "Function 指标 *" : "Function metric *"}</span><select value={config.functionId || ""} onChange={(event) => { const nextFunction = functions.find((item) => item.id === event.target.value); patchConfig({ functionId: nextFunction?.id || "", functionName: nextFunction?.name || "", connectionType: nextFunction?.connectionType || "", endpoint: nextFunction?.endpoint || "" }); }} className={inputClass}><option value="">{isZh ? "选择已启用 Function" : "Select an enabled Function"}</option>{functions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{!functions.length && <span className="mt-1.5 block text-xs text-[#c24339]">{isZh ? "暂无可用 Function，请先在“函数”中创建并启用。" : "No enabled Functions. Create and enable one first."}</span>}</label>}
      {config.calculationSource !== "function" && <>
        <label><span className={labelClass}>{isZh ? "输出变量 *" : "Output variable *"}</span><input value={config.outputVariable || ""} onChange={(event) => patchConfig({ outputVariable: event.target.value })} placeholder="capacityLoad" className={inputClass} /></label>
        <label><span className={labelClass}>{isZh ? "结果类型" : "Result type"}</span><select value={config.resultType || "number"} onChange={(event) => patchConfig({ resultType: event.target.value })} className={inputClass}><option value="number">{isZh ? "数字" : "Number"}</option><option value="text">{isZh ? "文本" : "Text"}</option><option value="boolean">{isZh ? "布尔值" : "Boolean"}</option><option value="object">{isZh ? "对象" : "Object"}</option></select></label>
        <label className="col-span-2"><span className={labelClass}>{isZh ? "计算表达式 *" : "Expression *"}</span><textarea value={config.expression || ""} onChange={(event) => patchConfig({ expression: event.target.value })} placeholder="availableCapacity - assignedLoad" className={`${inputClass} min-h-24 py-2`} /></label>
      </>}
    </>}
    {step.type === "evaluate_rule" && <>
      <label><span className={labelClass}>{isZh ? "规则 *" : "Rule *"}</span><select value={config.ruleId || ""} onChange={(event) => { const rule = rules.find((item) => item.id === event.target.value); patchConfig({ ruleId: rule?.id || "", ruleName: rule?.name || "" }); }} className={inputClass}><option value="">{isZh ? "选择已配置规则" : "Select a configured rule"}</option>{rules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}</option>)}</select></label>
      <label><span className={labelClass}>{isZh ? "输出变量 *" : "Output variable *"}</span><input value={config.outputVariable || ""} onChange={(event) => patchConfig({ outputVariable: event.target.value })} placeholder="capacityImpactMatched" className={inputClass} /></label>
      <label className="col-span-2"><span className={labelClass}>{isZh ? "输入参数表达式 *" : "Input expression *"}</span><textarea value={config.inputExpression || ""} onChange={(event) => patchConfig({ inputExpression: event.target.value })} placeholder="{ event: changeEvent, result: capacityImpact }" className={`${inputClass} min-h-24 py-2`} /></label>
    </>}
    {step.type === "link_objects" && <>
      <label><span className={labelClass}>{isZh ? "来源对象表达式 *" : "Source expression *"}</span><input value={config.sourceExpression || ""} onChange={(event) => patchConfig({ sourceExpression: event.target.value })} placeholder="${affectedLines}" className={inputClass} /></label>
      <label><span className={labelClass}>{isZh ? "目标对象表达式 *" : "Target expression *"}</span><input value={config.targetExpression || ""} onChange={(event) => patchConfig({ targetExpression: event.target.value })} placeholder="${affectedOrders}" className={inputClass} /></label>
      <label className="col-span-2"><span className={labelClass}>{isZh ? "关系 API 名称 *" : "Relation API name *"}</span><input value={config.relationApiName || ""} onChange={(event) => patchConfig({ relationApiName: event.target.value })} placeholder="affectedOrders" className={inputClass} /></label>
    </>}
    {step.type === "create_event" && <>
      <label><span className={labelClass}>{isZh ? "事件类型标识 *" : "Event type key *"}</span><input value={config.eventType || ""} onChange={(event) => patchConfig({ eventType: event.target.value })} placeholder="equipmentFault" className={inputClass} /></label>
      <label><span className={labelClass}>{isZh ? "输出变量" : "Output variable"}</span><input value={config.outputVariable || ""} onChange={(event) => patchConfig({ outputVariable: event.target.value })} placeholder="changeEvent" className={inputClass} /></label>
      <label className="col-span-2"><span className={labelClass}>{isZh ? "事件载荷表达式 *" : "Event payload *"}</span><textarea value={config.payloadExpression || ""} onChange={(event) => patchConfig({ payloadExpression: event.target.value })} placeholder="{ equipment: faultEquipment, lines: affectedLines }" className={`${inputClass} min-h-24 py-2`} /></label>
    </>}
    {step.type === "trigger_action" && <>
      <label><span className={labelClass}>{isZh ? "目标流程标识 *" : "Target workflow ID *"}</span><input value={config.actionKey || ""} onChange={(event) => patchConfig({ actionKey: event.target.value })} placeholder="localReplan" className={inputClass} /></label>
      <label><span className={labelClass}>{isZh ? "执行方式" : "Execution mode"}</span><select value={config.executionMode || "async"} onChange={(event) => patchConfig({ executionMode: event.target.value })} className={inputClass}><option value="async">{isZh ? "异步" : "Asynchronous"}</option><option value="sync">{isZh ? "同步等待" : "Synchronous"}</option></select></label>
      <label className="col-span-2"><span className={labelClass}>{isZh ? "输入参数表达式" : "Input expression"}</span><textarea value={config.inputExpression || ""} onChange={(event) => patchConfig({ inputExpression: event.target.value })} placeholder="{ event: changeEvent, capacity: capacityLoad }" className={`${inputClass} min-h-24 py-2`} /></label>
    </>}
    {step.type === "notify" && <>
      <label><span className={labelClass}>{isZh ? "通知渠道 *" : "Channel *"}</span><select value={config.channel || "dingtalk"} onChange={(event) => patchConfig({ channel: event.target.value })} className={inputClass}><option value="dingtalk">{isZh ? "钉钉" : "DingTalk"}</option><option value="email">{isZh ? "邮件" : "Email"}</option><option value="webhook">Webhook</option></select></label>
      <label><span className={labelClass}>{isZh ? "接收人表达式 *" : "Recipient expression *"}</span><input value={config.recipientExpression || ""} onChange={(event) => patchConfig({ recipientExpression: event.target.value })} placeholder="${productionManager}" className={inputClass} /></label>
      <label className="col-span-2"><span className={labelClass}>{isZh ? "消息模板 *" : "Message template *"}</span><textarea value={config.messageTemplate || ""} onChange={(event) => patchConfig({ messageTemplate: event.target.value })} placeholder="设备 ${faultEquipment.name} 发生故障" className={`${inputClass} min-h-24 py-2`} /></label>
    </>}
  </div>;
};

const ObjectTypeMultiSelect = ({ isZh, objectTypes, selectedIds, onChange, labelClass }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const selectedItems = objectTypes.filter((item) => selectedIds.includes(item.id));
  const summary = selectedItems.length === 0
    ? (isZh ? "请选择写入对象" : "Select target objects")
    : selectedItems.length <= 2
      ? selectedItems.map((item) => item.name).join("、")
      : (isZh ? `已选择 ${selectedItems.length} 个对象` : `${selectedItems.length} objects selected`);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (id) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((itemId) => itemId !== id) : [...selectedIds, id]);
  };

  return (
    <div className="col-span-2" ref={containerRef}>
      <span className={labelClass}>{isZh ? "写入对象 *" : "Target objects *"}</span>
      <div className="relative">
        <button type="button" onClick={() => setIsOpen((current) => !current)} className="flex h-10 w-full items-center justify-between rounded border border-[#d9dde3] bg-white px-3 text-left text-sm outline-none focus:border-[#e3473c]">
          <span className={`truncate ${selectedItems.length ? "text-[#252a32]" : "text-[#9aa2ab]"}`}>{summary}</span>
          <svg className={`ml-3 h-4 w-4 shrink-0 text-[#737d88] transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m6 9 6 6 6-6" /></svg>
        </button>
        {isOpen && <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded border border-[#d9dde3] bg-white py-1 shadow-lg">
          {objectTypes.map((item) => {
            const checked = selectedIds.includes(item.id);
            return <button key={item.id} type="button" onClick={() => toggle(item.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-[#f7f8fa]">
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${checked ? "border-[#e3473c] bg-[#e3473c]" : "border-[#aeb5bd] bg-white"}`}>{checked && <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="m5 12 4 4L19 6" /></svg>}</span>
              <span className={checked ? "font-medium text-[#252a32]" : "text-[#59636f]"}>{item.name}</span>
            </button>;
          })}
          {!objectTypes.length && <div className="px-3 py-4 text-center text-xs text-[#9aa2ab]">{isZh ? "暂无对象类型" : "No object types"}</div>}
        </div>}
      </div>
      {!objectTypes.length && <span className="mt-2 block text-xs text-[#c24339]">{isZh ? "请先创建需要写入的对象类型。" : "Create target object types first."}</span>}
      <span className="mt-2 block text-xs text-[#939aa3]">{isZh ? "可从当前 Ontology 中选择多个对象类型。" : "Select multiple object types from the current Ontology."}</span>
    </div>
  );
};

const OntologyOperationsPage = ({ mode, isZh, objectTypes, properties }) => {
  const config = CONFIG[mode];
  const definitionKind = mode === "events" ? "event" : "action";
  const requestedDefinitionId = new URLSearchParams(window.location.search).get("selected");
  const initialItems = useMemo(() => {
    if (mode !== "events") return loadItems(config.storageKey);
    const cachedEvents = loadOntologyEvents();
    return cachedEvents.length ? cachedEvents : loadItems(config.storageKey);
  }, [config.storageKey, mode]);
  const [eventTypes, setEventTypes] = useState(() => {
    const cachedEvents = loadOntologyEvents();
    return cachedEvents.length ? cachedEvents : loadItems(CONFIG.events.storageKey);
  });
  const normalizeItems = (nextItems) => mode === "events"
    ? nextItems.map((item) => normalizeEvent(item, objectTypes))
    : nextItems.map((item) => normalizeAction(item, objectTypes));
  const normalizedInitialItems = normalizeItems(initialItems);
  const [items, setItems] = useState(normalizedInitialItems);
  const [functions, setFunctions] = useState([]);
  const [rules, setRules] = useState([]);
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id || null);
  const [draft, setDraft] = useState(normalizedInitialItems[0] || newItem(mode, objectTypes));
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const eventObjectTypeId = draft.subjectObjectTypeId || draft.objectTypeId;
  const objectProperties = properties.filter((property) => property.objectTypeId === eventObjectTypeId);
  const filteredItems = items.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase()));
  const objectName = (id) => objectTypes.find((item) => item.id === id)?.name || "-";
  const eventName = (id) => eventTypes.find((item) => item.id === id)?.name || "-";
  const inputClass = "h-10 w-full rounded border border-[#d9dde3] bg-white px-3 text-sm outline-none focus:border-[#e3473c]";
  const labelClass = "mb-1.5 block text-xs font-medium text-[#69737e]";

  useEffect(() => subscribeOntologyEvents((nextEvents) => {
    setEventTypes(nextEvents);
    if (mode === "events") setItems(nextEvents.map((item) => normalizeEvent(item, objectTypes)));
  }), [mode]);

  useEffect(() => {
    let active = true;
    const loadDefinitions = async () => {
      try {
        let nextItems = await fetchOntologyDefinitions(definitionKind);
        if (!nextItems.length && initialItems.length) {
          await migrateOntologyDefinitions(definitionKind, initialItems);
          nextItems = await fetchOntologyDefinitions(definitionKind);
        }
        if (mode === "events") {
          const seededEvent = buildMainPlanCompilationEvent(objectTypes);
          const mergedEvents = [...nextItems];
          if (seededEvent && !mergedEvents.some((item) => item.id === seededEvent.id)) {
            mergedEvents.push(seededEvent);
            await saveOntologyEvents(mergedEvents);
          }
          nextItems = mergedEvents;
        }
        if (!active) return;
        const normalizedItems = mode === "events"
          ? nextItems.map((item) => normalizeEvent(item, objectTypes))
          : nextItems.map((item) => normalizeAction(item, objectTypes));
        const requestedItem = normalizedItems.find((item) => item.id === requestedDefinitionId);
        const selectedItem = requestedItem || normalizedItems[0];
        setItems(normalizedItems);
        setSelectedId(selectedItem?.id || null);
        setDraft(selectedItem || newItem(mode, objectTypes));
        if (mode === "events") saveOntologyEvents(normalizedItems);
      } catch (error) {
        if (active) setMessage(isZh ? `数据库加载失败：${error.message}` : `Database load failed: ${error.message}`);
      }
    };
    loadDefinitions();
    return () => { active = false; };
  }, [definitionKind, isZh, mode, objectTypes, requestedDefinitionId]);

  useEffect(() => {
    if (mode !== "actions") return undefined;
    let active = true;
    const loadActionDependencies = async () => {
      try {
        const [loadedEvents, loadedFunctions] = await Promise.all([
          fetchOntologyDefinitions("event"),
          fetchOntologyDefinitions("function"),
        ]);
        let events = loadedEvents;
        const cachedEvents = loadOntologyEvents();
        const legacyEvents = cachedEvents.length ? cachedEvents : loadItems(CONFIG.events.storageKey);
        if (!events.length && legacyEvents.length) {
          await migrateOntologyDefinitions("event", legacyEvents);
          events = await fetchOntologyDefinitions("event");
        }
        const seededEvent = buildMainPlanCompilationEvent(objectTypes);
        if (seededEvent && !events.some((item) => item.id === seededEvent.id)) {
          events = [...events, seededEvent];
          await saveOntologyEvents(events);
        }
        if (!active) return;
        setEventTypes(events);
        const loadedRules = await loadOntologyDesignCollection("workmate-ontology-rules");
        const enabledFunctions = loadedFunctions.filter((item) => item.enabled !== false);
        setFunctions(enabledFunctions);
        setRules(Array.isArray(loadedRules) ? loadedRules : []);
        const seededActions = [
          buildEquipmentFaultAction(objectTypes, properties, events, enabledFunctions, Array.isArray(loadedRules) ? loadedRules : []),
          buildMainPlanCompilationAction(objectTypes, properties, events),
        ].filter(Boolean);
        if (!normalizedInitialItems.length && seededActions.length) {
          for (const seededAction of seededActions) {
            await saveOntologyDefinition("action", seededAction, false);
          }
          setItems(seededActions);
          setSelectedId(seededActions[0]?.id || null);
          setDraft(seededActions[0] || newItem(mode, objectTypes));
        }
        saveOntologyEvents(events);
      } catch {
        // The action editor can still use its current cached event list while the API is unavailable.
      }
    };
    loadActionDependencies();
    return () => { active = false; };
  }, [mode, normalizedInitialItems.length, objectTypes, properties]);

  const patchDraft = (patch) => { setDraft((current) => ({ ...current, ...patch })); setMessage(""); };
  const addActionStep = () => patchDraft({ steps: [...(draft.steps || []), createActionStep()] });
  const updateActionStep = (stepId, nextStep) => patchDraft({ steps: draft.steps.map((step) => step.id === stepId ? nextStep : step) });
  const removeActionStep = (stepId) => patchDraft({ steps: draft.steps.filter((step) => step.id !== stepId) });
  const moveActionStep = (stepIndex, offset) => {
    const targetIndex = stepIndex + offset;
    if (targetIndex < 0 || targetIndex >= draft.steps.length) return;
    const nextSteps = [...draft.steps];
    [nextSteps[stepIndex], nextSteps[targetIndex]] = [nextSteps[targetIndex], nextSteps[stepIndex]];
    patchDraft({ steps: nextSteps });
  };
  const createNew = () => { setSelectedId(null); setDraft(newItem(mode, objectTypes)); setMessage(""); };
  const selectItem = (item) => { setSelectedId(item.id); setDraft(mode === "events" ? normalizeEvent(item, objectTypes) : normalizeAction(item, objectTypes)); setMessage(""); };
  const save = async () => {
    const triggerConfig = draft.triggerConfig || {};
    const missingEventTriggerConfig = mode === "events" && (
      !draft.subjectObjectTypeId || !draft.triggerSource ||
      (draft.triggerSource === "business_action" && (!triggerConfig.operation?.trim() || !triggerConfig.timing)) ||
      (draft.triggerSource === "object_change" && (!triggerConfig.changeType || (triggerConfig.changeType === "field_changed" && !triggerConfig.propertyId))) ||
      (draft.triggerSource === "external_event" && (!triggerConfig.sourceSystem?.trim() || !triggerConfig.integrationType || !triggerConfig.externalEventKey?.trim())) ||
      (draft.triggerSource === "scheduled_check" && !Number(triggerConfig.intervalMinutes))
    );
    const missingActionConfig = mode === "actions" && (
      !draft.apiName?.trim() || !draft.triggerEventId || !(draft.steps || []).length ||
      draft.steps.some((step) => !step.name?.trim() || (
        step.type === "calculate" && (
          step.config?.calculationSource === "function"
            ? !step.config?.functionId
            : (!step.config?.outputVariable?.trim() || !step.config?.expression?.trim())
        )
      ))
    );
    if (!draft.name.trim() || missingEventTriggerConfig || missingActionConfig) {
      setMessage(isZh ? "请填写名称，并完成必填的事件来源或流程配置。" : "Complete the required event source or workflow configuration.");
      return;
    }
    const exists = items.some((item) => item.id === draft.id);
    try {
      const saved = await saveOntologyDefinition(definitionKind, { ...draft, name: draft.name.trim(), apiName: draft.apiName?.trim() }, exists);
      const nextItems = exists ? items.map((item) => item.id === saved.id ? saved : item) : [saved, ...items];
      setItems(nextItems);
      setSelectedId(saved.id);
      setDraft(saved);
      if (mode === "events") saveOntologyEvents(nextItems);
      setMessage(isZh ? "已保存到数据库。" : "Saved to database.");
    } catch (error) {
      setMessage(isZh ? `保存失败：${error.message}` : `Save failed: ${error.message}`);
    }
  };
  const remove = async () => {
    if (!selectedId) return;
    try {
      await deleteOntologyDefinition(selectedId);
      const nextItems = items.filter((item) => item.id !== selectedId);
      const next = nextItems[0] || newItem(mode, objectTypes);
      setItems(nextItems);
      setSelectedId(nextItems[0]?.id || null);
      setDraft(next);
      if (mode === "events") saveOntologyEvents(nextItems);
      setMessage(isZh ? "已从数据库删除。" : "Deleted from database.");
    } catch (error) {
      setMessage(isZh ? `删除失败：${error.message}` : `Delete failed: ${error.message}`);
    }
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f7f8fa] text-[#252a32]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#e2e5e9] bg-white px-7">
        <div><h1 className="text-lg font-semibold">{isZh ? config.zhTitle : config.title}</h1><p className="mt-0.5 text-xs text-[#7b8490]">{isZh ? config.description : mode === "events" ? "Define when an object triggers downstream rules." : "Define event-driven data sync, object updates, and notifications."}</p></div>
        <button type="button" onClick={createNew} className="h-9 rounded bg-[#e3473c] px-4 text-sm font-medium text-white">+ {isZh ? "新建" : "New"}</button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-[#e0e4e8] bg-white">
          <div className="border-b border-[#e7eaed] p-4"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isZh ? "搜索名称" : "Search"} className={`${inputClass} bg-[#fafbfc]`} /></div>
          <div className="flex items-center justify-between px-4 py-3 text-xs font-semibold text-[#68717d]"><span>{isZh ? config.zhTitle : config.title}</span><span>{filteredItems.length}</span></div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredItems.map((item) => <button key={item.id} type="button" onClick={() => selectItem(item)} className={`w-full border-t border-[#eef0f2] px-4 py-3 text-left ${selectedId === item.id ? "border-l-2 border-l-[#e3473c] bg-[#fff6f4]" : "hover:bg-[#f7f8fa]"}`}><div className="truncate text-sm font-medium">{item.name}</div><div className="mt-1 flex justify-between text-[11px] text-[#858e98]"><span>{mode === "events" ? objectName(item.subjectObjectTypeId) : eventName(item.triggerEventId)}</span><span>{item.enabled ? (isZh ? "启用" : "Enabled") : (isZh ? "停用" : "Disabled")}</span></div></button>)}
            {!filteredItems.length && <div className="px-5 py-12 text-center text-xs text-[#959da6]">{isZh ? "暂无配置" : "No items"}</div>}
          </div>
        </aside>
        <section className="min-h-0 overflow-y-auto p-7">
          <div className="mx-auto max-w-[900px]">
            <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-semibold">{selectedId ? draft.name : (isZh ? `新建${config.zhTitle}` : `New ${config.title}`)}</h2><p className="mt-1 text-xs text-[#7c8590]">{isZh ? (mode === "events" ? "定义何时产生业务事件。" : "连接触发事件、编排执行步骤与写入对象。") : (mode === "events" ? "Define when a business event occurs." : "Connect an event, workflow steps, and target objects.")}</p></div><div className="flex gap-2">{selectedId && <button type="button" onClick={remove} className="h-9 rounded border border-[#d9dde3] bg-white px-3 text-sm text-[#b83c34]">{isZh ? "删除" : "Delete"}</button>}<button type="button" onClick={save} className="h-9 rounded bg-[#252b33] px-4 text-sm font-medium text-white">{isZh ? "保存" : "Save"}</button></div></div>
            <div className="border border-[#dfe3e7] bg-white p-6">
              <div className="grid grid-cols-2 gap-5">
                <label><span className={labelClass}>{isZh ? (mode === "events" ? "事件名称 *" : "名称 *") : (mode === "events" ? "Event name *" : "Name *")}</span><input value={draft.name} onChange={(event) => patchDraft({ name: event.target.value })} placeholder={mode === "events" ? (isZh ? "例如：合同金额变化" : "Contract amount changed") : (isZh ? "例如：同步 SAP 增量订单" : "Sync SAP incremental orders")} className={inputClass} /></label>
                {mode === "events" ? <label><span className={labelClass}>{isZh ? "事件主体对象 *" : "Event subject object *"}</span><select value={draft.subjectObjectTypeId} onChange={(event) => patchDraft({ subjectObjectTypeId: event.target.value, triggerConfig: { ...draft.triggerConfig, propertyId: "" } })} className={inputClass}>{objectTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : <label><span className={labelClass}>{isZh ? "流程标识 *" : "Workflow ID *"}</span><input value={draft.apiName || ""} onChange={(event) => patchDraft({ apiName: event.target.value })} placeholder="SyncSAPOrders" className={inputClass} /></label>}
                {mode === "actions" && <label className="col-span-2"><span className={labelClass}>{isZh ? "说明" : "Description"}</span><input value={draft.description} onChange={(event) => patchDraft({ description: event.target.value })} className={inputClass} /></label>}
                {mode === "events" ? <>
                  <label className="col-span-2"><span className={labelClass}>{isZh ? "触发来源 *" : "Trigger source *"}</span><select value={draft.triggerSource} onChange={(event) => patchDraft({ triggerSource: event.target.value, triggerConfig: event.target.value === "object_change" ? { changeType: "field_changed", propertyId: "" } : event.target.value === "scheduled_check" ? { intervalMinutes: 15 } : event.target.value === "business_action" ? { operation: "", timing: "after_success" } : { sourceSystem: "", integrationType: "webhook", externalEventKey: "" } })} className={inputClass}><option value="business_action">{isZh ? "业务操作" : "Business action"}</option><option value="object_change">{isZh ? "对象数据变化" : "Object change"}</option><option value="external_event">{isZh ? "外部系统推送" : "External event"}</option><option value="scheduled_check">{isZh ? "定时条件检查" : "Scheduled check"}</option></select></label>
                  {draft.triggerSource === "business_action" && <><label><span className={labelClass}>{isZh ? "业务操作标识 *" : "Operation key *"}</span><input value={draft.triggerConfig.operation || ""} onChange={(event) => patchDraft({ triggerConfig: { ...draft.triggerConfig, operation: event.target.value } })} placeholder="submit_order" className={inputClass} /></label><label><span className={labelClass}>{isZh ? "触发时机 *" : "Trigger timing *"}</span><select value={draft.triggerConfig.timing || "after_success"} onChange={(event) => patchDraft({ triggerConfig: { ...draft.triggerConfig, timing: event.target.value } })} className={inputClass}><option value="after_success">{isZh ? "操作成功后" : "After success"}</option><option value="before_execute">{isZh ? "操作执行前" : "Before execution"}</option></select></label></>}
                  {draft.triggerSource === "object_change" && <><label><span className={labelClass}>{isZh ? "变化类型 *" : "Change type *"}</span><select value={draft.triggerConfig.changeType || "field_changed"} onChange={(event) => patchDraft({ triggerConfig: { changeType: event.target.value, propertyId: "" } })} className={inputClass}><option value="created">{isZh ? "对象创建" : "Object created"}</option><option value="updated">{isZh ? "对象更新" : "Object updated"}</option><option value="deleted">{isZh ? "对象删除" : "Object deleted"}</option><option value="field_changed">{isZh ? "指定字段变化" : "Field changed"}</option></select></label>{draft.triggerConfig.changeType === "field_changed" && <label><span className={labelClass}>{isZh ? "监听字段 *" : "Watched field *"}</span><select value={draft.triggerConfig.propertyId || ""} onChange={(event) => patchDraft({ triggerConfig: { ...draft.triggerConfig, propertyId: event.target.value } })} className={inputClass}><option value="">{isZh ? "选择字段" : "Select field"}</option>{objectProperties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}</>}
                  {draft.triggerSource === "external_event" && <><label><span className={labelClass}>{isZh ? "来源系统 *" : "Source system *"}</span><input value={draft.triggerConfig.sourceSystem || ""} onChange={(event) => patchDraft({ triggerConfig: { ...draft.triggerConfig, sourceSystem: event.target.value } })} placeholder="WMS" className={inputClass} /></label><label><span className={labelClass}>{isZh ? "接入方式 *" : "Integration type *"}</span><select value={draft.triggerConfig.integrationType || "webhook"} onChange={(event) => patchDraft({ triggerConfig: { ...draft.triggerConfig, integrationType: event.target.value } })} className={inputClass}><option value="webhook">Webhook</option><option value="message_queue">{isZh ? "消息队列" : "Message queue"}</option><option value="api">API</option></select></label><label className="col-span-2"><span className={labelClass}>{isZh ? "外部事件标识 *" : "External event key *"}</span><input value={draft.triggerConfig.externalEventKey || ""} onChange={(event) => patchDraft({ triggerConfig: { ...draft.triggerConfig, externalEventKey: event.target.value } })} placeholder="InventoryChanged" className={inputClass} /></label></>}
                  {draft.triggerSource === "scheduled_check" && <label className="col-span-2"><span className={labelClass}>{isZh ? "检查周期 *" : "Check interval *"}</span><select value={String(draft.triggerConfig.intervalMinutes || 15)} onChange={(event) => patchDraft({ triggerConfig: { intervalMinutes: Number(event.target.value) } })} className={inputClass}><option value="5">{isZh ? "每 5 分钟" : "Every 5 minutes"}</option><option value="15">{isZh ? "每 15 分钟" : "Every 15 minutes"}</option><option value="30">{isZh ? "每 30 分钟" : "Every 30 minutes"}</option><option value="60">{isZh ? "每小时" : "Every hour"}</option><option value="1440">{isZh ? "每天" : "Every day"}</option></select></label>}
                </> : <>
                  <div className="col-span-2 mt-1 border-t border-[#edf0f2] pt-5"><h3 className="text-sm font-semibold">{isZh ? "触发事件" : "Trigger event"}</h3><p className="mt-1 text-xs text-[#89919a]">{isZh ? "事件发生后自动启动此流程。" : "This workflow starts automatically when the event occurs."}</p></div>
                  <label><span className={labelClass}>{isZh ? "选择事件 *" : "Event *"}</span><select value={draft.triggerEventId || ""} onChange={(event) => patchDraft({ triggerEventId: event.target.value })} className={inputClass}><option value="">{isZh ? "选择已启用事件" : "Select an enabled event"}</option>{eventTypes.filter((item) => item.enabled).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                  <div className="flex items-end pb-1 text-xs text-[#727b86]">{draft.triggerEventId ? `${eventName(draft.triggerEventId)} → ${draft.apiName || (isZh ? "当前流程" : "current workflow")}` : (eventTypes.some((item) => item.enabled) ? (isZh ? "选择事件后将自动建立触发关系。" : "Select an event to create the trigger relation.") : (isZh ? "暂无可用事件，请先在“事件类型”中创建并启用事件。" : "No enabled events. Create and enable one in Event Types."))}</div>
                  <div className="col-span-2 mt-1 flex items-center justify-between border-t border-[#edf0f2] pt-5"><div><h3 className="text-sm font-semibold">{isZh ? "流程步骤" : "Workflow steps"}</h3><p className="mt-1 text-xs text-[#89919a]">{isZh ? "按执行顺序编排流程步骤，每种步骤显示对应的业务参数。" : "Compose workflow steps in execution order with type-specific parameters."}</p></div><button type="button" onClick={addActionStep} className="h-8 rounded border border-[#d9dde3] bg-white px-3 text-xs font-medium text-[#343b44] hover:bg-[#f7f8fa]">+ {isZh ? "添加步骤" : "Add step"}</button></div>
                  <div className="col-span-2 space-y-4">
                    {(draft.steps || []).map((step, stepIndex) => <div key={step.id} className="border border-[#dfe3e7] bg-[#fafbfc]">
                      <div className="flex items-center gap-3 border-b border-[#e5e8eb] bg-white px-4 py-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#252b33] text-xs font-semibold text-white">{stepIndex + 1}</span>
                        <input value={step.name || ""} onChange={(event) => updateActionStep(step.id, { ...step, name: event.target.value })} placeholder={isZh ? "步骤名称，例如：更新设备状态" : "Step name"} className="h-9 min-w-0 flex-1 rounded border border-[#d9dde3] bg-white px-3 text-sm outline-none focus:border-[#e3473c]" />
                        <select value={step.type} onChange={(event) => updateActionStep(step.id, { ...createActionStep(event.target.value), id: step.id })} className="h-9 w-48 rounded border border-[#d9dde3] bg-white px-2 text-sm outline-none focus:border-[#e3473c]">{ACTION_STEP_TYPES.map((type) => <option key={type.value} value={type.value}>{isZh ? type.zh : type.en}</option>)}</select>
                        <div className="flex shrink-0 gap-1">
                          <button type="button" onClick={() => moveActionStep(stepIndex, -1)} disabled={stepIndex === 0} title={isZh ? "上移" : "Move up"} className="flex h-8 w-8 items-center justify-center rounded border border-[#d9dde3] bg-white text-sm disabled:opacity-30">↑</button>
                          <button type="button" onClick={() => moveActionStep(stepIndex, 1)} disabled={stepIndex === draft.steps.length - 1} title={isZh ? "下移" : "Move down"} className="flex h-8 w-8 items-center justify-center rounded border border-[#d9dde3] bg-white text-sm disabled:opacity-30">↓</button>
                          <button type="button" onClick={() => removeActionStep(step.id)} title={isZh ? "删除步骤" : "Delete step"} className="flex h-8 w-8 items-center justify-center rounded border border-[#edd4d1] bg-white text-sm text-[#c54238]">×</button>
                        </div>
                      </div>
                        <div className="p-4"><ActionStepConfig step={step} objectTypes={objectTypes} properties={properties} functions={functions} rules={rules} isZh={isZh} inputClass={inputClass} labelClass={labelClass} onChange={(nextStep) => updateActionStep(step.id, nextStep)} /></div>
                    </div>)}
                    {!(draft.steps || []).length && <div className="border border-dashed border-[#cfd5db] bg-[#fafbfc] px-4 py-10 text-center text-sm text-[#858e98]">{isZh ? "暂无流程步骤，请添加第一个步骤。" : "No workflow steps. Add the first step."}</div>}
                  </div>
                </>}
                <label className="col-span-2 flex items-center gap-2 border-t border-[#edf0f2] pt-5 text-sm"><input type="checkbox" checked={draft.enabled} onChange={(event) => patchDraft({ enabled: event.target.checked })} className="accent-[#e3473c]" />{isZh ? "启用此类型" : "Enable this type"}</label>
              </div>
            </div>
            <div className={`mt-4 text-right text-xs ${message.includes("请") || message.includes("Complete") ? "text-[#d94338]" : "text-[#39805f]"}`}>{message}</div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default OntologyOperationsPage;