/**
 * Chaos Testing Fault Injection System
 * Injects 429/500 faults in STT/TTS/LLM services to test resilience
 */

interface FaultConfig {
  enabled: boolean;
  errorRate: number; // 0.0 to 1.0 (percentage of requests to fail)
  errorTypes: Array<{
    type: 'timeout' | 'rate_limit' | 'server_error' | 'network_error';
    weight: number; // Relative weight for error type selection
    statusCode?: number;
    message?: string;
    delayMs?: number;
  }>;
  services: {
    stt: boolean;
    tts: boolean; 
    llm: boolean;
    embedding: boolean;
  };
}

interface ChaosTestConfig {
  globalEnabled: boolean;
  testName?: string;
  duration?: number; // Test duration in milliseconds
  faultConfigs: {
    [serviceName: string]: FaultConfig;
  };
}

export class FaultInjector {
  private static instance: FaultInjector;
  private config: ChaosTestConfig;
  private testStartTime: number = 0;
  private injectedErrors: Map<string, number> = new Map();
  
  private constructor() {
    this.config = this.getDefaultConfig();
    this.loadConfigFromEnv();
  }

  public static getInstance(): FaultInjector {
    if (!FaultInjector.instance) {
      FaultInjector.instance = new FaultInjector();
    }
    return FaultInjector.instance;
  }

  private getDefaultConfig(): ChaosTestConfig {
    return {
      globalEnabled: false,
      faultConfigs: {
        openai_stt: {
          enabled: false,
          errorRate: 0.0,
          services: { stt: true, tts: false, llm: false, embedding: false },
          errorTypes: [
            { type: 'rate_limit', weight: 40, statusCode: 429, message: 'Rate limit exceeded', delayMs: 1000 },
            { type: 'server_error', weight: 30, statusCode: 500, message: 'Internal server error' },
            { type: 'timeout', weight: 20, statusCode: 408, message: 'Request timeout', delayMs: 30000 },
            { type: 'network_error', weight: 10, statusCode: 502, message: 'Bad gateway' }
          ]
        },
        openai_tts: {
          enabled: false,
          errorRate: 0.0,
          services: { stt: false, tts: true, llm: false, embedding: false },
          errorTypes: [
            { type: 'rate_limit', weight: 35, statusCode: 429, message: 'Rate limit exceeded', delayMs: 1000 },
            { type: 'server_error', weight: 35, statusCode: 500, message: 'TTS service unavailable' },
            { type: 'timeout', weight: 20, statusCode: 408, message: 'TTS timeout', delayMs: 15000 },
            { type: 'network_error', weight: 10, statusCode: 503, message: 'Service unavailable' }
          ]
        },
        openai_llm: {
          enabled: false,
          errorRate: 0.0,
          services: { stt: false, tts: false, llm: true, embedding: false },
          errorTypes: [
            { type: 'rate_limit', weight: 25, statusCode: 429, message: 'LLM rate limit exceeded', delayMs: 2000 },
            { type: 'server_error', weight: 40, statusCode: 500, message: 'LLM processing error' },
            { type: 'timeout', weight: 25, statusCode: 408, message: 'LLM timeout', delayMs: 60000 },
            { type: 'network_error', weight: 10, statusCode: 502, message: 'LLM gateway error' }
          ]
        },
        openai_embedding: {
          enabled: false,
          errorRate: 0.0,
          services: { stt: false, tts: false, llm: false, embedding: true },
          errorTypes: [
            { type: 'rate_limit', weight: 30, statusCode: 429, message: 'Embedding rate limit', delayMs: 1000 },
            { type: 'server_error', weight: 50, statusCode: 500, message: 'Embedding service error' },
            { type: 'timeout', weight: 15, statusCode: 408, message: 'Embedding timeout', delayMs: 10000 },
            { type: 'network_error', weight: 5, statusCode: 503, message: 'Embedding unavailable' }
          ]
        }
      }
    };
  }

  private loadConfigFromEnv(): void {
    // Load configuration from environment variables for CI/testing
    if (process.env.CHAOS_TESTING_ENABLED === 'true') {
      this.config.globalEnabled = true;
      this.config.testName = process.env.CHAOS_TEST_NAME || 'default';
      this.config.duration = parseInt(process.env.CHAOS_TEST_DURATION_MS || '300000'); // 5 minutes default
      
      // Load service-specific error rates
      const sttErrorRate = parseFloat(process.env.CHAOS_STT_ERROR_RATE || '0.0');
      const ttsErrorRate = parseFloat(process.env.CHAOS_TTS_ERROR_RATE || '0.0');
      const llmErrorRate = parseFloat(process.env.CHAOS_LLM_ERROR_RATE || '0.0');
      
      if (sttErrorRate > 0) {
        this.config.faultConfigs.openai_stt.enabled = true;
        this.config.faultConfigs.openai_stt.errorRate = sttErrorRate;
      }
      
      if (ttsErrorRate > 0) {
        this.config.faultConfigs.openai_tts.enabled = true;
        this.config.faultConfigs.openai_tts.errorRate = ttsErrorRate;
      }
      
      if (llmErrorRate > 0) {
        this.config.faultConfigs.openai_llm.enabled = true;
        this.config.faultConfigs.openai_llm.errorRate = llmErrorRate;
      }
    }
  }

  /**
   * Start a chaos test with specified configuration
   */
  public startChaosTest(config: Partial<ChaosTestConfig>): void {
    this.config = { ...this.config, ...config };
    this.config.globalEnabled = true;
    this.testStartTime = Date.now();
    this.injectedErrors.clear();
    
    console.log('🔥 CHAOS TEST STARTED:', {
      testName: this.config.testName,
      duration: this.config.duration,
      enabledServices: Object.entries(this.config.faultConfigs)
        .filter(([_, cfg]) => cfg.enabled)
        .map(([name, cfg]) => ({ name, errorRate: cfg.errorRate }))
    });
  }

  /**
   * Stop the chaos test
   */
  public stopChaosTest(): void {
    const testDuration = Date.now() - this.testStartTime;
    const errorSummary = Object.fromEntries(this.injectedErrors);
    
    console.log('🛑 CHAOS TEST STOPPED:', {
      testName: this.config.testName,
      duration: testDuration,
      injectedErrors: errorSummary
    });
    
    this.config.globalEnabled = false;
    this.testStartTime = 0;
    this.injectedErrors.clear();
  }

  /**
   * Check if a fault should be injected for the given service
   */
  public shouldInjectFault(serviceName: string, operation?: string): boolean {
    if (!this.config.globalEnabled) return false;
    
    // Check if test duration has expired
    if (this.config.duration && this.testStartTime > 0) {
      const elapsed = Date.now() - this.testStartTime;
      if (elapsed > this.config.duration) {
        this.stopChaosTest();
        return false;
      }
    }
    
    const faultConfig = this.config.faultConfigs[serviceName];
    if (!faultConfig || !faultConfig.enabled) return false;
    
    // Determine if we should inject a fault based on error rate
    return Math.random() < faultConfig.errorRate;
  }

  /**
   * Generate a fault error based on service configuration
   */
  public generateFault(serviceName: string, operation?: string): Error {
    const faultConfig = this.config.faultConfigs[serviceName];
    if (!faultConfig) {
      throw new Error('No fault configuration found for service: ' + serviceName);
    }

    // Select error type based on weights
    const totalWeight = faultConfig.errorTypes.reduce((sum, et) => sum + et.weight, 0);
    let randomNum = Math.random() * totalWeight;
    
    let selectedError = faultConfig.errorTypes[0];
    for (const errorType of faultConfig.errorTypes) {
      randomNum -= errorType.weight;
      if (randomNum <= 0) {
        selectedError = errorType;
        break;
      }
    }

    // Track injected errors
    const errorKey = `${serviceName}_${selectedError.type}`;
    this.injectedErrors.set(errorKey, (this.injectedErrors.get(errorKey) || 0) + 1);

    // Create error with appropriate properties
    const error = new Error(`CHAOS INJECTION: ${selectedError.message || selectedError.type}`);
    (error as any).statusCode = selectedError.statusCode;
    (error as any).chaosInjected = true;
    (error as any).serviceName = serviceName;
    (error as any).errorType = selectedError.type;
    (error as any).delayMs = selectedError.delayMs;

    return error;
  }

  /**
   * Wrap an async function with fault injection
   */
  public wrapWithFaultInjection<T extends (...args: any[]) => Promise<any>>(
    serviceName: string,
    operation: string,
    originalFunction: T
  ): T {
    return (async (...args: Parameters<T>) => {
      // Check if we should inject a fault
      if (this.shouldInjectFault(serviceName, operation)) {
        const fault = this.generateFault(serviceName, operation);
        
        // If there's a delay, wait before throwing
        if ((fault as any).delayMs) {
          await new Promise(resolve => setTimeout(resolve, (fault as any).delayMs));
        }
        
        throw fault;
      }
      
      // Execute the original function
      return await originalFunction(...args);
    }) as T;
  }

  /**
   * Get current chaos test status
   */
  public getStatus(): {
    enabled: boolean;
    testName?: string;
    elapsed?: number;
    injectedErrors: Record<string, number>;
    activeServices: string[];
  } {
    return {
      enabled: this.config.globalEnabled,
      testName: this.config.testName,
      elapsed: this.testStartTime > 0 ? Date.now() - this.testStartTime : undefined,
      injectedErrors: Object.fromEntries(this.injectedErrors),
      activeServices: Object.entries(this.config.faultConfigs)
        .filter(([_, cfg]) => cfg.enabled)
        .map(([name]) => name)
    };
  }

  /**
   * Update error rate for a specific service during test
   */
  public updateServiceErrorRate(serviceName: string, errorRate: number): void {
    if (this.config.faultConfigs[serviceName]) {
      this.config.faultConfigs[serviceName].errorRate = Math.max(0, Math.min(1, errorRate));
      console.log(`📊 Updated ${serviceName} error rate to ${errorRate * 100}%`);
    }
  }
}

export const faultInjector = FaultInjector.getInstance();