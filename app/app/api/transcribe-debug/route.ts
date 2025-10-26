import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const role = formData.get('role') as string || 'unknown';

    console.log('🔍 DEBUG - Received request:', {
      audioFileName: audioFile?.name,
      audioFileSize: audioFile?.size,
      audioFileType: audioFile?.type,
      role: role,
      hasFile: !!audioFile
    });

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Get first few bytes of the audio file
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);
    const firstBytes = Array.from(audioBytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    const lastBytes = Array.from(audioBytes.slice(-16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    
    console.log('🔍 DEBUG - Audio file details:', {
      size: audioBuffer.byteLength,
      firstBytes,
      lastBytes,
      isWebM: firstBytes.startsWith('1a 45 df a3') // WebM signature
    });

    // Get Deepgram API key from environment
    const DG_API_KEY = process.env.DG_API_KEY;
    if (!DG_API_KEY) {
      return NextResponse.json({ error: 'Deepgram API key not configured' }, { status: 500 });
    }

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
    
    console.log('🔍 DEBUG - Request to Deepgram:', {
      url: 'https://api.deepgram.com/v1/listen?model=nova-3&language=en-US&smart_format=true&punctuate=true&utterances=true&paragraphs=true&diarize=true',
      contentType,
      audioSize: audioBuffer.byteLength,
      hasApiKey: !!DG_API_KEY,
      apiKeyPrefix: DG_API_KEY.substring(0, 8) + '...'
    });

    // Call Deepgram API with nova-3 model
    const url = `https://api.deepgram.com/v1/listen?model=nova-3&language=en-US&smart_format=true&punctuate=true&utterances=true&paragraphs=true&diarize=true`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DG_API_KEY}`,
        'Content-Type': contentType,
      },
      body: audioBuffer,
    });

    console.log('🔍 DEBUG - Deepgram response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔍 DEBUG - Deepgram error details:', {
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
        details: `Deepgram API returned ${response.status}: ${errorText}`,
        debug: {
          contentType,
          audioSize: audioBuffer.byteLength,
          fileName: audioFile.name,
          fileType: audioFile.type,
          firstBytes,
          deepgramError: errorText
        }
      }, { status: response.status });
    }

    const result = await response.json();
    console.log('🔍 DEBUG - Deepgram success:', {
      hasResults: !!result.results,
      hasUtterances: !!result.results?.utterances,
      utterancesCount: result.results?.utterances?.length || 0
    });
    
    // Extract transcript from Deepgram response format
    let transcript = '';
    
    if (result.results?.utterances && result.results.utterances.length > 0) {
      const utteranceTexts = result.results.utterances.map((utt: any) => {
        const speaker = utt.speaker !== undefined ? `Speaker ${utt.speaker}` : 'Speaker';
        const text = utt.transcript?.trim() || '';
        return text ? `${speaker}: ${text}` : '';
      }).filter(Boolean);
      
      transcript = utteranceTexts.join('\n');
    } else {
      transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || '';
    }

    return NextResponse.json({ 
      transcript: transcript || '[no text returned]',
      role: role,
      debug: {
        audioSize: audioBuffer.byteLength,
        contentType,
        transcriptLength: transcript.length
      }
    });

  } catch (error) {
    console.error('🔍 DEBUG - Transcription error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        debug: {
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          stack: error instanceof Error ? error.stack : undefined
        }
      },
      { status: 500 }
    );
  }
}
