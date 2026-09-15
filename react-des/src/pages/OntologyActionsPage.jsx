import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import OntologyProjectWorkspace from "../components/OntologyProjectWorkspace";
import {
  deleteOntologyDefinition,
  fetchOntologyDefinitions,
  saveOntologyDefinition,
} from "../utils/ontologyDefinitionsApi";
import { getModelingProject, listModelingObjects } from "../utils/ontologyModelingApi";

const sections = [
  ["basic", "基本信息"],
  ["trigger", "触发方式"],
  ["parameters", "参数"],
  ["preconditions", "前置条件"],
  ["approvals", "权限与审批"],
  ["effects", "副作用"],
];

const inputClass = "h-10 w-full border border-[#d9dde3] bg-white px-3 text-sm outline-none focus:border-[#e3473c]";
const labelClass = "mb-1.5 block text-xs font-medium text-[#69737e]";
const selectClass = `${inputClass} appearance-none`;

const createParameter = () => ({ name: "", type: "string", required: false, defaultValue: "", description: "" });
const createPrecondition = () => ({ field: "", operator: "equals", value: "", description: "" });
const createEffect = () => ({ type: "update_object", objectTypeId: "", target: "", description: "" });
const objectEffectTypes = new Set(["update_object", "create_object", "delete_object"]);

const createDraft = (projectId) => ({
  id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  projectId,
  name: "",
  description: "",
  objectTypeId: "",
  trigger: { type: "manual", config: { value: "" } },
  parameters: [],
  preconditions: [],
  approvals: { enabled: false, mode: "any", roles: [], timeoutHours: "", onReject: "block" },
  effects: [],
  enabled: true,
});

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

function OntologyActionsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId: routeProjectId } = useParams();
  const projectId = routeProjectId || location.pathname.match(/\/ontology-modeling\/projects\/([^/]+)\/actions/)?.[1] || "";
  const requestedDefinitionId = new URLSearchParams(location.search).get("selected");
  const [project, setProject] = useState(location.state?.project || null);
  const [objectTypes, setObjectTypes] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(() => createDraft(projectId));
  const [activeSection, setActiveSection] = useState("basic");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredItems = useMemo(
    () => items.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())),
    [items, query],
  );
  const objectName = (objectTypeId) => objectTypes.find((item) => item.id === objectTypeId)?.name || "未关联对象";

  useEffect(() => {
    let active = true;
    const projectRequest = projectId === "blank" ? Promise.resolve(blankProject) : getModelingProject(projectId);
    const objectRequest = projectId === "blank" ? Promise.resolve([]) : listModelingObjects(projectId);
    Promise.all([projectRequest, objectRequest, fetchOntologyDefinitions("action")])
      .then(([loadedProject, loadedObjects, loadedItems]) => {
        if (!active) return;
        const scopedItems = loadedItems.filter((item) => getStoredProjectId(item) === projectId);
        const selectedItem = scopedItems.find((item) => item.id === requestedDefinitionId) || scopedItems[0] || null;
        setProject(loadedProject);
        setObjectTypes(loadedObjects);
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
  const updateTriggerConfig = (patch) => patchNested("trigger", { config: { ...(draft.trigger?.config || {}), ...patch } });

  const renderParameters = () => <div>
    <p className="mb-4 text-sm text-[#69737e]">定义执行动作时需要接收的输入参数。</p>
    <div className="space-y-4">{(draft.parameters || []).map((item, index) => {
      const parameter = typeof item === "string" ? { ...createParameter(), name: item } : item;
      return <div className="border border-[#e1e5e9] bg-white p-4" key={`parameters-${index}`}>
        <div className="mb-4 flex items-center justify-between"><span className="text-sm font-medium">参数 {index + 1}</span><button type="button" onClick={() => removeListItem("parameters", index)} className="text-xs text-[#b83c34] hover:text-[#d94338]">删除</button></div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
          <label><span className={labelClass}>参数名称</span><input value={parameter.name || ""} onChange={(event) => updateListItem("parameters", index, { name: event.target.value })} placeholder="例如 recordId" className={inputClass} /></label>
          <label><span className={labelClass}>数据类型</span><select value={parameter.type || "string"} onChange={(event) => updateListItem("parameters", index, { type: event.target.value })} className={selectClass}><option value="string">文本</option><option value="number">数字</option><option value="boolean">布尔值</option><option value="date">日期时间</option><option value="object">对象</option><option value="array">数组</option></select></label>
          <label><span className={labelClass}>默认值</span><input value={parameter.defaultValue || ""} onChange={(event) => updateListItem("parameters", index, { defaultValue: event.target.value })} placeholder="可选" className={inputClass} /></label>
          <label className="flex items-end pb-2 text-sm"><input type="checkbox" checked={Boolean(parameter.required)} onChange={(event) => updateListItem("parameters", index, { required: event.target.checked })} className="mr-2 h-4 w-4 accent-[#e3473c]" />执行时必填</label>
          <label className="md:col-span-2"><span className={labelClass}>参数说明</span><input value={parameter.description || ""} onChange={(event) => updateListItem("parameters", index, { description: event.target.value })} placeholder="说明参数来源、格式或限制" className={inputClass} /></label>
        </div>
      </div>;
    })}</div>
    <button type="button" onClick={() => addListItem("parameters", createParameter())} className="mt-4 text-sm font-medium text-[#d94338]">+ 添加参数</button>
  </div>;

  const renderPreconditions = () => <div>
    <p className="mb-4 text-sm text-[#69737e]">设置动作执行前必须满足的条件，全部条件满足后才允许执行。</p>
    <div className="space-y-4">{(draft.preconditions || []).map((item, index) => {
      const condition = typeof item === "string" ? { ...createPrecondition(), description: item } : item;
      return <div className="border border-[#e1e5e9] bg-white p-4" key={`preconditions-${index}`}>
        <div className="mb-4 flex items-center justify-between"><span className="text-sm font-medium">条件 {index + 1}</span><button type="button" onClick={() => removeListItem("preconditions", index)} className="text-xs text-[#b83c34] hover:text-[#d94338]">删除</button></div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)]">
          <label><span className={labelClass}>对象字段或表达式</span><input value={condition.field || ""} onChange={(event) => updateListItem("preconditions", index, { field: event.target.value })} placeholder="例如 status" className={inputClass} /></label>
          <label><span className={labelClass}>运算符</span><select value={condition.operator || "equals"} onChange={(event) => updateListItem("preconditions", index, { operator: event.target.value })} className={selectClass}><option value="equals">等于</option><option value="not_equals">不等于</option><option value="contains">包含</option><option value="greater_than">大于</option><option value="less_than">小于</option><option value="exists">有值</option><option value="not_exists">无值</option></select></label>
          <label><span className={labelClass}>比较值</span><input value={condition.value || ""} onChange={(event) => updateListItem("preconditions", index, { value: event.target.value })} placeholder="例如 approved" disabled={["exists", "not_exists"].includes(condition.operator)} className={`${inputClass} disabled:bg-[#f1f3f5]`} /></label>
          <label className="md:col-span-3"><span className={labelClass}>条件说明</span><input value={condition.description || ""} onChange={(event) => updateListItem("preconditions", index, { description: event.target.value })} placeholder="说明该限制的业务原因" className={inputClass} /></label>
        </div>
      </div>;
    })}</div>
    <button type="button" onClick={() => addListItem("preconditions", createPrecondition())} className="mt-4 text-sm font-medium text-[#d94338]">+ 添加前置条件</button>
  </div>;

  const renderEffects = () => <div>
    <p className="mb-4 text-sm text-[#69737e]">描述动作执行后对本体数据或外部系统产生的影响，按顺序执行。</p>
    <div className="space-y-4">{(draft.effects || []).map((item, index) => {
      const effect = typeof item === "string" ? { ...createEffect(), description: item } : item;
      const usesOntologyObject = objectEffectTypes.has(effect.type || "update_object");
      return <div className="border border-[#e1e5e9] bg-white p-4" key={`effects-${index}`}>
        <div className="mb-4 flex items-center justify-between"><span className="text-sm font-medium">副作用 {index + 1}</span><button type="button" onClick={() => removeListItem("effects", index)} className="text-xs text-[#b83c34] hover:text-[#d94338]">删除</button></div>
        <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
          <label><span className={labelClass}>执行类型</span><select value={effect.type || "update_object"} onChange={(event) => updateListItem("effects", index, { type: event.target.value })} className={selectClass}><option value="update_object">更新本体对象</option><option value="create_object">创建本体对象</option><option value="delete_object">删除本体对象</option><option value="call_api">调用外部接口</option><option value="notify">发送通知</option><option value="custom">自定义处理</option></select></label>
          {usesOntologyObject ? <label><span className={labelClass}>本体对象</span><select value={effect.objectTypeId || ""} onChange={(event) => updateListItem("effects", index, { objectTypeId: event.target.value })} className={selectClass} disabled={!objectTypes.length}><option value="">{objectTypes.length ? "请选择本体对象" : "当前项目暂无本体对象"}</option>{objectTypes.map((objectType) => <option key={objectType.id} value={objectType.id}>{objectType.name}</option>)}</select></label> : <label><span className={labelClass}>执行目标</span><input value={effect.target || ""} onChange={(event) => updateListItem("effects", index, { target: event.target.value })} placeholder={effect.type === "call_api" ? "请输入接口地址" : effect.type === "notify" ? "请输入通知对象或渠道" : "请输入处理目标"} className={inputClass} /></label>}
          <label className="md:col-span-2"><span className={labelClass}>执行说明</span><textarea value={effect.description || ""} onChange={(event) => updateListItem("effects", index, { description: event.target.value })} placeholder="描述需要更新的字段、调用参数、通知内容或处理规则" className="min-h-20 w-full border border-[#d9dde3] bg-white p-3 text-sm outline-none focus:border-[#e3473c]" /></label>
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
      {triggerType === "manual" && <div className="grid gap-5 md:grid-cols-2">
        <label><span className={labelClass}>可执行角色</span><input value={config.roles || ""} onChange={(event) => updateTriggerConfig({ roles: event.target.value })} placeholder="可选，例如业务负责人, 运营人员" className={inputClass} /></label>
        <label><span className={labelClass}>执行入口说明</span><input value={config.description || ""} onChange={(event) => updateTriggerConfig({ description: event.target.value })} placeholder="说明用户何时可以手动发起" className={inputClass} /></label>
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

  const renderSection = () => {
    if (activeSection === "basic") return <div className="grid gap-5 md:grid-cols-2">
      <label><span className={labelClass}>动作名称 *</span><input value={draft.name || ""} onChange={(event) => patchDraft({ name: event.target.value })} placeholder="请输入动作名称" className={inputClass} /></label>
      <label><span className={labelClass}>关联对象</span><select value={draft.objectTypeId || ""} onChange={(event) => patchDraft({ objectTypeId: event.target.value })} className={inputClass}><option value="">暂不关联</option>{objectTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="md:col-span-2"><span className={labelClass}>动作说明</span><textarea value={draft.description || ""} onChange={(event) => patchDraft({ description: event.target.value })} placeholder="说明动作的业务目的和使用范围" className="min-h-24 w-full border border-[#d9dde3] bg-white p-3 text-sm outline-none focus:border-[#e3473c]" /></label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={draft.enabled !== false} onChange={(event) => patchDraft({ enabled: event.target.checked })} className="h-4 w-4 accent-[#e3473c]" />允许执行此动作</label>
    </div>;
    if (activeSection === "trigger") return renderTrigger();
    if (activeSection === "parameters") return renderParameters();
    if (activeSection === "preconditions") return renderPreconditions();
    if (activeSection === "approvals") return <div className="space-y-5">
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(draft.approvals?.enabled)} onChange={(event) => patchNested("approvals", { enabled: event.target.checked })} className="h-4 w-4 accent-[#e3473c]" />执行前需要审批</label>
      {draft.approvals?.enabled && <div className="grid gap-5 border-t border-[#e4e7eb] pt-5 md:grid-cols-2">
        <label><span className={labelClass}>审批策略</span><select value={draft.approvals?.mode || "any"} onChange={(event) => patchNested("approvals", { mode: event.target.value })} className={selectClass}><option value="any">任一审批角色通过即可</option><option value="all">所有审批角色均需通过</option></select></label>
        <label><span className={labelClass}>审批时限（小时）</span><input type="number" min="1" value={draft.approvals?.timeoutHours || ""} onChange={(event) => patchNested("approvals", { timeoutHours: event.target.value })} placeholder="可选，例如 24" className={inputClass} /></label>
        <label className="md:col-span-2"><span className={labelClass}>审批角色</span><input value={(draft.approvals?.roles || []).join(", ")} onChange={(event) => patchNested("approvals", { roles: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="多个角色用逗号分隔，例如 业务负责人, 风控专员" className={inputClass} /></label>
        <label className="md:col-span-2"><span className={labelClass}>拒绝或超时后</span><select value={draft.approvals?.onReject || "block"} onChange={(event) => patchNested("approvals", { onReject: event.target.value })} className={selectClass}><option value="block">阻止执行并保留待处理状态</option><option value="cancel">取消本次动作</option><option value="escalate">升级给管理员处理</option></select></label>
      </div>}
    </div>;
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
