const API_BASE_URL = process.env.NEXT_PUBLIC_SIGNALING_SERVER || 'http://localhost:8000';

export interface CandidateTrackingData {
  files: {
    [filename: string]: {
      size: number;
      updated_at: string;
    };
  };
  created_at?: string;
}

export interface CandidateListRequest {
  interviewer: string;
}

export interface CandidateTrackingRequest {
  interviewer: string;
}

export interface CandidateFilePutRequest {
  interviewer: string;
  filename: string;
  content: string;
}

export interface CreateCandidateRequest {
  interviewer: string;
  interviewee: string;
}

// Get list of all candidates for an interviewer
export async function getCandidateList(interviewer: string): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/candidate_interviewed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({ interviewer }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch candidates');
  }

  return response.json();
}

// Get specific candidate's tracking data (files info)
export async function getCandidateTracking(
  interviewer: string,
  name: string
): Promise<CandidateTrackingData> {
  const response = await fetch(`${API_BASE_URL}/candidate_interviewed/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({ interviewer }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch candidate tracking data');
  }

  return response.json();
}

// Upload/update a file for a candidate
export async function uploadCandidateFile(
  interviewer: string,
  name: string,
  filename: string,
  content: string
): Promise<{ ok: boolean; candidate: string; file: string }> {
  const response = await fetch(`${API_BASE_URL}/candidate_interviewed/${name}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({ interviewer, filename, content }),
  });

  if (!response.ok) {
    throw new Error('Failed to upload file');
  }

  return response.json();
}

// Create a new candidate directory
export async function createCandidate(
  interviewer: string,
  interviewee: string
): Promise<{ interviewer: string; candidate: string; path: string }> {
  const response = await fetch(`${API_BASE_URL}/create_candidate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({ interviewer, interviewee }),
  });

  if (!response.ok) {
    throw new Error('Failed to create candidate');
  }

  return response.json();
}

// Delete a candidate
export async function deleteCandidate(
  interviewer: string,
  name: string
): Promise<{ deleted: boolean; candidate: string }> {
  const response = await fetch(
    `${API_BASE_URL}/candidate_interviewed/${name}?interviewer=${encodeURIComponent(interviewer)}`,
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    throw new Error('Failed to delete candidate');
  }

  return response.json();
}

// Get specific file content for a candidate
export async function getCandidateFile(
  interviewer: string,
  candidateName: string,
  filename: string
): Promise<{ filename: string; content?: string; contentBase64?: string; contentType?: string; size: number }> {
  const url = `${API_BASE_URL}/candidate_interviewed/${encodeURIComponent(candidateName)}/file/${encodeURIComponent(filename)}?interviewer=${encodeURIComponent(interviewer)}`;
  console.log('Fetching file from:', url);
  console.log('Interviewer:', interviewer);
  console.log('Candidate:', candidateName);
  console.log('Filename:', filename);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Failed to fetch file:', response.status, text);
    console.error('URL that failed:', url);
    throw new Error(`Failed to fetch file content: ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    console.error('Received non-JSON response:', text.substring(0, 200));
    throw new Error('Server returned non-JSON response');
  }

  return response.json();
}
