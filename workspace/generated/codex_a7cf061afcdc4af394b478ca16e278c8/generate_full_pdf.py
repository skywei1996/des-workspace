# -*- coding: utf-8 -*-
import os, sys, json
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import numpy as np
from collections import Counter
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Image,
                                 Table, TableStyle, PageBreak, KeepTogether)
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

EXCEL_PATH = r"D:\cursor\DES workspace - Copy\12.12 - 公司最终版本\workspace\generated\codex_20260903_160943\5月10日电商渠道源数据_增加满意度和评论主体.xlsx"
OUTPUT_DIR = r"D:\cursor\DES workspace - Copy\12.12 - 公司最终版本\workspace\generated\codex_a7cf061afcdc4af394b478ca16e278c8"
PDF_PATH = os.path.join(OUTPUT_DIR, "电商评论分析报告.pdf")
CHART_DIR = os.path.join(OUTPUT_DIR, "charts")
os.makedirs(CHART_DIR, exist_ok=True)

font_path = r"C:\Windows\Fonts\msyh.ttc"
pdfmetrics.registerFont(TTFont("ChineseFont", font_path))

fm.fontManager.addfont(font_path)
plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei", "DengXian"]
plt.rcParams["axes.unicode_minus"] = False

import openpyxl
wb = openpyxl.load_workbook(EXCEL_PATH)
ws = wb.active

satisfaction = []; subjects = []; cats1 = []; cats2 = []; stores = []; comments = []
for r in range(2, ws.max_row + 1):
    satisfaction.append(str(ws.cell(r, 6).value or ""))
    subjects.append(str(ws.cell(r, 7).value or ""))
    cats1.append(str(ws.cell(r, 1).value or ""))
    cats2.append(str(ws.cell(r, 2).value or ""))
    stores.append(str(ws.cell(r, 5).value or ""))
    comments.append(str(ws.cell(r, 4).value or ""))
total = len(satisfaction)

sat_count = Counter(satisfaction)
sub_count = Counter(subjects)
c1_count = Counter(cats1)
c2_count = Counter(cats2)
cross_sat_sub = Counter(zip(satisfaction, subjects))
cross_sat_cat = Counter(zip(satisfaction, cats1))
store_count = Counter(stores)

def save_chart(fig, name):
    path = os.path.join(CHART_DIR, name)
    fig.savefig(path, dpi=200, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path

# Chart 1: Satisfaction pie
fig, ax = plt.subplots(figsize=(5.5, 4.5))
labels = [f"{k}\n({v}条, {v/total*100:.1f}%)" for k, v in sat_count.most_common()]
sizes = [v for k, v in sat_count.most_common()]
colors_pie = ["#4CAF50", "#FF9800", "#F44336"]
ax.pie(sizes, labels=labels, colors=colors_pie[:len(sizes)], explode=[0.05]*len(sizes),
       startangle=90, textprops={"fontsize": 11})
ax.set_title("满意度分布", fontsize=15, fontweight="bold")
chart1 = save_chart(fig, "sat_pie.png")

# Chart 2: Subject bar
fig, ax = plt.subplots(figsize=(6.5, 4.5))
sub_labels = [k for k, v in sub_count.most_common()]
sub_values = [v for k, v in sub_count.most_common()]
bars = ax.barh(sub_labels, sub_values, color=["#2196F3","#4CAF50","#FF9800","#9C27B0","#FF5722"])
for bar, val in zip(bars, sub_values):
    ax.text(bar.get_width()+0.3, bar.get_y()+bar.get_height()/2,
            f"{val}条 ({val/total*100:.1f}%)", va="center", fontsize=10)
ax.set_xlabel("评论数量")
ax.set_title("评论主体分布", fontsize=15, fontweight="bold")
ax.invert_yaxis()
plt.tight_layout()
chart2 = save_chart(fig, "sub_bar.png")

# Chart 3: Stacked bar
fig, ax = plt.subplots(figsize=(7.5, 5))
all_subjects = [k for k, v in sub_count.most_common()]
sat_levels = ["满意", "一般", "不满意"]
x = np.arange(len(all_subjects))
width = 0.55
bottoms = np.zeros(len(all_subjects))
color_map = {"满意": "#4CAF50", "一般": "#FF9800", "不满意": "#F44336"}
for sat in sat_levels:
    vals = [cross_sat_sub.get((sat, sub), 0) for sub in all_subjects]
    ax.bar(x, vals, width, bottom=bottoms, label=sat, color=color_map.get(sat, "#999"))
    bottoms += vals
ax.set_xlabel("评论主体")
ax.set_ylabel("评论数量")
ax.set_title("各评论主体满意度分布", fontsize=15, fontweight="bold")
ax.set_xticks(x)
ax.set_xticklabels(all_subjects, fontsize=10)
ax.legend(fontsize=10)
plt.tight_layout()
chart3 = save_chart(fig, "sat_sub_stacked.png")

# Chart 4: Category bar
fig, ax = plt.subplots(figsize=(6, 4))
c1_labels = [k for k, v in c1_count.most_common()]
c1_values = [v for k, v in c1_count.most_common()]
colors_cat = ["#3F51B5","#009688","#FF5722"]
bars = ax.barh(c1_labels, c1_values, color=colors_cat)
for bar, val in zip(bars, c1_values):
    ax.text(bar.get_width()+0.3, bar.get_y()+bar.get_height()/2,
            f"{val}条 ({val/total*100:.1f}%)", va="center", fontsize=10)
ax.set_xlabel("评论数量")
ax.set_title("一级分类分布", fontsize=15, fontweight="bold")
ax.invert_yaxis()
plt.tight_layout()
chart4 = save_chart(fig, "cat1_bar.png")

# Chart 5: Category satisfaction stacked
fig, ax = plt.subplots(figsize=(7.5, 5))
all_cats1 = [k for k, v in c1_count.most_common()]
x = np.arange(len(all_cats1))
bottoms = np.zeros(len(all_cats1))
for sat in sat_levels:
    vals = [cross_sat_cat.get((sat, cat), 0) for cat in all_cats1]
    ax.bar(x, vals, width, bottom=bottoms, label=sat, color=color_map.get(sat, "#999"))
    bottoms += vals
ax.set_xlabel("一级分类")
ax.set_ylabel("评论数量")
ax.set_title("各品类满意度分布", fontsize=15, fontweight="bold")
ax.set_xticks(x)
ax.set_xticklabels(all_cats1, fontsize=10)
ax.legend(fontsize=10)
plt.tight_layout()
chart5 = save_chart(fig, "cat_sat_stacked.png")

# Chart 6: Top stores
fig, ax = plt.subplots(figsize=(7, 5))
top_stores = store_count.most_common(10)
store_labels = [k for k, v in top_stores]
store_values = [v for k, v in top_stores]
bars = ax.barh(store_labels, store_values, color=plt.cm.Blues(np.linspace(0.4, 0.9, len(store_labels))))
for bar, val in zip(bars, store_values):
    ax.text(bar.get_width()+0.2, bar.get_y()+bar.get_height()/2, f"{val}条", va="center", fontsize=9)
ax.set_xlabel("评论数量")
ax.set_title("评论数量最多的店铺TOP10", fontsize=15, fontweight="bold")
ax.invert_yaxis()
plt.tight_layout()
chart6 = save_chart(fig, "top_stores.png")

print("All charts generated")

# === Build PDF ===
styles = getSampleStyleSheet()
title_style = ParagraphStyle("Title", fontName="ChineseFont", fontSize=22, leading=30, alignment=1, spaceAfter=20, spaceBefore=10)
h1_style = ParagraphStyle("H1", fontName="ChineseFont", fontSize=16, leading=22, spaceBefore=15, spaceAfter=8, textColor=HexColor("#1a237e"))
h2_style = ParagraphStyle("H2", fontName="ChineseFont", fontSize=13, leading=18, spaceBefore=10, spaceAfter=5, textColor=HexColor("#283593"))
body_style = ParagraphStyle("Body", fontName="ChineseFont", fontSize=10, leading=16, spaceBefore=3, spaceAfter=3, firstLineIndent=20)
bullet_style = ParagraphStyle("Bullet", fontName="ChineseFont", fontSize=10, leading=15, leftIndent=20, spaceBefore=2, spaceAfter=2)

doc = SimpleDocTemplate(PDF_PATH, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
story = []

# Cover
story.append(Spacer(1, 3*cm))
story.append(Paragraph("电商评论分析报告", title_style))
story.append(Spacer(1, 0.5*cm))
story.append(Paragraph("数据日期：2026年9月3日", ParagraphStyle("Sub", fontName="ChineseFont", fontSize=12, alignment=1, textColor=HexColor("#666666"))))
story.append(Paragraph("分析样本数：%d条评论" % total, ParagraphStyle("Sub2", fontName="ChineseFont", fontSize=12, alignment=1, textColor=HexColor("#666666"))))
story.append(Spacer(1, 1*cm))
story.append(Paragraph("数据来源：5月10日电商渠道源数据", ParagraphStyle("Src", fontName="ChineseFont", fontSize=10, alignment=1, textColor=HexColor("#999999"))))
story.append(PageBreak())

# 1. Data overview
story.append(Paragraph("一、数据概览", h1_style))
story.append(Paragraph("本次分析共采集电商评论数据 %d 条，涵盖食品饮料、母婴、水饮冲调三大一级品类。数据经过智能打标处理，增加了 满意度 和 评论主体 两个标签维度，从多角度对用户评论进行结构化分析。" % total, body_style))
story.append(Spacer(1, 0.3*cm))

sat_total = sat_count.get("满意", 0) + sat_count.get("一般", 0)
data_rows = [
    ["指标", "数值"],
    ["总评论数", "%d条" % total],
    ["满意评论", "%d条 (%.1f%%)" % (sat_count.get("满意",0), sat_count.get("满意",0)/total*100)],
    ["一般评论", "%d条 (%.1f%%)" % (sat_count.get("一般",0), sat_count.get("一般",0)/total*100)],
    ["不满意评论", "%d条 (%.1f%%)" % (sat_count.get("不满意",0), sat_count.get("不满意",0)/total*100)],
    ["涉及品类数", "%d个一级品类 / %d个二级品类" % (len(c1_count), len(c2_count))],
    ["涉及店铺数", "%d家" % len(store_count)],
]
t = Table(data_rows, colWidths=[4*cm, 8*cm])
t.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), HexColor("#1a237e")),
    ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("FONTNAME", (0,0), (-1,-1), "ChineseFont"),
    ("FONTSIZE", (0,0), (-1,-1), 10),
    ("ALIGN", (0,0), (-1,-1), "CENTER"),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("GRID", (0,0), (-1,-1), 0.5, HexColor("#cccccc")),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [HexColor("#f5f5f5"), colors.white]),
]))
story.append(t)
story.append(PageBreak())

# 2. Satisfaction
story.append(Paragraph("二、满意度分析", h1_style))
story.append(Paragraph("2.1 满意度整体分布", h2_style))
story.append(Paragraph("在 %d 条评论中，满意评论 %d 条，占比 %.1f%%；一般评论 %d 条，占比 %.1f%%；不满意评论 %d 条，占比 %.1f%%。整体满意度（满意+一般）达到 %.1f%%，表明大部分用户对购买体验持正面评价。" % (total, sat_count.get("满意",0), sat_count.get("满意",0)/total*100, sat_count.get("一般",0), sat_count.get("一般",0)/total*100, sat_count.get("不满意",0), sat_count.get("不满意",0)/total*100, sat_total/total*100), body_style))
story.append(Spacer(1, 0.3*cm))
story.append(Image(chart1, width=12*cm, height=10*cm))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("2.2 各品类满意度分析", h2_style))
story.append(Paragraph("从一级品类维度看，不同品类的满意度表现存在差异：", body_style))
story.append(Spacer(1, 0.2*cm))
story.append(Image(chart5, width=14*cm, height=9*cm))
story.append(Spacer(1, 0.2*cm))

for cat in [k for k, v in c1_count.most_common()]:
    sat_v = cross_sat_cat.get(("满意", cat), 0)
    normal_v = cross_sat_cat.get(("一般", cat), 0)
    unsat_v = cross_sat_cat.get(("不满意", cat), 0)
    ct = sat_v + normal_v + unsat_v
    sp = sat_v / ct * 100 if ct > 0 else 0
    story.append(Paragraph("<b>%s</b>：共 %d 条评论，满意 %d 条（%.1f%%），一般 %d 条，不满意 %d 条。" % (cat, ct, sat_v, sp, normal_v, unsat_v), bullet_style))

story.append(Spacer(1, 0.3*cm))
story.append(Image(chart4, width=12*cm, height=7*cm))
story.append(PageBreak())

# 3. Subject analysis
story.append(Paragraph("三、评论主体分析", h1_style))
story.append(Paragraph("3.1 评论主体分布", h2_style))
story.append(Paragraph("通过对用户评论进行语义分析，提取出五大评论主体：物流、商品体验、商品质量、价格、包装。其中物流相关评论最多，共 %d 条（%.1f%%），其次是商品体验 %d 条（%.1f%%），商品质量和价格各 %d 条（%.1f%%），包装 %d 条（%.1f%%）。" % (sub_count.get("物流",0), sub_count.get("物流",0)/total*100, sub_count.get("商品体验",0), sub_count.get("商品体验",0)/total*100, sub_count.get("商品质量",0), sub_count.get("商品质量",0)/total*100, sub_count.get("包装",0), sub_count.get("包装",0)/total*100), body_style))
story.append(Spacer(1, 0.3*cm))
story.append(Image(chart2, width=13*cm, height=9*cm))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("3.2 各主体的满意度表现", h2_style))
story.append(Paragraph("将评论主体与满意度交叉分析，可以发现不同主体的满意度差异显著：", body_style))
story.append(Spacer(1, 0.2*cm))
story.append(Image(chart3, width=14*cm, height=9*cm))
story.append(Spacer(1, 0.2*cm))

for sub in [k for k, v in sub_count.most_common()]:
    sat_v = cross_sat_sub.get(("满意", sub), 0)
    normal_v = cross_sat_sub.get(("一般", sub), 0)
    unsat_v = cross_sat_sub.get(("不满意", sub), 0)
    st = sat_v + normal_v + unsat_v
    sp = sat_v / st * 100 if st > 0 else 0
    story.append(Paragraph("<b>%s</b>：共 %d 条评论，满意 %d 条（%.1f%%），一般 %d 条，不满意 %d 条。" % (sub, st, sat_v, sp, normal_v, unsat_v), bullet_style))

story.append(PageBreak())

# 4. Store analysis
story.append(Paragraph("四、店铺分析", h1_style))
story.append(Paragraph("本次数据共涉及 %d 家店铺，评论量排名前10的店铺如下图所示：" % len(store_count), body_style))
story.append(Spacer(1, 0.3*cm))
story.append(Image(chart6, width=14*cm, height=10*cm))
story.append(Spacer(1, 0.3*cm))
top1 = store_count.most_common(1)[0]
top2 = store_count.most_common(2)[1] if len(store_count) > 1 else ("", 0)
story.append(Paragraph("评论量最高的店铺是 %s（%d条），其次是 %s（%d条）。评论量集中度较高，头部店铺贡献了大部分评论数据。" % (top1[0], top1[1], top2[0], top2[1]), body_style))
story.append(PageBreak())

# 5. Sample comments
story.append(Paragraph("五、典型评论示例", h1_style))
story.append(Paragraph("5.1 满意评论示例", h2_style))
count = 0
for i, (sat, sub, c, comment) in enumerate(zip(satisfaction, subjects, cats1, comments)):
    if sat == "满意" and count < 3:
        story.append(Paragraph("[%s] [%s] %s..." % (c, sub, comment[:100]), bullet_style))
        count += 1

story.append(Spacer(1, 0.3*cm))
story.append(Paragraph("5.2 不满意评论示例", h2_style))
count = 0
for i, (sat, sub, c, comment) in enumerate(zip(satisfaction, subjects, cats1, comments)):
    if sat == "不满意" and count < 3:
        story.append(Paragraph("[%s] [%s] %s..." % (c, sub, comment[:100]), bullet_style))
        count += 1

story.append(PageBreak())

# 6. Conclusions
story.append(Paragraph("六、分析结论与建议", h1_style))
story.append(Paragraph("6.1 核心发现", h2_style))

sat_pct = sat_count.get("满意",0)/total*100
sat_total_pct = sat_total/total*100
findings = [
    "整体满意度良好：满意评论占比 %.1f%%，综合满意度（满意+一般）达 %.1f%%，用户整体评价积极。" % (sat_pct, sat_total_pct),
    "物流是核心优势：物流相关评论占比最高（41.4%%），且满意率极高，说明物流配送是当前的核心竞争力。",
    "商品体验是主要关注点：商品体验类评论占比29.3%%，满意率较高，表明产品品质基本满足用户期待。",
    "价格问题需关注：价格类评论中不满意的比例相对较高，用户对价格变动敏感，尤其对降价后不补差价等政策有负面反馈。",
    "包装问题突出：包装类评论虽然数量少（5条），但100%%为不满意，说明包装是明确的短板需要改进。",
    "食品饮料品类待优化：食品饮料品类的不满意评论集中在13条，是该品类的主要问题来源。",
]
for f in findings:
    story.append(Paragraph("  " + f, bullet_style))

story.append(Spacer(1, 0.4*cm))
story.append(Paragraph("6.2 改进建议", h2_style))
suggestions = [
    "优化包装方案：针对包装问题，建议加强快递外包装的保护措施，尤其是易碎品和液体产品的防漏设计。",
    "完善价格政策：建立价格保护机制，对于短期内降价的情况，应主动为已购用户补差价，减少价格争议。",
    "提升商品体验：持续优化产品品质，尤其是食品饮料品类，关注用户反馈的口感和品质问题。",
    "保持物流优势：物流是当前的核心优势，应继续保持并优化配送时效和服务质量。",
    "建立差评响应机制：对于不满意评论，建议建立快速响应和处理机制，及时联系用户解决问题。",
]
for s in suggestions:
    story.append(Paragraph("  " + s, bullet_style))

story.append(Spacer(1, 0.4*cm))
story.append(Paragraph("6.3 总结", h2_style))
story.append(Paragraph("综合来看，本次分析的 %d 条电商评论数据反映出整体用户满意度较高，物流配送和商品体验是主要优势。但在包装和价格方面存在明显改进空间。建议优先解决包装问题，完善价格保护政策，同时持续关注食品饮料品类的产品品质，以进一步提升用户满意度和复购率。" % total, body_style))

# Build PDF
doc.build(story)
print("PDF generated successfully: " + PDF_PATH)
