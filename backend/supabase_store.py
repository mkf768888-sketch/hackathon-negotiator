"""Best-effort сохранение результатов сессии в Supabase — компания видит историю
своих сотрудников. Полностью необязательно: без SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
эта запись просто ничего не делает и не блокирует основной сценарий (тренажёр
должен продолжать работать и без завёденного проекта Supabase — как раньше).
"""
import logging
import os
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from models import NegotiationScore
    from session_store import Session

logger = logging.getLogger(__name__)

_client = None
_client_init_attempted = False


def _get_client():
    global _client, _client_init_attempted
    if _client_init_attempted:
        return _client
    _client_init_attempted = True

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None

    try:
        from supabase import create_client
        _client = create_client(url, key)
    except Exception as exc:  # пакет не поставлен, битые ключи и т.п.
        logger.warning("Supabase client init failed (persistence disabled): %s", exc)
        _client = None
    return _client


def save_session_result(session: "Session", score: "NegotiationScore", user_id: Optional[str]) -> None:
    """Никогда не бросает исключение — сбой записи не должен ломать выдачу разбора игроку."""
    client = _get_client()
    if client is None:
        return

    try:
        client.table("sessions").insert({
            "session_id": session.session_id,
            "user_id": user_id,
            "character": session.character,
            "rounds": session.round,
            "final_batna": session.batna_cumulative,
            "context": session.context.model_dump() if session.context else None,
            "score": score.model_dump(),
        }).execute()
    except Exception as exc:
        logger.warning("Supabase session persist failed (non-fatal): %s", exc)
