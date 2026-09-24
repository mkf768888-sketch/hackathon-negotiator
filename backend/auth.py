"""Опциональная проверка входа через Supabase Auth.

Ничего не требует: если SUPABASE_URL не задан, заголовок Authorization
отсутствует/битый, или JWKS недоступен — просто возвращаем None (анонимная
демо-сессия), как и было раньше. Это важно для ТЗ хакатона: жюри должно суметь
запустить прототип без регистрации аккаунтов.

Проверяем подпись через публичный JWKS проекта, а не через общий HS256-секрет:
новые проекты Supabase (с 2026 года) по умолчанию подписывают токены
асимметричным ключом (ES256), общий секрет для них не подходит.
"""
import logging
import os
from typing import Optional

import jwt
from jwt import PyJWKClient

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")

_jwks_client: Optional[PyJWKClient] = None
_jwks_client_init_attempted = False


def _get_jwks_client() -> Optional[PyJWKClient]:
    global _jwks_client, _jwks_client_init_attempted
    if _jwks_client_init_attempted:
        return _jwks_client
    _jwks_client_init_attempted = True
    if not SUPABASE_URL:
        return None
    try:
        _jwks_client = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
    except Exception as exc:  # сеть недоступна и т.п. — не блокируем анонимный сценарий
        logger.warning("Supabase JWKS client init failed (auth disabled): %s", exc)
        _jwks_client = None
    return _jwks_client


def user_id_from_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        return None
    client = _get_jwks_client()
    if not client:
        return None
    try:
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
        return payload.get("sub")
    except jwt.PyJWTError as exc:
        logger.warning("bad Supabase JWT (treated as anonymous): %s", exc)
        return None
