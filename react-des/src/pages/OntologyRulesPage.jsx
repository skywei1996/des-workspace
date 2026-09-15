import React, { useEffect, useMemo, useState } from "react";
import { fetchOntologyDefinitions } from "../utils/ontologyDefinitionsApi";
import { loadOntologyDesignCollection, saveOntologyDesignCollection } from "../utils/ontologyDesignStorage";

const makeId = () => `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const RULES_STORAGE_KEY = "workmate-ontology-rules";
const makeCondition = (sourceType = "property") => ({ id: makeId(), sourceType, functionId: "", fieldId: "", operator: "equals", value: "" });

const functionFieldsFromDefinitions = (definitions) => definitions
  .filter((definition) => definition.enabled !== false)
  .flatMap((definition) => (definition.outputFields || definition.outputs || definition.fields || []).map((output) => ({
    id: `${definition.id}:${output.id || output.apiName || output.name}`,
    name: output.name || output.displayName || output.apiName,
    apiName: output.id || output.apiName || output.name,
    dataType: output.dataType || output.type || "text",
    functionId: definition.id,
    functionName: definition.name,
    objectTypeId: definition.objectTypeId || output.objectTypeId || "",
  })))
  .filter((field) => field.name);

const normalizeRule = (rule) => {
  if (!rule) return rule;
  const legacyCondition = rule.condition || {};
  return {
    ...rule,
    validationDimension: rule.validationDimension || rule.name || "",
    mismatchHandling: rule.mismatchHandling || "",
    conditions: (Array.isArray(rule.conditions) ? rule.conditions : [{
      id: makeId(),
      sourceType: legacyCondition.sourceType || (String(legacyCondition.fieldId || "").startsWith("function:") ? "function" : "property"),
      fieldId: String(legacyCondition.fieldId || "").replace(/^(property|function):/, "") || legacyCondition.propertyId || "",
      operator: legacyCondition.operator || "equals",
      value: legacyCondition.value || "",
    }]).map((condition) => ({
      ...condition,
      sourceType: condition.sourceType || (String(condition.fieldId || "").startsWith("function:") ? "function" : "property"),
      functionId: condition.functionId || (String(condition.fieldId || "").includes(":") ? String(condition.fieldId).split(":")[0] : ""),
      fieldId: String(condition.fieldId || "").replace(/^(property|function):/, ""),
    })),
  };
};

const createDraft = (objectTypes) => ({
  id: makeId(),
  name: "",
  validationDimension: "",
  description: "",
  mismatchHandling: "",
  objectTypeId: objectTypes[0]?.id || "",
  status: "draft",
  conditions: [makeCondition()],
  updatedAt: new Date().toISOString(),
});

const findProperty = (properties, objectTypeId, apiName) => properties.find((item) => item.objectTypeId === objectTypeId && String(item.apiName || "").toLowerCase() === apiName.toLowerCase());
const findFunctionField = (fields, functionId, apiName) => fields.find((item) => item.functionId === functionId && item.apiName === apiName);

const buildEquipmentFaultRules = (objectTypes, properties, functionFields) => {
  const eventType = objectTypes.find((item) => item.name === "变更事件") || objectTypes.find((item) => item.name.includes("事件"));
  if (!eventType) return [];
  const eventKind = findProperty(properties, eventType.id, "type");
  const severity = findProperty(properties, eventType.id, "severity");
  const impactRate = findFunctionField(functionFields, "function-equipment-fault-capacity-impact", "impact_rate");
  const capacityRisk = findFunctionField(functionFields, "function-equipment-fault-capacity-impact", "risk_level");
  const delayDays = findFunctionField(functionFields, "function-equipment-fault-delivery-risk", "max_delay_days");
  const urgentOrders = findFunctionField(functionFields, "function-equipment-fault-delivery-risk", "urgent_order_count");
  const coverageRate = findFunctionField(functionFields, "function-equipment-fault-recovery", "replacement_coverage_rate");
  const baseCondition = eventKind ? [{ id: makeId(), sourceType: "property", fieldId: eventKind.id, operator: "equals", value: "equipmentFault" }] : [];
  const definitions = [
    {
      id: "rule-equipment-fault-high-capacity-impact",
      name: "设备故障高产能影响预警",
      validationDimension: "产能影响",
      description: "设备故障导致产能影响率达到 30% 且风险等级为高时命中。",
      mismatchHandling: "标记为高风险，进入跨产线产能协调与局部重排评估。",
      conditions: [...baseCondition, impactRate && { id: makeId(), sourceType: "function", fieldId: impactRate.id, operator: "greaterOrEqual", value: "0.3" }, capacityRisk && { id: makeId(), sourceType: "function", fieldId: capacityRisk.id, operator: "equals", value: "high" }].filter(Boolean),
    },
    {
      id: "rule-equipment-fault-delivery-risk",
      name: "设备故障关键订单交付风险",
      validationDimension: "订单交付",
      description: "故障影响紧急订单且最大延期达到 2 天时命中。",
      mismatchHandling: "标记交付风险，通知计划员核查受影响订单并生成调整建议。",
      conditions: [...baseCondition, urgentOrders && { id: makeId(), sourceType: "function", fieldId: urgentOrders.id, operator: "greaterOrEqual", value: "1" }, delayDays && { id: makeId(), sourceType: "function", fieldId: delayDays.id, operator: "greaterOrEqual", value: "2" }].filter(Boolean),
    },
    {
      id: "rule-equipment-fault-local-recovery",
      name: "设备故障可本地消化",
      validationDimension: "恢复能力",
      description: "替代产能覆盖率达到 80% 且事件不是高严重等级时命中。",
      mismatchHandling: "优先采用替代设备或加班产能；覆盖率不足时升级为跨部门协调。",
      conditions: [...baseCondition, coverageRate && { id: makeId(), sourceType: "function", fieldId: coverageRate.id, operator: "greaterOrEqual", value: "0.8" }, severity && { id: makeId(), sourceType: "property", fieldId: severity.id, operator: "notEquals", value: "high" }].filter(Boolean),
    },
  ];
  return definitions.filter((rule) => rule.conditions.length > baseCondition.length).map((rule) => ({ ...rule, objectTypeId: eventType.id, status: "published", updatedAt: new Date().toISOString() }));
};

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);

const RuleFlowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
    <path d="M7 4h10v5H7zM7 15h10v5H7zM12 9v6" />
  </svg>
);

const operatorsByType = {
  数字: [["equals", "等于"], ["greaterThan", "大于"], ["lessThan", "小于"], ["greaterOrEqual", "大于等于"]],
  number: [["equals", "等于"], ["greaterThan", "大于"], ["lessThan", "小于"], ["greaterOrEqual", "大于等于"]],
  日期: [["equals", "等于"], ["after", "晚于"], ["before", "早于"]],
  布尔: [["equals", "等于"]],
  default: [["equals", "等于"], ["notEquals", "不等于"], ["contains", "包含"], ["isEmpty", "为空"]],
};

const OntologyRulesPage = ({ isZh, objectTypes, properties }) => {
  const requestedDefinitionId = new URLSearchParams(window.location.search).get("selected");
  const [rules, setRules] = useState([]);
  const [functionFields, setFunctionFields] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(() => createDraft(objectTypes));
  const [query, setQuery] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const objectProperties = useMemo(
    () => properties.filter((property) => property.objectTypeId === draft.objectTypeId),
    [draft.objectTypeId, properties],
  );
  const availableFunctionFields = useMemo(
    () => functionFields.filter((field) => !field.objectTypeId || field.objectTypeId === draft.objectTypeId),
    [draft.objectTypeId, functionFields],
  );
  const availableFunctions = useMemo(
    () => Array.from(new Map(availableFunctionFields.map((field) => [field.functionId, { id: field.functionId, name: field.functionName }])).values()),
    [availableFunctionFields],
  );
  const filteredRules = rules.filter((rule) => `${rule.name} ${rule.description}`.toLowerCase().includes(query.trim().toLowerCase()));
  const objectName = (id) => objectTypes.find((item) => item.id === id)?.name || "-";
  const propertyName = (id) => properties.find((item) => item.id === id)?.name || "未选择";
  const fieldMeta = (fieldId, sourceType) => {
    if (sourceType === "property") {
      const property = objectProperties.find((item) => item.id === fieldId);
      return property ? { ...property, source: "property" } : null;
    }
    if (sourceType === "function") {
      const field = availableFunctionFields.find((item) => item.id === fieldId);
      return field ? { ...field, source: "function" } : null;
    }
    return null;
  };
  const fieldName = (fieldId, sourceType) => fieldMeta(fieldId, sourceType)?.name || (isZh ? "未选择" : "Not selected");

  useEffect(() => {
    let active = true;
    const loadRuleData = async () => {
      try {
        const [savedRules, definitions] = await Promise.all([
          loadOntologyDesignCollection(RULES_STORAGE_KEY),
          fetchOntologyDefinitions("function"),
        ]);
        if (!active) return;
        const fields = functionFieldsFromDefinitions(definitions);
        setFunctionFields(fields);
        let nextRules = Array.isArray(savedRules) ? savedRules.map(normalizeRule) : [];
        if (!nextRules.length) {
          nextRules = buildEquipmentFaultRules(objectTypes, properties, fields).map(normalizeRule);
          if (nextRules.length) await saveOntologyDesignCollection(RULES_STORAGE_KEY, nextRules);
        }
        if (!active) return;
        const requestedRule = nextRules.find((rule) => rule.id === requestedDefinitionId);
        const selectedRule = requestedRule || nextRules[0];
        setRules(nextRules);
        setSelectedId(selectedRule?.id || null);
        setDraft(selectedRule || createDraft(objectTypes));
      } catch (error) {
        if (active) setSaveMessage(isZh ? `规则加载失败：${error.message}` : `Rule load failed: ${error.message}`);
      }
    };
    loadRuleData();
    return () => { active = false; };
  }, [isZh, objectTypes, properties, requestedDefinitionId]);

  const patchDraft = (patch) => {
    setDraft((current) => ({ ...current, ...patch }));
    setSaveMessage("");
  };

  const updateCondition = (conditionId, patch) => {
    patchDraft({
      conditions: draft.conditions.map((condition) => condition.id === conditionId ? { ...condition, ...patch } : condition),
    });
  };

  const addCondition = () => patchDraft({ conditions: [...draft.conditions, makeCondition()] });

  const removeCondition = (conditionId) => {
    if (draft.conditions.length === 1) return;
    patchDraft({ conditions: draft.conditions.filter((condition) => condition.id !== conditionId) });
  };

  const selectRule = (rule) => {
    setSelectedId(rule.id);
    setDraft(normalizeRule(JSON.parse(JSON.stringify(rule))));
    setSaveMessage("");
  };

  const newRule = () => {
    const next = createDraft(objectTypes);
    setSelectedId(null);
    setDraft(next);
    setSaveMessage("");
  };

  const saveRule = async () => {
    const missingThreshold = draft.conditions.some((condition) => !condition.fieldId || (condition.operator !== "isEmpty" && String(condition.value).trim() === ""));
    if (!draft.name.trim() || !draft.validationDimension.trim() || !draft.objectTypeId || missingThreshold || !draft.mismatchHandling.trim()) {
      setSaveMessage(isZh ? "请填写规则名称、校验维度、对象、每个条件阈值和不一致处置。" : "Complete the rule name, validation dimension, object, conditions, and mismatch handling.");
      return;
    }
    const saved = {
      ...draft,
      name: draft.name.trim(),
      validationDimension: draft.validationDimension.trim(),
      mismatchHandling: draft.mismatchHandling.trim(),
      updatedAt: new Date().toISOString(),
    };
    const nextRules = rules.some((rule) => rule.id === saved.id)
      ? rules.map((rule) => rule.id === saved.id ? saved : rule)
      : [saved, ...rules];
    try {
      await saveOntologyDesignCollection(RULES_STORAGE_KEY, nextRules);
      setRules(nextRules);
      setSelectedId(saved.id);
      setDraft(saved);
      setSaveMessage(isZh ? "规则已保存到数据库。" : "Rule saved to database.");
    } catch (error) {
      setSaveMessage(isZh ? `保存失败：${error.message}` : `Save failed: ${error.message}`);
    }
  };

  const deleteRule = async () => {
    if (!selectedId) return;
    const nextRules = rules.filter((rule) => rule.id !== selectedId);
    try {
      await saveOntologyDesignCollection(RULES_STORAGE_KEY, nextRules);
      setRules(nextRules);
      const next = nextRules[0] || createDraft(objectTypes);
      setSelectedId(nextRules[0]?.id || null);
      setDraft(next);
      setSaveMessage(isZh ? "规则已从数据库删除。" : "Rule deleted from database.");
    } catch (error) {
      setSaveMessage(isZh ? `删除失败：${error.message}` : `Delete failed: ${error.message}`);
    }
  };

  const inputClass = "h-9 w-full rounded border border-[#d9dde3] bg-white px-3 text-sm text-[#303842] outline-none focus:border-[#e3473c]";
  const labelClass = "mb-1.5 block text-xs font-medium text-[#69737e]";

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f7f8fa] text-[#252a32]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#e2e5e9] bg-white px-7">
        <div>
          <h1 className="text-lg font-semibold">{isZh ? "规则" : "Rules"}</h1>
          <p className="mt-0.5 text-xs text-[#7b8490]">{isZh ? "通过对象属性或 Function 输出定义业务判断。" : "Define business logic with object properties or Function outputs."}</p>
        </div>
        <button type="button" onClick={newRule} className="h-9 rounded bg-[#e3473c] px-4 text-sm font-medium text-white">+ {isZh ? "新建规则" : "New rule"}</button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-[#e0e4e8] bg-white">
          <div className="border-b border-[#e7eaed] p-4">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a939e]"><SearchIcon /></span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isZh ? "搜索规则" : "Search rules"} className="h-9 w-full rounded border border-[#d9dde3] bg-[#fafbfc] pl-9 pr-3 text-sm outline-none focus:border-[#e3473c]" />
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-xs font-semibold text-[#68717d]">
            <span>{isZh ? "规则" : "Rules"}</span><span>{filteredRules.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredRules.map((rule) => (
              <button key={rule.id} type="button" onClick={() => selectRule(rule)} className={`w-full border-t border-[#eef0f2] px-4 py-3 text-left transition ${selectedId === rule.id ? "border-l-2 border-l-[#e3473c] bg-[#fff6f4]" : "hover:bg-[#f7f8fa]"}`}>
                <div className="truncate text-sm font-medium text-[#303740]">{rule.name}</div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-[#858e98]"><span>{objectName(rule.objectTypeId)}</span><span>{rule.status === "published" ? "已发布" : "草稿"}</span></div>
              </button>
            ))}
            {!filteredRules.length && <div className="px-5 py-12 text-center text-xs text-[#959da6]">{isZh ? "暂无规则" : "No rules"}</div>}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto p-6">
          <div className="mx-auto max-w-[1040px]">
            <div className="mb-5 flex items-center justify-between">
              <div><h2 className="text-xl font-semibold">{selectedId ? draft.name : (isZh ? "新建规则" : "New rule")}</h2><p className="mt-1 text-xs text-[#7c8590]">{isZh ? "草稿不会影响生产数据。" : "Drafts do not affect production data."}</p></div>
              <div className="flex gap-2">
                {selectedId && <button type="button" onClick={deleteRule} className="h-9 rounded border border-[#d9dde3] bg-white px-3 text-sm text-[#b83c34]">{isZh ? "删除" : "Delete"}</button>}
                <button type="button" onClick={saveRule} className="h-9 rounded bg-[#252b33] px-4 text-sm font-medium text-white">{isZh ? "保存" : "Save"}</button>
              </div>
            </div>

            <div className="border border-[#dfe3e7] bg-white p-5">
              <div className="grid grid-cols-2 gap-4">
                <label><span className={labelClass}>{isZh ? "规则名称 *" : "Rule name *"}</span><input value={draft.name} onChange={(event) => patchDraft({ name: event.target.value })} placeholder={isZh ? "例如：高金额合同预警" : "High-value contract alert"} className={inputClass} /></label>
                <label><span className={labelClass}>{isZh ? "校验维度 *" : "Validation dimension *"}</span><input value={draft.validationDimension} onChange={(event) => patchDraft({ validationDimension: event.target.value })} placeholder={isZh ? "例如：产能影响" : "Capacity impact"} className={inputClass} /></label>
                <label><span className={labelClass}>{isZh ? "作用对象 *" : "Object type *"}</span><select value={draft.objectTypeId} onChange={(event) => patchDraft({ objectTypeId: event.target.value, conditions: [makeCondition()] })} className={inputClass}><option value="">{isZh ? "选择对象" : "Select object"}</option>{objectTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="col-span-2"><span className={labelClass}>{isZh ? "规则说明" : "Description"}</span><input value={draft.description} onChange={(event) => patchDraft({ description: event.target.value })} placeholder={isZh ? "说明规则的业务目的" : "Describe the business purpose"} className={inputClass} /></label>
                <label className="col-span-2"><span className={labelClass}>{isZh ? "不一致处置 *" : "Mismatch handling *"}</span><input value={draft.mismatchHandling} onChange={(event) => patchDraft({ mismatchHandling: event.target.value })} placeholder={isZh ? "说明规则命中后应采取的业务处置，不直接修改对象数据" : "Describe the business handling without mutating object data"} className={inputClass} /></label>
              </div>
            </div>

            <div className="my-2 ml-8 h-6 border-l border-dashed border-[#aeb7c1]" />
            <div className="border border-[#dfe3e7] bg-white">
              <div className="flex items-center justify-between border-b border-[#e7eaed] px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded bg-[#eef5f8] text-[#52778d]"><RuleFlowIcon /></span><div><h3 className="text-sm font-semibold">{isZh ? "条件过滤" : "Condition filter"}</h3><p className="text-xs text-[#818a95]">{isZh ? "所有属性或函数字段条件同时满足时命中规则" : "Match the rule when all property or Function conditions pass"}</p></div></div><button type="button" onClick={addCondition} className="h-8 rounded border border-[#d9dde3] bg-white px-3 text-xs font-medium text-[#434b55] hover:border-[#e3473c] hover:text-[#d94338]">+ {isZh ? "添加条件" : "Add condition"}</button></div>
              <div className="divide-y divide-[#edf0f2] px-5">
                {draft.conditions.map((condition, index) => {
                  const selectedField = fieldMeta(condition.fieldId, condition.sourceType);
                  const functionFields = availableFunctionFields.filter((field) => field.functionId === condition.functionId);
                  const operators = operatorsByType[selectedField?.dataType] || operatorsByType.default;
                  return (
                    <div key={condition.id} className="grid grid-cols-[52px_minmax(0,1fr)_36px] gap-4 py-5">
                      <div className="pt-7 text-center text-[11px] font-semibold text-[#8a939e]">{index === 0 ? (isZh ? "当" : "IF") : "AND"}</div>
                      <div className="min-w-0 space-y-4">
                        <div className={`grid gap-4 ${condition.sourceType === "function" ? "grid-cols-[160px_minmax(220px,1.35fr)_minmax(180px,1fr)]" : "grid-cols-[160px_minmax(260px,1fr)]"}`}>
                          <label><span className={labelClass}>{isZh ? "字段类型" : "Field type"}</span><select value={condition.sourceType} onChange={(event) => updateCondition(condition.id, { sourceType: event.target.value, functionId: "", fieldId: "", operator: "equals", value: "" })} className={inputClass}><option value="property">{isZh ? "属性" : "Property"}</option><option value="function">{isZh ? "函数字段" : "Function field"}</option></select></label>
                          {condition.sourceType === "function" ? <>
                            <label><span className={labelClass}>{isZh ? "函数" : "Function"}</span><select value={condition.functionId || ""} onChange={(event) => updateCondition(condition.id, { functionId: event.target.value, fieldId: "", operator: "equals", value: "" })} className={inputClass}><option value="">{isZh ? "选择函数" : "Select Function"}</option>{availableFunctions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                            <label><span className={labelClass}>{isZh ? "返回字段" : "Return field"}</span><select value={condition.fieldId} onChange={(event) => updateCondition(condition.id, { fieldId: event.target.value, operator: "equals", value: "" })} className={inputClass}><option value="">{isZh ? "选择返回字段" : "Select return field"}</option>{functionFields.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                          </> : <label><span className={labelClass}>{isZh ? "字段" : "Field"}</span><select value={condition.fieldId} onChange={(event) => updateCondition(condition.id, { fieldId: event.target.value, operator: "equals", value: "" })} className={inputClass}><option value="">{isZh ? "选择字段" : "Select field"}</option>{objectProperties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
                        </div>
                        <div className="grid max-w-[560px] grid-cols-[200px_minmax(220px,1fr)] gap-4">
                          <label><span className={labelClass}>{isZh ? "操作符" : "Operator"}</span><select value={condition.operator} onChange={(event) => updateCondition(condition.id, { operator: event.target.value })} className={inputClass}>{operators.map(([value, label]) => <option key={value} value={value}>{isZh ? label : value}</option>)}</select></label>
                          <label><span className={labelClass}>{isZh ? "阈值" : "Threshold"}</span><input disabled={condition.operator === "isEmpty"} value={condition.value} onChange={(event) => updateCondition(condition.id, { value: event.target.value })} placeholder={isZh ? "输入触发阈值" : "Enter threshold"} className={`${inputClass} disabled:bg-[#f1f3f5]`} /></label>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeCondition(condition.id)} disabled={draft.conditions.length === 1} title={isZh ? "删除条件" : "Delete condition"} className="mt-6 flex h-9 w-9 items-center justify-center rounded border border-[#d9dde3] bg-white text-lg text-[#8b949f] hover:border-[#d94338] hover:text-[#d94338] disabled:cursor-not-allowed disabled:opacity-35">×</button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border border-[#dfe3e7] bg-[#fafbfc] px-5 py-4">
              <div className="text-sm text-[#4f5964]"><strong>{isZh ? "规则摘要：" : "Summary: "}</strong>{draft.validationDimension || "-"} · {objectName(draft.objectTypeId)} · {draft.conditions.map((condition) => `${fieldName(condition.fieldId, condition.sourceType)} ${condition.value || "-"}`).join(" AND ")} · {draft.mismatchHandling || "-"}</div>
              <span className={`text-xs ${saveMessage.includes("请") || saveMessage.includes("Complete") ? "text-[#d94338]" : "text-[#39805f]"}`}>{saveMessage}</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default OntologyRulesPage;