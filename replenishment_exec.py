import requests
import json
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

API_BASE = "http://localhost:8000/api/replenishment/functions"
PROJECT_ID = "0b1a25a9-f6b7-4f38-8007-38d4182e3e4a"
AS_OF_DATE = "2026-09-16"
REQUEST_ID = f"replenishment-20260916183045-3f2d"

def call_api(endpoint, payload, step_name):
    print(f"\n{'='*60}")
    print(f"【{step_name}】调用 {endpoint}...")
    url = f"{API_BASE}/{endpoint}"
    try:
        resp = requests.post(url, json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items", [])
        truncated = data.get("truncated", False)
        summary = data.get("summary", {})
        print(f"  返回: total={data.get('total')}, returned={len(items)}, truncated={truncated}")
        if summary:
            print(f"  摘要: {json.dumps(summary, ensure_ascii=False)}")
        return data
    except requests.exceptions.RequestException as e:
        print(f"  错误: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"  响应: {e.response.text[:500]}")
        return None

# Step 1: Get sales data for all stores (but it's truncated at 100k)
# Let's first get a list of store IDs by querying with limit=1 per store approach
# Instead, let's get the sales data with limit=100000 and note the truncation

step1_data = call_api("sales-14d", {
    "project_id": PROJECT_ID, "store_ids": [], "as_of_date": AS_OF_DATE, "limit": 100000
}, "第1步-读取近14天销售数据")

if not step1_data:
    print("步骤1失败，终止")
    exit(1)

sales_items = step1_data.get("items", [])
print(f"\n销售数据获取完成，共 {step1_data['total']} 条记录，本批次获取 {len(sales_items)} 条")
print(f"覆盖门店数: {len(set(i['store_id'] for i in sales_items))}")

# Step 2: Get inventory snapshot
step2_data = call_api("inventory-snapshot", {
    "project_id": PROJECT_ID, "store_ids": [], "as_of_date": AS_OF_DATE, "limit": 100000
}, "第2步-读取库存快照")

if not step2_data:
    print("步骤2失败，终止")
    exit(1)

inventory_items = step2_data.get("items", [])
print(f"\n库存快照获取完成，共 {step2_data['total']} 条记录，本批次获取 {len(inventory_items)} 条")
print(f"覆盖门店数: {len(set(i['store_id'] for i in inventory_items))}")

