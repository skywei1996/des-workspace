from sqlalchemy import inspect, text


TASK_EXECUTION_COLUMN_MIGRATIONS = {
    "result_is_read": "ALTER TABLE task_executions ADD COLUMN result_is_read INTEGER DEFAULT 1 NOT NULL",
}


def _build_task_result_chat_id(task_id: str, employee_id: str) -> int:
    seed = f"automation-task-chat:{task_id}:{employee_id}"
    stable_hash = 0
    for char in seed:
        stable_hash = ((stable_hash << 5) - stable_hash + ord(char)) & 0xFFFFFFFF
    return stable_hash % 2_000_000_000 + 1


def _migrate_task_result_chat_ids(connection) -> None:
    rows = connection.execute(text("""
        SELECT cm.id, cm.meta_data, COALESCE(te.employee_id, t.employee_id) AS employee_id
        FROM chat_messages AS cm
        LEFT JOIN task_executions AS te
          ON te.execution_id = json_extract(cm.meta_data, '$.execution_id')
        LEFT JOIN tasks AS t
          ON t.task_id = json_extract(cm.meta_data, '$.task_id')
        WHERE json_extract(cm.meta_data, '$.source') = 'automation_task'
          AND json_extract(cm.meta_data, '$.task_id') IS NOT NULL
    """)).mappings().all()

    for row in rows:
        meta_data = row["meta_data"]
        if not meta_data or not row["employee_id"]:
            continue
        task_id = connection.execute(
            text("SELECT json_extract(:meta_data, '$.task_id')"),
            {"meta_data": meta_data},
        ).scalar_one_or_none()
        if not task_id:
            continue
        connection.execute(
            text("UPDATE chat_messages SET chat_id = :chat_id WHERE id = :message_id"),
            {
                "chat_id": _build_task_result_chat_id(str(task_id), str(row["employee_id"])),
                "message_id": row["id"],
            },
        )


def ensure_automation_schema(engine) -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "task_executions" not in table_names:
        return

    existing_columns = {column["name"] for column in inspector.get_columns("task_executions")}
    with engine.begin() as connection:
        for column_name, ddl in TASK_EXECUTION_COLUMN_MIGRATIONS.items():
            if column_name not in existing_columns:
                connection.execute(text(ddl))

        connection.execute(text("UPDATE task_executions SET result_is_read = COALESCE(result_is_read, 1)"))
        if {"chat_messages", "tasks"}.issubset(table_names):
            _migrate_task_result_chat_ids(connection)