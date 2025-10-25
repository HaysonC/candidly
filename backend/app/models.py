from __future__ import annotations
from typing import List, Optional, Dict, Set
from pydantic import BaseModel, Field

# -------- Core interview session models --------
class InterviewSession(BaseModel):
    candidate_name: str
    candidate_email: str
    notes: Optional[str] = ""
    interviewer_name: str

# -------- AI interview prep models --------
class CriteriaArea(BaseModel):
    name: str = Field(..., description="Area name, e.g., Problem Solving")
    description: str = Field(..., description="What to look for and why it matters")

class InterviewCriteria(BaseModel):
    overview: str = Field(..., description="High-level guidance for interview focus")
    areas: List[CriteriaArea] = Field(..., description="Specific criteria areas to evaluate")

class CodingQuestion(BaseModel):
    id: str = Field(..., description="Stable slug-like id, lowercase with dashes")
    title: str
    prompt: str = Field(..., description="Candidate-facing prompt text")
    difficulty: str = Field(..., description="one of: easy | medium | hard")
    topics: List[str] = Field(default_factory=list)

class InterviewPrepResponse(BaseModel):
    criteria: InterviewCriteria
    coding_questions: List[CodingQuestion] = Field(default_factory=list)

class InterviewPrepRequest(BaseModel):
    text: str = Field(..., description="Input context to analyze and derive interview prep from")
    model: Optional[str] = Field("gemini-2.0-flash", description="LLM model id to use")


# -------- Templates per Account (Interviewer) --------
class Template(BaseModel):
    id: str
    account: str = Field(..., description="Interviewer account name (use interviewer_name for now)")
    name: str
    criteria: List[str] = Field(default_factory=list)
    coding_questions: List[str] = Field(default_factory=list)

class TemplateCreate(BaseModel):
    account: str
    name: str = "Untitled Template"
    criteria: List[str] = Field(default_factory=list)
    coding_questions: List[str] = Field(default_factory=list)

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    criteria: Optional[List[str]] = None
    coding_questions: Optional[List[str]] = None


# -------- In-memory state typing helpers (referenced by server) --------
try:
    # These are only for type hints in server; actual values live in server or state module
    from fastapi import WebSocket  # type: ignore
except Exception:  # pragma: no cover
    class WebSocket:  # minimal stub for type checking when FastAPI is not loaded
        pass

RoomsType = Dict[str, Set[WebSocket]]
WebsocketRolesType = Dict[WebSocket, str]
