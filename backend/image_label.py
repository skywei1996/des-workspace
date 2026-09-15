import sys
import os

# Add the current directory to sys.path to ensure imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from app.agents.image_label_agent import WatermarkAgent
except ImportError:
    # Fallback if running from a different context
    from backend.app.agents.image_label_agent import WatermarkAgent

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python image_label.py <image_path>")
        sys.exit(1)

    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(f"Error: File not found at {image_path}")
        sys.exit(1)

    print(f"Initializing Watermark Agent for {image_path}...")
    agent = WatermarkAgent()
    
    print("Analyzing image...")
    result = agent.analyze_image(image_path)
    
    if result:
        print("Analysis successful.")
        print(f"Description: {result.get('image_description')}")
        
        # Generate HTML report
        report_path = agent.generate_html_report(image_path, result)
        print(f"HTML Report generated at: {report_path}")
        
        # Also print JSON result to stdout as implied/requested
        import json
        print("\nJSON Result:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print("Analysis failed.")
        sys.exit(1)
