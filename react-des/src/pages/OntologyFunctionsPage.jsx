import React, { useEffect, useMemo, useState } from "react";
import { deleteOntologyDefinition, fetchOntologyDefinitions, migrateOntologyDefinitions, saveOntologyDefinition } from "../utils/ontologyDefinitionsApi";

const STORAGE_KEY = "workmate-ontology-functions";
const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const normalizeFunction = (item) => ({
  ...item,
  connectionType: item.connectionType || (item.mcpPath ? "mcp" : "api"),
  endpoint: item.endpoint || item.mcpPath || item.apiEndpoint || "",
  enabled: item.enabled !== false,
});

const createDraft = () => {
  const id = makeId("function");
  return {
    id,
    name: "",
    connectionType: "api",
    endpoint: "",
    enabled: true,
  };
};

const loadFunctions = () => {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.map(normalizeFunction) : [];
  } catch {
    return [];
  }
};

const OntologyFunctionsPage = ({ isZh }) => {
  const initialItems = useMemo(loadFunctions, []);
  const requestedDefinitionId = new URLSearchParams(window.location.search).get("selected");
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id || null);
  const [draft, setDraft] = useState(initialItems[0] || createDraft());
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const filteredItems = items.filter((item) => `${item.name} ${item.endpoint}`.toLowerCase().includes(query.toLowerCase()));
  const inputClass = "h-10 w-full rounded border border-[#d9dde3] bg-white px-3 text-sm outline-none focus:border-[#e3473c]";
  const labelClass = "mb-1.5 block text-xs font-medium text-[#69737e]";

  useEffect(() => {
    let active = true;
    const loadDefinitions = async () => {
      try {
        let nextItems = await fetchOntologyDefinitions("function");
        if (!nextItems.length && initialItems.length) {
          await migrateOntologyDefinitions("function", initialItems);
          nextItems = await fetchOntologyDefinitions("function");
        }
        if (!active) return;
        const normalized = nextItems.map(normalizeFunction);
        const requestedItem = normalized.find((item) => item.id === requestedDefinitionId);
        const selectedItem = requestedItem || normalized[0];
        setItems(normalized);
        setSelectedId(selectedItem?.id || null);
        setDraft(selectedItem || createDraft());
      } catch (error) {
        if (active) setMessage(isZh ? `数据库加载失败：${error.message}` : `Database load failed: ${error.message}`);
      }
    };
    loadDefinitions();
    return () => { active = false; };
  }, [isZh, requestedDefinitionId]);

  const patchDraft = (patch) => { setDraft((current) => ({ ...current, ...patch })); setMessage(""); };
  const createNew = () => {
    setSelectedId(null);
    setDraft(createDraft());
    setMessage("");
  };
  const save = async () => {
    if (!draft.name.trim() || !draft.endpoint.trim()) {
      setMessage(isZh ? "请填写函数名称和调用路径。" : "Complete the function name and invocation path.");
      return;
    }
    const exists = items.some((item) => item.id === draft.id);
    try {
      const saved = normalizeFunction(await saveOntologyDefinition("function", {
        ...draft,
        name: draft.name.trim(),
        endpoint: draft.endpoint.trim(),
      }, exists));
      const nextItems = exists ? items.map((item) => item.id === saved.id ? saved : item) : [saved, ...items];
      setItems(nextItems);
      setSelectedId(saved.id);
      setDraft(saved);
      setMessage(isZh ? "函数已保存到数据库。" : "Function saved to database.");
    } catch (error) {
      setMessage(isZh ? `保存失败：${error.message}` : `Save failed: ${error.message}`);
    }
  };
  const remove = async () => {
    if (!selectedId) return;
    try {
      await deleteOntologyDefinition(selectedId);
      const nextItems = items.filter((item) => item.id !== selectedId);
      setItems(nextItems);
      setSelectedId(nextItems[0]?.id || null);
      setDraft(nextItems[0] || createDraft());
      setMessage(isZh ? "函数已从数据库删除。" : "Function deleted from database.");
    } catch (error) {
      setMessage(isZh ? `删除失败：${error.message}` : `Delete failed: ${error.message}`);
    }
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f7f8fa] text-[#252a32]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#e2e5e9] bg-white px-7">
        <div><h1 className="text-lg font-semibold">Function</h1><p className="mt-0.5 text-xs text-[#7b8490]">{isZh ? "注册函数名称，并配置对应的接口或 MCP 调用路径。" : "Register a function name and its API or MCP invocation path."}</p></div>
        <button type="button" onClick={() => createNew()} className="h-9 rounded bg-[#e3473c] px-4 text-sm font-medium text-white">+ {isZh ? "新建" : "New"}</button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-[#e0e4e8] bg-white">
          <div className="border-b border-[#e7eaed] p-4"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isZh ? "搜索函数" : "Search functions"} className={`${inputClass} bg-[#fafbfc]`} /></div>
          <div className="flex items-center justify-between px-4 py-3 text-xs font-semibold text-[#68717d]"><span>Functions</span><span>{filteredItems.length}</span></div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredItems.map((item) => <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setDraft(normalizeFunction(item)); setMessage(""); }} className={`w-full border-t border-[#eef0f2] px-4 py-3 text-left ${selectedId === item.id ? "border-l-2 border-l-[#e3473c] bg-[#fff6f4]" : "hover:bg-[#f7f8fa]"}`}><div className="truncate text-sm font-medium">{item.name}</div><div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-[#858e98]"><span>{item.connectionType === "mcp" ? "MCP" : "API"}</span><span className="truncate">{item.endpoint || "-"}</span></div></button>)}
            {!filteredItems.length && <div className="px-5 py-12 text-center text-xs text-[#959da6]">{isZh ? "暂无函数" : "No functions"}</div>}
          </div>
        </aside>
        <section className="min-h-0 overflow-y-auto p-7">
          <div className="mx-auto max-w-[960px]">
            <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-semibold">{selectedId ? draft.name : (isZh ? "新建函数" : "New function")}</h2><p className="mt-1 text-xs text-[#7c8590]">{isZh ? "函数由名称和一个可执行调用入口组成。" : "A function consists of a name and one executable invocation entry."}</p></div><div className="flex gap-2">{selectedId && <button type="button" onClick={remove} className="h-9 rounded border border-[#d9dde3] bg-white px-3 text-sm text-[#b83c34]">{isZh ? "删除" : "Delete"}</button>}<button type="button" onClick={save} className="h-9 rounded bg-[#252b33] px-4 text-sm font-medium text-white">{isZh ? "保存" : "Save"}</button></div></div>

            <div className="border border-[#dfe3e7] bg-white p-6">
              <div className="grid grid-cols-2 gap-5">
                <label className="col-span-2"><span className={labelClass}>{isZh ? "函数名称 *" : "Function name *"}</span><input value={draft.name} onChange={(event) => patchDraft({ name: event.target.value })} placeholder={isZh ? "例如：校验订单完整性" : "e.g. Validate order completeness"} className={inputClass} /></label>
                <div className="col-span-2"><span className={labelClass}>{isZh ? "调用方式 *" : "Invocation type *"}</span><div className="grid h-10 max-w-sm grid-cols-2 rounded border border-[#d9dde3] bg-[#f4f5f6] p-0.5">{[{ value: "api", label: isZh ? "接口" : "API" }, { value: "mcp", label: "MCP" }].map((option) => <button key={option.value} type="button" onClick={() => patchDraft({ connectionType: option.value, endpoint: "" })} className={`rounded text-xs font-medium ${draft.connectionType === option.value ? "bg-white text-[#252a32] shadow-sm" : "text-[#77808b]"}`}>{option.label}</button>)}</div></div>
                <label className="col-span-2"><span className={labelClass}>{draft.connectionType === "mcp" ? (isZh ? "MCP 路径 *" : "MCP path *") : (isZh ? "接口地址 *" : "API endpoint *")}</span><input value={draft.endpoint} onChange={(event) => patchDraft({ endpoint: event.target.value })} placeholder={draft.connectionType === "mcp" ? "mcp://server/tool-name" : "https://api.example.com/functions/validate-order"} className={inputClass} /></label>
              </div>

              <label className="mt-5 flex items-center gap-2 border-t border-[#edf0f2] pt-5 text-sm"><input type="checkbox" checked={draft.enabled} onChange={(event) => patchDraft({ enabled: event.target.checked })} className="accent-[#e3473c]" />{isZh ? "启用此函数" : "Enable this function"}</label>
            </div>
            <div className={`mt-4 text-right text-xs ${message.includes("请") || message.includes("Complete") ? "text-[#d94338]" : "text-[#39805f]"}`}>{message}</div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default OntologyFunctionsPage;