import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Image, 
                                 Table, TableStyle, PageBreak)
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from collections import Counter, defaultdict
import os, openpyxl

# Register Chinese font
pdfmetrics.registerFont(TTFont('DengXian', 'C:/Windows/Fonts/Deng.ttf'))

# Read data
wb = openpyxl.load_workbook(r'D:\cursor\DES workspace - Copy\12.12 - 公司最终版本\workspace\generated\codex_664980d70cc6463c9aee4a30dcf619f9\5月10日电商渠道带标签数据.xlsx')
ws = wb.active
headers = [cell.value for cell in ws[1]]
data = []
for row in ws.iter_rows(min_row=2, values_only=True):
    d = dict(zip(headers, row))
    data.append(d)

# Analysis
total = len(data)
sat_dist = Counter(d['满意度'] for d in data)
subj_dist = Counter(d['评论主体'] for d in data)
cat1_dist = Counter(d['一级分类'] for d in data)
store_dist = Counter(d['店铺'] for d in data)
cat_sat = defaultdict(lambda: Counter())
for d in data:
    cat_sat[d['一级分类']][d['满意度']] += 1
cat_subj = defaultdict(lambda: Counter())
for d in data:
    cat_subj[d['一级分类']][d['评论主体']] += 1

pos = sat_dist.get('正面', 0)
neg = sat_dist.get('负面', 0)
neu = sat_dist.get('中性', 0)
pos_rate = pos / total * 100
neg_rate = neg / total * 100
neu_rate = neu / total * 100

out_dir = r'D:\cursor\DES workspace - Copy\12.12 - 公司最终版本\workspace\generated\codex_f4003222129747e6a42da5e4d79f8578'
chart_dir = out_dir
pdf_path = os.path.join(out_dir, 'report.pdf')

# Styles
title_style = ParagraphStyle('T', fontName='DengXian', fontSize=22, leading=30, alignment=TA_CENTER, spaceAfter=12)
h1 = ParagraphStyle('H1', fontName='DengXian', fontSize=16, leading=24, spaceBefore=16, spaceAfter=8, textColor=HexColor('#1a237e'))
h2 = ParagraphStyle('H2', fontName='DengXian', fontSize=13, leading=18, spaceBefore=12, spaceAfter=6, textColor=HexColor('#283593'))
body = ParagraphStyle('B', fontName='DengXian', fontSize=10, leading=16, spaceAfter=6, alignment=TA_JUSTIFY)
sub = ParagraphStyle('S', fontName='DengXian', fontSize=14, leading=20, alignment=TA_CENTER, textColor=HexColor('#666666'))
abs_style = ParagraphStyle('A', fontName='DengXian', fontSize=11, leading=18, alignment=TA_CENTER, textColor=HexColor('#555555'))

doc = SimpleDocTemplate(pdf_path, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm, leftMargin=2.5*cm, rightMargin=2.5*cm)
elements = []

# Cover
elements.append(Spacer(1, 3*cm))
elements.append(Paragraph('电商评论数据分析报告', title_style))
elements.append(Spacer(1, 0.5*cm))
elements.append(Paragraph('满意度与评论主体标注分析', sub))
elements.append(Spacer(1, 1.5*cm))
elements.append(Paragraph('数据来源: 5月10日电商渠道源数据', body))
elements.append(Paragraph('数据总量: ' + str(total) + ' 条评论', body))
elements.append(Paragraph('分析日期: 2026年9月3日', body))
elements.append(Spacer(1, 2*cm))
elements.append(Paragraph('--- 报告摘要 ---', abs_style))
elements.append(Spacer(1, 0.3*cm))
abstract = ('本报告基于' + str(total) + '条电商平台用户评论数据，从满意度、评论主体、商品品类、店铺维度进行全面分析。'
    + '整体满意度正面率为' + f'{pos_rate:.1f}%，负面率为{neg_rate:.1f}%，中性率为{neu_rate:.1f}%。'
    + '评论覆盖食品饮料、母婴、水饮冲调三大品类，涉及多家店铺。'
    + '报告通过可视化图表和数据分析，揭示了用户关注的核心维度、各品类的表现差异以及潜在改进方向，为产品优化和运营决策提供数据支撑。')
elements.append(Paragraph(abstract, body))
elements.append(PageBreak())

# 1. Overview
elements.append(Paragraph('一、数据概览', h1))
elements.append(Spacer(1, 0.2*cm))
summary_data = [
    ['指标', '数值'],
    ['评论总数', str(total)], ['正面评论数', str(pos)], ['负面评论数', str(neg)],
    ['中性评论数', str(neu)], ['正面率', f'{pos_rate:.1f}%'], ['负面率', f'{neg_rate:.1f}%'],
    ['覆盖品类数', str(len(cat1_dist))], ['覆盖店铺数', str(len(store_dist))],
]
st = Table(summary_data, colWidths=[6*cm, 6*cm])
st.setStyle(TableStyle([
    ('FONTNAME', (0,0), (-1,-1), 'DengXian'), ('FONTSIZE', (0,0), (-1,-1), 10),
    ('BACKGROUND', (0,0), (-1,0), HexColor('#1a237e')), ('TEXTCOLOR', (0,0), (-1,0), HexColor('#ffffff')),
    ('ALIGN', (0,0), (-1,-1), 'CENTER'), ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('GRID', (0,0), (-1,-1), 0.5, HexColor('#cccccc')),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#f5f5f5'), HexColor('#ffffff')]),
    ('TOPPADDING', (0,0), (-1,-1), 4), ('BOTTOMPADDING', (0,0), (-1,-1), 4),
]))
elements.append(st)
elements.append(Spacer(1, 0.5*cm))
elements.append(Paragraph('本次分析共收集' + str(total) + '条有效用户评论，来自' + str(len(store_dist))
    + '家店铺，覆盖' + str(len(cat1_dist)) + '个一级品类。整体正面评论占比' + f'{pos_rate:.1f}%，'
    + '说明大部分用户对购买体验较为满意；负面评论占比' + f'{neg_rate:.1f}%，需重点关注；中性评论占比{neu_rate:.1f}%。', body))
elements.append(PageBreak())

# 2. Satisfaction
elements.append(Paragraph('二、满意度分析', h1))
elements.append(Spacer(1, 0.2*cm))
elements.append(Image(os.path.join(chart_dir, 'chart1_satisfaction.png'), width=12*cm, height=10*cm))
elements.append(Spacer(1, 0.3*cm))
elements.append(Paragraph('2.1 满意度分布解读', h2))
elements.append(Paragraph('正面评论(' + str(pos) + '条，' + f'{pos_rate:.1f}%)占据绝对主导地位，'
    + '表明用户对电商平台的整体购物体验持积极态度。负面评论(' + str(neg) + '条，' + f'{neg_rate:.1f}%)'
    + '和中性评论(' + str(neu) + '条，' + f'{neu_rate:.1f}%)合计占比约{(neg_rate+neu_rate):.1f}%，'
    + '这部分用户反馈是改进优化的重点方向。', body))
elements.append(Paragraph('2.2 各品类满意度差异', h2))
elements.append(Image(os.path.join(chart_dir, 'chart4_cat_sat.png'), width=14*cm, height=7*cm))
elements.append(Spacer(1, 0.3*cm))
for cat in ['母婴', '食品饮料', '水饮冲调']:
    p = cat_sat[cat].get('正面', 0)
    n = cat_sat[cat].get('负面', 0)
    ne = cat_sat[cat].get('中性', 0)
    tc = p + n + ne
    pr = p/tc*100 if tc > 0 else 0
    elements.append(Paragraph(cat + '：共' + str(tc) + '条评论，正面' + f'{pr:.1f}%，负面{n}条，中性{ne}条。', body))
neg_food = cat_sat['食品饮料'].get('负面', 0)
elements.append(Paragraph('从品类来看，<b>母婴类</b>正面率最高，用户满意度表现优异；'
    + '<b>食品饮料类</b>负面评论相对集中（' + str(neg_food) + '条），建议重点关注该品类的产品品质和用户体验改善。', body))
elements.append(PageBreak())

# 3. Comment Subject
elements.append(Paragraph('三、评论主体分析', h1))
elements.append(Spacer(1, 0.2*cm))
elements.append(Image(os.path.join(chart_dir, 'chart2_subject.png'), width=14*cm, height=7*cm))
elements.append(Spacer(1, 0.3*cm))
elements.append(Paragraph('3.1 用户关注焦点', h2))
for i, (subj, cnt) in enumerate(subj_dist.most_common(5), 1):
    elements.append(Paragraph(str(i) + '. ' + subj + '：' + str(cnt) + '条（' + f'{cnt/total*100:.1f}%）', body))
logistics_cnt = subj_dist.get('物流/包装/商品质量', 0)
other_cnt = subj_dist.get('其他', 0)
logistics_taste = subj_dist.get('物流/包装/口感味道', 0)
elements.append(Paragraph('用户评论最关注的维度是<b>物流/包装/商品质量</b>（' + str(logistics_cnt)
    + '条），其次是<b>其他</b>综合类（' + str(other_cnt) + '条）和<b>物流/包装/口感味道</b>（'
    + str(logistics_taste) + '条）。物流和包装是用户提及频率最高的关键词，说明配送体验直接影响用户满意度。', body))
elements.append(Paragraph('3.2 品类与评论主体交叉分析', h2))
for cat in ['母婴', '食品饮料', '水饮冲调']:
    if cat in cat_subj:
        top = cat_subj[cat].most_common(3)
        subjects_str = '、'.join([s[0] + '(' + str(s[1]) + '条)' for s in top])
        elements.append(Paragraph('<b>' + cat + '</b>：用户最关注 ' + subjects_str, body))
elements.append(PageBreak())

# 4. Category
elements.append(Paragraph('四、品类分布分析', h1))
elements.append(Spacer(1, 0.2*cm))
elements.append(Image(os.path.join(chart_dir, 'chart3_category.png'), width=12*cm, height=8*cm))
elements.append(Spacer(1, 0.3*cm))
food_cnt = cat1_dist.get('食品饮料', 0)
baby_cnt = cat1_dist.get('母婴', 0)
drink_cnt = cat1_dist.get('水饮冲调', 0)
elements.append(Paragraph('评论数据覆盖三大品类：<b>食品饮料</b>（' + str(food_cnt) + '条，'
    + f'{food_cnt/total*100:.1f}%）、<b>母婴</b>（' + str(baby_cnt) + '条，{baby_cnt/total*100:.1f}%）和'
    + '<b>水饮冲调</b>（' + str(drink_cnt) + '条，{drink_cnt/total*100:.1f}%）。'
    + '食品饮料品类评论量最大，是用户反馈最丰富的品类。', body))
elements.append(PageBreak())

# 5. Store
elements.append(Paragraph('五、店铺维度分析', h1))
elements.append(Spacer(1, 0.2*cm))
elements.append(Image(os.path.join(chart_dir, 'chart5_stores.png'), width=12*cm, height=8*cm))
elements.append(Spacer(1, 0.3*cm))
elements.append(Paragraph('5.1 店铺评论量排名', h2))
top10_stores = store_dist.most_common(10)
store_table_data = [['排名', '店铺名称', '评论数', '占比']]
for i, (store, cnt) in enumerate(top10_stores, 1):
    pct = cnt/total*100
    store_name = store if len(store) <= 20 else store[:18]+'...'
    store_table_data.append([str(i), store_name, str(cnt), f'{pct:.1f}%'])
st2 = Table(store_table_data, colWidths=[1.5*cm, 7*cm, 2.5*cm, 2*cm])
st2.setStyle(TableStyle([
    ('FONTNAME', (0,0), (-1,-1), 'DengXian'), ('FONTSIZE', (0,0), (-1,-1), 9),
    ('BACKGROUND', (0,0), (-1,0), HexColor('#1a237e')), ('TEXTCOLOR', (0,0), (-1,0), HexColor('#ffffff')),
    ('ALIGN', (0,0), (-1,-1), 'CENTER'), ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('GRID', (0,0), (-1,-1), 0.5, HexColor('#cccccc')),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#f5f5f5'), HexColor('#ffffff')]),
    ('TOPPADDING', (0,0), (-1,-1), 3), ('BOTTOMPADDING', (0,0), (-1,-1), 3),
]))
elements.append(st2)
elements.append(Spacer(1, 0.3*cm))
top3 = sum(s[1] for s in top10_stores[:3])
top3_pct = top3/total*100
elements.append(Paragraph('评论量排名前3的店铺为：<b>' + top10_stores[0][0] + '</b>（' + str(top10_stores[0][1])
    + '条）、<b>' + top10_stores[1][0] + '</b>（' + str(top10_stores[1][1]) + '条）、<b>'
    + top10_stores[2][0] + '</b>（' + str(top10_stores[2][1]) + '条）。'
    + '这些店铺是用户反馈的主要来源，建议作为重点运营和监控对象。', body))
elements.append(PageBreak())

# 6. Conclusions
elements.append(Paragraph('六、结论与建议', h1))
elements.append(Spacer(1, 0.2*cm))
elements.append(Paragraph('6.1 核心发现', h2))
findings = [
    '整体满意度良好：正面评论占比' + f'{pos_rate:.1f}%，用户对电商购物体验整体满意。',
    '物流包装是核心关注点：用户评论中最常提及的主题是物流/包装/商品质量，物流体验直接影响满意度。',
    '食品饮料品类需重点关注：该品类负面评论最多（' + str(neg_food) + '条），是优化的重点方向。',
    '母婴品类表现最佳：正面率最高，用户满意度综合评价最好。',
    '头部店铺集中度高：Top 3店铺评论量占总量的' + f'{top3_pct:.1f}%，需重点维护。',
]
for i, f in enumerate(findings, 1):
    elements.append(Paragraph(str(i) + '. ' + f, body))
elements.append(Spacer(1, 0.5*cm))
elements.append(Paragraph('6.2 改进建议', h2))
suggestions = [
    '优化物流配送体验：加强包装防护、提升配送时效，特别是在食品饮料品类中减少运输破损问题。',
    '关注负面评论反馈：建立负面评论快速响应机制，对食品饮料品类中' + str(neg_food) + '条负面评论逐一分析原因并改进。',
    '提升中性评论转化：' + f'{neu_rate:.1f}%的中性评论是潜在改进空间，可针对性地回访和跟进。',
    '强化优势品类运营：母婴品类正面率表现优异，可将其成功经验复制到其他品类。',
    '头部店铺深度合作：与评论量大的店铺加强合作，收集更多用户反馈，持续优化产品和服务。',
]
for i, s in enumerate(suggestions, 1):
    elements.append(Paragraph(str(i) + '. ' + s, body))
elements.append(Spacer(1, 0.5*cm))
elements.append(Paragraph('6.3 总结', h2))
elements.append(Paragraph('本次对' + str(total) + '条电商评论数据的分析表明，整体用户满意度较高（正面率'
    + f'{pos_rate:.1f}%），物流包装和商品质量是用户最关注的核心维度。'
    + '食品饮料品类作为评论量最大的品类，其负面评论也相对集中，是后续优化的重点。'
    + '母婴品类表现优异，可作为标杆案例进行经验推广。'
    + '建议运营团队结合本报告结论，制定针对性的品类优化方案和店铺运营策略，持续提升用户满意度。', body))

doc.build(elements)
print('OK:' + pdf_path)
print('Size:' + str(os.path.getsize(pdf_path)))
