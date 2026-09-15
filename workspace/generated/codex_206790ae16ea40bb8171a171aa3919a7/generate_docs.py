import os, sys

out_dir = r"D:\cursor\DES workspace - Copy\12.12 - 公司最终版本\workspace\generated\codex_206790ae16ea40bb8171a171aa3919a7"

title = "Ontology（本体网络）中国企业落地调研报告"
subtitle = "调研时间：2026年9月11日 | 数据来源：公开网络信息"

summary_text = (
    "Ontology（本体网络）是一个高性能、支持多链的公有链平台，专注于去中心化身份（DID）和数据管理。"
    "自2017年创立以来，Ontology 在中国市场与多家知名企业和政府机构展开了深度合作，"
    "覆盖政务、金融、汽车、教育等多个行业领域。本报告汇总了 Ontology 在中国企业落地的主要项目与合作案例。"
)

enterprises = [
    {"name": "万达网络科技集团", "tag": "战略合作", "desc": "双方签署战略合作协议，共同推进区块链技术在实体产业中的应用。万达采用 Ontology 的分布式身份解决方案 ONT ID 进行用户身份管理，同时在万达广场积分体系中探索区块链存证和积分通兑方案。合作时间：2018年。"},
    {"name": "复星集团 (Fosun)", "tag": "金融科技", "desc": "复星旗下复星金服与 Ontology 达成合作，基于 Ontology 区块链技术构建金融科技服务平台。利用 ONT ID 进行 KYC 认证和企业数字身份管理，探索供应链金融领域的区块链应用，提升风控和数据安全能力。合作时间：2018年。"},
    {"name": "戴姆勒/奔驰 (Daimler/Mercedes-Benz)", "tag": "汽车出行", "desc": "戴姆勒与 Ontology 合作发布 Welcome Home 和 MoveX 平台，ONT ID 赋能车载数字身份管理，实现车主身份认证、车辆数据授权共享和出行服务一体化。是国际车企在中国落地的首个区块链数字身份项目。合作时间：2020年。"},
    {"name": "世纪互联 (21Vianet)", "tag": "基础设施", "desc": "世纪互联与 Ontology 在区块链基础设施层面展开合作，提供节点部署和托管服务，共同建设 Ontology 的中国区节点生态，推动企业级区块链应用的网络稳定性和合规性。"},
    {"name": "中央财经大学", "tag": "教育", "desc": "中央财经大学与 Ontology 合作建设校园区块链，利用 Ontology 技术进行学历证书存证、学术成果确权和校园数字身份管理，是 Ontology 在高校教育领域的重要落地案例。"},
    {"name": "工信部 (MIIT)", "tag": "政府/标准", "desc": "Ontology 入选工信部区块链开源项目计划（2018年），参与中国区块链技术与产业发展论坛的标准制定工作，推动中国区块链技术标准体系建设。"},
    {"name": "红杉中国 (Sequoia Capital China)", "tag": "投资/生态", "desc": "Ontology 获得红杉中国等顶级风险投资机构的战略投资。红杉中国持续支持 Ontology 的企业级区块链生态建设，帮助其拓展中国市场合作网络。"},
    {"name": "NEO", "tag": "技术生态", "desc": "Ontology 与 NEO 共同建设开放跨链平台，双方在技术标准、代码贡献和社区建设方面保持紧密合作。2021年联合发布跨链互操作协议，推动下一代互联网基础设施建设。"},
    {"name": "腾讯云", "tag": "云服务", "desc": "腾讯云区块链服务与 Ontology 开展技术对接与合作，ONT ID 在腾讯云生态中被集成，为腾讯云企业用户提供去中心化数字身份解决方案。"},
    {"name": "中国电子技术标准化研究院", "tag": "标准/合规", "desc": "Ontology 参与中国区块链标准制定工作，与中国电子技术标准化研究院在区块链参考架构、智能合约安全标准等方面进行合作，推动行业规范化发展。"},
]

products = [
    ("ONT ID", "去中心化数字身份解决方案，用户掌控个人数据和隐私", "创建量超过 100万"),
    ("ONTO 钱包", "管理数字资产、身份和连接的 Web3 自托管钱包", "全球广泛使用"),
    ("DDXF", "分布式数据交换和协作框架，安全透明传输交换数据", "企业级商用"),
    ("Wing Finance", "基于 Ontology 的跨链 DeFi 借贷平台", "Ontology 主网头部 DApp"),
    ("OScore", "信用评分系统，基于链上数据的去中心化信用评估", "生态内应用"),
    ("Ontology EVM", "兼容以太坊 EVM，支持 Solidity 智能合约部署", "多 VM 支持"),
]

timeline_items = [
    ("2017", "Ontology 主网上线", "由李俊创始团队发起，获得红杉中国等投资"),
    ("2018", "工信部开源项目 & 万达合作", "入选工信部计划，与万达网络科技集团战略合作"),
    ("2018", "复星金服合作", "基于 ONT ID 构建金融科技服务平台"),
    ("2019", "中央财经大学合作", "校园区块链落地，学历证书存证"),
    ("2020.06", "与 NEO 共建跨链平台", "共同推动下一代互联网基础设施"),
    ("2020.09", "戴姆勒（Daimler）合作", "Welcome Home 和 MoveX 平台发布，ONT ID 赋能车载数字身份"),
    ("2024", "1000万美元 DID 基金启动", "推动去中心化身份技术教育、采用和创新"),
    ("2024-2026", "持续发展", "ONT ID 突破100万，多 VM 支持，深化企业级 DID 和数据解决方案"),
]

conclusion_lines = [
    "Ontology（本体网络）自2017年创立以来，在中国市场取得了多维度、多行业的企业落地成果：",
    "政府层面：入选工信部区块链开源项目计划，参与国家区块链标准制定；",
    "企业层面：与万达网络、复星金服、世纪互联等企业合作，推动产业区块链落地；",
    "国际层面：与戴姆勒（奔驰）等跨国企业合作开发基于 DID 的出行解决方案；",
    "教育层面：与中央财经大学共建校园链，探索学历证书链上存证；",
    "技术生态：获得红杉中国等一线 VC 支持，ONT ID 创建量超百万，主网稳定运行8年+。",
    "未来，随着去中心化身份（DID）、跨链互操作和 AI Agent 等技术的发展，Ontology 在中国企业级区块链和数字身份市场有望进一步扩大落地规模。",
]

note_text = (
    "说明：本报告数据来源于公开网络搜索信息，包括项目官网（ont.io）、新闻稿、行业报告及第三方分析。"
    "Ontology 作为中国最早的企业级公链项目之一，在去中心化身份（DID）和数据管理领域持续深耕。"
    "近年来，随着 AI 和大模型技术的融合，'本体（Ontology）'概念也在企业数据治理和 AI 语义层领域获得广泛关注，"
    "如 Palantir Foundry/AIP 的 Ontology 模式、Datablau AI 原生本体建模平台、亚信科技数智本体平台等，"
    "这代表了另一种'企业本体'的技术路线，与本报告聚焦的区块链项目 Ontology（ONT）是不同的概念。"
)

# ---- WORD DOCUMENT ----
print("Generating Word document...")
from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml

doc = Document()
for section in doc.sections:
    section.top_margin = Cm(2.5)
    section.bottom_margin = Cm(2.5)
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(2.5)

def add_heading_styled(text, level=1):
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.color.rgb = RGBColor(0x1a, 0x1a, 0x2e)
    return h

def add_body(text):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.size = Pt(10.5)
    run.font.name = '微软雅黑'
    r = run._element
    r.rPr.rFonts.set(qn('w:eastAsia'), '微软雅黑')
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.line_spacing = 1.5
    return p

# Title
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run(title)
run.font.size = Pt(22)
run.font.bold = True
run.font.color.rgb = RGBColor(0x1a, 0x1a, 0x2e)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run(subtitle)
run.font.size = Pt(10)
run.font.color.rgb = RGBColor(0x99, 0x99, 0x99)
doc.add_paragraph()

# Summary
add_heading_styled("报告摘要", 1)
add_body(summary_text)

# Stats
stats = [("企业合作", "10+"), ("行业覆盖", "6+"), ("ONT ID", "100万+"), ("主网运行", "8年+")]
table = doc.add_table(rows=2, cols=4)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.style = 'Light Grid Accent 1'
for i, (label, value) in enumerate(stats):
    table.cell(0, i).text = value
    for p in table.cell(0, i).paragraphs:
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for r in p.runs:
            r.font.size = Pt(18)
            r.font.bold = True
            r.font.color.rgb = RGBColor(0x66, 0x7e, 0xea)
    table.cell(1, i).text = label
    for p in table.cell(1, i).paragraphs:
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for r in p.runs:
            r.font.size = Pt(10)
            r.font.color.rgb = RGBColor(0x66, 0x66, 0x66)
doc.add_paragraph()

# Enterprises
add_heading_styled("一、企业落地合作项目", 1)
for i, e in enumerate(enterprises, 1):
    add_heading_styled(f"{i}. {e['name']}", 2)
    tag_p = doc.add_paragraph()
    tag_run = tag_p.add_run(f"[{e['tag']}]")
    tag_run.font.size = Pt(9)
    tag_run.font.bold = True
    tag_run.font.color.rgb = RGBColor(0x66, 0x7e, 0xea)
    tag_p.paragraph_format.space_after = Pt(2)
    add_body(e['desc'])

# Timeline
add_heading_styled("二、发展历程", 1)
for time_point, event_title, event_desc in timeline_items:
    p = doc.add_paragraph()
    run_time = p.add_run(f"{time_point}  ")
    run_time.font.bold = True
    run_time.font.size = Pt(10)
    run_time.font.color.rgb = RGBColor(0x66, 0x7e, 0xea)
    run_title = p.add_run(event_title)
    run_title.font.bold = True
    run_title.font.size = Pt(10.5)
    p.paragraph_format.space_after = Pt(2)
    add_body(event_desc)

# Products
add_heading_styled("三、生态产品矩阵", 1)
prod_table = doc.add_table(rows=1 + len(products), cols=3)
prod_table.style = 'Light Grid Accent 1'
prod_table.alignment = WD_TABLE_ALIGNMENT.CENTER
headers = ["产品", "说明", "落地数据"]
for j, h_text in enumerate(headers):
    cell = prod_table.cell(0, j)
    cell.text = h_text
    for p in cell.paragraphs:
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for r in p.runs:
            r.font.bold = True
            r.font.size = Pt(10)
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="667eea"/>')
    cell._tc.get_or_add_tcPr().append(shading)
for i, (prod_name, prod_desc, prod_data) in enumerate(products, 1):
    row = prod_table.rows[i]
    row.cells[0].text = prod_name
    row.cells[1].text = prod_desc
    row.cells[2].text = prod_data
    for cell in row.cells:
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(9.5)
doc.add_paragraph()

# Note
add_heading_styled("说明", 1)
note_p = doc.add_paragraph()
run = note_p.add_run(note_text)
run.font.size = Pt(9.5)
run.font.color.rgb = RGBColor(0x99, 0x88, 0x44)
note_p.paragraph_format.line_spacing = 1.5

# Conclusion
add_heading_styled("总结", 1)
for line in conclusion_lines:
    if line.strip():
        add_body(line.strip())

# Footer
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run("本报告由 AI 调研助手基于公开信息生成 | 数据截止日期：2026年9月")
run.font.size = Pt(9)
run.font.color.rgb = RGBColor(0x99, 0x99, 0x99)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run("信息来源：ont.io | CoinDesk | Medium | PRNewswire | 腾讯云 | 新华网 | CryptoSlate 等")
run.font.size = Pt(9)
run.font.color.rgb = RGBColor(0x99, 0x99, 0x99)

word_path = os.path.join(out_dir, "Ontology_China_Enterprise_Report.docx")
doc.save(word_path)
print(f"Word saved: {word_path}")

# ---- PDF DOCUMENT ----
print("Generating PDF document...")
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

font_path = "C:/Windows/Fonts/simhei.ttf"
pdfmetrics.registerFont(TTFont('SimHei', font_path))

FONT_NAME = 'SimHei'

style_title = ParagraphStyle('Title', fontName=FONT_NAME, fontSize=20, leading=28, alignment=TA_CENTER, spaceAfter=6, textColor=HexColor('#1a1a2e'))
style_subtitle = ParagraphStyle('Subtitle', fontName=FONT_NAME, fontSize=9, leading=13, alignment=TA_CENTER, spaceAfter=16, textColor=HexColor('#999999'))
style_h1 = ParagraphStyle('H1', fontName=FONT_NAME, fontSize=14, leading=20, spaceAfter=10, spaceBefore=14, textColor=HexColor('#1a1a2e'))
style_h2 = ParagraphStyle('H2', fontName=FONT_NAME, fontSize=11, leading=16, spaceAfter=6, spaceBefore=10, textColor=HexColor('#0f3460'))
style_body = ParagraphStyle('Body', fontName=FONT_NAME, fontSize=9.5, leading=16, spaceAfter=8, alignment=TA_JUSTIFY, textColor=HexColor('#333333'))
style_tag = ParagraphStyle('Tag', fontName=FONT_NAME, fontSize=8, leading=12, spaceAfter=2, textColor=HexColor('#667eea'))
style_note = ParagraphStyle('Note', fontName=FONT_NAME, fontSize=8.5, leading=14, spaceAfter=8, textColor=HexColor('#996600'), leftIndent=10, rightIndent=10, borderWidth=0.5, borderColor=HexColor('#ffc107'), borderPadding=6, backColor=HexColor('#fffde7'))
style_footer = ParagraphStyle('Footer', fontName=FONT_NAME, fontSize=8, leading=12, alignment=TA_CENTER, textColor=HexColor('#999999'))
style_stat_val = ParagraphStyle('StatVal', fontName=FONT_NAME, fontSize=16, leading=22, alignment=TA_CENTER, textColor=HexColor('#667eea'))
style_stat_lbl = ParagraphStyle('StatLbl', fontName=FONT_NAME, fontSize=9, leading=13, alignment=TA_CENTER, textColor=HexColor('#666666'))

pdf_path = os.path.join(out_dir, "Ontology_China_Enterprise_Report.pdf")
doc_pdf = SimpleDocTemplate(pdf_path, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm, leftMargin=2.5*cm, rightMargin=2.5*cm)
elements = []

elements.append(Paragraph(title, style_title))
elements.append(Paragraph(subtitle, style_subtitle))
elements.append(Spacer(1, 6))

elements.append(Paragraph("报告摘要", style_h1))
elements.append(Paragraph(summary_text, style_body))
elements.append(Spacer(1, 6))

stat_data = [
    [Paragraph("10+", style_stat_val), Paragraph("6+", style_stat_val), Paragraph("100万+", style_stat_val), Paragraph("8年+", style_stat_val)],
    [Paragraph("企业合作", style_stat_lbl), Paragraph("行业覆盖", style_stat_lbl), Paragraph("ONT ID 创建", style_stat_lbl), Paragraph("主网运行", style_stat_lbl)],
]
stat_tbl = Table(stat_data, colWidths=[4.5*cm]*4)
stat_tbl.setStyle(TableStyle([
    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('BOX', (0,0), (-1,-1), 0.5, HexColor('#ddd')),
    ('INNERGRID', (0,0), (-1,-1), 0.5, HexColor('#ddd')),
    ('TOPPADDING', (0,0), (-1,-1), 6),
    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
]))
elements.append(stat_tbl)
elements.append(Spacer(1, 14))

elements.append(Paragraph("一、企业落地合作项目", style_h1))
for i, e in enumerate(enterprises, 1):
    items = []
    items.append(Paragraph(f"{i}. {e['name']}", style_h2))
    items.append(Paragraph(f"[{e['tag']}]", style_tag))
    items.append(Paragraph(e['desc'], style_body))
    items.append(Spacer(1, 4))
    elements.append(KeepTogether(items))

elements.append(Paragraph("二、发展历程", style_h1))
for time_point, event_title, event_desc in timeline_items:
    p_text = f'<font color="#667eea"><b>{time_point}</b></font>  <b>{event_title}</b>'
    elements.append(Paragraph(p_text, style_body))
    elements.append(Paragraph(event_desc, ParagraphStyle('td', fontName=FONT_NAME, leftIndent=12, fontSize=9, leading=14, spaceAfter=4)))
    elements.append(Spacer(1, 2))

elements.append(Paragraph("三、生态产品矩阵", style_h1))
prod_data = [
    [Paragraph('<b>产品</b>', ParagraphStyle('th', fontName=FONT_NAME, fontSize=9, textColor=HexColor('#fff'), alignment=TA_CENTER)),
     Paragraph('<b>说明</b>', ParagraphStyle('th', fontName=FONT_NAME, fontSize=9, textColor=HexColor('#fff'), alignment=TA_CENTER)),
     Paragraph('<b>落地数据</b>', ParagraphStyle('th', fontName=FONT_NAME, fontSize=9, textColor=HexColor('#fff'), alignment=TA_CENTER))]
]
for prod_name, prod_desc, prod_data_val in products:
    prod_data.append([
        Paragraph(prod_name, ParagraphStyle('c1', fontName=FONT_NAME, fontSize=9, alignment=TA_CENTER)),
        Paragraph(prod_desc, ParagraphStyle('c2', fontName=FONT_NAME, fontSize=8.5)),
        Paragraph(prod_data_val, ParagraphStyle('c3', fontName=FONT_NAME, fontSize=9, alignment=TA_CENTER)),
    ])
prod_tbl = Table(prod_data, colWidths=[3*cm, 8*cm, 5*cm])
prod_tbl.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), HexColor('#667eea')),
    ('TEXTCOLOR', (0,0), (-1,0), HexColor('#ffffff')),
    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('FONTNAME', (0,0), (-1,-1), FONT_NAME),
    ('GRID', (0,0), (-1,-1), 0.5, HexColor('#dddddd')),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#f8f9ff'), HexColor('#ffffff')]),
    ('TOPPADDING', (0,0), (-1,-1), 6),
    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ('LEFTPADDING', (0,0), (-1,-1), 8),
    ('RIGHTPADDING', (0,0), (-1,-1), 8),
]))
elements.append(prod_tbl)
elements.append(Spacer(1, 12))

elements.append(Paragraph("说明", style_h1))
elements.append(Paragraph(note_text, style_note))
elements.append(Spacer(1, 6))

elements.append(Paragraph("总结", style_h1))
for line in conclusion_lines:
    if line.strip():
        elements.append(Paragraph(line.strip(), style_body))

elements.append(Spacer(1, 20))
elements.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#cccccc')))
elements.append(Spacer(1, 8))
elements.append(Paragraph("本报告由 AI 调研助手基于公开信息生成 | 数据截止日期：2026年9月", style_footer))
elements.append(Paragraph("信息来源：ont.io | CoinDesk | Medium | PRNewswire | 腾讯云 | 新华网 | CryptoSlate 等", style_footer))

doc_pdf.build(elements)
print(f"PDF saved: {pdf_path}")
print("Done! Both documents generated successfully.")
