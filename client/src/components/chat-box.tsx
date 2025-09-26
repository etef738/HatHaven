import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Heart, Bot, Mic, MessageSquare, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import VoiceRecorder from "@/components/voice-recorder";
import AudioPlayer from "@/components/audio-player";

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isVoiceMessage?: boolean;
  audioUrl?: string;
}

interface ChatBoxProps {
  mode: 'heart' | 'dating_training';
  scenarioType?: 'coffee_shop' | 'restaurant' | 'first_date';
  onMessageSent?: (message: string) => void;
  onConversationCreated?: (conversationId: string) => void;
  initialMessages?: Message[];
}

export default function ChatBox({ 
  mode, 
  scenarioType, 
  onMessageSent, 
  onConversationCreated,
  initialMessages = [] 
}: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const streamMessage = async (message: string, isVoiceResponse: boolean = false) => {
    const endpoint = mode === 'heart' ? '/api/chat/companion/stream' : '/api/chat/scenario/stream';
    const payload = mode === 'heart' 
      ? { message, mode }
      : { message, mode, scenarioType };
    
    try {
      setIsStreaming(true);
      
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send message');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream available');
      }

      // Create streaming assistant message
      const streamingMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isVoiceMessage: isVoiceResponse
      };

      // Add empty streaming message
      setMessages(prev => [...prev, streamingMessage]);

      // Parse SSE events and accumulate content
      let accumulatedContent = '';
      let conversationId = '';
      let safetyNotice = '';
      const decoder = new TextDecoder();
      let buffer = '';
      let shouldTerminate = false; // Flag to break reading loop

      try {
        while (true && !shouldTerminate) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value);
          buffer += chunk;
          
          // Parse SSE events (data: {...}\n\n format)
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || ''; // Keep incomplete event in buffer
          
          for (const eventData of lines) {
            if (eventData.startsWith('data: ')) {
              try {
                const event = JSON.parse(eventData.substring(6));
                
                switch (event.type) {
                  case 'chunk':
                    if (event.data) {
                      accumulatedContent += event.data;
                      
                      // Update the streaming message with accumulated content
                      setMessages(prev => 
                        prev.map((msg, index) => 
                          index === prev.length - 1 && msg.role === 'assistant'
                            ? { ...msg, content: accumulatedContent }
                            : msg
                        )
                      );
                    }
                    break;
                    
                  case 'done':
                    conversationId = event.conversationId || '';
                    safetyNotice = event.safetyNotice || '';
                    shouldTerminate = true; // CRITICAL: Break reading loop immediately
                    break;
                    
                  case 'error':
                    shouldTerminate = true; // CRITICAL: Break reading loop immediately
                    throw new Error(event.error || 'Streaming error occurred');
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE event:', eventData, parseError);
              }
            }
          }
          
          // Break outer loop if termination was requested
          if (shouldTerminate) break;
        }
      } finally {
        reader.releaseLock();
      }

      // Call conversation created callback with ID
      if (conversationId && onConversationCreated) {
        onConversationCreated(conversationId);
      }

      // Show safety notice if content was filtered
      if (safetyNotice) {
        toast({
          title: "Content filtered",
          description: safetyNotice,
          variant: "default",
        });
      }

      // Invalidate dashboard data to refresh analytics
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Request was aborted, don't show error
        return;
      }
      
      console.error('Streaming error:', error);
      toast({
        title: "Message failed",
        description: error.message || 'Failed to send message',
        variant: "destructive",
      });
      
      // Remove any partial streaming message on error
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === 'assistant' && lastMessage.content === '') {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isStreaming) return;

    const userMessage: Message = {
      role: 'user',
      content: currentMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    onMessageSent?.(currentMessage);
    
    const messageToSend = currentMessage;
    setCurrentMessage("");
    
    await streamMessage(messageToSend);
  };

  // Cleanup function to abort streaming on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Voice message handling functions
  const handleVoiceRecording = async (audioBlob: Blob) => {
    if (mode !== 'heart') {
      toast({
        title: "Voice chat not available",
        description: "Voice chat is currently only available in Heart Mode.",
        variant: "destructive",
      });
      return;
    }

    // Check subscription tier
    if (!user || !['pro', 'premium'].includes(user.subscriptionTier)) {
      toast({
        title: "Voice chat requires Pro",
        description: "Upgrade to Pro or Premium to unlock voice chat functionality.",
        variant: "destructive",
      });
      setVoiceMode(false);
      return;
    }

    try {
      setIsTranscribing(true);
      setIsVoiceProcessing(true);

      // Step 1: Transcribe audio
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-message.webm');

      const transcribeResponse = await fetch('/api/chat/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json();
        throw new Error(errorData.message || 'Failed to transcribe audio');
      }

      const { text } = await transcribeResponse.json();
      setIsTranscribing(false);

      if (!text.trim()) {
        toast({
          title: "No speech detected",
          description: "Please try recording again with clearer speech.",
          variant: "destructive",
        });
        return;
      }

      // Add user voice message to chat
      const userMessage: Message = {
        role: 'user',
        content: text,
        timestamp: new Date(),
        isVoiceMessage: true
      };

      setMessages(prev => [...prev, userMessage]);
      onMessageSent?.(text);

      // Step 2: Stream AI response with voice flag
      await streamMessage(text, true);

    } catch (error: any) {
      console.error('Voice message error:', error);
      toast({
        title: "Voice message failed",
        description: error.message || 'Failed to process voice message',
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
      setIsVoiceProcessing(false);
    }
  };

  const toggleVoiceMode = () => {
    if (mode !== 'heart') {
      toast({
        title: "Voice chat not available",
        description: "Voice chat is currently only available in Heart Mode.",
        variant: "destructive",
      });
      return;
    }

    // Check subscription tier before enabling voice mode
    if (!user || !['pro', 'premium'].includes(user.subscriptionTier)) {
      toast({
        title: "Voice chat requires Pro",
        description: "Upgrade to Pro or Premium to unlock voice chat functionality.",
        variant: "destructive",
      });
      return;
    }

    setVoiceMode(!voiceMode);
  };

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Chat Header */}
        <div className="border-b border-border p-4">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              mode === 'heart' 
                ? 'bg-gradient-to-r from-primary to-secondary' 
                : 'bg-secondary'
            }`}>
              {mode === 'heart' ? (
                <Heart className="w-5 h-5 text-white" />
              ) : (
                <Bot className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">
                {mode === 'heart' ? 'AI Companion' : `Dating Training - ${scenarioType?.replace('_', ' ')}`}
              </h3>
              <p className="text-sm text-muted-foreground">
                {mode === 'heart' 
                  ? 'Always here to listen and support you' 
                  : 'Practice makes perfect'}
              </p>
            </div>
            
            {/* Voice Mode Toggle (Only for Heart Mode) */}
            {mode === 'heart' && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={toggleVoiceMode}
                  variant={voiceMode ? "default" : "outline"}
                  size="sm"
                  data-testid="button-voice-toggle"
                  className={voiceMode ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                  {voiceMode ? (
                    <>
                      <Volume2 className="h-4 w-4 mr-1" />
                      Voice
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Text
                    </>
                  )}
                </Button>
                {voiceMode && (
                  <Badge variant="secondary" className="text-xs">
                    Pro
                  </Badge>
                )}
                {!['pro', 'premium'].includes(user?.subscriptionTier || 'free') && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Pro Required
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
                  mode === 'heart' 
                    ? 'bg-gradient-to-r from-primary to-secondary' 
                    : 'bg-secondary'
                }`}>
                  {mode === 'heart' ? (
                    <Heart className="w-8 h-8 text-white" />
                  ) : (
                    <Bot className="w-8 h-8 text-white" />
                  )}
                </div>
                <p className="text-lg font-medium mb-2">
                  {mode === 'heart' ? 'Start a conversation' : 'Begin your practice session'}
                </p>
                <p className="text-sm">
                  {mode === 'heart' 
                    ? 'Your AI companion is here to listen and chat about anything on your mind.'
                    : 'Practice your dating conversation skills in a safe, supportive environment.'}
                </p>
              </div>
            )}
            
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                data-testid={`message-${message.role}-${index}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-primary to-secondary text-white'
                      : message.role === 'system'
                      ? 'bg-muted text-muted-foreground italic'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {/* Voice Message Indicator */}
                  {message.isVoiceMessage && (
                    <div className="flex items-center gap-1 mb-2">
                      <Mic className="h-3 w-3" />
                      <span className="text-xs opacity-70">Voice message</span>
                    </div>
                  )}
                  
                  <p className="text-sm">{message.content}</p>
                  
                  {/* Audio Player for Assistant Voice Messages */}
                  {message.role === 'assistant' && message.isVoiceMessage && (
                    <div className="mt-2">
                      <AudioPlayer 
                        text={message.content}
                        voice="nova"
                        autoPlay={true}
                        className="bg-background/50"
                      />
                    </div>
                  )}
                  
                  <p className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-white/70' : 'text-muted-foreground'
                  }`}>
                    {message.timestamp.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            ))}
            
            {isStreaming && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3 flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="border-t border-border p-4">
          {/* Voice Processing Status */}
          {(isTranscribing || isVoiceProcessing) && (
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  {isTranscribing ? "Transcribing your voice message..." : "Processing your message..."}
                </span>
              </div>
            </div>
          )}
          
          {voiceMode && mode === 'heart' ? (
            /* Voice Input Mode */
            <VoiceRecorder
              onRecordingComplete={handleVoiceRecording}
              isProcessing={isVoiceProcessing || isTranscribing || isStreaming}
              disabled={isStreaming || isVoiceProcessing}
            />
          ) : (
            /* Text Input Mode */
            <div className="flex space-x-2">
              <Input
                data-testid="input-chat-message"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={mode === 'heart' ? "Share what's on your mind..." : "Practice your conversation..."}
                disabled={isStreaming || isVoiceProcessing}
                className="flex-1"
              />
              <Button
                data-testid="button-send-message"
                onClick={handleSendMessage}
                disabled={!currentMessage.trim() || isStreaming || isVoiceProcessing}
                className="bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90"
              >
                {isStreaming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
