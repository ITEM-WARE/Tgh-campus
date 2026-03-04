import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Trash2, Upload, Send } from 'lucide-react';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSend = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 w-full">
      {audioUrl ? (
        <div className="w-full flex items-center gap-3">
          <button 
            onClick={resetRecording}
            className="p-2 text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
          >
            <Trash2 size={20} />
          </button>
          <audio src={audioUrl} controls className="flex-1 h-10 min-w-0" />
          <button 
            onClick={handleSend}
            className="p-2 text-cyber-neon hover:bg-cyber-neon/10 rounded-full transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="text-mono font-bold text-cyber-neon w-12 text-center">
            {formatTime(recordingTime)}
          </div>
          
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                : 'bg-cyber-neon text-cyber-dark hover:bg-cyber-neon/80'
            }`}
          >
            {isRecording ? <Square size={20} fill="currentColor" /> : <Mic size={24} />}
          </button>
          
          <div className="text-xs text-white/40 font-mono w-12">
            {isRecording ? 'REC' : 'READY'}
          </div>
        </div>
      )}
    </div>
  );
};
