import { SafetyGuardian } from "./agents/safety_guardian";
import { generateStreamingChatResponse } from "./openai";
import { createTimingMetadata, logTimingEvent } from "./trace-utils";
import type { Response } from "express";

export interface StreamingEvent {
  type: 'chunk' | 'done' | 'error' | 'meta';
  data?: string;
  conversationId?: string;
  safetyNotice?: string;
  error?: string;
}

export class SafeStreamingManager {
  private safetyGuardian: SafetyGuardian;
  private readonly chunkBuffer: string[] = [];
  private readonly BUFFER_SIZE = 50; // Buffer chunks before safety check
  private readonly MAX_UNSAFE_CHUNKS = 5; // Max unsafe chunks before aborting

  constructor() {
    this.safetyGuardian = new SafetyGuardian();
  }

  async streamWithSafety(
    res: Response,
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    conversationId: string,
    traceId: string,
    userId?: string
  ): Promise<{ fullResponse: string; safetyNotice?: string }> {
    // LATENCY OPTIMIZATION: Start LLM timing measurement
    const requestStart = performance.now();
    let firstTokenTime: number | null = null;
    let totalSafetyLatencyMs = 0;
    
    // Set up Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    res.setHeader('X-Trace-ID', traceId);

    let fullResponse = '';
    let chunkBuffer = '';
    let unsafeChunkCount = 0;
    let hasSafetyIssue = false;
    
    try {
      const streamGenerator = generateStreamingChatResponse(messages, systemPrompt);
      
      for await (const chunk of streamGenerator) {
        // LATENCY OPTIMIZATION: Measure time-to-first-token (TTFT)
        if (firstTokenTime === null) {
          firstTokenTime = performance.now();
          const ttftMs = Math.round(firstTokenTime - requestStart);
          
          // Send TTFT meta event to client for latency coordination
          this.sendEvent(res, {
            type: 'meta',
            data: JSON.stringify({
              event: 'first_token',
              ttftMs,
              traceId,
              timestamp: new Date().toISOString()
            })
          });
        }
        
        fullResponse += chunk;
        chunkBuffer += chunk;
        
        // Check buffer periodically for safety
        if (chunkBuffer.length >= this.BUFFER_SIZE || chunkBuffer.includes('.') || chunkBuffer.includes('!') || chunkBuffer.includes('?')) {
          // LATENCY OPTIMIZATION: Measure safety filtering time
          const safetyStart = performance.now();
          const assessment = await this.safetyGuardian.assessContent(chunkBuffer);
          const safetyDuration = Math.round(performance.now() - safetyStart);
          totalSafetyLatencyMs += safetyDuration;
          
          if (assessment.isSafe) {
            // Send buffered content as it's safe
            this.sendEvent(res, {
              type: 'chunk',
              data: chunkBuffer
            });
            chunkBuffer = '';
            unsafeChunkCount = 0;
          } else {
            unsafeChunkCount++;
            console.warn('Unsafe chunk detected:', assessment.concerns);
            
            // If too many unsafe chunks, abort stream
            if (unsafeChunkCount >= this.MAX_UNSAFE_CHUNKS) {
              hasSafetyIssue = true;
              this.sendEvent(res, {
                type: 'error',
                error: 'Content safety violation detected. Stream terminated.',
                conversationId
              });
              // CRITICAL: Close the SSE connection
              res.end();
              return {
                fullResponse: assessment.suggestedResponse || "I'm sorry, I can't provide that response. Let's keep our conversation positive and supportive.",
                safetyNotice: 'Response was filtered for safety'
              };
            }
            
            // Hold this chunk, continue buffering
            chunkBuffer += ' '; // Add space to continue natural flow
          }
        }
      }
      
      // Process any remaining buffered content
      if (chunkBuffer.length > 0 && !hasSafetyIssue) {
        const finalAssessment = await this.safetyGuardian.assessContent(chunkBuffer);
        if (finalAssessment.isSafe) {
          this.sendEvent(res, {
            type: 'chunk',
            data: chunkBuffer
          });
        } else {
          hasSafetyIssue = true;
        }
      }
      
      // Final safety check on complete response
      const finalResponse = await this.safetyGuardian.filterResponse(fullResponse);
      const wasFiltered = finalResponse !== fullResponse;
      
      // LATENCY OPTIMIZATION: Calculate final LLM timing metrics
      const totalLatencyMs = Math.round(performance.now() - requestStart);
      const ttftMs = firstTokenTime ? Math.round(firstTokenTime - requestStart) : null;
      const modelLatencyMs = firstTokenTime ? Math.round(performance.now() - firstTokenTime) : totalLatencyMs;
      
      // Structured logging for performance analysis using trace utils
      if (userId) {
        const timingMetadata = createTimingMetadata(traceId, 'llm_streaming', requestStart, {
          ttftMs,
          modelLatencyMs,
          totalSafetyLatencyMs
        });
        
        logTimingEvent('voice_llm_completed', userId, timingMetadata, {
          conversationId,
          responseLength: finalResponse.length,
          wasFiltered
        });
      } else {
        // Fallback to direct logging if no userId provided
        console.log(JSON.stringify({
          event: 'voice_llm_completed',
          traceId,
          conversationId,
          ttftMs,
          modelLatencyMs,
          totalSafetyLatencyMs,
          totalLatencyMs,
          responseLength: finalResponse.length,
          wasFiltered,
          timestamp: new Date().toISOString()
        }));
      }
      
      // Send final performance meta event to client
      this.sendEvent(res, {
        type: 'meta',
        data: JSON.stringify({
          event: 'llm_completed',
          ttftMs,
          modelLatencyMs,
          totalSafetyLatencyMs,
          totalLatencyMs,
          traceId,
          timestamp: new Date().toISOString()
        })
      });
      
      // Send completion event
      this.sendEvent(res, {
        type: 'done',
        conversationId,
        safetyNotice: wasFiltered ? 'Response was filtered for safety' : undefined
      });
      
      // CRITICAL: Close the SSE connection
      res.end();
      
      return {
        fullResponse: finalResponse,
        safetyNotice: wasFiltered ? 'Response was filtered for safety' : undefined
      };
      
    } catch (error) {
      console.error('Streaming error:', error);
      this.sendEvent(res, {
        type: 'error',
        error: 'Failed to generate response',
        conversationId
      });
      // CRITICAL: Close the SSE connection
      res.end();
      throw error;
    }
  }

  private sendEvent(res: Response, event: StreamingEvent): void {
    const eventData = `data: ${JSON.stringify(event)}\n\n`;
    res.write(eventData);
  }

  async preModerateInput(userMessage: string, context: any = {}): Promise<{
    isSafe: boolean;
    filteredMessage?: string;
    concerns?: string[];
  }> {
    const assessment = await this.safetyGuardian.assessContent(userMessage, context);
    
    if (!assessment.isSafe) {
      return {
        isSafe: false,
        concerns: assessment.concerns
      };
    }
    
    return {
      isSafe: true,
      filteredMessage: userMessage
    };
  }
}