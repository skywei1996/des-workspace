import requests

data = {
    "name": "Nova",
    "role_title": "数据分析师",
    "avatar_url": "",
    "persona_prompt": "You are a data analyst.",
    "knowledge_ids": [],
    "database_ids": [],
    "tool_ids": [],
    "workflow_ids": [],
    "action_guide": []
}

try:
    response = requests.post('http://localhost:8000/ai-employees/', json=data)
    if response.status_code == 200:
        print("Successfully added employee Nova.")
    else:
        print(f"Error adding employee: {response.status_code} - {response.text}")
except Exception as e:
    print(f"Connection failed: {e}")
