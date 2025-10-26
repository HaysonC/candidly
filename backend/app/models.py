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


# -------- Candidates per Account (Interviewer) --------
class CreateCandidateRequest(BaseModel):
    interviewer: str = Field(..., description="Account/interviewer name")
    interviewee: str = Field(..., description="Candidate name")


class CandidateListRequest(BaseModel):
    interviewer: str = Field(..., description="Account/interviewer name")


class CandidateTrackingRequest(BaseModel):
    interviewer: str = Field(..., description="Account/interviewer name")
    timestamp: Optional[str] = Field(None, description="Optional timestamp folder to read; defaults to latest")


class CandidateFilePutRequest(BaseModel):
    interviewer: str = Field(..., description="Account/interviewer name")
    filename: str = Field(..., description="Filename to create or replace inside timestamp dir")
    content: Optional[str] = Field(None, description="Raw string content to write to the file (UTF-8)")
    contentBase64: Optional[str] = Field(None, description="Base64-encoded file content for binary uploads (omit data: prefix)")
    timestamp: Optional[str] = Field(None, description="Optional timestamp folder; defaults to latest or a new one if none exist")


# -------- PDF Report Generation Models --------
class InterviewReportRequest(BaseModel):
    interviewer: str = Field(..., description="Account/interviewer name")
    candidate_name: str = Field(..., description="Candidate name")
    transcript: str = Field(..., description="Interview transcript")
    questions_and_answers: str = Field(..., description="Technical questions and candidate responses")
    gaze_analysis: Optional[str] = Field(None, description="Gaze heatmap analysis or description")
    template_criteria: Optional[List[str]] = Field(default_factory=list, description="Interview criteria from template")
    model: Optional[str] = Field("gemini-2.0-flash", description="LLM model id to use")


class CandidateAssessmentReport(BaseModel):
    cheating_likelihood: str = Field(..., description="Cheating assessment: extremely low, low, medium, medium likely, quite likely, definitely")
    strengths: List[str] = Field(..., description="Candidate's strengths observed")
    weaknesses: List[str] = Field(..., description="Candidate's weaknesses observed")
    criteria_match: str = Field(..., description="How well candidate matches template criteria")
    technical_grades: List[Dict[str, str]] = Field(..., description="Technical question grades and analysis")
    recommendation: str = Field(..., description="Hiring recommendation with reasoning")
    overall_assessment: str = Field(..., description="Holistic competence assessment")


class InterviewerAssessmentReport(BaseModel):
    friendliness_score: str = Field(..., description="Assessment of interviewer's friendliness")
    professionalism_score: str = Field(..., description="Assessment of interviewer's professionalism")
    interviewing_ability: str = Field(..., description="Assessment of interviewing skills")
    strengths: List[str] = Field(..., description="Interviewer's strengths")
    weaknesses: List[str] = Field(..., description="Areas for improvement")
    positive_feedback: str = Field(..., description="Positive aspects of the interview")
    negative_feedback: str = Field(..., description="Areas needing improvement")
    suggestions: List[str] = Field(..., description="Specific suggestions for improvement")


class OverallInterviewSummary(BaseModel):
    interview_progress: str = Field(..., description="Summary of how the interview progressed")
    key_discussion_points: List[str] = Field(..., description="Main topics and points discussed")
    candidate_competence: str = Field(..., description="Assessment of candidate's technical competence")
    interviewer_attitude: str = Field(..., description="Assessment of interviewer's approach and attitude")
    hiring_recommendation: str = Field(..., description="Final recommendation on hiring")
    holistic_overview: str = Field(..., description="Overall summary and conclusion")
