// call the end point "/candidate_interviewed/{name}" and bypass ngrok with 'ngrok-skip-browser-warning': 'true',
import { getSignalingHttpBase } from './signaling'

interface CandidateCodeData {
    filename: string;
    question: string;
    candidate_response: string;
    language: string;
}

export async function uploadCandidateInterviewed(candidateName: string, codeData: CandidateCodeData, interviewerName: string): Promise<boolean> {
    if (!candidateName || !interviewerName || !codeData) return false
    const base = getSignalingHttpBase()
    
    // Format the content according to backend expectations
    const content = `Language: ${codeData.language}\n\nQuestion:\n${codeData.question}\n\nCandidate Response:\n${codeData.candidate_response}`;
    
    const requestPayload = {
        interviewer: interviewerName,
        filename: codeData.filename,
        content: content
    };
    
    const requestOptions: RequestInit = {
        method: 'PUT',
        headers: {
            'ngrok-skip-browser-warning': 'true',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload)
    };

    const res = await fetch(`${base}/candidate_interviewed/${encodeURIComponent(candidateName)}`, requestOptions);
    return res.ok
}