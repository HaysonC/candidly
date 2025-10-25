from __future__ import annotations
import os
from typing import Optional
from pydantic import ValidationError
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI
from ..models import InterviewPrepRequest, InterviewPrepResponse
from ..models import InterviewCriteria, CriteriaArea, CodingQuestion


SYSTEM_INSTRUCTIONS = (
    "You are an interview planning assistant. Analyze the provided context and produce a structured JSON "
    "that the frontend can decode directly. Follow the provided JSON schema exactly. Do not include any prose "
    "outside JSON. Keep the criteria helpful and succinct; provide the coding questions according to the input. "
    "The coding question should be defined rigourously with the varaible, their range, and expected data types, and expected examples. "
)

PROMPT_TMPL = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_INSTRUCTIONS),
    (
        "human",
        "You MUST produce output that exactly matches the required JSON schema for InterviewPrepResponse.\n"
        "Input text to analyze:\n\n{text}\n\n"
        "Return ONLY the JSON object with keys: criteria, coding_questions."
    ),
])


def get_llm(model: Optional[str] = None) -> ChatGoogleGenerativeAI:
    model_id = model or "gemini-2.0-flash"
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY environment variable is not set")
    # Pass API key using google_api_key parameter compatible with langchain-google-genai
    return ChatGoogleGenerativeAI(model=model_id, google_api_key=api_key, temperature=0.2)  # type: ignore


def analyze_interview_prep(req: InterviewPrepRequest) -> InterviewPrepResponse:
    """Generate structured interview prep using Gemini with strict schema enforcement.

    Uses LLM.with_structured_output to leverage tool/JSON mode for reliable keys.
    Falls back to parser-based approach if needed.
    """
    llm = get_llm(req.model)

    # Helper to coerce common LLM drift into our schema
    def _repair_result(obj: dict) -> InterviewPrepResponse:
        data = dict(obj)
        # Criteria can sometimes be a list of strings; convert to areas
        crit = data.get("criteria")
        if isinstance(crit, list):
            areas = [CriteriaArea(name=str(x), description="") for x in crit]
            data["criteria"] = InterviewCriteria(overview="", areas=areas).model_dump()
        elif isinstance(crit, dict):
            # Ensure keys present
            crit.setdefault("overview", "")
            crit.setdefault("areas", [])
        else:
            # Initialize minimal structure if missing/invalid
            data["criteria"] = InterviewCriteria(overview="", areas=[]).model_dump()

        # Normalize coding questions list
        cq = data.get("coding_questions")
        fixed_cq = []
        if isinstance(cq, list):
            for item in cq:
                if not isinstance(item, dict):
                    continue
                title = item.get("title") or item.get("name") or item.get("questionTitle") or "Untitled"
                prompt = item.get("prompt") or item.get("description") or item.get("questionDescription") or title
                # Create slug id
                slug = (
                    str(item.get("id") or title)
                    .strip()
                    .lower()
                    .replace(" ", "-")
                )
                difficulty = (item.get("difficulty") or "medium").lower()
                if difficulty not in {"easy", "medium", "hard"}:
                    difficulty = "medium"
                topics = item.get("topics") or []
                try:
                    fixed_cq.append(
                        CodingQuestion(
                            id=slug,
                            title=title,
                            prompt=prompt,
                            difficulty=difficulty,
                            topics=list(topics) if isinstance(topics, list) else [],
                        ).model_dump()
                    )
                except Exception:
                    # Skip irreparable items
                    continue
        data["coding_questions"] = fixed_cq

        return InterviewPrepResponse.model_validate(data)

    # First try tool/structured output to coerce valid JSON matching the Pydantic schema
    try:
        structured = llm.with_structured_output(InterviewPrepResponse)
        prompt_text = (
            "Analyze the input and return interview criteria and coding questions as JSON. "
            "Keys must be exactly: criteria, coding_questions. Input:\n\n" + req.text
        )
        result_obj = structured.invoke(prompt_text)
        # The result may be a dict or a Pydantic model depending on LC version
        if isinstance(result_obj, dict):
            try:
                return InterviewPrepResponse.model_validate(result_obj)
            except Exception:
                return _repair_result(result_obj)
        return InterviewPrepResponse.model_validate(result_obj.model_dump())
    except Exception:
        # Fallback to prompt + pydantic output parser
        parser = PydanticOutputParser(pydantic_object=InterviewPrepResponse)
        format_instructions = parser.get_format_instructions()
        # IMPORTANT: pass format_instructions as a template variable so braces aren't parsed as prompt vars
        prompt = ChatPromptTemplate.from_messages([
            (
                "system",
                SYSTEM_INSTRUCTIONS + " Return ONLY JSON, no backticks, no prose."
            ),
            (
                "human",
                "Input:\n\n{text}\n\nFollow EXACTLY these format instructions:\n\n{format_instructions}",
            ),
        ])
        chain = prompt | llm | parser
        try:
            result: InterviewPrepResponse = chain.invoke({
                "text": req.text,
                "format_instructions": format_instructions,
            })
            return result
        except ValidationError as ve:
            # Try last-resort repair if raw text is accessible via llm call
            try:
                # Use a minimal instruction to get raw JSON without involving templates with braces
                raw_instruction = (
                    "Return ONLY JSON for InterviewPrepResponse with keys criteria and coding_questions. "
                    "Avoid prose and markdown. Input:\n\n" + req.text
                )
                raw = llm.invoke(raw_instruction)
                raw_text = getattr(raw, "content", None) or getattr(raw, "text", None) or str(raw)
                import json as _json
                data = _json.loads(raw_text)
                return _repair_result(data)
            except Exception:
                raise ValueError(f"Model output did not match schema: {ve}")
