import math
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1920, 1080
img = Image.new('RGB', (W, H), (245, 247, 250))
draw = ImageDraw.Draw(img)

font_path = r'C:\Windows\Fonts\msyh.ttc'
font_bold_path = r'C:\Windows\Fonts\msyhbd.ttc'

def getfont(size, bold=False):
    try:
        p = font_bold_path if bold else font_path
        return ImageFont.truetype(p, size)
    except:
        return ImageFont.load_default()

# Colors
BG_LAYER = (255, 255, 255)
BORDER_LAYER = (200, 210, 225)
TITLE_GOLD = (210, 160, 50)
HEADER_BG = (30, 55, 95)
HEADER_TEXT = (255, 255, 255)
SUBTITLE_BG = (55, 95, 140)
SUBTITLE_TEXT = (255, 255, 255)

LAYER_COLORS = [
    (200, 225, 245),  # Data Sources
    (180, 215, 200),  # Integration
    (255, 235, 190),  # Ontology Modeling (core)
    (210, 195, 220),  # Storage
    (195, 215, 235),  # Application
]

SIDE_COLOR = (235, 230, 245)  # Cross-cutting

# Title bar
draw.rectangle([0, 0, W, 70], fill=HEADER_BG)
title_font = getfont(32, bold=True)
draw.text((W//2, 35), "本 体 架 构 (Ontology Architecture)", fill=HEADER_TEXT, font=title_font, anchor='mm')

# Subtitle
sub_font = getfont(16)
draw.text((W//2, 90), "企业级知识图谱与语义计算平台技术架构", fill=(80, 90, 110), font=sub_font, anchor='mm')

# Layout
margin_l = 60
margin_r = 60
margin_top = 120
margin_bottom = 40
usable_w = W - margin_l - margin_r
usable_h = H - margin_top - margin_bottom

# 5 main layers + cross-cutting on right
n_layers = 5
layer_h = usable_h // n_layers - 8
cross_w = 280
main_w = usable_w - cross_w - 20

x0 = margin_l
y0 = margin_top

layer_names = [
    ("应用服务层", "Application Services", ["语义搜索", "智能问答系统", "推理引擎", "推荐与决策"]),
    ("知识存储层", "Knowledge Storage", ["知识图谱库", "三元组存储", "图数据库 (Neo4j)", "向量数据库"]),
    ("本体建模层", "Ontology Modeling", ["概念/类 (Classes)", "关系/属性 (Properties)", "规则/公理 (Axioms)", "实例 (Individuals)"]),
    ("数据集成层", "Data Integration", ["ETL 管道", "实体抽取 (NER)", "关系抽取", "实体对齐与融合"]),
    ("数据源层", "Data Sources", ["结构化 (RDB/CSV)", "半结构化 (XML/JSON)", "非结构化 (Text/PDF)", "API 与流数据"]),
]

# Draw layers from bottom to top
for i in range(n_layers):
    y = y0 + i * (layer_h + 8)
    label, eng, items = layer_names[i]
    color = LAYER_COLORS[i]
    
    # Main block
    draw.rounded_rectangle([x0, y, x0 + main_w, y + layer_h], radius=10, fill=color, outline=BORDER_LAYER, width=2)
    
    # Layer header
    hdr_h = 38
    draw.rounded_rectangle([x0, y, x0 + main_w, y + hdr_h], radius=10, fill=SUBTITLE_BG, outline=None)
    draw.rectangle([x0, y + hdr_h - 10, x0 + main_w, y + hdr_h], fill=SUBTITLE_BG)  # flat bottom
    
    # Layer title
    fnt = getfont(18, bold=True)
    draw.text((x0 + 20, y + hdr_h//2), f"{label}", fill=SUBTITLE_TEXT, font=fnt, anchor='lm')
    fnt_s = getfont(12)
    draw.text((x0 + 220, y + hdr_h//2), f"({eng})", fill=(200, 215, 230), font=fnt_s, anchor='lm')
    
    # Items
    item_y = y + hdr_h + 12
    item_h = layer_h - hdr_h - 20
    
    if i == 2:
        # Ontology modeling: 2x2 grid
        cols = 2
        rows = 2
        cell_w = (main_w - 40) // cols - 10
        cell_h = (item_h) // rows - 8
        item_fnt = getfont(15)
        for idx, it in enumerate(items):
            cx = x0 + 20 + (idx % cols) * (cell_w + 10)
            cy = item_y + (idx // cols) * (cell_h + 8)
            # Mini box
            draw.rounded_rectangle([cx, cy, cx + cell_w, cy + cell_h], radius=6, fill=(255,255,255), outline=(180,160,110), width=1)
            # Icon-like circle
            cr = 10
            draw.ellipse([cx + 12, cy + cell_h//2 - cr, cx + 12 + 2*cr, cy + cell_h//2 + cr], fill=TITLE_GOLD, outline=None)
            draw.text((cx + 12 + cr, cy + cell_h//2), "◆", fill=(255,255,255), font=getfont(10), anchor='mm')
            draw.text((cx + 44, cy + cell_h//2), it, fill=(60,50,30), font=item_fnt, anchor='lm')
    else:
        item_fnt = getfont(16)
        gap = main_w - 40
        seg = gap // len(items)
        for idx, it in enumerate(items):
            ix = x0 + 20 + idx * seg
            # bullet
            draw.ellipse([ix, item_y + 6, ix + 8, item_y + 14], fill=(80,100,120), outline=None)
            draw.text((ix + 18, item_y + 10), it, fill=(50,60,75), font=item_fnt, anchor='lm')

# Cross-cutting (right side)
ccx = x0 + main_w + 20
ccy = y0
cch = usable_h
ccw = cross_w
draw.rounded_rectangle([ccx, ccy, ccx + ccw, ccy + cch], radius=10, fill=SIDE_COLOR, outline=(180,170,200), width=2)

# Cross-cutting header
cchdr = 38
draw.rounded_rectangle([ccx, ccy, ccx + ccw, ccy + cchdr], radius=10, fill=(100,85,140), outline=None)
draw.rectangle([ccx, ccy + cchdr - 10, ccx + ccw, ccy + cchdr], fill=(100,85,140))
cc_fnt = getfont(17, bold=True)
draw.text((ccx + ccw//2, ccy + cchdr//2), "跨层能力", fill=(255,255,255), font=cc_fnt, anchor='mm')

# Arrow up on side
arrow_cy = ccy + cchdr + 20
arrow_bottom = ccy + cch - 15
# Draw vertical double arrow
for ay in range(arrow_cy, arrow_bottom, 25):
    draw.line([(ccx + ccw//2, ay), (ccx + ccw//2, ay + 15)], fill=(140,120,170), width=2)
# Arrow heads
draw.polygon([(ccx + ccw//2 - 8, arrow_cy), (ccx + ccw//2, arrow_cy - 8), (ccx + ccw//2 + 8, arrow_cy)], fill=(140,120,170))
draw.polygon([(ccx + ccw//2 - 8, arrow_bottom), (ccx + ccw//2, arrow_bottom + 8), (ccx + ccw//2 + 8, arrow_bottom)], fill=(140,120,170))

# Cross-cutting items
cc_items = [
    ("本体治理", "Ontology Governance"),
    ("版本管理", "Version Management"),
    ("安全与权限", "Security & Auth"),
    ("质量评估", "Quality Assessment"),
    ("映射与对齐", "Mapping & Alignment"),
    ("SPARQL 查询", "SPARQL Query"),
]

ci_y = arrow_cy + 25
ci_fnt = getfont(14)
ci_fnt2 = getfont(10)
for ci_name, ci_eng in cc_items:
    if ci_y + 35 > ccy + cch - 10:
        break
    # small box
    draw.rounded_rectangle([ccx + 12, ci_y, ccx + ccw - 12, ci_y + 34], radius=5, fill=(255,255,255), outline=(160,145,185), width=1)
    draw.text((ccx + ccw//2, ci_y + 10), ci_name, fill=(80,65,110), font=ci_fnt, anchor='mm')
    draw.text((ccx + ccw//2, ci_y + 24), ci_eng, fill=(150,140,170), font=ci_fnt2, anchor='mm')
    ci_y += 40

# Connector arrows between layers
for i in range(n_layers - 1):
    y1 = y0 + i * (layer_h + 8) + layer_h
    y2 = y0 + (i+1) * (layer_h + 8)
    mid = (y1 + y2) // 2
    draw.line([(x0 + main_w//2, y1), (x0 + main_w//2, y2)], fill=(160,170,185), width=2)
    # small arrow
    draw.polygon([(x0 + main_w//2 - 6, y2 - 4), (x0 + main_w//2, y2 + 4), (x0 + main_w//2 + 6, y2 - 4)], fill=(160,170,185))

# Legend / footer
foot_fnt = getfont(12)
draw.text((W//2, H - 15), "Ontology Architecture — 企业本体架构参考模型", fill=(150,155,165), font=foot_fnt, anchor='mm')

# Save
out = r'D:\cursor\DES workspace - Copy\12.12 - 公司最终版本\workspace\generated\codex_ecad5a5088a64fb6af23b0bfbc57aaf0\ontology_architecture.jpg'
img.save(out, quality=95)
print(f"Saved to {out}")
print(f"Size: {img.size}")
