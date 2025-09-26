/**
 * OpenAI Service Wrapper with Circuit Breaker Protection
 * Wraps all OpenAI API calls with circuit breaker, rate limiting, and cost tracking
 */

import { 
  openaiSttCircuitBreaker, 
  openaiTtsCircuitBreaker, 
  openaiLlmCircuitBreaker, 
  openaiEmbeddingCircuitBreaker 
} from './circuit-breaker';
import { rateLimitingService } from './rate-limiting';
import * as originalOpenAI from './openai';
import { nanoid } from 'nanoid';

interface OperationContext {
  userId?: string;
  requestId?: string;
  operationType: 'stt' | 'tts' | 'llm' | 'embedding';
}

/**
 * Enhanced OpenAI wrapper with circuit breaker protection
 */
export class OpenAIWithCircuitBreaker {
  
  /**
   * Create embedding with circuit breaker protection
   */
  async createEmbedding(text: string, context?: OperationContext): Promise<number[]> {
    const operation = () => originalOpenAI.createEmbedding(text);
    
    const fallback = async (): Promise<number[]> => {
      // Return zero vector as fallback
      console.warn('Embedding service unavailable, using zero vector fallback');
      return new Array(1536).fill(0);
    };

    const result = await openaiEmbeddingCircuitBreaker.execute(
      operation,
      fallback,
      context?.userId
    );

    // Track costs (convert USD to cents) - Skip if fallback was used
    if (result.success && context && !result.isFallback) {
      await rateLimitingService.trackServiceCost('embedding', {
        userId: context.userId,
        costUsd: Math.round(0.0001 * text.length / 1000 * 100), // Convert USD to cents
        tokensUsed: Math.ceil(text.length / 4),
        metadata: { requestId: context.requestId, textLength: text.length }
      });
    }

    if (!result.success) {
      throw result.error || new Error('Embedding creation failed');
    }

    return result.data!;
  }

  /**
   * Generate chat response with circuit breaker protection
   */
  async generateChatResponse(
    messages: Array<{ role: string; content: string }>,
    systemPrompt?: string,
    context?: OperationContext
  ): Promise<string> {
    const operation = () => originalOpenAI.generateChatResponse(messages, systemPrompt);
    
    const fallback = async (): Promise<string> => {
      console.warn('LLM service unavailable, using fallback response');
      return "I'm sorry, I'm experiencing technical difficulties right now. Please try again in a few moments.";
    };

    const result = await openaiLlmCircuitBreaker.execute(
      operation,
      fallback,
      context?.userId
    );

    // Track costs (convert USD to cents) - Skip if fallback was used
    if (result.success && context && !result.isFallback) {
      const totalTokens = this.estimateTokens(messages, systemPrompt);
      await rateLimitingService.trackServiceCost('llm', {
        userId: context.userId,
        costUsd: Math.round(0.03 * totalTokens / 1000 * 100), // Convert USD to cents
        tokensUsed: totalTokens,
        metadata: { requestId: context.requestId, messageCount: messages.length }
      });
    }

    if (!result.success) {
      throw result.error || new Error('Chat response generation failed');
    }

    return result.data!;
  }

  /**
   * Generate streaming chat response with circuit breaker protection
   */
  async* generateStreamingChatResponse(
    messages: Array<{ role: string; content: string }>,
    systemPrompt?: string,
    context?: OperationContext
  ): AsyncGenerator<string, void, unknown> {
    const operation = () => originalOpenAI.generateStreamingChatResponse(messages, systemPrompt);
    
    const fallback = async function* (): AsyncGenerator<string, void, unknown> {
      console.warn('Streaming LLM service unavailable, using fallback');
      const fallbackMessage = "I'm sorry, I'm experiencing technical difficulties. Please try again in a few moments.";
      
      // Simulate streaming by yielding chunks
      for (let i = 0; i < fallbackMessage.length; i += 5) {
        yield fallbackMessage.slice(i, i + 5);
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay
      }
    };

    const result = await openaiLlmCircuitBreaker.execute(
      async () => {
        const generator = operation();
        const chunks: string[] = [];
        
        // Collect all chunks
        for await (const chunk of generator) {
          chunks.push(chunk);
        }
        
        return chunks;
      },
      async () => {
        const fallbackChunks: string[] = [];
        for await (const chunk of fallback()) {
          fallbackChunks.push(chunk);
        }
        return fallbackChunks;
      },
      context?.userId
    );

    // Track costs (convert USD to cents) - Skip if fallback was used
    if (result.success && context && !result.isFallback) {
      const totalTokens = this.estimateTokens(messages, systemPrompt);
      await rateLimitingService.trackServiceCost('llm', {
        userId: context.userId,
        costUsd: Math.round(0.03 * totalTokens / 1000 * 100), // Convert USD to cents
        tokensUsed: totalTokens,
        metadata: { requestId: context.requestId, streaming: true }
      });
    }

    if (!result.success) {
      throw result.error || new Error('Streaming chat response failed');
    }

    // Yield the chunks
    for (const chunk of result.data!) {
      yield chunk;
    }
  }

  /**
   * Generate structured response with circuit breaker protection
   */
  async generateStructuredResponse<T>(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    context?: OperationContext
  ): Promise<T> {
    const operation = () => originalOpenAI.generateStructuredResponse<T>(messages, systemPrompt);
    
    const fallback = async (): Promise<T> => {
      console.warn('Structured LLM service unavailable, using fallback');
      throw new Error('Structured response service temporarily unavailable');
    };

    const result = await openaiLlmCircuitBreaker.execute(
      operation,
      fallback,
      context?.userId
    );

    // Track costs (convert USD to cents) - Skip if fallback was used
    if (result.success && context && !result.isFallback) {
      const totalTokens = this.estimateTokens(messages, systemPrompt);
      await rateLimitingService.trackServiceCost('llm', {
        userId: context.userId,
        costUsd: Math.round(0.03 * totalTokens / 1000 * 100), // Convert USD to cents
        tokensUsed: totalTokens,
        metadata: { requestId: context.requestId, structured: true }
      });
    }

    if (!result.success) {
      throw result.error || new Error('Structured response generation failed');
    }

    return result.data!;
  }

  /**
   * Transcribe audio with circuit breaker protection
   */
  async transcribeAudio(
    audioBuffer: Buffer, 
    filename: string,
    context?: OperationContext
  ): Promise<{ text: string; duration?: number }> {
    const operation = () => originalOpenAI.transcribeAudio(audioBuffer, filename);
    
    const fallback = async (): Promise<{ text: string; duration?: number }> => {
      console.warn('STT service unavailable, using fallback');
      return {
        text: "[Audio transcription temporarily unavailable]",
        duration: 0
      };
    };

    const result = await openaiSttCircuitBreaker.execute(
      operation,
      fallback,
      context?.userId
    );

    // Track costs (convert USD to cents) - Skip if fallback was used
    if (result.success && context && !result.isFallback) {
      const audioMinutes = audioBuffer.length / (16000 * 2 * 60); // Rough estimate
      await rateLimitingService.trackServiceCost('stt', {
        userId: context.userId,
        costUsd: Math.round(0.006 * audioMinutes * 100), // Convert USD to cents
        minutesProcessed: audioMinutes,
        metadata: { requestId: context.requestId, filename, audioSize: audioBuffer.length }
      });
    }

    if (!result.success) {
      throw result.error || new Error('Audio transcription failed');
    }

    return result.data!;
  }

  /**
   * Generate speech with circuit breaker protection
   */
  async generateSpeech(
    text: string, 
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova',
    context?: OperationContext
  ): Promise<Buffer> {
    const operation = () => originalOpenAI.generateSpeech(text, voice);
    
    const fallback = async (): Promise<Buffer> => {
      console.warn('TTS service unavailable, using fallback');
      // Return empty buffer as fallback
      return Buffer.alloc(0);
    };

    const result = await openaiTtsCircuitBreaker.execute(
      operation,
      fallback,
      context?.userId
    );

    // Track costs (convert USD to cents) - Skip if fallback was used
    if (result.success && context && !result.isFallback) {
      await rateLimitingService.trackServiceCost('tts', {
        userId: context.userId,
        costUsd: Math.round(0.015 * text.length / 1000 * 100), // Convert USD to cents
        charactersProcessed: text.length,
        metadata: { requestId: context.requestId, voice, textLength: text.length }
      });
    }

    if (!result.success) {
      throw result.error || new Error('Speech generation failed');
    }

    return result.data!;
  }

  /**
   * Estimate token count for cost calculation
   */
  private estimateTokens(
    messages: Array<{ role: string; content: string }>, 
    systemPrompt?: string
  ): number {
    let totalText = messages.map(m => m.content).join(' ');
    if (systemPrompt) {
      totalText += ' ' + systemPrompt;
    }
    
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(totalText.length / 4);
  }

  /**
   * Create operation context
   */
  createContext(
    operationType: 'stt' | 'tts' | 'llm' | 'embedding',
    userId?: string
  ): OperationContext {
    return {
      userId,
      requestId: nanoid(),
      operationType
    };
  }
}

// Export singleton instance
export const openaiWithCircuitBreaker = new OpenAIWithCircuitBreaker();