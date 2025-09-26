import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AudioPlayerProps {
  text: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  autoPlay?: boolean;
  className?: string;
}

export default function AudioPlayer({ 
  text, 
  voice = 'nova',
  autoPlay = false,
  className = ''
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string>('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    if (autoPlay) {
      generateAndPlayAudio();
    }
    
    return () => {
      cleanup();
    };
  }, [text, voice]);

  const cleanup = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (progressRef.current) {
      clearInterval(progressRef.current);
      progressRef.current = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  const generateAudio = async (): Promise<string> => {
    setIsGenerating(true);
    setError('');
    
    try {
      const response = await fetch('/api/chat/voice/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, voice }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to generate audio`);
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      return url;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate audio';
      setError(errorMessage);
      
      toast({
        title: "Audio Generation Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAndPlayAudio = async () => {
    try {
      let url = audioUrl;
      
      // Generate audio if not already available
      if (!url) {
        url = await generateAudio();
      }
      
      await playAudio(url);
      
    } catch (error) {
      console.error('Failed to generate and play audio:', error);
    }
  };

  const playAudio = async (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      setIsLoading(true);
      
      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.onloadeddata = () => {
        setDuration(audio.duration);
        setIsLoading(false);
      };
      
      audio.oncanplaythrough = () => {
        audio.play()
          .then(() => {
            setIsPlaying(true);
            startProgressTracking();
            resolve();
          })
          .catch((error) => {
            setIsLoading(false);
            reject(error);
          });
      };
      
      audio.onended = () => {
        setIsPlaying(false);
        setProgress(0);
        stopProgressTracking();
        resolve();
      };
      
      audio.onerror = () => {
        setIsLoading(false);
        setIsPlaying(false);
        const error = new Error('Audio playback failed');
        reject(error);
      };
      
      audio.muted = isMuted;
    });
  };

  const startProgressTracking = () => {
    if (progressRef.current) {
      clearInterval(progressRef.current);
    }
    
    progressRef.current = setInterval(() => {
      if (audioRef.current && duration > 0) {
        const currentProgress = (audioRef.current.currentTime / duration) * 100;
        setProgress(currentProgress);
      }
    }, 100);
  };

  const stopProgressTracking = () => {
    if (progressRef.current) {
      clearInterval(progressRef.current);
      progressRef.current = null;
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      pauseAudio();
    } else {
      if (audioUrl) {
        playAudio(audioUrl).catch(console.error);
      } else {
        generateAndPlayAudio();
      }
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      stopProgressTracking();
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };

  const restart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setProgress(0);
    }
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (error && !audioUrl) {
    return (
      <div className={`flex items-center gap-2 text-sm text-red-600 ${className}`} data-testid="audio-error">
        <VolumeX className="h-4 w-4" />
        <span>Audio generation failed</span>
        <Button
          onClick={() => generateAndPlayAudio()}
          variant="outline"
          size="sm"
          data-testid="button-retry-audio"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 p-2 border rounded-lg bg-muted/30 ${className}`} data-testid="audio-player">
      {/* Play/Pause Button */}
      <Button
        onClick={handlePlayPause}
        disabled={isLoading || isGenerating}
        variant="ghost"
        size="sm"
        data-testid="button-play-pause"
      >
        {isLoading || isGenerating ? (
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      {/* Progress Bar */}
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 bg-gray-200 rounded-full h-1 relative" data-testid="progress-bar">
          <div 
            className="bg-blue-600 h-1 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {duration > 0 && (
          <span className="text-xs text-muted-foreground" data-testid="time-display">
            {formatTime((audioRef.current?.currentTime || 0))} / {formatTime(duration)}
          </span>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-1">
        <Button
          onClick={restart}
          disabled={!audioUrl || isLoading}
          variant="ghost"
          size="sm"
          data-testid="button-restart"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>

        <Button
          onClick={toggleMute}
          disabled={!audioUrl || isLoading}
          variant="ghost"
          size="sm"
          data-testid="button-mute"
        >
          {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
        </Button>
      </div>

      {/* Generation Status */}
      {isGenerating && (
        <span className="text-xs text-blue-600" data-testid="generation-status">
          Generating...
        </span>
      )}
    </div>
  );
}