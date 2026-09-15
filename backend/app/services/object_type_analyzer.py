import json
from typing import Any

from app.config import build_chat_client, get_chat_model_name


def _complete_json(system_prompt: str, user_prompt: str) -> dict[str, Any]:
    client = build_chat_client()
    response = client.chat.completions.create(
        model=get_chat_model_name(),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content if response.choices else ""
    if not content:
        raise ValueError("模型未返回对象类型候选。")
    return json.loads(content)


def analyze_table_for_object_type(
    dataset_name: str,
    sheet_name: str,
    columns: list[dict[str, Any]],
) -> dict[str, Any]:
    if not columns:
        raise ValueError("表格没有可用于实体识别的列。")

    system_prompt = """你是企业本体建模助手。请根据表格的文件名、工作表名、列结构和样例值，独立判断这张表中每一行实际代表的稳定业务实体。

只返回 JSON，不要输出 Markdown 或解释：
{
  "objectType": {"name": "中文对象类型名", "description": "一句话说明"},
    "columnSemantics": [{"columnName": "原始列名", "name": "简洁中文属性名", "description": "直接说明该字段业务含义的中文短句"}],
  "instanceHints": [{"value": "样例实体或分类值", "evidence": "列名及样例值"}],
  "confidence": 0.0,
  "evidence": ["支持判断的列名或样例摘要"]
}

规则：
1. 先判断表格的行粒度：一行是在描述一个人、组织、合同、订单、产品、资产、事件、时间序列记录，还是其他实体。对象类型必须与行粒度一致。
2. 优先依据唯一标识列、名称/标题列、分类列、状态列和样例值联合判断；文件名和工作表名只能作为弱证据，不能覆盖列与样例数据。
3. 对象类型名称使用简洁、可复用的中文业务名词，通常为 2 至 8 个字。不要使用文件名、工作表名、报告名、时间周期，也不要套用任何固定行业答案。
4. 区分对象类型与实例值：对象类型描述“这一类是什么”，instanceHints 放样例行中的具体名称、编号或分类值。不得把某个样例值直接复制成对象类型。
5. 只有列名和样例值明确支持时，才使用行业化名称；证据不足时选择更稳健的上位业务实体，仍不足则返回“待确认对象”。
6. columnSemantics 必须覆盖输入中的每一个列名，columnName 原样返回。将 camelCase、snake_case 或英文列名翻译成自然、准确的中文属性名，并结合对象类型和样例值给出具体说明。
7. description 直接解释字段含义，不要使用“该字段记录对应的业务信息”“当前记录的业务信息”等空泛模板。例如 availableCalendars 应为“可用日历列表。”，assignedOrders 应为“已分配的订单列表。”，capacityPerDay 应为“每日可处理的业务数量或产能。”。
8. 不要新增输入中不存在的属性，也不要改变 columnName；模型只补充每列的中文 name 和 description。
9. confidence 必须反映证据强度；evidence 至少说明哪些列和样例共同支持该判断。

请在内部完成判断，不要复述推理过程，只输出规定的 JSON。"""
    user_prompt = (
        f"数据集名称：{dataset_name}\n"
        f"工作表名称：{sheet_name}\n"
        f"列结构与样例：\n{json.dumps(columns[:50], ensure_ascii=False)}"
    )
    return _complete_json(system_prompt, user_prompt)


def analyze_document_for_object_type(document_name: str, text: str) -> dict[str, Any]:
    if not text.strip():
        raise ValueError("PDF 未提取到可理解的文本。扫描件需要先经过 OCR。")

    system_prompt = """你是企业本体建模助手。请从文档正文中识别一个最适合作为当前对象类型的稳定业务实体，并提取描述该实体的属性。

先区分三个层次：
- 文档：当前 PDF 文件、报告或周报，例如“铜行业周度分析报告”。文档标题不是对象类型。
- 对象类型：企业需要持续管理、比较或关联的稳定业务实体，例如“金属品种”“商品”“矿产品”或“供应商”。
- 对象实例和属性值：对象类型的具体成员或取值，例如“铜”是“金属品种”的实例/属性值，不应直接把“铜行业周度分析报告”作为对象类型。

只返回 JSON，不要输出 Markdown 或解释。结构必须是：
{
  "objectType": {"name": "中文对象类型名", "description": "一句话说明"},
  "properties": [
    {"name": "属性名", "apiName": "camelCase", "dataType": "文本|数字|日期|布尔|枚举", "required": false, "evidence": "来自文档的短证据"}
  ],
    "instanceHints": [{"value": "对象实例或属性值", "evidence": "来自文档的短证据"}],
  "titleProperty": "属性名",
  "confidence": 0.0,
  "evidence": ["支持判断的短引用或段落摘要"]
}

规则：
1. 对象类型必须是文档中反复出现、具有业务身份且可跨多份文档复用的实体；不要把文档标题、报告、章节或抽象主题当作对象类型。
2. 如果文档围绕某种具体品种展开，优先建立上位对象类型，并增加品种属性。例如文档反复讨论“铜”，可返回对象类型“金属品种”，并返回属性“金属品种”，证据值为“铜”；不要返回“铜行业周报”作为对象类型。
3. 属性必须是该实体的稳定描述字段，例如品种、编号、名称、状态、金额、日期、责任方、价格、库存；不要把整段叙述拆成字段。对象实例或属性值放入 instanceHints，不要伪装成属性名。
4. 对于“铜属于金属”这类分类关系，优先将“金属”作为对象类型或分类属性，将“铜”作为实例/属性值；不要同时机械地创建名为“金属”的重复属性，除非原文明确把它作为字段。
5. 不要凭空补充文档没有证据的字段。属性 evidence 必须引用原文中的短语或忠实摘要。
6. 最多返回 12 个属性；优先返回有明确证据的属性。
7. 如果文档无法支持稳定对象类型，返回 objectType.name 为“待确认对象”，properties 为空，并将 confidence 设为较低值。
8. 这是候选建议，保留 evidence 供用户确认。"""
    user_prompt = f"文档名称：{document_name}\n\n文档正文：\n{text[:50000]}"

    return _complete_json(system_prompt, user_prompt)


def analyze_text_for_object_type(text: str) -> dict[str, Any]:
        if not text.strip():
                raise ValueError("请输入用于识别对象类型的业务描述。")

        system_prompt = """你是企业本体建模助手。请从用户提供的业务描述中识别一个最适合作为对象类型的稳定业务实体，并提取该实体的属性。

只返回 JSON，不要输出 Markdown 或解释。结构必须是：
{
    "objectType": {"name": "中文对象类型名", "description": "一句话业务介绍"},
    "properties": [
        {"name": "中文属性名", "apiName": "camelCase", "dataType": "文本|数字|日期|布尔|枚举", "required": false, "evidence": "来自用户描述的短证据"}
    ],
    "instanceHints": [{"value": "对象实例或属性值", "evidence": "来自用户描述的短证据"}],
    "titleProperty": "属性名",
    "confidence": 0.0,
    "evidence": ["支持判断的短证据"]
}

规则：
1. objectType.name 必须表示一类可持续管理、比较或关联的业务实体，不要把业务描述中的具体实例、示例名称或场景当成对象类型。
2. objectType.description 用一句中文说明该对象代表什么以及业务用途，不要复述整段输入。
3. 只提取用户描述中明确出现或可以直接确定的稳定属性，最多返回 20 个，不要凭空补充字段。
4. 属性 name 使用简洁自然的中文业务名称；apiName 使用 camelCase；dataType 只能使用规定枚举值。
5. 将具体名称、编号样例或分类取值放入 instanceHints，不要把实例值伪装成属性名。
6. titleProperty 应选择最适合作为对象展示标题的属性名；没有合适属性时返回空字符串。
7. 如果信息不足，返回 objectType.name 为“待确认对象”、description 说明需要补充的信息、properties 为空，并将 confidence 设为较低值。
8. evidence 和属性 evidence 必须来自用户描述的短语或忠实摘要，不要输出推理过程。

请只输出规定的 JSON。"""
        user_prompt = f"用户业务描述：\n{text[:50000]}"
        return _complete_json(system_prompt, user_prompt)


def _normalized_key(value: Any) -> str:
    return "".join(character for character in str(value or "").lower() if character.isalnum())


def _business_relationship_name(
    source: dict[str, Any],
    target: dict[str, Any],
    foreign_key: dict[str, Any],
) -> str:
    source_name = str(source.get("name") or "来源对象")
    target_name = str(target.get("name") or "目标对象")
    field_semantics = " ".join(
        str(foreign_key.get(key) or "")
        for key in ("name", "apiName", "columnName", "description")
    ).lower()

    responsibility_tokens = (
        "employee", "purchaser", "buyer", "owner", "manager", "负责人", "采购员", "员工"
    )
    content_tokens = (
        "material", "product", "item", "line", "物料", "产品", "商品", "明细"
    )
    parent_tokens = ("project", "category", "parent", "项目", "分类", "上级")
    supplier_tokens = ("supplier", "vendor", "供应商")

    if any(token in field_semantics for token in responsibility_tokens):
        return f"{target_name}负责{source_name}"
    if any(token in field_semantics for token in content_tokens):
        return f"{source_name}包含{target_name}"
    if any(token in field_semantics for token in parent_tokens):
        return f"{target_name}包含{source_name}"
    if any(token in field_semantics for token in supplier_tokens):
        if "报价" in source_name:
            return f"{target_name}提交{source_name}"
        return f"{source_name}面向{target_name}"
    return f"{source_name}属于{target_name}"


def _relationship_fallback(
    object_types: list[dict[str, Any]],
    properties: list[dict[str, Any]],
    existing_links: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    object_by_id = {item.get("id"): item for item in object_types if item.get("id")}
    existing_by_pair = {
        (item.get("sourceObjectTypeId"), item.get("targetObjectTypeId")): item
        for item in existing_links
    }
    primary_keys = [item for item in properties if item.get("primaryKey")]
    suggestions: list[dict[str, Any]] = []
    for foreign_key in properties:
        if foreign_key.get("primaryKey"):
            continue
        source_id = foreign_key.get("objectTypeId")
        source = object_by_id.get(source_id)
        if not source:
            continue
        foreign_names = {
            _normalized_key(foreign_key.get("name")),
            _normalized_key(foreign_key.get("apiName")),
            _normalized_key(foreign_key.get("columnName")),
        }
        for primary_key in primary_keys:
            target_id = primary_key.get("objectTypeId")
            target = object_by_id.get(target_id)
            if not target or target_id == source_id:
                continue
            if foreign_key.get("dataType") != primary_key.get("dataType"):
                continue
            primary_names = {
                _normalized_key(primary_key.get("name")),
                _normalized_key(primary_key.get("apiName")),
                _normalized_key(primary_key.get("columnName")),
            }
            target_tokens = {
                _normalized_key(target.get("name")),
                _normalized_key(target.get("apiName")),
            }
            exact_match = bool((foreign_names - {""}) & (primary_names - {""}))
            semantic_match = any(
                token and any(token in name for name in foreign_names)
                for token in target_tokens
            )
            if not exact_match and not semantic_match:
                continue
            existing = existing_by_pair.get((source_id, target_id))
            existing_is_manual = existing and existing.get("generatedBy") != "ai"
            suggestions.append({
                "id": existing.get("id") if existing else None,
                "changeType": "update" if existing else "new",
                "name": existing.get("name") if existing_is_manual else _business_relationship_name(source, target, foreign_key),
                "apiName": existing.get("apiName") if existing else f"{source.get('apiName', 'source')[:1].lower()}{source.get('apiName', 'source')[1:]}{target.get('apiName', 'target')}",
                "sourceObjectTypeId": source_id,
                "targetObjectTypeId": target_id,
                "sourceCardinality": "many",
                "targetCardinality": "one",
                "cardinality": "多对一",
                "foreignKeyPropertyId": foreign_key.get("id"),
                "primaryKeyPropertyId": primary_key.get("id"),
                "confidence": 0.96 if exact_match else 0.82,
                "evidence": [
                    f"{source.get('name')}包含字段“{foreign_key.get('name')}”",
                    f"{target.get('name')}主键为“{primary_key.get('name')}”",
                    "两个映射字段的数据类型一致",
                ],
            })
    unique: dict[tuple[Any, Any, Any], dict[str, Any]] = {}
    for suggestion in suggestions:
        key = (
            suggestion["sourceObjectTypeId"],
            suggestion["targetObjectTypeId"],
            suggestion["foreignKeyPropertyId"],
        )
        if key not in unique or suggestion["confidence"] > unique[key]["confidence"]:
            unique[key] = suggestion
    return list(unique.values())


def infer_object_relationships(
    object_types: list[dict[str, Any]],
    properties: list[dict[str, Any]],
    existing_links: list[dict[str, Any]],
    current_object_type_id: str | None = None,
) -> dict[str, Any]:
    if len(object_types) < 2:
        return {"suggestions": [], "generatedBy": "rules", "summary": "至少需要两个对象类型。"}

    system_prompt = """你是企业级 Palantir Foundry 本体关系建模助手。根据对象类型、属性、主键和已有关系，生成可执行的对象关系候选。

只返回 JSON：
{
  "suggestions": [{
    "id": "已有关系 ID 或 null",
    "changeType": "new|update",
    "name": "中文业务关系句，必须为主语+动词+宾语",
    "apiName": "camelCase",
    "sourceObjectTypeId": "来源对象 ID",
    "targetObjectTypeId": "目标对象 ID",
    "sourceCardinality": "one|many",
    "targetCardinality": "one|many",
    "cardinality": "一对一|一对多|多对一|多对多",
    "foreignKeyPropertyId": "来源对象外键属性 ID",
    "primaryKeyPropertyId": "目标对象主键属性 ID",
    "confidence": 0.0,
    "evidence": ["中文证据"]
  }],
  "summary": "中文摘要"
}

强制规则：
1. 仅生成存在明确键映射的关系。来源外键必须属于来源对象，目标键必须是目标对象的主键，且数据类型一致。
2. 优先依据字段原名、API Name、中文说明、数据源来源和对象语义。不要仅凭对象名称臆造关系。
3. 一般含外键的一端为多，主键对象一端为一。多对多必须有明确中间对象，不直接生成无映射关系。
4. 与已有关系相同的来源对象和目标对象使用 changeType=update 并保留其 id；否则为 new。
5. name 必须是自然、完整、可直接朗读的中文业务关系句，采用“主语对象 + 业务动词 + 宾语对象”，必须同时包含两个对象名称。禁止使用“关联”“相关”“对应”“关系”这类无业务含义的泛化动词，也禁止把对象 ID、属性 ID 或 API Name 拼进名称。
6. 关系名的语义方向不必等同于外键映射方向。根据字段和对象语义选择最自然的表达，例如：询价单的 material_id 指向物料时命名为“询价单包含物料”；询价单的 purchaser_id 指向员工时命名为“员工负责询价单”；供应商报价单的 supplier_id 指向供应商时命名为“供应商提交供应商报价单”；询价单的 project_id 指向项目时命名为“项目包含询价单”。
7. 对已有 AI 生成关系，重新判断并更新 name；只有已有人工关系才保留人工名称。
8. 关系名称和 evidence 使用纯中文。不要输出不存在的对象或属性 ID。
9. 如果提供 currentObjectTypeId，只生成来源对象或目标对象为该对象的直接关系。
10. 最多输出 20 条，按 confidence 降序。"""
    context = {
        "currentObjectTypeId": current_object_type_id,
        "objectTypes": object_types,
        "properties": properties,
        "existingLinks": existing_links,
    }
    try:
        result = _complete_json(system_prompt, json.dumps(context, ensure_ascii=False))
        raw_suggestions = result.get("suggestions", [])
        fallback = _relationship_fallback(object_types, properties, existing_links)
        if current_object_type_id:
            fallback = [
                suggestion for suggestion in fallback
                if current_object_type_id in (
                    suggestion.get("sourceObjectTypeId"),
                    suggestion.get("targetObjectTypeId"),
                )
            ]
        valid_object_ids = {item.get("id") for item in object_types}
        property_by_id = {item.get("id"): item for item in properties}
        validated = []
        for suggestion in raw_suggestions:
            source_id = suggestion.get("sourceObjectTypeId")
            target_id = suggestion.get("targetObjectTypeId")
            foreign_key = property_by_id.get(suggestion.get("foreignKeyPropertyId"))
            primary_key = property_by_id.get(suggestion.get("primaryKeyPropertyId"))
            if source_id not in valid_object_ids or target_id not in valid_object_ids:
                continue
            if current_object_type_id and current_object_type_id not in (source_id, target_id):
                continue
            if not foreign_key or not primary_key:
                continue
            if foreign_key.get("objectTypeId") != source_id:
                continue
            if primary_key.get("objectTypeId") != target_id or not primary_key.get("primaryKey"):
                continue
            if foreign_key.get("dataType") != primary_key.get("dataType"):
                continue
            validated.append(suggestion)
        return {
            "suggestions": validated or fallback,
            "generatedBy": "ai" if validated else "rules",
            "summary": result.get("summary") or "已根据对象属性和主外键生成关系建议。",
        }
    except Exception:
        return {
            "suggestions": _relationship_fallback(object_types, properties, existing_links),
            "generatedBy": "rules",
            "summary": "模型暂不可用，已根据主外键规则生成关系建议。",
        }
