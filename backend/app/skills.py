import os
import json
from datetime import datetime, timedelta
from duckduckgo_search import DDGS
from typing import Annotated

def write_file(file_path: str, content: str) -> str:
    """Writes content to a file. Returns success message."""
    try:
        # Ensure workspace directory exists
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        workspace_dir = os.path.join(base_dir, "workspace")
        
        # If file_path is relative, join with workspace
        if not os.path.isabs(file_path):
            full_path = os.path.join(workspace_dir, file_path)
        else:
            full_path = file_path
            
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return f"Successfully wrote to {file_path}"
    except Exception as e:
        return f"Error writing file: {str(e)}"

def read_file(file_path: str) -> str:
    """Reads content from a file."""
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        workspace_dir = os.path.join(base_dir, "workspace")
        
        if not os.path.isabs(file_path):
            full_path = os.path.join(workspace_dir, file_path)
        else:
            full_path = file_path

        if not os.path.exists(full_path):
            return "File not found."
            
        with open(full_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {str(e)}"

def web_search(query: Annotated[str, "The search query string"]) -> Annotated[str, "The search results"]:
    """
    Performs a web search using DuckDuckGo and returns the top results.
    Use this tool when you need to find current information, market data, or facts from the internet.
    """
    try:
        results = DDGS().text(query, max_results=5)
        if not results:
            return "No results found."
        
        formatted_results = []
        for r in results:
            formatted_results.append(f"Title: {r['title']}\nLink: {r['href']}\nSnippet: {r['body']}\n")
            
        return "\n---\n".join(formatted_results)
    except Exception as e:
        return f"Error performing web search: {str(e)}"


def get_time_range_in_ms(
    days_back: Annotated[int, "How many days back from now to include"]
) -> Annotated[str, "A JSON string with start_time, end_time, and current_time in Unix milliseconds"]:
    """Returns a deterministic relative time window in Unix milliseconds."""
    now = datetime.now()
    start = now - timedelta(days=max(int(days_back), 0))
    return json.dumps(
        {
            "current_time": int(now.timestamp() * 1000),
            "start_time": int(start.timestamp() * 1000),
            "end_time": int(now.timestamp() * 1000),
            "days_back": int(days_back),
        },
        ensure_ascii=False,
    )
