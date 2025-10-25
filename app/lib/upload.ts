// call the end point "/candidate_interviewed/{name}" and bypass ngrok with 'ngrok-skip-browser-warning': 'true',
import { getSignalingHttpBase } from './signaling'

interface CandidateCodeData {
    filename: string;
    content: string;
    language: string;
}

export async function uploadCandidateInterviewed(name: string, codeData?: CandidateCodeData): Promise<boolean> {
    if (!name) return false
    const base = getSignalingHttpBase()
    
    const requestOptions: RequestInit = {
        method: 'PUT',
        headers: {
            'ngrok-skip-browser-warning': 'true',
        },
    };

    if (codeData) {
        requestOptions.headers = {
            ...requestOptions.headers,
            'Content-Type': 'application/json',
        };
        requestOptions.body = JSON.stringify(codeData);
    }

    const res = await fetch(`${base}/candidate_interviewed/${encodeURIComponent(name)}`, requestOptions);
    return res.ok
}