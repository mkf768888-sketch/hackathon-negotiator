"""
Симулятор живого человека — LLM-роутер
Адаптация llm_router.py (babylon_bot) под связку DeepSeek (генерация) → Claude (валидация).
"""

import os
import time
import logging
from typing import Optional
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-haiku-4-5-20251001")

DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
CLAUDE_URL = "https://api.anthropic.com/v1/messages"


@dataclass
class LLMResponse:
    content: str
    tokens_used: int = 0
    latency_ms: int = 0
    error: Optional[str] = None


async def call_deepseek(system_prompt: str, user_message: str, max_tokens: int = 900, temperature: float = 0.8) -> LLMResponse:
    """DeepSeek V3 — генерирует черновую реплику оппонента."""
    if not DEEPSEEK_API_KEY:
        return LLMResponse("", error="DEEPSEEK_API_KEY not set")

    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                DEEPSEEK_URL,
                headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            tokens = data.get("usage", {}).get("total_tokens", 0)
            return LLMResponse(content=content, tokens_used=tokens, latency_ms=int((time.time() - start) * 1000))
    except Exception as e:
        logger.warning("DeepSeek call failed: %s", e)
        return LLMResponse("", error=str(e))


async def call_claude(system_prompt: str, user_message: str, max_tokens: int = 900) -> LLMResponse:
    """Claude — второй проход: валидация характера + финальный эмоциональный тег."""
    if not ANTHROPIC_API_KEY:
        return LLMResponse("", error="ANTHROPIC_API_KEY not set")

    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                CLAUDE_URL,
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": CLAUDE_MODEL,
                    "max_tokens": max_tokens,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_message}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["content"][0]["text"]
            usage = data.get("usage", {})
            tokens = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
            return LLMResponse(content=content, tokens_used=tokens, latency_ms=int((time.time() - start) * 1000))
    except Exception as e:
        logger.warning("Claude call failed: %s", e)
        return LLMResponse("", error=str(e))
