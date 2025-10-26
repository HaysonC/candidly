import { NextRequest, NextResponse } from 'next/server';
import FormData from 'form-data';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const role = formData.get('role') as string || 'unknown';

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Get Fish Audio API key from environment
    const FISH_API_KEY = process.env.FISH_API_KEY;
    if (!FISH_API_KEY) {
      return NextResponse.json({ error: 'Fish Audio API key not configured' }, { status: 500 });
    }

    // Convert File to Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create FormData for Fish Audio API using form-data package
    const fishFormData = new FormData();
    fishFormData.append('audio', buffer, {
      filename: audioFile.name || 'audio.webm',
      contentType: audioFile.type || 'audio/webm',
    });
    fishFormData.append('language', 'en');
    fishFormData.append('ignore_timestamps', 'false');

    console.log(`🎧 Transcribing ${audioFile.name} as ${role}...`);

    // Call Fish Audio API
    const response = await fetch('https://api.fish.audio/v1/asr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FISH_API_KEY}`,
        ...fishFormData.getHeaders(),
      },
      body: fishFormData as any,
    });

    const rawText = await response.text();
    let result;
    
    try {
      result = JSON.parse(rawText);
    } catch {
      console.error('⚠️ Non-JSON Fish Audio response:', rawText.slice(0, 200));
      result = { text: rawText };
    }

    const transcript = result.text?.trim() || '';
    console.log('✅ Transcription done:', transcript.slice(0, 60));

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
