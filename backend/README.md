# WebRTC Signaling Server

A FastAPI-based WebSocket signaling server for P2P video calls.

## Setup

1. Install dependencies:
\`\`\`bash
pip install -r requirements.txt
\`\`\`

2. Run the server:
\`\`\`bash
python server.py
\`\`\`

The server will start on `http://localhost:8000`

## Tunneling

To make the server accessible from the internet, you can use:

### Option 1: ngrok
\`\`\`bash
ngrok http 8000
\`\`\`

### Option 2: Cloudflare Tunnel
\`\`\`bash
cloudflared tunnel --url http://localhost:8000
\`\`\`

### Option 3: localtunnel
\`\`\`bash
npx localtunnel --port 8000
\`\`\`

After tunneling, you'll get a public URL (e.g., `https://abc123.ngrok.io`).
Use this URL in your Next.js app by setting the `NEXT_PUBLIC_SIGNALING_SERVER` environment variable.

## API Endpoints

- `GET /` - Health check
- `WebSocket /ws/{room_id}` - WebSocket connection for a specific room

## Message Types

The server handles the following WebSocket message types:
- `offer` - WebRTC offer from initiating peer
- `answer` - WebRTC answer from receiving peer
- `ice-candidate` - ICE candidate for connection establishment

All messages are automatically forwarded to other participants in the same room.
\`\`\`

```tsx file="" isHidden
