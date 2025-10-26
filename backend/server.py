from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import json
import logging
import secrets
from typing import Dict, Set, Optional, List
import threading
import json as _json
import os
from pathlib import Path
import base64
from datetime import datetime
from time import time

from dotenv import load_dotenv
from app.models import InterviewSession
from app.models import InterviewPrepRequest, InterviewPrepResponse
from app.models import Template, TemplateCreate, TemplateUpdate
from app.models import (
    CreateCandidateRequest,
    CandidateListRequest,
    CandidateTrackingRequest,
    CandidateFilePutRequest,
    InterviewReportRequest,
    CandidateAssessmentReport,
    InterviewerAssessmentReport,
    OverallInterviewSummary,
)
from app.ai.interview_prep import analyze_interview_prep
from app.ai.interview_reports import (
    generate_candidate_assessment,
    generate_interviewer_assessment,
    generate_overall_summary,
)
from app.utils.pdf_generator import (
    create_candidate_assessment_pdf,
    create_interviewer_assessment_pdf,
    create_overall_summary_pdf,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Interview WebRTC Signaling Server")

# Load environment variables (support backend/.env)
_DOTENV_PATH = Path(__file__).parent / ".env"
if _DOTENV_PATH.exists():
    load_dotenv(_DOTENV_PATH)
else:
    load_dotenv()  # fallback to any parent or system env

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active connections and sessions
rooms: Dict[str, Set[WebSocket]] = {}
interview_sessions: Dict[str, InterviewSession] = {}  # meeting_code -> session info
websocket_roles: Dict[WebSocket, str] = {}  # websocket -> "interviewer" or "interviewee"
templates_by_account: Dict[str, Dict[str, Template]] = {}
_templates_lock = threading.Lock()

def _accounts_base_dir() -> Path:
    data_dir = Path(__file__).parent / "data" / "accounts"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir

def _safe_account_dirname(account: str) -> str:
    # Minimal sanitization: disallow path separators
    return account.replace("/", "_").replace("\\", "_")

def _account_templates_dir(account: str) -> Path:
    base = _accounts_base_dir()
    safe = _safe_account_dirname(account)
    dir_path = base / safe / "templates"
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path

def _account_candidates_dir(account: str) -> Path:
    base = _accounts_base_dir()
    safe = _safe_account_dirname(account)
    dir_path = base / safe / "candidates"
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path

def _safe_candidate_dirname(name: str) -> str:
    return name.strip().replace("/", "_").replace("\\", "_")

def _is_safe_filename(name: str) -> bool:
    if "/" in name or "\\" in name:
        return False
    if name in ("", ".", ".."):
        return False
    return True

def _candidate_base_dir(account: str, candidate: str) -> Path:
    cands = _account_candidates_dir(account)
    safe = _safe_candidate_dirname(candidate)
    dir_path = cands / safe
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path

def _candidate_timestamp_dir(account: str, candidate: str, timestamp: Optional[str] = None, create: bool = True) -> Path:
    base = _candidate_base_dir(account, candidate)
    # Use candidate name instead of numeric timestamp
    ts = timestamp or _safe_candidate_dirname(candidate)
    dir_path = base / ts
    if create:
        dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path

def _latest_timestamp_dir(account: str, candidate: str) -> Optional[Path]:
    base = _candidate_base_dir(account, candidate)
    if not base.exists():
        return None
    subdirs: List[Path] = [p for p in base.iterdir() if p.is_dir()]
    if not subdirs:
        return None
    # Since we're now using candidate names instead of timestamps,
    # just return the first directory (or you could modify this logic as needed)
    return subdirs[0] if subdirs else None

def _tracking_path(ts_dir: Path) -> Path:
    return ts_dir / "tracking.json"

def _read_tracking(ts_dir: Path) -> dict:
    fp = _tracking_path(ts_dir)
    if not fp.exists():
        return {"files": {}}
    try:
        return _json.loads(fp.read_text(encoding="utf-8"))
    except Exception:
        return {"files": {}}

def _write_tracking(ts_dir: Path, data: dict) -> None:
    fp = _tracking_path(ts_dir)
    try:
        fp.write_text(_json.dumps(data, indent=2), encoding="utf-8")
    except Exception as e:
        logger.warning(f"Failed writing tracking.json in {ts_dir}: {e}")

def _load_templates_from_disk() -> None:
    """Load templates_by_account from per-account directories (best-effort)."""
    root = _accounts_base_dir()
    if not root.exists():
        return
    loaded: Dict[str, Dict[str, Template]] = {}
    try:
        for acct_dir in root.iterdir():
            if not acct_dir.is_dir():
                continue
            account = acct_dir.name
            tdir = acct_dir / "templates"
            if not tdir.exists():
                continue
            loaded[account] = {}
            for f in tdir.glob("*.json"):
                try:
                    tdict = _json.loads(f.read_text(encoding="utf-8"))
                    tpl = Template(**tdict)
                    loaded[account][tpl.id] = tpl
                except Exception:
                    continue
        # Backward-compat: migrate from legacy backend/data/templates.json if present
        legacy = (Path(__file__).parent / "data" / "templates.json")
        if legacy.exists():
            try:
                legacy_obj = _json.loads(legacy.read_text(encoding="utf-8"))
                if isinstance(legacy_obj, dict):
                    for account, by_id in legacy_obj.items():
                        if not isinstance(by_id, dict):
                            continue
                        if account not in loaded:
                            loaded[account] = {}
                        for tid, tdict in by_id.items():
                            try:
                                tpl = Template(**tdict)
                                if tpl.id not in loaded[account]:
                                    loaded[account][tpl.id] = tpl
                                    # persist to new per-account location
                                    _write_template_to_disk(tpl)
                            except Exception:
                                continue
            except Exception as _e:
                logger.warning(f"Failed to migrate legacy templates.json: {_e}")
        templates_by_account.clear()
        templates_by_account.update(loaded)
    except Exception as e:
        logger.warning(f"Failed to load templates: {e}")

def _write_template_to_disk(tpl: Template) -> None:
    try:
        tdir = _account_templates_dir(tpl.account)
        fpath = tdir / f"{tpl.id}.json"
        fpath.write_text(tpl.model_dump_json(indent=2), encoding="utf-8")
    except Exception as e:
        logger.warning(f"Failed to write template {tpl.id}: {e}")

def _delete_template_from_disk(account: str, tpl_id: str) -> None:
    try:
        tdir = _account_templates_dir(account)
        fpath = tdir / f"{tpl_id}.json"
        if fpath.exists():
            fpath.unlink()
    except Exception as e:
        logger.warning(f"Failed to delete template {tpl_id}: {e}")

def generate_meeting_code() -> str:
    """Generate a unique 6-character meeting code"""
    return secrets.token_urlsafe(6)[:6].upper()

@app.get("/")
async def root():
    return {
        "status": "Interview Signaling Server Running",
        "active_rooms": len(rooms),
        "active_sessions": len(interview_sessions),
        "template_accounts": len(templates_by_account),
        "template_total": sum(len(v) for v in templates_by_account.values()),
    }


# -------- AI: Interview Prep Endpoint --------
@app.post("/interview-prep", response_model=InterviewPrepResponse)
async def interview_prep(req: InterviewPrepRequest) -> InterviewPrepResponse:
    """Analyze input text and produce interview criteria and coding questions.

    Requires GOOGLE_API_KEY in environment (load via backend/.env or OS-level env).
    """
    try:
        result = analyze_interview_prep(req)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=500, detail=str(ve))
    except Exception as e:
        logger.exception("interview-prep error")
        raise HTTPException(status_code=500, detail="Interview prep generation failed")


@app.get("/interview-prep/schema")
async def interview_prep_schema():
    """Return JSON Schema for the interview prep response to aid frontend decoding."""
    return InterviewPrepResponse.model_json_schema()

@app.post("/api/create-session")
async def create_session(session: InterviewSession):
    """Create a new interview session and return meeting code"""
    meeting_code = generate_meeting_code()
    
    # Ensure unique code
    while meeting_code in interview_sessions:
        meeting_code = generate_meeting_code()
    
    interview_sessions[meeting_code] = session
    logger.info(f"Created session {meeting_code}")
    logger.info(f"  Candidate: {session.candidate_name}")
    logger.info(f"  Email: '{session.candidate_email}' (length: {len(session.candidate_email)})")
    logger.info(f"  Interviewer: {session.interviewer_name}")
    if session.scheduled_at:
        logger.info(f"  Scheduled at: {session.scheduled_at}")
    logger.info(f"  Status: {session.status}")
    
    return {
        "meeting_code": meeting_code,
        "join_link": f"/join?code={meeting_code}"
    }


@app.get("/api/sessions")
async def list_sessions(interviewer: Optional[str] = None, status: Optional[str] = "scheduled"):
    """Return interview sessions filtered by interviewer and status."""
    items = []
    for code, sess in interview_sessions.items():
        if interviewer and sess.interviewer_name != interviewer:
            continue
        if status and getattr(sess, "status", "scheduled") != status:
            continue
        items.append({
            "meeting_code": code,
            "candidate_name": sess.candidate_name,
            "candidate_email": sess.candidate_email,
            "interviewer_name": sess.interviewer_name,
            "scheduled_at": getattr(sess, "scheduled_at", None),
            "status": getattr(sess, "status", "scheduled"),
        })

    def sort_key(item: dict) -> str:
        scheduled = item.get("scheduled_at") or ""
        return scheduled

    items.sort(key=sort_key)
    return items


# -------- Templates API (per interviewer account) --------
@app.get("/templates")
async def list_templates(account: Optional[str] = None):
    """List templates for an account (interviewer_name). If account missing, return empty list."""
    if not account:
        return []
    return list(templates_by_account.get(account, {}).values())


@app.post("/templates")
async def create_template(tpl_in: TemplateCreate):
    from time import time
    account = tpl_in.account.strip()
    if not account:
        raise HTTPException(status_code=400, detail="account is required")
    t = Template(
        id=str(int(time() * 1000)),
        account=account,
        name=tpl_in.name or "Untitled Template",
        criteria=tpl_in.criteria or [],
        coding_questions=tpl_in.coding_questions or [],
    )
    with _templates_lock:
        templates_by_account.setdefault(account, {})[t.id] = t
        _write_template_to_disk(t)
    return t


@app.get("/templates/{template_id}")
async def get_template(template_id: str, account: Optional[str] = None):
    if not account:
        raise HTTPException(status_code=400, detail="account is required")
    t = templates_by_account.get(account, {}).get(template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t


@app.put("/templates/{template_id}")
async def update_template(template_id: str, tpl_upd: TemplateUpdate, account: Optional[str] = None):
    if not account:
        raise HTTPException(status_code=400, detail="account is required")
    acct_map = templates_by_account.get(account, {})
    t = acct_map.get(template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    data = t.model_dump()
    if tpl_upd.name is not None:
        data["name"] = tpl_upd.name
    if tpl_upd.criteria is not None:
        data["criteria"] = tpl_upd.criteria
    if tpl_upd.coding_questions is not None:
        data["coding_questions"] = tpl_upd.coding_questions
    updated = Template(**data)
    with _templates_lock:
        acct_map[template_id] = updated
        templates_by_account[account] = acct_map
        _write_template_to_disk(updated)
    return updated


@app.delete("/templates/{template_id}")
async def delete_template(template_id: str, account: Optional[str] = None):
    if not account:
        raise HTTPException(status_code=400, detail="account is required")
    acct_map = templates_by_account.get(account, {})
    if template_id not in acct_map:
        raise HTTPException(status_code=404, detail="Template not found")
    with _templates_lock:
        deleted = acct_map.pop(template_id)
        templates_by_account[account] = acct_map
        _delete_template_from_disk(account, template_id)
    return {"deleted": True, "id": template_id, "name": deleted.name}


# -------- Candidates API (per interviewer account) --------
@app.post("/create_candidate")
async def create_candidate(req: CreateCandidateRequest):
    """Create candidate directory and empty tracking.json.

    Structure: data/accounts/{interviewer}/candidates/{candidate}/tracking.json
    """
    interviewer = req.interviewer.strip()
    candidate = req.interviewee.strip()
    if not interviewer or not candidate:
        raise HTTPException(status_code=400, detail="interviewer and interviewee are required")

    candidate_dir = _candidate_base_dir(interviewer, candidate)
    # initialize empty tracking
    if not _tracking_path(candidate_dir).exists():
        _write_tracking(candidate_dir, {"files": {}, "created_at": datetime.utcnow().isoformat() + "Z"})
    return {
        "interviewer": interviewer,
        "candidate": _safe_candidate_dirname(candidate),
        "path": str(candidate_dir.relative_to(Path(__file__).parent))
    }


@app.post("/candidate_interviewed")
async def candidate_interviewed(req: CandidateListRequest):
    """Return list of candidate names for interviewer."""
    interviewer = req.interviewer.strip()
    if not interviewer:
        raise HTTPException(status_code=400, detail="interviewer is required")
    cdir = _account_candidates_dir(interviewer)
    names: List[str] = []
    try:
        for p in cdir.iterdir():
            if p.is_dir():
                names.append(p.name)
    except FileNotFoundError:
        pass
    return sorted(names)


@app.delete("/candidate_interviewed/{name}")
async def delete_candidate(name: str, interviewer: Optional[str] = None):
    """Delete a candidate and all their timestamp folders for an interviewer."""
    if not interviewer:
        raise HTTPException(status_code=400, detail="interviewer is required")
    base = _candidate_base_dir(interviewer, name)
    if not base.exists():
        raise HTTPException(status_code=404, detail="Candidate not found")
    # Danger: recursive delete
    try:
        for root, dirs, files in os.walk(base, topdown=False):
            for f in files:
                try:
                    Path(root, f).unlink()
                except Exception:
                    pass
            for d in dirs:
                try:
                    Path(root, d).rmdir()
                except Exception:
                    pass
        base.rmdir()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete: {e}")
    return {"deleted": True, "candidate": name}


@app.post("/candidate_interviewed/{name}")
async def get_candidate_tracking(name: str, req: CandidateTrackingRequest):
    """Get tracking.json for a candidate.
    
    Returns tracking data from the candidate's base directory.
    """
    interviewer = req.interviewer.strip()
    if not interviewer:
        raise HTTPException(status_code=400, detail="interviewer is required")
    
    # Get tracking directly from candidate base directory
    candidate_dir = _candidate_base_dir(interviewer, name)
    if not candidate_dir.exists():
        raise HTTPException(status_code=404, detail="Candidate not found")
    return _read_tracking(candidate_dir)


@app.put("/candidate_interviewed/{name}")
async def put_candidate_file(name: str, req: CandidateFilePutRequest):
    """Create or replace a file in the candidate's directory and update tracking.json.
    
    Files are stored directly in the candidate directory without timestamp subdirectories.
    """
    interviewer = req.interviewer.strip()
    if not interviewer:
        raise HTTPException(status_code=400, detail="interviewer is required")
    if not _is_safe_filename(req.filename):
        raise HTTPException(status_code=400, detail="invalid filename")

    # Write directly to candidate base directory instead of timestamp subdirectory
    candidate_dir = _candidate_base_dir(interviewer, name)

    # write file (binary if contentBase64 provided)
    fpath = candidate_dir / req.filename
    try:
        if req.contentBase64 and isinstance(req.contentBase64, str):
            try:
                data = base64.b64decode(req.contentBase64)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid base64 content: {e}")
            with open(fpath, "wb") as fh:
                fh.write(data)
        else:
            if req.content is None:
                raise HTTPException(status_code=400, detail="content or contentBase64 is required")
            fpath.write_text(req.content, encoding="utf-8")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file: {e}")

    # update tracking
    tracking = _read_tracking(candidate_dir)
    files = tracking.get("files", {})
    files[req.filename] = {
        "size": fpath.stat().st_size,
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }
    tracking["files"] = files
    _write_tracking(candidate_dir, tracking)
    return {"ok": True, "candidate": name, "file": req.filename}


@app.get("/candidate_interviewed/{name}/file/{filename}")
async def get_candidate_file(name: str, filename: str, interviewer: Optional[str] = None):
    """Get the content of a specific file for a candidate.

    Returns JSON. For text-like files, returns:
    { filename, content, size }
    For binary/image files, returns base64 with contentType:
    { filename, contentBase64, contentType, size }
    """
    if not interviewer:
        raise HTTPException(status_code=400, detail="interviewer is required")
    if not _is_safe_filename(filename):
        raise HTTPException(status_code=400, detail="invalid filename")

    candidate_dir = _candidate_base_dir(interviewer, name)
    if not candidate_dir.exists():
        raise HTTPException(status_code=404, detail="Candidate not found")

    fpath = candidate_dir / filename
    if not fpath.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Decide response format based on file type/extension
    ext = fpath.suffix.lower()
    image_exts = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
    text_exts = {".txt", ".md", ".json", ".log", ".py", ".java", ".cpp", ".c", ".ts", ".tsx", ".js", ".css", ".html"}
    mime_by_ext = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }

    try:
        if ext in text_exts:
            content = fpath.read_text(encoding="utf-8")
            return {
                "filename": filename,
                "content": content,
                "size": fpath.stat().st_size,
            }
        elif ext in image_exts:
            with open(fpath, "rb") as fh:
                b = fh.read()
            b64 = base64.b64encode(b).decode("ascii")
            return {
                "filename": filename,
                "contentBase64": b64,
                "contentType": mime_by_ext.get(ext, "application/octet-stream"),
                "size": len(b),
            }
        else:
            # Try text first, fallback to base64
            try:
                content = fpath.read_text(encoding="utf-8")
                return {
                    "filename": filename,
                    "content": content,
                    "size": fpath.stat().st_size,
                }
            except Exception:
                with open(fpath, "rb") as fh:
                    b = fh.read()
                b64 = base64.b64encode(b).decode("ascii")
                return {
                    "filename": filename,
                    "contentBase64": b64,
                    "contentType": "application/octet-stream",
                    "size": len(b),
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {e}")


@app.post("/candidate_interviewed/{name}/upload")
async def upload_candidate_file(
    name: str,
    interviewer: str = Form(...),
    file: UploadFile = File(...),
    filename: Optional[str] = Form(None),
):
    """Upload a binary file (e.g., image) as multipart/form-data and update tracking.json.

    Form fields:
    - interviewer: Account/interviewer name
    - filename: Optional explicit filename override; falls back to the uploaded file's original name
    - file: The uploaded file blob
    """
    interviewer = interviewer.strip()
    if not interviewer:
        raise HTTPException(status_code=400, detail="interviewer is required")

    use_name = filename or (file.filename or "")
    if not use_name:
        raise HTTPException(status_code=400, detail="filename is required")
    if not _is_safe_filename(use_name):
        raise HTTPException(status_code=400, detail="invalid filename")

    candidate_dir = _candidate_base_dir(interviewer, name)
    fpath = candidate_dir / use_name

    try:
        # Stream to disk to handle large files efficiently
        with open(fpath, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write uploaded file: {e}")

    # update tracking
    tracking = _read_tracking(candidate_dir)
    files = tracking.get("files", {})
    try:
        size = fpath.stat().st_size
    except Exception:
        size = 0
    files[use_name] = {
        "size": size,
        "updated_at": datetime.utcnow().isoformat() + "Z",
        "content_type": getattr(file, "content_type", None) or "application/octet-stream",
    }
    tracking["files"] = files
    _write_tracking(candidate_dir, tracking)

    return {"ok": True, "candidate": name, "file": use_name}


@app.get("/api/verify-email/{meeting_code}/{email}")
async def verify_email(meeting_code: str, email: str):
    """Verify if email matches the session"""
    logger.info(f"Verifying email for meeting {meeting_code}")
    logger.info(f"  Received email: '{email}' (length: {len(email)})")
    
    if meeting_code not in interview_sessions:
        logger.warning(f"  Session not found!")
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = interview_sessions[meeting_code]
    logger.info(f"  Stored email: '{session.candidate_email}' (length: {len(session.candidate_email)})")
    logger.info(f"  Received (lower): '{email.lower()}'")
    logger.info(f"  Stored (lower): '{session.candidate_email.lower()}'")
    
    is_valid = session.candidate_email.strip().lower() == email.strip().lower()
    logger.info(f"  Match result: {is_valid}")
    
    return {
        "valid": is_valid,
        "candidate_name": session.candidate_name if is_valid else None
    }


# -------- PDF Report Generation Endpoints --------
@app.post("/generate-candidate-assessment")
async def generate_candidate_assessment_report(req: InterviewReportRequest):
    """Generate candidate assessment PDF report and upload to candidate folder."""
    try:
        logger.info(f"Generating candidate assessment for {req.candidate_name}")
        
        # Generate the assessment using AI
        assessment = generate_candidate_assessment(req)
        
        # Create PDF
        pdf_bytes = create_candidate_assessment_pdf(
            assessment.model_dump(), 
            req.candidate_name
        )
        
        # Upload PDF to candidate folder
        candidate_dir = _candidate_base_dir(req.interviewer, req.candidate_name)
        filename = f"candidate_assessment_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
        pdf_path = candidate_dir / filename
        
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
        
        # Update tracking
        tracking = _read_tracking(candidate_dir)
        files = tracking.get("files", {})
        files[filename] = {
            "size": len(pdf_bytes),
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "content_type": "application/pdf",
            "report_type": "candidate_assessment"
        }
        tracking["files"] = files
        _write_tracking(candidate_dir, tracking)
        
        logger.info(f"Candidate assessment PDF saved: {filename}")
        return {
            "success": True,
            "filename": filename,
            "assessment": assessment.model_dump()
        }
        
    except Exception as e:
        logger.error(f"Error generating candidate assessment: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate assessment: {str(e)}")


@app.post("/generate-interviewer-assessment")
async def generate_interviewer_assessment_report(req: InterviewReportRequest):
    """Generate interviewer assessment PDF report and upload to candidate folder."""
    try:
        logger.info(f"Generating interviewer assessment for {req.interviewer}")
        
        # Generate the assessment using AI
        assessment = generate_interviewer_assessment(req)
        
        # Create PDF
        pdf_bytes = create_interviewer_assessment_pdf(
            assessment.model_dump(), 
            req.interviewer
        )
        
        # Upload PDF to candidate folder
        candidate_dir = _candidate_base_dir(req.interviewer, req.candidate_name)
        filename = f"interviewer_assessment_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
        pdf_path = candidate_dir / filename
        
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
        
        # Update tracking
        tracking = _read_tracking(candidate_dir)
        files = tracking.get("files", {})
        files[filename] = {
            "size": len(pdf_bytes),
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "content_type": "application/pdf",
            "report_type": "interviewer_assessment"
        }
        tracking["files"] = files
        _write_tracking(candidate_dir, tracking)
        
        logger.info(f"Interviewer assessment PDF saved: {filename}")
        return {
            "success": True,
            "filename": filename,
            "assessment": assessment.model_dump()
        }
        
    except Exception as e:
        logger.error(f"Error generating interviewer assessment: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate assessment: {str(e)}")


@app.post("/generate-overall-summary")
async def generate_overall_summary_report(req: InterviewReportRequest):
    """Generate overall interview summary PDF report and upload to candidate folder."""
    try:
        logger.info(f"Generating overall summary for interview: {req.candidate_name} by {req.interviewer}")
        
        # Generate the summary using AI
        summary = generate_overall_summary(req)
        
        # Create PDF
        pdf_bytes = create_overall_summary_pdf(
            summary.model_dump(), 
            req.candidate_name,
            req.interviewer
        )
        
        # Upload PDF to candidate folder
        candidate_dir = _candidate_base_dir(req.interviewer, req.candidate_name)
        filename = f"interview_summary_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
        pdf_path = candidate_dir / filename
        
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
        
        # Update tracking
        tracking = _read_tracking(candidate_dir)
        files = tracking.get("files", {})
        files[filename] = {
            "size": len(pdf_bytes),
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "content_type": "application/pdf",
            "report_type": "interview_summary"
        }
        tracking["files"] = files
        _write_tracking(candidate_dir, tracking)
        
        logger.info(f"Overall summary PDF saved: {filename}")
        return {
            "success": True,
            "filename": filename,
            "summary": summary.model_dump()
        }
        
    except Exception as e:
        logger.error(f"Error generating overall summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")


@app.post("/generate-all-reports")
async def generate_all_reports(req: InterviewReportRequest):
    """Generate all three PDF reports (candidate assessment, interviewer assessment, overall summary)."""
    try:
        logger.info(f"🎯 ===== STARTING PDF REPORT GENERATION =====")
        logger.info(f"📊 Request Details:")
        logger.info(f"   - Candidate: {req.candidate_name}")
        logger.info(f"   - Interviewer: {req.interviewer}")
        logger.info(f"   - Transcript Length: {len(req.transcript) if req.transcript else 0}")
        logger.info(f"   - Q&A Length: {len(req.questions_and_answers) if req.questions_and_answers else 0}")
        logger.info(f"   - Gaze Analysis: {len(req.gaze_analysis) if req.gaze_analysis else 0}")
        logger.info(f"   - Template Criteria: {len(req.template_criteria) if req.template_criteria else 0}")
        logger.info(f"   - Model: {req.model}")
        
        results = {}
        
        # Generate candidate assessment
        logger.info("🔄 Generating candidate assessment...")
        try:
            candidate_result = await generate_candidate_assessment_report(req)
            results["candidate_assessment"] = candidate_result
            logger.info("✅ Candidate assessment generated successfully")
        except Exception as e:
            logger.error(f"❌ Failed to generate candidate assessment: {e}")
            logger.error(f"❌ Candidate assessment error stack:", exc_info=True)
            results["candidate_assessment"] = {"success": False, "error": str(e)}
        
        # Generate interviewer assessment
        logger.info("🔄 Generating interviewer assessment...")
        try:
            interviewer_result = await generate_interviewer_assessment_report(req)
            results["interviewer_assessment"] = interviewer_result
            logger.info("✅ Interviewer assessment generated successfully")
        except Exception as e:
            logger.error(f"❌ Failed to generate interviewer assessment: {e}")
            logger.error(f"❌ Interviewer assessment error stack:", exc_info=True)
            results["interviewer_assessment"] = {"success": False, "error": str(e)}
        
        # Generate overall summary
        logger.info("🔄 Generating overall summary...")
        try:
            summary_result = await generate_overall_summary_report(req)
            results["overall_summary"] = summary_result
            logger.info("✅ Overall summary generated successfully")
        except Exception as e:
            logger.error(f"❌ Failed to generate overall summary: {e}")
            logger.error(f"❌ Overall summary error stack:", exc_info=True)
            results["overall_summary"] = {"success": False, "error": str(e)}
        
        success_count = sum(1 for r in results.values() if r.get("success", False))
        
        logger.info(f"📈 Report Generation Summary:")
        logger.info(f"   - Successful: {success_count}")
        logger.info(f"   - Total: 3")
        logger.info(f"   - Results: {results}")
        
        return {
            "success": success_count > 0,
            "reports_generated": success_count,
            "total_reports": 3,
            "results": results
        }
        
    except Exception as e:
        logger.error(f"💥 CRITICAL ERROR in generate_all_reports: {e}")
        logger.error(f"💥 Critical error stack:", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate reports: {str(e)}")

@app.websocket("/ws/{meeting_code}/{role}")
async def websocket_endpoint(websocket: WebSocket, meeting_code: str, role: str):
    """
    WebSocket endpoint for interview calls
    role: "interviewer" or "interviewee"
    """
    await websocket.accept()
    logger.info(f"{role} connected to meeting: {meeting_code}")
    
    # Verify session exists
    if meeting_code not in interview_sessions:
        await websocket.send_json({
            "type": "error",
            "message": "Invalid meeting code"
        })
        await websocket.close()
        return
    
    # Add to room
    if meeting_code not in rooms:
        rooms[meeting_code] = set()
    rooms[meeting_code].add(websocket)
    websocket_roles[websocket] = role
    
    # Send session info
    session = interview_sessions[meeting_code]
    await websocket.send_json({
        "type": "session-info",
        "candidate_name": session.candidate_name,
        "candidate_email": session.candidate_email,
        "interviewer_name": session.interviewer_name,
        "role": role
    })
    
    # Notify about room status
    room_size = len(rooms[meeting_code])
    await websocket.send_json({
        "type": "room-joined",
        "meetingCode": meeting_code,
        "participants": room_size,
        "role": role
    })
    
    # Notify other participants
    for client in rooms[meeting_code]:
        if client != websocket:
            try:
                other_role = websocket_roles.get(client, "unknown")
                await client.send_json({
                    "type": "user-joined",
                    "role": role,
                    "meetingCode": meeting_code
                })
            except Exception as e:
                logger.error(f"Error notifying client: {e}")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            logger.info(f"Received {message.get('type')} from {role} in {meeting_code}")
            
            # Relay message to other participants
            for client in rooms[meeting_code]:
                if client != websocket:
                    try:
                        await client.send_text(data)
                    except Exception as e:
                        logger.error(f"Error relaying message: {e}")
                        
    except WebSocketDisconnect:
        logger.info(f"{role} disconnected from meeting: {meeting_code}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Cleanup
        if meeting_code in rooms:
            rooms[meeting_code].discard(websocket)
            websocket_roles.pop(websocket, None)
            
            # Notify remaining participants
            for client in rooms[meeting_code]:
                try:
                    await client.send_json({
                        "type": "user-left",
                        "role": role,
                        "meetingCode": meeting_code
                    })
                except Exception as e:
                    logger.error(f"Error notifying disconnect: {e}")
            
            # Clean up empty rooms
            if len(rooms[meeting_code]) == 0:
                del rooms[meeting_code]
                # Keep session for potential reconnection
                logger.info(f"Room {meeting_code} empty")

if __name__ == "__main__":
    import uvicorn
    # Load templates from disk on startup
    try:
        _load_templates_from_disk()
    except Exception as _e:
        logger.warning(f"Startup load templates failed: {_e}")
    uvicorn.run(app, host="0.0.0.0", port=8000)
