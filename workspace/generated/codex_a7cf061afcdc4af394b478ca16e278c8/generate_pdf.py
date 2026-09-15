# -*- coding: utf-8 -*-
import os, sys
import matplotlib
matplotlib.use('Agg')
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

# === CONFIG ===
EXCEL_PATH = r'D:\\cursor\\DES workspace - Copy\\12.12 - 公司最终版本\\workspace\\generated\\codex_20260903_160943\\5月10日电商渠道源数据_增加满意度和评论主体.xlsx'
OUTPUT_DIR = r'D:\\cursor\\DES workspace - Copy\\12.12 - 公司最终版本\\workspace\\generated\\codex_a7cf061afcdc4af394b478ca16e278c8'
PDF_PATH = os.path.join(OUTPUT_DIR, '电商评论分析报告.pdf')
CHART_DIR = os.path.join(OUTPUT_DIR, 'charts')
os.makedirs(CHART_DIR, exist_ok=True)

# === Register Chinese font for reportlab ===
# Try to find a suitable TTF font
font_paths = [
    r'C:\\Windows\\Fonts\\msyh.ttc',
    r'C:\\Windows\\Fonts\\simhei.ttf',
    r'C:\\Windows\\Fonts\\simsun.ttc',
    r'C:\\Windows\\Fonts\\deng.ttf',
]
font_registered = False
for fp in font_paths:
    if os.path.exists(fp):
        try:
            pdfmetrics.registerFont(TTFont('ChineseFont', fp))
            font_registered = True
            print(f'Registered font: {fp}')
            break
        except:
            pass

if not font_registered:
    # Fallback: try to find any Chinese font
    import glob
    for pattern in ['msyh*', 'simhei*', 'simsun*', 'deng*', 'yakei*', 'yahei*']:
        for fp in glob.glob(os.path.join(r'C:\\Windows\\Fonts', pattern)):
            if os.path.exists(fp):
                try:
                    pdfmetrics.registerFont(TTFont('ChineseFont', fp))
                    font_registered = True
                    print(f'Registered fallback font: {fp}')
                    break
                except:
                    pass
        if font_registered:
            break

if not font_registered:
    print('WARNING: No Chinese font found for reportlab!')
    # Use Helvetica as fallback
    from reportlab.pdfbase.pdfmetrics import registerFont
    # This will fail for Chinese text but we try anyway

# === Set matplotlib Chinese font ===
fm.fontManager.addfont(r'C:\\Windows\\Fonts\\msyh.ttc')
plt.rcParams['font.sans-serif'] = ['Microsoft YaHei', 'SimHei', 'DengXian']
plt.rcParams['axes.unicode_minus'] = False

# === Read Excel ===
import openpyxl
wb = openpyxl.load_workbook(EXCEL_PATH)
ws = wb.active

satisfaction = []
subjects = []
cats1 = []
cats2 = []
stores = []
comments = []

for r in range(2, ws.max_row + 1):
    satisfaction.append(str(ws.cell(r, 6).value or ''))
    subjects.append(str(ws.cell(r, 7).value or ''))
    cats1.append(str(ws.cell(r, 1).value or ''))
    cats2.append(str(ws.cell(r, 2).value or ''))
    stores.append(str(ws.cell(r, 5).value or ''))
    comments.append(str(ws.cell(r, 4).value or ''))

total = len(satisfaction)

# === Generate Charts ===
def save_chart(fig, name):
    path = os.path.join(CHART_DIR, name)
    fig.savefig(path, dpi=200, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return path

# Chart 1: Satisfaction distribution (pie)
fig, ax = plt.subplots(figsize=(5, 4))
sat_count = Counter(satisfaction)
labels = [f'{k}\n({v}条, {v/total*100:.1f}%)' for k, v in sat_count.most_common()]
sizes = [v for k, v in sat_count.most_common()]
colors_pie = ['#4CAF50', '#FF9800', '#F44336']
explode = [0.05] * len(sizes)
ax.pie(sizes, labels=labels, colors=colors_pie[:len(sizes)], explode=explode,
       startangle=90, textprops={'fontsize': 10})
ax.set_title('满意度分布', fontsize=14, fontweight='bold')
chart1 = save_chart(fig, 'satisfaction_pie.png')

# Chart 2: Comment subjects distribution (bar)
fig, ax = plt.subplots(figsize=(6, 4))
sub_count = Counter(subjects)
sub_labels = [k for k, v in sub_count.most_common()]
sub_values = [v for k, v in sub_count.most_common()]
bars = ax.barh(sub_labels, sub_values, color=['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#FF5722'])
for bar, val in zip(bars, sub_values):
    ax.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height()/2,
            f'{val}条 ({val/total*100:.1f}%)', va='center', fontsize=9)
ax.set_xlabel('评论数量')
ax.set_title('评论主体分布', fontsize=14, fontweight='bold')
ax.invert_yaxis()
chart2 = save_chart(fig, 'subject_bar.png')

# Chart 3: Satisfaction x Subject (stacked bar)
fig, ax = plt.subplots(figsize=(7, 4))
cross = Counter(zip(satisfaction, subjects))
all_subjects = [k for k, v in sub_count.most_common()]
sat_levels = ['满意', '一般', '不满意']
x = np.arange(len(all_subjects))
width = 0.55
bottoms = np.zeros(len(all_subjects))
color_map = {'满意': '#4CAF50', '一般': '#FF9800', '不满意': '#F44336'}
for sat in sat_levels:
    vals = [cross.get((sat, sub), 0) for sub in all_subjects]
    bars = ax.bar(x, vals, width, bottom=bottoms, label=sat, color=color_map.get(sat, '#999'))
    bottoms += vals
ax.set_xlabel('评论主体')
ax.set_ylabel('评论数量')
ax.set_title('各评论主体满意度分布', fontsize=14, fontweight='bold')
ax.set_xticks(x)
ax.set_xticklabels(all_subjects, fontsize=10)
ax.legend()
chart3 = save_chart(fig, 'satisfaction_subject_stacked.png')

# Chart 4: Category 1 distribution (horizontal bar)
fig, ax = plt.subplots(figsize=(6, 3.5))
c1_count = Counter(cats1)
c1_labels = [k for k, v in c1_count.most_common()]
c1_values = [v for k, v in c1_count.most_common()]
bars = ax.barh(c1_labels, c1_values, color=['#3F51B5', '#009688', '#FF5722'])
for bar, val in zip(bars, c1_values):
    ax.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height()/2,
            f'{val}条 ({val/total*100:.1f}%)', va='center', fontsize=9)
ax.set_xlabel('评论数量')
ax.set_title('一级分类分布', fontsize=14, fontweight='bold')
ax.invert_yaxis()
chart4 = save_chart(fig, 'category1_bar.png')

# Chart 5: Satisfaction x Category 1
fig, ax = plt.subplots(figsize=(7, 4))
cross_cat = Counter(zip(satisfaction, cats1))
all_cats1 = [k for k, v in c1_count.most_common()]
x = np.arange(len(all_cats1))
width = 0.55
bottoms = np.zeros(len(all_cats1))
for sat in sat_levels:
    vals = [cross_cat.get((sat, cat), 0) for cat in all_cats1]
    bars = ax.bar(x, vals, width, bottom=bottoms, label=sat, color=color_map.get(sat, '#999'))
    bottoms += vals
ax.set_xlabel('一级分类')
ax.set_ylabel('评论数量')
ax.set_title('各品类满意度分布', fontsize=14, fontweight='bold')
ax.set_xticks(x)
ax.set_xticklabels(all_cats1, fontsize=10)
ax.legend()
chart5 = save_chart(fig, 'category_satisfaction_stacked.png')

print('Charts generated successfully')
print(f'Total records: {total}')
print(f'Satisfaction: {dict(sat_count.most_common())}')
print(f'Subjects: {dict(sub_count.most_common())}')
