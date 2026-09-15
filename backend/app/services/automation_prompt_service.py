"""
Automation task prompt & tool for the conversational creation flow.

When a user enters a digital employee chat via "通过对话添加" from the
Automation Task List page, the system injects a guiding prompt and registers
a `create_automation_task` function-calling tool so the AI can naturally
interview the user, collect required information, and call the tool to
create the task after user confirmation.
"""

import json
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from .. import models, schemas
from ..routers.tasks import _build_task_payload, _generate_prefixed_id, _guard_duplicate_submission, _validate_employee_capability


AUTOMATION_SETUP_PROMPT = """\
## 定时任务创建引导

你现在处于「定时任务创建引导」模式。用户希望通过对话方式创建一个定时任务。你的职责是引导用户完成以下信息的确认，然后调用工具创建任务。

### 需要收集的信息项

创建一个定时任务必须明确以下信息：

1. **任务内容**：数字员工需要定时做什么？例如"整理行业简报""汇总项目进度""检查数据异常"等。
2. **任务名称**：给这个任务起一个简短好认的名字。
3. **执行周期与时间**：
   - 周期类型：单次、每日、每周、每月
   - 执行时间：具体几点几分（例如 09:00）
   - 每周需指定周几（例如周一、周三），支持多选
   - 每月需指定几号（例如5号、15号），支持多选
4. **执行日期范围**（可选）：从哪天开始，到哪天结束。如果不指定，默认从今天开始，长期执行。

### 引导原则

- 不要一次性列出所有问题，根据用户已表达的内容判断哪些信息已经明确、哪些还需要追问。
- 用自然对话的方式逐项确认，不要机械地逐条提问。
- 如果用户一句话里已经包含了部分信息（例如"每周三下午两点半帮我整理行业简报"），直接确认已有信息，只追问缺失的部分。
- 用户可能用口语表达时间（例如"下午两点半""早上9点""工作日"），你需要将其转换为标准格式。
- 所有信息收集完毕后，用清晰的结构汇总全部信息，询问用户"是否确认创建？"。
- 只有在用户明确确认后，才调用 create_automation_task 工具创建任务。
- 如果用户中途改变想法或补充信息，灵活调整，不要死板地按原顺序继续。

### 调用工具格式

当用户确认创建后，调用 `create_automation_task` 工具，参数如下：
- task_name：任务名称
- task_content：任务内容描述
- task_type：周期类型，可选值："单次"、"每日"、"每周"、"每月"
- execute_rule：执行规则字符串
  - 单次：格式为 "YYYY-MM-DD HH:MM"，例如 "2026-08-01 09:00"
  - 每日：格式为 "HH:MM"，例如 "09:00"
  - 每周：格式为 "WEEKDAY HH:MM"，WEEKDAY 为英文缩写（MON/TUE/WED/THU/FRI/SAT/SUN），多选用逗号分隔，例如 "MON,WED,FRI 09:00"
  - 每月：格式为 "DAY HH:MM"，DAY 为日期数字，多选用逗号分隔，例如 "5,15,25 09:00"
- start_date：开始日期，格式 YYYY-MM-DD（可选，不提供则默认今天）
- end_date：结束日期，格式 YYYY-MM-DD（可选，不提供则长期执行）

### 禁止行为

- 不要在没有确认所有必要信息的情况下调用创建工具。
- 不要自行编造用户没有表达的任务内容或时间。
- 不要在用户明确取消后仍然创建任务。
"""


WEEKDAY_MAP = {
    "MON": "周一",
    "TUE": "周二",
    "WED": "周三",
    "THU": "周四",
    "FRI": "周五",
    "SAT": "周六",
    "SUN": "周日",
}


def build_automation_setup_prompt() -> str:
    """Return the prompt fragment to inject into the system message."""
    return AUTOMATION_SETUP_PROMPT


def create_automation_task_tool(
    task_name: str,
    task_content: str,
    task_type: str,
    execute_rule: str,
    employee_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> str:
    """
    Runtime function-calling tool for creating an automation task.

    This function is registered as a callable tool so the AI can invoke it
    via function calling after the user confirms task creation.
    Returns a human-readable result string that the AI will relay to the user.
    """
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        # Validate employee
        employee = db.query(models.AIEmployee).filter(models.AIEmployee.id == int(employee_id)).first()
        if employee is None or employee.status != "active":
            return json.dumps({"success": False, "error": f"数字员工（ID: {employee_id}）不可用，请选择其他数字员工。"}, ensure_ascii=False)

        # Build date strings
        now = datetime.now()
        start_time_str = start_date or now.strftime("%Y-%m-%d")
        end_time_str = end_date or ""

        payload = {
            "task_name": task_name,
            "task_type": task_type,
            "user_id": "U10023",
            "task_content": task_content,
            "employee_id": str(employee.id),
            "employee_source": "personal_created" if employee.access_scope == "personal" else "admin_created",
            "execute_rule": execute_rule,
            "start_time": start_time_str,
            "end_time": end_time_str,
        }

        normalized_payload = _build_task_payload(payload)
        normalized_payload["employee_id"] = str(employee.id)
        _validate_employee_capability(db, normalized_payload)
        _guard_duplicate_submission(db, normalized_payload)

        db_task = models.Task(
            task_id=_generate_prefixed_id("TSK"),
            executor_role="digital_employee",
            **normalized_payload,
        )
        db.add(db_task)
        db.commit()
        db.refresh(db_task)

        # Build readable schedule description
        schedule_desc = _describe_schedule(db_task.task_type, db_task.execute_rule)

        result = {
            "success": True,
            "task_name": db_task.task_name,
            "task_type": db_task.task_type,
            "execute_rule": db_task.execute_rule,
            "next_execute_time": db_task.next_execute_time.strftime("%Y-%m-%d %H:%M") if db_task.next_execute_time else "未计算",
            "employee_name": employee.name,
            "schedule_description": schedule_desc,
        }
        return json.dumps(result, ensure_ascii=False)

    except Exception as exc:
        db.rollback()
        return json.dumps({"success": False, "error": f"创建任务失败：{str(exc)}"}, ensure_ascii=False)
    finally:
        db.close()


def _describe_schedule(task_type: str, execute_rule: str) -> str:
    """Build a human-readable schedule description from task_type + execute_rule."""
    parts = str(execute_rule or "").split(" ")
    time = parts[1] if len(parts) >= 2 else "--:--"
    day_part = parts[0] if len(parts) >= 1 else ""

    if task_type == "单次":
        return f"{day_part} {time} 执行一次"
    elif task_type == "每日":
        return f"每日 {time} 执行"
    elif task_type == "每周":
        weekday_tokens = day_part.split(",") if day_part else []
        labels = [WEEKDAY_MAP.get(t.strip().upper(), t.strip()) for t in weekday_tokens]
        return f"每周{'、'.join(labels)} {time} 执行"
    elif task_type == "每月":
        day_tokens = day_part.split(",") if day_part else []
        labels = [f"{t.strip()}号" for t in day_tokens]
        return f"每月{'、'.join(labels)} {time} 执行"
    return execute_rule
