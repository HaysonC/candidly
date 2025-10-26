"use client";

interface AudioRecorderState {
  isRecording: boolean;
  mediaRecorder: MediaRecorder | null;
  audioChunks: Blob[];
  stream: MediaStream | null;
}

class AudioBufferManager {
  private state: AudioRecorderState = {
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    stream: null,
  };

  private intervalId: NodeJS.Timeout | null = null;
  private healthCheckIntervalId: NodeJS.Timeout | null = null;
  private transcriptParts: string[] = [];
  private currentInterviewData: {
    candidateName: string;
    interviewerName: string;
    meetingCode: string;
  } | null = null;
  private previousChunkCount: number = 0;

  private onDataAvailable = (event: BlobEvent) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8); // HH:MM:SS
    if (event.data.size > 0) {
      this.state.audioChunks.push(event.data);
      console.log(`📦 [${timestamp}] Audio chunk received: ${event.data.size} bytes (total chunks: ${this.state.audioChunks.length})`);
    } else {
      console.warn(`⚠️ [${timestamp}] Empty audio chunk received - this might indicate an issue with recording`);
    }
  };

  /**
   * Function 1: Start continuous audio recording and buffer storage
   */
  async startRecording(): Promise<boolean> {
    try {
      if (this.state.isRecording) {
        console.warn('Recording is already in progress');
        return true;
      }

      console.log('🎤 Requesting microphone access...');
      // Request microphone access with specific constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });
      this.state.stream = stream;
      console.log('✅ Microphone access granted');

      // Check if webm/opus is supported, fallback if needed
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.warn('⚠️ webm/opus not supported, trying alternatives...');
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = '';
          console.warn('⚠️ Using default mime type');
        }
      }
      console.log(`📝 Using mime type: ${mimeType || 'default'}`);

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      mediaRecorder.ondataavailable = this.onDataAvailable;
      
      mediaRecorder.onstart = () => {
        console.log('🎙️ Audio recording started');
        this.state.isRecording = true;
        this.previousChunkCount = 0; // Reset chunk counter
      };

      mediaRecorder.onstop = () => {
        console.log('🛑 Audio recording stopped');
        this.state.isRecording = false;
      };

      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
        this.state.isRecording = false;
      };

      mediaRecorder.onpause = () => {
        console.log('⏸️ Audio recording paused');
      };

      mediaRecorder.onresume = () => {
        console.log('▶️ Audio recording resumed');
      };

      this.state.mediaRecorder = mediaRecorder;
      
      // Start recording with 1-second chunks for continuous buffering
      mediaRecorder.start(1000);
      
      console.log(`📊 MediaRecorder initialized with state: ${mediaRecorder.state}`);
      
      // Verify recording started successfully after a brief delay
      setTimeout(() => {
        if (this.state.mediaRecorder?.state === 'recording') {
          console.log('✅ Recording started successfully and confirmed active');
        } else {
          console.warn('⚠️ Recording may not have started properly, state:', this.state.mediaRecorder?.state);
        }
      }, 500);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      this.state.isRecording = false;
      // Clean up on error
      if (this.state.stream) {
        this.state.stream.getTracks().forEach(track => track.stop());
        this.state.stream = null;
      }
      return false;
    }
  }

  /**
   * Function 2: Reset the audio buffer without stopping recording
   * Returns the current audio buffer before clearing it
   */
  resetRecording(): Blob | null {
    console.log('🔄 Resetting audio buffer (keeping recording active)...');
    console.log(`📊 Pre-reset state: chunks=${this.state.audioChunks.length}, mediaRecorder=${this.state.mediaRecorder?.state}, isRecording=${this.state.isRecording}`);
    
    // Get current audio chunks before clearing
    let audioBlob: Blob | null = null;
    if (this.state.audioChunks.length > 0) {
      audioBlob = new Blob(this.state.audioChunks, { type: 'audio/webm' });
      console.log(`📊 Reset buffer contains ${this.state.audioChunks.length} chunks, total size: ${audioBlob.size} bytes`);
      
      // Validate the audio blob
      if (audioBlob.size === 0) {
        console.warn('⚠️ Audio blob is empty despite having chunks - chunks might be invalid');
        audioBlob = null;
      } else if (audioBlob.size < 1000) { // Less than 1KB is likely just header data
        console.warn(`⚠️ Audio blob seems very small (${audioBlob.size} bytes) - might be empty audio`);
      }
    } else {
      console.warn('⚠️ No audio chunks available during reset - this might indicate recording stopped unexpectedly');
    }
    
    // Store the current MediaRecorder state before clearing chunks
    const wasRecording = this.state.mediaRecorder?.state === 'recording';
    
    // Clear the audio chunks buffer but keep recording
    this.state.audioChunks = [];
    console.log('🧹 Audio chunks buffer cleared');
    
    // If MediaRecorder was recording, ensure it continues
    if (wasRecording && this.state.mediaRecorder) {
      console.log('✅ MediaRecorder was recording, continuing...');
      // Force a small recording cycle to ensure it's still working
      try {
        // Request additional data to verify recording is still active
        this.state.mediaRecorder.requestData();
        console.log('📋 Requested data from MediaRecorder to verify it\'s active');
      } catch (e) {
        console.warn('⚠️ Could not request data from MediaRecorder:', e);
        this.restartRecording();
      }
    } else {
      console.error(`❌ MediaRecorder was not recording during reset! State: ${this.state.mediaRecorder?.state}`);
      this.restartRecording();
    }
    
    // Set up a check to verify chunks are still coming in
    const checkTime = Date.now();
    setTimeout(() => {
      const newChunks = this.state.audioChunks.length;
      console.log(`🔍 Post-reset check: ${newChunks} new chunks in 5 seconds`);
      if (newChunks === 0 && this.state.mediaRecorder?.state === 'recording') {
        console.warn('⚠️ No chunks received after reset despite MediaRecorder being active - forcing restart');
        this.restartRecording();
      }
    }, 5000);
    
    return audioBlob;
  }

  /**
   * Restart recording if it stopped unexpectedly
   */
  private async restartRecording(): Promise<void> {
    try {
      console.log('🔄 Attempting to restart recording...');
      console.log(`🔍 Current state before restart: mediaRecorder=${this.state.mediaRecorder?.state}, isRecording=${this.state.isRecording}, chunks=${this.state.audioChunks.length}`);
      
      // Stop existing MediaRecorder if it exists
      if (this.state.mediaRecorder) {
        try {
          console.log(`🛑 Stopping existing MediaRecorder (state: ${this.state.mediaRecorder.state})`);
          if (this.state.mediaRecorder.state !== 'inactive') {
            this.state.mediaRecorder.stop();
          }
        } catch (e) {
          console.warn('⚠️ Error stopping existing MediaRecorder:', e);
        }
      }
      
      // Check if stream is still active
      if (this.state.stream) {
        const audioTracks = this.state.stream.getAudioTracks();
        const activeAudioTracks = audioTracks.filter(track => track.readyState === 'live');
        
        if (activeAudioTracks.length === 0) {
          console.log('🔄 Stream inactive, requesting new microphone access...');
          // Stop old stream
          this.state.stream.getTracks().forEach(track => track.stop());
          
          // Get new stream
          this.state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      } else {
        console.log('🔄 No stream available, requesting microphone access...');
        this.state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      // Create new MediaRecorder with stream
      const mediaRecorder = new MediaRecorder(this.state.stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = this.onDataAvailable;
      
      mediaRecorder.onstart = () => {
        console.log('🎙️ Audio recording restarted');
        this.state.isRecording = true;
      };

      mediaRecorder.onstop = () => {
        console.log('🛑 Audio recording stopped');
        this.state.isRecording = false;
      };

      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
        this.state.isRecording = false;
      };

      this.state.mediaRecorder = mediaRecorder;
      mediaRecorder.start(1000);
      
      console.log('✅ Recording restarted successfully');
      console.log(`🔍 New state after restart: mediaRecorder=${mediaRecorder.state}, isRecording=${this.state.isRecording}`);
    } catch (error) {
      console.error('❌ Failed to restart recording:', error);
      this.state.isRecording = false;
    }
  }

  /**
   * Stop recording and return accumulated audio blob
   */
  stopRecording(): Blob | null {
    if (!this.state.isRecording || !this.state.mediaRecorder) {
      console.warn('No active recording to stop');
      return null;
    }

    console.log('🛑 Stopping MediaRecorder...');
    this.state.mediaRecorder.stop();
    
    // Stop all audio tracks
    if (this.state.stream) {
      console.log('🛑 Stopping audio stream tracks...');
      this.state.stream.getTracks().forEach(track => {
        track.stop();
        console.log(`🛑 Stopped track: ${track.kind} (${track.label})`);
      });
      this.state.stream = null;
    }

    // Reset state
    this.state.mediaRecorder = null;
    this.state.isRecording = false;

    // Combine all audio chunks into a single blob
    if (this.state.audioChunks.length > 0) {
      const audioBlob = new Blob(this.state.audioChunks, { type: 'audio/webm' });
      console.log(`📊 Final audio blob created: ${audioBlob.size} bytes from ${this.state.audioChunks.length} chunks`);
      
      // Clear chunks after creating blob
      this.state.audioChunks = [];
      
      return audioBlob;
    }

    console.warn('⚠️ No audio chunks available when stopping recording');
    return null;
  }

  /**
   * Get current recording state
   */
  getState(): { isRecording: boolean; chunksCount: number } {
    return {
      isRecording: this.state.isRecording,
      chunksCount: this.state.audioChunks.length,
    };
  }

  /**
   * Function 3: Upload audio to Fish Audio for speech-to-text transcription
   */
  async transcribeAudio(audioBlob: Blob, role: string = 'unknown'): Promise<string> {
    try {
      console.log(`🎧 Starting transcription for role: ${role}`);
      console.log(`📊 Audio blob details: size=${audioBlob.size} bytes, type=${audioBlob.type}`);

      // Validate audio blob
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('Audio blob is empty or invalid');
      }

      if (audioBlob.size < 100) { // Very small files are likely empty
        console.warn('⚠️ Audio blob seems very small, might be empty audio');
      }

      // Let's examine the actual audio data to debug
      const audioArrayBuffer = await audioBlob.arrayBuffer();
      const audioBytes = new Uint8Array(audioArrayBuffer);
      console.log(`🔍 Audio data inspection:`, {
        size: audioBlob.size,
        type: audioBlob.type,
        firstBytes: Array.from(audioBytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '),
        lastBytes: Array.from(audioBytes.slice(-16)).map(b => b.toString(16).padStart(2, '0')).join(' ')
      });

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('role', role);

      console.log('📤 Sending transcription request to debug endpoint...');
      const response = await fetch('/api/transcribe-debug', {
        method: 'POST',
        body: formData,
      });

      console.log(`📥 Transcription response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        let errorData;
        let responseText = '';
        try {
          responseText = await response.text();
          errorData = JSON.parse(responseText);
        } catch (e) {
          console.error('❌ Failed to parse error response:', responseText);
          throw new Error(`Transcription failed: ${response.status} ${response.statusText} - ${responseText}`);
        }
        
        console.error('❌ Detailed API error:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          responseText: responseText.slice(0, 500)
        });
        
        throw new Error(`Transcription failed: ${errorData.error || response.statusText}${errorData.details ? ` - ${errorData.details}` : ''}`);
      }

      const result = await response.json();
      const transcript = result.transcript || '';
      
      console.log('✅ Transcription completed:', transcript.slice(0, 100));
      return transcript;

    } catch (error) {
      console.error('❌ Transcription error:', error);
      throw error;
    }
  }

  /**
   * Function 4: Upload candidate interview data
   */
  async uploadInterviewData(
    candidateName: string,
    transcript: string,
    interviewerName: string,
    filenameOverride?: string
  ): Promise<boolean> {
    try {
      console.log(`📝 Uploading interview transcript for ${candidateName}...`);

      // Create structured data from the transcript
      const codeData = {
        filename: filenameOverride || `interview-transcript-${Date.now()}.txt`,
        question: "Interview Conversation Transcript",
        candidate_response: transcript,
        language: "text"
      };

      const response = await fetch('/api/upload-interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidateName,
          codeData,
          interviewerName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Upload failed: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Interview transcript uploaded successfully');
      return result.success || false;

    } catch (error) {
      console.error('❌ Upload interview transcript error:', error);
      throw error;
    }
  }

  /**
   * Start automatic interview recording with 2-minute intervals
   */
  async startInterviewRecording(
    candidateName: string,
    interviewerName: string,
    meetingCode: string
  ): Promise<boolean> {
    try {
      console.log('🎙️ Starting automatic interview recording...');
      
      // Store interview data
      this.currentInterviewData = { candidateName, interviewerName, meetingCode };
      this.transcriptParts = [];

      // Start recording
      const startSuccess = await this.startRecording();
      if (!startSuccess) {
        throw new Error('Failed to start recording');
      }

      // Set up 2-minute interval for processing audio chunks
      this.intervalId = setInterval(() => {
        this.processAudioChunk();
      }, 60000); // 60 seconds (1 minute)

      // Set up health check every 10 seconds
      this.healthCheckIntervalId = setInterval(() => {
        this.performHealthCheck();
      }, 10000);

      console.log('✅ Automatic interview recording started');
      return true;

    } catch (error) {
      console.error('❌ Failed to start interview recording:', error);
      return false;
    }
  }

  /**
   * Process current audio chunk (called every 2 minutes)
   */
  private async processAudioChunk(): Promise<void> {
    try {
      console.log('🔄 Processing 2-minute audio chunk...');
      console.log(`📊 Current recording state: ${this.getState().isRecording ? 'Active' : 'Inactive'}, chunks: ${this.getState().chunksCount}`);
      
      // Get current audio buffer and reset for next 2-minute interval
      const audioBlob = this.resetRecording();
      
      if (!audioBlob) {
        console.log('⚠️ No audio data available - skipping this interval');
        return;
      }

      if (audioBlob.size === 0) {
        console.log('⚠️ Audio blob is empty - skipping this interval');
        return;
      }

      if (!this.currentInterviewData) {
        console.log('⚠️ No interview data available - skipping this interval');
        return;
      }

      console.log(`📦 Processing audio blob of size: ${audioBlob.size} bytes`);

      // Only process if we have substantial audio data
      if (audioBlob.size < 1000) {
        console.log('⚠️ Audio blob too small, likely empty audio - skipping transcription');
        return;
      }

      // Process transcription and upload asynchronously
      this.processTranscriptAsync(audioBlob);

    } catch (error) {
      console.error('❌ Error processing audio chunk:', error);
    }
  }

  /**
   * Process transcript asynchronously (non-blocking)
   */
  private lastUploadedTranscriptHash: string | null = null;

  private hashString(input: string): string {
    // Simple djb2 hash
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) + hash) + input.charCodeAt(i);
      hash = hash & 0xffffffff;
    }
    return (hash >>> 0).toString(16);
  }

  private stripTimestampWrapper(text: string): string {
    const lines = text.split('\n');
    if (lines.length && /^\[[^\]]+\]\s*$/.test(lines[0])) {
      return lines.slice(1).join('\n').trim();
    }
    return text.trim();
  }

  private async processTranscriptAsync(audioBlob: Blob): Promise<void> {
    try {
      if (!this.currentInterviewData) return;

      console.log(`🔄 Processing transcript for ${audioBlob.size} bytes of audio...`);

      // Transcribe audio
  const transcript = await this.transcribeAudio(audioBlob, 'interview');
      
      if (transcript && transcript.trim()) {
        // Add timestamp to transcript
        const timestamp = new Date().toISOString();
        const timestampedTranscript = `[${timestamp}]\n${transcript}\n\n`;
        
        // Deduplicate by transcript content (ignore timestamp wrapper)
        const core = this.stripTimestampWrapper(timestampedTranscript);
        const coreHash = this.hashString(core);
        if (this.lastUploadedTranscriptHash === coreHash) {
          console.log('ℹ️ Duplicate transcript content detected, skipping upload.');
          return;
        }

        // Store transcript part and remember last hash
        this.transcriptParts.push(timestampedTranscript);
        this.lastUploadedTranscriptHash = coreHash;
        
        // Upload individual chunk (for backup/real-time processing)
        const safeTs = timestamp.replace(/[:.]/g, '-');
        const chunkFilename = `transcript-chunk-${safeTs}.txt`;
        await this.uploadInterviewData(
          this.currentInterviewData.candidateName,
          timestampedTranscript,
          this.currentInterviewData.interviewerName,
          chunkFilename
        );
        
        console.log('✅ Audio chunk processed and uploaded');
      }

    } catch (error) {
      console.error('❌ Error processing transcript:', error);
    }
  }

  /**
   * Stop automatic interview recording and process final chunk
   */
  async stopInterviewRecording(): Promise<{ fullTranscript: string; success: boolean }> {
    try {
      console.log('🛑 Stopping automatic interview recording...');
      
      // Clear intervals
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      if (this.healthCheckIntervalId) {
        clearInterval(this.healthCheckIntervalId);
        this.healthCheckIntervalId = null;
      }

      // Process final audio chunk
      const finalAudioBlob = this.resetRecording();
      if (finalAudioBlob && this.currentInterviewData) {
        await this.processTranscriptAsync(finalAudioBlob);
      }

      // Stop recording
      this.stopRecording();

      // Compile full transcript
      const fullTranscript = this.transcriptParts.join('');
      
      // Upload complete transcript
      let uploadSuccess = false;
      if (this.currentInterviewData && fullTranscript) {
        // If only one part and equals the core content of that part, skip final to avoid duplicate file
        const onlyOnePart = this.transcriptParts.length === 1;
        let isDuplicateOfSinglePart = false;
        if (onlyOnePart) {
          const corePart = this.stripTimestampWrapper(this.transcriptParts[0]);
          const coreFull = this.stripTimestampWrapper(fullTranscript);
          isDuplicateOfSinglePart = corePart === coreFull;
        }

        if (!isDuplicateOfSinglePart) {
          const finalName = `complete-interview-transcript-${this.currentInterviewData.meetingCode}.txt`;
          uploadSuccess = await this.uploadInterviewData(
            this.currentInterviewData.candidateName,
            fullTranscript,
            this.currentInterviewData.interviewerName,
            finalName
          );
        } else {
          uploadSuccess = true; // We already uploaded that single part
          console.log('ℹ️ Skipping final transcript upload to avoid duplicate content file.');
        }
      }

      // Clean up
  this.currentInterviewData = null;
  this.transcriptParts = [];
  this.lastUploadedTranscriptHash = null;

      console.log('✅ Interview recording stopped and final transcript uploaded');
      return { fullTranscript, success: uploadSuccess };

    } catch (error) {
      console.error('❌ Error stopping interview recording:', error);
      return { fullTranscript: '', success: false };
    }
  }

  /**
   * Get current transcript parts
   */
  getCurrentTranscript(): string {
    return this.transcriptParts.join('');
  }

  /**
   * Check if automatic recording is active
   */
  isInterviewRecordingActive(): boolean {
    return this.intervalId !== null && this.state.isRecording;
  }

  /**
   * Perform health check on recording system
   */
  private performHealthCheck(): void {
    if (!this.isInterviewRecordingActive()) return;

    const state = this.getState();
    console.log(`🏥 Health check - Recording: ${state.isRecording}, Chunks: ${state.chunksCount}, MediaRecorder state: ${this.state.mediaRecorder?.state}`);

    // Check if MediaRecorder stopped unexpectedly
    if (!this.state.mediaRecorder) {
      console.warn('⚠️ Health check detected no MediaRecorder! Attempting restart...');
      this.restartRecording();
      return;
    }

    if (this.state.mediaRecorder.state !== 'recording') {
      console.warn(`⚠️ Health check detected MediaRecorder not recording! State: ${this.state.mediaRecorder.state}. Attempting restart...`);
      this.restartRecording();
      return;
    }

    // Check if stream is still active
    if (this.state.stream) {
      const audioTracks = this.state.stream.getAudioTracks();
      const activeAudioTracks = audioTracks.filter(track => track.readyState === 'live');
      console.log(`🏥 Audio tracks: ${audioTracks.length} total, ${activeAudioTracks.length} active`);
      
      if (activeAudioTracks.length === 0) {
        console.warn('⚠️ Health check detected no active audio tracks! Stream may be dead. Attempting restart...');
        this.restartRecording();
        return;
      }
    } else {
      console.warn('⚠️ Health check detected no audio stream! Attempting restart...');
      this.restartRecording();
      return;
    }

    // Check if we're not receiving chunks (stalled recording)
    const previousChunkCount = this.previousChunkCount || 0;
    if (state.chunksCount === previousChunkCount && state.chunksCount === 0) {
      console.warn('⚠️ Health check detected no new chunks for 10 seconds! Recording may be stalled.');
      // Don't restart immediately if chunks are 0, might be normal at start
    }
    
    this.previousChunkCount = state.chunksCount;
  }

  /**
   * Convenience method: Record, transcribe, and upload in sequence
   */
  async recordTranscribeAndUpload(
    recordingDurationMs: number,
    role: string,
    candidateName: string,
    interviewerName: string
  ): Promise<{ transcript: string; uploadSuccess: boolean }> {
    try {
      // Start recording
      const startSuccess = await this.startRecording();
      if (!startSuccess) {
        throw new Error('Failed to start recording');
      }

      // Record for specified duration
      await new Promise(resolve => setTimeout(resolve, recordingDurationMs));

      // Stop recording and get audio blob
      const audioBlob = this.stopRecording();
      if (!audioBlob) {
        throw new Error('No audio data recorded');
      }

      // Transcribe audio
      const transcript = await this.transcribeAudio(audioBlob, role);

      // Upload interview transcript
      const uploadSuccess = await this.uploadInterviewData(candidateName, transcript, interviewerName);

      return { transcript, uploadSuccess };

    } catch (error) {
      console.error('❌ Record, transcribe, and upload error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const audioBufferManager = new AudioBufferManager();

// Export individual functions for convenience
export const startAudioRecording = () => audioBufferManager.startRecording();
export const resetRecording = () => audioBufferManager.resetRecording();
export const transcribeAudio = (audioBlob: Blob, role?: string) => audioBufferManager.transcribeAudio(audioBlob, role);
export const uploadInterviewData = (candidateName: string, transcript: string, interviewerName: string) => 
  audioBufferManager.uploadInterviewData(candidateName, transcript, interviewerName);

// Interview-specific functions
export const startInterviewRecording = (candidateName: string, interviewerName: string, meetingCode: string) =>
  audioBufferManager.startInterviewRecording(candidateName, interviewerName, meetingCode);
export const stopInterviewRecording = () => audioBufferManager.stopInterviewRecording();
export const getCurrentTranscript = () => audioBufferManager.getCurrentTranscript();
export const isInterviewRecordingActive = () => audioBufferManager.isInterviewRecordingActive();
