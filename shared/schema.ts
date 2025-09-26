import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, boolean, vector, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums for billing and privacy
export const tierEnum = pgEnum("tier", ["free", "premium", "pro"]);
export const statusEnum = pgEnum("status", ["active", "past_due", "canceled", "paused", "trialing"]);
export const privacyOperationEnum = pgEnum("privacy_operation", ["export", "delete", "redaction"]);
export const privacyAuditStatusEnum = pgEnum("privacy_audit_status", ["initiated", "in_progress", "completed", "failed"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  age: integer("age").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  subscriptionTier: tierEnum("subscription_tier").default("free").notNull(),
  // Note: Also tracked in entitlements table for billing - users.subscriptionTier is cached for performance
  
  // Note: Stripe billing moved to entitlements table to avoid duplicate state
  
  // Admin & Moderation fields
  isAdmin: boolean("is_admin").default(false).notNull(), // Admin access to analytics and moderation
  isModerator: boolean("is_moderator").default(false).notNull(), // Moderation queue access
  
  // Trust & Safety fields
  dateOfBirth: timestamp("date_of_birth"), // Precise DOB for age verification
  region: text("region").default("US").notNull(), // ISO country code for regional age requirements
  ageVerified: boolean("age_verified").default(false).notNull(), // DOB-based verification status
  ageVerificationDate: timestamp("age_verification_date"), // When age was verified
  voiceConsentGiven: boolean("voice_consent_given").default(false).notNull(), // Consent for voice interactions
  voiceConsentDate: timestamp("voice_consent_date"), // When voice consent was given
  disclosureConsentGiven: boolean("disclosure_consent_given").default(false).notNull(), // Safety disclosure acknowledgment
  disclosureConsentDate: timestamp("disclosure_consent_date"), // When disclosure was acknowledged
  lastSafetyWarning: timestamp("last_safety_warning"), // Last time user received safety warning
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  mode: text("mode").notNull(), // heart, dating_training
  scenarioType: text("scenario_type"), // coffee_shop, restaurant, first_date
  content: jsonb("content").notNull(), // array of messages
  embedding: vector("embedding", { dimensions: 1536 }), // for memory recall
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  // Indexes for performance optimization
  userIdTimestampIdx: sql`CREATE INDEX IF NOT EXISTS idx_conversations_user_timestamp ON ${table} (user_id, timestamp DESC)`,
  modeIdx: sql`CREATE INDEX IF NOT EXISTS idx_conversations_mode ON ${table} (mode)`,
  embeddingIdx: sql`CREATE INDEX IF NOT EXISTS idx_conversations_embedding ON ${table} USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`,
}));

export const performanceScores = pgTable("performance_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  conversationId: varchar("conversation_id").references(() => conversations.id).notNull(),
  scores: jsonb("scores").notNull(), // { engagement: number, empathy: number, flow: number, overall: number }
  feedback: text("feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userMemories = pgTable("user_memories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  importance: integer("importance").default(5).notNull(), // 1-10 scale
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Optimized indexes for memory retrieval
  userIdImportanceIdx: sql`CREATE INDEX IF NOT EXISTS idx_memories_user_importance ON ${table} (user_id, importance DESC, created_at DESC)`,
  embeddingIdx: sql`CREATE INDEX IF NOT EXISTS idx_memories_embedding ON ${table} USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`,
}));

export const voiceSessions = pgTable("voice_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  conversationId: varchar("conversation_id").references(() => conversations.id),
  originalTranscript: text("original_transcript").notNull(), // Raw STT output
  redactedTranscript: text("redacted_transcript").notNull(), // PII-redacted version
  aiResponse: text("ai_response"), // AI response text before TTS
  redactedAiResponse: text("redacted_ai_response"), // PII-redacted AI response
  transcriptEmbedding: vector("transcript_embedding", { dimensions: 1536 }),
  audioMetadata: jsonb("audio_metadata"), // { duration, fileSize, format, sampleRate }
  voiceSettings: jsonb("voice_settings"), // { voice, speed, model }
  isEncrypted: boolean("is_encrypted").default(true).notNull(),
  piiRedacted: boolean("pii_redacted").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Indexes for voice session queries
  userIdCreatedIdx: sql`CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_created ON ${table} (user_id, created_at DESC)`,
  conversationIdIdx: sql`CREATE INDEX IF NOT EXISTS idx_voice_sessions_conversation ON ${table} (conversation_id)`,
  transcriptEmbeddingIdx: sql`CREATE INDEX IF NOT EXISTS idx_voice_sessions_embedding ON ${table} USING ivfflat (transcript_embedding vector_cosine_ops) WITH (lists = 50)`,
}));

export const voiceAnalytics = pgTable("voice_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  voiceSessionId: varchar("voice_session_id").references(() => voiceSessions.id, { onDelete: "cascade" }).notNull(),
  sttLatencyMs: integer("stt_latency_ms"), // Speech-to-text processing time
  aiProcessingMs: integer("ai_processing_ms"), // AI response generation time
  ttsLatencyMs: integer("tts_latency_ms"), // Text-to-speech processing time
  ttftMs: integer("ttft_ms"), // Time to first token (TTFT) for streaming
  totalLatencyMs: integer("total_latency_ms"), // End-to-end latency
  transcriptAccuracy: integer("transcript_accuracy"), // Confidence score 0-100
  safetyBlockedInput: boolean("safety_blocked_input").default(false),
  safetyBlockedOutput: boolean("safety_blocked_output").default(false),
  errorOccurred: boolean("error_occurred").default(false),
  errorType: text("error_type"), // stt_error, ai_error, tts_error, safety_error
  dailyVoiceMinutes: integer("daily_voice_minutes"), // Running total for the day
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Performance analytics indexes
  userIdCreatedIdx: sql`CREATE INDEX IF NOT EXISTS idx_voice_analytics_user_created ON ${table} (user_id, created_at DESC)`,
  createdAtIdx: sql`CREATE INDEX IF NOT EXISTS idx_voice_analytics_created ON ${table} (created_at DESC)`,
  latencyPerfIdx: sql`CREATE INDEX IF NOT EXISTS idx_voice_analytics_latency ON ${table} (total_latency_ms, created_at DESC)`,
  errorAnalysisIdx: sql`CREATE INDEX IF NOT EXISTS idx_voice_analytics_errors ON ${table} (error_occurred, error_type, created_at DESC)`,
}));

export const safetyAuditLog = pgTable("safety_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sessionId: text("session_id"), // Express session ID for anonymous users
  contentType: text("content_type").notNull(), // voice_input, voice_output, text_input, text_output
  originalContent: text("original_content").notNull(), // Content that was flagged
  riskLevel: text("risk_level").notNull(), // low, medium, high, critical
  concerns: jsonb("concerns").notNull(), // Array of safety concerns
  actionTaken: text("action_taken").notNull(), // blocked, filtered, flagged, escalated
  replacementContent: text("replacement_content"), // Safe alternative if content was replaced
  escalated: boolean("escalated").default(false).notNull(), // Whether escalated to moderation queue
  ipAddress: text("ip_address"), // For tracking patterns
  userAgent: text("user_agent"), // Browser/device info
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const moderationQueue = pgTable("moderation_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  auditLogId: varchar("audit_log_id").references(() => safetyAuditLog.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  status: text("status").default("pending").notNull(), // pending, reviewed, escalated, resolved
  priority: integer("priority").default(1).notNull(), // 1-5, 5 being highest priority
  moderatorId: varchar("moderator_id").references(() => users.id), // Admin who reviewed
  moderatorNotes: text("moderator_notes"), // Internal notes
  resolution: text("resolution"), // warn, suspend, ban, no_action
  createdAt: timestamp("created_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});

export const safetyDisclosures = pgTable("safety_disclosures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  disclosureType: text("disclosure_type").notNull(), // ai_interaction, mental_health_disclaimer, voice_consent
  disclosureVersion: text("disclosure_version").default("1.0").notNull(), // Track disclosure version changes
  consentGiven: boolean("consent_given").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const entitlements = pgTable("entitlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  tier: tierEnum("tier").default("free").notNull(), // free, premium, pro
  status: statusEnum("status").default("active").notNull(), // active, past_due, canceled, paused, trialing
  featuresJson: jsonb("features_json").notNull().default(sql`'{}'::jsonb`), // Features available for this tier
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  gracePeriodEndDate: timestamp("grace_period_end_date"), // 24h grace period for past_due
  lastWebhookEventId: text("last_webhook_event_id").unique(), // Track processed webhook events for idempotency
  voiceMinutesUsed: integer("voice_minutes_used").default(0).notNull(), // Monthly usage tracking
  voiceMinutesLimit: integer("voice_minutes_limit").default(0).notNull(), // Monthly limit for tier
  resetDate: timestamp("reset_date").defaultNow().notNull(), // When usage counters reset
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const processedWebhookEvents = pgTable("processed_webhook_events", {
  eventId: text("event_id").primaryKey(), // Stripe webhook event ID
  eventType: text("event_type").notNull(), // checkout.session.completed, etc.
  processed: boolean("processed").default(true).notNull(),
  entitlementId: varchar("entitlement_id").references(() => entitlements.id, { onDelete: "cascade" }),
  metadata: jsonb("metadata"), // Additional event metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Privacy & GDPR/CCPA Compliance Tables
export const privacyAuditLog = pgTable("privacy_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  operation: privacyOperationEnum("operation").notNull(), // export, delete, redaction
  operationType: text("operation_type").notNull(), // data_export, data_deletion, pii_redaction
  status: privacyAuditStatusEnum("status").default("initiated").notNull(), // initiated, in_progress, completed, failed
  requestId: text("request_id").unique(), // Unique request identifier for tracking
  dataTypes: text("data_types").array(), // [transcripts, audio, conversations, memories]
  filesGenerated: text("files_generated").array(), // Generated file paths
  downloadUrl: text("download_url"), // Signed URL for downloads
  downloadExpiry: timestamp("download_expiry"), // When download URL expires
  reasonForDeletion: text("reason_for_deletion"), // GDPR request, user request, etc.
  deletionMethod: text("deletion_method"), // soft_delete, hard_delete, overwrite
  piiRedacted: jsonb("pii_redacted"), // Details of PII redacted: {"names": ["John"], "emails": ["test@example.com"]}
  bytesProcessed: integer("bytes_processed"), // Amount of data processed
  recordsAffected: integer("records_affected"), // Number of database records affected
  adminUserId: varchar("admin_user_id").references(() => users.id), // Admin who processed the request
  ipAddress: text("ip_address"), // IP address of requester
  userAgent: text("user_agent"), // User agent of requester
  requestMetadata: jsonb("request_metadata"), // Additional request context
  errorDetails: text("error_details"), // Error message if operation failed
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const piiRedactionLog = pgTable("pii_redaction_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  auditLogId: varchar("audit_log_id").references(() => privacyAuditLog.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(), // transcript, message, memory, voice_session
  originalContentId: varchar("original_content_id").notNull(), // ID of content that was redacted
  redactionType: text("redaction_type").notNull(), // name, email, phone, address, ssn
  piiOriginalHash: text("pii_original_hash"), // SHA-256 hash of original PII for verification (never store raw PII)
  redactedText: text("redacted_text").notNull(), // Redacted replacement text
  confidence: integer("confidence"), // ML confidence score 0-100
  method: text("method").notNull(), // regex, ml_model, manual
  position: integer("position"), // Character position in original text
  length: integer("length"), // Length of redacted text
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  conversations: many(conversations),
  performanceScores: many(performanceScores),
  memories: many(userMemories),
  voiceSessions: many(voiceSessions),
  voiceAnalytics: many(voiceAnalytics),
  safetyAuditLogs: many(safetyAuditLog),
  moderationQueue: many(moderationQueue),
  safetyDisclosures: many(safetyDisclosures),
  entitlement: one(entitlements),
  privacyAuditLogs: many(privacyAuditLog),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  performanceScores: many(performanceScores),
}));

export const performanceScoresRelations = relations(performanceScores, ({ one }) => ({
  user: one(users, {
    fields: [performanceScores.userId],
    references: [users.id],
  }),
  conversation: one(conversations, {
    fields: [performanceScores.conversationId],
    references: [conversations.id],
  }),
}));

export const userMemoriesRelations = relations(userMemories, ({ one }) => ({
  user: one(users, {
    fields: [userMemories.userId],
    references: [users.id],
  }),
}));

export const voiceSessionsRelations = relations(voiceSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [voiceSessions.userId],
    references: [users.id],
  }),
  conversation: one(conversations, {
    fields: [voiceSessions.conversationId],
    references: [conversations.id],
  }),
  analytics: many(voiceAnalytics),
}));

export const voiceAnalyticsRelations = relations(voiceAnalytics, ({ one }) => ({
  user: one(users, {
    fields: [voiceAnalytics.userId],
    references: [users.id],
  }),
  voiceSession: one(voiceSessions, {
    fields: [voiceAnalytics.voiceSessionId],
    references: [voiceSessions.id],
  }),
}));

export const safetyAuditLogRelations = relations(safetyAuditLog, ({ one, many }) => ({
  user: one(users, {
    fields: [safetyAuditLog.userId],
    references: [users.id],
  }),
  moderationQueue: many(moderationQueue),
}));

export const moderationQueueRelations = relations(moderationQueue, ({ one }) => ({
  auditLog: one(safetyAuditLog, {
    fields: [moderationQueue.auditLogId],
    references: [safetyAuditLog.id],
  }),
  user: one(users, {
    fields: [moderationQueue.userId],
    references: [users.id],
  }),
  moderator: one(users, {
    fields: [moderationQueue.moderatorId],
    references: [users.id],
  }),
}));

export const safetyDisclosuresRelations = relations(safetyDisclosures, ({ one }) => ({
  user: one(users, {
    fields: [safetyDisclosures.userId],
    references: [users.id],
  }),
}));

export const entitlementsRelations = relations(entitlements, ({ one }) => ({
  user: one(users, {
    fields: [entitlements.userId],
    references: [users.id],
  }),
}));

export const privacyAuditLogRelations = relations(privacyAuditLog, ({ one, many }) => ({
  user: one(users, {
    fields: [privacyAuditLog.userId],
    references: [users.id],
  }),
  adminUser: one(users, {
    fields: [privacyAuditLog.adminUserId],
    references: [users.id],
  }),
  piiRedactionLogs: many(piiRedactionLog),
}));

export const piiRedactionLogRelations = relations(piiRedactionLog, ({ one }) => ({
  auditLog: one(privacyAuditLog, {
    fields: [piiRedactionLog.auditLogId],
    references: [privacyAuditLog.id],
  }),
}));

// Rate Limiting & Cost Management Tables
export const rateLimitingConfig = pgTable("rate_limiting_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  tier: tierEnum("tier").default("free").notNull(),
  dailyVoiceMinutesLimit: integer("daily_voice_minutes_limit").default(5).notNull(),
  monthlySttCallsLimit: integer("monthly_stt_calls_limit").default(50).notNull(),
  monthlyTtsCharactersLimit: integer("monthly_tts_characters_limit").default(1000).notNull(),
  monthlyLlmTokensLimit: integer("monthly_llm_tokens_limit").default(10000).notNull(),
  currentPeriodStart: timestamp("current_period_start").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const costTracking = pgTable("cost_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  serviceType: text("service_type").notNull(), // stt, tts, llm, embedding
  provider: text("provider").default("openai").notNull(),
  costUsd: integer("cost_usd").notNull(), // Cost in cents (e.g., 250 = $2.50)
  tokensUsed: integer("tokens_used"),
  charactersProcessed: integer("characters_processed"),
  minutesProcessed: integer("minutes_processed"),
  requestId: text("request_id").unique(),
  metadata: jsonb("metadata"), // Additional cost details
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const globalCostLimits = pgTable("global_cost_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  limitType: text("limit_type").notNull(), // hourly, daily, monthly
  maxCostUsd: integer("max_cost_usd").notNull(), // Max cost in cents
  currentSpendUsd: integer("current_spend_usd").default(0).notNull(),
  periodStart: timestamp("period_start").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastTriggered: timestamp("last_triggered"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const circuitBreakerState = pgTable("circuit_breaker_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceName: text("service_name").notNull().unique(), // openai_stt, openai_tts, openai_llm
  state: text("state").default("closed").notNull(), // closed, open, half_open
  failureCount: integer("failure_count").default(0).notNull(),
  lastFailureTime: timestamp("last_failure_time"),
  nextRetryTime: timestamp("next_retry_time"),
  successCount: integer("success_count").default(0).notNull(),
  totalRequests: integer("total_requests").default(0).notNull(),
  avgResponseTimeMs: integer("avg_response_time_ms").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rateLimitViolations = pgTable("rate_limit_violations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  violationType: text("violation_type").notNull(), // voice_minutes, stt_calls, tts_characters, cost_limit
  limitExceeded: integer("limit_exceeded").notNull(),
  currentUsage: integer("current_usage").notNull(),
  requestDetails: jsonb("request_details"),
  actionTaken: text("action_taken").notNull(), // blocked, throttled, fallback_used
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Secure Media Audit Log table for tamper-evident logging
export const mediaAuditLog = pgTable("media_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileId: text("file_id").notNull(),
  userId: varchar("user_id").references(() => users.id),
  operation: text("operation").notNull(), // upload, download, delete, access_denied
  ipAddress: text("ip_address"), // Client IP for security tracking
  userAgent: text("user_agent"), // User agent string
  success: boolean("success").notNull(),
  errorReason: text("error_reason"), // Reason for failure if success=false
  metadata: jsonb("metadata"), // Additional operation metadata
  checksumBefore: text("checksum_before"), // File checksum before operation
  checksumAfter: text("checksum_after"), // File checksum after operation
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Dating Training System Tables
export const datingSessionAnalysis = pgTable("dating_session_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  conversationId: varchar("conversation_id").references(() => conversations.id),
  scenarioType: text("scenario_type").notNull(), // coffee_shop, restaurant, first_date, speed_dating, etc.
  sessionDuration: integer("session_duration_seconds"),
  conversationHistory: jsonb("conversation_history").notNull(), // Array of messages
  
  // 5-dimensional scoring system  
  engagementScore: integer("engagement_score").notNull(), // 1-10
  empathyScore: integer("empathy_score").notNull(), // 1-10  
  flowScore: integer("flow_score").notNull(), // 1-10
  confidenceScore: integer("confidence_score").notNull(), // 1-10
  authenticityScore: integer("authenticity_score").notNull(), // 1-10
  overallScore: integer("overall_score").notNull(), // 1-10
  
  // Analysis feedback
  detailedFeedback: text("detailed_feedback"),
  strengths: jsonb("strengths"), // Array of strength descriptions
  improvements: jsonb("improvements"), // Array of improvement suggestions
  
  // Progress tracking
  previousSessionId: varchar("previous_session_id"), // For comparison
  improvementFromPrevious: integer("improvement_from_previous"), // Score delta
  
  // Metadata
  analysisVersion: text("analysis_version").default("1.0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  age: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  timestamp: true,
});

export const insertPerformanceScoreSchema = createInsertSchema(performanceScores).omit({
  id: true,
  createdAt: true,
});

export const insertUserMemorySchema = createInsertSchema(userMemories).omit({
  id: true,
  createdAt: true,
});

export const insertVoiceSessionSchema = createInsertSchema(voiceSessions).omit({
  id: true,
  createdAt: true,
});

export const insertVoiceAnalyticsSchema = createInsertSchema(voiceAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertSafetyAuditLogSchema = createInsertSchema(safetyAuditLog).omit({
  id: true,
  createdAt: true,
});

export const insertModerationQueueSchema = createInsertSchema(moderationQueue).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
});

export const insertSafetyDisclosureSchema = createInsertSchema(safetyDisclosures).omit({
  id: true,
  createdAt: true,
});

export const insertEntitlementSchema = createInsertSchema(entitlements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProcessedWebhookEventSchema = createInsertSchema(processedWebhookEvents).omit({
  createdAt: true,
});

export const insertPrivacyAuditLogSchema = createInsertSchema(privacyAuditLog).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertPiiRedactionLogSchema = createInsertSchema(piiRedactionLog).omit({
  id: true,
  createdAt: true,
});

export const insertRateLimitingConfigSchema = createInsertSchema(rateLimitingConfig).omit({
  id: true,
  updatedAt: true,
});

export const insertCostTrackingSchema = createInsertSchema(costTracking).omit({
  id: true,
  createdAt: true,
});

export const insertGlobalCostLimitsSchema = createInsertSchema(globalCostLimits).omit({
  id: true,
  updatedAt: true,
});

export const insertCircuitBreakerStateSchema = createInsertSchema(circuitBreakerState).omit({
  id: true,
  updatedAt: true,
});

export const insertRateLimitViolationSchema = createInsertSchema(rateLimitViolations).omit({
  id: true,
  createdAt: true,
});

export const insertDatingSessionAnalysisSchema = createInsertSchema(datingSessionAnalysis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Zod validation schemas for dating training API endpoints
export const analyzeDatingConversationSchema = z.object({
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(2000)
  })).min(1).max(50),
  scenarioType: z.enum(['coffee_shop', 'restaurant', 'first_date', 'speed_dating', 'group_hangout', 'online_to_offline', 'workplace_social', 'activity_date'])
});

// Reusable conversation scores schema
export const conversationScoresDataSchema = z.object({
  engagement: z.number().min(1).max(10),
  empathy: z.number().min(1).max(10),
  flow: z.number().min(1).max(10),
  confidence: z.number().min(1).max(10),
  authenticity: z.number().min(1).max(10),
  overall: z.number().min(1).max(10),
  feedback: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string())
});

export const datingAnalysisResponseSchema = z.object({
  scores: conversationScoresDataSchema,
  sessionId: z.string(),
  timestamp: z.string(),
  scenarioType: z.string()
});

// Voice Analytics Time-Series Aggregation Tables
export const voiceMetricsAggregated = pgTable("voice_metrics_aggregated", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  aggregationPeriod: text("aggregation_period").notNull(), // hour, day, week, month
  periodStart: timestamp("period_start").notNull(),
  totalSessions: integer("total_sessions").default(0).notNull(),
  totalErrorSessions: integer("total_error_sessions").default(0).notNull(),
  totalSafetyBlocks: integer("total_safety_blocks").default(0).notNull(),
  p50LatencyMs: integer("p50_latency_ms"),
  p95LatencyMs: integer("p95_latency_ms"),
  p99LatencyMs: integer("p99_latency_ms"),
  avgSttLatencyMs: integer("avg_stt_latency_ms"),
  avgTtsLatencyMs: integer("avg_tts_latency_ms"),
  avgAiProcessingMs: integer("avg_ai_processing_ms"),
  errorRate: integer("error_rate"), // Percentage as integer (e.g., 525 = 5.25%)
  safetyBlockRate: integer("safety_block_rate"), // Percentage as integer
  totalCostUsd: integer("total_cost_usd"), // Total cost in cents
  totalVoiceMinutes: integer("total_voice_minutes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const voiceAlertsConfig = pgTable("voice_alerts_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertType: text("alert_type").notNull(), // latency_high, error_rate_high, cost_high
  threshold: integer("threshold").notNull(), // Threshold value (e.g., 2500 for 2.5s latency)
  periodMinutes: integer("period_minutes").default(60).notNull(), // Alert evaluation period
  isActive: boolean("is_active").default(true).notNull(),
  lastTriggered: timestamp("last_triggered"),
  notificationChannels: text("notification_channels").array(), // [email, slack, webhook]
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const voiceAlertHistory = pgTable("voice_alert_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertConfigId: varchar("alert_config_id").references(() => voiceAlertsConfig.id, { onDelete: "cascade" }).notNull(),
  alertType: text("alert_type").notNull(),
  currentValue: integer("current_value").notNull(),
  threshold: integer("threshold").notNull(),
  severity: text("severity").default("warning").notNull(), // info, warning, critical
  message: text("message").notNull(),
  acknowledged: boolean("acknowledged").default(false).notNull(),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolved: boolean("resolved").default(false).notNull(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertPerformanceScore = z.infer<typeof insertPerformanceScoreSchema>;
export type PerformanceScore = typeof performanceScores.$inferSelect;
export type InsertUserMemory = z.infer<typeof insertUserMemorySchema>;
export type UserMemory = typeof userMemories.$inferSelect;
export type InsertVoiceSession = z.infer<typeof insertVoiceSessionSchema>;
export type VoiceSession = typeof voiceSessions.$inferSelect;
export type InsertVoiceAnalytics = z.infer<typeof insertVoiceAnalyticsSchema>;
export type VoiceAnalytics = typeof voiceAnalytics.$inferSelect;
export type InsertSafetyAuditLog = z.infer<typeof insertSafetyAuditLogSchema>;
export type SafetyAuditLog = typeof safetyAuditLog.$inferSelect;
export type InsertModerationQueue = z.infer<typeof insertModerationQueueSchema>;
export type ModerationQueue = typeof moderationQueue.$inferSelect;
export type InsertSafetyDisclosure = z.infer<typeof insertSafetyDisclosureSchema>;
export type SafetyDisclosure = typeof safetyDisclosures.$inferSelect;
export type InsertEntitlement = z.infer<typeof insertEntitlementSchema>;
export type Entitlement = typeof entitlements.$inferSelect;
export type InsertProcessedWebhookEvent = z.infer<typeof insertProcessedWebhookEventSchema>;
export type ProcessedWebhookEvent = typeof processedWebhookEvents.$inferSelect;
export type InsertPrivacyAuditLog = z.infer<typeof insertPrivacyAuditLogSchema>;
export type PrivacyAuditLog = typeof privacyAuditLog.$inferSelect;
export type InsertPiiRedactionLog = z.infer<typeof insertPiiRedactionLogSchema>;
export type PiiRedactionLog = typeof piiRedactionLog.$inferSelect;
export type InsertRateLimitingConfig = z.infer<typeof insertRateLimitingConfigSchema>;
export type RateLimitingConfig = typeof rateLimitingConfig.$inferSelect;
export type InsertCostTracking = z.infer<typeof insertCostTrackingSchema>;
export type CostTracking = typeof costTracking.$inferSelect;
export type InsertGlobalCostLimits = z.infer<typeof insertGlobalCostLimitsSchema>;
export type GlobalCostLimits = typeof globalCostLimits.$inferSelect;
export type InsertCircuitBreakerState = z.infer<typeof insertCircuitBreakerStateSchema>;
export type CircuitBreakerState = typeof circuitBreakerState.$inferSelect;
export type InsertRateLimitViolation = z.infer<typeof insertRateLimitViolationSchema>;
export type RateLimitViolation = typeof rateLimitViolations.$inferSelect;

// Dating Training Types
export type InsertDatingSessionAnalysis = z.infer<typeof insertDatingSessionAnalysisSchema>;
export type DatingSessionAnalysis = typeof datingSessionAnalysis.$inferSelect;
export type AnalyzeDatingConversationRequest = z.infer<typeof analyzeDatingConversationSchema>;
export type DatingAnalysisResponse = z.infer<typeof datingAnalysisResponseSchema>;

// Voice Analytics Time-Series Types
export const insertVoiceMetricsAggregatedSchema = createInsertSchema(voiceMetricsAggregated).omit({
  id: true,
  createdAt: true,
});

export const insertVoiceAlertsConfigSchema = createInsertSchema(voiceAlertsConfig).omit({
  id: true,
  createdAt: true,
});

export const insertVoiceAlertHistorySchema = createInsertSchema(voiceAlertHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertVoiceMetricsAggregated = z.infer<typeof insertVoiceMetricsAggregatedSchema>;
export type VoiceMetricsAggregated = typeof voiceMetricsAggregated.$inferSelect;
export type InsertVoiceAlertsConfig = z.infer<typeof insertVoiceAlertsConfigSchema>;
export type VoiceAlertsConfig = typeof voiceAlertsConfig.$inferSelect;
export type InsertVoiceAlertHistory = z.infer<typeof insertVoiceAlertHistorySchema>;
export type VoiceAlertHistory = typeof voiceAlertHistory.$inferSelect;

// Analytics API Response Types for Contract Alignment
export const analyticsKpiMetricsSchema = z.object({
  p50Latency: z.number(),
  p95Latency: z.number(),
  p99Latency: z.number(),
  errorRate: z.number(),
  timeToFirstTokenMs: z.number(),
  totalRequests: z.number(),
  averageCostPerRequest: z.number(),
  totalCostUsd: z.number()
});

export const analyticsTimeSeriesPointSchema = z.object({
  timestamp: z.string(),
  value: z.number()
});

export const analyticsMetricsDataSchema = z.object({
  latency: z.array(analyticsTimeSeriesPointSchema),
  errorRate: z.array(analyticsTimeSeriesPointSchema),
  requestVolume: z.array(analyticsTimeSeriesPointSchema),
  costPerRequest: z.array(analyticsTimeSeriesPointSchema)
});

export const voiceAnalyticsDashboardSchema = z.object({
  kpiMetrics: analyticsKpiMetricsSchema,
  timeRangeData: analyticsMetricsDataSchema
});

// Dating Progress API Schema
export const datingProgressSessionSchema = z.object({
  sessionId: z.string(),
  date: z.string(),
  scenarioType: z.string(),
  scores: conversationScoresDataSchema
});

export const overallProgressMetricsSchema = z.object({
  averageScore: z.number(),
  totalSessions: z.number(),
  improvementTrend: z.number(),
  strongestSkill: z.string(),
  skillToImprove: z.string(),
  progressSummary: z.string()
});

export const datingProgressResponseSchema = z.object({
  recentSessions: z.array(datingProgressSessionSchema),
  overallProgress: overallProgressMetricsSchema
});

// Export types for frontend use
export type AnalyticsKpiMetrics = z.infer<typeof analyticsKpiMetricsSchema>;
export type AnalyticsTimeSeriesPoint = z.infer<typeof analyticsTimeSeriesPointSchema>;
export type AnalyticsMetricsData = z.infer<typeof analyticsMetricsDataSchema>;
export type VoiceAnalyticsDashboard = z.infer<typeof voiceAnalyticsDashboardSchema>;
export type DatingProgressSession = z.infer<typeof datingProgressSessionSchema>;
export type OverallProgressMetrics = z.infer<typeof overallProgressMetricsSchema>;
export type DatingProgressResponse = z.infer<typeof datingProgressResponseSchema>;
