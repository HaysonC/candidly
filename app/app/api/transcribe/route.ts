import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const role = formData.get('role') as string || 'unknown';

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (audioFile.size === 0) {
      console.error('❌ Audio file is empty');
      return NextResponse.json({ error: 'Audio file is empty' }, { status: 400 });
    }

    if (audioFile.size > 50 * 1024 * 1024) { // 50MB limit
      console.error('❌ Audio file too large:', audioFile.size);
      return NextResponse.json({ error: 'Audio file too large (max 50MB)' }, { status: 400 });
    }

    // Get Deepgram API key from environment
    const DG_API_KEY = process.env.DG_API_KEY;
    if (!DG_API_KEY) {
      return NextResponse.json({ error: 'Deepgram API key not configured' }, { status: 500 });
    }

    console.log(`🎧 Transcribing ${audioFile.name} (${audioFile.type}, ${audioFile.size} bytes) as ${role} using Deepgram...`);

    // Convert audio file to array buffer for Deepgram
    const audioBuffer = await audioFile.arrayBuffer();
    console.log(`📦 Audio buffer size: ${audioBuffer.byteLength} bytes`);

    // Determine content type based on file type (following Python implementation)
    let contentType = 'application/octet-stream'; // default fallback
    if (audioFile.type) {
      contentType = audioFile.type;
    } else if (audioFile.name.endsWith('.webm')) {
      contentType = 'audio/webm';
    } else if (audioFile.name.endsWith('.wav')) {
      contentType = 'audio/wav';
    } else if (audioFile.name.endsWith('.mp4')) {
      contentType = 'video/mp4';
    } else if (audioFile.name.endsWith('.m4a')) {
      contentType = 'audio/m4a';
    }
    
    console.log(`📝 Using content type: ${contentType}`);

    // Call Deepgram API with nova-3 model (matching Python implementation exactly)
    const url = `https://api.deepgram.com/v1/listen?model=nova-3&language=en-US&smart_format=true&punctuate=true&utterances=true&paragraphs=true&diarize=true`;
    
    console.log('📤 Sending request to Deepgram:', {
      url,
      contentType,
      audioSize: audioBuffer.byteLength,
      hasApiKey: !!DG_API_KEY
    });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DG_API_KEY}`,
        'Content-Type': contentType,
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Deepgram API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        contentType: contentType,
        audioSize: audioBuffer.byteLength,
        fileName: audioFile.name,
        fileType: audioFile.type
      });
      return NextResponse.json({ 
        error: 'Transcription service error', 
        details: `Deepgram API returned ${response.status}: ${errorText}` 
      }, { status: response.status });
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
