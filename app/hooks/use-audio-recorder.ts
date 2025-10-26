"use client";

import { useState, useCallback, useRef } from 'react';
import { audioBufferManager } from '@/lib/audio-manager';

interface UseAudioRecorderReturn {
  // State
  isRecording: boolean;
  isTranscribing: boolean;
  isUploading: boolean;
  transcript: string;
  error: string | null;
  
  // Function 1: Start continuous recording
  startRecording: () => Promise<void>;
  
  // Function 2: Reset recording buffer
  resetRecording: () => Blob | null;
  
  // Function 3: Transcribe current audio
  transcribeCurrentAudio: (role?: string) => Promise<void>;
  
  // Function 4: Upload interview data
  uploadInterviewData: (
    candidateName: string,
    transcript: string,
    interviewerName: string
  ) => Promise<void>;
  
  // Combined functions
  stopAndTranscribe: (role?: string) => Promise<void>;
  recordTranscribeAndUpload: (
    recordingDurationMs: number,
    role: string,
    candidateName: string,
    interviewerName: string
  ) => Promise<void>;
}

export const useAudioRecorder = (): UseAudioRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const currentAudioBlob = useRef<Blob | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const success = await audioBufferManager.startRecording();
      if (success) {
        setIsRecording(true);
      } else {
        setError('Failed to start recording');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown recording error');
    }
  }, []);

  const resetRecording = useCallback(() => {
    try {
      setError(null);
      const audioBlob = audioBufferManager.resetRecording();
      return audioBlob;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown reset error');
      return null;
    }
  }, []);

  const transcribeCurrentAudio = useCallback(async (role: string = 'unknown') => {
    try {
      setError(null);
      setIsTranscribing(true);
      
      // Get current audio blob
      const audioBlob = audioBufferManager.stopRecording();
      if (!audioBlob) {
        throw new Error('No audio data to transcribe');
      }
      
      currentAudioBlob.current = audioBlob;
      setIsRecording(false);
      
      const transcriptResult = await audioBufferManager.transcribeAudio(audioBlob, role);
      setTranscript(transcriptResult);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const uploadInterviewData = useCallback(async (
    candidateName: string,
    transcript: string,
    interviewerName: string
  ) => {
    try {
      setError(null);
      setIsUploading(true);
      
      const success = await audioBufferManager.uploadInterviewData(candidateName, transcript, interviewerName);
      if (!success) {
        throw new Error('Upload failed');
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      throw err; // Re-throw to allow caller to handle
    } finally {
      setIsUploading(false);
    }
  }, []);

  const stopAndTranscribe = useCallback(async (role: string = 'unknown') => {
    await transcribeCurrentAudio(role);
  }, [transcribeCurrentAudio]);

  const recordTranscribeAndUpload = useCallback(async (
    recordingDurationMs: number,
    role: string,
    candidateName: string,
    interviewerName: string
  ) => {
    try {
      setError(null);
      
      const result = await audioBufferManager.recordTranscribeAndUpload(
        recordingDurationMs,
        role,
        candidateName,
        interviewerName
      );
      
      setTranscript(result.transcript);
      
      if (!result.uploadSuccess) {
        throw new Error('Failed to upload interview data');
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Combined operation failed');
      throw err;
    }
  }, []);

  return {
    // State
    isRecording,
    isTranscribing,
    isUploading,
    transcript,
    error,
    
    // Functions
    startRecording,
    resetRecording,
    transcribeCurrentAudio,
    uploadInterviewData,
    stopAndTranscribe,
    recordTranscribeAndUpload,
  };
};
