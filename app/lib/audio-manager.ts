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
  private transcriptParts: string[] = [];
  private currentInterviewData: {
    candidateName: string;
    interviewerName: string;
    meetingCode: string;
  } | null = null;

  private onDataAvailable = (event: BlobEvent) => {
    if (event.data.size > 0) {
      this.state.audioChunks.push(event.data);
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

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.state.stream = stream;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = this.onDataAvailable;
      
      mediaRecorder.onstart = () => {
        console.log('🎙️ Audio recording started');
        this.state.isRecording = true;
      };

      mediaRecorder.onstop = () => {
        console.log('🛑 Audio recording stopped');
        this.state.isRecording = false;
      };

      this.state.mediaRecorder = mediaRecorder;
      
      // Start recording with 1-second chunks for continuous buffering
      mediaRecorder.start(1000);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      return false;
    }
  }

  /**
   * Function 2: Reset the audio buffer without stopping recording
   * Returns the current audio buffer before clearing it
   */
  resetRecording(): Blob | null {
    console.log('🔄 Resetting audio buffer (keeping recording active)...');
    
    // Get current audio chunks before clearing
    let audioBlob: Blob | null = null;
    if (this.state.audioChunks.length > 0) {
      audioBlob = new Blob(this.state.audioChunks, { type: 'audio/webm' });
    }
    
    // Clear the audio chunks buffer but keep recording
    this.state.audioChunks = [];
    
    return audioBlob;
  }

  /**
   * Stop recording and return accumulated audio blob
   */
  stopRecording(): Blob | null {
    if (!this.state.isRecording || !this.state.mediaRecorder) {
      console.warn('No active recording to stop');
      return null;
    }

    // this.state.mediaRecorder.stop();
    
    // Stop all audio tracks
    if (this.state.stream) {
    //   this.state.stream.getTracks().forEach(track => track.stop());
      this.state.stream = null;
    }

    // Combine all audio chunks into a single blob
    if (this.state.audioChunks.length > 0) {
      const audioBlob = new Blob(this.state.audioChunks, { type: 'audio/webm' });
      return audioBlob;
    }

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

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('role', role);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Transcription failed: ${errorData.error || response.statusText}`);
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
    interviewerName: string
  ): Promise<boolean> {
    try {
      console.log(`📝 Uploading interview transcript for ${candidateName}...`);

      // Create structured data from the transcript
      const codeData = {
        filename: `interview-transcript-${Date.now()}.txt`,
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
   * Start automatic interview recording with 1-minute intervals
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

      // Set up 1-minute interval for processing audio chunks
      this.intervalId = setInterval(() => {
        this.processAudioChunk();
      }, 60000); // 60 seconds

      console.log('✅ Automatic interview recording started');
      return true;

    } catch (error) {
      console.error('❌ Failed to start interview recording:', error);
      return false;
    }
  }

  /**
   * Process current audio chunk (called every minute)
   */
  private async processAudioChunk(): Promise<void> {
    try {
      console.log('🔄 Processing 1-minute audio chunk...');
      
      // Get current audio buffer and reset for next minute
      const audioBlob = this.resetRecording();
      
      if (!audioBlob || !this.currentInterviewData) {
        console.log('⚠️ No audio data or interview data available');
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
  private async processTranscriptAsync(audioBlob: Blob): Promise<void> {
    try {
      if (!this.currentInterviewData) return;

      // Transcribe audio
      const transcript = await this.transcribeAudio(audioBlob, 'interview');
      
      if (transcript && transcript.trim()) {
        // Add timestamp to transcript
        const timestamp = new Date().toISOString();
        const timestampedTranscript = `[${timestamp}]\n${transcript}\n\n`;
        
        // Store transcript part
        this.transcriptParts.push(timestampedTranscript);
        
        // Upload individual chunk (for backup/real-time processing)
        await this.uploadInterviewData(
          this.currentInterviewData.candidateName,
          timestampedTranscript,
          this.currentInterviewData.interviewerName
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
      
      // Clear interval
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
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
        const finalTranscriptData = {
          filename: `complete-interview-transcript-${Date.now()}.txt`,
          question: `Complete Interview Transcript - ${this.currentInterviewData.meetingCode}`,
          candidate_response: fullTranscript,
          language: "text"
        };

        uploadSuccess = await this.uploadInterviewData(
          this.currentInterviewData.candidateName,
          fullTranscript,
          this.currentInterviewData.interviewerName
        );
      }

      // Clean up
      this.currentInterviewData = null;
      this.transcriptParts = [];

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
