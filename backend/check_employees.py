import requests

try:
    response = requests.get('http://localhost:8000/ai-employees/')
    if response.status_code == 200:
        employees = response.json()
        print(f"Found {len(employees)} employees.")
        for emp in employees:
            print(f"- {emp['name']} ({emp['role_title']})")
    else:
        print(f"Error: {response.status_code} - {response.text}")
except Exception as e:
    print(f"Connection failed: {e}")
