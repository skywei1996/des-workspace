import uvicorn
import sys
import os

# Add the current directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("Starting server...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
