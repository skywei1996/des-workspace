# -*- coding: utf-8 -*-
import requests
import json
import os
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

API_BASE = "http://localhost:8000/api/replenishment/functions"
PROJECT_ID = "0b1a25a9-f6b7-4f38-8007-38d4182e3e4a"
AS_OF_DATE = "2026-09-16"
REQUEST_ID = "replenishment-20260916183045-3f2d"

OUTPUT_DIR = r"D:\cursor\DES workspace - Copy\12.12 - 公司最终版本\workspace\generated\codex_3f2d060abf464aa98d1b7d268771f7a2"

# Target stores that have data in both sales and inventory
STORE_IDS = [f"ZJ-HUZ-{i:03d}" for i in range(1, 18)]

def call_api(endpoint, payload, step_label):
    url = f"{API_BASE}/{endpoint}"
    print(f"  -> POST {endpoint}")
    try:
        resp = requests.post(url, json=payload, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items", [])
        print(f"     total={data.get('total')}, returned={len(items)}, truncated={data.get('truncated')}")
        return data
    except requests.exceptions.RequestException as e:
        print(f"     ERROR: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"     Response: {e.response.text[:800]}")
        return None

print("=" * 70)
print("调补货执行流程 - 完整报告")
print(f"项目: {PROJECT_ID}")
print(f"截止日期: {AS_OF_DATE}")
print(f"请求编号: {REQUEST_ID}")
print(f"处理门店: {', '.join(STORE_IDS)}")
print("=" * 70)

# ========== STEP 1: 销售数据 ==========
print("\n[步骤1] 读取近14天销售数据")
step1 = call_api("sales-14d", {
    "project_id": PROJECT_ID,
    "store_ids": STORE_IDS,
    "as_of_date": AS_OF_DATE,
    "limit": 100000
}, "sales-14d")

if not step1:
    print("步骤1失败，终止")
    exit(1)
sales_items = step1.get("items", [])
print(f"  获取销售记录: {len(sales_items)} 条")

# ========== STEP 2: 库存快照 ==========
print("\n[步骤2] 读取库存快照")
step2 = call_api("inventory-snapshot", {
    "project_id": PROJECT_ID,
    "store_ids": STORE_IDS,
    "as_of_date": AS_OF_DATE,
    "limit": 100000
}, "inventory-snapshot")

if not step2:
    print("步骤2失败，终止")
    exit(1)
inventory_items = step2.get("items", [])
print(f"  获取库存记录: {len(inventory_items)} 条")

# ========== STEP 3: 可销售周数 ==========
print("\n[步骤3] 计算可销售周数 (Weeks of Supply)")
step3 = call_api("weeks-of-supply", {
    "project_id": PROJECT_ID,
    "store_ids": STORE_IDS,
    "as_of_date": AS_OF_DATE,
    "limit": 100000,
    "sales_items": sales_items,
    "inventory_items": inventory_items
}, "weeks-of-supply")

if not step3:
    print("步骤3失败，终止")
    exit(1)
wos_items = step3.get("items", [])
print(f"  可销售周数记录: {len(wos_items)} 条")

# ========== STEP 4: 调拨决策 ==========
print("\n[步骤4] 生成调拨决策")
step4 = call_api("transfer-decision", {
    "project_id": PROJECT_ID,
    "store_ids": STORE_IDS,
    "as_of_date": AS_OF_DATE,
    "limit": 100000,
    "items": wos_items
}, "transfer-decision")

if not step4:
    print("步骤4失败，终止")
    exit(1)
decision_items = step4.get("items", [])
print(f"  决策记录: {len(decision_items)} 条")

# Summarize decisions
decisions = {}
for item in decision_items:
    d = item.get("decision", "unknown")
    decisions[d] = decisions.get(d, 0) + 1
print(f"  决策分布: {json.dumps(decisions, ensure_ascii=False)}")

# ========== STEP 5: 调货数量和审批标记 ==========
print("\n[步骤5] 计算调货数量和审批标记")
step5 = call_api("transfer-quantity", {
    "project_id": PROJECT_ID,
    "store_ids": STORE_IDS,
    "as_of_date": AS_OF_DATE,
    "limit": 100000,
    "items": decision_items
}, "transfer-quantity")

if not step5:
    print("步骤5失败，终止")
    exit(1)
qty_items = step5.get("items", [])
summary = step5.get("summary", {})
print(f"  数量记录: {len(qty_items)} 条")
print(f"  摘要: {json.dumps(summary, ensure_ascii=False)}")

# ========== STEP 6: 生成待执行项 ==========
print("\n[步骤6] 生成待执行项 (writeback_items)")
writeback_items = []
for item in qty_items:
    decision = item.get("decision")
    if decision == "inbound":
        qty = item.get("inbound_quantity", 0)
        if qty and qty > 0:
            writeback_items.append({
                "store_id": item["store_id"],
                "sku_id": item["sku_id"],
                "direction": "inbound",
                "quantity": int(qty)
            })
    elif decision == "outbound":
        qty = item.get("outbound_quantity", 0)
        if qty and qty > 0:
            writeback_items.append({
                "store_id": item["store_id"],
                "sku_id": item["sku_id"],
                "direction": "outbound",
                "quantity": int(qty)
            })

print(f"  待执行调补货项: {len(writeback_items)} 条")

# ========== STEP 7: 判断审批 ==========
print("\n[步骤7] 判断是否需要人工审批")
approval_required_count = summary.get("approval_required_count", 0)
approval_required = approval_required_count > 0

if approval_required:
    print(f"  需要人工审批! (approval_required_count={approval_required_count})")
    print("  展示审批方案给用户...")
else:
    print("  无需人工审批，继续执行")

# ========== STEP 8: 处理人工决定 (模拟) ==========
if approval_required:
    print("\n[步骤8] 展示审批方案")
    print(f"  request_id: {REQUEST_ID}")
    print(f"  project_id: {PROJECT_ID}")
    print(f"  总项数: {summary.get('total_items', len(writeback_items))}")
    print(f"  总调入量: {summary.get('total_inbound_quantity', 0)}")
    print(f"  总调出量: {summary.get('total_outbound_quantity', 0)}")
    print(f"  需审批项: {approval_required_count}")
    print("  等待用户审批...")

# ========== STEP 9: 写入Excel ==========
print("\n[步骤9] 生成Excel报告")

# Merge all data for Excel
excel_rows = []
for item in qty_items:
    row = {
        "store_id": item.get("store_id", ""),
        "sku_id": item.get("sku_id", ""),
        "decision": item.get("decision", ""),
        "decision_reason": item.get("decision_reason", ""),
        "weeks_of_supply": item.get("weeks_of_supply"),
        "qty_on_hand": item.get("qty_on_hand", 0),
        "qty_available": item.get("qty_available", 0),
        "sales_14d": item.get("sales_14d", 0),
        "sales_7d": item.get("sales_7d", 0),
        "average_weekly_sales": item.get("average_weekly_sales", 0),
        "inbound_quantity": item.get("inbound_quantity", 0),
        "outbound_quantity": item.get("outbound_quantity", 0),
        "approval_required": item.get("approval_required", False),
    }
    excel_rows.append(row)

print(f"  Excel数据行数: {len(excel_rows)}")

# Create Excel workbook
wb = openpyxl.Workbook()

# Sheet 1: 完整明细
ws1 = wb.active
ws1.title = "调补货明细"

header_font = Font(name="微软雅黑", bold=True, size=11, color="FFFFFF")
header_fill = PatternFill(start_color="2F5496", end_color="2F5496", fill_type="solid")
header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
cell_font = Font(name="微软雅黑", size=10)
cell_align = Alignment(horizontal="center", vertical="center")
thin_border = Border(
    left=Side(style="thin"), right=Side(style="thin"),
    top=Side(style="thin"), bottom=Side(style="thin")
)

# Inbound fill (green)
inbound_fill = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")
outbound_fill = PatternFill(start_color="FCE4EC", end_color="FCE4EC", fill_type="solid")

headers = [
    "门店ID", "SKU编码", "决策方向", "决策原因",
    "可销售周数(WOS)", "现有库存", "可用库存",
    "近14天销量", "近7天销量", "周均销量",
    "建议调入量", "建议调出量", "需审批"
]

for col_idx, header in enumerate(headers, 1):
    cell = ws1.cell(row=1, column=col_idx, value=header)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = header_align
    cell.border = thin_border

for row_idx, row_data in enumerate(excel_rows, 2):
    values = [
        row_data["store_id"], row_data["sku_id"], row_data["decision"], row_data["decision_reason"],
        row_data["weeks_of_supply"] if row_data["weeks_of_supply"] is not None else "",
        row_data["qty_on_hand"], row_data["qty_available"],
        row_data["sales_14d"], row_data["sales_7d"], row_data["average_weekly_sales"],
        row_data["inbound_quantity"], row_data["outbound_quantity"],
        "是" if row_data["approval_required"] else "否"
    ]
    for col_idx, val in enumerate(values, 1):
        cell = ws1.cell(row=row_idx, column=col_idx, value=val)
        cell.font = cell_font
        cell.alignment = cell_align
        cell.border = thin_border
    # Color rows by decision
    if row_data["decision"] == "inbound":
        for col_idx in range(1, len(headers) + 1):
            ws1.cell(row=row_idx, column=col_idx).fill = inbound_fill
    elif row_data["decision"] == "outbound":
        for col_idx in range(1, len(headers) + 1):
            ws1.cell(row=row_idx, column=col_idx).fill = outbound_fill

# Set column widths
col_widths = [14, 18, 12, 30, 14, 12, 12, 12, 12, 12, 12, 12, 10]
for i, w in enumerate(col_widths, 1):
    ws1.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w

# Freeze top row
ws1.freeze_panes = "A2"

# Sheet 2: 摘要统计
ws2 = wb.create_sheet("决策汇总")
inbound_count = sum(1 for r in excel_rows if r["decision"] == "inbound")
outbound_count = sum(1 for r in excel_rows if r["decision"] == "outbound")
undetermined_count = sum(1 for r in excel_rows if r["decision"] == "undetermined")
total_inbound_qty = sum(r["inbound_quantity"] for r in excel_rows)
total_outbound_qty = sum(r["outbound_quantity"] for r in excel_rows)
total_approval = sum(1 for r in excel_rows if r["approval_required"])

summary_headers = ["指标", "数值"]
summary_data = [
    ("处理门店数", 17),
    ("总SKU-门店组合数", len(excel_rows)),
    ("调入(inbound)项数", inbound_count),
    ("调出(outbound)项数", outbound_count),
    ("待判断(undetermined)项数", undetermined_count),
    ("建议调入总量", int(total_inbound_qty)),
    ("建议调出总量", int(total_outbound_qty)),
    ("需人工审批项数", total_approval),
]

for col_idx, h in enumerate(summary_headers, 1):
    cell = ws2.cell(row=1, column=col_idx, value=h)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = header_align
    cell.border = thin_border

for r_idx, (label, val) in enumerate(summary_data, 2):
    ws2.cell(row=r_idx, column=1, value=label).font = cell_font
    ws2.cell(row=r_idx, column=1).border = thin_border
    ws2.cell(row=r_idx, column=2, value=val).font = cell_font
    ws2.cell(row=r_idx, column=2).border = thin_border
    ws2.cell(row=r_idx, column=2).alignment = cell_align

ws2.column_dimensions["A"].width = 30
ws2.column_dimensions["B"].width = 15

# Sheet 3: 待执行项
ws3 = wb.create_sheet("待执行调补货项")
if writeback_items:
    wb_headers = ["门店ID", "SKU编码", "方向", "数量"]
    for col_idx, h in enumerate(wb_headers, 1):
        cell = ws3.cell(row=1, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border
    for r_idx, item in enumerate(writeback_items, 2):
        ws3.cell(row=r_idx, column=1, value=item["store_id"]).font = cell_font
        ws3.cell(row=r_idx, column=1).border = thin_border
        ws3.cell(row=r_idx, column=2, value=item["sku_id"]).font = cell_font
        ws3.cell(row=r_idx, column=2).border = thin_border
        ws3.cell(row=r_idx, column=3, value=item["direction"]).font = cell_font
        ws3.cell(row=r_idx, column=3).border = thin_border
        ws3.cell(row=r_idx, column=4, value=item["quantity"]).font = cell_font
        ws3.cell(row=r_idx, column=4).border = thin_border
        ws3.cell(row=r_idx, column=4).alignment = cell_align
        # Color
        fill = inbound_fill if item["direction"] == "inbound" else outbound_fill
        for c in range(1, 5):
            ws3.cell(row=r_idx, column=c).fill = fill

ws3.column_dimensions["A"].width = 14
ws3.column_dimensions["B"].width = 18
ws3.column_dimensions["C"].width = 10
ws3.column_dimensions["D"].width = 10

# Save
output_path = os.path.join(OUTPUT_DIR, "调补货执行报告.xlsx")
wb.save(output_path)
print(f"\n  Excel报告已保存: {output_path}")

# Final summary
print("\n" + "=" * 70)
print("执行完成!")
print(f"  处理门店: 17 (ZJ-HUZ-001 ~ ZJ-HUZ-017)")
print(f"  总SKU-门店组合: {len(excel_rows)}")
print(f"  调入建议: {inbound_count} 项, 共 {int(total_inbound_qty)} 件")
print(f"  调出建议: {outbound_count} 项, 共 {int(total_outbound_qty)} 件")
print(f"  待判断: {undetermined_count} 项")
print(f"  需审批: {total_approval} 项")
print(f"  待执行调补货: {len(writeback_items)} 项")
if writeback_items:
    print(f"\n  注意: 由于存在需审批项 ({total_approval}条)，需您确认后才能执行库存写回")
print("=" * 70)
