import { NextRequest, NextResponse } from 'next/server';
import { uploadCandidateInterviewed } from '@/lib/upload';

interface CandidateCodeData {
  filename: string;
  question: string;
  candidate_response: string;
  language: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { candidateName, codeData, interviewerName } = body;

    if (!candidateName || !codeData || !interviewerName) {
      return NextResponse.json(
        { error: 'Missing required fields: candidateName, codeData, or interviewerName' },
        { status: 400 }
      );
    }

    // Validate codeData structure
    if (!codeData.filename || !codeData.question || !codeData.candidate_response || !codeData.language) {
      return NextResponse.json(
        { error: 'Invalid codeData structure. Required: filename, question, candidate_response, language' },
        { status: 400 }
      );
    }

    console.log(`📝 Uploading candidate interview data for ${candidateName}...`);

    const success = await uploadCandidateInterviewed(candidateName, codeData, interviewerName);

    if (success) {
      console.log('✅ Successfully uploaded candidate interview data');
      return NextResponse.json({ success: true, message: 'Interview data uploaded successfully' });
    } else {
      console.error('❌ Failed to upload candidate interview data');
      return NextResponse.json(
        { error: 'Failed to upload interview data' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Upload interview data error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
