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
