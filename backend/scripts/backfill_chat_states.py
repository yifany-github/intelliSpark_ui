"""
Backfill chat state snapshots for legacy chats using a synchronous session.

This script hydrates the `character_chat_states` table and ensures the latest
assistant message in each chat carries a `state_snapshot`, so the frontend can
render historical state panels immediately after deploying the state tracker.
"""

import argparse
import json
import logging
from typing import Any, Dict, Iterable, Optional

from sqlalchemy import asc
from sqlalchemy.orm import Session, joinedload

from database import SessionLocal
from models import Character, CharacterChatState, Chat, ChatMessage
from services.character_state_manager import CharacterStateManager

logger = logging.getLogger(__name__)

SAFE_FALLBACK = {
    "衣着": "穿搭整洁得体，色调温和",
    "仪态": "站姿放松，自信自然",
    "情绪": {"value": 6, "description": "心情愉悦，对交流充满期待"},
    "好感度": {"value": 4, "description": "初次见面，保持礼貌的距离感"},
    "信任度": {"value": 3, "description": "略有戒备，需要时间建立信任"},
    "兴奋度": {"value": 5, "description": "保持平稳的心态"},
    "疲惫度": {"value": 3, "description": "精力充沛，状态良好"},
    "环境": "温暖明亮的室内空间，布置舒适",
    "动作": "双手自然垂放，偶尔整理袖口",
    "语气": "亲切柔和，带着一丝兴奋",
}

NSFW_FALLBACK = {
    "胸部": "柔软饱满，布料轻贴，伴随呼吸微微起伏",
    "下体": "带着余热与敏感，隐约透出渴望",
    "衣服": "贴身衣物略显凌乱，勾勒出诱人曲线",
    "姿势": "身体微微前倾，呈现出主动亲近的姿态",
    "情绪": {"value": 6, "description": "期待、雀跃并带着羞怯的悸动"},
    "好感度": {"value": 5, "description": "对你充满好奇，愿意进一步了解"},
    "信任度": {"value": 4, "description": "在这个私密空间中略显放松"},
    "兴奋度": {"value": 5, "description": "内心涌动着期待感"},
    "疲惫度": {"value": 3, "description": "精力充沛，身体充满活力"},
    "欲望值": {"value": 4, "description": "身体开始感受到微妙的渴望"},
    "敏感度": {"value": 6, "description": "肌肤对触碰的反应敏锐"},
    "环境": "私密空间光线暖柔，空气中弥漫甜香",
}


def _filtered_state(snapshot: Optional[str], keys: Iterable[str]) -> Dict[str, Any]:
    if not snapshot:
        return {}
    try:
        parsed = json.loads(snapshot)
    except json.JSONDecodeError:
        return {}

    if not isinstance(parsed, dict):
        return {}

    filtered: Dict[str, Any] = {}
    for key in keys:
        normalized = CharacterStateManager._normalize_state_value(parsed.get(key))
        if normalized:
            filtered[key] = normalized
    return filtered


def _build_base_state(character: Character, keys: Iterable[str], safe_mode: bool) -> Dict[str, Any]:
    base = (SAFE_FALLBACK if safe_mode else NSFW_FALLBACK).copy()

    template_raw = getattr(character, "default_state_json", None)
    if template_raw:
        try:
            template = json.loads(template_raw)
        except json.JSONDecodeError:
            template = {}
        if isinstance(template, dict):
            for key in keys:
                normalized = CharacterStateManager._normalize_state_value(template.get(key))
                if normalized:
                    base[key] = normalized
    return base


def _backfill_chat(session: Session, chat: Chat) -> None:
    character: Optional[Character] = chat.character
    if not character:
        logger.warning("Skipping chat %s — character missing.", chat.id)
        return

    safe_mode = getattr(character, "nsfw_level", 0) == 0
    keys = CharacterStateManager.SAFE_KEYS if safe_mode else CharacterStateManager.NSFW_KEYS
    base_state = _build_base_state(character, keys, safe_mode)

    state_row: Optional[CharacterChatState] = session.get(CharacterChatState, chat.id)
    existing_state = {}
    if state_row and state_row.state_json:
        existing_state = _filtered_state(state_row.state_json, keys)

    base_state.update(existing_state)
    serialized = json.dumps(base_state, ensure_ascii=False)

    if state_row is None:
        state_row = CharacterChatState(chat_id=chat.id, state_json=serialized)
        session.add(state_row)
    else:
        state_row.state_json = serialized

    session.flush()

    # Ensure the latest assistant message has a snapshot.
    last_assistant: Optional[ChatMessage] = (
        session.query(ChatMessage)
        .filter(ChatMessage.chat_id == chat.id, ChatMessage.role == "assistant")
        .order_by(ChatMessage.id.desc())
        .first()
    )
    if last_assistant and not last_assistant.state_snapshot:
        last_assistant.state_snapshot = serialized
        session.add(last_assistant)

    session.commit()


def backfill(limit: int) -> None:
    session: Session = SessionLocal()
    processed = 0
    try:
        query = (
            session.query(Chat)
            .options(joinedload(Chat.character))
            .order_by(asc(Chat.id))
        )
        if limit > 0:
            query = query.limit(limit)

        chats = query.all()
        logger.info("Backfilling %d chat(s)...", len(chats))

        for chat in chats:
            _backfill_chat(session, chat)
            processed += 1
            if processed % 50 == 0:
                logger.info("Processed %d chats...", processed)

        logger.info("Backfill complete. %d chat(s) processed.", processed)
    finally:
        session.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill chat states and snapshots.")
    parser.add_argument("--limit", type=int, default=0, help="Maximum number of chats to process (0 = all).")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
    backfill(args.limit)


if __name__ == "__main__":
    main()
