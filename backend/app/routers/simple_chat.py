from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import build_chat_client, get_chat_model_name


router = APIRouter(prefix="/simple-chat", tags=["simple-chat"])


class SimpleChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=50000)


class SimpleChatRequest(BaseModel):
    messages: list[SimpleChatMessage] = Field(min_length=1, max_length=50)


class SimpleChatResponse(BaseModel):
    message: str
    model: str


@router.post("", response_model=SimpleChatResponse)
def simple_chat(payload: SimpleChatRequest):
    messages = [message.model_dump() for message in payload.messages]
    if not any(message["role"] == "system" for message in messages):
        messages.insert(0, {"role": "system", "content": "You are a helpful enterprise assistant. Answer the user's question directly and clearly."})

    model_name = get_chat_model_name()
    try:
        response = build_chat_client().chat.completions.create(
            model=model_name,
            messages=messages,
        )
        content = response.choices[0].message.content
        if not content:
            raise ValueError("The model returned an empty response.")
        return SimpleChatResponse(message=content, model=model_name)
    except Exception as error:
        raise HTTPException(status_code=502, detail=str(error)) from error