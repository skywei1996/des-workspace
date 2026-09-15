import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import OntologyGraphPage from "./OntologyGraphPage";
import OntologyRulesPage from "./OntologyRulesPage";
import OntologyOperationsPage from "./OntologyOperationsPage";
import OntologyActionsPage from "./OntologyActionsPage";
import OntologyFunctionsPage from "./OntologyFunctionsPage";
import SimpleChatPage from "./SimpleChatPage";
import { useLanguage } from "../i18n";
import { API_BASE } from "../config/api";
import { listLocalDatasets } from "../utils/datasetStorage";
import { loadOntologyDesignCollection, saveOntologyDesignCollection } from "../utils/ontologyDesignStorage";
import { fetchOntologyDefinitions } from "../utils/ontologyDefinitionsApi";
import { extractPdfText } from "../utils/pdfSchemaExtraction";
import { inferDatasetSchema } from "../utils/datasetSchemaInference";

const SECTION_KEYS = {
  chat: "object.menu.chat",
  "object-types": "object.menu.objectTypes",
  "link-types": "object.menu.linkTypes",
  "action-types": "object.menu.actionTypes",
  "object-actions": "object.menu.objectActions",
  "event-types": "object.menu.eventTypes",
  "shared-properties": "object.menu.sharedProperties",
  interfaces: "object.menu.interfaces",
  functions: "object.menu.functions",
  rules: "object.menu.rules",
  graph: "object.menu.graph",
};

const INITIAL_OBJECT_TYPES = [
  {
    id: "employee",
    name: "员工",
    apiName: "Employee",
    description: "企业员工及其组织信息",
    status: "published",
    updatedAt: "今天",
  },
  {
    id: "contract",
    name: "合同",
    apiName: "Contract",
    description: "企业采购与销售合同",
    status: "draft",
    updatedAt: "昨天",
  },
  {
    id: "supplier",
    name: "供应商",
    apiName: "Supplier",
    description: "企业外部供应商",
    status: "published",
    updatedAt: "3 天前",
  },
];

const INITIAL_PROPERTIES = [
  {
    id: "employee-id",
    objectTypeId: "employee",
    name: "员工编号",
    apiName: "employeeId",
    dataType: "文本",
    required: true,
    primaryKey: true,
  },
  {
    id: "employee-name",
    objectTypeId: "employee",
    name: "姓名",
    apiName: "name",
    dataType: "文本",
    required: true,
  },
  {
    id: "employee-status",
    objectTypeId: "employee",
    name: "在职状态",
    apiName: "status",
    dataType: "枚举",
    required: true,
  },
  {
    id: "contract-id",
    objectTypeId: "contract",
    name: "合同编号",
    apiName: "contractId",
    dataType: "文本",
    required: true,
    primaryKey: true,
  },
  {
    id: "contract-supplier-id",
    objectTypeId: "contract",
    name: "供应商编号",
    apiName: "supplierId",
    dataType: "文本",
    required: true,
  },
  {
    id: "contract-amount",
    objectTypeId: "contract",
    name: "合同金额",
    apiName: "amount",
    dataType: "数字",
    required: false,
  },
  {
    id: "supplier-id",
    objectTypeId: "supplier",
    name: "供应商编号",
    apiName: "supplierId",
    dataType: "文本",
    required: true,
    primaryKey: true,
  },
];

const INITIAL_LINKS = [
  {
    id: "contract-supplier",
    name: "签约",
    apiName: "contractSupplier",
    sourceObjectTypeId: "contract",
    targetObjectTypeId: "supplier",
    sourceCardinality: "many",
    targetCardinality: "one",
    cardinality: "多对一",
    sourceSide: {
      displayName: "签订的合同",
      pluralDisplayName: "签订的合同",
      apiName: "contracts",
      visibility: "normal",
    },
    targetSide: {
      displayName: "签约供应商",
      apiName: "supplier",
      visibility: "prominent",
    },
    mapping: {
      type: "foreignKey",
      foreignKeyObjectTypeId: "contract",
      foreignKeyPropertyId: "contract-supplier-id",
      primaryKeyObjectTypeId: "supplier",
      primaryKeyPropertyId: "supplier-id",
    },
    status: "experimental",
  },
];

const useSessionData = (key, fallback) => {
  const [value, setValue] = useState(fallback);
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;
    loadOntologyDesignCollection(key)
      .then(async (items) => {
        if (!active) return;
        const legacyValue = window.sessionStorage.getItem(key);
        if (items) {
          setValue(items);
          window.sessionStorage.removeItem(key);
        } else if (legacyValue) {
          const parsedLegacyValue = JSON.parse(legacyValue);
          setValue(parsedLegacyValue);
          await saveOntologyDesignCollection(key, parsedLegacyValue);
          window.sessionStorage.removeItem(key);
        } else {
          await saveOntologyDesignCollection(key, fallback);
        }
        hydrated.current = true;
      })
      .catch((error) => {
        console.error(`Failed to load ontology design collection ${key}`, error);
        hydrated.current = true;
      });
    return () => {
      active = false;
    };
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    saveOntologyDesignCollection(key, value).catch((error) => {
      console.error(`Failed to save ontology design collection ${key}`, error);
    });
  }, [key, value]);

  return [value, setValue];
};

const SearchIcon = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const PlusIcon = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const ObjectTypeIcon = () => (
  <svg
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden="true"
  >
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8 9h8M8 13h5" />
  </svg>
);

const EditIcon = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden="true"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
  </svg>
);

const DeleteIcon = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden="true"
  >
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
  </svg>
);

const DatabaseIcon = () => (
  <svg
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden="true"
  >
    <ellipse cx="12" cy="5" rx="7" ry="3" />
    <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
  </svg>
);

const normalizeObjectPropertyApiName = (value, fallback) => {
  const normalized = String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, next) =>
      next ? next.toUpperCase() : "",
    );
  return /^[a-zA-Z]/.test(normalized)
    ? normalized.charAt(0).toLowerCase() + normalized.slice(1)
    : fallback;
};

const normalizeChinesePropertyDescription = (value) => {
  const chineseText = String(value || "")
    .replace(/[A-Za-z][A-Za-z0-9_.:/-]*/g, "")
    .replace(/[\s/_-]+/g, " ")
    .replace(/\s+([，。；：])/g, "$1")
    .trim();
  if (!/[\u3400-\u9fff]/.test(chineseText)) {
    return "该属性来自文档中的业务信息。";
  }
  return /[。！？]$/.test(chineseText) ? chineseText : `${chineseText}。`;
};

const analyzePdfDataset = async (dataset) => {
  const extracted = await extractPdfText(dataset);
  const response = await fetch(`${API_BASE}/object-type-analysis/document`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_name: dataset.name, text: extracted.text }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.detail || "PDF 文档语义分析失败，请检查模型配置。");

  const properties = (payload.properties || [])
    .map((property, index) => ({
      id: `property-${index + 1}`,
      name: String(property.name || "").trim(),
      apiName: normalizeObjectPropertyApiName(
        property.apiName || property.name,
        `property${index + 1}`,
      ),
      dataType: ["文本", "数字", "日期", "布尔", "枚举"].includes(
        property.dataType,
      )
        ? property.dataType
        : "文本",
      source: "document",
      sourceName: `${dataset.name} / 文档语义 / ${property.evidence || "模型候选"}`,
      datasetId: dataset.id,
      datasetName: dataset.name,
      evidence: property.evidence || "",
      description: normalizeChinesePropertyDescription(property.evidence),
      required: Boolean(property.required),
    }))
    .filter((property) => property.name);

  const titleProperty = properties.find(
    (property) => property.name === payload.titleProperty,
  );
  return {
    properties,
    primaryKeyId: "",
    titleKeyId: titleProperty?.id || "",
    sheetName: `PDF ${extracted.pageCount} 页正文`,
    rowCount: extracted.pageCount,
    semanticCandidate: payload.objectType || null,
    instanceHints: Array.isArray(payload.instanceHints)
      ? payload.instanceHints
      : [],
    confidence: payload.confidence || 0,
  };
};

const analyzeTabularDataset = async (dataset) => {
  const inferred = await inferDatasetSchema(dataset);
  const columns = inferred.properties.map((property) => ({
    name: property.name,
    dataType: property.dataType,
    sampleValues: property.sampleValues || [],
    nonEmptyRate: property.nonEmptyRate,
    uniqueRate: property.uniqueRate,
  }));
  const response = await fetch(`${API_BASE}/object-type-analysis/table`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataset_name: dataset.name,
      sheet_name: inferred.sheetName,
      columns,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.detail || "表格实体语义分析失败，请检查模型配置。");
  const semanticsByColumn = new Map(
    (payload.columnSemantics || []).map((item) => [String(item.columnName || "").trim(), item]),
  );
  return {
    ...inferred,
    properties: inferred.properties.map((property) => {
      const semantics = semanticsByColumn.get(property.columnName);
      return semantics
        ? {
            ...property,
            name: String(semantics.name || property.name).trim(),
            description: String(semantics.description || property.description).trim(),
          }
        : property;
    }),
    semanticCandidate: payload.objectType || null,
    instanceHints: Array.isArray(payload.instanceHints)
      ? payload.instanceHints
      : [],
    confidence: payload.confidence || 0,
  };
};

const analyzeSemanticText = async (text) => {
  const response = await fetch(`${API_BASE}/object-type-analysis/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || "用户语义分析失败，请检查模型配置。");
  }
  return payload;
};

const supportingPropertySuffix = (datasetName) =>
  normalizeObjectPropertyApiName(
    String(datasetName || "supporting").replace(/\.[^.]+$/, ""),
    "supporting",
  );

const mergeDatasourceProperties = (primaryProperties, supportingSchemas) => {
  const usedApiNames = new Set(
    primaryProperties.map((property) => property.apiName),
  );
  const supportingProperties = supportingSchemas.flatMap(
    ({ dataset, inferred }) =>
      inferred.properties.map((property, index) => {
        const baseApiName = property.apiName || `property${index + 1}`;
        const suffix = supportingPropertySuffix(dataset.name);
        let apiName = baseApiName;
        let duplicateIndex = 2;
        while (usedApiNames.has(apiName)) {
          apiName = `${baseApiName}${suffix.charAt(0).toUpperCase()}${suffix.slice(1)}${duplicateIndex > 2 ? duplicateIndex : ""}`;
          duplicateIndex += 1;
        }
        usedApiNames.add(apiName);
        return {
          ...property,
          id: `supporting-${dataset.id}-${index + 1}`,
          apiName,
          datasetId: dataset.id,
          datasetName: dataset.name,
          datasourceRole: "supporting",
        };
      }),
  );
  return [
    ...primaryProperties.map((property) => ({
      ...property,
      datasourceRole: "primary",
    })),
    ...supportingProperties,
  ];
};

const PropertyMappingStep = ({
  isZh,
  datasourceMode,
  properties,
  validProperties,
  primaryKeyId,
  titleKeyId,
  onPrimaryKeyChange,
  onTitleKeyChange,
  onPropertyChange,
  onAdd,
  onRemove,
}) => (
  <div>
    <div className="mb-5 grid grid-cols-2 gap-5">
      <label>
        <span className="mb-2 block text-sm font-medium">
          {isZh ? "主键" : "Primary key"} *
        </span>
        <select
          value={primaryKeyId}
          onChange={(event) => onPrimaryKeyChange(event.target.value)}
          className="h-10 w-full border border-[#cfd5dc] bg-white px-3 text-sm"
        >
          <option value="">{isZh ? "选择属性" : "Select property"}</option>
          {validProperties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-2 block text-sm font-medium">
          {isZh ? "标题属性" : "Title property"} *
        </span>
        <select
          value={titleKeyId}
          onChange={(event) => onTitleKeyChange(event.target.value)}
          className="h-10 w-full border border-[#cfd5dc] bg-white px-3 text-sm"
        >
          <option value="">{isZh ? "选择属性" : "Select property"}</option>
          {validProperties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </label>
    </div>
    <div className="grid grid-cols-[190px_120px_minmax(180px,0.8fr)_minmax(220px,1.2fr)_36px] gap-3 pb-2 text-xs font-semibold text-[#747d88]">
      <span>{isZh ? "来源" : "Source"}</span>
      <span>{isZh ? "类型" : "Type"}</span>
      <span>{isZh ? "属性名称" : "Property name"}</span>
      <span>{isZh ? "说明" : "Description"}</span>
      <span />
    </div>
    <div className="space-y-2">
      {properties.map((property, index) => (
        <div
          key={property.id}
          className="grid grid-cols-[190px_120px_minmax(180px,0.8fr)_minmax(220px,1.2fr)_36px] gap-3"
        >
          <div className="flex h-10 items-center gap-2 border border-[#d8dde3] bg-[#f8f9fa] px-3 text-sm text-[#68717d]">
            <DatabaseIcon />
            <span className="truncate">
              {property.source === "datasource"
                ? property.sourceName ||
                  (isZh
                    ? `数据源字段 ${index + 1}`
                    : `Datasource field ${index + 1}`)
                : property.source === "document"
                  ? property.sourceName ||
                    (isZh ? "PDF 文档语义分析" : "PDF semantic analysis")
                  : isZh
                    ? "用户输入 / 操作"
                    : "User input / actions"}
            </span>
          </div>
          <select
            value={property.dataType}
            onChange={(event) =>
              onPropertyChange(property.id, "dataType", event.target.value)
            }
            className="h-10 border border-[#cfd5dc] bg-white px-3 text-sm"
          >
            <option value="文本">string</option>
            <option value="数字">number</option>
            <option value="日期">date</option>
            <option value="布尔">boolean</option>
            <option value="枚举">enum</option>
          </select>
          <div className="flex h-10 min-w-0 border border-[#cfd5dc] bg-white">
            <input
              value={property.name}
              onChange={(event) =>
                onPropertyChange(property.id, "name", event.target.value)
              }
              placeholder={isZh ? "属性名称" : "Property name"}
              className="min-w-0 flex-1 px-3 text-sm outline-none"
            />
            {property.id === primaryKeyId && (
              <span className="m-1.5 inline-flex items-center bg-[#f0eaff] px-2 text-xs text-[#7355c6]">
                {isZh ? "主键" : "Primary key"}
              </span>
            )}
            {property.id === titleKeyId && (
              <span className="m-1.5 inline-flex items-center bg-[#e7f6f2] px-2 text-xs text-[#27816d]">
                {isZh ? "标题" : "Title"}
              </span>
            )}
          </div>
          <input
            value={property.description || ""}
            onChange={(event) =>
              onPropertyChange(property.id, "description", event.target.value)
            }
            placeholder={isZh ? "属性说明" : "Property description"}
            className="h-10 min-w-0 border border-[#cfd5dc] bg-white px-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => onRemove(property.id)}
            disabled={properties.length === 1}
            className="flex h-10 items-center justify-center text-[#8a929d] hover:text-[#d94338] disabled:opacity-30"
            aria-label={isZh ? "删除属性" : "Delete property"}
          >
            <DeleteIcon />
          </button>
        </div>
      ))}
    </div>
    <button
      type="button"
      onClick={onAdd}
      className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#d94338] transition hover:text-[#bd342b]"
    >
      <PlusIcon />
      {isZh ? "添加属性" : "Add property"}
    </button>
    <p className="mt-3 text-xs text-[#818a96]">
      {datasourceMode === "existing"
        ? isZh
          ? "属性会映射到所选数据源字段。"
          : "Properties map to fields in the selected datasource."
        : isZh
          ? "当前未连接数据源，属性值由用户输入或动作写入。"
          : "Without a datasource, values come from user input or actions."}
    </p>
  </div>
);

const FieldMappingStep = ({
  isZh,
  datasourceMode,
  properties,
  sourceFields,
  fieldMappings,
  onMappingChange,
  availableDatasets,
  primaryDatasetId,
  onSelectPrimaryDataset,
  onStartMapping,
}) => {
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const rowHeight = 56;
  const canvasHeight = Math.max(properties.length, sourceFields.length, 1) * rowHeight;
  const sourceIndexById = new Map(sourceFields.map((field, index) => [field.id, index]));

  if (datasourceMode !== "existing" || sourceFields.length === 0) {
    return (
      <div className="max-w-[760px] rounded-sm border border-dashed border-[#cfd5dc] bg-white p-6">
        <div className="mb-4 text-base font-medium text-[#343b45]">
          {isZh ? "选择数据表并开始字段映射" : "Select a table and start field mapping"}
        </div>
        <p className="mb-5 text-sm leading-6 text-[#747d89]">
          {isZh
            ? "如果当前对象还没有绑定数据源，可在这里直接选择已有表，然后开始字段映射并编辑映射关系。"
            : "If the object is not yet bound to a datasource, you can select an existing table here and begin field mapping and relationship editing immediately."}
        </p>

        <div className="mb-4 max-h-[240px] overflow-y-auto border border-[#dfe3e8] bg-[#fafbfc]">
          {availableDatasets.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#6a737d]">
              {isZh ? "暂无可用数据表，请先导入数据源。" : "No tables available yet. Import a datasource first."}
            </div>
          ) : (
            availableDatasets.map((dataset) => (
              <button
                key={dataset.id}
                type="button"
                onClick={() => onSelectPrimaryDataset(dataset.id)}
                className={`flex w-full items-center justify-between border-b border-[#edf0f2] px-4 py-3 text-left transition last:border-b-0 ${primaryDatasetId === dataset.id ? "bg-[#fff1ef]" : "hover:bg-white"}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[#303741]">
                    {dataset.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-[#858e99]">
                    {(dataset.extension || "FILE").toUpperCase()} · {dataset.size < 1024 ? `${dataset.size} B` : `${(dataset.size / 1024).toFixed(1)} KB`}
                  </span>
                </span>
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ${primaryDatasetId === dataset.id ? "bg-[#e3473c] text-white" : "bg-[#eef1f4] text-[#5c6773]"}`}>
                  {primaryDatasetId === dataset.id ? (isZh ? "已选" : "Selected") : (isZh ? "选择" : "Select")}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={!primaryDatasetId || !availableDatasets.length}
            onClick={onStartMapping}
            className="inline-flex items-center justify-center border border-[#d94338] bg-[#d94338] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#c8382f] disabled:cursor-not-allowed disabled:border-[#e0b7b1] disabled:bg-[#f3c7c1] disabled:text-[#ffffff]"
          >
            {isZh ? "选择表并开始映射" : "Select table and start mapping"}
          </button>
        </div>
      </div>
    );
  }

  const getMappedIds = (propertyId) => {
    const value = fieldMappings[propertyId];
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return [value];
  };

  const isMapped = (propertyId, sourceFieldId) => getMappedIds(propertyId).includes(sourceFieldId);

  const connect = (sourceFieldId) => {
    if (!selectedPropertyId) return;
    const current = getMappedIds(selectedPropertyId);
    const next = current.includes(sourceFieldId)
      ? current.filter((id) => id !== sourceFieldId)
      : [...current, sourceFieldId];
    onMappingChange(selectedPropertyId, next);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-[#68717d]">{isZh ? "点击左侧对象属性，再点击右侧原始字段即可新增或移除映射关系，支持一对多。" : "Select an object property, then click source fields to add or remove mappings. One-to-many mappings are supported."}</p>
        <span className="text-xs text-[#858e99]">{isZh ? `已映射 ${Object.values(fieldMappings).flatMap((value) => Array.isArray(value) ? value : value ? [value] : []).filter(Boolean).length}/${properties.length}` : `${Object.values(fieldMappings).flatMap((value) => Array.isArray(value) ? value : value ? [value] : []).filter(Boolean).length}/${properties.length} mapped`}</span>
      </div>
      <div className="grid grid-cols-[minmax(260px,1fr)_180px_minmax(260px,1fr)] border border-[#dfe3e8] bg-white">
        <div className="border-r border-[#edf0f2]">
          <div className="h-11 border-b border-[#dfe3e8] bg-[#f5f6f8] px-4 py-3 text-xs font-semibold text-[#67717d]">{isZh ? "对象属性" : "Object properties"}</div>
          <div style={{ height: canvasHeight }}>
            {properties.map((property) => {
              const isSelected = selectedPropertyId === property.id;
              const mapped = getMappedIds(property.id).length > 0;
              return (
                <button key={property.id} type="button" onClick={() => setSelectedPropertyId(isSelected ? "" : property.id)} className={`flex h-14 w-full items-center justify-between border-b border-[#edf0f2] px-4 text-left transition ${isSelected ? "bg-[#fff1ef] ring-1 ring-inset ring-[#e3473c]" : "hover:bg-[#fafbfc]"}`}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[#303741]">{property.name || property.apiName}</span>
                    <span className="mt-0.5 block text-xs text-[#858e99]">{property.apiName} · {property.dataType}</span>
                  </span>
                  <span className={`ml-3 h-3 w-3 shrink-0 rounded-full border-2 ${mapped ? "border-[#e3473c] bg-[#e3473c]" : "border-[#aeb5bf] bg-white"}`} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="relative border-r border-[#edf0f2]">
          <div className="h-11 border-b border-[#dfe3e8] bg-[#f5f6f8] px-4 py-3 text-center text-xs font-semibold text-[#67717d]">{isZh ? "字段连线" : "Connections"}</div>
          <svg className="absolute left-0 right-0 top-11 w-full" style={{ height: canvasHeight }} viewBox={`0 0 180 ${canvasHeight}`} preserveAspectRatio="none" aria-label={isZh ? "字段映射连线" : "Field mapping connections"}>
            {properties.flatMap((property, propertyIndex) => {
              const mappedIds = getMappedIds(property.id);
              return mappedIds.map((mappedId, mappedIndex) => {
                const sourceIndex = sourceIndexById.get(mappedId);
                if (sourceIndex === undefined) return null;
                const startY = propertyIndex * rowHeight + rowHeight / 2;
                const endY = sourceIndex * rowHeight + rowHeight / 2;
                const offset = mappedIndex > 0 ? 8 * (mappedIndex % 2 === 0 ? 1 : -1) : 0;
                return <path key={`${property.id}-${mappedId}`} d={`M 0 ${startY + offset} C 65 ${startY + offset}, 115 ${endY + offset}, 180 ${endY + offset}`} fill="none" stroke={selectedPropertyId === property.id ? "#d94338" : "#8d99a6"} strokeWidth={selectedPropertyId === property.id ? "3" : "2"} />;
              });
            })}
          </svg>
          <div className="absolute inset-x-0 bottom-3 text-center text-[11px] text-[#9aa2ac]">{selectedPropertyId ? (isZh ? "请选择右侧字段来新增或移除映射" : "Select source fields to add or remove mappings") : (isZh ? "选择属性开始编辑" : "Select a property")}</div>
        </div>
        <div>
          <div className="h-11 border-b border-[#dfe3e8] bg-[#f5f6f8] px-4 py-3 text-xs font-semibold text-[#67717d]">{isZh ? "原始表字段" : "Source table fields"}</div>
          <div style={{ height: canvasHeight }}>
            {sourceFields.map((field) => {
              const isTarget = selectedPropertyId && isMapped(selectedPropertyId, field.id);
              return (
                <button key={field.id} type="button" onClick={() => connect(field.id)} disabled={!selectedPropertyId} className={`flex h-14 w-full items-center gap-3 border-b border-[#edf0f2] px-4 text-left transition disabled:cursor-default ${isTarget ? "bg-[#fff1ef]" : selectedPropertyId ? "hover:bg-[#f7f9fb]" : ""}`}>
                  <span className={`h-3 w-3 shrink-0 rounded-full border-2 ${isTarget ? "border-[#e3473c] bg-[#e3473c]" : "border-[#8d99a6] bg-white"}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[#303741]">{field.columnName}</span>
                    <span className="mt-0.5 block truncate text-xs text-[#858e99]">{field.datasetName} · {(field.sampleValues || []).slice(0, 2).join("、") || (isZh ? "暂无样例" : "No sample")}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {selectedPropertyId && getMappedIds(selectedPropertyId).length > 0 && (
        <button type="button" onClick={() => { onMappingChange(selectedPropertyId, []); setSelectedPropertyId(""); }} className="mt-3 text-sm font-medium text-[#c43d32] hover:text-[#a9322a]">{isZh ? "清空当前属性的所有映射" : "Clear all mappings for the selected property"}</button>
      )}
    </div>
  );
};

const ActionDefinitionsStep = ({
  isZh,
  objectName,
  actions,
  onChange,
  onAdd,
  onRemove,
}) => (
  <div className="max-w-[680px]">
    <p className="mb-4 text-sm leading-6 text-[#68717d]">
      {isZh
        ? `定义“${objectName || "当前对象"}”可以执行的业务动作，例如删除订单、取消订单或确认收货。动作由用户定义，也可在创建后继续维护。`
        : `Define business actions available on ${objectName || "this object"}, such as cancel order or confirm receipt.`}
    </p>
    <div className="space-y-3">
      {actions.map((action) => (
        <div
          key={action.id}
          className="rounded-sm border border-[#dfe3e8] bg-white p-4"
        >
          <div className="grid grid-cols-[1fr_1fr_36px] gap-3">
            <label>
              <span className="mb-1.5 block text-xs font-medium text-[#66707c]">
                {isZh ? "动作名称" : "Action name"}
              </span>
              <input
                value={action.name}
                onChange={(event) =>
                  onChange(action.id, "name", event.target.value)
                }
                placeholder={
                  isZh ? "例如：删除订单" : "For example: Delete order"
                }
                className="h-9 w-full border border-[#cfd5dc] px-3 text-sm"
              />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-medium text-[#66707c]">
                API Name
              </span>
              <input
                value={action.apiName}
                onChange={(event) =>
                  onChange(action.id, "apiName", event.target.value)
                }
                placeholder="deleteOrder"
                className="h-9 w-full border border-[#cfd5dc] px-3 font-mono text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => onRemove(action.id)}
              className="mt-[22px] flex h-9 items-center justify-center text-[#8a929d] hover:text-[#d94338]"
              aria-label={isZh ? "删除动作" : "Delete action"}
            >
              <DeleteIcon />
            </button>
          </div>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-xs font-medium text-[#66707c]">
              {isZh ? "动作说明" : "Description"}
            </span>
            <input
              value={action.description}
              onChange={(event) =>
                onChange(action.id, "description", event.target.value)
              }
              placeholder={
                isZh
                  ? "说明动作执行条件和结果"
                  : "Describe conditions and outcome"
              }
              className="h-9 w-full border border-[#cfd5dc] px-3 text-sm"
            />
          </label>
        </div>
      ))}
    </div>
    {actions.length === 0 && (
      <div className="border border-dashed border-[#cfd5dc] py-10 text-center text-sm text-[#858e99]">
        {isZh
          ? "尚未定义动作，可以跳过此步骤。"
          : "No actions defined. This step is optional."}
      </div>
    )}
    <button
      type="button"
      onClick={onAdd}
      className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#d94338] transition hover:text-[#bd342b]"
    >
      <PlusIcon />
      {isZh ? "添加动作" : "Add action"}
    </button>
  </div>
);

const CreateObjectTypeWizard = ({
  isOpen,
  isZh,
  objectTypes,
  onClose,
  onSubmit,
}) => {
  const [step, setStep] = useState(0);
  const [datasourceMode, setDatasourceMode] = useState("none");
  const [availableDatasets, setAvailableDatasets] = useState([]);
  const [primaryDatasetId, setPrimaryDatasetId] = useState("");
  const [supportingDatasetIds, setSupportingDatasetIds] = useState([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState("");
  const [schemaWarning, setSchemaWarning] = useState("");
  const [schemaSummary, setSchemaSummary] = useState(null);
  const [semanticCandidate, setSemanticCandidate] = useState(null);
  const [instanceHints, setInstanceHints] = useState([]);
  const [metadataMode, setMetadataMode] = useState("manual");
  const [semanticInput, setSemanticInput] = useState("");
  const [semanticInputStatus, setSemanticInputStatus] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [properties, setProperties] = useState([
    {
      id: "property-1",
      name: "",
      apiName: "property1",
      dataType: "文本",
      description: "",
      source: "input",
    },
  ]);
  const [primaryKeyId, setPrimaryKeyId] = useState("");
  const [titleKeyId, setTitleKeyId] = useState("");
  const [sourceFields, setSourceFields] = useState([]);
  const [fieldMappings, setFieldMappings] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setDatasourceMode("none");
    setPrimaryDatasetId("");
    setSupportingDatasetIds([]);
    setSchemaError("");
    setSchemaWarning("");
    setSchemaSummary(null);
    setSemanticCandidate(null);
    setInstanceHints([]);
    setMetadataMode("manual");
    setSemanticInput("");
    setSemanticInputStatus("");
    setName("");
    setDescription("");
    setProperties([
      {
        id: "property-1",
        name: "",
        apiName: "property1",
        dataType: "文本",
        description: "",
        source: "input",
      },
    ]);
    setPrimaryKeyId("");
    setTitleKeyId("");
    setSourceFields([]);
    setFieldMappings({});

    setDatasetsLoading(true);
    listLocalDatasets()
      .then(setAvailableDatasets)
      .catch(() => setAvailableDatasets([]))
      .finally(() => setDatasetsLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const steps = [
    isZh ? "数据源" : "Datasource",
    isZh ? "基本信息" : "Basic info",
    isZh ? "属性" : "Properties",
    isZh ? "字段映射" : "Field mapping",
  ];
  const validProperties = properties.filter((property) => property.name.trim());
  const selectedDatasets = availableDatasets.filter(
    (dataset) =>
      dataset.id === primaryDatasetId ||
      supportingDatasetIds.includes(dataset.id),
  );
  const canContinue = [
    datasourceMode === "none" || Boolean(primaryDatasetId),
    Boolean(name.trim()),
    Boolean(validProperties.length && primaryKeyId && titleKeyId),
    true,
  ][step];

  const updateProperty = (id, field, value) =>
    setProperties((current) =>
      current.map((property) =>
        property.id === id ? { ...property, [field]: value } : property,
      ),
    );
  const removeProperty = (id) => {
    setProperties((current) =>
      current.filter((property) => property.id !== id),
    );
    if (primaryKeyId === id) setPrimaryKeyId("");
    if (titleKeyId === id) setTitleKeyId("");
    setFieldMappings((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };
  const addProperty = () =>
    setProperties((current) => [
      ...current,
      {
        id: `property-${Date.now()}`,
        name: "",
        apiName: `property${current.length + 1}`,
        dataType: "文本",
        description: "",
        source: datasourceMode === "existing" ? "datasource" : "input",
      },
    ]);
  const updateFieldMapping = (propertyId, sourceFieldIds) => {
    setFieldMappings((current) => ({
      ...current,
      [propertyId]: Array.isArray(sourceFieldIds) ? sourceFieldIds : sourceFieldIds ? [sourceFieldIds] : [],
    }));
  };
  const toggleDatasetSelection = (id) => {
    const isPrimary = primaryDatasetId === id;
    const isSelected =
      isPrimary || supportingDatasetIds.includes(id);
    if (isSelected) {
      const remainingIds = supportingDatasetIds.filter(
        (datasetId) => datasetId !== id,
      );
      setSupportingDatasetIds(remainingIds);
      if (isPrimary) {
        const [nextPrimaryId = "", ...nextSelectedIds] = remainingIds;
        setPrimaryDatasetId(nextPrimaryId);
        setSupportingDatasetIds(nextSelectedIds);
      }
      return;
    }
    if (!primaryDatasetId) {
      setPrimaryDatasetId(id);
    } else {
      setSupportingDatasetIds((current) => [...current, id]);
    }
    setSchemaError("");
  };

  const selectPrimaryDataset = (id) => {
    if (primaryDatasetId === id) return;
    setSupportingDatasetIds((current) => [
      ...(primaryDatasetId ? [primaryDatasetId] : []),
      ...current.filter((datasetId) => datasetId !== id),
    ]);
    setPrimaryDatasetId(id);
    setSchemaError("");
  };

  const handleSemanticFileUpload = (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSemanticInput(String(reader.result || ""));
      setSemanticInputStatus("");
    };
    reader.onerror = () => {
      setSemanticInputStatus(
        isZh ? "文本文件读取失败，请重试。" : "Failed to read the text file. Please try again.",
      );
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleSemanticRecognition = async () => {
    if (!semanticInput.trim()) return;
    setSchemaLoading(true);
    setSchemaError("");
    setSemanticInputStatus("");
    try {
      const inferred = await analyzeSemanticText(semanticInput.trim());
      const nextProperties = (inferred.properties || [])
        .map((property, index) => ({
          id: `property-${index + 1}`,
          name: String(property.name || "").trim(),
          apiName: normalizeObjectPropertyApiName(
            property.apiName || property.name,
            `property${index + 1}`,
          ),
          dataType: ["文本", "数字", "日期", "布尔", "枚举"].includes(
            property.dataType,
          )
            ? property.dataType
            : "文本",
          description: String(
            property.description || property.evidence || "",
          ).trim(),
          evidence: String(property.evidence || "").trim(),
          source: "semantic",
          required: Boolean(property.required),
        }))
        .filter((property) => property.name);
      const titleProperty = nextProperties.find(
        (property) => property.name === inferred.titleProperty,
      );
      setName(String(inferred.objectType?.name || "").trim());
      setDescription(String(inferred.objectType?.description || "").trim());
      setProperties(nextProperties);
      setPrimaryKeyId("");
      setTitleKeyId(titleProperty?.id || "");
      setSemanticCandidate(inferred.objectType || null);
      setInstanceHints(Array.isArray(inferred.instanceHints) ? inferred.instanceHints : []);
      setSemanticInputStatus(
        isZh
          ? `已识别对象和 ${nextProperties.length} 个属性，请继续确认。`
          : `Identified an object and ${nextProperties.length} properties. Please review them.`,
      );
    } catch (error) {
      setSemanticInputStatus(
        error.message || (isZh ? "语义识别失败。" : "Semantic recognition failed."),
      );
    } finally {
      setSchemaLoading(false);
    }
  };

  const continueFromDatasource = async (targetStep = 1, forcedPrimaryDatasetId = primaryDatasetId) => {
    if (datasourceMode === "none") {
      setStep(targetStep);
      return;
    }

    const primaryDataset = availableDatasets.find(
      (dataset) => dataset.id === (forcedPrimaryDatasetId || primaryDatasetId),
    );
    if (!primaryDataset) return;

    setSchemaLoading(true);
    setSchemaError("");
    setSchemaWarning("");
    try {
      const isPdf = primaryDataset.extension?.toLowerCase() === "pdf";
      const inferred = isPdf
        ? await analyzePdfDataset(primaryDataset)
        : await analyzeTabularDataset(primaryDataset);
      const supportingDatasets = availableDatasets.filter((dataset) =>
        supportingDatasetIds.includes(dataset.id),
      );
      const supportingResults = await Promise.allSettled(
        supportingDatasets.map(async (dataset) => {
          const supportingIsPdf = dataset.extension?.toLowerCase() === "pdf";
          const supportingInferred = supportingIsPdf
            ? await analyzePdfDataset(dataset)
            : await inferDatasetSchema(dataset);
          return { dataset, inferred: supportingInferred };
        }),
      );
      const supportingSchemas = supportingResults
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);
      const skippedDatasets = supportingDatasets.filter(
        (_, index) => supportingResults[index].status === "rejected",
      );
      if (skippedDatasets.length > 0) {
        setSchemaWarning(
          isZh
            ? `以下所选数据源无法读取，已跳过：${skippedDatasets.map((dataset) => dataset.name).join("、")}`
            : `Unreadable selected datasets were skipped: ${skippedDatasets.map((dataset) => dataset.name).join(", ")}`,
        );
      }
      const mergedProperties = mergeDatasourceProperties(
        inferred.properties,
        supportingSchemas,
      );
      const inferredSourceFields = mergedProperties
        .filter((property) => property.source === "datasource" && property.columnName)
        .map((property) => ({
          id: `${property.datasetId}:${property.sheetName}:${property.columnName}`,
          datasetId: property.datasetId,
          datasetName: property.datasetName,
          sheetName: property.sheetName,
          columnName: property.columnName,
          sourceName: property.sourceName,
          sampleValues: property.sampleValues || [],
        }));
      const isBlankManualProperty = (property) =>
        property.source !== "datasource" &&
        !property.columnName &&
        !String(property.name || property.apiName || property.description || "").trim();
      const preservedUserProperties = properties
        .filter((property) =>
          (property.source !== "datasource" || !property.columnName) &&
          !isBlankManualProperty(property),
        )
        .map((property) => ({ ...property }));
      const nextProperties = preservedUserProperties.length > 0
        ? [...mergedProperties, ...preservedUserProperties]
        : mergedProperties;
      setName(inferred.semanticCandidate?.name || name.trim() || "");
      setDescription(inferred.semanticCandidate?.description || description.trim() || "");
      setProperties(nextProperties);
      setSourceFields(inferredSourceFields);
      setFieldMappings(Object.fromEntries(
        nextProperties.map((property) => {
          const matchedSourceField = inferredSourceFields.find((field) =>
            field.datasetId === property.datasetId &&
            field.sheetName === property.sheetName &&
            field.columnName === property.columnName,
          );
          return [property.id, matchedSourceField ? [matchedSourceField.id] : []];
        }),
      ));
      setPrimaryKeyId("");
      setTitleKeyId("");
      setSemanticCandidate(inferred.semanticCandidate || null);
      setInstanceHints(inferred.instanceHints || []);
      setSchemaSummary({
        sheetName: inferred.sheetName,
        rowCount: inferred.rowCount,
        propertyCount: nextProperties.length,
        detectedObjectCount: isPdf
          ? (inferred.instanceHints || []).length
          : inferred.rowCount,
      });
      setStep(targetStep);
    } catch (error) {
      setSchemaError(
        error.message ||
          (isZh ? "数据集解析失败" : "Failed to analyze dataset"),
      );
    } finally {
      setSchemaLoading(false);
    }
  };

  const handleCreate = () => {
    const timestamp = Date.now();
    const inferredApiName = name
      .trim()
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join("");
    const candidateApiName =
      inferredApiName && /^[A-Z]/.test(inferredApiName)
        ? inferredApiName
        : `ObjectType${timestamp}`;
    const apiName = objectTypes.some(
      (type) => type.apiName === candidateApiName,
    )
      ? `${candidateApiName}${timestamp}`
      : candidateApiName;
    const objectTypeId = `${apiName.toLowerCase()}-${timestamp}`;
    onSubmit({
      objectType: {
        id: objectTypeId,
        name: name.trim(),
        apiName,
        description: description.trim(),
        datasourceMode,
        datasourceName: selectedDatasets
          .map((dataset) => dataset.name)
          .join(", "),
        primaryDatasourceId: primaryDatasetId || null,
        detectedObjectCount:
          datasourceMode === "existing"
            ? schemaSummary?.detectedObjectCount || 0
            : 0,
        datasources: selectedDatasets.map(
          ({ id, name: datasetName, type, extension, size, createdAt }) => ({
            id,
            name: datasetName,
            type,
            extension,
            size,
            createdAt,
            role: id === primaryDatasetId ? "primary" : "supporting",
          }),
        ),
        actions: [],
      },
      properties: validProperties.map((property) => {
        const mappedSourceFields = (fieldMappings[property.id] || []).map((fieldId) =>
          sourceFields.find((field) => field.id === fieldId),
        ).filter(Boolean);
        return {
          ...property,
          ...(mappedSourceFields.length > 0 ? {
            source: "datasource",
            sourceName: mappedSourceFields[0].sourceName,
            datasetId: mappedSourceFields[0].datasetId,
            datasetName: mappedSourceFields[0].datasetName,
            sheetName: mappedSourceFields[0].sheetName,
            columnName: mappedSourceFields[0].columnName,
            sampleValues: mappedSourceFields[0].sampleValues,
            fieldMapping: mappedSourceFields.map((field) => ({
              datasetId: field.datasetId,
              sheetName: field.sheetName,
              columnName: field.columnName,
            })),
          } : {
            source: property.source === "datasource" ? "input" : property.source,
            fieldMapping: [],
          }),
          id: `${objectTypeId}-${property.apiName}`,
          objectTypeId,
          required: property.id === primaryKeyId,
          primaryKey: property.id === primaryKeyId,
          titleKey: property.id === titleKeyId,
        };
      }),
    });
  };

  return (
    <div
      className="fixed inset-y-0 left-[256px] right-0 z-[100] flex bg-[#f7f8fa]"
    >
      <div
        className="object-type-wizard flex min-w-0 flex-1 flex-col overflow-hidden"
      >
        <header className="shrink-0 border-b border-[#e4e7eb] bg-white px-8 pt-5">
          <div className="mx-auto max-w-[1280px]">
            <button
              type="button"
              onClick={onClose}
              className="mb-4 text-sm text-[#727a85] hover:text-[#e3473c]"
            >
              ← {isZh ? "返回对象类型" : "Back to object types"}
            </button>
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#fff0ed] text-[#d94a3e]">
                  <ObjectTypeIcon />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-semibold text-[#20242b]">
                    {name.trim() || (isZh ? "新建对象类型" : "New object type")}
                  </h1>
                  <code className="text-xs text-[#7c8490]">
                    {isZh ? "创建中" : "Creating"}
                  </code>
                </div>
              </div>
              <span className="rounded-full bg-[#fff0ed] px-3 py-1 text-xs font-medium text-[#d94338]">
                {isZh ? "新建" : "New"}
              </span>
            </div>
            <nav className="mt-6 flex gap-7 overflow-x-auto">
            {steps.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => index < step && setStep(index)}
                className={`flex shrink-0 items-center gap-2 border-b-2 pb-3 text-sm font-medium transition ${index === step ? "border-[#e3473c] text-[#d94338]" : index < step ? "border-transparent text-[#59616c] hover:text-[#d94338]" : "cursor-default border-transparent text-[#a0a7b1]"}`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${index === step ? "bg-[#e3473c] text-white" : index < step ? "bg-[#fff0ed] text-[#d94338]" : "bg-[#eef0f3] text-[#8c949f]"}`}
                >
                  {index + 1}
                </span>
                {label}
              </button>
            ))}
            </nav>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
              <div className="mx-auto max-w-[1280px]">
              <div className="mb-1 text-xs font-semibold text-[#7a8491]">
                {isZh ? `第 ${step + 1} 步` : `Step ${step + 1}`}
              </div>
              <h3 className="mb-6 text-xl font-semibold text-[#20242b]">
                {
                  [
                    isZh ? "选择对象类型的数据来源" : "Object type backing",
                    isZh
                      ? "配置对象类型元数据"
                      : "Configure object type metadata",
                    isZh
                      ? "创建属性并配置键"
                      : "Create properties and configure keys",
                    isZh ? "核对属性与原始字段映射" : "Review property-to-field mapping",
                  ][step]
                }
              </h3>
              {step === 0 && (
                <div>
                  <div className="mb-3 text-sm font-medium text-[#353c46]">
                    {isZh ? "数据源" : "Datasource"}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDatasourceMode("none")}
                      className={`flex min-h-[104px] items-start gap-4 border p-4 text-left ${datasourceMode === "none" ? "border-[#2f73d1] bg-[#f5f9ff] ring-1 ring-[#2f73d1]" : "border-[#dce0e5]"}`}
                    >
                      <DatabaseIcon />
                      <span>
                        <strong className="block text-sm text-[#313945]">
                          {isZh
                            ? "基于用户语义创建"
                            : "Continue without datasource"}
                        </strong>
                        <span className="mt-1 block text-xs leading-5 text-[#6f7884]">
                          {isZh
                            ? "先创建对象结构，后续再接入数据。"
                            : "Create the schema and connect data later."}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatasourceMode("existing")}
                      className={`flex min-h-[104px] items-start gap-4 border p-4 text-left ${datasourceMode === "existing" ? "border-[#2f73d1] bg-[#f5f9ff] ring-1 ring-[#2f73d1]" : "border-[#dce0e5]"}`}
                    >
                      <DatabaseIcon />
                      <span>
                        <strong className="block text-sm text-[#313945]">
                          {isZh ? "使用现有数据源" : "Use existing datasource"}
                        </strong>
                        <span className="mt-1 block text-xs leading-5 text-[#6f7884]">
                          {isZh
                            ? "可多选数据集，并指定其中一个作为主表。"
                            : "Select multiple datasets and designate one as the primary table."}
                        </span>
                      </span>
                    </button>
                  </div>
                  {datasourceMode === "existing" && (
                    <div className="mt-5 w-full">
                      <div className="mb-2 flex items-center justify-between text-sm font-medium text-[#353c46]">
                        <span>{isZh ? "选择数据集" : "Select datasets"} *</span>
                        <span className="text-xs font-normal text-[#7d8692]">
                          {isZh ? "主表" : "Primary table"}
                        </span>
                      </div>
                      <div className="max-h-[230px] overflow-y-auto border border-[#cfd5dc] bg-white">
                        {datasetsLoading ? (
                          <div className="px-4 py-8 text-center text-sm text-[#7b8490]">
                            {isZh ? "正在加载数据集..." : "Loading datasets..."}
                          </div>
                        ) : availableDatasets.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <div className="text-sm text-[#58616d]">
                              {isZh
                                ? "资源模块中暂无可用数据集"
                                : "No resource datasets available"}
                            </div>
                            <div className="mt-1 text-xs text-[#8a929d]">
                              {isZh
                                ? "请先前往“资源 > 数据集”导入 Excel、CSV 或文本型 PDF。"
                                : "Import Excel, CSV, or text-based PDF from Resources > Datasets first."}
                            </div>
                          </div>
                        ) : (
                          availableDatasets.map((dataset) => (
                            <div
                              key={dataset.id}
                              className="flex items-center border-b border-[#edf0f2] px-4 py-3 last:border-b-0 hover:bg-[#f7f9fb]"
                            >
                              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={
                                    primaryDatasetId === dataset.id ||
                                    supportingDatasetIds.includes(dataset.id)
                                  }
                                  onChange={() =>
                                    toggleDatasetSelection(dataset.id)
                                  }
                                  className="h-4 w-4 accent-[#2f73d1]"
                                />
                                <DatabaseIcon />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium text-[#303741]">
                                    {dataset.name}
                                  </span>
                                  <span className="mt-0.5 block text-xs text-[#818a96]">
                                    {(
                                      dataset.extension || "FILE"
                                    ).toUpperCase()}{" "}
                                    ·{" "}
                                    {dataset.size < 1024
                                      ? `${dataset.size} B`
                                      : `${(dataset.size / 1024).toFixed(1)} KB`}
                                  </span>
                                </span>
                              </label>
                              <label className="ml-4 flex cursor-pointer items-center gap-2 text-xs text-[#65707d]">
                                <input
                                  type="radio"
                                  name="primary-dataset"
                                  disabled={
                                    primaryDatasetId !== dataset.id &&
                                    !supportingDatasetIds.includes(dataset.id)
                                  }
                                  checked={primaryDatasetId === dataset.id}
                                  onChange={() =>
                                    selectPrimaryDataset(dataset.id)
                                  }
                                  className="h-4 w-4 accent-[#2f73d1]"
                                />
                                {isZh ? "主表" : "Primary"}
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="mt-2 text-xs text-[#818a96]">
                        {isZh
                          ? `已选择 ${selectedDatasets.length} 个数据集；属性将从全部已选数据集自动抽取。`
                          : `${selectedDatasets.length} datasets selected; properties are inferred from all selected datasets.`}
                      </div>
                      {schemaError && (
                        <div className="mt-3 border border-[#f0c2bd] bg-[#fff5f3] px-3 py-2 text-sm text-[#c43d32]">
                          {schemaError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {step === 1 && (
                <div className="max-w-[680px] space-y-5">
                  {schemaWarning && (
                    <div className="border border-[#ead9a8] bg-[#fffbea] px-3 py-2 text-sm text-[#866a17]">
                      {schemaWarning}
                    </div>
                  )}
                  <div>
                    <div className="mb-2 text-sm font-medium text-[#353c46]">
                      {isZh ? "配置方式" : "Configuration method"}
                    </div>
                    <div className="flex border-b border-[#dfe3e8]">
                      <button
                        type="button"
                        onClick={() => setMetadataMode("semantic")}
                        className={`border-b-2 px-1 pb-2 text-sm font-medium ${metadataMode === "semantic" ? "border-[#e3473c] text-[#d94338]" : "border-transparent text-[#7b8490]"}`}
                      >
                        {isZh ? "基于用户语义创建" : "Create from user semantics"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMetadataMode("manual")}
                        className={`ml-6 border-b-2 px-1 pb-2 text-sm font-medium ${metadataMode === "manual" ? "border-[#e3473c] text-[#d94338]" : "border-transparent text-[#7b8490]"}`}
                      >
                        {isZh ? "手动配置" : "Manual configuration"}
                      </button>
                    </div>
                  </div>
                  {metadataMode === "semantic" && (
                    <div className="border border-[#ead0cc] bg-[#fff8f6] p-4">
                      <div className="text-sm font-medium text-[#343a43]">
                        {isZh ? "输入业务描述" : "Enter a business description"}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#7b8490]">
                        {isZh
                          ? "上传或粘贴一段业务描述，后续将自动识别对象实体和属性。"
                          : "Upload or paste a business description to identify entities and properties automatically."}
                      </p>
                      <textarea
                        value={semanticInput}
                        onChange={(event) => {
                          setSemanticInput(event.target.value);
                          setSemanticInputStatus("");
                        }}
                        rows={6}
                        placeholder={
                          isZh
                            ? "例如：订单包含订单编号、客户名称、下单时间和订单金额。"
                            : "For example: An order includes an order number, customer name, order time, and amount."
                        }
                        className="mt-3 w-full resize-none rounded-sm border border-[#cfd5dc] bg-white px-3 py-2 text-sm"
                      />
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <label className="cursor-pointer text-sm font-medium text-[#d94338] hover:text-[#bd342b]">
                          <input
                            type="file"
                            accept=".txt,.md,text/plain,text/markdown"
                            onChange={handleSemanticFileUpload}
                            className="sr-only"
                          />
                          {isZh ? "上传文本文件" : "Upload text file"}
                        </label>
                        <button
                          type="button"
                          onClick={handleSemanticRecognition}
                          disabled={!semanticInput.trim()}
                          className="h-9 bg-[#e3473c] px-4 text-sm font-medium text-white transition hover:bg-[#cf3d33] disabled:cursor-not-allowed disabled:bg-[#e7a6a0]"
                        >
                          {isZh ? "开始识别" : "Start recognition"}
                        </button>
                      </div>
                      {semanticInputStatus && (
                        <div className="mt-3 text-xs text-[#866a17]">
                          {semanticInputStatus}
                        </div>
                      )}
                    </div>
                  )}
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium">
                      {isZh ? "显示名称" : "Display name"} *
                    </span>
                    <input
                      autoFocus
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={isZh ? "例如：订单" : "For example: Order"}
                      className="h-10 w-full rounded-sm border border-[#cfd5dc] px-3 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium">
                      {isZh ? "描述" : "Description"}
                    </span>
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={4}
                      placeholder={
                        isZh
                          ? "说明该对象代表的业务实体或事件"
                          : "Describe the business entity or event"
                      }
                      className="w-full resize-none rounded-sm border border-[#cfd5dc] px-3 py-2 text-sm"
                    />
                  </label>
                  {semanticCandidate && (
                    <div className="border border-[#ead0cc] bg-[#fff8f6] px-4 py-3 text-sm text-[#5f4743]">
                      <div className="font-medium text-[#c53f35]">
                        {isZh
                          ? "文档语义候选，请确认"
                          : "Semantic candidate, please confirm"}
                      </div>
                      <div className="mt-1">
                        {isZh
                          ? `建议对象类型：${semanticCandidate.name || "待确认对象"}`
                          : `Suggested object type: ${semanticCandidate.name || "To be confirmed"}`}
                      </div>
                      {instanceHints.length > 0 && (
                        <div className="mt-1">
                          {isZh
                            ? `识别到的实例/属性值：${instanceHints
                                .map((hint) => hint.value)
                                .filter(Boolean)
                                .join("、")}`
                            : `Detected instances/values: ${instanceHints
                                .map((hint) => hint.value)
                                .filter(Boolean)
                                .join(", ")}`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {step === 2 && (
                <PropertyMappingStep
                  isZh={isZh}
                  datasourceMode={datasourceMode}
                  properties={properties}
                  validProperties={validProperties}
                  primaryKeyId={primaryKeyId}
                  titleKeyId={titleKeyId}
                  onPrimaryKeyChange={setPrimaryKeyId}
                  onTitleKeyChange={setTitleKeyId}
                  onPropertyChange={updateProperty}
                  onAdd={addProperty}
                  onRemove={removeProperty}
                />
              )}
              {step === 3 && (
                <FieldMappingStep
                  isZh={isZh}
                  datasourceMode={datasourceMode}
                  properties={validProperties}
                  sourceFields={sourceFields}
                  fieldMappings={fieldMappings}
                  onMappingChange={updateFieldMapping}
                  availableDatasets={availableDatasets}
                  primaryDatasetId={primaryDatasetId}
                  onSelectPrimaryDataset={async (datasetId) => {
                    setDatasourceMode("existing");
                    setPrimaryDatasetId(datasetId);
                    const nextSupportingIds = supportingDatasetIds.filter((id) => id !== datasetId);
                    setSupportingDatasetIds(nextSupportingIds);
                    await continueFromDatasource(3, datasetId);
                  }}
                  onStartMapping={async () => {
                    if (!primaryDatasetId) return;
                    setDatasourceMode("existing");
                    await continueFromDatasource(3);
                  }}
                />
              )}
              </div>
            </div>
            <div className="flex h-16 shrink-0 items-center justify-end gap-3 border-t border-[#e5e8ec] bg-white px-8">
              <div className="flex w-full max-w-[1280px] items-center justify-between">
              <span className="text-xs text-[#858d98]">
                {isZh ? "对象类型在创建前不会写入对象列表。" : "The object type is not saved until creation."}
              </span>
              <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={schemaLoading}
                onClick={() =>
                  step === 0 ? onClose() : setStep((current) => current - 1)
                }
                className="h-9 border border-[#cfd5dc] bg-white px-4 text-sm font-medium text-[#4c5561] transition hover:border-[#bfc5cc] hover:bg-[#f7f8fa] disabled:opacity-50"
              >
                {step === 0
                  ? isZh
                    ? "取消"
                    : "Cancel"
                  : isZh
                    ? "上一步"
                    : "Back"}
              </button>
              <button
                type="button"
                disabled={!canContinue || schemaLoading}
                onClick={() =>
                  step === 0
                    ? continueFromDatasource()
                    : step === steps.length - 1
                      ? handleCreate()
                      : setStep((current) => current + 1)
                }
                className="h-9 bg-[#e3473c] px-4 text-sm font-medium text-white transition hover:bg-[#cf3d33] focus:outline-none focus:ring-3 focus:ring-[#ffd8d3] disabled:cursor-not-allowed disabled:bg-[#e7a6a0]"
              >
                {schemaLoading
                  ? isZh
                    ? "正在分析..."
                    : "Analyzing..."
                  : step === steps.length - 1
                    ? isZh
                      ? "创建并生成实例化数据"
                      : "Create and Generate Instances"
                    : isZh
                      ? "下一步"
                      : "Next"}
              </button>
                </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const ObjectTypeModal = ({ isOpen, isZh, objectType, onClose, onSubmit }) => {
  const [name, setName] = useState("");
  const [apiName, setApiName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setName(objectType?.name || "");
    setApiName(objectType?.apiName || "");
    setDescription(objectType?.description || "");
  }, [isOpen, objectType]);

  if (!isOpen) return null;

  const isEditing = Boolean(objectType);

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalizedName = name.trim();
    const normalizedApiName = apiName.trim();
    if (!normalizedName || !normalizedApiName) return;

    onSubmit({
      name: normalizedName,
      apiName: normalizedApiName,
      description: description.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#17191f]/35 px-4"
      onMouseDown={onClose}
    >
      <form
        className="w-full max-w-[520px] rounded-lg border border-[#e2e5e9] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)]"
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#eceef1] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#20242b]">
            {isEditing
              ? isZh
                ? "编辑对象类型"
                : "Edit Object Type"
              : isZh
                ? "新建对象类型"
                : "Create Object Type"}
          </h2>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center text-xl text-[#7b828c] hover:text-[#252a32]"
            onClick={onClose}
            aria-label={isZh ? "关闭" : "Close"}
          >
            ×
          </button>
        </div>
        <div className="space-y-5 px-6 py-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#343a43]">
              {isZh ? "对象名称" : "Object name"}{" "}
              <span className="text-[#e3473c]">*</span>
            </span>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={isZh ? "例如：客户" : "For example: Customer"}
              className="h-10 w-full rounded-md border border-[#d9dde3] px-3 text-sm outline-none transition focus:border-[#e3473c] focus:ring-2 focus:ring-[#e3473c]/10"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#343a43]">
              API Name <span className="text-[#e3473c]">*</span>
            </span>
            <input
              value={apiName}
              onChange={(event) => setApiName(event.target.value)}
              placeholder="Customer"
              className="h-10 w-full rounded-md border border-[#d9dde3] px-3 font-mono text-sm outline-none transition focus:border-[#e3473c] focus:ring-2 focus:ring-[#e3473c]/10"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#343a43]">
              {isZh ? "描述" : "Description"}
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder={
                isZh
                  ? "说明该对象代表的业务实体或事件"
                  : "Describe the business entity or event"
              }
              className="w-full resize-none rounded-md border border-[#d9dde3] px-3 py-2 text-sm outline-none transition focus:border-[#e3473c] focus:ring-2 focus:ring-[#e3473c]/10"
            />
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t border-[#eceef1] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-[#d9dde3] px-4 text-sm font-medium text-[#4d545e] hover:bg-[#f7f8fa]"
          >
            {isZh ? "取消" : "Cancel"}
          </button>
          <button
            type="submit"
            disabled={!name.trim() || !apiName.trim()}
            className="h-9 rounded-md bg-[#e3473c] px-4 text-sm font-medium text-white transition hover:bg-[#cf3e34] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isEditing ? (isZh ? "保存" : "Save") : isZh ? "创建" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
};

const DeleteObjectTypeModal = ({ objectType, isZh, onClose, onConfirm }) => {
  if (!objectType) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#17191f]/35 px-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-[430px] rounded-lg border border-[#e2e5e9] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="px-6 pb-4 pt-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff0ed] text-[#d94a3e]">
            <DeleteIcon />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-[#20242b]">
            {isZh ? "删除对象类型" : "Delete Object Type"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6f7782]">
            {isZh
              ? `确定删除“${objectType.name}”吗？此操作无法撤销。`
              : `Delete “${objectType.name}”? This action cannot be undone.`}
          </p>
        </div>
        <div className="flex justify-end gap-3 border-t border-[#eceef1] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-[#d9dde3] px-4 text-sm font-medium text-[#4d545e] hover:bg-[#f7f8fa]"
          >
            {isZh ? "取消" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-9 rounded-md bg-[#d94338] px-4 text-sm font-medium text-white hover:bg-[#c6382e]"
          >
            {isZh ? "删除" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ObjectTypesPage = ({
  isZh,
  objectTypes,
  setObjectTypes,
  properties,
  setProperties,
  links,
  setLinks,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingObjectType, setDeletingObjectType] = useState(null);

  useEffect(() => {
    const datasourceTypes = objectTypes.filter((objectType) => objectType.primaryDatasourceId);
    if (!datasourceTypes.length) return undefined;

    let cancelled = false;
    const backfillObjectCounts = async () => {
      const datasets = await listLocalDatasets();
      const datasetsById = new Map(datasets.map((dataset) => [dataset.id, dataset]));
      const counts = await Promise.all(
        datasourceTypes.map(async (objectType) => {
          const dataset = datasetsById.get(objectType.primaryDatasourceId);
          if (!dataset) return [objectType.id, 0];
          if (dataset.extension?.toLowerCase() === "pdf") {
            return [objectType.id, 0];
          }
          const inferred = await inferDatasetSchema(dataset);
          return [objectType.id, inferred.rowCount];
        }),
      );
      if (cancelled) return;
      const countByTypeId = new Map(counts);
      setObjectTypes((current) => {
        let changed = false;
        const next = current.map((objectType) => {
          if (!countByTypeId.has(objectType.id)) return objectType;
          const nextCount = countByTypeId.get(objectType.id);
          if (objectType.detectedObjectCount === nextCount) return objectType;
          changed = true;
          return { ...objectType, detectedObjectCount: nextCount };
        });
        return changed ? next : current;
      });
    };
    backfillObjectCounts().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [objectTypes, setObjectTypes]);

  const filteredObjectTypes = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return objectTypes;
    return objectTypes.filter((objectType) =>
      `${objectType.name} ${objectType.apiName}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [objectTypes, searchQuery]);

  const handleCreate = ({ objectType, properties: newProperties }) => {
    setObjectTypes((current) => [
      { ...objectType, status: "draft", updatedAt: isZh ? "刚刚" : "Just now" },
      ...current,
    ]);
    setProperties((current) => [...current, ...newProperties]);
    setIsCreateOpen(false);
  };

  const handleDelete = () => {
    setObjectTypes((current) =>
      current.filter((objectType) => objectType.id !== deletingObjectType.id),
    );
    setProperties((current) =>
      current.filter(
        (property) => property.objectTypeId !== deletingObjectType.id,
      ),
    );
    setLinks((current) =>
      current.filter(
        (link) =>
          link.sourceObjectTypeId !== deletingObjectType.id &&
          link.targetObjectTypeId !== deletingObjectType.id,
      ),
    );
    setDeletingObjectType(null);
  };

  const getPropertyCount = (objectTypeId) =>
    properties.filter((property) => property.objectTypeId === objectTypeId)
      .length;
  const getLinkCount = (objectTypeId) =>
    links.filter(
      (link) =>
        link.sourceObjectTypeId === objectTypeId ||
        link.targetObjectTypeId === objectTypeId,
    ).length;

  return (
    <>
      <main className="min-w-0 flex-1 overflow-y-auto bg-[#f7f8fa]">
        <header className="border-b border-[#e4e7eb] bg-white px-8 py-6">
          <div className="mx-auto flex max-w-[1280px] items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl font-semibold text-[#20242b]">
                {isZh ? "对象类型" : "Object Types"}
              </h1>
              <p className="mt-1.5 text-sm text-[#717985]">
                {isZh
                  ? "定义企业中的业务对象及其基本结构。"
                  : "Define business objects and their basic structure."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-md border border-[#cfd5dc] bg-white px-4 text-sm font-medium text-[#4c5561] shadow-sm"
              >
                {isZh ? "导入" : "Import"}
              </button>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#e3473c] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#cf3e34]"
              >
                <PlusIcon />
                {isZh ? "新建对象类型" : "Create Object Type"}
              </button>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-[1280px] px-8 py-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <label className="relative block w-full max-w-[420px]">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#8a919b]">
                <SearchIcon />
              </span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={
                  isZh ? "搜索对象名称或 API 名称" : "Search name or API name"
                }
                className="h-10 w-full rounded-md border border-[#d9dde3] bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-[#9ba2ac] focus:border-[#e3473c] focus:ring-2 focus:ring-[#e3473c]/10"
              />
            </label>
            <span className="whitespace-nowrap text-sm text-[#777f8a]">
              {isZh
                ? `共 ${filteredObjectTypes.length} 个对象类型`
                : `${filteredObjectTypes.length} object types`}
            </span>
          </div>

          <div className="overflow-hidden rounded-md border border-[#e0e3e7] bg-white">
            <div className="grid min-w-[940px] grid-cols-[minmax(220px,1.7fr)_minmax(150px,1fr)_80px_90px_80px_105px_110px_90px] border-b border-[#e6e8eb] bg-[#f6f7f8] px-5 py-3 text-xs font-semibold text-[#6e7681]">
              <span>{isZh ? "对象类型" : "Object type"}</span>
              <span>API Name</span>
              <span>{isZh ? "属性" : "Properties"}</span>
              <span>{isZh ? "对象数量" : "Objects"}</span>
              <span>{isZh ? "关系" : "Links"}</span>
              <span>{isZh ? "状态" : "Status"}</span>
              <span>{isZh ? "更新时间" : "Updated"}</span>
              <span className="text-right">{isZh ? "操作" : "Actions"}</span>
            </div>
            <div className="min-w-[940px] divide-y divide-[#eceef1]">
              {filteredObjectTypes.map((objectType) => (
                <div
                  key={objectType.id}
                  onClick={() =>
                    navigate(`/object-management/object-types/${objectType.id}`)
                  }
                  className="grid cursor-pointer grid-cols-[minmax(220px,1.7fr)_minmax(150px,1fr)_80px_90px_80px_105px_110px_90px] items-center px-5 py-4 text-sm transition hover:bg-[#fafafa]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#fff0ed] text-[#d94a3e]">
                      <ObjectTypeIcon />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[#252a32]">
                        {objectType.name}
                      </div>
                      {objectType.description && (
                        <div className="mt-0.5 truncate text-xs text-[#8a919b]">
                          {objectType.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <code className="truncate text-xs text-[#515966]">
                    {objectType.apiName}
                  </code>
                  <span className="text-[#59616c]">
                    {getPropertyCount(objectType.id)}
                  </span>
                  <span className="text-[#59616c]">
                    {objectType.detectedObjectCount || 0}
                  </span>
                  <span className="text-[#59616c]">
                    {getLinkCount(objectType.id)}
                  </span>
                  <span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${objectType.status === "published" ? "bg-[#eaf7ef] text-[#2f7a4b]" : "bg-[#f1f2f4] text-[#666e78]"}`}
                    >
                      {objectType.status === "published"
                        ? isZh
                          ? "已发布"
                          : "Published"
                        : isZh
                          ? "草稿"
                          : "Draft"}
                    </span>
                  </span>
                  <span className="text-[#777f8a]">{objectType.updatedAt}</span>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/object-management/object-types/${objectType.id}?edit=basic`);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[#707884] transition hover:bg-[#eef0f3] hover:text-[#252a32]"
                      title={isZh ? "编辑" : "Edit"}
                      aria-label={
                        isZh
                          ? `编辑${objectType.name}`
                          : `Edit ${objectType.name}`
                      }
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeletingObjectType(objectType);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[#8a919b] transition hover:bg-[#fff0ed] hover:text-[#d94338]"
                      title={isZh ? "删除" : "Delete"}
                      aria-label={
                        isZh
                          ? `删除${objectType.name}`
                          : `Delete ${objectType.name}`
                      }
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </div>
              ))}
              {filteredObjectTypes.length === 0 && (
                <div className="px-6 py-16 text-center text-sm text-[#858d98]">
                  {isZh ? "没有找到匹配的对象类型" : "No matching object types"}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <CreateObjectTypeWizard
        isOpen={isCreateOpen}
        isZh={isZh}
        objectTypes={objectTypes}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />
      <DeleteObjectTypeModal
        objectType={deletingObjectType}
        isZh={isZh}
        onClose={() => setDeletingObjectType(null)}
        onConfirm={handleDelete}
      />
    </>
  );
};

const ResourceModal = ({
  mode,
  item,
  objectType,
  objectTypes,
  isZh,
  onClose,
  onSubmit,
}) => {
  const isProperty = mode === "property";
  const isEditing = Boolean(item);
  const [name, setName] = useState(item?.name || "");
  const [apiName, setApiName] = useState(item?.apiName || "");
  const [dataType, setDataType] = useState(item?.dataType || "文本");
  const [description, setDescription] = useState(item?.description || "");
  const [targetObjectTypeId, setTargetObjectTypeId] = useState(
    item?.targetObjectTypeId ||
      objectTypes.find((type) => type.id !== objectType.id)?.id ||
      "",
  );
  const [cardinality, setCardinality] = useState(item?.cardinality || "多对一");
  const canSubmit = Boolean(
    name.trim() &&
      (isProperty || (apiName.trim() && targetObjectTypeId)),
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!name.trim() || (!isProperty && (!apiName.trim() || !targetObjectTypeId)))
      return;
    const propertyApiName =
      apiName.trim() || normalizeObjectPropertyApiName(name, `property${Date.now()}`);
    onSubmit(
      isProperty
        ? {
            name: name.trim(),
            apiName: propertyApiName,
            dataType,
            description: description.trim(),
            required: item?.required || false,
          }
        : {
            name: name.trim(),
            apiName: apiName.trim(),
            targetObjectTypeId,
            cardinality,
          },
    );
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#17191f]/30 px-4 py-8 backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <form
        className="w-full max-w-[540px] overflow-hidden rounded-lg border border-[#e7e9ed] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#eceef1] bg-[linear-gradient(180deg,#ffffff_0%,#fffafa_100%)] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#fff0ed] text-[#d94338]">
              {isProperty ? <EditIcon /> : <ObjectTypeIcon />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#20242b]">
                {isProperty
                  ? isEditing
                    ? isZh
                      ? "编辑属性"
                      : "Edit property"
                    : isZh
                      ? "新增属性"
                      : "Add property"
                  : isEditing
                    ? isZh
                      ? "编辑关系"
                      : "Edit link"
                    : isZh
                      ? "新增关系"
                      : "Add link"}
              </h2>
              <p className="mt-1 text-xs text-[#858d98]">
                {isProperty
                  ? isZh
                    ? "配置属性名称、类型与说明"
                    : "Configure the property name, type, and description"
                  : isZh
                    ? "配置对象之间的关联方式"
                    : "Configure how object types are connected"}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-xl leading-none text-[#7b828c] transition hover:border-[#f1d5d1] hover:bg-[#fff4f2] hover:text-[#d94338]"
            onClick={onClose}
            aria-label={isZh ? "关闭" : "Close"}
          >
            ×
          </button>
        </div>
        <div className="space-y-5 px-6 py-6">
          {isProperty ? (
            <>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#343a43]">
                  {isZh ? "类型" : "Type"}
                </span>
                <select
                  value={dataType}
                  onChange={(event) => setDataType(event.target.value)}
                  className="h-11 w-full rounded-md border border-[#d9dde3] bg-white px-3.5 text-sm text-[#252a32] outline-none transition focus:border-[#e3473c] focus:ring-3 focus:ring-[#fff0ed]"
                >
                  <option value="文本">string</option>
                  <option value="数字">number</option>
                  <option value="日期">date</option>
                  <option value="布尔">boolean</option>
                  <option value="枚举">enum</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#343a43]">
                  {isZh ? "属性名称" : "Property name"}{" "}
                  <span className="text-[#d94338]">*</span>
                </span>
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={isZh ? "属性名称" : "Property name"}
                  className="h-11 w-full rounded-md border border-[#d9dde3] bg-white px-3.5 text-sm text-[#252a32] outline-none transition placeholder:text-[#a5abb3] focus:border-[#e3473c] focus:ring-3 focus:ring-[#fff0ed]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#343a43]">
                  {isZh ? "说明" : "Description"}
                </span>
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={isZh ? "属性说明" : "Property description"}
                  className="h-11 w-full rounded-md border border-[#d9dde3] bg-white px-3.5 text-sm text-[#252a32] outline-none transition placeholder:text-[#a5abb3] focus:border-[#e3473c] focus:ring-3 focus:ring-[#fff0ed]"
                />
              </label>
            </>
          ) : (
            <>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#343a43]">
              {isProperty
                ? isZh
                  ? "字段名称"
                  : "Field name"
                : isZh
                  ? "关系名称"
                  : "Link name"}{" "}
              <span className="text-[#d94338]">*</span>
            </span>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={
                isProperty
                  ? isZh
                    ? "例如：客户名称"
                    : "For example: Customer name"
                  : isZh
                    ? "例如：所属门店"
                    : "For example: Belongs to store"
              }
              className="h-11 w-full rounded-md border border-[#d9dde3] bg-white px-3.5 text-sm text-[#252a32] outline-none transition placeholder:text-[#a5abb3] focus:border-[#e3473c] focus:ring-3 focus:ring-[#fff0ed]"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#343a43]">
              API Name <span className="text-[#d94338]">*</span>
            </span>
            <input
              value={apiName}
              onChange={(event) => setApiName(event.target.value)}
              placeholder={isProperty ? "customerName" : "belongsToStore"}
              className="h-11 w-full rounded-md border border-[#d9dde3] bg-white px-3.5 font-mono text-sm text-[#252a32] outline-none transition placeholder:text-[#a5abb3] focus:border-[#e3473c] focus:ring-3 focus:ring-[#fff0ed]"
            />
          </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#343a43]">
                  {isZh ? "目标对象" : "Target object"}
                </span>
                <select
                  value={targetObjectTypeId}
                  onChange={(event) =>
                    setTargetObjectTypeId(event.target.value)
                  }
                  className="h-11 w-full rounded-md border border-[#d9dde3] bg-white px-3.5 text-sm text-[#252a32] outline-none transition focus:border-[#e3473c] focus:ring-3 focus:ring-[#fff0ed]"
                >
                  {objectTypes
                    .filter((type) => type.id !== objectType.id)
                    .map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#343a43]">
                  {isZh ? "关系基数" : "Cardinality"}
                </span>
                <select
                  value={cardinality}
                  onChange={(event) => setCardinality(event.target.value)}
                  className="h-11 w-full rounded-md border border-[#d9dde3] bg-white px-3.5 text-sm text-[#252a32] outline-none transition focus:border-[#e3473c] focus:ring-3 focus:ring-[#fff0ed]"
                >
                  <option>一对一</option>
                  <option>一对多</option>
                  <option>多对一</option>
                  <option>多对多</option>
                </select>
              </label>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-[#eceef1] bg-[#fcfcfd] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-md border border-[#d9dde3] bg-white px-5 text-sm font-medium text-[#4d545e] transition hover:border-[#c6cbd2] hover:bg-[#f7f8fa]"
          >
            {isZh ? "取消" : "Cancel"}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="h-10 rounded-md bg-[#e3473c] px-5 text-sm font-medium text-white shadow-sm transition hover:bg-[#cf3d33] focus:outline-none focus:ring-3 focus:ring-[#ffd8d3] disabled:cursor-not-allowed disabled:bg-[#e7a6a0] disabled:shadow-none"
          >
            {isEditing
              ? isZh
                ? "保存修改"
                : "Save changes"
              : isZh
                ? "确认新增"
                : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
};

const cardinalityLabel = (source, target) =>
  `${source === "one" ? "一" : "多"}对${target === "one" ? "一" : "多"}`;
const LinkTypeModal = ({
  item,
  objectType,
  objectTypes,
  properties,
  links,
  isZh,
  onClose,
  onSubmit,
}) => {
  const targetOptions = objectTypes.filter((type) => type.id !== objectType.id);
  const [linkTypeName, setLinkTypeName] = useState(item?.name || "");
  const [targetObjectTypeId, setTargetObjectTypeId] = useState(
    item?.targetObjectTypeId || targetOptions[0]?.id || "",
  );
  const [sourceCardinality, setSourceCardinality] = useState(
    item?.sourceCardinality ||
      (item?.cardinality?.startsWith("一") ? "one" : "many"),
  );
  const [targetCardinality, setTargetCardinality] = useState(
    item?.targetCardinality ||
      (item?.cardinality?.endsWith("一") ? "one" : "many"),
  );
  const targetObject = objectTypes.find(
    (type) => type.id === targetObjectTypeId,
  );
  const sourceProperties = properties.filter(
    (property) => property.objectTypeId === objectType.id,
  );
  const targetPrimaryKeys = properties.filter(
    (property) =>
      property.objectTypeId === targetObjectTypeId && property.primaryKey,
  );
  const [foreignKeyPropertyId, setForeignKeyPropertyId] = useState(
    item?.mapping?.foreignKeyPropertyId || sourceProperties[0]?.id || "",
  );
  const [primaryKeyPropertyId, setPrimaryKeyPropertyId] = useState(
    item?.mapping?.primaryKeyPropertyId || targetPrimaryKeys[0]?.id || "",
  );
  const [status, setStatus] = useState(item?.status || "experimental");
  const foreignKey = properties.find(
    (property) => property.id === foreignKeyPropertyId,
  );
  const primaryKey = properties.find(
    (property) => property.id === primaryKeyPropertyId,
  );
  const typeMismatch = Boolean(
    foreignKey && primaryKey && foreignKey.dataType !== primaryKey.dataType,
  );
  const canSubmit = Boolean(
    linkTypeName.trim() &&
      targetObjectTypeId &&
      foreignKeyPropertyId &&
      primaryKeyPropertyId,
  );

  useEffect(() => {
    const nextTarget = objectTypes.find(
      (type) => type.id === targetObjectTypeId,
    );
    const nextPrimaryKey = properties.find(
      (property) =>
        property.objectTypeId === targetObjectTypeId && property.primaryKey,
    );
    if (!item || targetObjectTypeId !== item.targetObjectTypeId) {
      setPrimaryKeyPropertyId(nextPrimaryKey?.id || "");
    }
  }, [targetObjectTypeId]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      name: linkTypeName.trim(),
      apiName:
        item?.apiName ||
        `${objectType.apiName.charAt(0).toLowerCase()}${objectType.apiName.slice(1)}${targetObject?.apiName || ""}`,
      targetObjectTypeId,
      sourceCardinality,
      targetCardinality,
      cardinality: cardinalityLabel(sourceCardinality, targetCardinality),
      sourceSide: {
        displayName: item?.sourceSide?.displayName || objectType.name,
        pluralDisplayName:
          item?.sourceSide?.pluralDisplayName || objectType.name,
        apiName:
          item?.sourceSide?.apiName ||
          `${objectType.apiName.charAt(0).toLowerCase()}${objectType.apiName.slice(1)}s`,
        visibility: "normal",
      },
      targetSide: {
        displayName: item?.targetSide?.displayName || targetObject?.name || "",
        pluralDisplayName:
          item?.targetSide?.pluralDisplayName || targetObject?.name || "",
        apiName:
          item?.targetSide?.apiName ||
          (targetObject
            ? `${targetObject.apiName.charAt(0).toLowerCase()}${targetObject.apiName.slice(1)}`
            : ""),
        visibility: "normal",
      },
      mapping: {
        type: "foreignKey",
        foreignKeyObjectTypeId: objectType.id,
        foreignKeyPropertyId,
        primaryKeyObjectTypeId: targetObjectTypeId,
        primaryKeyPropertyId,
      },
      status,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#17191f]/30 px-4 py-8 backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <form
        className="max-h-[90vh] w-full max-w-[760px] overflow-y-auto rounded-lg border border-[#e7e9ed] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#eceef1] px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold">
              {item
                ? isZh
                  ? "编辑关系类型"
                  : "Edit link type"
                : isZh
                  ? "新建关系类型"
                  : "Create link type"}
            </h2>
            <p className="mt-1 text-xs text-[#858d98]">
              {isZh
                ? "配置两端对象、基数和键映射"
                : "Configure objects, cardinality, and key mapping"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 text-xl text-[#7b828c]"
          >
            ×
          </button>
        </div>
        <div className="space-y-6 px-6 py-6">
          <label className="block text-sm">
            <span className="mb-2 block font-semibold">
              {isZh ? "关系名称" : "Relationship name"}
            </span>
            <input
              value={linkTypeName}
              onChange={(event) => setLinkTypeName(event.target.value)}
              placeholder={isZh ? "例如：包含、属于、签约" : "For example: contains, belongs to"}
              className="h-10 w-full border px-3"
            />
            <span className="mt-1 block text-xs text-[#858d98]">
              {isZh
                ? "使用描述两个对象业务关系的动词或动词短语。"
                : "Use a verb or verb phrase that describes the business relationship."}
            </span>
          </label>
          <section>
            <h3 className="mb-3 text-sm font-semibold">
              1. {isZh ? "对象与基数" : "Objects and cardinality"}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm">
                <span className="mb-2 block">
                  {isZh ? "来源对象" : "Source object"}
                </span>
                <input
                  disabled
                  value={objectType.name}
                  className="h-10 w-full border bg-[#f6f7f8] px-3"
                />
              </label>
              <label className="text-sm">
                <span className="mb-2 block">
                  {isZh ? "目标对象" : "Target object"}
                </span>
                <select
                  value={targetObjectTypeId}
                  onChange={(event) =>
                    setTargetObjectTypeId(event.target.value)
                  }
                  className="h-10 w-full border px-3"
                >
                  {targetOptions.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-2 block">
                  {objectType.name} {isZh ? "侧基数" : "cardinality"}
                </span>
                <select
                  value={sourceCardinality}
                  onChange={(event) => setSourceCardinality(event.target.value)}
                  className="h-10 w-full border px-3"
                >
                  <option value="one">{isZh ? "一" : "One"}</option>
                  <option value="many">{isZh ? "多" : "Many"}</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-2 block">
                  {targetObject?.name || "-"} {isZh ? "侧基数" : "cardinality"}
                </span>
                <select
                  value={targetCardinality}
                  onChange={(event) => setTargetCardinality(event.target.value)}
                  className="h-10 w-full border px-3"
                >
                  <option value="one">{isZh ? "一" : "One"}</option>
                  <option value="many">{isZh ? "多" : "Many"}</option>
                </select>
              </label>
            </div>
          </section>
          <section>
            <h3 className="mb-3 text-sm font-semibold">
              2. {isZh ? "键映射" : "Key mapping"}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm">
                <span className="mb-2 block">
                  {objectType.name} {isZh ? "外键属性" : "foreign key"}
                </span>
                <select
                  value={foreignKeyPropertyId}
                  onChange={(event) =>
                    setForeignKeyPropertyId(event.target.value)
                  }
                  className="h-10 w-full border px-3"
                >
                  <option value="">
                    {isZh ? "选择属性" : "Select property"}
                  </option>
                  {sourceProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name} · {property.dataType}
                      {property.datasetName
                        ? ` · ${property.datasetName}`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-2 block">
                  {targetObject?.name || "-"}{" "}
                  {isZh ? "主键属性" : "primary key"}
                </span>
                <select
                  value={primaryKeyPropertyId}
                  onChange={(event) =>
                    setPrimaryKeyPropertyId(event.target.value)
                  }
                  className="h-10 w-full border px-3"
                >
                  <option value="">
                    {isZh ? "未找到主键" : "No primary key"}
                  </option>
                  {targetPrimaryKeys.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name} · {property.dataType}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {typeMismatch && (
              <p className="mt-2 border border-[#f2d28b] bg-[#fff8e8] px-3 py-2 text-sm text-[#8a5a00]">
                {isZh
                  ? "外键与主键的数据类型不一致，仍可创建关系；关联时将按字符串值进行匹配。"
                  : "Foreign and primary key types differ. You can still create the relationship; values will be matched as strings."}
              </p>
            )}
          </section>
          <section>
            <label className="text-sm">
              <span className="mb-2 block font-semibold">
                3. {isZh ? "状态" : "Status"}
              </span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-10 w-full border px-3"
              >
                <option value="experimental">Experimental</option>
                <option value="active">Active</option>
                <option value="deprecated">Deprecated</option>
              </select>
            </label>
          </section>
        </div>
        <div className="flex justify-end gap-3 border-t bg-[#fcfcfd] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 border px-5 text-sm"
          >
            {isZh ? "取消" : "Cancel"}
          </button>
          <button
            disabled={!canSubmit}
            className="h-10 bg-[#e3473c] px-5 text-sm text-white disabled:bg-[#e7a6a0]"
          >
            {isZh ? "保存关系类型" : "Save link type"}
          </button>
        </div>
      </form>
    </div>
  );
};

const ObjectTypeDetailPage = ({
  isZh,
  objectTypes,
  setObjectTypes,
  properties,
  setProperties,
  links,
  setLinks,
}) => {
  const navigate = useNavigate();
  const { objectTypeId } = useParams();
  const [activeTab, setActiveTab] = useState(() =>
    new URLSearchParams(window.location.search).get("edit") || "properties",
  );
  const [editingResource, setEditingResource] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const objectType = objectTypes.find((type) => type.id === objectTypeId);
  const [basicDraft, setBasicDraft] = useState({ name: "", apiName: "", description: "" });
  const [generatingLinks, setGeneratingLinks] = useState(false);
  const [linkGenerationMessage, setLinkGenerationMessage] = useState("");
  const [detailSourceFields, setDetailSourceFields] = useState([]);
  const [detailFieldMappings, setDetailFieldMappings] = useState({});
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingMessage, setMappingMessage] = useState("");
  const [relatedDefinitions, setRelatedDefinitions] = useState({ events: [], actions: [], functions: [], rules: [] });
  const [relatedDefinitionsLoading, setRelatedDefinitionsLoading] = useState(true);
  const [relatedDefinitionsError, setRelatedDefinitionsError] = useState("");
  const [propertyUpdateFields, setPropertyUpdateFields] = useState({
    name: true,
    apiName: false,
    dataType: true,
    description: true,
  });
  const objectProperties = properties.filter(
    (property) => property.objectTypeId === objectTypeId,
  );

  useEffect(() => {
    if (!objectType) return;
    setBasicDraft({
      name: objectType.name || "",
      apiName: objectType.apiName || "",
      description: objectType.description || "",
    });
  }, [objectType?.id]);

  useEffect(() => {
    if (!objectType?.id) return undefined;
    let active = true;
    setRelatedDefinitionsLoading(true);
    setRelatedDefinitionsError("");
    Promise.all([
      fetchOntologyDefinitions("event").catch(() => []),
      fetchOntologyDefinitions("object_action").catch(() => []),
      fetchOntologyDefinitions("function").catch(() => []),
      fetchOntologyDefinitions("action").catch(() => []),
      loadOntologyDesignCollection("workmate-ontology-rules").catch(() => []),
    ])
      .then(([events, actions, functions, workflows, storedRules]) => {
        if (!active) return;
        const rules = Array.isArray(storedRules) ? storedRules : [];
        const objectWorkflows = workflows.filter((workflow) =>
          workflow.objectTypeId === objectType.id ||
          (workflow.steps || []).some((step) => step.config?.objectTypeId === objectType.id),
        );
        const actionFunctionIds = new Set(
          objectWorkflows.flatMap((workflow) => (workflow.steps || []).map((step) => step.config?.functionId || "")).filter(Boolean),
        );
        const directlyRelatedFunctions = functions.filter((definition) =>
          definition.objectTypeId === objectType.id ||
          (definition.outputFields || definition.outputs || definition.fields || []).some((field) => field.objectTypeId === objectType.id) ||
          actionFunctionIds.has(definition.id),
        );
        const directlyRelatedFunctionIds = new Set(directlyRelatedFunctions.map((definition) => definition.id));
        const objectRules = rules.filter((rule) =>
          rule.objectTypeId === objectType.id ||
          (rule.conditions || []).some((condition) => {
            const functionId = condition.functionId || (condition.sourceType === "function" ? String(condition.fieldId || "").split(":")[0] : "");
            return directlyRelatedFunctionIds.has(functionId);
          }),
        );
        const referencedFunctionIds = new Set([
          ...objectRules.flatMap((rule) => (rule.conditions || []).map((condition) => condition.functionId || (condition.sourceType === "function" ? String(condition.fieldId || "").split(":")[0] : ""))),
          ...actionFunctionIds,
        ].filter(Boolean));
        setRelatedDefinitions({
          events: events.filter((event) => (event.subjectObjectTypeId || event.objectTypeId) === objectType.id),
          actions: actions.filter((action) => action.objectTypeId === objectType.id),
          functions: functions.filter((definition) =>
            definition.objectTypeId === objectType.id ||
            (definition.outputFields || definition.outputs || definition.fields || []).some((field) => field.objectTypeId === objectType.id) ||
            referencedFunctionIds.has(definition.id),
          ),
          rules: objectRules,
        });
      })
      .catch((error) => {
        if (active) setRelatedDefinitionsError(error.message || (isZh ? "关联定义加载失败" : "Failed to load related definitions"));
      })
      .finally(() => {
        if (active) setRelatedDefinitionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isZh, objectType?.id]);

  useEffect(() => {
    if (!objectType?.id || !(objectType.datasources || []).length) {
      setDetailSourceFields([]);
      setDetailFieldMappings({});
      return;
    }
    let cancelled = false;
    setMappingLoading(true);
    setMappingMessage("");
    listLocalDatasets()
      .then(async (datasets) => {
        const connectedIds = new Set(objectType.datasources.map((dataset) => dataset.id));
        const connectedDatasets = datasets.filter((dataset) => connectedIds.has(dataset.id));
        const schemas = await Promise.all(
          connectedDatasets
            .filter((dataset) => ["xlsx", "xls", "csv"].includes(dataset.extension?.toLowerCase()))
            .map(async (dataset) => ({ dataset, schema: await inferDatasetSchema(dataset) })),
        );
        if (cancelled) return;
        const fields = schemas.flatMap(({ dataset, schema }) =>
          schema.properties.map((field) => ({
            ...field,
            id: `${dataset.id}:${schema.sheetName}:${field.columnName}`,
            datasetId: dataset.id,
            datasetName: dataset.name,
            sheetName: schema.sheetName,
            sourceName: `${dataset.name} / ${schema.sheetName} / ${field.columnName}`,
          })),
        );
        setDetailSourceFields(fields);
        setDetailFieldMappings(Object.fromEntries(
          objectProperties.map((property) => {
            const mapping = Array.isArray(property.fieldMapping)
              ? property.fieldMapping[0]
              : property.fieldMapping || property;
            const matchedField = fields.find((field) =>
              field.datasetId === mapping.datasetId &&
              field.sheetName === mapping.sheetName &&
              field.columnName === mapping.columnName,
            );
            return [property.id, matchedField?.id || ""];
          }),
        ));
        if (connectedDatasets.length < connectedIds.size) {
          setMappingMessage(isZh ? "部分数据集已从本地删除，无法读取其原始字段。" : "Some connected datasets are no longer available locally.");
        }
      })
      .catch((error) => {
        if (!cancelled) setMappingMessage(error.message || (isZh ? "字段映射加载失败" : "Failed to load field mappings"));
      })
      .finally(() => {
        if (!cancelled) setMappingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [objectType?.id]);

  if (!objectType)
    return <Navigate to="/object-management/object-types" replace />;

  const objectLinks = links.filter(
    (link) =>
      link.sourceObjectTypeId === objectType.id ||
      link.targetObjectTypeId === objectType.id,
  );
  const objectName = (id) =>
    objectTypes.find((type) => type.id === id)?.name || "-";
  const hasGeneratedObjectLinks = objectLinks.some(
    (link) => link.generatedBy === "ai",
  );

  const generateObjectRelationships = async () => {
    setGeneratingLinks(true);
    setLinkGenerationMessage("");
    try {
      const response = await fetch(
        `${API_BASE}/object-type-analysis/relationships`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentObjectTypeId: objectType.id,
            objectTypes,
            properties,
            existingLinks: objectLinks,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.detail ||
            (isZh ? "关系生成失败" : "Failed to generate relationships"),
        );
      }
      let addedCount = 0;
      let updatedCount = 0;
      setLinks((current) => {
        const next = [...current];
        (payload.suggestions || [])
          .filter(
            (suggestion) =>
              suggestion.sourceObjectTypeId === objectType.id ||
              suggestion.targetObjectTypeId === objectType.id,
          )
          .forEach((suggestion) => {
            const existingIndex = next.findIndex(
              (link) =>
                link.id === suggestion.id ||
                (link.sourceObjectTypeId === suggestion.sourceObjectTypeId &&
                  link.targetObjectTypeId === suggestion.targetObjectTypeId &&
                  link.mapping?.foreignKeyPropertyId ===
                    suggestion.foreignKeyPropertyId),
            );
            const existing = existingIndex >= 0 ? next[existingIndex] : null;
            if (existing && existing.generatedBy !== "ai") return;
            const sourceObject = objectTypes.find(
              (item) => item.id === suggestion.sourceObjectTypeId,
            );
            const targetObject = objectTypes.find(
              (item) => item.id === suggestion.targetObjectTypeId,
            );
            const relationship = {
              ...(existing || {}),
              id:
                existing?.id ||
                suggestion.id ||
                `ai-link-${suggestion.sourceObjectTypeId}-${suggestion.targetObjectTypeId}-${suggestion.foreignKeyPropertyId}`,
              name: suggestion.name,
              apiName: suggestion.apiName,
              sourceObjectTypeId: suggestion.sourceObjectTypeId,
              targetObjectTypeId: suggestion.targetObjectTypeId,
              sourceCardinality: suggestion.sourceCardinality,
              targetCardinality: suggestion.targetCardinality,
              cardinality: suggestion.cardinality,
              sourceSide: {
                displayName: sourceObject?.name || "",
                pluralDisplayName: sourceObject?.name || "",
                apiName: sourceObject
                  ? `${sourceObject.apiName.charAt(0).toLowerCase()}${sourceObject.apiName.slice(1)}s`
                  : "sources",
                visibility: "normal",
              },
              targetSide: {
                displayName: targetObject?.name || "",
                pluralDisplayName: targetObject?.name || "",
                apiName: targetObject
                  ? `${targetObject.apiName.charAt(0).toLowerCase()}${targetObject.apiName.slice(1)}`
                  : "target",
                visibility: "normal",
              },
              mapping: {
                type: "foreignKey",
                foreignKeyObjectTypeId: suggestion.sourceObjectTypeId,
                foreignKeyPropertyId: suggestion.foreignKeyPropertyId,
                primaryKeyObjectTypeId: suggestion.targetObjectTypeId,
                primaryKeyPropertyId: suggestion.primaryKeyPropertyId,
              },
              confidence: suggestion.confidence,
              evidence: suggestion.evidence || [],
              generatedBy: "ai",
              status: existing?.status || "experimental",
            };
            if (existingIndex >= 0) {
              next[existingIndex] = relationship;
              updatedCount += 1;
            } else {
              next.push(relationship);
              addedCount += 1;
            }
          });
        return next;
      });
      setLinkGenerationMessage(
        isZh
          ? `已基于“${objectType.name}”生成关系：新增 ${addedCount} 条，更新 ${updatedCount} 条。${payload.generatedBy === "rules" ? "本次使用主外键规则生成。" : ""}`
          : `Generated for ${objectType.name}: ${addedCount} added, ${updatedCount} updated.`,
      );
    } catch (error) {
      setLinkGenerationMessage(
        error.message ||
          (isZh ? "关系生成失败" : "Failed to generate relationships"),
      );
    } finally {
      setGeneratingLinks(false);
    }
  };

  const saveObjectType = (changes) => {
    setObjectTypes((current) =>
      current.map((type) =>
        type.id === objectType.id
          ? { ...type, ...changes, updatedAt: isZh ? "刚刚" : "Just now" }
          : type,
      ),
    );
  };

  const saveBasicInfo = () => {
    if (!basicDraft.name.trim() || !basicDraft.apiName.trim()) return;
    saveObjectType({
      name: basicDraft.name.trim(),
      apiName: basicDraft.apiName.trim(),
      description: basicDraft.description.trim(),
    });
  };

  const applyDatasourceMappings = (updatePropertyMetadata) => {
    setProperties((current) => current.map((property) => {
      if (property.objectTypeId !== objectType.id) return property;
      const sourceField = detailSourceFields.find(
        (field) => field.id === detailFieldMappings[property.id],
      );
      if (!sourceField) {
        return {
          ...property,
          source: property.source === "datasource" ? "input" : property.source,
          sourceName: null,
          datasetId: null,
          datasetName: null,
          sheetName: null,
          columnName: null,
          sampleValues: [],
          nonEmptyRate: null,
          uniqueRate: null,
          fieldMapping: null,
        };
      }
      return {
        ...property,
        ...(updatePropertyMetadata && propertyUpdateFields.name ? { name: sourceField.name } : {}),
        ...(updatePropertyMetadata && propertyUpdateFields.apiName ? { apiName: sourceField.apiName } : {}),
        ...(updatePropertyMetadata && propertyUpdateFields.dataType ? { dataType: sourceField.dataType } : {}),
        ...(updatePropertyMetadata && propertyUpdateFields.description ? { description: sourceField.description } : {}),
        source: "datasource",
        sourceName: sourceField.sourceName,
        datasetId: sourceField.datasetId,
        datasetName: sourceField.datasetName,
        sheetName: sourceField.sheetName,
        columnName: sourceField.columnName,
        sampleValues: sourceField.sampleValues || [],
        nonEmptyRate: sourceField.nonEmptyRate,
        uniqueRate: sourceField.uniqueRate,
        fieldMapping: {
          datasetId: sourceField.datasetId,
          sheetName: sourceField.sheetName,
          columnName: sourceField.columnName,
        },
      };
    }));
    setMappingMessage(
      updatePropertyMetadata
        ? (isZh ? "映射关系和所选属性信息已更新。" : "Mappings and selected property metadata updated.")
        : (isZh ? "字段映射已保存。" : "Field mappings saved."),
    );
  };

  const saveResource = (data) => {
    if (modalMode === "property") {
      setProperties((current) =>
        editingResource
          ? current.map((property) =>
              property.id === editingResource.id
                ? { ...property, ...data }
                : property,
            )
          : [
              ...current,
              {
                id: `property-${Date.now()}`,
                objectTypeId: objectType.id,
                ...data,
              },
            ],
      );
    } else {
      setLinks((current) =>
        editingResource
          ? current.map((link) =>
              link.id === editingResource.id ? { ...link, ...data } : link,
            )
          : [
              ...current,
              {
                id: `link-${Date.now()}`,
                sourceObjectTypeId: objectType.id,
                ...data,
              },
            ],
      );
    }
    setModalMode(null);
    setEditingResource(null);
  };

  const openEdit = (mode, item) => {
    setModalMode(mode);
    setEditingResource(item);
  };
  const removeResource = (mode, id) => {
    if (!window.confirm(isZh ? "确定删除吗？" : "Delete this item?")) return;
    if (mode === "property")
      setProperties((current) =>
        current.filter((property) => property.id !== id),
      );
    else setLinks((current) => current.filter((link) => link.id !== id));
  };

  const tabs = [
    { id: "datasource", label: isZh ? "数据源" : "Datasource" },
    { id: "basic", label: isZh ? "基本信息" : "Basic info" },
    { id: "properties", label: isZh ? "属性" : "Properties" },
    { id: "links", label: isZh ? "关系" : "Links" },
    { id: "events", label: isZh ? "事件" : "Events" },
    { id: "actions", label: isZh ? "动作" : "Actions" },
    { id: "functions", label: isZh ? "函数" : "Functions" },
    { id: "rules", label: isZh ? "规则" : "Rules" },
  ];

  const relatedTabConfig = {
    events: {
      title: isZh ? "关联事件" : "Related events",
      description: isZh ? "以当前对象类型为主体触发的事件。" : "Events triggered with this object type as their subject.",
      empty: isZh ? "当前对象类型暂无关联事件" : "No related events",
      createLabel: isZh ? "管理事件" : "Manage events",
      path: "/object-management/event-types",
    },
    actions: {
      title: isZh ? "关联动作" : "Related actions",
      description: isZh ? "当前本体对象可调用的业务动作。" : "Business actions callable for this ontology object.",
      empty: isZh ? "当前本体暂无关联动作" : "No related actions",
      createLabel: isZh ? "新增动作" : "New action",
      path: `/object-management/object-actions?objectType=${encodeURIComponent(objectType.id)}`,
    },
    functions: {
      title: isZh ? "关联函数" : "Related functions",
      description: isZh ? "由当前对象的规则或动作调用，或输出归属于当前对象的函数。" : "Functions used by this object's rules or actions, or producing outputs for this object.",
      empty: isZh ? "当前对象类型暂无关联函数" : "No related functions",
      createLabel: isZh ? "管理函数" : "Manage functions",
      path: "/object-management/functions",
    },
    rules: {
      title: isZh ? "关联规则" : "Related rules",
      description: isZh ? "作用于当前对象类型的业务判断规则。" : "Business rules evaluated against this object type.",
      empty: isZh ? "当前对象类型暂无关联规则" : "No related rules",
      createLabel: isZh ? "管理规则" : "Manage rules",
      path: "/object-management/rules",
    },
  };

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-[#f7f8fa]">
      <header className="border-b border-[#e4e7eb] bg-white px-8 pt-5">
        <div className="mx-auto max-w-[1280px]">
          <button
            type="button"
            onClick={() => navigate("/object-management/object-types")}
            className="mb-4 text-sm text-[#727a85] hover:text-[#e3473c]"
          >
            ← {isZh ? "返回对象类型" : "Back to object types"}
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#fff0ed] text-[#d94a3e]">
              <ObjectTypeIcon />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[#20242b]">
                {objectType.name}
              </h1>
              <code className="text-xs text-[#7c8490]">
                {objectType.apiName}
              </code>
            </div>
          </div>
          <div className="mt-6 flex gap-7">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 pb-3 text-sm font-medium ${activeTab === tab.id ? "border-[#e3473c] text-[#d94338]" : "border-transparent text-[#6f7782]"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-[1280px] px-8 py-6">
        {activeTab === "datasource" && (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[#252a32]">
                {isZh ? "数据源" : "Datasource"}
              </h2>
              <p className="mt-1 text-sm text-[#7b838e]">
                {isZh ? "查看连接的数据集，并核对对象属性与原始字段的映射。" : "View connected datasets and review property-to-field mappings."}
              </p>
            </div>
            {(objectType.datasources || []).length > 0 ? (
              <>
                <div className="max-w-[950px] overflow-hidden rounded-md border border-[#e0e3e7] bg-white">
                  {(objectType.datasources || []).map((dataset) => (
                    <div key={dataset.id} className="flex items-center gap-3 border-b border-[#eceef1] px-5 py-4 last:border-b-0">
                      <DatabaseIcon />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-[#303741]">{dataset.name}</div>
                        <div className="mt-1 text-xs text-[#858d98]">{(dataset.extension || dataset.type || "FILE").toUpperCase()}</div>
                      </div>
                      <span className="rounded-full bg-[#f1f2f4] px-2.5 py-1 text-xs text-[#68717d]">
                        {dataset.role === "primary" ? (isZh ? "主表" : "Primary table") : (isZh ? "数据源" : "Dataset")}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 border-t border-[#e0e3e7] pt-6">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-[#252a32]">
                        {isZh ? "字段映射" : "Field mapping"}
                      </h3>
                      <p className="mt-1 text-sm text-[#7b838e]">
                        {isZh ? "编辑映射后可仅保存关系，也可以按原始字段重新更新属性信息。" : "Save mapping changes only, or refresh property metadata from mapped fields."}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => applyDatasourceMappings(false)}
                        disabled={mappingLoading || detailSourceFields.length === 0}
                        className="h-9 rounded-md border border-[#cfd5dc] bg-white px-4 text-sm font-medium text-[#4f5864] hover:bg-[#f5f6f8] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isZh ? "保存映射" : "Save mappings"}
                      </button>
                      <button
                        type="button"
                        onClick={() => applyDatasourceMappings(true)}
                        disabled={mappingLoading || detailSourceFields.length === 0 || !Object.values(propertyUpdateFields).some(Boolean)}
                        className="h-9 rounded-md bg-[#e3473c] px-4 text-sm font-medium text-white hover:bg-[#cf3e34] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isZh ? "按映射更新属性" : "Update properties"}
                      </button>
                    </div>
                  </div>
                  <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 border border-[#e0e3e7] bg-white px-4 py-3">
                    <span className="text-xs font-semibold text-[#606975]">
                      {isZh ? "更新属性时覆盖：" : "Overwrite when updating:"}
                    </span>
                    {[
                      ["name", isZh ? "属性名称" : "Name"],
                      ["apiName", "API Name"],
                      ["dataType", isZh ? "数据类型" : "Data type"],
                      ["description", isZh ? "说明" : "Description"],
                    ].map(([field, label]) => (
                      <label key={field} className="flex cursor-pointer items-center gap-2 text-sm text-[#4f5864]">
                        <input
                          type="checkbox"
                          checked={propertyUpdateFields[field]}
                          onChange={(event) => setPropertyUpdateFields((current) => ({ ...current, [field]: event.target.checked }))}
                          className="h-4 w-4 accent-[#e3473c]"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {mappingMessage && (
                    <div className="mb-4 border border-[#d9dde3] bg-white px-4 py-3 text-sm text-[#59616c]">
                      {mappingMessage}
                    </div>
                  )}
                  {mappingLoading ? (
                    <div className="border border-dashed border-[#cfd5dc] bg-white py-14 text-center text-sm text-[#858d98]">
                      {isZh ? "正在读取原始字段..." : "Loading source fields..."}
                    </div>
                  ) : (
                    <FieldMappingStep
                      isZh={isZh}
                      datasourceMode="existing"
                      properties={objectProperties}
                      sourceFields={detailSourceFields}
                      fieldMappings={detailFieldMappings}
                      onMappingChange={(propertyId, sourceFieldId) => {
                        setDetailFieldMappings((current) => ({ ...current, [propertyId]: sourceFieldId }));
                        setMappingMessage("");
                      }}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed border-[#cfd5dc] bg-white py-14 text-center text-sm text-[#858d98]">
                {isZh ? "当前对象类型尚未连接数据源。" : "No datasource connected."}
              </div>
            )}
          </div>
        )}
        {activeTab === "basic" && (
          <div className="max-w-[720px] rounded-md border border-[#e0e3e7] bg-white p-6">
            <div className="space-y-5">
              <label className="block text-sm"><span className="mb-2 block text-[#606975]">{isZh ? "对象名称" : "Object name"}</span><input value={basicDraft.name} onChange={(event) => setBasicDraft((current) => ({ ...current, name: event.target.value }))} className="h-10 w-full rounded-md border border-[#d9dde3] px-3" /></label>
              <label className="block text-sm"><span className="mb-2 block text-[#606975]">API Name</span><input value={basicDraft.apiName} onChange={(event) => setBasicDraft((current) => ({ ...current, apiName: event.target.value }))} className="h-10 w-full rounded-md border border-[#d9dde3] px-3 font-mono" /></label>
              <label className="block text-sm"><span className="mb-2 block text-[#606975]">{isZh ? "描述" : "Description"}</span><textarea rows={4} value={basicDraft.description} onChange={(event) => setBasicDraft((current) => ({ ...current, description: event.target.value }))} className="w-full resize-none rounded-md border border-[#d9dde3] px-3 py-2" /></label>
              <div className="flex justify-end"><button type="button" onClick={saveBasicInfo} disabled={!basicDraft.name.trim() || !basicDraft.apiName.trim()} className="h-9 rounded-md bg-[#e3473c] px-4 text-sm font-medium text-white disabled:opacity-40">{isZh ? "保存基本信息" : "Save basic info"}</button></div>
            </div>
          </div>
        )}
        {(activeTab === "properties" || activeTab === "links") && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#252a32]">
                  {activeTab === "properties"
                    ? isZh
                      ? "属性"
                      : "Properties"
                    : isZh
                      ? "关系"
                      : "Links"}
                </h2>
                <p className="mt-1 text-sm text-[#7b838e]">
                  {activeTab === "properties"
                    ? isZh
                      ? "定义该对象包含的数据字段。"
                      : "Define fields on this object."
                    : isZh
                      ? "将当前对象连接到其他对象类型。"
                      : "Connect this object to other object types."}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {activeTab === "links" && (
                  <button
                    type="button"
                    onClick={generateObjectRelationships}
                    disabled={generatingLinks || objectTypes.length < 2}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e3473c] bg-white px-4 text-sm font-medium text-[#d94338] transition hover:bg-[#fff5f3] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="text-xs font-semibold">AI</span>
                    {generatingLinks
                      ? isZh
                        ? "正在生成..."
                        : "Generating..."
                      : hasGeneratedObjectLinks
                        ? isZh
                          ? "更新关系"
                          : "Update relationships"
                        : isZh
                          ? "智能生成关系"
                          : "Generate relationships"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingResource(null);
                    setModalMode(
                      activeTab === "properties" ? "property" : "link",
                    );
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-[#e3473c] px-4 text-sm font-medium text-white"
                >
                  <PlusIcon />
                  {activeTab === "properties"
                    ? isZh
                      ? "新建属性"
                      : "Create property"
                    : isZh
                      ? "新建关系"
                      : "Create link"}
                </button>
              </div>
            </div>
            {activeTab === "links" && linkGenerationMessage && (
              <div className="mb-4 border border-[#d9dde3] bg-white px-4 py-3 text-sm text-[#59616c]">
                {linkGenerationMessage}
              </div>
            )}
            <div className="overflow-hidden rounded-md border border-[#e0e3e7] bg-white">
              {activeTab === "properties" ? (
                <>
                  <div className="grid grid-cols-[1.2fr_1fr_120px_minmax(180px,1fr)_90px] bg-[#f6f7f8] px-5 py-3 text-xs font-semibold text-[#6e7681]">
                    <span>{isZh ? "属性名称" : "Property"}</span>
                    <span>API Name</span>
                    <span>{isZh ? "数据类型" : "Data type"}</span>
                    <span>{isZh ? "说明" : "Description"}</span>
                    <span className="text-right">
                      {isZh ? "操作" : "Actions"}
                    </span>
                  </div>
                  {objectProperties.map((property) => (
                    <div
                      key={property.id}
                      className="grid grid-cols-[1.2fr_1fr_120px_minmax(180px,1fr)_90px] items-center border-t border-[#eceef1] px-5 py-4 text-sm"
                    >
                      <span className="font-medium">{property.name}</span>
                      <code className="text-xs">{property.apiName}</code>
                      <span>
                        {{
                          文本: "string",
                          数字: "number",
                          日期: "date",
                          布尔: "boolean",
                          枚举: "enum",
                        }[property.dataType] || property.dataType}
                      </span>
                      <span className="truncate text-[#6f7782]" title={property.description || ""}>
                        {property.description || "-"}
                      </span>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit("property", property)}
                          className="flex h-8 w-8 items-center justify-center"
                        >
                          <EditIcon />
                        </button>
                        <button
                          onClick={() =>
                            removeResource("property", property.id)
                          }
                          className="flex h-8 w-8 items-center justify-center text-[#d94338]"
                        >
                          <DeleteIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-[1.2fr_1fr_1fr_120px_90px] bg-[#f6f7f8] px-5 py-3 text-xs font-semibold text-[#6e7681]">
                    <span>{isZh ? "关系名称" : "Link"}</span>
                    <span>{isZh ? "来源对象" : "Source"}</span>
                    <span>{isZh ? "目标对象" : "Target"}</span>
                    <span>{isZh ? "关系基数" : "Cardinality"}</span>
                    <span className="text-right">
                      {isZh ? "操作" : "Actions"}
                    </span>
                  </div>
                  {objectLinks.map((link) => (
                    <div
                      key={link.id}
                      className="grid grid-cols-[1.2fr_1fr_1fr_120px_90px] items-center border-t border-[#eceef1] px-5 py-4 text-sm"
                    >
                      <span>
                        <span className="font-medium">{link.name}</span>
                        <code className="ml-2 text-xs text-[#7b838e]">
                          {link.apiName}
                        </code>
                      </span>
                      <span>{objectName(link.sourceObjectTypeId)}</span>
                      <span>{objectName(link.targetObjectTypeId)}</span>
                      <span>{link.cardinality}</span>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit("link", link)}
                          disabled={link.sourceObjectTypeId !== objectType.id}
                          title={link.sourceObjectTypeId !== objectType.id ? (isZh ? "请从来源对象编辑此关系" : "Edit this link from its source object") : (isZh ? "编辑" : "Edit")}
                          className="flex h-8 w-8 items-center justify-center disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <EditIcon />
                        </button>
                        <button
                          onClick={() => removeResource("link", link.id)}
                          className="flex h-8 w-8 items-center justify-center text-[#d94338]"
                        >
                          <DeleteIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
            {(activeTab === "properties" ? objectProperties : objectLinks)
              .length === 0 && (
              <div className="border-x border-b border-[#e0e3e7] bg-white py-12 text-center text-sm text-[#858d98]">
                {isZh ? "暂无数据" : "No data"}
              </div>
            )}
          </div>
        )}
        {["events", "actions", "functions", "rules"].includes(activeTab) && (() => {
          const config = relatedTabConfig[activeTab];
          const items = relatedDefinitions[activeTab] || [];
          return (
            <div>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#252a32]">{config.title}</h2>
                  <p className="mt-1 text-sm text-[#7b838e]">{config.description}</p>
                </div>
                <button type="button" onClick={() => navigate(config.path)} className="h-9 shrink-0 rounded-md border border-[#d6dbe1] bg-white px-4 text-sm font-medium text-[#4f5864] hover:border-[#e3473c] hover:text-[#d94338]">
                  {config.createLabel}
                </button>
              </div>
              {relatedDefinitionsError && <div className="mb-4 border border-[#f0cbc8] bg-[#fff7f6] px-4 py-3 text-sm text-[#c43e35]">{relatedDefinitionsError}</div>}
              {relatedDefinitionsLoading ? (
                <div className="rounded-md border border-dashed border-[#cfd5dc] bg-white py-14 text-center text-sm text-[#858d98]">{isZh ? "正在加载关联定义..." : "Loading related definitions..."}</div>
              ) : items.length ? (
                <div className="overflow-hidden rounded-md border border-[#e0e3e7] bg-white">
                  <div className="grid grid-cols-[minmax(220px,1.4fr)_minmax(240px,2fr)_120px] bg-[#f6f7f8] px-5 py-3 text-xs font-semibold text-[#6e7681]">
                    <span>{isZh ? "名称" : "Name"}</span>
                    <span>{isZh ? "说明 / 调用入口" : "Description / endpoint"}</span>
                    <span className="text-right">{isZh ? "操作" : "Action"}</span>
                  </div>
                  {items.map((item) => (
                    <button key={item.id} type="button" onClick={() => navigate(`${config.path.split("?")[0]}?selected=${encodeURIComponent(item.id)}`)} className="grid w-full grid-cols-[minmax(220px,1.4fr)_minmax(240px,2fr)_120px] items-center border-t border-[#eceef1] px-5 py-4 text-left text-sm transition hover:bg-[#fafafa]">
                      <span className="truncate font-medium text-[#252a32]">{item.name}</span>
                      <span className="truncate text-[#6f7782]">{item.description || item.endpoint || item.validationDimension || "-"}</span>
                      <span className="text-right font-medium text-[#d94338]">{isZh ? "查看详情 →" : "View details →"}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-[#cfd5dc] bg-white py-14 text-center text-sm text-[#858d98]">{config.empty}</div>
              )}
            </div>
          );
        })()}
      </section>
      {modalMode === "property" && (
        <ResourceModal
          key={`${modalMode}-${editingResource?.id || "new"}`}
          mode={modalMode}
          item={editingResource}
          objectType={objectType}
          objectTypes={objectTypes}
          isZh={isZh}
          onClose={() => {
            setModalMode(null);
            setEditingResource(null);
          }}
          onSubmit={saveResource}
        />
      )}
      {modalMode === "link" && (
        <LinkTypeModal
          key={`${modalMode}-${editingResource?.id || "new"}`}
          item={editingResource}
          objectType={objectType}
          objectTypes={objectTypes}
          properties={properties}
          links={links}
          isZh={isZh}
          onClose={() => {
            setModalMode(null);
            setEditingResource(null);
          }}
          onSubmit={saveResource}
        />
      )}
    </main>
  );
};

const ObjectManagement = () => {
  const { section, objectTypeId } = useParams();
  const { isZh, t } = useLanguage();
  const [objectTypes, setObjectTypes] = useSessionData(
    "workmate-object-types",
    INITIAL_OBJECT_TYPES,
  );
  const [properties, setProperties] = useSessionData(
    "workmate-object-properties",
    INITIAL_PROPERTIES,
  );
  const [links, setLinks] = useSessionData(
    "workmate-object-links",
    INITIAL_LINKS,
  );
  const sectionKey = SECTION_KEYS[section];

  useEffect(() => {
    setProperties((current) => {
      let changed = false;
      const migrated = current.map((property) => {
        if (
          ["employee-id", "contract-id", "supplier-id"].includes(property.id) &&
          !property.primaryKey
        ) {
          changed = true;
          return { ...property, primaryKey: true };
        }
        return property;
      });
      if (
        !migrated.some((property) => property.id === "contract-supplier-id") &&
        objectTypes.some((type) => type.id === "contract") &&
        objectTypes.some((type) => type.id === "supplier")
      ) {
        changed = true;
        migrated.push({
          id: "contract-supplier-id",
          objectTypeId: "contract",
          name: "供应商编号",
          apiName: "supplierId",
          dataType: "文本",
          required: true,
        });
      }
      return changed ? migrated : current;
    });
  }, [objectTypes, setProperties]);

  useEffect(() => {
    setLinks((current) => {
      let changed = false;
      const migrated = current.map((link) => {
        if (
          link.id === "contract-supplier" &&
          (link.name !== "签约" ||
            link.sourceSide?.displayName !== "签订的合同" ||
            link.targetSide?.displayName !== "签约供应商" ||
            link.mapping?.foreignKeyPropertyId !== "contract-supplier-id" ||
            link.mapping?.primaryKeyPropertyId !== "supplier-id")
        ) {
          changed = true;
          return {
            ...link,
            name: "签约",
            apiName: "contractSupplier",
            sourceCardinality: "many",
            targetCardinality: "one",
            cardinality: "多对一",
            sourceSide: {
              ...link.sourceSide,
              displayName: "签订的合同",
              pluralDisplayName: "签订的合同",
              apiName: "contracts",
            },
            targetSide: {
              ...link.targetSide,
              displayName: "签约供应商",
              apiName: "supplier",
            },
            mapping: {
              type: "foreignKey",
              foreignKeyObjectTypeId: "contract",
              foreignKeyPropertyId: "contract-supplier-id",
              primaryKeyObjectTypeId: "supplier",
              primaryKeyPropertyId: "supplier-id",
            },
            status: link.status || "experimental",
          };
        }
        return link;
      });
      return changed ? migrated : current;
    });
  }, [setLinks]);

  if (!sectionKey && !objectTypeId) {
    return <Navigate to="/object-management/object-types" replace />;
  }

  if (objectTypeId) {
    return (
      <div className="flex h-screen overflow-hidden bg-[#f7f8fa] text-[#252a32]">
        <Sidebar />
        <ObjectTypeDetailPage
          isZh={isZh}
          objectTypes={objectTypes}
          setObjectTypes={setObjectTypes}
          properties={properties}
          setProperties={setProperties}
          links={links}
          setLinks={setLinks}
        />
      </div>
    );
  }

  const sectionTitle = t(sectionKey);

  if (section === "chat") {
    return (
      <div className="flex h-screen overflow-hidden bg-[#f7f8fa] text-[#252a32]">
        <Sidebar />
        <SimpleChatPage isZh={isZh} />
      </div>
    );
  }

  if (section === "object-types") {
    return (
      <div className="flex h-screen overflow-hidden bg-[#f7f8fa] text-[#252a32]">
        <Sidebar />
        <ObjectTypesPage
          isZh={isZh}
          objectTypes={objectTypes}
          setObjectTypes={setObjectTypes}
          properties={properties}
          setProperties={setProperties}
          links={links}
          setLinks={setLinks}
        />
      </div>
    );
  }

  if (section === "graph") {
    return (
      <div className="flex h-screen overflow-hidden bg-[#f7f8fa] text-[#252a32]">
        <Sidebar />
        <OntologyGraphPage
          isZh={isZh}
          objectTypes={objectTypes}
          properties={properties}
          links={links}
        />
      </div>
    );
  }

  if (section === "rules") {
    return (
      <div className="flex h-screen overflow-hidden bg-[#f7f8fa] text-[#252a32]">
        <Sidebar />
        <OntologyRulesPage
          isZh={isZh}
          objectTypes={objectTypes}
          properties={properties}
        />
      </div>
    );
  }

  if (section === "functions") {
    return (
      <div className="flex h-screen overflow-hidden bg-[#f7f8fa] text-[#252a32]">
        <Sidebar />
        <OntologyFunctionsPage
          isZh={isZh}
          objectTypes={objectTypes}
          properties={properties}
        />
      </div>
    );
  }

  if (section === "object-actions") {
    return (
      <div className="flex h-screen overflow-hidden bg-[#f7f8fa] text-[#252a32]">
        <Sidebar />
        <OntologyActionsPage isZh={isZh} objectTypes={objectTypes} />
      </div>
    );
  }

  if (section === "event-types" || section === "action-types") {
    return (
      <div className="flex h-screen overflow-hidden bg-[#f7f8fa] text-[#252a32]">
        <Sidebar />
        <OntologyOperationsPage
          mode={section === "event-types" ? "events" : "actions"}
          isZh={isZh}
          objectTypes={objectTypes}
          properties={properties}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fa] text-[#252a32]">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="flex h-16 items-center border-b border-[#e8eaee] bg-white px-8">
          <h1 className="text-lg font-semibold">{sectionTitle}</h1>
        </header>
        <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-8 py-12">
          <div className="text-center text-[#69717d]">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#dce0e6] bg-white">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="5" r="3" />
                <circle cx="5" cy="18" r="3" />
                <circle cx="19" cy="18" r="3" />
                <path d="M10.5 7.6 6.5 15M13.5 7.6l4 7.4M8 18h8" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#414852]">{sectionTitle}</p>
            <p className="mt-2 text-xs text-[#9299a3]">{t("object.empty")}</p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ObjectManagement;
