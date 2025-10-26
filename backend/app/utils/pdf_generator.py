from __future__ import annotations
import io
from typing import Dict, Any
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor


def create_candidate_assessment_pdf(assessment: Dict[str, Any], candidate_name: str) -> bytes:
    """Generate PDF for candidate assessment report."""
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=18,
        textColor=HexColor('#2C3E50'),
        spaceAfter=20
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=HexColor('#34495E'),
        spaceBefore=15,
        spaceAfter=10
    )
    
    story = []
    
    # Title
    story.append(Paragraph(f"Candidate Assessment Report: {candidate_name}", title_style))
    story.append(Spacer(1, 20))
    
    # Cheating Assessment
    story.append(Paragraph("Cheating Likelihood Assessment", heading_style))
    story.append(Paragraph(f"<b>Assessment:</b> {assessment.get('cheating_likelihood', 'Not assessed')}", styles['Normal']))
    story.append(Spacer(1, 15))
    
    # Strengths
    story.append(Paragraph("Strengths", heading_style))
    strengths = assessment.get('strengths', [])
    if strengths:
        for strength in strengths:
            story.append(Paragraph(f"• {strength}", styles['Normal']))
    else:
        story.append(Paragraph("No specific strengths identified", styles['Normal']))
    story.append(Spacer(1, 15))
    
    # Weaknesses
    story.append(Paragraph("Areas for Improvement", heading_style))
    weaknesses = assessment.get('weaknesses', [])
    if weaknesses:
        for weakness in weaknesses:
            story.append(Paragraph(f"• {weakness}", styles['Normal']))
    else:
        story.append(Paragraph("No specific weaknesses identified", styles['Normal']))
    story.append(Spacer(1, 15))
    
    # Criteria Match
    story.append(Paragraph("Criteria Evaluation", heading_style))
    story.append(Paragraph(assessment.get('criteria_match', 'Not evaluated'), styles['Normal']))
    story.append(Spacer(1, 15))
    
    # Technical Grades
    story.append(Paragraph("Technical Assessment", heading_style))
    technical_grades = assessment.get('technical_grades', [])
    if technical_grades:
        for grade in technical_grades:
            for question, analysis in grade.items():
                story.append(Paragraph(f"<b>{question}:</b> {analysis}", styles['Normal']))
    else:
        story.append(Paragraph("No technical assessments available", styles['Normal']))
    story.append(Spacer(1, 15))
    
    # Recommendation
    story.append(Paragraph("Hiring Recommendation", heading_style))
    story.append(Paragraph(assessment.get('recommendation', 'No recommendation provided'), styles['Normal']))
    story.append(Spacer(1, 15))
    
    # Overall Assessment
    story.append(Paragraph("Overall Assessment", heading_style))
    story.append(Paragraph(assessment.get('overall_assessment', 'No overall assessment provided'), styles['Normal']))
    
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def create_interviewer_assessment_pdf(assessment: Dict[str, Any], interviewer_name: str) -> bytes:
    """Generate PDF for interviewer assessment report."""
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=18,
        textColor=HexColor('#2C3E50'),
        spaceAfter=20
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=HexColor('#34495E'),
        spaceBefore=15,
        spaceAfter=10
    )
    
    story = []
    
    # Title
    story.append(Paragraph(f"Interviewer Performance Review: {interviewer_name}", title_style))
    story.append(Spacer(1, 20))
    
    # Performance Scores
    story.append(Paragraph("Performance Assessment", heading_style))
    story.append(Paragraph(f"<b>Friendliness:</b> {assessment.get('friendliness_score', 'Not assessed')}", styles['Normal']))
    story.append(Paragraph(f"<b>Professionalism:</b> {assessment.get('professionalism_score', 'Not assessed')}", styles['Normal']))
    story.append(Paragraph(f"<b>Interviewing Ability:</b> {assessment.get('interviewing_ability', 'Not assessed')}", styles['Normal']))
    story.append(Spacer(1, 15))
    
    # Strengths
    story.append(Paragraph("Strengths", heading_style))
    strengths = assessment.get('strengths', [])
    if strengths:
        for strength in strengths:
            story.append(Paragraph(f"• {strength}", styles['Normal']))
    else:
        story.append(Paragraph("No specific strengths identified", styles['Normal']))
    story.append(Spacer(1, 15))
    
    # Weaknesses
    story.append(Paragraph("Areas for Development", heading_style))
    weaknesses = assessment.get('weaknesses', [])
    if weaknesses:
        for weakness in weaknesses:
            story.append(Paragraph(f"• {weakness}", styles['Normal']))
    else:
        story.append(Paragraph("No specific areas for development identified", styles['Normal']))
    story.append(Spacer(1, 15))
    
    # Positive Feedback
    story.append(Paragraph("Positive Feedback", heading_style))
    story.append(Paragraph(assessment.get('positive_feedback', 'No positive feedback provided'), styles['Normal']))
    story.append(Spacer(1, 15))
    
    # Negative Feedback
    story.append(Paragraph("Areas for Improvement", heading_style))
    story.append(Paragraph(assessment.get('negative_feedback', 'No areas for improvement identified'), styles['Normal']))
    story.append(Spacer(1, 15))
    
    # Suggestions
    story.append(Paragraph("Suggestions for Improvement", heading_style))
    suggestions = assessment.get('suggestions', [])
    if suggestions:
        for suggestion in suggestions:
            story.append(Paragraph(f"• {suggestion}", styles['Normal']))
    else:
        story.append(Paragraph("No specific suggestions provided", styles['Normal']))
    
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def create_overall_summary_pdf(summary: Dict[str, Any], candidate_name: str, interviewer_name: str) -> bytes:
    """Generate PDF for overall interview summary."""
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=18,
        textColor=HexColor('#2C3E50'),
        spaceAfter=20
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=HexColor('#34495E'),
        spaceBefore=15,
        spaceAfter=10
    )
    
    story = []
    
    # Title
    story.append(Paragraph(f"Interview Summary: {candidate_name} interviewed by {interviewer_name}", title_style))
    story.append(Spacer(1, 20))
    
    # Interview Progress
    story.append(Paragraph("Interview Progress", heading_style))
    story.append(Paragraph(summary.get('interview_progress', 'Not documented'), styles['Normal']))
    story.append(Spacer(1, 15))
    
    # Key Discussion Points
    story.append(Paragraph("Key Discussion Points", heading_style))
    discussion_points = summary.get('key_discussion_points', [])
    if discussion_points:
        for point in discussion_points:
            story.append(Paragraph(f"• {point}", styles['Normal']))
    else:
        story.append(Paragraph("No key discussion points documented", styles['Normal']))
    story.append(Spacer(1, 15))
    
    # Candidate Competence
    story.append(Paragraph("Candidate Competence Assessment", heading_style))
    story.append(Paragraph(summary.get('candidate_competence', 'Not assessed'), styles['Normal']))
    story.append(Spacer(1, 15))
    
    # Interviewer Attitude
    story.append(Paragraph("Interviewer Approach", heading_style))
    story.append(Paragraph(summary.get('interviewer_attitude', 'Not assessed'), styles['Normal']))
    story.append(Spacer(1, 15))
    
    # Hiring Recommendation
    story.append(Paragraph("Hiring Recommendation", heading_style))
    story.append(Paragraph(summary.get('hiring_recommendation', 'No recommendation provided'), styles['Normal']))
    story.append(Spacer(1, 15))
    
    # Holistic Overview
    story.append(Paragraph("Holistic Overview", heading_style))
    story.append(Paragraph(summary.get('holistic_overview', 'No overview provided'), styles['Normal']))
    
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
