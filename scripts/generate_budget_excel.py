from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter


output_path = r"d:\cursor\DES workspace - Copy\12.12 - 公司最终版本\workspace\AI_Workmate_项目预算成本清单.xlsx"

wb = Workbook()
ws = wb.active
ws.title = "成本清单"

red = "B00000"
light_red = "FBEAEA"
dark_blue = "24127A"
gray = "F4F4F4"
border_color = "E8CACA"

thin = Side(style="thin", color=border_color)
border = Border(left=thin, right=thin, top=thin, bottom=thin)

ws.merge_cells("A1:F1")
ws["A1"] = "AI Workmate 项目预算成本清单"
ws["A1"].font = Font(name="Microsoft YaHei", size=16, bold=True, color="222222")
ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
ws.row_dimensions[1].height = 30

ws.merge_cells("A2:F2")
ws["A2"] = "说明：测试与魏巍按同一资源项合并统计；人力按 910 人天、8 小时/人天、平均 IPSA 小时成本 182.94 元测算。"
ws["A2"].font = Font(name="Microsoft YaHei", size=10, color="666666")
ws["A2"].alignment = Alignment(horizontal="left", vertical="center")

headers = ["成本类别", "资源/口径", "计算公式", "金额（元）", "金额（万元）", "备注"]
for col, header in enumerate(headers, start=1):
    cell = ws.cell(row=4, column=col, value=header)
    cell.fill = PatternFill("solid", fgColor=red)
    cell.font = Font(name="Microsoft YaHei", size=11, bold=True, color="FFFFFF")
    cell.alignment = Alignment(horizontal="center", vertical="center")
    cell.border = border

rows = [
    ["人力资源成本", "测试/魏巍（合并）；910 人天；182.94 元/小时", "182.94 × 910 × 8", 1331836.8, 133.18368, "按项目团队组织架构投入资源测算"],
    ["Agent 服务器成本", "3 台；6 个月；2,000 元/台/月", "2000 × 3 × 6", 36000, 3.6, "支撑 Agent 服务运行"],
    ["模型训练/推理服务器成本", "2 台；6 个月；5,000 元/台/月", "5000 × 2 × 6", 60000, 6.0, "支撑模型训练、推理和验证"],
    ["现场项目差旅成本", "产品研发资源支持现场项目", "固定估算", 50000, 5.0, "现场交付、调研、支持等差旅费用"],
    ["项目费用小计", "服务器 + 差旅", "36000 + 60000 + 50000", 146000, 14.6, "不含人力资源成本"],
    ["项目预算合计", "人力资源成本 + 项目费用", "1331836.8 + 146000", 1477836.8, 147.78368, "建议按 148 万元申请"],
]

for row_index, row in enumerate(rows, start=5):
    for col_index, value in enumerate(row, start=1):
        cell = ws.cell(row=row_index, column=col_index, value=value)
        cell.border = border
        cell.font = Font(name="Microsoft YaHei", size=10, bold=(row_index in [9, 10]))
        cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
        if row_index % 2 == 0:
            cell.fill = PatternFill("solid", fgColor="FFFAFA")
        if row_index in [9, 10]:
            cell.fill = PatternFill("solid", fgColor=light_red)
        if col_index in [4, 5]:
            cell.number_format = '#,##0.00'
            cell.alignment = Alignment(horizontal="right", vertical="center")

ws.merge_cells("A13:F13")
ws["A13"] = "汇报口径"
ws["A13"].fill = PatternFill("solid", fgColor=gray)
ws["A13"].font = Font(name="Microsoft YaHei", size=12, bold=True, color=red)
ws["A13"].alignment = Alignment(horizontal="left", vertical="center")

ws.merge_cells("A14:F15")
ws["A14"] = (
    "本项目预算由人力资源成本和项目费用两部分构成。"
    "人力资源成本按 910 人天、平均 IPSA 小时成本 182.94 元、每日 8 小时测算，合计约 133.18 万元；"
    "项目费用包含 Agent 服务器、模型训练/推理服务器及现场差旅支持，合计 14.6 万元。"
    "项目预算总额约 147.78 万元，建议按 148 万元申请。"
)
ws["A14"].font = Font(name="Microsoft YaHei", size=10, color="333333")
ws["A14"].alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
ws["A14"].border = border

widths = [22, 36, 28, 16, 16, 36]
for index, width in enumerate(widths, start=1):
    ws.column_dimensions[get_column_letter(index)].width = width

for row in range(4, 11):
    ws.row_dimensions[row].height = 32
ws.row_dimensions[14].height = 45

ws.freeze_panes = "A5"

summary = wb.create_sheet("预算汇总")
summary.append(["项目", "金额（万元）"])
summary.append(["人力资源成本", 133.18368])
summary.append(["项目费用", 14.6])
summary.append(["项目预算合计", 147.78368])
for row in summary.iter_rows(min_row=1, max_row=4, min_col=1, max_col=2):
    for cell in row:
        cell.font = Font(name="Microsoft YaHei", size=11, bold=(cell.row == 1 or cell.row == 4))
        cell.border = border
        cell.alignment = Alignment(horizontal="left", vertical="center")
        if cell.row == 1:
            cell.fill = PatternFill("solid", fgColor=red)
            cell.font = Font(name="Microsoft YaHei", size=11, bold=True, color="FFFFFF")
        elif cell.row == 4:
            cell.fill = PatternFill("solid", fgColor=light_red)
        if cell.column == 2:
            cell.number_format = '#,##0.00'
            cell.alignment = Alignment(horizontal="right", vertical="center")
summary.column_dimensions["A"].width = 24
summary.column_dimensions["B"].width = 18

wb.save(output_path)
print(output_path)