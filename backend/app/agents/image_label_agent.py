import os
import json
import base64
import time
from datetime import datetime
from PIL import Image
from openai import OpenAI
import traceback

import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WatermarkAgent:
    def __init__(self):
        # Volcengine Ark (Doubao) configuration
        self.api_key = "044efa70-2b36-439a-8f43-ed1e5efbf17d"
        self.base_url = "https://ark.cn-beijing.volces.com/api/v3"
        self.model = "doubao-seed-1-6-vision-250815"
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
        )

    def _encode_image(self, image_path):
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')

    def analyze_image(self, image_path):
        try:
            # Get image dimensions
            with Image.open(image_path) as img:
                width, height = img.size
                image_size = [0, 0, width, height]

            base64_image = self._encode_image(image_path)
            logger.info(f"Analyzing image: {image_path} with size {width}x{height}")

            prompt = """
            Please analyze the image for text and watermarks.
            Return the result in the following JSON format ONLY:
            {
              "image_description": "Brief description of the image content",
              "image_size": [0, 0, width, height],
              "recognized_texts": [
                {
                  "text": "Detected text content",
                  "bbox": [x1, y1, x2, y2],
                  "is_watermark": boolean,
                  "judgment_basis": "Why this is or isn't a watermark",
                  "confidence": float (0-1)
                }
              ]
            }
            The bbox coordinates should be normalized (0-1000).
            """

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                },
                            },
                            {"type": "text", "text": prompt},
                        ],
                    }
                ],
            )

            content = response.choices[0].message.content
            logger.info(f"LLM Response: {content}")
            
            # Extract JSON from markdown code block if present
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].strip()

            result = json.loads(content)
            
            # Ensure image_size is correct in case model hallucinated it
            result["image_size"] = image_size
            
            return result

        except Exception as e:
            logger.error(f"Error in analyze_image: {e}")
            logger.error(traceback.format_exc())
            return None

    def generate_html_report(self, image_path, result, output_dir=None):
        if not output_dir:
            output_dir = os.path.dirname(image_path)
            
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        output_filename = f"result+{timestamp}.html"
        output_path = os.path.join(output_dir, output_filename)
        
        # Calculate scaled boxes and prepare data for HTML
        width = result["image_size"][2]
        height = result["image_size"][3]
        
        boxes_html = ""
        for item in result.get("recognized_texts", []):
            bbox = item["bbox"]
            # Convert using 999 scale as per design requirements
            x1 = (bbox[0] / 999) * width
            y1 = (bbox[1] / 999) * height
            x2 = (bbox[2] / 999) * width
            y2 = (bbox[3] / 999) * height
            
            w = x2 - x1
            h = y2 - y1
            
            border_color = "red" if item["is_watermark"] else "blue"
            
            boxes_html += f"""
            <div style="position: absolute; left: {x1}px; top: {y1}px; width: {w}px; height: {h}px; border: 2px solid {border_color}; pointer-events: none;">
                <div style="position: absolute; top: 100%; left: 0; background: rgba(0,0,0,0.7); color: white; padding: 2px; font-size: 10px; white-space: nowrap;">
                    {'Watermark' if item['is_watermark'] else 'Text'} ({item['confidence']})
                </div>
            </div>
            """

        # Get absolute path for image to ensure it loads in local HTML
        abs_image_path = os.path.abspath(image_path)
        # For browser display, we might need a file URL or base64 if paths are issue
        # Using base64 for portability
        img_base64 = self._encode_image(image_path)
        img_src = f"data:image/jpeg;base64,{img_base64}"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Watermark Analysis Result</title>
            <style>
                body {{ margin: 0; padding: 20px; font-family: sans-serif; }}
                .container {{ position: relative; display: inline-block; }}
                img {{ display: block; }}
            </style>
        </head>
        <body>
            <h1>Analysis Result</h1>
            <p><strong>Description:</strong> {result.get('image_description', 'N/A')}</p>
            <div class="container" style="width: {width}px; height: {height}px;">
                <img src="{img_src}" width="{width}" height="{height}" alt="Analyzed Image">
                {boxes_html}
            </div>
            <h2>Details</h2>
            <pre>{json.dumps(result, indent=2, ensure_ascii=False)}</pre>
        </body>
        </html>
        """
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_content)
            
        return output_path

if __name__ == "__main__":
    # Test script usage
    import sys
    if len(sys.argv) > 1:
        agent = WatermarkAgent()
        img_path = sys.argv[1]
        print(f"Analyzing {img_path}...")
        res = agent.analyze_image(img_path)
        if res:
            report_path = agent.generate_html_report(img_path, res)
            print(f"Report generated at: {report_path}")
        else:
            print("Analysis failed.")
    else:
        print("Usage: python image_label_agent.py <image_path>")
