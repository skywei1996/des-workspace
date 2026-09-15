from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import shutil
import os
import tempfile
from app.agents.image_label_agent import WatermarkAgent

router = APIRouter()
agent = WatermarkAgent()

@router.post("/analyze")
async def analyze_watermark(file: UploadFile = File(...)):
    try:
        # Create a temporary file to save the uploaded image
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        try:
            # Analyze the image
            result = agent.analyze_image(tmp_path)
            
            if not result:
                raise HTTPException(status_code=500, detail="Analysis failed")
            
            # Generate the HTML report as required
            report_path = agent.generate_html_report(tmp_path, result)
            
            # Add report path to result
            result["report_path"] = report_path
            
            return JSONResponse(content=result)
            
        finally:
            # Cleanup - we might want to keep the temp file if we link to it in the report, 
            # but for now let's clean up the image file but NOT the report (which is what user wanted)
            # Actually, `generate_html_report` creates the html next to the image. 
            # If we delete the image, the HTML might have a broken image link if it was relative.
            # But my implementation used base64 in the HTML, so deleting the image file is safe for the HTML report.
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
