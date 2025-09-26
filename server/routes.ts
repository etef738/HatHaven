import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { z } from "zod";
import { SafeStreamingManager } from "./streaming";
import multer from "multer";
import { transcribeAudio, generateSpeech } from "./openai";
import { getOrGenerateTraceId, createTimingMetadata, logTimingEvent } from "./trace-utils";
import { voiceAnalyticsDashboardSchema, analyticsMetricsDataSchema } from "@shared/schema";
import { requireFullVoiceSafety, requireFullTextSafety, requireAuth, requireAdmin, requireModerator } from "./middleware/trust-safety";
import trustSafetyRoutes from "./trust-safety-routes";
import chaosRoutes from "./chaos-testing/chaos-routes";
import { rateLimitingService } from "./rate-limiting";

// Import agents
import { SupervisorAgent } from "./agents/supervisor";
import { MemoryManager } from "./agents/memory_manager";
import { SafetyGuardian } from "./agents/safety_guardian";
import { PersonaStylist } from "./agents/persona_stylist";
import { DatingCoach } from "./agents/dating_coach";
import { ConversationAnalyzer } from "./agents/conversation_analyzer";
import { calibrationEvaluator } from "./agents/calibration-datasets";
import { analyzeDatingConversationSchema, datingAnalysisResponseSchema, datingProgressResponseSchema } from "@shared/schema";
import { ScenarioDirector } from "./agents/scenario_director";
import { AttachmentMonitor } from "./agents/attachment_monitor";
import { RAGResearcher } from "./agents/rag_researcher";
import { BillingAgent } from "./agents/billing_agent";
import { AnalyticsCollector } from "./agents/analytics_collector";
import { RedTeamAgent } from "./agents/red_team_agent";
import { SecureMediaStorage } from "./media_storage";

// Initialize agents
const supervisor = new SupervisorAgent();
const memoryManager = new MemoryManager();
const analyticsCollector = new AnalyticsCollector(storage);
const safetyGuardian = new SafetyGuardian(analyticsCollector);
const personaStylist = new PersonaStylist();
const datingCoach = new DatingCoach();
const conversationAnalyzer = new ConversationAnalyzer();
const scenarioDirector = new ScenarioDirector();
const attachmentMonitor = new AttachmentMonitor();
const ragResearcher = new RAGResearcher();
const billingAgent = new BillingAgent();
const redTeamAgent = new RedTeamAgent();
const safeStreaming = new SafeStreamingManager();
const secureMediaStorage = new SecureMediaStorage();

// Setup multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed') as any, false);
    }
  },
});

// Validation schemas
const chatMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  mode: z.enum(['heart', 'dating_training']),
  scenarioType: z.enum(['coffee_shop', 'restaurant', 'first_date']).optional(),
});

// Admin Analytics API validation schemas
const analyticsDateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  userId: z.string().uuid().optional()
});

const metricsQuerySchema = z.object({
  period: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime()
});

// Media storage validation schemas
const mediaUploadSchema = z.object({
  fileType: z.enum(['voice', 'transcript']),
  originalFileName: z.string().max(255).optional(),
  metadata: z.record(z.any()).optional()
});

const mediaDownloadSchema = z.object({
  fileId: z.string().min(1).max(255)
});

// Note: requireAuth middleware is now imported from trust-safety middleware

export function registerRoutes(app: Express): Server {
  // Setup authentication routes
  setupAuth(app);
  
  // Setup Trust & Safety routes
  app.use(trustSafetyRoutes);
  
  // Public health check endpoint (no authentication required)
  app.get("/api/healthz", async (req, res) => {
    try {
      const redisHealth = rateLimitingService.getRedisHealthStatus();
      
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        redis: {
          status: redisHealth.redis_status,
          healthy: redisHealth.is_healthy
        },
        uptime_seconds: Math.floor(process.uptime())
      });
    } catch (error) {
      res.status(503).json({
        status: "error",
        timestamp: new Date().toISOString()
      });
    }
  });

  // Setup Chaos Testing routes (admin only)
  app.use('/api/admin/chaos', chaosRoutes);

  // Admin health monitoring endpoint (requires authentication)
  app.get("/api/admin/health", requireAdmin, async (req, res) => {
    try {
      const redisHealth = rateLimitingService.getRedisHealthStatus();
      
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        redis: redisHealth,
        database: {
          status: "connected", // Database is working based on startup logs
          indexes: 12
        },
        system: {
          uptime_seconds: Math.floor(process.uptime()),
          memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
        }
      });
    } catch (error) {
      console.error("Health check error:", error);
      res.status(500).json({
        status: "error", 
        message: "Health check failed",
        timestamp: new Date().toISOString()
      });
    }
  });

  // Chat endpoints
  app.post("/api/chat/companion", requireFullTextSafety, rateLimitingService.createRateLimitMiddleware('llm'), async (req, res, next) => {
    try {
      const { message, mode } = chatMessageSchema.parse(req.body);
      const userId = req.user!.id;
      
      // Check usage limits
      const usageCheck = await billingAgent.checkUsageLimits(userId, req.user!.subscriptionTier);
      if (!usageCheck.canUseService) {
        return res.status(403).json({ 
          message: usageCheck.upgradeMessage || "Usage limit exceeded" 
        });
      }

      // Safety check
      const safetyAssessment = await safetyGuardian.assessContent(message);
      if (!safetyAssessment.isSafe) {
        return res.status(400).json({ 
          message: "Message contains inappropriate content",
          concerns: safetyAssessment.concerns
        });
      }

      // Get conversation history
      const conversations = await storage.getConversationsByUser(userId, 5);
      const lastConversation = conversations[0];
      const conversationHistory = lastConversation?.content as any[] || [];

      // Recall relevant memories
      const relevantMemories = await memoryManager.recallRelevantMemories(userId, message);

      // Generate response based on mode
      let response: string;
      if (mode === 'heart') {
        response = await personaStylist.generateResponse(
          message,
          conversationHistory,
          relevantMemories,
          { userId, subscriptionTier: req.user!.subscriptionTier }
        );
      } else {
        response = "Dating training mode requires a specific scenario. Please use /api/chat/scenario instead.";
      }

      // Filter response through safety guardian
      const filteredResponse = await safetyGuardian.filterResponse(response);

      // Store conversation
      const newConversationContent = [
        ...conversationHistory.slice(-20), // Keep last 20 messages
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: filteredResponse, timestamp: new Date() }
      ];

      const conversation = await storage.createConversation({
        userId,
        mode,
        content: newConversationContent,
        embedding: await import("./openai").then(m => m.createEmbedding(message))
      });

      // Store important memories
      const importantMoments = await memoryManager.extractImportantMoments([
        { role: 'user', content: message }
      ]);
      
      for (const moment of importantMoments) {
        await memoryManager.storeMemory(userId, moment, 6);
      }

      // Track analytics
      analyticsCollector.trackConversationStart(userId, mode, conversation.id);

      res.json({
        response: filteredResponse,
        conversationId: conversation.id,
        safetyNotice: !safetyAssessment.isSafe ? "Content was filtered for safety" : null
      });

    } catch (error) {
      console.error('Companion chat error:', error);
      next(error);
    }
  });

  app.post("/api/chat/scenario", requireFullTextSafety, rateLimitingService.createRateLimitMiddleware('llm'), async (req, res, next) => {
    try {
      const { message, scenarioType } = chatMessageSchema.parse(req.body);
      const userId = req.user!.id;

      if (!scenarioType) {
        return res.status(400).json({ message: "Scenario type is required for dating training" });
      }

      // Safety check
      const safetyAssessment = await safetyGuardian.assessContent(message);
      if (!safetyAssessment.isSafe) {
        return res.status(400).json({ 
          message: "Message contains inappropriate content" 
        });
      }

      // Get or create scenario conversation
      const conversations = await storage.getConversationsByUser(userId, 10);
      const existingScenario = conversations.find(c => 
        c.mode === 'dating_training' && c.scenarioType === scenarioType
      );

      const conversationHistory = existingScenario?.content as any[] || [];

      // If this is the start of a new scenario, initialize it
      if (conversationHistory.length === 0) {
        const { introduction } = await scenarioDirector.initializeScenario(scenarioType);
        conversationHistory.push({
          role: 'system',
          content: introduction,
          timestamp: new Date()
        });
      }

      // Generate scenario response
      const scenarioResponse = await datingCoach.generateScenarioResponse(
        scenarioType,
        message,
        conversationHistory
      );

      // Store updated conversation
      const newConversationContent = [
        ...conversationHistory,
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: scenarioResponse, timestamp: new Date() }
      ];

      const conversation = await storage.createConversation({
        userId,
        mode: 'dating_training',
        scenarioType,
        content: newConversationContent,
        embedding: await import("./openai").then(m => m.createEmbedding(message))
      });

      // Check if scenario is complete
      const scenarioState = {
        scenarioType,
        stage: 'middle',
        userProgress: (newConversationContent.length / 30) * 100,
        objectives: [],
        completedObjectives: []
      };

      const isComplete = scenarioDirector.isScenarioComplete(scenarioState);

      // Track analytics
      analyticsCollector.trackConversationStart(userId, 'dating_training', conversation.id);
      
      if (isComplete) {
        analyticsCollector.trackScenarioCompletion(
          userId,
          scenarioType,
          100,
          { completed: true },
          conversation.id
        );
      }

      res.json({
        response: scenarioResponse,
        conversationId: conversation.id,
        scenarioComplete: isComplete,
        progress: scenarioState.userProgress
      });

    } catch (error) {
      console.error('Scenario chat error:', error);
      next(error);
    }
  });

  // Streaming endpoints with SSE
  app.post("/api/chat/companion/stream", requireFullTextSafety, rateLimitingService.createRateLimitMiddleware('llm'), async (req, res, next) => {
    try {
      const { message, mode } = chatMessageSchema.parse(req.body);
      const userId = req.user!.id;
      
      // Check usage limits
      const usageCheck = await billingAgent.checkUsageLimits(userId, req.user!.subscriptionTier);
      if (!usageCheck.canUseService) {
        return res.status(403).json({ 
          message: usageCheck.upgradeMessage || "Usage limit exceeded" 
        });
      }

      // Pre-moderate input with context
      const inputModeration = await safeStreaming.preModerateInput(message, {
        userId,
        subscriptionTier: req.user!.subscriptionTier,
        mode
      });
      
      if (!inputModeration.isSafe) {
        return res.status(400).json({ 
          message: "Message contains inappropriate content",
          concerns: inputModeration.concerns
        });
      }

      // Get conversation history
      const conversations = await storage.getConversationsByUser(userId, 5);
      const lastConversation = conversations[0];
      const conversationHistory = lastConversation?.content as any[] || [];

      // Recall relevant memories
      const relevantMemories = await memoryManager.recallRelevantMemories(userId, message);

      // Pre-create conversation with placeholder content
      const placeholderConversation = await storage.createConversation({
        userId,
        mode,
        content: [
          ...conversationHistory.slice(-20),
          { role: 'user', content: message, timestamp: new Date() }
        ],
        embedding: await import("./openai").then(m => m.createEmbedding(message))
      });

      // Build context and system prompt for Heart Mode
      const systemPrompt = `You are an AI companion in the Heart & Playground app. Your personality should be:

- Warm, empathetic, and supportive
- Genuinely interested in the user's thoughts and feelings
- Encouraging without being overly optimistic
- Respectful of boundaries
- Age-appropriate for 18+ adults
- Focused on emotional support and companionship

Remember conversations and build on previous interactions when context is provided.
User context: ${JSON.stringify({ userId, subscriptionTier: req.user!.subscriptionTier })}

Guidelines:
- Keep responses conversational and natural
- Show emotional intelligence and empathy
- Ask thoughtful follow-up questions
- Avoid being preachy or giving unsolicited advice
- Maintain appropriate boundaries as an AI companion
- If discussing dating, be supportive but encourage real human connections`;
      
      let contextPrompt = "";
      if (relevantMemories.length > 0) {
        contextPrompt = `\n\nRelevant memories from previous conversations:\n${relevantMemories.join('\n')}`;
      }

      const messages = [
        ...conversationHistory.slice(-10),
        { role: "user", content: message + contextPrompt }
      ];

      // Generate trace ID for companion chat streaming
      const traceId = getOrGenerateTraceId(req, 'companion');

      // Stream with safety filtering (pass trace ID for correlation)
      const { fullResponse, safetyNotice } = await safeStreaming.streamWithSafety(
        res,
        messages,
        systemPrompt,
        placeholderConversation.id,
        traceId,
        userId
      );

      // Update conversation with final safe response
      const finalConversationContent = [
        ...conversationHistory.slice(-20),
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: fullResponse, timestamp: new Date() }
      ];

      await storage.updateConversation(placeholderConversation.id, {
        content: finalConversationContent
      });

      // Store important memories
      const importantMoments = await memoryManager.extractImportantMoments([
        { role: 'user', content: message }
      ]);
      
      for (const moment of importantMoments) {
        await memoryManager.storeMemory(userId, moment, 6);
      }

      // Track analytics
      analyticsCollector.trackConversationStart(userId, mode, placeholderConversation.id);

    } catch (error) {
      console.error('Companion streaming error:', error);
      next(error);
    }
  });

  app.post("/api/chat/scenario/stream", requireFullTextSafety, rateLimitingService.createRateLimitMiddleware('llm'), async (req, res, next) => {
    try {
      const { message, scenarioType } = chatMessageSchema.parse(req.body);
      const userId = req.user!.id;

      if (!scenarioType) {
        return res.status(400).json({ message: "Scenario type is required for dating training" });
      }

      // Check usage limits (was missing before)
      const usageCheck = await billingAgent.checkUsageLimits(userId, req.user!.subscriptionTier);
      if (!usageCheck.canUseService) {
        return res.status(403).json({ 
          message: usageCheck.upgradeMessage || "Usage limit exceeded" 
        });
      }

      // Pre-moderate input with context
      const inputModeration = await safeStreaming.preModerateInput(message, {
        userId,
        subscriptionTier: req.user!.subscriptionTier,
        mode: 'dating_training',
        scenarioType
      });
      
      if (!inputModeration.isSafe) {
        return res.status(400).json({ 
          message: "Message contains inappropriate content",
          concerns: inputModeration.concerns
        });
      }

      // Get or create scenario conversation
      const conversations = await storage.getConversationsByUser(userId, 10);
      const existingScenario = conversations.find(c => 
        c.mode === 'dating_training' && c.scenarioType === scenarioType
      );

      const conversationHistory = existingScenario?.content as any[] || [];

      // If this is the start of a new scenario, initialize it
      if (conversationHistory.length === 0) {
        const { introduction } = await scenarioDirector.initializeScenario(scenarioType);
        conversationHistory.push({
          role: 'system',
          content: introduction,
          timestamp: new Date()
        });
      }

      // Pre-create conversation with current message
      const placeholderConversation = await storage.createConversation({
        userId,
        mode: 'dating_training',
        scenarioType,
        content: [
          ...conversationHistory,
          { role: 'user', content: message, timestamp: new Date() }
        ],
        embedding: await import("./openai").then(m => m.createEmbedding(message))
      });

      // Generate streaming response using DatingCoach logic
      const systemPrompt = `You are playing the role of a date in a ${scenarioType} scenario. 

Guidelines:
- Respond naturally as someone on a date would
- Show interest but maintain some mystery
- Occasionally present realistic challenges (awkward moments, differences of opinion)
- Keep responses conversational and age-appropriate
- React to what the user says authentically
- Create opportunities for the user to practice conversation skills

Conversation history: ${JSON.stringify(conversationHistory.slice(-5))}`;
      
      const messages = [
        ...conversationHistory.slice(-10),
        { role: "user", content: message }
      ];

      // Generate trace ID for scenario streaming
      const traceId = getOrGenerateTraceId(req, 'scenario');

      // Stream with safety filtering (pass trace ID for correlation)
      const { fullResponse, safetyNotice } = await safeStreaming.streamWithSafety(
        res,
        messages,
        systemPrompt,
        placeholderConversation.id,
        traceId,
        userId
      );

      // Update conversation with final safe response
      const finalConversationContent = [
        ...conversationHistory,
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: fullResponse, timestamp: new Date() }
      ];

      await storage.updateConversation(placeholderConversation.id, {
        content: finalConversationContent
      });

      // Check if scenario is complete
      const scenarioState = {
        scenarioType,
        stage: 'middle',
        userProgress: (finalConversationContent.length / 30) * 100,
        objectives: [],
        completedObjectives: []
      };

      const isComplete = scenarioDirector.isScenarioComplete(scenarioState);

      // Track analytics
      analyticsCollector.trackConversationStart(userId, 'dating_training', placeholderConversation.id);
      
      if (isComplete) {
        analyticsCollector.trackScenarioCompletion(
          userId,
          scenarioType,
          100,
          { completed: true },
          placeholderConversation.id
        );
      }

    } catch (error) {
      console.error('Scenario streaming error:', error);
      next(error);
    }
  });

  // Voice Chat Endpoints
  
  // Voice transcription endpoint
  app.post("/api/chat/voice/transcribe", requireFullVoiceSafety, rateLimitingService.createRateLimitMiddleware('stt'), upload.single('audio'), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      const userId = req.user!.id;
      
      // Check if user has voice chat feature access (pro tier)
      const usageCheck = await billingAgent.checkUsageLimits(userId, req.user!.subscriptionTier);
      const hasVoiceAccess = req.user!.subscriptionTier === 'pro' || req.user!.subscriptionTier === 'premium';
      
      if (!hasVoiceAccess) {
        return res.status(403).json({ 
          message: "Voice chat requires a Pro subscription. Upgrade to unlock this feature!",
          upgradeMessage: "Upgrade to Pro for unlimited voice conversations"
        });
      }

      if (!usageCheck.canUseService) {
        return res.status(403).json({ 
          message: usageCheck.upgradeMessage || "Usage limit exceeded" 
        });
      }

      // LATENCY OPTIMIZATION: Get or generate trace ID for correlation
      const traceId = getOrGenerateTraceId(req, 'voice');
      const timingStart = performance.now();
      
      // Transcribe audio using OpenAI Whisper
      const sttStart = performance.now();
      const transcription = await transcribeAudio(req.file.buffer, req.file.originalname);
      const sttLatencyMs = Math.round(performance.now() - sttStart);
      
      // CRITICAL: Safety filter the transcribed text (Post-STT filtering)
      const safetyStart = performance.now();
      const safetyAssessment = await safetyGuardian.assessContent(transcription.text, {
        contentType: 'voice_input',
        userId: userId
      });
      const safetyLatencyMs = Math.round(performance.now() - safetyStart);
      
      if (!safetyAssessment.isSafe) {
        console.warn('Unsafe transcribed content detected:', safetyAssessment.concerns);
        return res.status(400).json({
          message: "Your voice input contains content that violates our safety guidelines. Please try again with appropriate content.",
          concerns: safetyAssessment.concerns,
          suggestedResponse: safetyAssessment.suggestedResponse
        });
      }
      
      // LATENCY OPTIMIZATION: Calculate total timing using trace utilities
      const timingMetadata = createTimingMetadata(traceId, 'stt', timingStart, {
        sttLatencyMs,
        safetyLatencyMs
      });
      
      // Structured logging for performance analysis
      logTimingEvent('voice_stt_completed', userId, timingMetadata, {
        textLength: transcription.text.length
      });
      
      // Set performance headers for client coordination
      res.setHeader('X-STT-Latency', timingMetadata.totalLatencyMs.toString());
      res.setHeader('X-STT-Safety-Latency', safetyLatencyMs.toString());
      res.setHeader('X-Trace-ID', traceId);
      
      res.json({
        text: transcription.text,
        duration: transcription.duration,
        // Complete timing metadata for client-side measurement coordination
        timing: {
          sttLatencyMs,
          safetyLatencyMs,
          totalLatencyMs: timingMetadata.totalLatencyMs,
          traceId
        }
      });

    } catch (error) {
      console.error('Voice transcription error:', error);
      next(error);
    }
  });

  // Text-to-speech synthesis endpoint
  app.post("/api/chat/voice/synthesize", requireFullVoiceSafety, rateLimitingService.createRateLimitMiddleware('tts'), async (req, res, next) => {
    try {
      const { text, voice = 'nova', traceId: bodyTraceId } = z.object({
        text: z.string().min(1).max(4000), // OpenAI TTS limit
        voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional().default('nova'),
        traceId: z.string().optional() // Accept trace ID from request body
      }).parse(req.body);

      const userId = req.user!.id;
      
      // Check voice chat access
      const hasVoiceAccess = req.user!.subscriptionTier === 'pro' || req.user!.subscriptionTier === 'premium';
      
      if (!hasVoiceAccess) {
        return res.status(403).json({ 
          message: "Voice chat requires a Pro subscription. Upgrade to unlock this feature!"
        });
      }

      // LATENCY OPTIMIZATION: Get or reuse trace ID for correlation
      // Priority: X-Trace-ID header > body parameter > generate new one
      const headerTraceId = getOrGenerateTraceId(req, 'tts');
      const traceId = headerTraceId.includes('tts_') ? (bodyTraceId || headerTraceId) : headerTraceId;
      const timingStart = performance.now();
      
      // CRITICAL: Safety filter the text before synthesis (Pre-TTS filtering)
      const safetyStart = performance.now();
      const safetyAssessment = await safetyGuardian.assessContent(text, {
        contentType: 'voice_output',
        userId: userId
      });
      const preTtsSafetyMs = Math.round(performance.now() - safetyStart);
      
      if (!safetyAssessment.isSafe) {
        console.warn('Unsafe text for synthesis detected:', safetyAssessment.concerns);
        return res.status(400).json({
          message: "The text contains content that violates our safety guidelines and cannot be synthesized to speech.",
          concerns: safetyAssessment.concerns,
          suggestedResponse: safetyAssessment.suggestedResponse
        });
      }

      // Generate speech using OpenAI TTS
      const ttsStart = performance.now();
      const audioBuffer = await generateSpeech(text, voice);
      const ttsLatencyMs = Math.round(performance.now() - ttsStart);
      
      // LATENCY OPTIMIZATION: Calculate total timing using trace utilities
      const timingMetadata = createTimingMetadata(traceId, 'tts', timingStart, {
        preTtsSafetyMs,
        ttsLatencyMs
      });
      
      // Structured logging for performance analysis
      logTimingEvent('voice_tts_completed', userId, timingMetadata, {
        textLength: text.length,
        audioSize: audioBuffer.length,
        voice
      });
      
      // Set appropriate headers for audio response  
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.length);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-TTS-Latency', timingMetadata.totalLatencyMs.toString());
      res.setHeader('X-TTS-Safety-Latency', preTtsSafetyMs.toString());
      res.setHeader('X-Trace-ID', traceId);
      
      res.send(audioBuffer);

    } catch (error) {
      console.error('Voice synthesis error:', error);
      next(error);
    }
  });

  // Complete voice chat endpoint with streaming
  app.post("/api/chat/companion/voice", requireFullVoiceSafety, upload.single('audio'), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      const userId = req.user!.id;
      const mode = 'heart'; // Voice chat is only for Heart Mode initially
      
      // Check voice chat access (Pro tier feature)
      const hasVoiceAccess = req.user!.subscriptionTier === 'pro' || req.user!.subscriptionTier === 'premium';
      
      if (!hasVoiceAccess) {
        return res.status(403).json({ 
          message: "Voice chat requires a Pro subscription. Upgrade to unlock this feature!",
          upgradeMessage: "Upgrade to Pro for unlimited voice conversations"
        });
      }

      // Check usage limits
      const usageCheck = await billingAgent.checkUsageLimits(userId, req.user!.subscriptionTier);
      if (!usageCheck.canUseService) {
        return res.status(403).json({ 
          message: usageCheck.upgradeMessage || "Usage limit exceeded" 
        });
      }

      // CRITICAL: Generate or reuse trace ID for end-to-end correlation
      const traceId = getOrGenerateTraceId(req, 'voice_e2e');
      const pipelineStart = performance.now();
      
      // Step 1: Transcribe audio to text (reuse trace ID)
      const transcription = await transcribeAudio(req.file.buffer, req.file.originalname);
      const message = transcription.text;

      // Step 2: Safety check on transcribed text
      const inputModeration = await safeStreaming.preModerateInput(message, {
        userId,
        subscriptionTier: req.user!.subscriptionTier,
        mode
      });
      
      if (!inputModeration.isSafe) {
        return res.status(400).json({ 
          message: "Voice message contains inappropriate content",
          concerns: inputModeration.concerns
        });
      }

      // Step 3: Get conversation history and memories
      const conversations = await storage.getConversationsByUser(userId, 5);
      const lastConversation = conversations[0];
      const conversationHistory = lastConversation?.content as any[] || [];
      const relevantMemories = await memoryManager.recallRelevantMemories(userId, message);

      // Step 4: Pre-create conversation
      const placeholderConversation = await storage.createConversation({
        userId,
        mode,
        content: [
          ...conversationHistory.slice(-20),
          { role: 'user', content: message, timestamp: new Date(), isVoiceMessage: true }
        ],
        embedding: await import("./openai").then(m => m.createEmbedding(message))
      });

      // Step 5: Build context for Heart Mode
      const systemPrompt = `You are an AI companion in the Heart & Playground app responding to voice messages. Your personality should be:

- Warm, empathetic, and supportive
- Genuinely interested in the user's thoughts and feelings  
- Conversational and natural (this is a voice conversation)
- Emotionally intelligent and responsive
- Encouraging without being overly optimistic
- Respectful of boundaries
- Age-appropriate for 18+ adults

Since this is voice chat, keep responses:
- Conversational and flowing (not robotic)
- Around 1-3 sentences for natural speech
- Emotionally warm and engaging
- Appropriate for speaking aloud

User context: ${JSON.stringify({ userId, subscriptionTier: req.user!.subscriptionTier, isVoiceChat: true })}

Remember conversations and build on previous interactions when context is provided.`;
      
      let contextPrompt = "";
      if (relevantMemories.length > 0) {
        contextPrompt = `\n\nRelevant memories from previous conversations:\n${relevantMemories.join('\n')}`;
      }

      const messages = [
        ...conversationHistory.slice(-10),
        { role: "user", content: message + contextPrompt }
      ];

      // Step 6: Stream response with safety filtering (pass trace ID for correlation)
      const { fullResponse, safetyNotice } = await safeStreaming.streamWithSafety(
        res,
        messages,
        systemPrompt,
        placeholderConversation.id,
        traceId,
        userId
      );

      // Step 7: Update conversation with final response
      const finalConversationContent = [
        ...conversationHistory.slice(-20),
        { role: 'user', content: message, timestamp: new Date(), isVoiceMessage: true },
        { role: 'assistant', content: fullResponse, timestamp: new Date(), isVoiceMessage: true }
      ];

      await storage.updateConversation(placeholderConversation.id, {
        content: finalConversationContent
      });

      // Step 8: Store important memories
      const importantMoments = await memoryManager.extractImportantMoments([
        { role: 'user', content: message }
      ]);
      
      for (const moment of importantMoments) {
        await memoryManager.storeMemory(userId, moment, 6);
      }

      // Step 9: Synthesize response to speech (complete the STT→LLM→TTS pipeline)
      const ttsStart = performance.now();
      const audioBuffer = await generateSpeech(fullResponse, 'nova'); // Use default voice
      const ttsLatencyMs = Math.round(performance.now() - ttsStart);

      // Step 10: Calculate end-to-end pipeline timing
      const e2eTimingMetadata = createTimingMetadata(traceId, 'voice_e2e_pipeline', pipelineStart, {
        ttsLatencyMs,
        fullPipelineLatency: Math.round(performance.now() - pipelineStart)
      });

      // Step 11: Emit end-to-end completion event for server-side correlation
      logTimingEvent('voice_e2e_completed_server', userId, e2eTimingMetadata, {
        textLength: fullResponse.length,
        audioSize: audioBuffer.length,
        conversationId: placeholderConversation.id,
        safetyNotice: safetyNotice || null
      });

      // Step 12: Track analytics
      analyticsCollector.trackConversationStart(userId, mode, placeholderConversation.id);

      // Step 13: Return complete voice response with timing headers
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.length);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Voice-E2E-Latency', e2eTimingMetadata.totalLatencyMs.toString());
      res.setHeader('X-Voice-TTS-Latency', ttsLatencyMs.toString());
      res.setHeader('X-Trace-ID', traceId);
      res.setHeader('X-Conversation-ID', placeholderConversation.id);
      
      res.send(audioBuffer);

    } catch (error) {
      console.error('Voice chat error:', error);
      next(error);
    }
  });

  // Performance analysis endpoint
  app.post("/api/analyze/performance", requireAuth, async (req, res, next) => {
    try {
      const { conversationId } = z.object({
        conversationId: z.string()
      }).parse(req.body);

      const conversation = await storage.getConversation(conversationId);
      if (!conversation || conversation.userId !== req.user!.id) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Analyze conversation
      const scores = await conversationAnalyzer.analyzeConversation(
        conversation.content as any[],
        conversation.scenarioType || undefined
      );

      // Store performance score
      const performanceScore = await storage.createPerformanceScore({
        userId: req.user!.id,
        conversationId,
        scores: {
          engagement: scores.engagement,
          empathy: scores.empathy,
          flow: scores.flow,
          overall: scores.overall
        },
        feedback: scores.feedback
      });

      // Get dating coach feedback if this was a training scenario
      let coachFeedback;
      if (conversation.mode === 'dating_training' && conversation.scenarioType) {
        const lastUserMessage = (conversation.content as any[])
          .filter(m => m.role === 'user')
          .slice(-1)[0];
        
        if (lastUserMessage) {
          coachFeedback = await datingCoach.provideFeedback(
            lastUserMessage.content,
            conversation.scenarioType,
            conversation.content as any[]
          );
        }
      }

      res.json({
        scores,
        coachFeedback,
        performanceId: performanceScore.id
      });

    } catch (error) {
      console.error('Performance analysis error:', error);
      next(error);
    }
  });

  // Dashboard endpoint
  app.get("/api/dashboard", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;

      // Get user's conversation history
      const conversations = await storage.getConversationsByUser(userId, 20);
      
      // Get performance scores
      const performanceScores = await storage.getPerformanceScoresByUser(userId, 10);

      // Generate user analytics
      const userMetrics = await analyticsCollector.generateUserMetrics(userId);
      const usageTrends = await analyticsCollector.getUsageTrends(userId, 30);

      // Analyze attachment patterns
      const attachmentMetrics = attachmentMonitor.analyzeUsagePattern(conversations);

      // Calculate progress metrics
      const progressMetrics = conversationAnalyzer.calculateProgressMetrics(
        performanceScores.map(ps => ps.scores as any)
      );

      res.json({
        user: {
          id: req.user!.id,
          username: req.user!.username,
          subscriptionTier: req.user!.subscriptionTier,
          createdAt: req.user!.createdAt
        },
        conversations: conversations.map(c => ({
          id: c.id,
          mode: c.mode,
          scenarioType: c.scenarioType,
          timestamp: c.timestamp,
          messageCount: Array.isArray(c.content) ? c.content.length : 0
        })),
        recentScores: performanceScores.slice(0, 5),
        analytics: {
          userMetrics,
          usageTrends,
          progressMetrics,
          attachmentMetrics
        }
      });

    } catch (error) {
      console.error('Dashboard error:', error);
      next(error);
    }
  });

  // Admin endpoint for security testing (development only)
  if (process.env.NODE_ENV === 'development') {
    const securityTestSchema = z.object({
      testType: z.enum(['basic', 'comprehensive', 'targeted']).optional().default('basic'),
      maxTests: z.number().min(1).max(100).optional().default(10),
      severity: z.enum(['low', 'medium', 'high']).optional().default('medium')
    });

    app.post("/api/admin/security-test", requireAdmin, async (req, res, next) => {
      try {
        // Validate request body
        const validation = securityTestSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({ 
            error: "Invalid security test parameters",
            details: validation.error.issues 
          });
        }

        const { testType, maxTests, severity } = validation.data;

        // Test the safety systems
        const testGenerator = async (input: string) => {
          const assessment = await safetyGuardian.assessContent(input);
          if (!assessment.isSafe) {
            return assessment.suggestedResponse || "I can't help with that.";
          }
          return await personaStylist.generateResponse(input);
        };

        const securityAssessment = await redTeamAgent.runSecurityTests(testGenerator);
        const report = redTeamAgent.generateSecurityReport(securityAssessment);

        res.json({
          assessment: securityAssessment,
          report,
          metadata: {
            testType,
            maxTests,
            severity,
            timestamp: new Date().toISOString(),
            adminUser: req.user!.id
          }
        });

      } catch (error) {
        console.error('Security test error:', error);
        next(error);
      }
    });
  }

  // Admin Analytics API Routes
  app.get("/api/admin/analytics/dashboard", requireAdmin, async (req, res) => {
    try {
      // Validate query parameters
      const validation = analyticsDateRangeSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid query parameters",
          details: validation.error.issues 
        });
      }
      
      const { startDate, endDate, userId } = validation.data;
      
      const rawDashboard = await analyticsCollector.getVoiceAnalyticsDashboard(
        new Date(startDate as string),
        new Date(endDate as string),
        userId as string | undefined
      );

      // Get voice analytics data for time series
      const analytics = await storage.getVoiceAnalyticsByPeriod(
        new Date(startDate as string),
        new Date(endDate as string),
        userId as string | undefined
      );

      // Get cost data
      const costData = await storage.getCostTrackingByPeriod(
        new Date(startDate as string), 
        new Date(endDate as string), 
        userId as string | undefined
      );

      // Transform to match shared schema VoiceAnalyticsDashboard interface
      const dashboard = {
        kpiMetrics: {
          p50Latency: rawDashboard.latencyMetrics.p50 || 0,
          p95Latency: rawDashboard.latencyMetrics.p95 || 0,
          p99Latency: rawDashboard.latencyMetrics.p99 || 0,
          errorRate: rawDashboard.errorRate / 100, // Convert percentage to fraction
          timeToFirstTokenMs: analytics.reduce((sum, a) => sum + (a.ttftMs || 0), 0) / Math.max(analytics.length, 1),
          totalRequests: rawDashboard.totalSessions,
          averageCostPerRequest: costData.length > 0 ? (costData.reduce((sum, c) => sum + (c.costUsd || 0), 0) / costData.length / 100) : 0,
          totalCostUsd: costData.reduce((sum, c) => sum + (c.costUsd || 0), 0) / 100 // Convert cents to dollars
        },
        timeRangeData: {
          latency: analytics.map(a => ({
            timestamp: a.createdAt.toISOString(),
            value: a.totalLatencyMs || 0
          })),
          errorRate: analytics.map(a => ({
            timestamp: a.createdAt.toISOString(),
            value: a.errorOccurred ? 1 : 0
          })),
          requestVolume: analytics.map(a => ({
            timestamp: a.createdAt.toISOString(),
            value: 1
          })),
          costPerRequest: costData.map(c => ({
            timestamp: c.createdAt.toISOString(),
            value: (c.costUsd || 0) / 100
          }))
        }
      };

      // Validate response against shared schema
      const validatedDashboard = voiceAnalyticsDashboardSchema.parse(dashboard);
      
      res.json(validatedDashboard);
    } catch (error) {
      console.error("Error fetching analytics dashboard:", error);
      res.status(500).json({ error: "Failed to fetch analytics dashboard" });
    }
  });
  
  app.get("/api/admin/analytics/metrics", requireAdmin, async (req, res) => {
    try {
      // Validate query parameters
      const validation = metricsQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid query parameters",
          details: validation.error.issues 
        });
      }
      
      const { period, startDate, endDate } = validation.data;
      
      // Get aggregated metrics using actual storage method
      const rawMetrics = await storage.getVoiceMetricsAggregated(
        period as string,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      // Transform to match frontend MetricsData interface
      const metrics = rawMetrics.map(metric => ({
        timestamp: metric.periodStart.toISOString(),
        period: metric.aggregationPeriod,
        data: {
          p50LatencyMs: metric.p50LatencyMs || 0,
          p95LatencyMs: metric.p95LatencyMs || 0,
          p99LatencyMs: metric.p99LatencyMs || 0,
          ttftMs: 0, // Not available in aggregated data, could be computed separately
          errorRate: metric.errorRate ? metric.errorRate / 10000 : 0, // Convert from basis points to fraction
          totalRequests: metric.totalSessions || 0
        }
      }));

      res.json({ metrics });
    } catch (error) {
      console.error("Error fetching aggregated metrics:", error);
      res.status(500).json({ error: "Failed to fetch aggregated metrics" });
    }
  });
  
  // Dating Training API Endpoints
  // Calibration testing endpoint (admin only)
  app.post("/api/admin/calibration/test", requireAdmin, async (req, res, next) => {
    try {
      const analyzer = new ConversationAnalyzer();
      const testResults = await calibrationEvaluator.runCalibrationTests(analyzer);
      const report = calibrationEvaluator.generateReport(testResults);
      
      res.json({
        results: testResults,
        report,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Calibration test error:', error);
      res.status(500).json({ error: 'Failed to run calibration tests' });
    }
  });

  // Dating training session analysis
  app.post("/api/dating/analyze", requireAuth, async (req, res, next) => {
    try {
      // Validate request body using Zod schema
      const validation = analyzeDatingConversationSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid request body",
          details: validation.error.issues 
        });
      }

      const { conversationHistory, scenarioType } = validation.data;
      const userId = req.user!.id;
      
      const analyzer = new ConversationAnalyzer();
      const scores = await analyzer.analyzeConversation(conversationHistory, scenarioType);
      
      // Store the analysis results in database
      const sessionAnalysis = {
        userId,
        scenarioType,
        conversationHistory,
        sessionDuration: null, // Could be calculated if needed
        engagementScore: Math.round(scores.engagement),
        empathyScore: Math.round(scores.empathy),
        flowScore: Math.round(scores.flow),
        confidenceScore: Math.round(scores.confidence),
        authenticityScore: Math.round(scores.authenticity),
        overallScore: Math.round(scores.overall),
        detailedFeedback: scores.feedback,
        strengths: scores.strengths,
        improvements: scores.improvements,
        analysisVersion: "1.0"
      };
      
      // Save to storage
      const savedSession = await storage.createDatingSessionAnalysis(sessionAnalysis);
      
      const response = {
        scores,
        sessionId: savedSession.id,
        timestamp: new Date().toISOString(),
        scenarioType
      };
      
      // Validate response using Zod schema
      const responseValidation = datingAnalysisResponseSchema.safeParse(response);
      if (!responseValidation.success) {
        console.error('Response validation failed:', responseValidation.error);
        return res.status(500).json({ error: 'Invalid analysis response format' });
      }
      
      res.json(responseValidation.data);
    } catch (error) {
      console.error('Dating analysis error:', error);
      res.status(500).json({ error: 'Failed to analyze conversation' });
    }
  });

  // Get dating training progress
  app.get("/api/dating/progress", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      
      // Fetch real user progress from storage
      const recentSessions = await storage.getUserDatingSessionHistory(userId, 10);
      
      // Convert to frontend format and calculate progress metrics
      const formattedSessions = recentSessions.map(session => ({
        sessionId: session.id,
        date: session.createdAt.toISOString(),
        scenarioType: session.scenarioType,
        scores: {
          engagement: session.engagementScore,
          empathy: session.empathyScore,
          flow: session.flowScore,
          confidence: session.confidenceScore,
          authenticity: session.authenticityScore,
          overall: session.overallScore,
          feedback: session.detailedFeedback || '',
          strengths: session.strengths as string[] || [],
          improvements: session.improvements as string[] || []
        }
      }));
      
      // Calculate overall progress using ConversationAnalyzer
      const analyzer = new ConversationAnalyzer();
      const overallProgress = analyzer.calculateProgressMetrics(
        formattedSessions.map(s => s.scores)
      );
      
      const progressData = {
        recentSessions: formattedSessions,
        overallProgress
      };
      
      // Validate response using Zod schema
      const responseValidation = datingProgressResponseSchema.safeParse(progressData);
      if (!responseValidation.success) {
        console.error('Dating progress response validation failed:', responseValidation.error);
        return res.status(500).json({ error: 'Invalid progress response format' });
      }
      
      res.json(responseValidation.data);
    } catch (error) {
      console.error('Dating progress error:', error);
      res.status(500).json({ error: 'Failed to fetch dating progress' });
    }
  });
  
  // Secure Media Storage API Routes  
  app.post("/api/media/upload-url", requireAuth, async (req, res) => {
    try {
      const { fileType, originalFileName } = req.body;
      const userId = req.user!.id;
      
      if (!fileType || !['voice', 'transcript'].includes(fileType)) {
        return res.status(400).json({ error: "Valid fileType (voice|transcript) is required" });
      }
      
      const uploadResult = await secureMediaStorage.generateSecureUploadUrl(
        userId,
        fileType,
        originalFileName
      );
      
      res.json(uploadResult);
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });
  
  app.post("/api/media/set-access-policy", requireAuth, async (req, res) => {
    try {
      const { fileId, fileUrl, visibility = 'private', metadata } = req.body;
      const userId = req.user!.id;
      
      if (!fileId || !fileUrl) {
        return res.status(400).json({ error: "fileId and fileUrl are required" });
      }
      
      const objectPath = await secureMediaStorage.setFileAccessPolicy(
        fileId,
        fileUrl,
        userId,
        visibility,
        metadata
      );
      
      res.json({ objectPath, success: true });
    } catch (error) {
      console.error("Error setting file access policy:", error);
      res.status(500).json({ error: "Failed to set file access policy" });
    }
  });
  
  app.get("/api/media/download/:fileId", requireAuth, async (req, res) => {
    try {
      const { fileId } = req.params;
      const userId = req.user!.id;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      const downloadResult = await secureMediaStorage.generateSecureDownloadUrl(
        fileId,
        userId,
        ipAddress,
        userAgent
      );
      
      res.json(downloadResult);
    } catch (error) {
      console.error("Error generating download URL:", error);
      if (error instanceof Error && error.message === 'Access denied') {
        return res.status(403).json({ error: "Access denied" });
      }
      if (error instanceof Error && error.message === 'File not found') {
        return res.status(404).json({ error: "File not found" });
      }
      res.status(500).json({ error: "Failed to generate download URL" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
