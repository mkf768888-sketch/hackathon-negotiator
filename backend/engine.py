"""
Оркестрация одного хода диалога: DeepSeek (черновик) → Claude (валидация) → TurnResult.
Спроектировано так, чтобы сбой любой из моделей не ронял демо — есть fallback-цепочка.
"""

import json
import re
import logging

from characters import character_system_prompt, CHARACTERS
from llm_router import call_deepseek, call_claude
from models import TurnResult, HiddenEmotion, NegotiationScore
from session_store import Session

logger = logging.getLogger(__name__)

OPENING_EMOTIONS = {
    "torgash": HiddenEmotion(primary="contempt", intensity=0.3, is_microexpression=False,
                              duration_ms=250, facs_action_units=["AU10", "AU12"],
                              leak_type="consistent_with_text"),
    "burokrat": HiddenEmotion(primary="fear", intensity=0.2, is_microexpression=True,
                               duration_ms=120, facs_action_units=["AU1", "AU2"],
                               leak_type="incongruent_with_text"),
    "partner": HiddenEmotion(primary="joy", intensity=0.5, is_microexpression=False,
                              duration_ms=300, facs_action_units=["AU6", "AU12"],
                              leak_type="consistent_with_text"),
    "molchun": HiddenEmotion(primary="fear", intensity=0.15, is_microexpression=True,
                              duration_ms=100, facs_action_units=["AU4"],
                              leak_type="incongruent_with_text"),
    "panicker": HiddenEmotion(primary="fear", intensity=0.7, is_microexpression=False,
                               duration_ms=300, facs_action_units=["AU1", "AU2"],
                               leak_type="consistent_with_text"),
    "znatok": HiddenEmotion(primary="contempt", intensity=0.35, is_microexpression=False,
                             duration_ms=280, facs_action_units=["AU10", "AU12"],
                             leak_type="consistent_with_text"),
    "praktik": HiddenEmotion(primary="disgust", intensity=0.1, is_microexpression=True,
                              duration_ms=90, facs_action_units=["AU9"],
                              leak_type="incongruent_with_text"),
    "zhertva": HiddenEmotion(primary="sadness", intensity=0.5, is_microexpression=False,
                              duration_ms=280, facs_action_units=["AU15"],
                              leak_type="consistent_with_text"),
    "idealist": HiddenEmotion(primary="contempt", intensity=0.2, is_microexpression=True,
                               duration_ms=110, facs_action_units=["AU10", "AU12"],
                               leak_type="incongruent_with_text"),
}


def _extract_json(raw: str) -> dict | None:
    if not raw:
        return None
    text = raw.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1 or end < start:
        return None
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None


def _safe_turn_result(data: dict) -> TurnResult | None:
    try:
        return TurnResult(**data)
    except Exception as e:
        logger.warning("TurnResult validation failed: %s", e)
        return None


def opening_turn(character_key: str) -> TurnResult:
    from characters import CHARACTERS
    return TurnResult(
        text=CHARACTERS[character_key]["opening_line"],
        hidden_emotion=OPENING_EMOTIONS[character_key],
        batna_shift=0.0,
        trigger_event=None,
        hidden_interest_revealed=None,
    )


async def generate_turn(session: Session, player_text: str) -> tuple[TurnResult, str]:
    system_prompt = character_system_prompt(session.character, session.context)
    trigger_note = (
        "Триггер-событие уже было использовано в этой сессии — НЕ используй его снова, верни trigger_event: null."
        if session.trigger_used else
        "Триггер-событие ещё не использовано — можно использовать один раз за сессию, если контекст подходит."
    )

    user_message = f"""Раунд: {session.round + 1}
{trigger_note}

История диалога:
{session.history_text()}

Реплика игрока: {player_text}

Верни JSON строго по схеме, без пояснений и markdown-обёртки."""

    draft = await call_deepseek(system_prompt, user_message)
    draft_json = _extract_json(draft.content) if not draft.error else None
    draft_result = _safe_turn_result(draft_json) if draft_json else None

    if draft_result is None:
        fallback_text = (draft.content or "").strip()[:400] or "Секунду, соберусь с мыслями..."
        return TurnResult(text=fallback_text, hidden_emotion=HiddenEmotion()), "hardcoded_fallback"

    validation_prompt = f"""Черновая реплика от DeepSeek (JSON):
{json.dumps(draft_json, ensure_ascii=False)}

Проверь: соответствует ли характеру и болевым точкам персонажа, не слит ли скрытый интерес
раньше времени, корректен ли leak_type и facs_action_units. {trigger_note}
Если что-то не так — перепиши text и/или JSON целиком (не просто поправь тег).
Верни финальный JSON строго по схеме, без пояснений."""

    final = await call_claude(system_prompt, validation_prompt)
    final_json = _extract_json(final.content) if not final.error else None
    final_result = _safe_turn_result(final_json) if final_json else None

    if final_result is not None:
        return final_result, "claude"
    return draft_result, "deepseek_fallback"


DEBRIEF_SCHEMA_INSTRUCTIONS = """Ответ строго в этом JSON-формате, без markdown-обёртки, без текста до/после:
{
  "goal_completion": 0.0,
  "batna_defense": 0.0,
  "information_discipline": 0.0,
  "rapport": 0.0,
  "tactic_variety": 0.0,
  "emotional_composure": 0.0,
  "summary": "Один-два абзаца честного разбора на русском",
  "strengths": ["сильная сторона 1", "..."],
  "improvements": ["что улучшить 1", "..."]
}

Все числовые поля — от 0.0 (плохо) до 1.0 (отлично), где 1.0 ВСЕГДА означает лучший результат для игрока:
- goal_completion — добился ли игрок выгодного исхода с учётом реального BATNA и скрытых интересов персонажа
- batna_defense — не сдал ли игрок позицию хуже своей реальной BATNA
- information_discipline — не раскрыл ли оппонент скрытые интересы/BATNA раньше, чем игрок это заслужил правильными вопросами
- rapport — качество выстроенных отношений (не то же самое, что уступчивость)
- tactic_variety — использовал ли игрок разные техники (SPIN-вопросы, объективные критерии, структуру вместо эмоций), а не только давление
- emotional_composure — не поддался ли игрок на манипуляции персонажа (паника, жалость, авторитет, молчание) и правильно ли считал утечки эмоций"""


def _fallback_score(session: Session) -> NegotiationScore:
    """Гарантированный запасной разбор без ИИ — чтобы демо никогда не падало."""
    revealed = sum(1 for t in session.turns if t["hidden_interest_revealed"])
    outcome = round((session.batna_cumulative + 1) / 2, 2)  # -1..1 → 0..1
    return NegotiationScore(
        goal_completion=outcome,
        batna_defense=outcome,
        information_discipline=round(min(1.0, 0.4 + 0.15 * revealed), 2),
        rapport=outcome,
        tactic_variety=0.5,
        emotional_composure=0.5,
        summary=(
            f"Автоматическая оценка (детальный разбор от ИИ временно недоступен). "
            f"Финальный баланс переговоров: {session.batna_cumulative:+.2f} за {session.round} раунд(ов)."
        ),
        strengths=["Довели переговоры до конца"] if session.round > 0 else [],
        improvements=["Попробуйте варьировать тактики в следующей сессии"],
    )


async def generate_debrief(session: Session) -> NegotiationScore:
    if not session.turns:
        return _fallback_score(session)

    char = CHARACTERS[session.character]
    system_prompt = (
        "Ты — независимый коуч по переговорам, оцениваешь ЗАВЕРШЁННУЮ сессию тренажёра. "
        "Смотри на неё глазами эксперта: у оппонента были реальные скрытые интересы и BATNA "
        "(указаны ниже) — сравни, что игрок реально выяснил и чего добился, с тем, что было "
        "объективно возможно. Будь честным и конкретным, не льсти."
    )
    user_message = f"""Персонаж оппонента: {char['name']}
Его реальные скрытые интересы и BATNA (для твоей оценки, игрок этого не видел):
{char['prompt']}

Полная стенограмма сессии ({session.round} раунд(ов), финальный баланс BATNA игрока: {session.batna_cumulative:+.2f}):
{session.transcript_for_debrief()}

{DEBRIEF_SCHEMA_INSTRUCTIONS}"""

    result = await call_claude(system_prompt, user_message, max_tokens=1200)
    data = _extract_json(result.content) if not result.error else None
    if data is None:
        return _fallback_score(session)
    try:
        return NegotiationScore(**data)
    except Exception as e:
        logger.warning("NegotiationScore validation failed: %s", e)
        return _fallback_score(session)
