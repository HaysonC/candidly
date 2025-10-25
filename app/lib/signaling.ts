export function getSignalingHttpBase() {
  const raw = process.env.NEXT_PUBLIC_SIGNALING_SERVER || "http://localhost:8000";
  // Convert ws(s) -> http(s) just in case a WS URL is provided
  return raw.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
}
