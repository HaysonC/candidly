import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const role = formData.get('role') as string || 'unknown';

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Get Deepgram API key from environment
    const DG_API_KEY = process.env.DG_API_KEY;
    if (!DG_API_KEY) {
      return NextResponse.json({ error: 'Deepgram API key not configured' }, { status: 500 });
    }

    console.log(`🎧 Transcribing ${audioFile.name} as ${role} using Deepgram...`);

    // Convert audio file to array buffer for Deepgram
    const audioBuffer = await audioFile.arrayBuffer();

    // Call Deepgram API with nova-3 model (matching Python implementation exactly)
    const url = `https://api.deepgram.com/v1/listen?model=nova-3&language=en-US&smart_format=true&punctuate=true&utterances=true&paragraphs=true&diarize=true`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DG_API_KEY}`,
        'Content-Type': 'audio/webm',
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Deepgram API error:', response.status, errorText);
      return NextResponse.json({ error: 'Transcription service error' }, { status: response.status });
    }

    const result = await response.json();
    
    // Extract transcript from Deepgram response format (following your Python implementation)
    let transcript = '';
    
    // If Deepgram returns utterances with speaker labels (diarization)
    if (result.results?.utterances && result.results.utterances.length > 0) {
      console.log('✅ Processing diarized transcript with speaker labels...');
      const utteranceTexts = result.results.utterances.map((utt: any) => {
        const speaker = utt.speaker !== undefined ? `Speaker ${utt.speaker}` : 'Speaker';
        const text = utt.transcript?.trim() || '';
        return text ? `${speaker}: ${text}` : '';
      }).filter(Boolean);
      
      transcript = utteranceTexts.join('\n');
    } else {
      // Fallback: single transcript without speaker diarization
      transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || '';
    }
    
    console.log('✅ Deepgram transcription done:', transcript.slice(0, 100));

    return NextResponse.json({ 
      transcript: transcript || '[no text returned]',
      role: role
    });

  } catch (error) {
    console.error('❌ Transcription error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
