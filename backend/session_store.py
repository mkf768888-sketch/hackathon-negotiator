import uuid
from dataclasses import dataclass, field


@dataclass
class Session:
    session_id: str
    character: str
    history: list[tuple[str, str]] = field(default_factory=list)  # [("Игрок"/"Оппонент", text), ...]
    round: int = 0
    batna_cumulative: float = 0.0
    trigger_used: bool = False
    turns: list[dict] = field(default_factory=list)  # полные записи ходов для «разбора полётов»

    def history_text(self, last_n: int = 10) -> str:
        recent = self.history[-last_n * 2:]
        return "\n".join(f"{role}: {text}" for role, text in recent) or "(диалог только начинается)"

    def record_turn(self, player_text: str, result, batna_after: float) -> None:
        self.turns.append({
            "round": self.round,
            "player_text": player_text,
            "opponent_text": result.text,
            "batna_shift": result.batna_shift,
            "batna_after": batna_after,
            "hidden_emotion": result.hidden_emotion.model_dump(),
            "trigger_event": result.trigger_event,
            "hidden_interest_revealed": result.hidden_interest_revealed,
        })

    def transcript_for_debrief(self) -> str:
        lines = []
        for t in self.turns:
            lines.append(f"[Раунд {t['round']}] Игрок: {t['player_text']}")
            emo = t["hidden_emotion"]
            leak = " (СКРЫТАЯ УТЕЧКА, не совпадает со словами)" if emo.get("leak_type") == "incongruent_with_text" else ""
            lines.append(
                f"[Раунд {t['round']}] Оппонент: {t['opponent_text']} "
                f"[эмоция: {emo.get('primary')} интенсивность={emo.get('intensity')}{leak}, "
                f"сдвиг BATNA={t['batna_shift']:+.2f}]"
            )
            if t["hidden_interest_revealed"]:
                lines.append(f"  → раскрыт скрытый интерес: {t['hidden_interest_revealed']}")
            if t["trigger_event"]:
                lines.append(f"  → триггер-событие: {t['trigger_event']}")
        return "\n".join(lines) or "(раундов не было)"


_sessions: dict[str, Session] = {}


def create_session(character: str) -> Session:
    session_id = uuid.uuid4().hex[:12]
    session = Session(session_id=session_id, character=character)
    _sessions[session_id] = session
    return session


def get_session(session_id: str) -> Session | None:
    return _sessions.get(session_id)
