from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
import logging
import secrets
from typing import Dict, Set, Optional
import os
from pathlib import Path

from dotenv import load_dotenv
from app.models import InterviewSession
from app.models import InterviewPrepRequest, InterviewPrepResponse
from app.ai.interview_prep import analyze_interview_prep

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

def generate_meeting_code() -> str:
    """Generate a unique 6-character meeting code"""
    return secrets.token_urlsafe(6)[:6].upper()

@app.get("/")
async def root():
    return {
        "status": "Interview Signaling Server Running",
        "active_rooms": len(rooms),
        "active_sessions": len(interview_sessions)
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
    
    return {
        "meeting_code": meeting_code,
        "join_link": f"/join?code={meeting_code}"
    }

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
    uvicorn.run(app, host="0.0.0.0", port=8000)
