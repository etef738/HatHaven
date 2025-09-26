import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Square, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  onTranscriptionReceived?: (text: string) => void;
  isProcessing?: boolean;
  disabled?: boolean;
}

export default function VoiceRecorder({ 
  onRecordingComplete, 
  onTranscriptionReceived,
  isProcessing = false,
  disabled = false 
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioPermission, setAudioPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  // Check microphone permission on mount
  useEffect(() => {
    checkMicrophonePermission();
    return () => {
      cleanupResources();
    };
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setAudioPermission(permission.state);
      
      permission.addEventListener('change', () => {
        setAudioPermission(permission.state);
      });
    } catch (error) {
      console.warn('Could not check microphone permission:', error);
    }
  };

  const cleanupResources = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      
      streamRef.current = stream;
      setAudioPermission('granted');
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      mediaRecorderRef.current = mediaRecorder;
      const chunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        setRecordedAudio(audioBlob);
        
        // Create URL for playback
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Automatically send for transcription
        onRecordingComplete(audioBlob);
        
        cleanupResources();
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setAudioPermission('denied');
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access to use voice chat.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const playRecording = () => {
    if (audioUrl && !isPlaying) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
        audioRef.current = null;
      };
      
      audio.play();
      setIsPlaying(true);
    }
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      audioRef.current = null;
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const retryRecording = () => {
    setRecordedAudio(null);
    setAudioUrl('');
    setRecordingTime(0);
  };

  // Show permission request if needed
  if (audioPermission === 'denied') {
    return (
      <div className="flex flex-col items-center gap-2 p-4 text-center" data-testid="voice-permission-denied">
        <MicOff className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Microphone access is required for voice chat.
        </p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={checkMicrophonePermission}
          data-testid="button-retry-permission"
        >
          Retry Permission
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 border rounded-lg bg-background" data-testid="voice-recorder">
      {/* Recording Status */}
      {isRecording && (
        <div className="flex items-center gap-2 text-sm text-red-600" data-testid="recording-status">
          <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
          Recording... {formatTime(recordingTime)}
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex items-center gap-2">
        {!isRecording && !recordedAudio && (
          <Button
            onClick={startRecording}
            disabled={disabled || isProcessing}
            variant="default"
            size="sm"
            data-testid="button-start-recording"
          >
            <Mic className="h-4 w-4 mr-1" />
            Start Recording
          </Button>
        )}

        {isRecording && (
          <Button
            onClick={stopRecording}
            variant="destructive"
            size="sm"
            data-testid="button-stop-recording"
          >
            <Square className="h-4 w-4 mr-1" />
            Stop
          </Button>
        )}

        {recordedAudio && !isRecording && (
          <>
            <Button
              onClick={isPlaying ? stopPlayback : playRecording}
              variant="outline"
              size="sm"
              data-testid="button-play-recording"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Play
                </>
              )}
            </Button>

            <Button
              onClick={retryRecording}
              variant="outline"
              size="sm"
              disabled={isProcessing}
              data-testid="button-retry-recording"
            >
              Record Again
            </Button>
          </>
        )}
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <div className="flex items-center gap-2 text-sm text-blue-600" data-testid="processing-status">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
          Processing voice message...
        </div>
      )}
    </div>
  );
}