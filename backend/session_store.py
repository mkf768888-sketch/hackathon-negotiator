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

    def history_text(self, last_n: int = 10) -> str:
        recent = self.history[-last_n * 2:]
        return "\n".join(f"{role}: {text}" for role, text in recent) or "(диалог только начинается)"


_sessions: dict[str, Session] = {}


def create_session(character: str) -> Session:
    session_id = uuid.uuid4().hex[:12]
    session = Session(session_id=session_id, character=character)
    _sessions[session_id] = session
    return session


def get_session(session_id: str) -> Session | None:
    return _sessions.get(session_id)
