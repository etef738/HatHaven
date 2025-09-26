/**
 * Circuit Breaker Implementation for External Service Providers
 * Provides exponential backoff, jitter, and automatic recovery for STT/TTS/LLM services
 */

import { storage } from './storage';
import type { CircuitBreakerState } from '@shared/schema';

interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  jitterMs: number;
}

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: Error;
  responseTimeMs: number;
  retryAfterMs?: number;
  isFallback?: boolean;
}

interface ProviderMetrics {
  requests: number;
  failures: number;
  avgResponseTime: number;
  lastFailure?: Date;
}

export class ServiceCircuitBreaker<T> {
  private serviceName: string;
  private config: CircuitBreakerConfig;
  private metrics: Map<string, ProviderMetrics> = new Map();
  private updateMutex: Map<string, Promise<void>> = new Map();

  constructor(serviceName: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.serviceName = serviceName;
    this.config = {
      failureThreshold: 5,
      successThreshold: 3,
      timeoutMs: 30000,
      retryDelayMs: 1000,
      maxRetryDelayMs: 60000,
      jitterMs: 500,
      ...config
    };
  }

  /**
   * Execute a service call with circuit breaker protection
   */
  async execute<R>(
    operation: () => Promise<R>,
    fallback?: () => Promise<R>,
    userId?: string
  ): Promise<ServiceResponse<R>> {
    const startTime = Date.now();
    
    try {
      // Check circuit breaker state
      const state = await this.getCircuitState();
      
      if (state?.state === 'open') {
        // Circuit is open - check if we can retry
        if (state.nextRetryTime && new Date() < state.nextRetryTime) {
          return this.handleOpenCircuit(fallback, Date.now() - startTime);
        }
        // Try transitioning to half-open
        await this.updateCircuitState('half_open');
      }

      // Execute operation with timeout
      const result = await Promise.race([
        operation(),
        this.timeoutPromise()
      ]);

      const responseTime = Date.now() - startTime;
      
      // Record success
      await this.recordSuccess(responseTime);
      
      return {
        success: true,
        data: result,
        responseTimeMs: responseTime
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Record failure and check if circuit should open
      await this.recordFailure(err, responseTime);
      
      // Try fallback if available
      if (fallback) {
        try {
          const fallbackResult = await fallback();
          return {
            success: true, // Mark as success since we got a response
            data: fallbackResult,
            error: err, // Keep original error for logging
            responseTimeMs: responseTime,
            isFallback: true // Indicate this came from fallback
          };
        } catch (fallbackError) {
          return {
            success: false,
            error: fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)),
            responseTimeMs: responseTime
          };
        }
      }

      return {
        success: false,
        error: err,
        responseTimeMs: responseTime,
        retryAfterMs: this.calculateNextRetryDelay()
      };
    }
  }

  /**
   * Handle circuit in open state
   */
  private async handleOpenCircuit<R>(
    fallback?: () => Promise<R>,
    responseTime: number = 0
  ): Promise<ServiceResponse<R>> {
    if (fallback) {
      try {
        const fallbackResult = await fallback();
        return {
          success: true, // Mark as success since we got a response
          data: fallbackResult,
          error: new Error(`${this.serviceName} circuit breaker is open - using fallback`),
          responseTimeMs: responseTime,
          isFallback: true // Indicate this came from fallback
        };
      } catch (fallbackError) {
        return {
          success: false,
          error: fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)),
          responseTimeMs: responseTime
        };
      }
    }

    return {
      success: false,
      error: new Error(`${this.serviceName} circuit breaker is open - no fallback available`),
      responseTimeMs: responseTime,
      retryAfterMs: this.calculateNextRetryDelay()
    };
  }

  /**
   * Record successful operation with atomic updates
   */
  private async recordSuccess(responseTime: number): Promise<void> {
    await this.withMutex('recordSuccess', async () => {
      const state = await this.getCircuitState();
      
      if (state?.state === 'half_open') {
        const newSuccessCount = await this.atomicIncrementSuccess(state.id!);
        
        if (newSuccessCount >= this.config.successThreshold) {
          // Transition to closed state
          await this.updateCircuitState('closed', {
            successCount: 0,
            failureCount: 0,
            lastFailureTime: null,
            nextRetryTime: null
          });
        }
      }

      // Update metrics
      await this.updateMetrics(responseTime, false);
    });
  }

  /**
   * Record failed operation with atomic updates
   */
  private async recordFailure(error: Error, responseTime: number): Promise<void> {
    await this.withMutex('recordFailure', async () => {
      const state = await this.getCircuitState();
      const newFailureCount = await this.atomicIncrementFailure(state?.id);
      
      if (newFailureCount >= this.config.failureThreshold) {
        // Open the circuit
        const nextRetryTime = new Date(Date.now() + this.calculateNextRetryDelay());
        
        await this.updateCircuitState('open', {
          failureCount: newFailureCount,
          lastFailureTime: new Date(),
          nextRetryTime,
          successCount: 0
        });
      } else {
        // Update last failure time without changing state
        await this.updateCircuitState((state?.state as 'open' | 'closed' | 'half_open') || 'closed', {
          lastFailureTime: new Date()
        });
      }

      // Update metrics
      await this.updateMetrics(responseTime, true);
    });
  }

  /**
   * Calculate exponential backoff with jitter
   */
  private calculateNextRetryDelay(): number {
    const state = this.getCircuitStateSync();
    const baseDelay = this.config.retryDelayMs;
    const failureCount = state?.failureCount || 0;
    
    // Exponential backoff: delay = baseDelay * 2^failureCount
    let delay = Math.min(
      baseDelay * Math.pow(2, failureCount),
      this.config.maxRetryDelayMs
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * this.config.jitterMs;
    delay += jitter;
    
    return Math.floor(delay);
  }

  /**
   * Create timeout promise
   */
  private timeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${this.serviceName} operation timed out after ${this.config.timeoutMs}ms`));
      }, this.config.timeoutMs);
    });
  }

  /**
   * Get current circuit breaker state from database
   */
  private async getCircuitState(): Promise<CircuitBreakerState | null> {
    try {
      return await storage.getCircuitBreakerState(this.serviceName);
    } catch (error) {
      console.error(`Failed to get circuit breaker state for ${this.serviceName}:`, error);
      return null;
    }
  }

  /**
   * Get circuit state synchronously (cached)
   */
  private getCircuitStateSync(): CircuitBreakerState | null {
    // This would use a local cache in a real implementation
    return null;
  }

  /**
   * Update circuit breaker state
   */
  private async updateCircuitState(
    newState: 'open' | 'closed' | 'half_open',
    updates: Partial<CircuitBreakerState> = {}
  ): Promise<void> {
    try {
      await storage.updateCircuitBreakerState(this.serviceName, {
        state: newState,
        ...updates,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error(`Failed to update circuit breaker state for ${this.serviceName}:`, error);
    }
  }

  /**
   * Update performance metrics
   */
  private async updateMetrics(responseTime: number, isFailure: boolean): Promise<void> {
    const current = this.metrics.get(this.serviceName) || {
      requests: 0,
      failures: 0,
      avgResponseTime: 0
    };
    
    current.requests += 1;
    if (isFailure) {
      current.failures += 1;
      current.lastFailure = new Date();
    }
    
    // Calculate moving average
    current.avgResponseTime = Math.round(
      (current.avgResponseTime * (current.requests - 1) + responseTime) / current.requests
    );
    
    this.metrics.set(this.serviceName, current);
    
    // Persist to database
    try {
      await storage.updateCircuitBreakerMetrics(this.serviceName, {
        totalRequests: current.requests,
        avgResponseTimeMs: current.avgResponseTime,
        lastFailureTime: current.lastFailure
      });
    } catch (error) {
      console.error(`Failed to update metrics for ${this.serviceName}:`, error);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): ProviderMetrics {
    return this.metrics.get(this.serviceName) || {
      requests: 0,
      failures: 0,
      avgResponseTime: 0
    };
  }

  /**
   * Atomic increment of success count
   */
  private async atomicIncrementSuccess(stateId: string): Promise<number> {
    try {
      return await storage.atomicIncrementCircuitBreakerSuccess(this.serviceName, stateId);
    } catch (error) {
      console.error(`Failed to atomically increment success for ${this.serviceName}:`, error);
      // Fallback to current count + 1
      const state = await this.getCircuitState();
      return (state?.successCount || 0) + 1;
    }
  }

  /**
   * Atomic increment of failure count
   */
  private async atomicIncrementFailure(stateId?: string): Promise<number> {
    try {
      // Ensure circuit breaker state exists
      if (!stateId) {
        await this.ensureCircuitState();
        const state = await this.getCircuitState();
        stateId = state?.id;
      }
      
      if (stateId) {
        return await storage.atomicIncrementCircuitBreakerFailure(this.serviceName, stateId);
      }
    } catch (error) {
      console.error(`Failed to atomically increment failure for ${this.serviceName}:`, error);
    }
    
    // Fallback to current count + 1
    const state = await this.getCircuitState();
    return (state?.failureCount || 0) + 1;
  }

  /**
   * Ensure circuit breaker state exists
   */
  private async ensureCircuitState(): Promise<void> {
    const existing = await this.getCircuitState();
    if (!existing) {
      await this.updateCircuitState('closed', {
        failureCount: 0,
        successCount: 0,
        lastFailureTime: null,
        nextRetryTime: null
      });
    }
  }

  /**
   * Execute function with mutex to prevent race conditions
   */
  private async withMutex<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const mutexKey = `${this.serviceName}_${key}`;
    
    // Wait for any existing operation to complete
    const existingPromise = this.updateMutex.get(mutexKey);
    if (existingPromise) {
      try {
        await existingPromise;
      } catch {
        // Ignore errors from previous operations
      }
    }
    
    // Create new operation promise
    const operationPromise = (async () => {
      try {
        return await fn();
      } finally {
        // Clean up mutex entry
        this.updateMutex.delete(mutexKey);
      }
    })();
    
    this.updateMutex.set(mutexKey, operationPromise as Promise<void>);
    return operationPromise;
  }

  /**
   * Reset circuit breaker to closed state
   */
  async reset(): Promise<void> {
    await this.withMutex('reset', async () => {
      await this.updateCircuitState('closed', {
        failureCount: 0,
        successCount: 0,
        lastFailureTime: null,
        nextRetryTime: null
      });
      this.metrics.delete(this.serviceName);
    });
  }
}

// Pre-configured circuit breakers for different services
export const openaiSttCircuitBreaker = new ServiceCircuitBreaker('openai_stt', {
  failureThreshold: 3,
  timeoutMs: 30000,
  retryDelayMs: 2000,
  maxRetryDelayMs: 30000
});

export const openaiTtsCircuitBreaker = new ServiceCircuitBreaker('openai_tts', {
  failureThreshold: 3,
  timeoutMs: 30000,
  retryDelayMs: 2000,
  maxRetryDelayMs: 30000
});

export const openaiLlmCircuitBreaker = new ServiceCircuitBreaker('openai_llm', {
  failureThreshold: 5,
  timeoutMs: 60000,
  retryDelayMs: 1000,
  maxRetryDelayMs: 60000
});

export const openaiEmbeddingCircuitBreaker = new ServiceCircuitBreaker('openai_embedding', {
  failureThreshold: 3,
  timeoutMs: 30000,
  retryDelayMs: 1000,
  maxRetryDelayMs: 30000
});