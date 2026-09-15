import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { OntologyProjectHeader, OntologyProjectNav } from "../components/OntologyProjectWorkspace";
import {
  getModelingProject,
  listModelingMappings,
  listModelingObjects,
  listModelingProperties,
  saveModelingMapping,
} from "../utils/ontologyModelingApi";
import { inferDatasetSchema } from "../utils/datasetSchemaInference";
import { listLocalDatasets } from "../utils/datasetStorage";

const emptySourceDraft = {
  datasetId: "",
  datasetName: "",
  sheetName: "",
  sourceFieldId: "",
  sourceColumn: "",
  transform: "直接映射",
};

const normalizeSources = (mapping, propertyId) =>
  (mapping?.fieldMappings || [])
    .filter((item) => !item.mappingType && item.propertyId === propertyId && item.sourceFieldId)
    .map((item) => ({
      ...item,
      datasetId: item.datasetId || mapping.datasetId,
      datasetName: item.datasetName || mapping.datasetName,
      sheetName: item.sheetName || mapping.sheetName,
      transform: item.transform || "直接映射",
    }));

const normalizeObjectSources = (mapping) =>
  (mapping?.fieldMappings || [])
    .filter((item) => item.mappingType === "object" && item.sourceFieldId)
    .map((item) => ({
      ...item,
      datasetId: item.datasetId || mapping.datasetId,
      datasetName: item.datasetName || mapping.datasetName,
      sheetName: item.sheetName || mapping.sheetName,
      transform: item.transform || "直接匹配",
    }));

function OntologyModelingMapping() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const [project, setProject] = useState(location.state?.project || null);
  const [objects, setObjects] = useState(location.state?.objects || []);
  const [properties, setProperties] = useState([]);
  const [mappingsByObject, setMappingsByObject] = useState({});
  const [datasets, setDatasets] = useState([]);
  const [expandedObjectIds, setExpandedObjectIds] = useState([]);
  const [editor, setEditor] = useState(null);
  const [sourceDraft, setSourceDraft] = useState(emptySourceDraft);
  const [sourceFields, setSourceFields] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(projectId && !location.state?.project));
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    Promise.all([
      getModelingProject(projectId),
      listModelingObjects(projectId),
      listModelingProperties(projectId),
      listModelingMappings(projectId),
      listLocalDatasets(),
    ])
      .then(([savedProject, savedObjects, savedProperties, savedMappings, savedDatasets]) => {
        if (!active) return;
        setProject(savedProject);
        setObjects(savedObjects);
        setProperties(savedProperties);
        setDatasets(savedDatasets);
        setMappingsByObject(Object.fromEntries(savedMappings.map((mapping) => [mapping.objectId, mapping])));
        setExpandedObjectIds(savedObjects[0]?.id ? [savedObjects[0].id] : []);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "数据映射加载失败。");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  const propertiesForObject = (objectId) =>
    properties.filter((property) => property.objectIds.includes(objectId));

  const toggleObject = (objectId) =>
    setExpandedObjectIds((current) =>
      current.includes(objectId)
        ? current.filter((id) => id !== objectId)
        : [...current, objectId],
    );

  const openEditor = (object, property) => {
    setEditor({ type: "property", object, property, sources: normalizeSources(mappingsByObject[object.id], property.id) });
    setSourceDraft(emptySourceDraft);
    setSourceFields([]);
    setError("");
  };

  const openObjectEditor = (object) => {
    setEditor({ type: "object", object, property: null, sources: normalizeObjectSources(mappingsByObject[object.id]) });
    setSourceDraft(emptySourceDraft);
    setSourceFields([]);
    setError("");
  };

  const openNewMapping = () => {
    const object = objects.find((item) => propertiesForObject(item.id).length > 0);
    const property = object ? propertiesForObject(object.id)[0] : null;
    if (object && property) openEditor(object, property);
  };

  const changeEditorObject = (objectId) => {
    const object = objects.find((item) => item.id === objectId);
    const property = object ? propertiesForObject(object.id)[0] : null;
    if (!object) return;
    if (editor.type === "object") {
      openObjectEditor(object);
    } else if (property) {
      openEditor(object, property);
    }
  };

  const changeEditorProperty = (propertyId) => {
    if (editor.type !== "property") return;
    const property = properties.find((item) => item.id === propertyId);
    if (property) openEditor(editor.object, property);
  };

  const selectDataset = async (datasetId) => {
    const dataset = datasets.find((item) => item.id === datasetId);
    setSourceDraft(emptySourceDraft);
    setSourceFields([]);
    if (!dataset) return;
    setIsAnalyzing(true);
    setError("");
    try {
      const schema = await inferDatasetSchema(dataset);
      const fields = schema.properties.map((field) => ({
        ...field,
        id: `${dataset.id}:${schema.sheetName}:${field.columnName}`,
      }));
      setSourceFields(fields);
      setSourceDraft({
        ...emptySourceDraft,
        datasetId: dataset.id,
        datasetName: dataset.name,
        sheetName: schema.sheetName,
      });
    } catch (analysisError) {
      setError(analysisError.message || "数据集字段读取失败。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addSource = () => {
    if (!sourceDraft.datasetId || !sourceDraft.sourceFieldId) return;
    const selectedField = sourceFields.find((field) => field.id === sourceDraft.sourceFieldId);
    const source = { ...sourceDraft, sourceColumn: selectedField?.columnName || "" };
    setEditor((current) => ({
      ...current,
      sources: [
        ...current.sources.filter((item) => !(item.datasetId === source.datasetId && item.sourceFieldId === source.sourceFieldId)),
        source,
      ],
    }));
    setSourceDraft(emptySourceDraft);
    setSourceFields([]);
  };

  const removeSource = (datasetId, sourceFieldId) =>
    setEditor((current) => ({
      ...current,
      sources: current.sources.filter((item) => !(item.datasetId === datasetId && item.sourceFieldId === sourceFieldId)),
    }));

  const saveEditor = async () => {
    if (!editor?.sources.length || isSaving) return;
    const existing = mappingsByObject[editor.object.id];
    const objectPropertyIds = new Set(propertiesForObject(editor.object.id).map((item) => item.id));
    const untouchedMappings = (existing?.fieldMappings || []).filter(
      (item) => editor.type === "object"
        ? item.mappingType !== "object"
        : item.mappingType !== "object" && item.propertyId !== editor.property.id && objectPropertyIds.has(item.propertyId),
    );
    const currentMappings = editor.type === "object"
      ? editor.sources.map((source) => ({ mappingType: "object", ...source }))
      : editor.sources.map((source) => ({ propertyId: editor.property.id, propertyName: editor.property.name, ...source }));
    const fieldMappings = [...untouchedMappings, ...currentMappings];
    const primarySource = editor.sources[0] || fieldMappings[0];
    setIsSaving(true);
    setError("");
    try {
      const saved = await saveModelingMapping(project.id, editor.object.id, {
        datasetId: primarySource.datasetId,
        datasetName: primarySource.datasetName,
        datasetVersion: existing?.datasetVersion || "",
        sheetName: primarySource.sheetName,
        primaryKeyPropertyIds: existing?.primaryKeyPropertyIds || [],
        fieldMappings,
        validation: {
          mappedCount: new Set(fieldMappings.filter((item) => !item.mappingType).map((item) => item.propertyId)).size,
          propertyCount: objectPropertyIds.size,
          sourceCount: new Set(fieldMappings.map((item) => item.datasetId)).size,
        },
        status: "draft",
      });
      setMappingsByObject((current) => ({ ...current, [editor.object.id]: saved }));
      setEditor(null);
    } catch (saveError) {
      setError(saveError.message || "映射保存失败。");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-[#f7f8fa] text-sm text-[#717985]">正在加载建模项目...</div>;
  if (!project) return (
    <div className="flex h-screen items-center justify-center bg-[#f7f8fa]">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-[#20242b]">项目上下文已失效</h1>
        <button type="button" onClick={() => navigate("/ontology-modeling")} className="mt-5 h-10 bg-[#e3473c] px-4 text-sm font-medium text-white">返回对象建模</button>
      </div>
    </div>
  );

  const configurableObjects = objects.filter((object) => propertiesForObject(object.id).length > 0);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fa]">
      <Sidebar activeTab="objects" />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <OntologyProjectHeader project={project} />
        <div className="flex min-h-0 flex-1">
          <OntologyProjectNav projectId={project.id} project={project} activeItem="mapping" />
          <section className="min-w-0 flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-[1180px] border border-[#e0e3e7] bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eceef1] pb-5">
                <div>
                  <h2 className="text-xl font-semibold text-[#20242b]">数据映射</h2>
                  <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#717985]">查看对象、属性与数据源的关联，并为每个属性配置一个或多个来源字段。</p>
                </div>
                <button type="button" onClick={openNewMapping} disabled={!configurableObjects.length} className="h-10 bg-[#e3473c] px-4 text-sm font-medium text-white disabled:bg-[#e7a6a0]">+ 新建映射</button>
              </div>

              {error && !editor && <div className="mt-4 border border-[#f2c5c0] bg-[#fff6f4] px-4 py-3 text-sm text-[#b7372f]">{error}</div>}

              <div className="mt-5 divide-y divide-[#e4e7eb] border-y border-[#e4e7eb]">
                {objects.map((object) => {
                  const objectProperties = propertiesForObject(object.id);
                  const mapping = mappingsByObject[object.id];
                  const objectSourceMappings = normalizeObjectSources(mapping);
                  const objectSourceDatasets = [...new Map(objectSourceMappings.map((source) => [source.datasetId, source.datasetName])).values()];
                  const expanded = expandedObjectIds.includes(object.id);
                  return (
                    <section key={object.id}>
                      <div className="flex w-full items-center gap-5 bg-[#fafbfc] px-5 py-4 hover:bg-[#f6f7f8]">
                        <button type="button" onClick={() => toggleObject(object.id)} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-left">
                          <h3 className="text-base font-semibold text-[#303741]">{object.name}</h3>
                          {objectSourceDatasets.length > 0 && (
                            <span className="flex items-center gap-3 border-l border-[#dfe3e8] pl-4 text-sm font-normal text-[#596270]">
                              {objectSourceDatasets.map((datasetName) => (
                                <span key={datasetName}>{datasetName}</span>
                              ))}
                            </span>
                          )}
                        </button>
                        <div className="flex shrink-0 items-center gap-4">
                          <button type="button" onClick={() => openObjectEditor(object)} className="text-sm text-[#d94338] hover:underline">配置</button>
                          <button type="button" onClick={() => toggleObject(object.id)} className="text-xs font-medium text-[#68717d]">{expanded ? "收起" : "展开"}</button>
                        </div>
                      </div>

                      {expanded && (
                        <div className="border-t border-[#edf0f2] bg-white px-5">
                            {objectProperties.length ? objectProperties.map((property) => {
                              const propertySources = normalizeSources(mapping, property.id);
                              return (
                                <div key={property.id} className="flex min-h-[58px] items-center gap-4 border-b border-[#edf0f2] py-3 last:border-0">
                                  <p className="w-[150px] shrink-0 text-sm text-[#303741]">{property.name}</p>
                                  <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                                    {propertySources.length ? propertySources.map((source) => (
                                      <span key={`${source.datasetId}-${source.sourceFieldId}`} className="inline-flex items-center text-sm text-[#596270]">
                                        {source.datasetName} · {source.sourceColumn}
                                      </span>
                                    )) : <span className="text-xs text-[#a0a6ae]">未映射</span>}
                                  </div>
                                  <button type="button" onClick={() => openEditor(object, property)} className="shrink-0 text-sm text-[#d94338] hover:underline">配置</button>
                                </div>
                              );
                            }) : <div className="border-t border-[#edf0f2] px-5 py-8 text-center text-sm text-[#858d98]">该对象尚未关联属性</div>}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </main>

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17191f]/35 px-4 py-6" onMouseDown={() => !isSaving && setEditor(null)}>
          <div className="flex max-h-[92vh] w-full max-w-[760px] flex-col overflow-hidden bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-[#eceef1] px-7 py-5">
              <div><p className="text-xs text-[#858d98]">{editor.type === "object" ? "对象来源映射" : "属性来源映射"}</p><h2 className="mt-1 text-xl font-semibold text-[#20242b]">{editor.object.name}{editor.property ? ` · ${editor.property.name}` : ""}</h2></div>
              <button type="button" onClick={() => setEditor(null)} aria-label="关闭" className="h-9 w-9 border border-[#dfe3e8] text-lg text-[#68717d]">×</button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">对象</span><select value={editor.object.id} onChange={(event) => changeEditorObject(event.target.value)} className="h-10 w-full border border-[#cfd5dc] bg-white px-3">{configurableObjects.map((object) => <option key={object.id} value={object.id}>{object.name}</option>)}</select></label>
                {editor.type === "property" && <label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">属性</span><select value={editor.property.id} onChange={(event) => changeEditorProperty(event.target.value)} className="h-10 w-full border border-[#cfd5dc] bg-white px-3">{propertiesForObject(editor.object.id).map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>}
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-[#303741]">已配置来源</h3><span className="text-xs text-[#858d98]">{editor.sources.length} 条</span></div>
                {editor.sources.length ? (
                  <div className="mt-3 border border-[#e0e3e7]">
                    {editor.sources.map((source) => (
                      <div key={`${source.datasetId}-${source.sourceFieldId}`} className="flex items-center justify-between gap-4 border-b border-[#edf0f2] px-4 py-3 last:border-0">
                        <div className="min-w-0 text-sm"><p className="font-medium text-[#303741]">{source.datasetName} / {source.sheetName}</p><p className="mt-1 text-xs text-[#68717d]">字段：{source.sourceColumn}</p></div>
                        <button type="button" onClick={() => removeSource(source.datasetId, source.sourceFieldId)} className="shrink-0 text-xs font-medium text-[#d94338] hover:underline">移除</button>
                      </div>
                    ))}
                  </div>
                ) : <div className="mt-3 border border-dashed border-[#cfd5dc] bg-[#fafbfc] px-4 py-6 text-center text-sm text-[#858d98]">该{editor.type === "object" ? "对象" : "属性"}尚未配置来源</div>}
              </div>

              <div className="mt-6 border-t border-[#eceef1] pt-5">
                <h3 className="text-sm font-semibold text-[#303741]">添加{editor.type === "object" ? "对象匹配字段" : "属性来源字段"}</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">数据源 *</span><select value={sourceDraft.datasetId} onChange={(event) => selectDataset(event.target.value)} className="h-10 w-full border border-[#cfd5dc] bg-white px-3"><option value="">请选择数据源</option>{datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.name}</option>)}</select></label>
                  <label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">来源字段 *</span><select value={sourceDraft.sourceFieldId} disabled={!sourceDraft.datasetId || isAnalyzing} onChange={(event) => setSourceDraft((current) => ({ ...current, sourceFieldId: event.target.value }))} className="h-10 w-full border border-[#cfd5dc] bg-white px-3 disabled:bg-[#f5f6f7]"><option value="">{isAnalyzing ? "正在读取字段..." : "请选择来源字段"}</option>{sourceFields.map((field) => <option key={field.id} value={field.id}>{field.columnName}</option>)}</select></label>
                </div>
                <div className="mt-4 flex justify-end"><button type="button" onClick={addSource} disabled={!sourceDraft.datasetId || !sourceDraft.sourceFieldId} className="h-9 border border-[#d94338] px-4 text-sm font-medium text-[#d94338] disabled:border-[#dfe3e8] disabled:text-[#a0a6ae]">添加到该{editor.type === "object" ? "对象" : "属性"}</button></div>
              </div>
              {error && <p className="mt-4 text-sm text-[#b7372f]">{error}</p>}
            </div>

            <div className="flex justify-end gap-3 border-t border-[#eceef1] bg-[#fcfcfd] px-7 py-4">
              <button type="button" onClick={() => setEditor(null)} disabled={isSaving} className="h-10 border border-[#cfd5dc] px-4 text-sm">取消</button>
              <button type="button" onClick={saveEditor} disabled={!editor.sources.length || isSaving} className="h-10 bg-[#e3473c] px-5 text-sm font-medium text-white disabled:bg-[#e7a6a0]">{isSaving ? "保存中..." : "保存映射"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OntologyModelingMapping;