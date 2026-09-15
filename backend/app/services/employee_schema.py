from sqlalchemy import inspect, text


AI_EMPLOYEE_COLUMN_MIGRATIONS = {
    "description": "ALTER TABLE ai_employees ADD COLUMN description TEXT",
    "model": "ALTER TABLE ai_employees ADD COLUMN model VARCHAR",
    "status": "ALTER TABLE ai_employees ADD COLUMN status VARCHAR DEFAULT 'active' NOT NULL",
    "access_scope": "ALTER TABLE ai_employees ADD COLUMN access_scope VARCHAR DEFAULT 'org' NOT NULL",
    "access_teams": "ALTER TABLE ai_employees ADD COLUMN access_teams JSON",
    "version_group": "ALTER TABLE ai_employees ADD COLUMN version_group VARCHAR",
    "source_employee_id": "ALTER TABLE ai_employees ADD COLUMN source_employee_id INTEGER",
    "source_type": "ALTER TABLE ai_employees ADD COLUMN source_type VARCHAR DEFAULT 'native' NOT NULL",
    "dify_url": "ALTER TABLE ai_employees ADD COLUMN dify_url VARCHAR",
    "dify_api_key": "ALTER TABLE ai_employees ADD COLUMN dify_api_key VARCHAR",
    "dify_app_type": "ALTER TABLE ai_employees ADD COLUMN dify_app_type VARCHAR",
    "dify_metadata": "ALTER TABLE ai_employees ADD COLUMN dify_metadata JSON",
    "tags": "ALTER TABLE ai_employees ADD COLUMN tags JSON",
}


def ensure_ai_employee_schema(engine) -> None:
    inspector = inspect(engine)
    if "ai_employees" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("ai_employees")}
    with engine.begin() as connection:
        for column_name, ddl in AI_EMPLOYEE_COLUMN_MIGRATIONS.items():
            if column_name not in existing_columns:
                connection.execute(text(ddl))

        connection.execute(text("UPDATE ai_employees SET status = COALESCE(status, 'active')"))
        connection.execute(text("UPDATE ai_employees SET access_scope = COALESCE(access_scope, 'org')"))
        connection.execute(text("UPDATE ai_employees SET access_teams = '[]' WHERE access_teams IS NULL"))
        connection.execute(text("UPDATE ai_employees SET source_type = COALESCE(source_type, 'native') WHERE source_type IS NULL OR source_type = ''"))
