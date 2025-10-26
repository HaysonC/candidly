const API_BASE_URL = process.env.NEXT_PUBLIC_SIGNALING_SERVER || "http://localhost:8000";

export type SessionStatus = "scheduled" | "completed" | "canceled";

export type SessionSummary = {
  meeting_code: string;
  candidate_name: string;
  candidate_email: string;
  interviewer_name: string;
  scheduled_at?: string | null;
  status: SessionStatus;
};

export async function listScheduledSessions(interviewer: string): Promise<SessionSummary[]> {
  const url = `${API_BASE_URL}/api/sessions?interviewer=${encodeURIComponent(interviewer)}&status=scheduled`;
  const response = await fetch(url, {
    headers: {
      "ngrok-skip-browser-warning": "true",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch scheduled sessions");
  }

  return response.json();
}

export type CreateSessionPayload = {
  candidate_name: string;
  candidate_email: string;
  interviewer_name: string;
  notes?: string;
  scheduled_at?: string | null;
  status?: SessionStatus;
};

export type CreateSessionResponse = {
  meeting_code: string;
  join_link: string;
};

export async function createSession(payload: CreateSessionPayload): Promise<CreateSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/create-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to create session");
  }

  return response.json();
}
