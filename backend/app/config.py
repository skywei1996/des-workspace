import os
from typing import Any

from dotenv import load_dotenv
from openai import AzureOpenAI, OpenAI

# 确保从 backend 目录加载 .env 文件
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(base_dir, '.env')
load_dotenv(env_path)


DEFAULT_MODEL_FAMILY = "gpt-5"
DEFAULT_AZURE_API_VERSION = "2025-01-01-preview"


def get_chat_model_name() -> str:
    return os.getenv("AZURE_OPENAI_DEPLOYMENT") or os.getenv(
        "LLM_MODEL", DEFAULT_MODEL_FAMILY
    )


def build_chat_client() -> Any:
    azure_api_key = os.getenv("AZURE_OPENAI_API_KEY")
    if azure_api_key:
        return AzureOpenAI(
            api_key=azure_api_key,
            api_version=os.getenv(
                "AZURE_OPENAI_API_VERSION", DEFAULT_AZURE_API_VERSION
            ),
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            azure_deployment=get_chat_model_name(),
        )

    return OpenAI(
        api_key=os.getenv("OPENAI_API_KEY", "sk-placeholder"),
        base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
    )


def _supports_custom_temperature(model_name: str) -> bool:
    normalized = (model_name or "").lower()
    return not normalized.startswith("gpt-5")

def get_llm_config():
    """
    Constructs the default model configuration for the Codex runtime.
    Supports both Azure OpenAI and standard OpenAI-compatible providers.
    """
    
    # 检查是否存在 Azure 的配置
    azure_api_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_deployment = get_chat_model_name()
    model_family = os.getenv("LLM_MODEL", DEFAULT_MODEL_FAMILY)
    
    config_list = []
    
    if azure_api_key:
        # Azure OpenAI 配置
        azure_config = {
            "model": azure_deployment,
            "api_key": azure_api_key,
            "base_url": os.getenv("AZURE_OPENAI_ENDPOINT"),
            "api_type": "azure",
            "api_version": os.getenv("AZURE_OPENAI_API_VERSION", DEFAULT_AZURE_API_VERSION),
        }
        config_list.append(azure_config)
    else:
        # 标准 OpenAI 配置 (Fallback)
        default_config = {
            "model": model_family,
            "api_key": os.getenv("OPENAI_API_KEY", "sk-placeholder"),
            "base_url": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        }
        config_list.append(default_config)
    
    llm_config = {
        "config_list": config_list,
        "timeout": 120,
    }

    if _supports_custom_temperature(model_family):
        llm_config["temperature"] = 0 # Low temperature for planning to be deterministic

    return llm_config


def get_employee_llm_config(employee, db):
    """Resolve a stored employee model, falling back to the global config."""
    model_name = str(getattr(employee, "model", "") or "").strip()
    if not model_name or model_name.lower() == "auto":
        return get_llm_config()

    from . import models

    configuration = (
        db.query(models.ModelConfiguration)
        .filter(models.ModelConfiguration.model_name == model_name)
        .first()
    )
    if not configuration:
        return get_llm_config()

    endpoint = configuration.api_endpoint.strip().rstrip("/")
    if endpoint.endswith("/chat/completions"):
        endpoint = endpoint.removesuffix("/chat/completions")
    model_config = {
        "model": configuration.model_name,
        "api_key": configuration.api_key,
        "base_url": endpoint,
    }
    if configuration.provider_type == "Azure OpenAI Compatible":
        model_config.update({
            "api_type": "azure",
            "api_version": os.getenv("AZURE_OPENAI_API_VERSION", DEFAULT_AZURE_API_VERSION),
        })

    config = {
        "config_list": [model_config],
        "timeout": 120,
    }
    if _supports_custom_temperature(configuration.model_name):
        config["temperature"] = 0
    return config
