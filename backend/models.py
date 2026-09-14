from typing import Literal, Optional
from pydantic import BaseModel, Field


class HiddenEmotion(BaseModel):
    primary: Literal["joy", "anger", "fear", "surprise", "disgust", "sadness", "contempt"] = "sadness"
    intensity: float = 0.0
    is_microexpression: bool = False
    duration_ms: int = 100
    facs_action_units: list[str] = Field(default_factory=list)
    leak_type: Literal["incongruent_with_text", "consistent_with_text"] = "consistent_with_text"


class TurnResult(BaseModel):
    text: str
    hidden_emotion: HiddenEmotion
    batna_shift: float = 0.0
    trigger_event: Optional[str] = None
    hidden_interest_revealed: Optional[str] = None


class TurnResponse(TurnResult):
    round: int
    batna_cumulative: float
    session_id: str
    source: Literal["claude", "deepseek_fallback", "hardcoded_fallback"] = "claude"


class StartSessionRequest(BaseModel):
    character: Literal[
        "torgash", "burokrat", "partner", "molchun", "panicker",
        "znatok", "praktik", "zhertva", "idealist",
    ]


class StartSessionResponse(BaseModel):
    session_id: str
    character: str
    character_name: str
    opening: TurnResponse


class NegotiationScore(BaseModel):
    """Оси радар-чарта «разбора полётов» — все от 0 до 1, где 1 всегда означает
    «хорошо» (согласованное направление, чтобы полигон на радаре читался интуитивно)."""
    goal_completion: float = Field(ge=0, le=1, description="Достигнут ли выгодный игроку исход")
    batna_defense: float = Field(ge=0, le=1, description="Насколько хорошо защищена своя BATNA/не слился по цене")
    information_discipline: float = Field(ge=0, le=1, description="Не слил ли лишнюю информацию раньше времени")
    rapport: float = Field(ge=0, le=1, description="Качество выстроенных отношений с оппонентом")
    tactic_variety: float = Field(ge=0, le=1, description="Разнообразие применённых техник переговоров")
    emotional_composure: float = Field(ge=0, le=1, description="Собственное самообладание + считывание чужих утечек")
    summary: str = ""
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)


class DebriefResponse(BaseModel):
    session_id: str
    rounds: int
    final_batna: float
    score: NegotiationScore
