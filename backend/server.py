import logging
import os

from dotenv import load_dotenv

load_dotenv()  # must run before llm_router is imported — it reads keys from os.getenv() at import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from characters import CHARACTERS, FACS_MAPPING
from engine import generate_turn, opening_turn, generate_debrief
from llm_router import DEEPSEEK_API_KEY, ANTHROPIC_API_KEY
from models import StartSessionRequest, StartSessionResponse, TurnResponse, DebriefResponse
from session_store import create_session, get_session

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Симулятор живого человека — Negotiator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("FRONTEND_ORIGIN", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


def _clamp(value: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


@app.get("/health")
def health():
    return {
        "status": "ok",
        "deepseek_key_set": bool(DEEPSEEK_API_KEY),
        "claude_key_set": bool(ANTHROPIC_API_KEY),
    }


@app.get("/characters")
def list_characters():
    return [
        {"key": key, "name": c["name"], "short_description": c["short_description"]}
        for key, c in CHARACTERS.items()
    ]


@app.get("/facs-mapping")
def facs_mapping():
    return FACS_MAPPING


@app.post("/session/start", response_model=StartSessionResponse)
def start_session(req: StartSessionRequest):
    if req.character not in CHARACTERS:
        raise HTTPException(status_code=400, detail="unknown character")

    session = create_session(req.character)
    opening = opening_turn(req.character)

    return StartSessionResponse(
        session_id=session.session_id,
        character=req.character,
        character_name=CHARACTERS[req.character]["name"],
        opening=TurnResponse(
            **opening.model_dump(),
            round=0,
            batna_cumulative=0.0,
            session_id=session.session_id,
            source="hardcoded_fallback",
        ),
    )


@app.get("/session/{session_id}/debrief", response_model=DebriefResponse)
async def debrief(session_id: str):
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")

    score = await generate_debrief(session)
    return DebriefResponse(
        session_id=session_id,
        rounds=session.round,
        final_batna=session.batna_cumulative,
        score=score,
    )


@app.websocket("/ws/{session_id}")
async def ws_negotiate(websocket: WebSocket, session_id: str):
    session = get_session(session_id)
    if session is None:
        await websocket.close(code=4404, reason="session not found")
        return

    await websocket.accept()
    try:
        while True:
            payload = await websocket.receive_json()
            player_text = (payload.get("message") or "").strip()
            if not player_text:
                continue

            result, source = await generate_turn(session, player_text)

            # Серверная страховка: триггер-событие не чаще раза за сессию, что бы ни вернула модель
            if session.trigger_used and result.trigger_event is not None:
                result.trigger_event = None
            elif result.trigger_event is not None:
                session.trigger_used = True

            shift = _clamp(result.batna_shift)
            session.batna_cumulative = _clamp(session.batna_cumulative + shift)
            session.history.append(("Игрок", player_text))
            session.history.append(("Оппонент", result.text))
            session.round += 1
            session.record_turn(player_text, result, session.batna_cumulative)

            response = TurnResponse(
                **result.model_dump(),
                round=session.round,
                batna_cumulative=session.batna_cumulative,
                session_id=session.session_id,
                source=source,
            )
            await websocket.send_json(response.model_dump())
    except WebSocketDisconnect:
        pass
