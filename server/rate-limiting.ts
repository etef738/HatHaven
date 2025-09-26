/**
 * Rate Limiting Middleware with Per-User Quotas and Cost Tracking
 * Provides comprehensive rate limiting for STT/TTS/LLM services with Express.js
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { storage } from './storage';
import type { RateLimitingConfig, InsertCostTracking, InsertRateLimitViolation } from '@shared/schema';
import { nanoid } from 'nanoid';

interface RateLimitConfig {
  keyPrefix: string;
  points: number; // Number of requests
  duration: number; // Per duration in seconds
  blockDuration: number; // Block duration in seconds
  execEvenly?: boolean; // Spread requests evenly across duration
}

interface CostLimitConfig {
  dailyLimitUsd: number;
  hourlyLimitUsd: number;
  globalDailyLimitUsd: number;
  globalHourlyLimitUsd: number;
}

interface UsageQuotas {
  dailyVoiceMinutes: number;
  monthlySttCalls: number;
  monthlyTtsCharacters: number;
  monthlyLlmTokens: number;
}

interface RequestContext {
  userId?: string;
  tier: 'free' | 'premium' | 'pro';
  ipAddress: string;
  userAgent: string;
}

export class RateLimitingService {
  private redis: Redis | null = null;
  private rateLimiters: Map<string, RateLimiterRedis | RateLimiterMemory> = new Map();
  private costLimits!: CostLimitConfig;
  private quotaConfigs!: Record<string, UsageQuotas>;
  private redisHealthy: boolean = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private limiterConfigs!: Record<string, RateLimitConfig>;
  
  // Enhanced health monitoring
  private redisStatus: 'green' | 'yellow' | 'red' = 'red';
  private lastPingMs: number = 0;
  private failCount: number = 0;
  private limiterMode: 'normal' | 'strict' = 'strict';

  constructor() {
    this.initializeRedis();
    this.initializeConfigs();
    this.setupRateLimiters();
  }

  /**
   * Initialize Redis connection with health monitoring
   */
  private initializeRedis(): void {
    try {
      // Try to connect to Redis
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL);
      } else if (process.env.REDIS_HOST) {
        this.redis = new Redis({
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || '6379'),
          connectTimeout: 5000,
          lazyConnect: true,
          maxRetriesPerRequest: 3
        });
      }
      
      if (this.redis) {
        this.redis.on('connect', () => {
          console.log('Redis connected successfully');
          this.handleRedisStatusChange(true);
        });
        
        this.redis.on('ready', () => {
          console.log('Redis ready for operations');
          this.handleRedisStatusChange(true);
        });
        
        this.redis.on('error', (err) => {
          console.warn('Redis connection error:', err.message);
          this.handleRedisStatusChange(false);
        });
        
        this.redis.on('close', () => {
          console.warn('Redis connection closed');
          this.handleRedisStatusChange(false);
        });
        
        this.redis.on('end', () => {
          console.warn('Redis connection ended');
          this.handleRedisStatusChange(false);
        });
      } else {
        // Log when Redis is not configured
        const hasRedisConfig = process.env.REDIS_URL || process.env.REDIS_HOST;
        if (!hasRedisConfig) {
          console.log('📋 Redis not configured (set REDIS_URL or REDIS_HOST/PORT) - using memory fallback with health monitoring');
        } else {
          console.warn('⚠️  Redis configuration found but connection failed - monitoring will retry');
        }
      }
      
      // Always start health monitoring regardless of Redis client availability
      this.startRedisHealthMonitoring();
      
    } catch (error) {
      console.warn('Failed to initialize Redis, using memory store:', error);
      this.redis = null;
      this.redisHealthy = false;
      // Still start monitoring to track and potentially recover
      this.startRedisHealthMonitoring();
    }
  }

  /**
   * Initialize cost and quota configurations
   */
  private initializeConfigs(): void {
    this.costLimits = {
      dailyLimitUsd: parseFloat(process.env.DAILY_COST_LIMIT_USD || '50'),
      hourlyLimitUsd: parseFloat(process.env.HOURLY_COST_LIMIT_USD || '10'),
      globalDailyLimitUsd: parseFloat(process.env.GLOBAL_DAILY_LIMIT_USD || '1000'),
      globalHourlyLimitUsd: parseFloat(process.env.GLOBAL_HOURLY_LIMIT_USD || '200'),
    };

    this.quotaConfigs = {
      free: {
        dailyVoiceMinutes: 5,
        monthlySttCalls: 50,
        monthlyTtsCharacters: 1000,
        monthlyLlmTokens: 10000,
      },
      premium: {
        dailyVoiceMinutes: 30,
        monthlySttCalls: 500,
        monthlyTtsCharacters: 10000,
        monthlyLlmTokens: 100000,
      },
      pro: {
        dailyVoiceMinutes: 120,
        monthlySttCalls: 2000,
        monthlyTtsCharacters: 50000,
        monthlyLlmTokens: 500000,
      },
    };
  }

  /**
   * Setup rate limiters for different services
   */
  private setupRateLimiters(): void {
    this.limiterConfigs = {
      'stt_requests': {
        keyPrefix: 'stt_req',
        points: 60, // 60 requests
        duration: 60, // per minute
        blockDuration: 60, // block for 1 minute
        execEvenly: true,
      },
      'tts_requests': {
        keyPrefix: 'tts_req',
        points: 30, // 30 requests
        duration: 60, // per minute
        blockDuration: 60,
        execEvenly: true,
      },
      'llm_requests': {
        keyPrefix: 'llm_req',
        points: 100, // 100 requests
        duration: 60, // per minute
        blockDuration: 60,
        execEvenly: true,
      },
      'global_requests': {
        keyPrefix: 'global_req',
        points: 1000, // 1000 total requests
        duration: 60, // per minute
        blockDuration: 30,
      },
    };

    this.rebuildRateLimitersWithStrictMode();
  }

  /**
   * Rebuild rate limiters based on current Redis status
   */
  private rebuildRateLimiters(): void {
    console.log(`Rebuilding rate limiters (Redis ${this.redisHealthy ? 'healthy' : 'unhealthy'})`);
    
    for (const [service, config] of Object.entries(this.limiterConfigs)) {
      try {
        const limiter = this.redisHealthy && this.redis
          ? new RateLimiterRedis({
              storeClient: this.redis,
              keyPrefix: config.keyPrefix,
              points: config.points,
              duration: config.duration,
              blockDuration: config.blockDuration,
              execEvenly: config.execEvenly,
            })
          : new RateLimiterMemory({
              keyPrefix: config.keyPrefix,
              points: config.points,
              duration: config.duration,
              blockDuration: config.blockDuration,
              execEvenly: config.execEvenly,
            });

        this.rateLimiters.set(service, limiter);
      } catch (error) {
        console.error(`Failed to create rate limiter for ${service}:`, error);
        // Fallback to memory limiter
        const memoryLimiter = new RateLimiterMemory({
          keyPrefix: config.keyPrefix,
          points: config.points,
          duration: config.duration,
          blockDuration: config.blockDuration,
          execEvenly: config.execEvenly,
        });
        this.rateLimiters.set(service, memoryLimiter);
      }
    }
  }

  /**
   * Express middleware for rate limiting
   */
  createRateLimitMiddleware(serviceType: 'stt' | 'tts' | 'llm') {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const context = this.extractRequestContext(req);
        
        // Check global rate limits first
        await this.checkGlobalRateLimit(context);
        
        // Check service-specific rate limits
        await this.checkServiceRateLimit(serviceType, context);
        
        // Check user quotas
        await this.checkUserQuotas(serviceType, context);
        
        // Check cost limits
        await this.checkCostLimits(context);
        
        next();
      } catch (error) {
        this.handleRateLimitError(error, req, res, serviceType);
      }
    };
  }

  /**
   * Extract request context
   */
  private extractRequestContext(req: Request): RequestContext {
    return {
      userId: req.user?.id,
      tier: 'free', // Default tier, will be determined from entitlements
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
    };
  }

  /**
   * Check global rate limits
   */
  private async checkGlobalRateLimit(context: RequestContext): Promise<void> {
    const limiter = this.getRateLimiter('global_requests');
    if (!limiter) return;

    try {
      await limiter.consume('global');
    } catch (rejRes) {
      const error = new Error('Global rate limit exceeded') as any;
      error.rateLimitInfo = rejRes;
      error.type = 'global_rate_limit';
      throw error;
    }
  }

  /**
   * Check service-specific rate limits
   */
  private async checkServiceRateLimit(
    serviceType: 'stt' | 'tts' | 'llm',
    context: RequestContext
  ): Promise<void> {
    const limiter = this.getRateLimiter(`${serviceType}_requests`);
    if (!limiter) return;

    const key = context.userId || context.ipAddress;

    try {
      await limiter.consume(key);
    } catch (rejRes) {
      const error = new Error(`${serviceType.toUpperCase()} rate limit exceeded`) as any;
      error.rateLimitInfo = rejRes;
      error.type = 'service_rate_limit';
      error.serviceType = serviceType;
      throw error;
    }
  }

  /**
   * Check user quotas
   */
  private async checkUserQuotas(
    serviceType: 'stt' | 'tts' | 'llm',
    context: RequestContext
  ): Promise<void> {
    if (!context.userId) return; // Skip for anonymous users

    // Get user's persistent quota config from database
    let config = await storage.getRateLimitingConfig(context.userId);
    
    // If no config exists, create one with default tier settings
    if (!config) {
      const defaultQuotas = this.quotaConfigs[context.tier];
      const newConfig = {
        userId: context.userId,
        tier: context.tier,
        dailyVoiceMinutesLimit: defaultQuotas.dailyVoiceMinutes,
        monthlySttCallsLimit: defaultQuotas.monthlySttCalls,
        monthlyTtsCharactersLimit: defaultQuotas.monthlyTtsCharacters,
        monthlyLlmTokensLimit: defaultQuotas.monthlyLlmTokens,
        currentPeriodStart: new Date()
      };
      config = await storage.createRateLimitingConfig(newConfig);
    }

    // Check daily voice minutes for STT/TTS using DB config
    if (serviceType === 'stt' || serviceType === 'tts') {
      const dailyMinutes = await storage.getDailyVoiceMinutes(context.userId, new Date());
      if (dailyMinutes >= config.dailyVoiceMinutesLimit) {
        const error = new Error('Daily voice minutes quota exceeded') as any;
        error.type = 'quota_exceeded';
        error.quotaType = 'daily_voice_minutes';
        error.limit = config.dailyVoiceMinutesLimit;
        error.current = dailyMinutes;
        throw error;
      }
    }

    // Additional quota checks can be added here for monthly limits
    // TODO: Implement monthly STT/TTS/LLM limit checks using config values
  }

  /**
   * Check cost limits
   */
  private async checkCostLimits(context: RequestContext): Promise<void> {
    if (!context.userId) return;

    // Check user daily costs
    const dailyCosts = await storage.getUserDailyCosts(context.userId, new Date());
    if (dailyCosts > this.costLimits.dailyLimitUsd * 100) { // Convert to cents
      const error = new Error('Daily cost limit exceeded') as any;
      error.type = 'cost_limit_exceeded';
      error.limitType = 'daily';
      error.limit = this.costLimits.dailyLimitUsd;
      error.current = dailyCosts / 100;
      throw error;
    }

    // Check global limits
    const globalDailyCosts = await storage.getGlobalDailyCosts();
    if (globalDailyCosts > this.costLimits.globalDailyLimitUsd * 100) {
      const error = new Error('Global daily cost limit exceeded') as any;
      error.type = 'global_cost_limit_exceeded';
      error.limitType = 'global_daily';
      throw error;
    }
  }

  /**
   * Handle rate limit errors
   */
  private handleRateLimitError(
    error: any,
    req: Request,
    res: Response,
    serviceType: string
  ): void {
    const context = this.extractRequestContext(req);
    
    // Record violation
    this.recordViolation(error, context, serviceType);

    // Set rate limit headers
    if (error.rateLimitInfo) {
      res.set('Retry-After', String(Math.round(error.rateLimitInfo.msBeforeNext / 1000)));
      res.set('X-RateLimit-Limit', String(error.rateLimitInfo.totalHits));
      res.set('X-RateLimit-Remaining', String(error.rateLimitInfo.remainingPoints));
      res.set('X-RateLimit-Reset', String(new Date(Date.now() + error.rateLimitInfo.msBeforeNext)));
    }

    // Return appropriate error response
    const statusCode = this.getErrorStatusCode(error.type);
    const response = this.getErrorResponse(error, serviceType);

    res.status(statusCode).json(response);
  }

  /**
   * Record rate limit violation
   */
  private async recordViolation(
    error: any,
    context: RequestContext,
    serviceType: string
  ): Promise<void> {
    try {
      const violation: InsertRateLimitViolation = {
        userId: context.userId,
        violationType: error.type || 'unknown',
        limitExceeded: error.limit || 0,
        currentUsage: error.current || 0,
        requestDetails: {
          serviceType,
          errorType: error.type,
          tier: context.tier,
        },
        actionTaken: 'blocked',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      };

      await storage.recordRateLimitViolation(violation);
    } catch (recordError) {
      console.error('Failed to record rate limit violation:', recordError);
    }
  }

  /**
   * Get HTTP status code for error type
   */
  private getErrorStatusCode(errorType: string): number {
    switch (errorType) {
      case 'global_rate_limit':
      case 'service_rate_limit':
        return 429; // Too Many Requests
      case 'quota_exceeded':
        return 402; // Payment Required
      case 'cost_limit_exceeded':
      case 'global_cost_limit_exceeded':
        return 402; // Payment Required
      default:
        return 429;
    }
  }

  /**
   * Get error response for different error types
   */
  private getErrorResponse(error: any, serviceType: string): any {
    const baseResponse = {
      success: false,
      error: error.message,
      type: error.type,
      serviceType,
      retryAfter: error.rateLimitInfo?.msBeforeNext,
    };

    switch (error.type) {
      case 'quota_exceeded':
        return {
          ...baseResponse,
          fallbackSuggestion: 'text_only_mode',
          upgradeRequired: true,
          quotaInfo: {
            type: error.quotaType,
            limit: error.limit,
            current: error.current,
          },
        };

      case 'cost_limit_exceeded':
        return {
          ...baseResponse,
          fallbackSuggestion: 'reduce_usage',
          costInfo: {
            limitType: error.limitType,
            limit: error.limit,
            current: error.current,
          },
        };

      case 'global_cost_limit_exceeded':
        return {
          ...baseResponse,
          fallbackSuggestion: 'service_maintenance',
          message: 'Service temporarily unavailable due to high demand',
        };

      default:
        return baseResponse;
    }
  }

  /**
   * Track API costs
   */
  async trackServiceCost(
    serviceType: 'stt' | 'tts' | 'llm' | 'embedding',
    costData: {
      userId?: string;
      costUsd: number;
      tokensUsed?: number;
      charactersProcessed?: number;
      minutesProcessed?: number;
      metadata?: any;
    }
  ): Promise<void> {
    try {
      const costEntry: InsertCostTracking = {
        userId: costData.userId,
        serviceType,
        provider: 'openai',
        costUsd: Math.round(costData.costUsd * 100), // Convert to cents
        tokensUsed: costData.tokensUsed,
        charactersProcessed: costData.charactersProcessed,
        minutesProcessed: costData.minutesProcessed,
        requestId: nanoid(),
        metadata: costData.metadata,
      };

      await storage.trackCost(costEntry);
    } catch (error) {
      console.error('Failed to track service cost:', error);
    }
  }

  /**
   * Start Redis health monitoring
   */
  private startRedisHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // More frequent health checks (every 5 seconds) for better responsiveness
    this.healthCheckInterval = setInterval(async () => {
      await this.performRedisHealthCheck();
    }, 5000);
    
    // Startup health check - don't wait 5 seconds
    setTimeout(() => this.performRedisHealthCheck(), 1000);
  }

  /**
   * Enhanced Redis health check with detailed status monitoring
   */
  private async performRedisHealthCheck(): Promise<void> {
    if (!this.redis) {
      this.updateRedisStatus('red', 0);
      
      // Check if we should attempt Redis initialization
      const hasRedisConfig = process.env.REDIS_URL || process.env.REDIS_HOST;
      if (hasRedisConfig) {
        // Attempt to reinitialize Redis connection
        console.log('🔄 Attempting Redis reconnection...');
        this.initializeRedis();
        return;
      }
      
      // Log status periodically for visibility (every 12 checks = 1 minute)
      this.failCount++;
      if (this.failCount % 12 === 0) {
        console.log(`📊 Redis status: not configured - memory fallback active (${this.failCount} checks)`);
      }
      return;
    }

    const startTime = Date.now();
    try {
      await this.redis.ping();
      const pingMs = Date.now() - startTime;
      
      // Reset fail count on successful ping
      this.failCount = 0;
      
      // Determine status based on ping time
      const newStatus = pingMs < 100 ? 'green' : (pingMs < 500 ? 'yellow' : 'red');
      this.updateRedisStatus(newStatus, pingMs);
      
      // Update health status
      if (!this.redisHealthy) {
        console.log(`✅ Redis health check passed - ping: ${pingMs}ms - marking as healthy`);
        this.handleRedisStatusChange(true);
      }
      
    } catch (error) {
      this.failCount++;
      this.updateRedisStatus('red', 0);
      
      // Log with request ID pattern for alerting
      const requestId = nanoid();
      console.warn(`[${requestId}] Redis health check failed (attempt ${this.failCount}):`, error);
      
      // Alert after 60s of failures (2 consecutive failures at 30s intervals)
      if (this.failCount >= 2) {
        console.error(`🚨 [${requestId}] REDIS ALERT: Unhealthy for >60s - fail count: ${this.failCount}`);
      }
      
      if (this.redisHealthy) {
        this.handleRedisStatusChange(false);
      }
    }
  }

  /**
   * Update Redis status and metrics with strict mode enforcement
   */
  private updateRedisStatus(status: 'green' | 'yellow' | 'red', pingMs: number): void {
    this.redisStatus = status;
    this.lastPingMs = pingMs;
    
    // Determine limiter mode and apply strict mode
    const newMode = status === 'red' || (status === 'yellow' && pingMs > 300) ? 'strict' : 'normal';
    if (this.limiterMode !== newMode) {
      this.limiterMode = newMode;
      console.log(`🚦 Rate limiter mode: ${this.limiterMode} (Redis: ${status}, ping: ${pingMs}ms)`);
      
      // Rebuild rate limiters with adjusted configs for strict mode
      this.rebuildRateLimitersWithStrictMode();
      
      // Send alert for mode changes to strict
      if (newMode === 'strict') {
        this.sendRedisAlert(`Rate limiting switched to strict mode - Redis status: ${status}`);
      }
    }
  }
  
  /**
   * Rebuild rate limiters with strict mode adjustments
   */
  private rebuildRateLimitersWithStrictMode(): void {
    // Apply strict mode multiplier to rate limits
    const strictMultiplier = this.limiterMode === 'strict' ? 0.5 : 1.0;
    const strictBlockMultiplier = this.limiterMode === 'strict' ? 2.0 : 1.0;
    
    // Update configs with strict mode adjustments
    const adjustedConfigs = {
      llm: {
        keyPrefix: 'heartscene:llm',
        points: Math.floor(60 * strictMultiplier), // Reduce points in strict mode
        duration: 300,
        blockDuration: Math.floor(300 * strictBlockMultiplier), // Longer blocks in strict
        execEvenly: true,
      },
      stt: {
        keyPrefix: 'heartscene:stt', 
        points: Math.floor(30 * strictMultiplier),
        duration: 300,
        blockDuration: Math.floor(300 * strictBlockMultiplier),
        execEvenly: true,
      },
      tts: {
        keyPrefix: 'heartscene:tts',
        points: Math.floor(30 * strictMultiplier),
        duration: 300, 
        blockDuration: Math.floor(300 * strictBlockMultiplier),
        execEvenly: true,
      },
      scenario: {
        keyPrefix: 'heartscene:scenario',
        points: Math.floor(40 * strictMultiplier),
        duration: 300,
        blockDuration: Math.floor(300 * strictBlockMultiplier),
        execEvenly: true,
      },
    };
    
    console.log(`🔄 Rebuilding rate limiters - mode: ${this.limiterMode}, Redis: ${this.redisHealthy ? 'healthy' : 'unhealthy'}`);
    
    // Rebuild limiters with adjusted configs
    for (const [service, config] of Object.entries(adjustedConfigs)) {
      try {
        const limiter = this.redisHealthy && this.redis
          ? new RateLimiterRedis({
              storeClient: this.redis,
              keyPrefix: config.keyPrefix,
              points: config.points,
              duration: config.duration,
              blockDuration: config.blockDuration,
              execEvenly: config.execEvenly,
            })
          : new RateLimiterMemory({
              keyPrefix: config.keyPrefix,
              points: config.points,
              duration: config.duration, 
              blockDuration: config.blockDuration,
              execEvenly: config.execEvenly,
            });

        this.rateLimiters.set(service, limiter);
      } catch (error) {
        console.error(`Failed to create rate limiter for ${service}:`, error);
      }
    }
  }

  /**
   * Send Redis health alerts (basic implementation)
   */
  private sendRedisAlert(message: string): void {
    const requestId = nanoid();
    console.warn(`🚨 [${requestId}] REDIS ALERT: ${message} - fail count: ${this.failCount}, ping: ${this.lastPingMs}ms`);
    
    // TODO: Implement webhook/email notifications if ALERT_WEBHOOK_URL is configured
    if (process.env.ALERT_WEBHOOK_URL) {
      // Basic webhook notification (implementation placeholder)
      console.log(`📢 Would send alert to webhook: ${process.env.ALERT_WEBHOOK_URL}`);
    }
  }

  /**
   * Handle Redis status changes
   */
  private handleRedisStatusChange(isHealthy: boolean): void {
    if (this.redisHealthy !== isHealthy) {
      console.log(`Redis status changed: ${this.redisHealthy ? 'healthy' : 'unhealthy'} -> ${isHealthy ? 'healthy' : 'unhealthy'}`);
      this.redisHealthy = isHealthy;
      
      // Rebuild rate limiters with strict mode enforcement
      this.rebuildRateLimitersWithStrictMode();
    }
  }

  /**
   * Get rate limiter with fallback protection
   */
  private getRateLimiter(service: string): RateLimiterRedis | RateLimiterMemory | null {
    const limiter = this.rateLimiters.get(service);
    if (!limiter) {
      console.warn(`Rate limiter for service ${service} not found`);
      return null;
    }
    return limiter;
  }

  /**
   * Get Redis health status for monitoring dashboard
   */
  public getRedisHealthStatus() {
    return {
      redis_status: this.redisStatus,
      last_ping_ms: this.lastPingMs,
      fail_count: this.failCount,
      limiter_mode: this.limiterMode,
      is_healthy: this.redisHealthy,
      connection_configured: this.redis !== null,
      last_check: new Date().toISOString()
    };
  }

  /**
   * Get current usage stats for a user
   */
  async getUserUsageStats(userId: string): Promise<{
    dailyVoiceMinutes: number;
    dailyCostUsd: number;
    tier: string;
    quotas: UsageQuotas;
  }> {
    const config = await storage.getRateLimitingConfig(userId);
    const tier = config?.tier || 'free';
    const quotas = this.quotaConfigs[tier];

    const dailyVoiceMinutes = await storage.getDailyVoiceMinutes(userId, new Date());
    const dailyCostCents = await storage.getUserDailyCosts(userId, new Date());

    return {
      dailyVoiceMinutes,
      dailyCostUsd: dailyCostCents / 100,
      tier,
      quotas,
    };
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}

// Export singleton instance
export const rateLimitingService = new RateLimitingService();

// Export middleware functions
export const sttRateLimit = rateLimitingService.createRateLimitMiddleware('stt');
export const ttsRateLimit = rateLimitingService.createRateLimitMiddleware('tts');
export const llmRateLimit = rateLimitingService.createRateLimitMiddleware('llm');