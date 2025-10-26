from __future__ import annotations
import os
from typing import Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from ..models import (
    InterviewReportRequest,
    CandidateAssessmentReport,
    InterviewerAssessmentReport,
    OverallInterviewSummary
)


def get_llm(model: Optional[str] = None) -> ChatGoogleGenerativeAI:
    model_id = model or "gemini-2.0-flash"
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY environment variable is not set")
    return ChatGoogleGenerativeAI(model=model_id, google_api_key=api_key, temperature=0.2)


def generate_candidate_assessment(req: InterviewReportRequest) -> CandidateAssessmentReport:
    """Generate candidate assessment report for the interviewer."""
    
    llm = get_llm(req.model)
    
    # Build the prompt with gaze analysis if available
    gaze_context = ""
    if req.gaze_analysis:
        gaze_context = f"\n\nGaze Heatmap Analysis:\n{req.gaze_analysis}"
    
    criteria_context = ""
    if req.template_criteria:
        criteria_context = f"\n\nInterview Criteria to Evaluate Against:\n" + "\n".join(f"- {c}" for c in req.template_criteria)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", 
         "You are an expert technical interviewer providing a comprehensive candidate assessment. "
         "Analyze all provided information holistically and provide structured feedback."
        ),
        ("human", 
         "Holistically assess the competence of the candidate. First, use the gaze heatmap analysis "
         "to predict the likelihood of cheating from: extremely low, low, medium, medium likely, "
         "quite likely, definitely. Then, consider both the strengths and weaknesses of the responses "
         "presented in the transcript. Make sure to match the candidate's traits against the criteria "
         "in the template. Lastly, for each of the technical questions, grade the candidate response "
         "and analyze their code quality. Suggest whether the firm should hire.\n\n"
         "Interview Transcript:\n{transcript}\n\n"
         "Technical Questions and Answers:\n{questions_and_answers}"
         "{gaze_context}"
         "{criteria_context}"
        )
    ])
    
    try:
        structured = llm.with_structured_output(CandidateAssessmentReport)
        result = structured.invoke({
            "transcript": req.transcript,
            "questions_and_answers": req.questions_and_answers,
            "gaze_context": gaze_context,
            "criteria_context": criteria_context
        })
        
        if isinstance(result, dict):
            return CandidateAssessmentReport.model_validate(result)
        return result
        
    except Exception as e:
        # Fallback to basic prompting if structured output fails
        chain = prompt | llm
        result = chain.invoke({
            "transcript": req.transcript,
            "questions_and_answers": req.questions_and_answers,
            "gaze_context": gaze_context,
            "criteria_context": criteria_context
        })
        
        # Parse the response manually - this is a simplified fallback
        content = getattr(result, "content", str(result))
        
        # Create a basic assessment if structured parsing fails
        return CandidateAssessmentReport(
            cheating_likelihood="medium",
            strengths=["Assessment generated"],
            weaknesses=["Manual review needed"],
            criteria_match=content[:200] + "..." if len(content) > 200 else content,
            technical_grades=[{"overall": "Manual review required"}],
            recommendation="Manual review recommended",
            overall_assessment=content[:300] + "..." if len(content) > 300 else content
        )


def generate_interviewer_assessment(req: InterviewReportRequest) -> InterviewerAssessmentReport:
    """Generate interviewer assessment report for the manager."""
    
    llm = get_llm(req.model)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are a senior manager evaluating interviewer performance. Provide comprehensive "
         "feedback on interviewing skills, professionalism, and effectiveness."
        ),
        ("human",
         "Holistically assess the friendliness, professionalism and interviewing ability of the "
         "interviewer. Then, consider both the strengths and weaknesses of the responses presented "
         "in the transcript from the interviewer. Provide extensive feedback and suggestions, "
         "both the positives and the negatives.\n\n"
         "Interview Transcript:\n{transcript}\n\n"
         "Technical Questions and Answers:\n{questions_and_answers}"
        )
    ])
    
    try:
        structured = llm.with_structured_output(InterviewerAssessmentReport)
        result = structured.invoke({
            "transcript": req.transcript,
            "questions_and_answers": req.questions_and_answers
        })
        
        if isinstance(result, dict):
            return InterviewerAssessmentReport.model_validate(result)
        return result
        
    except Exception as e:
        # Fallback
        chain = prompt | llm
        result = chain.invoke({
            "transcript": req.transcript,
            "questions_and_answers": req.questions_and_answers
        })
        
        content = getattr(result, "content", str(result))
        
        return InterviewerAssessmentReport(
            friendliness_score="Good",
            professionalism_score="Good", 
            interviewing_ability="Good",
            strengths=["Assessment generated"],
            weaknesses=["Manual review needed"],
            positive_feedback=content[:200] + "..." if len(content) > 200 else content,
            negative_feedback="Manual review recommended",
            suggestions=["Review full assessment"]
        )


def generate_overall_summary(req: InterviewReportRequest) -> OverallInterviewSummary:
    """Generate overall interview summary."""
    
    llm = get_llm(req.model)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are an expert interview analyst providing a comprehensive overview of the entire "
         "interview process. Synthesize all information to provide balanced, actionable insights."
        ),
        ("human",
         "As an overall summary of the interview: Summarize the progress, the points discussed "
         "by both parties. Judge the competence shown by the candidate, and the interviewing "
         "attitude from the interviewer. Summarize and provide a holistic overview on whether "
         "the firm should hire the candidate.\n\n"
         "Interview Transcript:\n{transcript}\n\n"
         "Technical Questions and Answers:\n{questions_and_answers}"
        )
    ])
    
    try:
        structured = llm.with_structured_output(OverallInterviewSummary)
        result = structured.invoke({
            "transcript": req.transcript,
            "questions_and_answers": req.questions_and_answers
        })
        
        if isinstance(result, dict):
            return OverallInterviewSummary.model_validate(result)
        return result
        
    except Exception as e:
        # Fallback
        chain = prompt | llm
        result = chain.invoke({
            "transcript": req.transcript,
            "questions_and_answers": req.questions_and_answers
        })
        
        content = getattr(result, "content", str(result))
        
        return OverallInterviewSummary(
            interview_progress="Interview completed",
            key_discussion_points=["Technical discussion", "General conversation"],
            candidate_competence=content[:200] + "..." if len(content) > 200 else content,
            interviewer_attitude="Professional approach observed",
            hiring_recommendation="Manual review recommended",
            holistic_overview=content[:300] + "..." if len(content) > 300 else content
        )
