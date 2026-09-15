from __future__ import annotations

import json
import math
import os
import re
import sys
from pathlib import Path
from typing import Any

from playwright.sync_api import sync_playwright
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt


HTML_WIDTH = 1440.0
HTML_HEIGHT = 810.0
PPT_WIDTH_IN = 13.333
PPT_HEIGHT_IN = 7.5

TEXT_TAGS = {"h1", "h2", "h3", "h4", "p", "span", "strong", "li", "b"}
ROUND_CLASSES = {
    "proof-icon",
    "showcase-node",
    "service-flow-dot",
    "ckp-stage-dot",
    "proof-node",
}
ELLIPSE_CLASSES = {
    "showcase-circle",
    "governance-ring",
    "governance-center",
    "response-core-ring",
    "response-core-center",
}
TRIANGLE_CLASSES = {"ai-tier-top", "ai-tier-mid", "ai-tier-base"}
SKIP_SHAPE_CLASSES = {
    "deck",
    "hero",
    "content",
    "title-row",
    "brand",
    "brand-mark",
    "showcase-copy-head",
    "showcase-tags",
    "tag-row",
    "chip-row",
}
SKIP_TEXT_CLASSES = {
    "brand",
}


def px_to_in(px: float) -> float:
    return px / HTML_WIDTH * PPT_WIDTH_IN


def py_to_in(px: float) -> float:
    return px / HTML_HEIGHT * PPT_HEIGHT_IN


def px_to_pt(px: float) -> float:
    return px * 0.75


def parse_color(value: str | None) -> tuple[int, int, int] | None:
    if not value:
        return None
    value = value.strip()
    if value in {"transparent", "none", "rgba(0, 0, 0, 0)", "rgba(0,0,0,0)"}:
        return None
    if value.startswith("#"):
        hex_value = value[1:]
        if len(hex_value) == 3:
            hex_value = "".join(ch * 2 for ch in hex_value)
        if len(hex_value) >= 6:
            return tuple(int(hex_value[i : i + 2], 16) for i in (0, 2, 4))
    match = re.search(r"rgba?\((\d+),\s*(\d+),\s*(\d+)", value)
    if match:
        return tuple(int(match.group(i)) for i in range(1, 4))
    return None


def color_from_background(background_color: str, background_image: str) -> tuple[int, int, int] | None:
    parsed = parse_color(background_color)
    if parsed:
        return parsed
    if background_image and background_image != "none":
        gradient_colors = re.findall(r"rgba?\([^\)]+\)|#[0-9a-fA-F]{3,8}", background_image)
        for color in gradient_colors:
            parsed = parse_color(color)
            if parsed:
                return parsed
    return None


def has_visible_border(element: dict[str, Any]) -> bool:
    border_width = max(
        float(element.get("borderTopWidth", 0) or 0),
        float(element.get("borderRightWidth", 0) or 0),
        float(element.get("borderBottomWidth", 0) or 0),
        float(element.get("borderLeftWidth", 0) or 0),
    )
    border_color = parse_color(element.get("borderColor"))
    return border_width > 0 and border_color is not None


def alignment_from_css(text_align: str) -> PP_ALIGN:
    mapping = {
        "center": PP_ALIGN.CENTER,
        "right": PP_ALIGN.RIGHT,
        "justify": PP_ALIGN.JUSTIFY,
    }
    return mapping.get(text_align, PP_ALIGN.LEFT)


def shape_type_for(element: dict[str, Any]) -> MSO_AUTO_SHAPE_TYPE:
    classes = set(element.get("classes", []))
    width = element["width"]
    height = element["height"]
    radius = element.get("radius", 0)
    if classes & TRIANGLE_CLASSES:
        return MSO_AUTO_SHAPE_TYPE.ISOSCELES_TRIANGLE
    if classes & ROUND_CLASSES:
        return MSO_AUTO_SHAPE_TYPE.OVAL
    if classes & ELLIPSE_CLASSES:
        return MSO_AUTO_SHAPE_TYPE.OVAL
    if radius >= min(width, height) / 2 - 2:
        return MSO_AUTO_SHAPE_TYPE.OVAL
    if radius >= 8:
        return MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE
    return MSO_AUTO_SHAPE_TYPE.RECTANGLE


def should_draw_shape(element: dict[str, Any]) -> bool:
    classes = set(element.get("classes", []))
    if classes & SKIP_SHAPE_CLASSES:
        return False
    tag = element["tag"]
    if tag in {"main", "body", "html"}:
        return False
    if element["width"] < 3 or element["height"] < 3:
        return False
    if element.get("textOnly"):
        return False
    return element.get("hasFill") or element.get("hasBorder")


def should_draw_text(element: dict[str, Any]) -> bool:
    classes = set(element.get("classes", []))
    if classes & SKIP_TEXT_CLASSES:
        return False
    text = (element.get("text") or "").strip()
    if not text:
        return False
    return element.get("isTextLeaf", False)


def set_fill_and_line(shape, element: dict[str, Any]) -> None:
    fill_color = color_from_background(element.get("backgroundColor", ""), element.get("backgroundImage", ""))
    if fill_color:
        shape.fill.solid()
        shape.fill.fore_color.rgb = RGBColor(*fill_color)
    else:
        shape.fill.background()

    if has_visible_border(element):
        border_color = parse_color(element.get("borderColor")) or (220, 220, 220)
        line = shape.line
        line.color.rgb = RGBColor(*border_color)
        line.width = Pt(max(float(element.get("borderTopWidth", 1)), 1) * 0.75)
        if element.get("borderStyle") == "dashed":
            try:
                line.dash_style = 1
            except Exception:
                pass
    else:
        shape.line.fill.background()


def add_shape(slide, element: dict[str, Any]) -> None:
    shape_type = shape_type_for(element)
    left = Inches(px_to_in(element["x"]))
    top = Inches(py_to_in(element["y"]))
    width = Inches(px_to_in(element["width"]))
    height = Inches(py_to_in(element["height"]))
    shape = slide.shapes.add_shape(shape_type, left, top, width, height)
    set_fill_and_line(shape, element)
    if set(element.get("classes", [])) & TRIANGLE_CLASSES:
        shape.rotation = 0


def add_textbox(slide, element: dict[str, Any]) -> None:
    left = Inches(px_to_in(element["x"]))
    top = Inches(py_to_in(element["y"]))
    width = Inches(px_to_in(max(element["width"], 8)))
    height = Inches(py_to_in(max(element["height"], 8)))
    textbox = slide.shapes.add_textbox(left, top, width, height)
    frame = textbox.text_frame
    frame.clear()
    frame.word_wrap = True
    frame.margin_left = 0
    frame.margin_right = 0
    frame.margin_top = 0
    frame.margin_bottom = 0
    frame.vertical_anchor = MSO_ANCHOR.MIDDLE if element.get("display") == "flex" else MSO_ANCHOR.TOP

    paragraph = frame.paragraphs[0]
    paragraph.alignment = alignment_from_css(element.get("textAlign", "left"))
    run = paragraph.add_run()
    text = element.get("text", "")
    if element["tag"] == "li" and not text.startswith("•"):
        text = f"• {text}"
    run.text = text
    font = run.font
    font.name = element.get("fontFamily", "Microsoft YaHei")
    font.size = Pt(max(px_to_pt(float(element.get("fontSize", 14))), 7))
    color = parse_color(element.get("color")) or (32, 36, 42)
    font.color.rgb = RGBColor(*color)
    font.bold = int(float(element.get("fontWeight", 400))) >= 700
    font.italic = element.get("fontStyle") == "italic"


def add_svg_wave_image(page, slide_index: int, slide, element: dict[str, Any], temp_dir: Path) -> None:
    locator = page.locator(f".slide:nth-of-type({slide_index + 1}) .ckp-evolution-wave")
    if locator.count() == 0:
        return
    image_path = temp_dir / f"wave_{slide_index + 1}.png"
    locator.screenshot(path=str(image_path), omit_background=True)
    slide.shapes.add_picture(
        str(image_path),
        Inches(px_to_in(element["x"])),
        Inches(py_to_in(element["y"])),
        width=Inches(px_to_in(element["width"])),
        height=Inches(py_to_in(element["height"])),
    )


def extract_page_data(page) -> dict[str, Any]:
    script = r"""
    () => {
      const transparent = new Set(['transparent', 'rgba(0, 0, 0, 0)', 'rgba(0,0,0,0)', '']);
      const slides = Array.from(document.querySelectorAll('.slide')).map((slide, slideIndex) => {
        const slideRect = slide.getBoundingClientRect();
        const elements = [];

        const all = Array.from(slide.querySelectorAll('*'));
        for (const el of all) {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) continue;
          if (rect.width < 1 || rect.height < 1) continue;

          const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
          const childHasText = Array.from(el.children).some(ch => {
            const t = (ch.innerText || '').replace(/\s+/g, ' ').trim();
            const r = ch.getBoundingClientRect();
            return t && r.width > 0 && r.height > 0;
          });
          const isTextLeaf = Boolean(text) && !childHasText;
          const backgroundColor = style.backgroundColor || '';
          const backgroundImage = style.backgroundImage || 'none';
          const borderTopWidth = parseFloat(style.borderTopWidth || '0');
          const borderRightWidth = parseFloat(style.borderRightWidth || '0');
          const borderBottomWidth = parseFloat(style.borderBottomWidth || '0');
          const borderLeftWidth = parseFloat(style.borderLeftWidth || '0');
          const hasBorder = (borderTopWidth + borderRightWidth + borderBottomWidth + borderLeftWidth) > 0 && style.borderTopStyle !== 'none';
          const hasFill = !transparent.has(backgroundColor) || backgroundImage !== 'none';
          const radius = parseFloat(style.borderTopLeftRadius || '0') || 0;
          const classes = Array.from(el.classList);
          const textOnly = isTextLeaf && !hasFill && !hasBorder;

          elements.push({
            tag: el.tagName.toLowerCase(),
            classes,
            text,
            x: rect.left - slideRect.left,
            y: rect.top - slideRect.top,
            width: rect.width,
            height: rect.height,
            backgroundColor,
            backgroundImage,
            borderColor: style.borderTopColor || style.borderColor || '',
            borderStyle: style.borderTopStyle || style.borderStyle || 'solid',
            borderTopWidth,
            borderRightWidth,
            borderBottomWidth,
            borderLeftWidth,
            radius,
            color: style.color || '',
            fontSize: parseFloat(style.fontSize || '14'),
            fontWeight: style.fontWeight || '400',
            fontFamily: (style.fontFamily || 'Microsoft YaHei').split(',')[0].replace(/['"]/g, '').trim(),
            fontStyle: style.fontStyle || 'normal',
            textAlign: style.textAlign || 'left',
            display: style.display || 'block',
            hasFill,
            hasBorder,
            isTextLeaf,
            textOnly,
            zIndex: style.zIndex || '0',
            shadow: style.boxShadow || 'none',
            order: elements.length,
          });
        }

        return {
          width: slideRect.width,
          height: slideRect.height,
          elements,
        };
      });
      return { slides };
    }
    """
    return page.evaluate(script)


def build_presentation(html_path: Path, output_path: Path, diff_report_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_dir = output_path.parent / ".html_to_pptx_tmp"
    temp_dir.mkdir(parents=True, exist_ok=True)

    differences = [
        "复杂 CSS 渐变、阴影和 conic-gradient 环形区域使用了最接近的可编辑纯色 / 基础形状近似。",
        "部分伪元素效果（如箭头三角、虚线连接、装饰性顶部条）使用基础形状或省略处理。",
        "CKP 演进页的波浪 SVG 路径使用了局部透明截图插入，未作为可编辑贝塞尔曲线重建。",
        "PowerPoint 不支持与浏览器完全一致的字间距、阴影和 CSS 盒模型，文本尺寸与行高做了可编辑近似。",
    ]

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={"width": int(HTML_WIDTH), "height": int(HTML_HEIGHT)})
        page.goto(html_path.resolve().as_uri(), wait_until="load")
        page_data = extract_page_data(page)

        presentation = Presentation()
        presentation.slide_width = Inches(PPT_WIDTH_IN)
        presentation.slide_height = Inches(PPT_HEIGHT_IN)
        blank_layout = presentation.slide_layouts[6]

        for slide_index, slide_data in enumerate(page_data["slides"]):
            slide = presentation.slides.add_slide(blank_layout)
            background = slide.background.fill
            background.solid()
            background.fore_color.rgb = RGBColor(255, 255, 255)

            elements = slide_data["elements"]
            shapes = [el for el in elements if should_draw_shape(el)]
            texts = [el for el in elements if should_draw_text(el)]

            # Add a couple of decorative line approximations that come from pseudo-elements.
            for el in shapes:
                classes = set(el.get("classes", []))
                if "ckp-evolution-wave" in classes:
                    add_svg_wave_image(page, slide_index, slide, el, temp_dir)
                    continue
                add_shape(slide, el)

            for el in texts:
                add_textbox(slide, el)

        presentation.save(str(output_path))
        browser.close()

    diff_report_path.write_text("\n".join(f"- {item}" for item in differences), encoding="utf-8")


def validate_presentation(pptx_path: Path) -> dict[str, Any]:
    presentation = Presentation(str(pptx_path))
    return {
        "slides": len(presentation.slides),
        "titles": [
            next((shape.text for shape in slide.shapes if hasattr(shape, "text") and shape.text.strip()), "")
            for slide in presentation.slides
        ],
    }


def main() -> int:
    html_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("HTML/az_ddc_next_operating_model.html")
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("workspace/generated/az_ddc_next_operating_model_editable.pptx")
    diff_report_path = output_path.with_suffix(".diff.txt")

    build_presentation(html_path, output_path, diff_report_path)
    validation = validate_presentation(output_path)
    print(json.dumps({
        "pptx": str(output_path),
        "diff_report": str(diff_report_path),
        "slides": validation["slides"],
        "titles": validation["titles"],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())