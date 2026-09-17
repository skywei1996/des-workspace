import requests, json
url = 'http://localhost:8000/api/replenishment/functions/sales-14d'
payload = {'project_id': '0b1a25a9-f6b7-4f38-8007-38d4182e3e4a', 'store_ids': [], 'as_of_date': '2026-09-16', 'limit': 10}
resp = requests.post(url, json=payload, timeout=30)
data = resp.json()
print(json.dumps({"total": data["total"], "stores": data["summary"]["stores"], "truncated": data.get("truncated")}, ensure_ascii=False))
