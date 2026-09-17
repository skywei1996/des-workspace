import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { OntologyDefinitionList } from "../components/OntologyDefinitionList";
import OntologyObjectResourceDrawer from "../components/OntologyObjectResourceDrawer";
import {
  createModelingObject,
  createModelingProperty,
  deleteModelingObject,
  deleteModelingProperty,
  getModelingProject,
  listModelingObjects,
  listModelingProperties,
  listModelingRelations,
  updateModelingObject,
  updateModelingProperty,
} from "../utils/ontologyModelingApi";

const emptyForm = {
  name: "",
  definition: "",
  key: "",
  owner: "",
  apiName: "",
  objectIds: [],
  dataType: "文本",
  description: "",
  source: "",
};

const navigationGroups = [
  { title: "", items: [{ key: "overview", label: "项目概览", path: "" }] },
  {
    title: "本体结构",
    items: [
      { key: "objects", label: "对象", path: "" },
      { key: "properties", label: "属性", path: "/properties" },
    ],
  },
  {
    title: "业务逻辑",
    items: [
      { key: "actions", label: "动作", path: "/actions" },
      { key: "functions", label: "函数", path: "/functions" },
    ],
  },
  {
    title: "数据管理",
    items: [{ key: "mapping", label: "数据映射", path: "/mapping" }],
  },
  {
    title: "发布管理",
    items: [{ key: "validation", label: "版本发布", path: "/validation" }],
  },
];

function OntologyProjectWorkspacePage({ activeSection = "objects" }) {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const [project, setProject] = useState(null);
  const [objects, setObjects] = useState([]);
  const [properties, setProperties] = useState([]);
  const [relations, setRelations] = useState([]);
  const [resourceDrawer, setResourceDrawer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [createForm, setCreateForm] = useState(emptyForm);

  useEffect(() => {
    let active = true;
    Promise.all([
      getModelingProject(projectId),
      listModelingObjects(projectId),
      listModelingProperties(projectId),
      listModelingRelations(projectId),
    ])
      .then(([savedProject, savedObjects, savedProperties, savedRelations]) => {
        if (!active) return;
        setProject(savedProject);
        setObjects(savedObjects);
        setProperties(savedProperties);
        setRelations(savedRelations);
      })
      .catch(() => {
        if (active) setProject(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => {
    const createType = searchParams.get("create");
    setIsCreateOpen(createType === "object" || createType === "property");
  }, [searchParams]);

  useEffect(() => {
    const handleObjectResourceClick = (event) => {
      const button = event.target.closest("button");
      if (
        !button ||
        !["属性", "关联"].includes(button.textContent.trim()) ||
        activeSection !== "objects"
      )
        return;
      const row = button.closest("div.border-b");
      const object = objects.find((item) =>
        row?.textContent.includes(item.name),
      );
      if (!object) return;
      event.preventDefault();
      event.stopPropagation();
      setResourceDrawer({
        mode: button.textContent.trim() === "属性" ? "property" : "link",
        object,
      });
    };
    document.addEventListener("click", handleObjectResourceClick, true);
    return () =>
      document.removeEventListener("click", handleObjectResourceClick, true);
  }, [activeSection, objects]);

  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f8fa] text-sm text-[#717985]">
        正在加载项目...
      </div>
    );
  if (!project)
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f8fa] text-sm text-[#717985]">
        项目上下文已失效
      </div>
    );

  const goTo = (path) =>
    navigate(`/ontology-modeling/projects/${project.id}${path}`, {
      state: { project, objects },
    });
  const isProperties = activeSection === "properties";
  const createType = searchParams.get("create");
  const formType = editingItem?.type || createType;
  const closeCreate = () => {
    setIsCreateOpen(false);
    setEditingItem(null);
    setCreateForm(emptyForm);
    navigate(
      `/ontology-modeling/projects/${project.id}${isProperties ? "/properties" : ""}`,
      { replace: true, state: { project, objects } },
    );
  };
  const openEdit = (item, type) => {
    setEditingItem({ item, type });
    setCreateForm(
      type === "object"
        ? {
            ...emptyForm,
            name: item.name,
            definition: item.definition,
            key: item.key,
            owner: item.owner,
          }
        : {
            ...emptyForm,
            name: item.name,
            apiName: item.apiName || "",
            objectIds: item.objectIds || [],
            dataType: item.dataType || "文本",
            description: item.description || "",
            source: item.source || "",
          },
    );
    setIsCreateOpen(true);
  };
  const updateCreateForm = (field, value) =>
    setCreateForm((current) => ({ ...current, [field]: value }));
  const saveBindings = (nextProperties, nextRelations) => {
    window.localStorage.setItem(
      `ontology-modeling-properties:${project.id}`,
      JSON.stringify(nextProperties),
    );
    window.localStorage.setItem(
      `ontology-modeling-relations:${project.id}`,
      JSON.stringify(nextRelations),
    );
    setProperties(nextProperties);
    setRelations(nextRelations);
  };
  const bindResource = (resource) => {
    if (!resourceDrawer || !resource) return;
    if (resourceDrawer.mode === "property") {
      const selectedIds = Array.isArray(resource) ? resource : [resource.id];
      const nextProperties = properties.map((item) =>
        selectedIds.includes(item.id)
          ? {
              ...item,
              objectIds: Array.from(
                new Set([...(item.objectIds || []), resourceDrawer.object.id]),
              ),
            }
          : item,
      );
      saveBindings(nextProperties, relations);
    } else {
      const nextRelations = [
        ...relations,
        { id: `relation-${Date.now()}`, projectId: project.id, ...resource },
      ];
      saveBindings(properties, nextRelations);
    }
  };
  const unbindResource = (resource) => {
    if (!resourceDrawer) return;
    if (resourceDrawer.mode === "property") {
      const nextProperties = properties.map((item) =>
        item.id === resource.id
          ? {
              ...item,
              objectIds: (item.objectIds || []).filter(
                (id) => id !== resourceDrawer.object.id,
              ),
              objectId:
                item.objectId === resourceDrawer.object.id ? "" : item.objectId,
            }
          : item,
      );
      saveBindings(nextProperties, relations);
    } else {
      const nextRelations = relations.filter((item) => item.id !== resource.id);
      saveBindings(properties, nextRelations);
    }
  };
  const submitCreate = async (event) => {
    event.preventDefault();
    if (isSaving || !createForm.name.trim()) return;
    setIsSaving(true);
    try {
      const formType = editingItem?.type || createType;
      if (formType === "object") {
        const payload = {
          name: createForm.name.trim(),
          definition: createForm.definition.trim(),
          key: createForm.key.trim(),
          owner: createForm.owner.trim(),
          lifecycle: "长期存在",
        };
        const savedObject = editingItem
          ? await updateModelingObject(project.id, editingItem.item.id, payload)
          : await createModelingObject(project.id, payload);
        setObjects((current) =>
          editingItem
            ? current.map((item) =>
                item.id === savedObject.id ? savedObject : item,
              )
            : [...current, savedObject],
        );
      } else {
        const payload = {
          name: createForm.name.trim(),
          apiName: createForm.apiName.trim(),
          objectIds: createForm.objectIds,
          dataType: createForm.dataType,
          description: createForm.description.trim(),
          source: createForm.source.trim(),
        };
        const savedProperty = editingItem
          ? await updateModelingProperty(
              project.id,
              editingItem.item.id,
              payload,
            )
          : await createModelingProperty(project.id, payload);
        setProperties((current) =>
          editingItem
            ? current.map((item) =>
                item.id === savedProperty.id ? savedProperty : item,
              )
            : [...current, savedProperty],
        );
      }
      closeCreate();
    } finally {
      setIsSaving(false);
    }
  };
  const confirmDelete = async () => {
    if (!deleteTarget || isSaving) return;
    setIsSaving(true);
    try {
      if (deleteTarget.type === "object") {
        await deleteModelingObject(project.id, deleteTarget.item.id);
        setObjects((current) =>
          current.filter((item) => item.id !== deleteTarget.item.id),
        );
        setProperties((current) =>
          current.map((item) => ({
            ...item,
            objectIds: (item.objectIds || []).filter(
              (id) => id !== deleteTarget.item.id,
            ),
          })),
        );
        setRelations((current) =>
          current.filter(
            (item) =>
              item.sourceObjectId !== deleteTarget.item.id &&
              item.targetObjectId !== deleteTarget.item.id,
          ),
        );
      } else {
        await deleteModelingProperty(project.id, deleteTarget.item.id);
        setProperties((current) =>
          current.filter((item) => item.id !== deleteTarget.item.id),
        );
      }
      setDeleteTarget(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fa] text-[#252a32]">
      <Sidebar compact collapseStateKey="ontology-project" />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="border-b border-[#e4e7eb] bg-white px-7 py-4">
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm text-[#7b8490]">
                <button
                  type="button"
                  onClick={() => navigate("/ontology-modeling")}
                  className="hover:text-[#d94338]"
                >
                  项目列表
                </button>
                <span>/</span>
                <span className="font-medium text-[#303741]">
                  {project.name}
                </span>
                <span className="rounded-full bg-[#eaf7ef] px-2.5 py-1 text-xs font-medium text-[#2f8f61]">
                  已发布
                </span>
              </div>
              <p className="mt-2 text-xs text-[#858d98]">
                {project.domain} · 负责人：{project.owner} · 业务口径：
                {project.terminologyOwner}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/ontology-modeling")}
              className="h-9 shrink-0 rounded-md border border-[#cfd5dc] bg-white px-4 text-sm font-medium text-[#4c5561] hover:border-[#e3473c] hover:text-[#d94338]"
            >
              编辑项目
            </button>
          </div>
        </header>
        <div className="flex min-h-[calc(100vh-81px)]">
          <aside className="w-[208px] shrink-0 border-r border-[#e0e3e7] bg-white px-3 py-4">
            <nav>
              {navigationGroups.map((group, index) => (
                <div
                  key={group.title || "overview"}
                  className={index ? "mt-4" : ""}
                >
                  {group.title && (
                    <div className="px-3 pb-1.5 text-[11px] font-semibold text-[#9299a3]">
                      {group.title}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() =>
                          item.path !== undefined && goTo(item.path)
                        }
                        className={`relative flex h-9 w-full items-center px-3 text-left text-sm ${item.key === activeSection ? "bg-[#fff1ee] font-semibold text-[#d94338] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[#e3473c]" : "font-medium text-[#596270] hover:bg-[#f7f8fa]"}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
          <section className="min-w-0 flex-1 p-6">
            <div className="border border-[#e0e3e7] bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eceef1] pb-5">
                <div>
                  <h1 className="text-xl font-semibold text-[#20242b]">
                    {isProperties ? "属性" : "对象"}
                  </h1>
                  <p className="mt-1.5 text-sm text-[#717985]">
                    {isProperties
                      ? "维护项目中对象的属性定义、数据类型和业务口径。"
                      : "维护项目中的业务对象、业务标识和责任归属。"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/ontology-modeling/projects/${project.id}${isProperties ? "/properties?create=property" : "?create=object"}`,
                    )
                  }
                  className="h-10 rounded-md bg-[#e3473c] px-4 text-sm font-medium text-white hover:bg-[#cf3e34]"
                >
                  + 新建{isProperties ? "属性" : "对象"}
                </button>
              </div>
              <OntologyDefinitionList
                isProperties={isProperties}
                objects={objects}
                properties={properties}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                onOpenResources={(mode, object) => setResourceDrawer({ mode, object })}
              />
            </div>
          </section>
        </div>
      </main>
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#17191f]/35"
          onMouseDown={closeCreate}
        >
          <form
            onSubmit={submitCreate}
            onMouseDown={(event) => event.stopPropagation()}
            className="ml-auto h-full w-full max-w-[620px] overflow-y-auto bg-white shadow-[-20px_0_70px_rgba(15,23,42,0.2)]"
          >
            <div className="border-b border-[#eceef1] px-7 py-5">
              <p className="text-xs font-semibold text-[#d94338]">
                {formType === "property"
                  ? "DEFINE PROPERTY"
                  : "DEFINE OBJECT"}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#20242b]">
                {editingItem ? "编辑" : "新建"}{formType === "property" ? "属性" : "对象"}
              </h2>
              <p className="mt-1 text-sm text-[#717985]">
                {editingItem ? "修改定义后保存，关联和映射信息将继续保留。" : "在当前项目中创建定义，保存后仍停留在当前工作台。"}
              </p>
            </div>
            <div className="space-y-5 px-7 py-6">
              <label className="block text-sm">
                <span className="mb-2 block font-semibold text-[#353c46]">
                  {formType === "property" ? "属性名称" : "对象名称"} *
                </span>
                <input
                  autoFocus
                  value={createForm.name}
                  onChange={(event) =>
                    updateCreateForm("name", event.target.value)
                  }
                  className="h-10 w-full rounded-md border border-[#cfd5dc] px-3 outline-none focus:border-[#e3473c]"
                />
              </label>
              {formType === "property" ? (
                <>
                  <div className="grid gap-5 md:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-2 block font-semibold text-[#353c46]">API 名称</span>
                      <input value={createForm.apiName} onChange={(event) => updateCreateForm("apiName", event.target.value)} className="h-10 w-full rounded-md border border-[#cfd5dc] px-3" />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-2 block font-semibold text-[#353c46]">
                        数据类型
                      </span>
                      <select
                        value={createForm.dataType}
                        onChange={(event) =>
                          updateCreateForm("dataType", event.target.value)
                        }
                        className="h-10 w-full rounded-md border border-[#cfd5dc] px-3"
                      >
                        <option>文本</option>
                        <option>数字</option>
                        <option>日期</option>
                        <option>布尔值</option>
                      </select>
                    </label>
                  </div>
                  <label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">绑定对象</span><select multiple value={createForm.objectIds} onChange={(event) => updateCreateForm("objectIds", Array.from(event.target.selectedOptions, (option) => option.value))} className="min-h-28 w-full rounded-md border border-[#cfd5dc] px-3 py-2">{objects.map((object) => <option key={object.id} value={object.id}>{object.name}</option>)}</select></label>
                  <label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">来源</span><input value={createForm.source} onChange={(event) => updateCreateForm("source", event.target.value)} className="h-10 w-full rounded-md border border-[#cfd5dc] px-3" /></label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-semibold text-[#353c46]">
                      业务说明
                    </span>
                    <textarea
                      value={createForm.description}
                      onChange={(event) =>
                        updateCreateForm("description", event.target.value)
                      }
                      rows={3}
                      className="w-full resize-none rounded-md border border-[#cfd5dc] px-3 py-2"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="block text-sm">
                    <span className="mb-2 block font-semibold text-[#353c46]">
                      业务定义 *
                    </span>
                    <textarea
                      value={createForm.definition}
                      onChange={(event) =>
                        updateCreateForm("definition", event.target.value)
                      }
                      rows={3}
                      className="w-full resize-none rounded-md border border-[#cfd5dc] px-3 py-2"
                    />
                  </label>
                  <div className="grid gap-5 md:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-2 block font-semibold text-[#353c46]">
                        唯一标识 *
                      </span>
                      <input
                        value={createForm.key}
                        onChange={(event) =>
                          updateCreateForm("key", event.target.value)
                        }
                        className="h-10 w-full rounded-md border border-[#cfd5dc] px-3"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-2 block font-semibold text-[#353c46]">
                        业务 Owner *
                      </span>
                      <input
                        value={createForm.owner}
                        onChange={(event) =>
                          updateCreateForm("owner", event.target.value)
                        }
                        className="h-10 w-full rounded-md border border-[#cfd5dc] px-3"
                      />
                    </label>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-[#eceef1] bg-[#fcfcfd] px-7 py-4">
              <button
                type="button"
                onClick={closeCreate}
                className="h-10 rounded-md border border-[#cfd5dc] px-5 text-sm font-medium text-[#4c5561]"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={
                  isSaving ||
                  !createForm.name.trim() ||
                  (formType === "object" &&
                    (!createForm.definition.trim() ||
                      !createForm.key.trim() ||
                      !createForm.owner.trim()))
                }
                className="h-10 rounded-md bg-[#e3473c] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-[#e7a6a0]"
              >
                {isSaving ? "保存中..." : editingItem ? "保存修改" : "保存"}
              </button>
            </div>
          </form>
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17191f]/35 px-4" onMouseDown={() => !isSaving && setDeleteTarget(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="delete-definition-title" className="w-full max-w-[440px] rounded-lg bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.2)]" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="delete-definition-title" className="text-lg font-semibold text-[#20242b]">删除{deleteTarget.type === "object" ? "对象" : "属性"}？</h2>
            <p className="mt-2 text-sm leading-6 text-[#69727e]">“{deleteTarget.item.name}”将被永久删除。{deleteTarget.type === "object" ? "相关关系、数据映射会一并清理，已有属性会解除与该对象的绑定。" : "相关字段映射和主键引用会一并清理。"}</p>
            <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={isSaving} onClick={() => setDeleteTarget(null)} className="h-10 rounded-md border border-[#cfd5dc] px-5 text-sm font-medium text-[#4c5561]">取消</button><button type="button" disabled={isSaving} onClick={confirmDelete} className="h-10 rounded-md bg-[#d94338] px-5 text-sm font-medium text-white disabled:opacity-50">{isSaving ? "删除中..." : "确认删除"}</button></div>
          </div>
        </div>
      )}
      {resourceDrawer && (
        <OntologyObjectResourceDrawer
          mode={resourceDrawer.mode}
          object={resourceDrawer.object}
          objects={objects}
          properties={properties}
          relations={relations}
          onClose={() => setResourceDrawer(null)}
          onBind={bindResource}
          onUnbind={unbindResource}
        />
      )}
    </div>
  );
}

export default OntologyProjectWorkspacePage;
