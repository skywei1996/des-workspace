import sqlite3, json

conn = sqlite3.connect("sql_app.db")
cur = conn.cursor()

print("=== AI Employees ===")
cur.execute("SELECT id, name, tool_ids FROM ai_employees")
rows = cur.fetchall()
for r in rows:
    print(f"  ID={r[0]}, name={r[1]}, tool_ids={r[2]}")

print("\n=== Skill Registry Entries ===")
cur.execute("SELECT id, skill_key, name, source, skill_type, enabled FROM skill_registry_entries")
rows2 = cur.fetchall()
for r in rows2:
    print(f"  ID={r[0]}, skill_key={r[1]}, name={r[2]}, source={r[3]}, type={r[4]}, enabled={r[5]}")

conn.close()
