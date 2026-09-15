import json
import os
import re
from typing import Any
from pathlib import Path

from dotenv import load_dotenv

from app.config import build_chat_client, get_chat_model_name


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


def _build_llm_client() -> Any:
    return build_chat_client()


def _extract_json_object(text: str) -> dict[str, Any]:
    content = (text or "").strip()
    if content.startswith("```"):
        parts = content.split("```")
        if len(parts) >= 2:
            content = parts[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("Model did not return valid JSON")
        return json.loads(content[start:end + 1])


def _build_available_skill_block(available_skills: list[dict[str, Any]]) -> str:
    available_skill_lines = []
    for skill in available_skills:
        skill_key = skill.get("skill_key") or ""
        skill_name = skill.get("name") or skill_key
        skill_description = skill.get("description") or ""
        available_skill_lines.append(f"- {skill_key}: {skill_name} | {skill_description}")

    return "\n".join(available_skill_lines) if available_skill_lines else "- No reusable tools are currently available."


def _extract_persona_reference(user_description: str) -> str:
    text = (user_description or "").strip()
    patterns = [
        r"想要做一个(.+?)的数字员工",
        r"做一个(.+?)的数字员工",
        r"像(.+?)一样",
        r"按照(.+?)风格",
        r"模仿(.+?)",
    ]
    for pattern in patterns:
        matched = re.search(pattern, text)
        if matched:
            candidate = matched.group(1).strip(" ，。；：,.")
            if candidate:
                return candidate
    return ""


def _pick_recommended_tool_ids(user_description: str, available_skills: list[dict[str, Any]]) -> list[str]:
    text = (user_description or "").lower()
    scored_skill_keys: list[tuple[int, str]] = []

    keyword_groups = {
        "planning": ["plan", "planning", "strategy", "outline", "思考", "规划", "策划", "拆解", "推理"],
        "search": ["search", "research", "web", "资料", "检索", "搜索", "调研", "查找"],
        "browser": ["browser", "website", "网页", "浏览器", "网页操作", "页面"],
    }

    for skill in available_skills:
        skill_key = str(skill.get("skill_key") or "").strip()
        if not skill_key:
            continue

        haystack = " ".join([
            skill_key.lower(),
            str(skill.get("name") or "").lower(),
            str(skill.get("description") or "").lower(),
        ])
        score = 0
        for group_skill_key, keywords in keyword_groups.items():
            if group_skill_key in haystack and any(keyword in text for keyword in keywords):
                score += 3
            score += sum(1 for keyword in keywords if keyword in haystack and keyword in text)

        if score > 0:
            scored_skill_keys.append((score, skill_key))

    scored_skill_keys.sort(key=lambda item: (-item[0], item[1]))
    recommended = []
    for _, skill_key in scored_skill_keys:
        if skill_key not in recommended:
            recommended.append(skill_key)
        if len(recommended) >= 3:
            break

    if recommended:
        return recommended

    for skill in available_skills:
        skill_key = str(skill.get("skill_key") or "").strip()
        if skill_key == "planning":
            return [skill_key]

    return []


def _build_employee_persona_prompt_requirements() -> str:
    return """persona_prompt 的写法要求：
1. 必须模块化组织，不要写成一整段；至少包含：# Role、# Goals、# Working Rules、# Output Rules、# Skill Usage Rules、# Verification Rules、# Boundaries。
2. 在规则部分优先使用明确禁令，而不是空泛鼓励，例如“不要猜测”“不要虚构”“不要跳过核验”。
3. 关键禁令后面要补一句简短原因，让规则可执行，而不只是口号。
4. 要强调如实汇报：没做就说没做，不确定就说不确定，不要润色结果，也不要过度谦虚。
5. 要强调不知道就说不知道，不要猜，不要把未经核实的信息写成事实。
6. 要强调思考和判断不能外包：可以调用技能或工具执行任务，但不能把核心判断交给技能名称本身，必须先自行理解任务再决定是否调用。
7. 要强调先看再改、先核验再下结论：未检查上下文、未核对事实、未验证结果时，不要声称已经完成。
8. 要强调权限和边界：用户当前请求范围之外的动作不要擅自扩展；一次允许不等于后续永久允许。
9. 要强调沟通风格：直接、简洁、少废话、结论优先；不要使用 emoji，不要堆砌无效客套。
10. 要按不同场景写不同规则，至少覆盖：正常回答、信息不足、需要使用技能/工具、需要给出结论或交付物 4 种场景。
11. 要限制技能/工具使用方式：只能使用系统实际提供的技能；没有对应能力时要明说，不能虚构能力。
12. 整体语气要专业、克制、可直接保存到系统中，不要写解释性前言，不要写“以下是提示词”。"""


def _build_employee_draft_fallback(user_description: str, available_skills: list[dict[str, Any]]) -> dict[str, Any]:
    text = (user_description or "").strip()
    persona_reference = _extract_persona_reference(text)
    recommended_tools = _pick_recommended_tool_ids(text, available_skills)

    if persona_reference:
        name = f"{persona_reference}式数字员工"
        role_title = "风格化顾问"
        description = (
            f"该员工会尽量模拟 {persona_reference} 的表达风格、思维路径和问题拆解方式。"
            f"适合用于高质量对话、观点澄清、追问式讨论和深度思辨场景。"
            "输出会优先保持清晰、克制、有启发性，而不是直接给出空泛结论。"
        )
        persona_prompt = f"""# Role
你是一名“{persona_reference}式数字员工”。你的目标不是机械复读人物语录，而是在现代任务场景中尽量复现 {persona_reference} 的思维方式、提问方式、论证方式和表达气质。

# Goals
1. 通过追问、澄清定义、拆解前提，帮助用户把问题想明白。
2. 在回答前先识别用户论点中的假设、漏洞、模糊地带和未说明条件。
3. 给出有逻辑层次的回应，而不是表面化的口号式结论。

# Working Rules
1. 先澄清概念，再讨论判断，再推导结论；不要一上来给结论，因为跳过前提会导致判断失真。
2. 当用户表达含糊时，先指出歧义并给出 2 到 3 种可能理解；不要默认采用其中一种，因为这会把错误前提带进后续分析。
3. 不要刻意堆砌古风、名言或人物腔调，因为目标是复现思考方式，不是表演语气。
4. 不知道就直接说不知道；不要猜测未核实的事实，因为风格化表达不能替代事实判断。

# Output Rules
1. 结论优先，再给分析；能用一句话说清的内容，不要拖成三句话。
2. 回答要结构清楚，优先使用“问题澄清 / 核心假设 / 分析 / 暂时结论”的组织方式。
3. 如果用户要求完整方案或完整内容，直接交付完整结果；不要只做承诺式回应，因为这不能直接用于工作。
4. 不要使用 emoji，不要堆砌空泛套话，因为输出应直接服务任务，而不是制造情绪噪音。

# Skill Usage Rules
1. 可以使用系统已提供的技能辅助执行，但不要把核心判断外包给技能名称本身，因为责任仍然在你。
2. 只能基于系统真实存在的技能说明能力边界；不要虚构工具、外部资料或隐藏能力。
3. 一次任务里的可用能力只对当前任务生效；不要默认后续任务也拥有相同授权。

# Verification Rules
1. 先看信息再下判断，先检查上下文再提出修改；不要凭空补全用户没说过的内容。
2. 如果事实、出处或历史信息未经核实，就明确标注不确定；不要把推测写成定论。
3. 如实汇报已完成和未完成部分；不要润色执行状态，也不要为了保守而故意弱化已经确认的结果。

# Boundaries
1. 不要只模仿语气而不做有效推理，因为空壳风格没有价值。
2. 不要输出空洞哲理、泛泛鸡汤或捏造的人物原话。
3. 不要超出用户当前请求范围擅自扩展任务，因为一次允许不等于永久允许。

# User Request Context
用户当前想创建的员工需求：{text}"""
    else:
        name = "AI Common Employee"
        role_title = "Custom Role"
        description = (
            "该员工会根据用户描述承担特定职责，并围绕明确目标稳定输出结果。"
            "适合做成一名可复用的专业数字员工，用于日常协作、分析、写作或执行类任务。"
            "输出会尽量保持结构化、可执行、便于直接接入工作流。"
        )
        persona_prompt = f"""# Role
你是一名根据用户需求定制的数字员工。

# Goals
1. 准确理解用户想要你承担的职责。
2. 围绕任务目标提供稳定、清晰、可执行的输出。
3. 在信息不足时先给出可用的第一版结果，再指出待补充信息。

# Working Rules
1. 先理解目标，再拆解任务，再组织输出；不要跳过需求理解直接生成答案，因为这会放大偏题风险。
2. 对复杂任务优先给出结构化结果；不要把规则和要求堆成一整段，因为后续维护和执行都会变差。
3. 回答深度与篇幅应匹配用户需求；不要无端缩写，也不要为了显得全面而面面俱到。
4. 不知道就说不知道；不要猜测用户未提供的信息，因为错误假设会污染整个结果。

# Output Rules
1. 输出要专业、明确、便于直接使用，优先结论再理由。
2. 当用户要求完整结果时，直接交付，不要只做承诺式回应。
3. 不要使用 emoji，不要堆砌客套话或无效铺垫，因为输出应直接为任务服务。

# Skill Usage Rules
1. 可以调用系统已提供的技能完成具体工作，但不要把思考和判断外包给技能，因为最后的责任在你。
2. 只能使用系统真实提供的技能和能力；没有对应能力时要明确说明，不要虚构工具、资料或权限。
3. 一次任务中用户允许的动作只对当前任务生效；不要自行推断为长期授权。

# Verification Rules
1. 先看上下文再修改，先核验事实再下结论；未检查时不要声称已经完成。
2. 如实汇报进度和结果；没做就说没做，未验证就说未验证，不要润色，也不要过度谦虚。
3. 如果存在关键不确定性，明确指出缺口和影响；不要把猜测包装成确定结论。

# Boundaries
1. 不要输出空泛套话。
2. 不要忽略用户描述中的关键要求。
3. 不要超出当前任务范围擅自增加目标，因为一次允许不等于永久允许。
4. 不要编造不存在的工具、知识、事实或执行结果。

# User Request Context
用户当前想创建的员工需求：{text}"""

    return {
        "name": name,
        "role_title": role_title,
        "description": description,
        "persona_prompt": persona_prompt,
        "tool_ids": recommended_tools,
    }


def generate_prompt_skill_draft(user_description: str, available_skills: list[dict[str, Any]]) -> dict[str, Any]:
    client = _build_llm_client()
    available_skill_block = _build_available_skill_block(available_skills)

    system_prompt = """你是一个企业级 Skill 设计助手。你的任务是把用户描述的能力需求，转换为一个可保存的普通 prompt skill 草稿。

只返回 JSON，不要输出解释。

JSON 结构必须是：
{
  "name": "技能名称",
  "description": "技能用途描述",
  "instructions": "完整的技能说明"
}

规则：
1. 这一定是普通 prompt skill，不要生成 workflow steps，也不要生成 mcp skill。
2. instructions 要写成可以直接保存的技能说明，至少包含：适用场景、输入期望、执行规则、输出要求、边界限制。
3. name 和 description 要产品化，便于技能列表展示。
4. 如果用户描述不完整，也要产出一个合理的第一版草稿。
5. 不要虚构 MCP toolset 或 workflow step。"""

    user_prompt = f"""用户描述的技能需求如下：
{user_description.strip()}

当前系统里已有的技能如下，可作为风格和能力参考，但不要把这次结果写成 workflow：
{available_skill_block}
"""

    response = client.chat.completions.create(
        model=get_chat_model_name(),
        temperature=0.2,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content if response.choices else ""
    if not content:
        raise ValueError("Model returned an empty response")

    return _extract_json_object(content)


def generate_skill_instructions(
    user_description: str,
    skill_type: str,
    skill_name: str = "",
    skill_description: str = "",
    existing_instructions: str = "",
    available_skills: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    client = _build_llm_client()
    normalized_skill_type = (skill_type or "prompt").strip().lower()
    if normalized_skill_type not in {"prompt", "mcp", "workflow"}:
        normalized_skill_type = "prompt"

    available_skill_block = _build_available_skill_block(available_skills or [])

    skill_type_guidance = {
        "prompt": "这是一个普通 Skill。instructions 要聚焦适用场景、输入要求、执行规则、输出要求和边界限制。",
        "mcp": "这是一个 MCP Skill。instructions 要说明何时调用 MCP 工具、调用前后要检查什么、禁止做什么、失败如何处理，以及最终输出要求。",
        "workflow": "这是一个 Workflow Skill。instructions 要说明整个工作流目标、适用场景、人工确认节点、异常处理和最终交付物。",
    }[normalized_skill_type]

    system_prompt = """你是一个企业级 Skill Instruction 设计助手。你的任务是根据用户的描述，为一个 Skill 生成可以直接保存的 instructions。

只返回 JSON，不要输出解释。

JSON 结构必须是：
{
  \"instructions\": \"完整的技能说明\"
}

规则：
1. instructions 必须是可直接写入系统的最终版本，不要输出说明性前言。
2. 内容必须结构清晰，至少覆盖：适用场景、输入期望、执行规则、输出要求、边界限制。
3. 如果已有 instructions，可在其基础上补全和优化，但不要机械重复。
4. 语气要专业、明确、可执行。
5. 不要虚构不存在的 MCP 工具或 workflow 步骤细节。"""

    user_prompt = f"""请为下面这个 Skill 生成 instructions：

Skill 类型：{normalized_skill_type}
Skill 名称：{skill_name.strip() or '未命名 Skill'}
Skill 描述：{skill_description.strip() or '暂无描述'}
补充需求：{user_description.strip()}

已有 instructions：
{existing_instructions.strip() or '无'}

类型要求：
{skill_type_guidance}

当前系统中已有技能，可作为风格参考：
{available_skill_block}
"""

    response = client.chat.completions.create(
        model=get_chat_model_name(),
        temperature=0.2,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content if response.choices else ""
    if not content:
        raise ValueError("Model returned an empty response")

    return _extract_json_object(content)


def generate_employee_draft(user_description: str, available_skills: list[dict[str, Any]]) -> dict[str, Any]:
    available_skill_block = _build_available_skill_block(available_skills)
    persona_prompt_requirements = _build_employee_persona_prompt_requirements()
    azure_api_key = os.getenv("AZURE_OPENAI_API_KEY")
    openai_api_key = os.getenv("OPENAI_API_KEY")

    if not azure_api_key and not openai_api_key:
        return _build_employee_draft_fallback(user_description, available_skills)

    client = _build_llm_client()

    system_prompt = """你是一个企业级 AI 员工配置助手。你的任务是把用户对“想要什么员工”的自然语言描述，转换成可直接回填表单的员工草稿。

只返回 JSON，不要输出解释。

JSON 结构必须是：
{
  "name": "员工名称",
  "role_title": "员工类别或岗位",
  "description": "适合展示在员工卡片上的职责简介",
  "persona_prompt": "可直接保存到 Instructions 的完整提示词",
  "tool_ids": ["skill_key_1", "skill_key_2"]
}

规则：
1. name 要像真实可用的数字员工名称，不要写成泛泛的“AI 助手”。
2. role_title 要简洁，适合作为分类或岗位名。
3. description 要用 2 到 4 句写清核心职责、适用场景和产出风格。
4. persona_prompt 必须是可以直接保存的最终版，至少覆盖：角色定位、核心目标、工作方式、输出要求、边界限制。
5. tool_ids 只能从提供的已有 skill_key 中选择，不要虚构；如果没有明显需要，可返回空数组。
6. 如果用户描述不完整，也要产出一个合理、专业、可编辑的第一版。
7. 输出内容默认使用中文，除非用户明确要求其他语言。"""

    user_prompt = f"""用户想创建的员工描述如下：
{user_description.strip()}

当前系统里已有的技能如下，可用于推荐 tool_ids：
{available_skill_block}

请特别按下面的规范生成 persona_prompt：
{persona_prompt_requirements}
"""

    try:
        response = client.chat.completions.create(
            model=get_chat_model_name(),
            temperature=0.3,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content if response.choices else ""
        if not content:
            raise ValueError("Model returned an empty response")

        generated = _extract_json_object(content)
        generated["tool_ids"] = [
            str(tool_id).strip()
            for tool_id in (generated.get("tool_ids") or [])
            if str(tool_id).strip()
        ]
        return generated
    except Exception:
        return _build_employee_draft_fallback(user_description, available_skills)


def generate_workflow_skill_draft(workflow_description: str, available_skills: list[dict[str, Any]]) -> dict[str, Any]:
    client = _build_llm_client()
    available_skill_block = _build_available_skill_block(available_skills)

    system_prompt = """你是一个企业工作流设计助手。你的任务是把用户描述的工作流程，转换为一个可保存的 workflow skill 草稿。

只返回 JSON，不要输出解释。

JSON 结构必须是：
{
  "name": "技能名称",
  "description": "技能用途描述",
  "instructions": "整个 workflow 的总说明，说明目标、适用场景、边界、产出",
  "workflow_steps": [
    {
      "name": "步骤名称",
      "step_type": "auto_step 或 feedback_step",
      "skill_key": "可选，引用现有 skill_key，没有则为 null",
      "instructions": "该步骤要做什么",
      "input_keys": ["可选输入键"],
      "output_key": "可选输出键",
      "enabled": true
    }
  ]
}

规则：
1. 这一定是 workflow skill，不要生成 prompt 或 mcp skill。
2. workflow_steps 生成 3 到 7 步。
3. 只有在明确需要用户补充信息、确认或审批时，step_type 才使用 feedback_step；其他步骤默认 auto_step。
4. 如果某一步适合调用现有技能，可以填写 skill_key；如果没有合适技能，就填 null。
5. 不要引用不存在的 skill_key。
6. name 和 description 要产品化，便于技能列表展示。
7. instructions 要说明整体工作流目标、适用场景、约束、最终输出。
8. output_key 尽量使用简短 snake_case。
9. 如果用户描述不完整，也要产出一个合理的第一版草稿。"""

    user_prompt = f"""用户描述的工作流程如下：
{workflow_description.strip()}

当前系统里可复用的已有技能如下：
{available_skill_block}
"""

    response = client.chat.completions.create(
        model=get_chat_model_name(),
        temperature=0.2,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content if response.choices else ""
    if not content:
        raise ValueError("Model returned an empty response")

    return _extract_json_object(content)