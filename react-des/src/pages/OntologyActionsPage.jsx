import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import OntologyProjectWorkspace from "../components/OntologyProjectWorkspace";
import {
  deleteOntologyDefinition,
  fetchOntologyDefinitions,
  saveOntologyDefinition,
} from "../utils/ontologyDefinitionsApi";
import { getModelingProject, listModelingObjects, listModelingProperties } from "../utils/ontologyModelingApi";

const sections = [
  ["basic", "基本信息"],
  ["trigger", "触发方式"],
  ["parameters", "参数"],
  ["functions", "关联函数"],
  ["preconditions", "前置条件"],
  ["approvals", "权限与审批"],
  ["effects", "副作用"],
  ["integration", "回写与审计"],
];

const inputClass = "h-10 w-full border border-[#d9dde3] bg-white px-3 text-sm outline-none focus:border-[#e3473c]";
const labelClass = "mb-1.5 block text-xs font-medium text-[#69737e]";
const selectClass = `${inputClass} appearance-none`;

const createParameter = () => ({ name: "", type: "string", required: false, defaultValue: "", description: "", source: "manual", objectTypeId: "", propertyId: "", multiple: false });
const createPrecondition = () => ({ mode: "property", scope: "single", quantifier: "all", candidateSet: "", objectTypeId: "", propertyId: "", field: "", operator: "equals", value: "", description: "" });
const createEffect = () => ({ type: "update_object", objectTypeId: "", propertyId: "", relationType: "", description: "" });
const createFunctionBinding = (role = "input") => ({ role, functionId: "", description: "", required: true });
const createApprovalStep = () => ({ name: "", approverType: "role", approvers: [], managerLevels: 1, mode: "any" });
const createWriteback = () => ({ enabled: false, system: "SAP", mode: "async", endpoint: "", retryCount: 3, retryIntervalSeconds: 60, failurePolicy: "queue" });
const createAudit = () => ({ enabled: true, recordInitiator: true, recordApprovals: true, recordFunctionCalls: true, recordChanges: true, retentionDays: 365 });
const sampleExecutionContext = { orderStatus: "approved", orderStatuses: ["approved", "approved"], workDate: "2026-09-16", materialReady: true, capacityAvailable: true, currentUserRole: "计划负责人", approvalResult: "approved" };
const functionRoles = [
  { key: "input", label: "数据准备", description: "读取、汇聚和标准化动作输入。" },
  { key: "validation", label: "业务校验", description: "校验约束与数据完整性，不负责生成方案。" },
  { key: "solver", label: "求解计算", description: "调用算法或求解器生成候选结果。" },
  { key: "postprocess", label: "结果处理", description: "解释、评分或整理求解结果。" },
];
const productionActionOrder = [
  "编制主生产计划",
  "执行产能校验",
  "生成排产方案",
  "提交主计划审批",
  "发布主计划",
  "重排受影响任务",
];

const createDraft = (projectId) => ({
  id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  projectId,
  name: "",
  description: "",
  objectTypeId: "",
  trigger: { type: "manual", config: { value: "" } },
  parameters: [],
  preconditions: [],
  approvals: { enabled: false, initiatorRoles: [], initiatorUsers: [], steps: [], mode: "any", roles: [], timeoutHours: "", onReject: "block" },
  effects: [],
  functions: [],
  writeback: createWriteback(),
  audit: createAudit(),
  enabled: true,
});

function inferFunctionRole(binding, functions) {
  if (binding.role) return binding.role;
  const text = `${functions.find((item) => item.id === binding.functionId)?.name || ""} ${binding.description || ""}`;
  if (/校验|检查|验证/.test(text)) return "validation";
  if (/求解|排产|生成/.test(text)) return "solver";
  if (/解释|评分|结果/.test(text)) return "postprocess";
  return "input";
}

function normalizeAction(item, functions) {
  const triggerConfig = { ...(item.trigger?.config || {}) };
  delete triggerConfig.roles;
  return {
    ...item,
    trigger: { ...(item.trigger || { type: "manual" }), config: triggerConfig },
    functions: (item.functions || []).map((binding) => ({ ...binding, role: inferFunctionRole(binding, functions) })),
    preconditions: (item.preconditions || []).map((condition) => typeof condition === "string" ? condition : { scope: "single", quantifier: "all", candidateSet: "", ...condition }),
    approvals: { ...createDraft(item.projectId).approvals, ...(item.approvals || {}), route: { mode: "always", expression: "", ...(item.approvals?.route || {}) } },
    writeback: { ...createWriteback(), ...(item.writeback || {}) },
    audit: { ...createAudit(), ...(item.audit || {}) },
  };
}

const blankProject = {
  id: "blank",
  name: "空白本体项目",
  status: "draft",
  domain: "本体建模",
  owner: "-",
  terminologyOwner: "-",
};

function getStoredProjectId(item) {
  return item.projectId || item.definition?.projectId || "";
}

function sortActions(items) {
  return [...items].sort((left, right) => {
    const leftOrder = productionActionOrder.indexOf(left.name);
    const rightOrder = productionActionOrder.indexOf(right.name);
    const normalizedLeftOrder = leftOrder === -1 ? productionActionOrder.length : leftOrder;
    const normalizedRightOrder = rightOrder === -1 ? productionActionOrder.length : rightOrder;
    if (normalizedLeftOrder !== normalizedRightOrder) return normalizedLeftOrder - normalizedRightOrder;
    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function OntologyActionsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId: routeProjectId } = useParams();
  const projectId = routeProjectId || location.pathname.match(/\/ontology-modeling\/projects\/([^/]+)\/actions/)?.[1] || "";
  const requestedDefinitionId = new URLSearchParams(location.search).get("selected");
  const [project, setProject] = useState(location.state?.project || null);
  const [objectTypes, setObjectTypes] = useState([]);
  const [properties, setProperties] = useState([]);
  const [functions, setFunctions] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(() => createDraft(projectId));
  const [activeSection, setActiveSection] = useState("basic");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [simulation, setSimulation] = useState(null);

  const filteredItems = useMemo(
    () => items.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())),
    [items, query],
  );
  const objectName = (objectTypeId) => objectTypes.find((item) => item.id === objectTypeId)?.name || "未关联对象";

  useEffect(() => {
    let active = true;
    const projectRequest = projectId === "blank" ? Promise.resolve(blankProject) : getModelingProject(projectId);
    const objectRequest = projectId === "blank" ? Promise.resolve([]) : listModelingObjects(projectId);
    const propertyRequest = projectId === "blank" ? Promise.resolve([]) : listModelingProperties(projectId);
    Promise.all([projectRequest, objectRequest, propertyRequest, fetchOntologyDefinitions("action"), fetchOntologyDefinitions("function")])
      .then(([loadedProject, loadedObjects, loadedProperties, loadedItems, loadedFunctions]) => {
        if (!active) return;
        const scopedFunctions = loadedFunctions.filter((item) => getStoredProjectId(item) === projectId);
        const scopedItems = sortActions(loadedItems.filter((item) => getStoredProjectId(item) === projectId).map((item) => normalizeAction(item, scopedFunctions)));
        const selectedItem = scopedItems.find((item) => item.id === requestedDefinitionId) || scopedItems[0] || null;
        setProject(loadedProject);
        setObjectTypes(loadedObjects);
        setProperties(loadedProperties);
        setFunctions(scopedFunctions);
        setItems(scopedItems);
        setSelectedId(selectedItem?.id || null);
        setDraft(selectedItem || createDraft(projectId));
      })
      .catch((error) => {
        if (active) setMessage(`加载动作失败：${error.message}`);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [projectId, requestedDefinitionId]);

  const patchDraft = (patch) => {
    setDraft((current) => ({ ...current, ...patch }));
    setMessage("");
  };
  const patchNested = (key, patch) => patchDraft({ [key]: { ...(draft[key] || {}), ...patch } });

  const createNew = () => {
    setSelectedId(null);
    setDraft(createDraft(projectId));
    setActiveSection("basic");
    setMessage("");
  };
  const selectItem = (item) => {
    setSelectedId(item.id);
    setDraft(item);
    setActiveSection("basic");
    setMessage("");
    setSimulation(null);
  };

  const evaluateCondition = (condition) => {
    if (condition.mode === "expression") return { passed: Boolean(condition.field), actual: "表达式已输入" };
    const field = String(condition.field || "");
    const actual = field.includes("订单状态") ? (condition.scope === "collection" ? sampleExecutionContext.orderStatuses : sampleExecutionContext.orderStatus) : field.includes("工作日期") ? sampleExecutionContext.workDate : field.includes("物料") ? sampleExecutionContext.materialReady : field.includes("产能") ? sampleExecutionContext.capacityAvailable : "未提供样例值";
    const expected = condition.value;
    const compare = (value) => ["exists", "not_exists"].includes(condition.operator) ? (condition.operator === "exists" ? value !== "未提供样例值" : value === "未提供样例值") : condition.operator === "equals" ? String(value) === String(expected) : condition.operator === "not_equals" ? String(value) !== String(expected) : condition.operator === "contains" ? String(value).includes(String(expected)) : condition.operator === "greater_than" ? Number(value) > Number(expected) : Number(value) < Number(expected);
    const passed = Array.isArray(actual) ? (condition.quantifier === "any" ? actual.some(compare) : actual.every(compare)) : compare(actual);
    return { passed, actual };
  };

  const simulateExecution = () => {
    const checks = (draft.preconditions || []).map((item) => ({ condition: item, ...evaluateCondition(item) }));
    const executionRoles = draft.approvals?.initiatorRoles || [];
    const rolePassed = !executionRoles.length || executionRoles.includes(sampleExecutionContext.currentUserRole);
    const approvalRequired = Boolean(draft.approvals?.enabled) && (draft.approvals?.route?.mode !== "conditional" || Boolean(draft.approvals?.route?.expression?.trim()));
    const approvalPassed = !approvalRequired || sampleExecutionContext.approvalResult === "approved";
    setSimulation({ checks, rolePassed, approvalPassed, canExecute: checks.every((item) => item.passed) && rolePassed && approvalPassed });
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setMessage("请填写动作名称。");
      setActiveSection("basic");
      return;
    }
    const exists = items.some((item) => item.id === draft.id);
    setIsSaving(true);
    setMessage("");
    try {
      const saved = await saveOntologyDefinition("action", { ...draft, projectId, name: draft.name.trim() }, exists);
      setItems((current) => exists ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setSelectedId(saved.id);
      setDraft(saved);
      setMessage("动作已保存。");
    } catch (error) {
      setMessage(`保存失败：${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!selectedId || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteOntologyDefinition(selectedId);
      const nextItems = items.filter((item) => item.id !== selectedId);
      setItems(nextItems);
      setSelectedId(nextItems[0]?.id || null);
      setDraft(nextItems[0] || createDraft(projectId));
      setMessage("动作已删除。");
    } catch (error) {
      setMessage(`删除失败：${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const addListItem = (key, value) => patchDraft({ [key]: [...(draft[key] || []), value] });
  const updateListItem = (key, index, patch) => patchDraft({ [key]: (draft[key] || []).map((item, itemIndex) => itemIndex === index ? { ...(typeof item === "string" ? { name: item } : item), ...patch } : item) });
  const removeListItem = (key, index) => patchDraft({ [key]: (draft[key] || []).filter((_, itemIndex) => itemIndex !== index) });
  const updateApprovalStep = (index, patch) => patchNested("approvals", { steps: (draft.approvals?.steps || []).map((step, itemIndex) => itemIndex === index ? { ...step, ...patch } : step) });
  const removeApprovalStep = (index) => patchNested("approvals", { steps: (draft.approvals?.steps || []).filter((_, itemIndex) => itemIndex !== index) });
  const updateTriggerConfig = (patch) => patchNested("trigger", { config: { ...(draft.trigger?.config || {}), ...patch } });
  const propertiesForObject = (objectTypeId) => properties.filter((property) => (property.objectIds || []).includes(objectTypeId));
  const functionName = (functionId) => functions.find((item) => item.id === functionId)?.name || "未选择函数";
  const functionEndpoint = (functionId) => functions.find((item) => item.id === functionId)?.endpoint || "";

  const updateFunctionBinding = (index, patch) => patchDraft({ functions: (draft.functions || []).map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  const removeFunctionBinding = (index) => patchDraft({ functions: (draft.functions || []).filter((_, itemIndex) => itemIndex !== index) });

  const renderFunctions = () => <div>
    <p className="mb-4 text-sm text-[#69737e]">函数按职责分组配置。各角色由运行时编排决定调用时机，不再表达为一条平铺执行链。</p>
    <div className="space-y-5">{functionRoles.map((role) => {
      const bindings = (draft.functions || []).map((binding, index) => ({ binding, index })).filter(({ binding }) => (binding.role || "input") === role.key);
      return <section key={role.key} className="border border-[#e1e5e9] bg-white p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-[#303741]">{role.label}</h3><p className="mt-1 text-xs text-[#7b8490]">{role.description}</p></div><button type="button" onClick={() => patchDraft({ functions: [...(draft.functions || []), createFunctionBinding(role.key)] })} className="text-sm font-medium text-[#d94338]">+ 添加{role.label}函数</button></div>
        <div className="space-y-4">{bindings.map(({ binding, index }) => <div className="border-t border-[#e7eaed] pt-4" key={`function-binding-${index}`}><div className="mb-3 flex items-center justify-between"><span className="text-xs font-medium text-[#69737e]">{role.label}函数 {bindings.findIndex((item) => item.index === index) + 1}</span><button type="button" onClick={() => removeFunctionBinding(index)} className="text-xs text-[#b83c34]">删除</button></div><div className="grid gap-4 md:grid-cols-2"><label><span className={labelClass}>函数 API</span><select value={binding.functionId || ""} onChange={(event) => updateFunctionBinding(index, { functionId: event.target.value })} className={selectClass}><option value="">请选择函数</option>{functions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div><span className={labelClass}>调用地址</span><p className="flex h-10 items-center border border-[#edf0f2] bg-[#f7f8fa] px-3 text-sm text-[#69737e]">{functionEndpoint(binding.functionId) || "选择函数后显示 API 地址"}</p></div><label className="md:col-span-2"><span className={labelClass}>调用说明</span><input value={binding.description || ""} onChange={(event) => updateFunctionBinding(index, { description: event.target.value })} placeholder="说明函数在该角色中的用途" className={inputClass} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={binding.required !== false} onChange={(event) => updateFunctionBinding(index, { required: event.target.checked })} className="accent-[#e3473c]" />失败时阻止动作继续</label></div></div>)}{!bindings.length && <p className="border-t border-dashed border-[#d9dde3] py-5 text-center text-xs text-[#9299a3]">暂未配置{role.label}函数</p>}</div>
      </section>;
    })}</div>
  </div>;

  const renderParameters = () => <div>
    <p className="mb-4 text-sm text-[#69737e]">定义执行动作时需要接收的输入参数。</p>
    <div className="space-y-4">{(draft.parameters || []).map((item, index) => {
      const parameter = typeof item === "string" ? { ...createParameter(), name: item } : item;
      return <div className="border border-[#e1e5e9] bg-white p-4" key={`parameters-${index}`}>
        <div className="mb-4 flex items-center justify-between"><span className="text-sm font-medium">参数 {index + 1}</span><button type="button" onClick={() => removeListItem("parameters", index)} className="text-xs text-[#b83c34] hover:text-[#d94338]">删除</button></div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
          <label><span className={labelClass}>参数名称</span><input value={parameter.name || ""} onChange={(event) => updateListItem("parameters", index, { name: event.target.value })} placeholder="例如 recordId" className={inputClass} /></label>
          <label><span className={labelClass}>参数来源</span><select value={parameter.source || "manual"} onChange={(event) => updateListItem("parameters", index, { source: event.target.value, objectTypeId: "", propertyId: "" })} className={selectClass}><option value="manual">手动输入</option><option value="object">选择本体对象</option><option value="property">选择对象属性</option><option value="context">事务上下文</option><option value="output">上一个动作输出</option></select></label>
          <label><span className={labelClass}>数据类型</span><select value={parameter.type || "string"} onChange={(event) => updateListItem("parameters", index, { type: event.target.value })} className={selectClass}><option value="string">文本</option><option value="number">数字</option><option value="boolean">布尔值</option><option value="date">日期时间</option><option value="object">对象</option><option value="array">数组</option></select></label>
          {parameter.source === "object" && <label><span className={labelClass}>本体对象</span><select value={parameter.objectTypeId || ""} onChange={(event) => updateListItem("parameters", index, { objectTypeId: event.target.value, type: "object" })} className={selectClass}><option value="">请选择对象</option>{objectTypes.map((objectType) => <option key={objectType.id} value={objectType.id}>{objectType.name}</option>)}</select></label>}
          {parameter.source === "property" && <><label><span className={labelClass}>本体对象</span><select value={parameter.objectTypeId || ""} onChange={(event) => updateListItem("parameters", index, { objectTypeId: event.target.value, propertyId: "" })} className={selectClass}><option value="">请选择对象</option>{objectTypes.map((objectType) => <option key={objectType.id} value={objectType.id}>{objectType.name}</option>)}</select></label><label><span className={labelClass}>对象属性</span><select value={parameter.propertyId || ""} onChange={(event) => { const property = propertiesForObject(parameter.objectTypeId).find((item) => item.id === event.target.value); updateListItem("parameters", index, { propertyId: event.target.value, type: property?.valueType || parameter.type }); }} className={selectClass} disabled={!parameter.objectTypeId}><option value="">{parameter.objectTypeId ? "请选择属性" : "先选择对象"}</option>{propertiesForObject(parameter.objectTypeId).map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label></>}
          <label><span className={labelClass}>默认值</span><input value={parameter.defaultValue || ""} onChange={(event) => updateListItem("parameters", index, { defaultValue: event.target.value })} placeholder="可选" className={inputClass} /></label>
          <label className="flex items-end pb-2 text-sm"><input type="checkbox" checked={Boolean(parameter.required)} onChange={(event) => updateListItem("parameters", index, { required: event.target.checked })} className="mr-2 h-4 w-4 accent-[#e3473c]" />执行时必填</label>
          <label className="flex items-end pb-2 text-sm"><input type="checkbox" checked={Boolean(parameter.multiple)} onChange={(event) => updateListItem("parameters", index, { multiple: event.target.checked, type: event.target.checked ? "array" : parameter.type })} className="mr-2 h-4 w-4 accent-[#e3473c]" />允许多选</label>
          <label className="md:col-span-2"><span className={labelClass}>参数说明</span><input value={parameter.description || ""} onChange={(event) => updateListItem("parameters", index, { description: event.target.value })} placeholder="说明参数来源、格式或限制" className={inputClass} /></label>
        </div>
      </div>;
    })}</div>
    <button type="button" onClick={() => addListItem("parameters", createParameter())} className="mt-4 text-sm font-medium text-[#d94338]">+ 添加参数</button>
  </div>;

  const renderPreconditions = () => <div>
    <p className="mb-4 text-sm text-[#69737e]">设置动作执行前必须满足的条件。候选集条件可明确配置 all（全部）或 any（任一）量化语义。</p>
    <div className="space-y-4">{(draft.preconditions || []).map((item, index) => {
      const condition = typeof item === "string" ? { ...createPrecondition(), description: item } : item;
      const fieldParts = String(condition.field || "").split(".");
      const selectedObjectId = condition.objectTypeId || objectTypes.find((objectType) => objectType.name === fieldParts[0])?.id || "";
      const availableProperties = propertiesForObject(selectedObjectId);
      const selectedPropertyId = condition.propertyId || availableProperties.find((property) => property.name === fieldParts[1])?.id || "";
      const isExpression = condition.mode === "expression" || (!selectedObjectId && Boolean(condition.field));
      return <div className="border border-[#e1e5e9] bg-white p-4" key={`preconditions-${index}`}>
        <div className="mb-4 flex items-center justify-between"><span className="text-sm font-medium">条件 {index + 1}</span><button type="button" onClick={() => removeListItem("preconditions", index)} className="text-xs text-[#b83c34] hover:text-[#d94338]">删除</button></div>
        <div className="mb-4 grid gap-4 md:grid-cols-3"><label><span className={labelClass}>条件来源</span><select value={isExpression ? "expression" : "property"} onChange={(event) => updateListItem("preconditions", index, { mode: event.target.value, field: event.target.value === "expression" ? condition.field : "" })} className={selectClass}><option value="property">选择对象属性</option><option value="expression">输入表达式</option></select></label><label><span className={labelClass}>判断范围</span><select value={condition.scope || "single"} onChange={(event) => updateListItem("preconditions", index, { scope: event.target.value })} className={selectClass}><option value="single">单个对象</option><option value="collection">候选对象集</option></select></label>{condition.scope === "collection" && <label><span className={labelClass}>集合量词</span><select value={condition.quantifier || "all"} onChange={(event) => updateListItem("preconditions", index, { quantifier: event.target.value })} className={selectClass}><option value="all">all：全部满足</option><option value="any">any：任一满足</option></select></label>}</div>
        {condition.scope === "collection" && <label className="mb-4 block"><span className={labelClass}>候选集表达式</span><input value={condition.candidateSet || ""} onChange={(event) => updateListItem("preconditions", index, { candidateSet: event.target.value })} placeholder="例如 纳入本次主计划的销售订单" className={inputClass} /></label>}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_minmax(0,1fr)]">
          {isExpression ? <label className="md:col-span-2"><span className={labelClass}>表达式</span><input value={condition.field || ""} onChange={(event) => updateListItem("preconditions", index, { field: event.target.value })} placeholder="例如 订单状态 = 'approved' && 订单数量 > 0" className={inputClass} /></label> : <><label><span className={labelClass}>本体对象</span><select value={selectedObjectId} onChange={(event) => updateListItem("preconditions", index, { mode: "property", objectTypeId: event.target.value, propertyId: "", field: "" })} className={selectClass}><option value="">请选择对象</option>{objectTypes.map((objectType) => <option key={objectType.id} value={objectType.id}>{objectType.name}</option>)}</select></label><label><span className={labelClass}>对象属性</span><select value={selectedPropertyId} onChange={(event) => { const property = availableProperties.find((item) => item.id === event.target.value); const object = objectTypes.find((item) => item.id === selectedObjectId); updateListItem("preconditions", index, { mode: "property", propertyId: event.target.value, field: property && object ? `${object.name}.${property.name}` : "" }); }} className={selectClass} disabled={!selectedObjectId}><option value="">{selectedObjectId ? "请选择属性" : "先选择对象"}</option>{availableProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label></>}
          <label><span className={labelClass}>运算符</span><select value={condition.operator || "equals"} onChange={(event) => updateListItem("preconditions", index, { operator: event.target.value })} className={selectClass}><option value="equals">等于</option><option value="not_equals">不等于</option><option value="contains">包含</option><option value="greater_than">大于</option><option value="less_than">小于</option><option value="exists">有值</option><option value="not_exists">无值</option></select></label>
          <label><span className={labelClass}>比较值</span><input value={condition.value || ""} onChange={(event) => updateListItem("preconditions", index, { value: event.target.value })} placeholder="例如 approved" disabled={["exists", "not_exists"].includes(condition.operator)} className={`${inputClass} disabled:bg-[#f1f3f5]`} /></label>
          <label className="md:col-span-3"><span className={labelClass}>条件说明</span><input value={condition.description || ""} onChange={(event) => updateListItem("preconditions", index, { description: event.target.value })} placeholder="说明该限制的业务原因" className={inputClass} /></label>
        </div>
      </div>;
    })}</div>
    <div className="mt-6 border border-[#e1e5e9] bg-[#f7f8fa] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium">前置条件模拟</p><p className="mt-1 text-xs text-[#69737e]">用主计划样例数据检查当前条件是否允许执行。</p></div><button type="button" onClick={simulateExecution} className="h-9 bg-[#252b33] px-3 text-sm font-medium text-white">模拟执行</button></div>{simulation && <div className="mt-4 space-y-2 text-xs">{simulation.checks.map((item, index) => <div key={`simulation-condition-${index}`} className="flex items-center justify-between border-t border-[#e1e5e9] pt-2"><span>{item.condition.description || item.condition.field || `条件 ${index + 1}`}（实际值：{String(item.actual)}）</span><span className={item.passed ? "text-[#39805f]" : "text-[#d94338]"}>{item.passed ? "通过" : "不通过"}</span></div>)}<p className={`border-t border-[#e1e5e9] pt-3 font-medium ${simulation.canExecute ? "text-[#39805f]" : "text-[#d94338]"}`}>{simulation.canExecute ? "模拟结果：允许执行编制主生产计划" : "模拟结果：阻止执行，请先满足前置条件或权限要求"}</p></div>}</div>
    <button type="button" onClick={() => addListItem("preconditions", createPrecondition())} className="mt-4 text-sm font-medium text-[#d94338]">+ 添加前置条件</button>
  </div>;

  const renderEffects = () => <div>
    <p className="mb-4 text-sm text-[#69737e]">这里只描述动作对本体对象、属性和关联产生的变更。外部系统同步请在“回写与审计”中配置。</p>
    <div className="space-y-4">{(draft.effects || []).map((item, index) => {
      const effect = typeof item === "string" ? { ...createEffect(), description: item } : item;
      return <div className="border border-[#e1e5e9] bg-white p-4" key={`effects-${index}`}>
        <div className="mb-4 flex items-center justify-between"><span className="text-sm font-medium">副作用 {index + 1}</span><button type="button" onClick={() => removeListItem("effects", index)} className="text-xs text-[#b83c34] hover:text-[#d94338]">删除</button></div>
        <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
          <label><span className={labelClass}>变更类型</span><select value={effect.type || "update_object"} onChange={(event) => updateListItem("effects", index, { type: event.target.value, propertyId: "", relationType: "" })} className={selectClass}><option value="update_object">更新本体对象</option><option value="create_object">创建本体对象</option><option value="delete_object">删除本体对象</option><option value="update_property">更新对象属性</option><option value="create_relation">创建对象关联</option><option value="delete_relation">删除对象关联</option></select></label>
          <label><span className={labelClass}>本体对象</span><select value={effect.objectTypeId || ""} onChange={(event) => updateListItem("effects", index, { objectTypeId: event.target.value, propertyId: "" })} className={selectClass} disabled={!objectTypes.length}><option value="">{objectTypes.length ? "请选择本体对象" : "当前项目暂无本体对象"}</option>{objectTypes.map((objectType) => <option key={objectType.id} value={objectType.id}>{objectType.name}</option>)}</select></label>
          {effect.type === "update_property" && <label><span className={labelClass}>目标属性</span><select value={effect.propertyId || ""} onChange={(event) => updateListItem("effects", index, { propertyId: event.target.value })} className={selectClass} disabled={!effect.objectTypeId}><option value="">请选择属性</option>{propertiesForObject(effect.objectTypeId).map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>}
          {["create_relation", "delete_relation"].includes(effect.type) && <label><span className={labelClass}>关联类型</span><input value={effect.relationType || ""} onChange={(event) => updateListItem("effects", index, { relationType: event.target.value })} placeholder="例如 主计划包含生产任务" className={inputClass} /></label>}
          <label className="md:col-span-2"><span className={labelClass}>变更说明</span><textarea value={effect.description || ""} onChange={(event) => updateListItem("effects", index, { description: event.target.value })} placeholder="描述对象、属性值或关联如何变化" className="min-h-20 w-full border border-[#d9dde3] bg-white p-3 text-sm outline-none focus:border-[#e3473c]" /></label>
        </div>
      </div>;
    })}</div>
    <button type="button" onClick={() => addListItem("effects", createEffect())} className="mt-4 text-sm font-medium text-[#d94338]">+ 添加副作用</button>
  </div>;

  const renderTrigger = () => {
    const triggerType = draft.trigger?.type || "manual";
    const config = draft.trigger?.config || {};
    return <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <label><span className={labelClass}>触发方式</span><select value={triggerType} onChange={(event) => patchNested("trigger", { type: event.target.value })} className={selectClass}><option value="manual">手动执行</option><option value="event">事件触发</option><option value="schedule">定时触发</option><option value="api">API 调用</option></select></label>
        <label><span className={labelClass}>触发状态</span><select value={config.enabled === false ? "disabled" : "enabled"} onChange={(event) => updateTriggerConfig({ enabled: event.target.value === "enabled" })} className={selectClass}><option value="enabled">已启用</option><option value="disabled">已停用</option></select></label>
      </div>
      {triggerType === "manual" && <div>
        <label><span className={labelClass}>执行入口说明</span><input value={config.description || ""} onChange={(event) => updateTriggerConfig({ description: event.target.value })} placeholder="说明用户何时可以手动发起；发起角色请在权限与审批中配置" className={inputClass} /></label>
      </div>}
      {triggerType === "event" && <div className="grid gap-5 md:grid-cols-2">
        <label><span className={labelClass}>事件名称 *</span><input value={config.eventName || config.value || ""} onChange={(event) => updateTriggerConfig({ eventName: event.target.value, value: event.target.value })} placeholder="例如订单已支付" className={inputClass} /></label>
        <label><span className={labelClass}>事件来源</span><input value={config.source || ""} onChange={(event) => updateTriggerConfig({ source: event.target.value })} placeholder="例如订单系统或事件总线" className={inputClass} /></label>
        <label className="md:col-span-2"><span className={labelClass}>触发过滤条件</span><textarea value={config.filter || ""} onChange={(event) => updateTriggerConfig({ filter: event.target.value })} placeholder="可选，例如 status = 'paid' && amount > 0" className="min-h-20 w-full border border-[#d9dde3] bg-white p-3 text-sm outline-none focus:border-[#e3473c]" /></label>
      </div>}
      {triggerType === "schedule" && <div className="grid gap-5 md:grid-cols-2">
        <label><span className={labelClass}>Cron 表达式 *</span><input value={config.cron || config.value || ""} onChange={(event) => updateTriggerConfig({ cron: event.target.value, value: event.target.value })} placeholder="例如 0 9 * * 1-5" className={inputClass} /></label>
        <label><span className={labelClass}>时区</span><select value={config.timezone || "Asia/Shanghai"} onChange={(event) => updateTriggerConfig({ timezone: event.target.value })} className={selectClass}><option value="Asia/Shanghai">中国标准时间（UTC+8）</option><option value="UTC">协调世界时（UTC）</option><option value="America/Los_Angeles">太平洋时间（UTC-8/-7）</option><option value="Europe/London">英国时间（UTC+0/+1）</option></select></label>
        <label><span className={labelClass}>错过执行时</span><select value={config.missedRun || "skip"} onChange={(event) => updateTriggerConfig({ missedRun: event.target.value })} className={selectClass}><option value="skip">跳过本次执行</option><option value="run_once">恢复后执行一次</option></select></label>
        <label><span className={labelClass}>计划说明</span><input value={config.description || ""} onChange={(event) => updateTriggerConfig({ description: event.target.value })} placeholder="可选，例如工作日同步数据" className={inputClass} /></label>
      </div>}
      {triggerType === "api" && <div className="grid gap-5 md:grid-cols-2">
        <label><span className={labelClass}>请求方法</span><select value={config.method || "POST"} onChange={(event) => updateTriggerConfig({ method: event.target.value })} className={selectClass}><option value="POST">POST</option><option value="PUT">PUT</option><option value="PATCH">PATCH</option><option value="GET">GET</option></select></label>
        <label><span className={labelClass}>接口路径 *</span><input value={config.path || config.value || ""} onChange={(event) => updateTriggerConfig({ path: event.target.value, value: event.target.value })} placeholder="例如 /api/actions/approve" className={inputClass} /></label>
        <label><span className={labelClass}>鉴权方式</span><select value={config.authType || "token"} onChange={(event) => updateTriggerConfig({ authType: event.target.value })} className={selectClass}><option value="token">Token / API Key</option><option value="oauth2">OAuth 2.0</option><option value="signature">签名鉴权</option><option value="none">无需鉴权</option></select></label>
        <label><span className={labelClass}>请求说明</span><input value={config.description || ""} onChange={(event) => updateTriggerConfig({ description: event.target.value })} placeholder="可选，例如供外部系统调用" className={inputClass} /></label>
      </div>}
      <p className="border-t border-[#e4e7eb] pt-4 text-xs leading-5 text-[#69737e]">{triggerType === "manual" ? "手动执行适合由用户在动作列表或业务页面主动发起。" : triggerType === "event" ? "事件触发会在匹配到指定事件及过滤条件后自动执行。" : triggerType === "schedule" ? "定时触发会按照 Cron 表达式和时区周期性执行。" : "API 调用会为该动作提供外部系统可调用的接口入口。"}</p>
    </div>;
  };

  const renderIntegration = () => <div className="space-y-6">
    <section className="border border-[#e1e5e9] bg-white p-4"><div className="mb-4 flex items-center justify-between gap-4"><div><h3 className="text-sm font-semibold">外部系统回写</h3><p className="mt-1 text-xs text-[#7b8490]">配置计划结果是否回写 ERP、SAP 或其他业务系统。</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(draft.writeback?.enabled)} onChange={(event) => patchNested("writeback", { enabled: event.target.checked })} className="accent-[#e3473c]" />启用回写</label></div>{draft.writeback?.enabled && <div className="grid gap-4 md:grid-cols-2"><label><span className={labelClass}>目标系统</span><input value={draft.writeback?.system || ""} onChange={(event) => patchNested("writeback", { system: event.target.value })} placeholder="例如 SAP S/4HANA" className={inputClass} /></label><label><span className={labelClass}>回写方式</span><select value={draft.writeback?.mode || "async"} onChange={(event) => patchNested("writeback", { mode: event.target.value })} className={selectClass}><option value="sync">同步，等待结果</option><option value="async">异步，进入任务队列</option></select></label><label className="md:col-span-2"><span className={labelClass}>回写接口</span><input value={draft.writeback?.endpoint || ""} onChange={(event) => patchNested("writeback", { endpoint: event.target.value })} placeholder="例如 /sap/api/v1/production-plans" className={inputClass} /></label><label><span className={labelClass}>失败重试次数</span><input type="number" min="0" value={draft.writeback?.retryCount ?? 3} onChange={(event) => patchNested("writeback", { retryCount: Number(event.target.value) })} className={inputClass} /></label><label><span className={labelClass}>重试间隔（秒）</span><input type="number" min="1" value={draft.writeback?.retryIntervalSeconds ?? 60} onChange={(event) => patchNested("writeback", { retryIntervalSeconds: Number(event.target.value) })} className={inputClass} /></label><label className="md:col-span-2"><span className={labelClass}>最终失败策略</span><select value={draft.writeback?.failurePolicy || "queue"} onChange={(event) => patchNested("writeback", { failurePolicy: event.target.value })} className={selectClass}><option value="queue">进入异常队列，人工重试</option><option value="rollback">回滚本次本体变更</option><option value="ignore">记录失败并继续</option></select></label></div>}</section>
    <section className="border border-[#e1e5e9] bg-white p-4"><div className="mb-4 flex items-center justify-between gap-4"><div><h3 className="text-sm font-semibold">审计留痕</h3><p className="mt-1 text-xs text-[#7b8490]">记录谁发起、谁审批、函数调用和本体变更。</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.audit?.enabled !== false} onChange={(event) => patchNested("audit", { enabled: event.target.checked })} className="accent-[#e3473c]" />启用审计</label></div>{draft.audit?.enabled !== false && <div className="grid gap-3 md:grid-cols-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.audit?.recordInitiator !== false} onChange={(event) => patchNested("audit", { recordInitiator: event.target.checked })} className="accent-[#e3473c]" />记录发起人与发起时间</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.audit?.recordApprovals !== false} onChange={(event) => patchNested("audit", { recordApprovals: event.target.checked })} className="accent-[#e3473c]" />记录审批人与审批意见</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.audit?.recordFunctionCalls !== false} onChange={(event) => patchNested("audit", { recordFunctionCalls: event.target.checked })} className="accent-[#e3473c]" />记录函数调用与结果摘要</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.audit?.recordChanges !== false} onChange={(event) => patchNested("audit", { recordChanges: event.target.checked })} className="accent-[#e3473c]" />记录本体变更前后值</label><label><span className={labelClass}>留存天数</span><input type="number" min="1" value={draft.audit?.retentionDays ?? 365} onChange={(event) => patchNested("audit", { retentionDays: Number(event.target.value) })} className={inputClass} /></label></div>}</section>
  </div>;

  const renderSection = () => {
    if (activeSection === "basic") return <div className="grid gap-5 md:grid-cols-2">
      <label><span className={labelClass}>动作名称 *</span><input value={draft.name || ""} onChange={(event) => patchDraft({ name: event.target.value })} placeholder="请输入动作名称" className={inputClass} /></label>
      <label><span className={labelClass}>关联对象</span><select value={draft.objectTypeId || ""} onChange={(event) => patchDraft({ objectTypeId: event.target.value })} className={inputClass}><option value="">暂不关联</option>{objectTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="md:col-span-2"><span className={labelClass}>动作说明</span><textarea value={draft.description || ""} onChange={(event) => patchDraft({ description: event.target.value })} placeholder="说明动作的业务目的和使用范围" className="min-h-24 w-full border border-[#d9dde3] bg-white p-3 text-sm outline-none focus:border-[#e3473c]" /></label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={draft.enabled !== false} onChange={(event) => patchDraft({ enabled: event.target.checked })} className="h-4 w-4 accent-[#e3473c]" />允许执行此动作</label>
    </div>;
    if (activeSection === "trigger") return renderTrigger();
    if (activeSection === "parameters") return renderParameters();
    if (activeSection === "functions") return renderFunctions();
    if (activeSection === "preconditions") return renderPreconditions();
    if (activeSection === "approvals") return <div className="space-y-5">
      <div className="border border-[#e1e5e9] bg-white p-4"><p className="mb-4 text-sm font-medium">发起权限</p><div className="grid gap-4 md:grid-cols-2"><label><span className={labelClass}>可发起角色</span><input value={(draft.approvals?.initiatorRoles || []).join(", ")} onChange={(event) => patchNested("approvals", { initiatorRoles: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="例如 计划负责人, 生产经理" className={inputClass} /></label><label><span className={labelClass}>可发起用户</span><input value={(draft.approvals?.initiatorUsers || []).join(", ")} onChange={(event) => patchNested("approvals", { initiatorUsers: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="例如 张三, 李四；留空表示不限具体人员" className={inputClass} /></label></div></div>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(draft.approvals?.enabled)} onChange={(event) => patchNested("approvals", { enabled: event.target.checked })} className="h-4 w-4 accent-[#e3473c]" />执行前需要审批</label>
      {draft.approvals?.enabled && <div className="border border-[#e1e5e9] bg-white p-4"><h3 className="text-sm font-medium">审批路由</h3><p className="mt-1 text-xs text-[#7b8490]">常规周期可直接执行，仅在风险或偏差满足条件时进入审批流程。</p><div className="mt-4 grid gap-4 md:grid-cols-2"><label><span className={labelClass}>进入审批的规则</span><select value={draft.approvals?.route?.mode || "always"} onChange={(event) => patchNested("approvals", { route: { ...(draft.approvals?.route || {}), mode: event.target.value } })} className={selectClass}><option value="always">始终需要审批</option><option value="conditional">满足条件时审批</option></select></label>{draft.approvals?.route?.mode === "conditional" && <label><span className={labelClass}>路由表达式</span><input value={draft.approvals?.route?.expression || ""} onChange={(event) => patchNested("approvals", { route: { ...(draft.approvals?.route || {}), expression: event.target.value } })} placeholder="例如 延期风险 = high || 计划偏差 > 10%" className={inputClass} /></label>}</div></div>}
      {draft.approvals?.enabled && <><div className="grid gap-5 border-t border-[#e4e7eb] pt-5 md:grid-cols-2"><label><span className={labelClass}>审批时限（小时）</span><input type="number" min="1" value={draft.approvals?.timeoutHours || ""} onChange={(event) => patchNested("approvals", { timeoutHours: event.target.value })} placeholder="可选，例如 24" className={inputClass} /></label><label><span className={labelClass}>拒绝或超时后</span><select value={draft.approvals?.onReject || "block"} onChange={(event) => patchNested("approvals", { onReject: event.target.value })} className={selectClass}><option value="block">阻止执行并保留待处理状态</option><option value="cancel">取消本次动作</option><option value="escalate">升级给管理员处理</option></select></label></div><div className="border border-[#e1e5e9] bg-white p-4"><div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-medium">审批流程</p><p className="mt-1 text-xs text-[#69737e]">节点按顺序执行，可设置指定人、角色或连续多级主管。</p></div><button type="button" onClick={() => patchNested("approvals", { steps: [...(draft.approvals?.steps || []), createApprovalStep()] })} className="text-sm font-medium text-[#d94338]">+ 添加审批节点</button></div><div className="space-y-4">{(draft.approvals?.steps || []).map((step, index) => <div key={`approval-step-${index}`} className="border-t border-[#e7eaed] pt-4"><div className="mb-3 flex items-center justify-between"><span className="text-sm font-medium">第 {index + 1} 级审批</span><button type="button" onClick={() => removeApprovalStep(index)} className="text-xs text-[#b83c34]">删除</button></div><div className="grid gap-4 md:grid-cols-2"><label><span className={labelClass}>节点名称</span><input value={step.name || ""} onChange={(event) => updateApprovalStep(index, { name: event.target.value })} placeholder={`例如 ${index + 1} 级审批`} className={inputClass} /></label><label><span className={labelClass}>审批人来源</span><select value={step.approverType || "role"} onChange={(event) => updateApprovalStep(index, { approverType: event.target.value, approvers: [] })} className={selectClass}><option value="user">指定用户</option><option value="role">指定角色</option><option value="manager_chain">发起人的连续多级主管</option></select></label>{step.approverType === "manager_chain" ? <label><span className={labelClass}>连续主管级数</span><input type="number" min="1" max="10" value={step.managerLevels || 1} onChange={(event) => updateApprovalStep(index, { managerLevels: Number(event.target.value) || 1 })} className={inputClass} /></label> : <label><span className={labelClass}>{step.approverType === "user" ? "审批用户" : "审批角色"}</span><input value={(step.approvers || []).join(", ")} onChange={(event) => updateApprovalStep(index, { approvers: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder={step.approverType === "user" ? "例如 王五, 赵六" : "例如 生产经理, 供应链负责人"} className={inputClass} /></label>}<label><span className={labelClass}>多人审批策略</span><select value={step.mode || "any"} onChange={(event) => updateApprovalStep(index, { mode: event.target.value })} className={selectClass}><option value="any">任一人通过</option><option value="all">所有人通过</option></select></label></div></div>)}</div>{!(draft.approvals?.steps || []).length && <p className="py-6 text-center text-xs text-[#858e98]">尚未配置审批节点</p>}</div></>}
      {draft.approvals?.enabled && <div className="border border-[#e1e5e9] bg-[#f7f8fa] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium">权限与审批模拟</p><p className="mt-1 text-xs text-[#69737e]">样例执行人：计划负责人；样例审批结果：已通过。</p></div><button type="button" onClick={simulateExecution} className="h-9 bg-[#252b33] px-3 text-sm font-medium text-white">模拟权限</button></div>{simulation && <div className="mt-4 space-y-2 border-t border-[#e1e5e9] pt-3 text-xs"><p className={simulation.rolePassed ? "text-[#39805f]" : "text-[#d94338]"}>{simulation.rolePassed ? "角色校验通过：计划负责人" : `角色校验失败：需要 ${(draft.approvals?.initiatorRoles || []).join("、") || "未配置发起角色"}`}</p><p className={simulation.approvalPassed ? "text-[#39805f]" : "text-[#d94338]"}>{simulation.approvalPassed ? "审批门禁通过：approved" : "审批门禁未通过：当前动作被阻止"}</p></div>}</div>}
    </div>;
    if (activeSection === "integration") return renderIntegration();
    return renderEffects();
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-[#f7f8fa] text-sm text-[#717985]">正在加载动作...</div>;
  if (!project) return <div className="flex h-screen items-center justify-center bg-[#f7f8fa] text-center"><div><p className="text-sm text-[#717985]">项目上下文已失效</p><button type="button" onClick={() => navigate("/ontology-modeling")} className="mt-4 h-10 bg-[#e3473c] px-4 text-sm font-medium text-white">返回项目列表</button></div></div>;

  return <OntologyProjectWorkspace project={project} activeItem="actions" actions={<button type="button" onClick={createNew} className="h-9 bg-[#e3473c] px-4 text-sm font-medium text-white">+ 新增动作</button>}>
    <div className="flex min-h-full flex-col text-[#252a32]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e2e5e9] bg-white px-6 py-5"><div><h1 className="text-xl font-semibold">动作</h1><p className="mt-1 text-xs text-[#7b8490]">管理当前本体项目中的业务动作及执行配置</p></div><div className="text-xs text-[#7b8490]">共 {items.length} 个动作</div></header>
      <div className="grid min-h-0 flex-1 gap-5 p-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex min-h-[420px] flex-col border border-[#e0e4e8] bg-white">
          <div className="border-b border-[#e7eaed] p-4"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索动作名称" className={`${inputClass} bg-[#fafbfc]`} /></div>
          <div className="flex items-center justify-between px-4 py-3 text-xs font-semibold text-[#68717d]"><span>已创建动作</span><span>{filteredItems.length}</span></div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredItems.map((item) => <button key={item.id} type="button" onClick={() => selectItem(item)} className={`w-full border-t border-[#eef0f2] px-4 py-3 text-left ${selectedId === item.id ? "border-l-2 border-l-[#e3473c] bg-[#fff6f4]" : "hover:bg-[#f7f8fa]"}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{item.name}</span><span className={`shrink-0 text-[11px] ${item.enabled === false ? "text-[#9aa1aa]" : "text-[#39805f]"}`}>{item.enabled === false ? "已停用" : "已启用"}</span></div><div className="mt-1 truncate text-[11px] text-[#858e98]">{objectName(item.objectTypeId)}</div></button>)}
            {!filteredItems.length && <div className="px-5 py-12 text-center"><p className="text-sm text-[#717985]">暂无已创建动作</p><button type="button" onClick={createNew} className="mt-3 text-xs font-medium text-[#d94338]">立即新增动作</button></div>}
          </div>
        </aside>
        <section className="min-h-0 border border-[#e0e4e8] bg-white p-6"><div className="mx-auto max-w-[960px]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{selectedId ? draft.name : "新增动作"}</h2><p className="mt-1 text-xs text-[#7c8590]">完成以下配置后保存动作</p></div><div className="flex gap-2">{selectedId && <button type="button" onClick={remove} disabled={isDeleting} className="h-9 border border-[#d9dde3] bg-white px-3 text-sm text-[#b83c34] disabled:opacity-60">{isDeleting ? "删除中..." : "删除"}</button>}<button type="button" onClick={save} disabled={isSaving} className="h-9 bg-[#252b33] px-4 text-sm font-medium text-white disabled:opacity-60">{isSaving ? "保存中..." : "保存动作"}</button></div></div>
          <div className="mb-6 flex gap-1 overflow-x-auto border-b border-[#e8ebee]">{sections.map(([key, label]) => <button type="button" key={key} onClick={() => setActiveSection(key)} className={`shrink-0 border-b-2 px-3 py-3 text-sm ${activeSection === key ? "border-[#e3473c] font-semibold text-[#d94338]" : "border-transparent text-[#717985] hover:text-[#252a32]"}`}>{label}</button>)}</div>
          <div className="border border-[#e4e7eb] bg-[#fcfcfd] p-6">{renderSection()}</div>
          {message && <div className={`mt-4 text-right text-xs ${message.includes("失败") || message.includes("请") ? "text-[#d94338]" : "text-[#39805f]"}`}>{message}</div>}
        </div></section>
      </div>
    </div>
  </OntologyProjectWorkspace>;
}

export default OntologyActionsPage;
