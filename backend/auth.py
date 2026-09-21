"""Опциональная проверка входа через Supabase Auth.

Ничего не требует: если SUPABASE_JWT_SECRET не задан или заголовок Authorization
отсутствует/битый — просто возвращаем None (анонимная демо-сессия), как и было
раньше. Это важно для ТЗ хакатона: жюри должно суметь запустить прототип без
регистрации аккаунтов.
"""
import logging
import os
from typing import Optional

import jwt

logger = logging.getLogger(__name__)

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")


def user_id_from_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not SUPABASE_JWT_SECRET:
        return None
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        return None
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload.get("sub")
    except jwt.PyJWTError as exc:
        logger.warning("bad Supabase JWT (treated as anonymous): %s", exc)
        return None
