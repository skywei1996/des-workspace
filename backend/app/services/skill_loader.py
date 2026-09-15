import os
import glob
import frontmatter
from pathlib import Path

from app.services.skill_package import parse_skill_directory

def load_skills(skills_dir: str):
    """
    Load all SKILL.md files from the specified directory.
    Returns a list of dictionaries containing skill metadata and instructions.
    """
    skills = []
    
    # Use glob to find all markdown files in any subdirectory
    search_pattern = os.path.join(skills_dir, "**", "*.md")
    for file_path in glob.glob(search_pattern, recursive=True):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                post = frontmatter.load(f)

            parsed_package = parse_skill_directory(Path(os.path.dirname(file_path)), skill_file=Path(file_path))
            skill_id = os.path.basename(os.path.dirname(file_path)) or post.metadata.get("name", "unknown")
            skill_def = {
                "id": skill_id,
                "skill_key": skill_id,
                "name": post.metadata.get("name", "Unknown Skill"),
                "description": post.metadata.get("description", "No description provided."),
                "icon": post.metadata.get("icon", "tool"),
                "instructions": post.content,
                "config_json": parsed_package.get("config_json") or {},
                "assets_manifest": parsed_package.get("assets_manifest") or [],
                "status": "Available",
                "source": post.metadata.get("source", "builtin"),
                "skill_type": post.metadata.get("skill_type", "prompt"),
                "file_path": file_path,
                "capabilities": post.metadata.get("capabilities") or [
                    {
                        "id": skill_id,
                        "name": "Core Instructions",
                        "description": "Includes the core instructions for this skill in the system prompt."
                    }
                ]
            }
            skills.append(skill_def)
        except Exception as e:
            print(f"Error loading skill file {file_path}: {e}")
            
    return skills

def get_skills_prompt_addition(skills) -> str:
    """
    Generate the text to append to the agent's system prompt based on loaded skills.
    """
    if not skills:
        return ""
        
    prompt = "\n\nYou have access to the following skills:\n"
    for skill in skills:
        prompt += f"- {skill['name']}: {skill['description']}\n"
        
    prompt += "\nBefore answering, check if any skill applies. If applying a skill, follow its instructions carefully:\n"
    
    for skill in skills:
        prompt += f"\n--- Skill: {skill['name']} ---\n{skill['instructions']}\n"
        
    return prompt
