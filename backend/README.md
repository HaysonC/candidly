
# Interview Signaling + AI Backend

FastAPI server that powers interview session signaling (WebSocket) and AI-assisted interview prep.

## Setup

1) Create a virtual environment (recommended)

```bash
python -m venv .venv
source .venv/bin/activate
```

2) Install dependencies

```bash
pip install -r requirements.txt
```

3) Environment variables

Create a `.env` file in this `backend/` folder with your Google API key for the AI endpoint:

```
GOOGLE_API_KEY=your_key_here
```

You can also export it at the OS level; the server will load `backend/.env` if present.

4) Run the server

```bash
python server.py
```

The server starts at http://localhost:8000

## Tunneling

To make this server accessible from the internet (for local testing), use one of:

- ngrok
	```bash
	ngrok http 8000
	```
- Cloudflare Tunnel
	```bash
	cloudflared tunnel --url http://localhost:8000
	```
- localtunnel
	```bash
	npx localtunnel --port 8000
	```

Use the public URL in the frontend by setting `NEXT_PUBLIC_SIGNALING_SERVER`.

## API

- GET `/` — Health and basic stats
- POST `/api/create-session` — Create a new interview session; returns `meeting_code` and a `join_link`
- GET `/api/verify-email/{meeting_code}/{email}` — Verify candidate email for a session
- WebSocket `/ws/{meeting_code}/{role}` — Signaling channel; role is `interviewer` or `interviewee`
- POST `/interview-prep` — AI endpoint; body: `InterviewPrepRequest`; response: `InterviewPrepResponse`
- GET `/interview-prep/schema` — JSON schema for `InterviewPrepResponse`

### WebSocket messages

The server broadcasts any JSON message to other peers in the same room. In addition, the server emits a few control messages:

- `session-info` — Sent after connect with session metadata and your `role`
- `room-joined` — Confirmation of room join with participant count
- `user-joined` — Another peer joined
- `user-left` — A peer disconnected

Typical application-level messages that clients may send (relayed by the server):

- `offer`, `answer`, `ice-candidate` — WebRTC signaling
- `calibration-*`, `gaze-data` — Eye-tracking flows
- `editor` — Shared editor updates (custom payloads)

## Test client

A simple HTML client exists at the repo root: `test.html`. Open it in a browser and point it at your local server to test the AI endpoint.



````
```tsx file="" isHidden
