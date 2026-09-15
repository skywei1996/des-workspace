import re
from typing import Optional

from sqlalchemy.orm import Session

from app import models


GREETING_PATTERNS = (
    "你好",
    "您好",
    "hello",
    "hi",
    "hey",
    "在吗",
    "在么",
)


def normalize_user_message(content: str) -> str:
    return re.sub(r"\s+", " ", (content or "").strip())


def looks_like_direct_chat(user_message: str) -> bool:
    normalized = re.sub(r"\s+", " ", (user_message or "").strip().lower())
    if not normalized:
        return False

    if normalized in GREETING_PATTERNS:
        return True

    if len(normalized) <= 12 and any(pattern in normalized for pattern in GREETING_PATTERNS):
        return True

    return False


def collect_user_messages(chat_id: int, db: Session, latest_user_message: Optional[str] = None) -> list[str]:
    user_messages = []
    seen = set()

    chat_history = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.chat_id == chat_id)
        .order_by(models.ChatMessage.created_at)
        .all()
    )

    for msg in chat_history:
        if msg.sender_role != "user":
            continue
        normalized = normalize_user_message(msg.content)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        user_messages.append(normalized)

    normalized_latest = normalize_user_message(latest_user_message or "")
    if normalized_latest and normalized_latest not in seen:
        user_messages.append(normalized_latest)

    return user_messages


def build_planning_history(chat_id: int, db: Session, max_messages: int = 12) -> str:
    chat_history = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.chat_id == chat_id)
        .order_by(models.ChatMessage.created_at.desc(), models.ChatMessage.id.desc())
        .limit(max_messages)
        .all()
    )

    if not chat_history:
        return "Recent Conversation History:\n(empty)"

    ordered_messages = list(reversed(chat_history))
    history_lines = []
    for msg in ordered_messages:
        role = "User" if msg.sender_role == "user" else "Assistant"
        content = normalize_user_message(msg.content)
        if not content:
            continue
        history_lines.append(f"{role}: {content}")

    if not history_lines:
        return "Recent Conversation History:\n(empty)"

    return "Recent Conversation History:\n" + "\n".join(history_lines)


def build_effective_user_request(chat_id: int, latest_user_message: str, db: Session) -> str:
    normalized_latest = normalize_user_message(latest_user_message)
    if looks_like_direct_chat(normalized_latest):
        return normalized_latest

    user_messages = collect_user_messages(chat_id, db, latest_user_message)
    if not user_messages:
        return normalized_latest

    primary_request = user_messages[0]
    supplemental_messages = user_messages[1:]

    if not supplemental_messages:
        return primary_request

    supplemental_text = "；".join(supplemental_messages)
    return f"原始任务：{primary_request}。补充要求：{supplemental_text}。"