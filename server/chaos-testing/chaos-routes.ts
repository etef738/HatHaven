/**
 * Chaos Testing API Routes
 * Administrative endpoints to control fault injection during testing
 */

import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/trust-safety';
import { faultInjector } from './fault-injector';
import { z } from 'zod';

const router = Router();

// Schema for chaos test configuration
const chaosTestConfigSchema = z.object({
  services: z.object({
    stt: z.boolean().optional().default(false),
    tts: z.boolean().optional().default(false),
    llm: z.boolean().optional().default(false),
    embedding: z.boolean().optional().default(false),
  }),
  errorRate: z.number().min(0).max(1).optional().default(0.1), // 10% default
  duration: z.number().positive().optional().default(300000), // 5 minutes default
  testName: z.string().optional().default('api_chaos_test')
});

const updateErrorRateSchema = z.object({
  serviceName: z.string(),
  errorRate: z.number().min(0).max(1)
});

/**
 * Start chaos testing with specified configuration
 * POST /api/admin/chaos/start
 */
router.post('/start', requireAdmin, async (req: Request, res: Response) => {
  try {
    const config = chaosTestConfigSchema.parse(req.body);
    
    // Build fault injection configuration
    const faultConfigs: any = {};
    
    if (config.services.stt) {
      faultConfigs.openai_stt = {
        enabled: true,
        errorRate: config.errorRate,
        services: { stt: true, tts: false, llm: false, embedding: false },
        errorTypes: [
          { type: 'rate_limit', weight: 40, statusCode: 429, message: 'STT rate limit exceeded', delayMs: 1000 },
          { type: 'server_error', weight: 30, statusCode: 500, message: 'STT service unavailable' },
          { type: 'timeout', weight: 20, statusCode: 408, message: 'STT timeout', delayMs: 30000 },
          { type: 'network_error', weight: 10, statusCode: 502, message: 'STT network error' }
        ]
      };
    }
    
    if (config.services.tts) {
      faultConfigs.openai_tts = {
        enabled: true,
        errorRate: config.errorRate,
        services: { stt: false, tts: true, llm: false, embedding: false },
        errorTypes: [
          { type: 'rate_limit', weight: 35, statusCode: 429, message: 'TTS rate limit exceeded', delayMs: 1000 },
          { type: 'server_error', weight: 35, statusCode: 500, message: 'TTS service unavailable' },
          { type: 'timeout', weight: 20, statusCode: 408, message: 'TTS timeout', delayMs: 15000 },
          { type: 'network_error', weight: 10, statusCode: 503, message: 'TTS service unavailable' }
        ]
      };
    }
    
    if (config.services.llm) {
      faultConfigs.openai_llm = {
        enabled: true,
        errorRate: config.errorRate,
        services: { stt: false, tts: false, llm: true, embedding: false },
        errorTypes: [
          { type: 'rate_limit', weight: 25, statusCode: 429, message: 'LLM rate limit exceeded', delayMs: 2000 },
          { type: 'server_error', weight: 40, statusCode: 500, message: 'LLM processing error' },
          { type: 'timeout', weight: 25, statusCode: 408, message: 'LLM timeout', delayMs: 60000 },
          { type: 'network_error', weight: 10, statusCode: 502, message: 'LLM gateway error' }
        ]
      };
    }
    
    if (config.services.embedding) {
      faultConfigs.openai_embedding = {
        enabled: true,
        errorRate: config.errorRate,
        services: { stt: false, tts: false, llm: false, embedding: true },
        errorTypes: [
          { type: 'rate_limit', weight: 30, statusCode: 429, message: 'Embedding rate limit', delayMs: 1000 },
          { type: 'server_error', weight: 50, statusCode: 500, message: 'Embedding service error' },
          { type: 'timeout', weight: 15, statusCode: 408, message: 'Embedding timeout', delayMs: 10000 },
          { type: 'network_error', weight: 5, statusCode: 503, message: 'Embedding unavailable' }
        ]
      };
    }
    
    // Start chaos testing
    faultInjector.startChaosTest({
      globalEnabled: true,
      testName: config.testName,
      duration: config.duration,
      faultConfigs
    });
    
    const status = faultInjector.getStatus();
    
    res.json({
      message: 'Chaos testing started successfully',
      config: {
        services: config.services,
        errorRate: config.errorRate,
        duration: config.duration,
        testName: config.testName
      },
      status,
      timestamp: new Date().toISOString(),
      adminUser: req.user!.id
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid configuration',
        details: error.errors
      });
    }
    
    console.error('Chaos test start error:', error);
    res.status(500).json({
      error: 'Failed to start chaos testing',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Stop chaos testing
 * POST /api/admin/chaos/stop
 */
router.post('/stop', requireAdmin, async (req: Request, res: Response) => {
  try {
    const statusBefore = faultInjector.getStatus();
    
    if (!statusBefore.enabled) {
      return res.status(400).json({
        error: 'No chaos test is currently running'
      });
    }
    
    faultInjector.stopChaosTest();
    
    res.json({
      message: 'Chaos testing stopped successfully',
      finalStatus: statusBefore,
      timestamp: new Date().toISOString(),
      adminUser: req.user!.id
    });
    
  } catch (error) {
    console.error('Chaos test stop error:', error);
    res.status(500).json({
      error: 'Failed to stop chaos testing',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get chaos testing status
 * GET /api/admin/chaos/status
 */
router.get('/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = faultInjector.getStatus();
    
    res.json({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
    
  } catch (error) {
    console.error('Chaos status error:', error);
    res.status(500).json({
      error: 'Failed to get chaos testing status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update error rate for specific service during test
 * PATCH /api/admin/chaos/error-rate
 */
router.patch('/error-rate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { serviceName, errorRate } = updateErrorRateSchema.parse(req.body);
    
    const status = faultInjector.getStatus();
    if (!status.enabled) {
      return res.status(400).json({
        error: 'No chaos test is currently running'
      });
    }
    
    if (!status.activeServices.includes(serviceName)) {
      return res.status(400).json({
        error: 'Service not active in current test',
        activeServices: status.activeServices
      });
    }
    
    faultInjector.updateServiceErrorRate(serviceName, errorRate);
    
    res.json({
      message: `Updated ${serviceName} error rate to ${errorRate * 100}%`,
      serviceName,
      errorRate,
      status: faultInjector.getStatus(),
      timestamp: new Date().toISOString(),
      adminUser: req.user!.id
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors
      });
    }
    
    console.error('Update error rate error:', error);
    res.status(500).json({
      error: 'Failed to update error rate',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Run predefined chaos scenarios
 * POST /api/admin/chaos/scenario/:scenarioName
 */
router.post('/scenario/:scenarioName', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { scenarioName } = req.params;
    
    const scenarios = {
      // High STT failures
      'stt_overload': {
        services: { stt: true },
        errorRate: 0.7,
        duration: 60000, // 1 minute
        testName: 'STT Overload Scenario'
      },
      
      // Cascading failures
      'cascading_failure': {
        services: { stt: true, tts: true, llm: true },
        errorRate: 0.3,
        duration: 120000, // 2 minutes
        testName: 'Cascading Failure Scenario'
      },
      
      // Rate limiting storm
      'rate_limit_storm': {
        services: { stt: true, tts: true, llm: true },
        errorRate: 0.5,
        duration: 180000, // 3 minutes
        testName: 'Rate Limit Storm'
      },
      
      // Intermittent failures
      'intermittent_failure': {
        services: { llm: true },
        errorRate: 0.2,
        duration: 300000, // 5 minutes
        testName: 'Intermittent LLM Failures'
      }
    };
    
    const scenario = scenarios[scenarioName as keyof typeof scenarios];
    if (!scenario) {
      return res.status(404).json({
        error: 'Scenario not found',
        availableScenarios: Object.keys(scenarios)
      });
    }
    
    // Use the start chaos test logic
    req.body = scenario;
    return router.stack.find(layer => layer.route?.path === '/start' && layer.route.methods.post)
      ?.handle(req, res);
      
  } catch (error) {
    console.error('Scenario execution error:', error);
    res.status(500).json({
      error: 'Failed to execute scenario',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;