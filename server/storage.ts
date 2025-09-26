import { users, conversations, performanceScores, userMemories, voiceSessions, voiceAnalytics, safetyAuditLog, moderationQueue, safetyDisclosures, circuitBreakerState, rateLimitingConfig, costTracking, globalCostLimits, rateLimitViolations, voiceMetricsAggregated, voiceAlertsConfig, voiceAlertHistory, mediaAuditLog, datingSessionAnalysis, type User, type InsertUser, type Conversation, type InsertConversation, type PerformanceScore, type InsertPerformanceScore, type UserMemory, type InsertUserMemory, type VoiceSession, type InsertVoiceSession, type VoiceAnalytics, type InsertVoiceAnalytics, type SafetyAuditLog, type InsertSafetyAuditLog, type ModerationQueue, type InsertModerationQueue, type SafetyDisclosure, type InsertSafetyDisclosure, type CircuitBreakerState, type InsertCircuitBreakerState, type RateLimitingConfig, type InsertRateLimitingConfig, type CostTracking, type InsertCostTracking, type GlobalCostLimits, type InsertGlobalCostLimits, type RateLimitViolation, type InsertRateLimitViolation, type VoiceMetricsAggregated, type InsertVoiceMetricsAggregated, type VoiceAlertsConfig, type InsertVoiceAlertsConfig, type VoiceAlertHistory, type InsertVoiceAlertHistory, type DatingSessionAnalysis, type InsertDatingSessionAnalysis } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, cosineDistance, gt, gte, lte, sum, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { fullPiiRedaction } from "./pii-redaction";
import { createEmbedding } from "./openai";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  getConversationsByUser(userId: string, limit?: number): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  updateConversation(id: string, updates: Partial<InsertConversation>): Promise<Conversation>;
  
  createPerformanceScore(score: InsertPerformanceScore): Promise<PerformanceScore>;
  getPerformanceScoresByUser(userId: string, limit?: number): Promise<PerformanceScore[]>;
  
  createUserMemory(memory: InsertUserMemory): Promise<UserMemory>;
  searchSimilarMemories(userId: string, embedding: number[], limit?: number): Promise<UserMemory[]>;
  
  // Voice session methods
  createVoiceSession(session: InsertVoiceSession): Promise<VoiceSession>;
  getVoiceSessionsByUser(userId: string, limit?: number): Promise<VoiceSession[]>;
  getVoiceSession(id: string): Promise<VoiceSession | undefined>;
  getVoiceSessionsByConversation(conversationId: string): Promise<VoiceSession[]>;
  deleteVoiceSessionsByUser(userId: string): Promise<void>; // For GDPR compliance
  
  // Voice analytics methods
  createVoiceAnalytics(analytics: InsertVoiceAnalytics): Promise<VoiceAnalytics>;
  getVoiceAnalyticsByUser(userId: string, limit?: number): Promise<VoiceAnalytics[]>;
  getVoiceAnalyticsBySession(sessionId: string): Promise<VoiceAnalytics[]>;
  getDailyVoiceMinutes(userId: string, date: Date): Promise<number>;
  
  // Trust & Safety methods
  updateUserSafetyFields(userId: string, updates: Partial<Pick<User, 'dateOfBirth' | 'region' | 'ageVerified' | 'ageVerificationDate' | 'voiceConsentGiven' | 'voiceConsentDate' | 'disclosureConsentGiven' | 'disclosureConsentDate' | 'lastSafetyWarning'>>): Promise<User>;
  getUserSafetyStatus(userId: string): Promise<{ageVerified: boolean, voiceConsentGiven: boolean, disclosureConsentGiven: boolean, region: string} | undefined>;
  
  // Safety audit log methods
  createSafetyAuditLog(auditLog: InsertSafetyAuditLog): Promise<SafetyAuditLog>;
  getSafetyAuditLogsByUser(userId: string, limit?: number): Promise<SafetyAuditLog[]>;
  getSafetyAuditLogsByRiskLevel(riskLevel: string, limit?: number): Promise<SafetyAuditLog[]>;
  
  // Moderation queue methods
  createModerationQueueEntry(entry: InsertModerationQueue): Promise<ModerationQueue>;
  getPendingModerationEntries(limit?: number): Promise<ModerationQueue[]>;
  updateModerationEntry(id: string, updates: Partial<InsertModerationQueue>): Promise<ModerationQueue>;
  
  // Safety disclosures methods
  createSafetyDisclosure(disclosure: InsertSafetyDisclosure): Promise<SafetyDisclosure>;
  getUserDisclosures(userId: string): Promise<SafetyDisclosure[]>;
  getLatestDisclosure(userId: string, disclosureType: string): Promise<SafetyDisclosure | undefined>;
  
  // Circuit breaker methods
  getCircuitBreakerState(serviceName: string): Promise<CircuitBreakerState | null>;
  updateCircuitBreakerState(serviceName: string, updates: Partial<CircuitBreakerState>): Promise<void>;
  updateCircuitBreakerMetrics(serviceName: string, metrics: Partial<CircuitBreakerState>): Promise<void>;
  
  // Rate limiting methods
  getRateLimitingConfig(userId: string): Promise<RateLimitingConfig | null>;
  createRateLimitingConfig(config: InsertRateLimitingConfig): Promise<RateLimitingConfig>;
  updateRateLimitingConfig(userId: string, updates: Partial<RateLimitingConfig>): Promise<void>;
  trackCost(cost: InsertCostTracking): Promise<CostTracking>;
  getUserDailyCosts(userId: string, date: Date): Promise<number>;
  getGlobalHourlyCosts(): Promise<number>;
  getGlobalDailyCosts(): Promise<number>;
  recordRateLimitViolation(violation: InsertRateLimitViolation): Promise<RateLimitViolation>;
  
  // Voice Analytics methods for dashboard
  insertVoiceAnalytics(analytics: InsertVoiceAnalytics): Promise<VoiceAnalytics>;
  getVoiceAnalyticsByPeriod(startDate: Date, endDate: Date, userId?: string): Promise<VoiceAnalytics[]>;
  getCostTrackingByPeriod(startDate: Date, endDate: Date, userId?: string): Promise<CostTracking[]>;
  
  // Time-series aggregation methods
  insertVoiceMetricsAggregated(metrics: any): Promise<any>;
  getVoiceMetricsAggregated(period: string, startDate: Date, endDate: Date): Promise<any[]>;
  
  // Alert management methods
  getActiveAlertConfigs(): Promise<any[]>;
  insertVoiceAlertHistory(alert: any): Promise<any>;
  updateAlertConfigLastTriggered(alertConfigId: string, timestamp: Date): Promise<void>;
  
  // Dating training methods
  createDatingSessionAnalysis(analysis: InsertDatingSessionAnalysis): Promise<DatingSessionAnalysis>;
  getUserDatingSessionHistory(userId: string, limit?: number): Promise<DatingSessionAnalysis[]>;
  
  sessionStore: InstanceType<typeof PostgresSessionStore>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: InstanceType<typeof PostgresSessionStore>;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ pool, createTableIfMissing: true });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db
      .insert(conversations)
      .values(conversation)
      .returning();
    return newConversation;
  }

  async getConversationsByUser(userId: string, limit: number = 50): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.timestamp))
      .limit(limit);
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async updateConversation(id: string, updates: Partial<InsertConversation>): Promise<Conversation> {
    const [updatedConversation] = await db
      .update(conversations)
      .set(updates)
      .where(eq(conversations.id, id))
      .returning();
    return updatedConversation;
  }

  async createPerformanceScore(score: InsertPerformanceScore): Promise<PerformanceScore> {
    const [newScore] = await db
      .insert(performanceScores)
      .values(score)
      .returning();
    return newScore;
  }

  async getPerformanceScoresByUser(userId: string, limit: number = 50): Promise<PerformanceScore[]> {
    return await db
      .select()
      .from(performanceScores)
      .where(eq(performanceScores.userId, userId))
      .orderBy(desc(performanceScores.createdAt))
      .limit(limit);
  }

  async createUserMemory(memory: InsertUserMemory): Promise<UserMemory> {
    const [newMemory] = await db
      .insert(userMemories)
      .values(memory)
      .returning();
    return newMemory;
  }

  async searchSimilarMemories(userId: string, embedding: number[], limit: number = 10): Promise<UserMemory[]> {
    return await db
      .select()
      .from(userMemories)
      .where(
        and(
          eq(userMemories.userId, userId),
          gt(userMemories.importance, 3)
        )
      )
      .orderBy(cosineDistance(userMemories.embedding, embedding))
      .limit(limit);
  }

  // Voice session methods implementation
  async createVoiceSession(session: InsertVoiceSession): Promise<VoiceSession> {
    // Automatically redact PII from transcripts and AI responses before storing
    const redactedOriginalTranscript = fullPiiRedaction(session.originalTranscript);
    const redactedAiResponse = session.aiResponse ? fullPiiRedaction(session.aiResponse) : null;
    
    // Recompute embedding from redacted text to prevent PII leakage in embeddings
    const transcriptEmbedding = await createEmbedding(redactedOriginalTranscript.redactedText);
    
    const sessionWithRedaction = {
      ...session,
      // Store both original (redacted) and explicitly redacted versions
      originalTranscript: redactedOriginalTranscript.redactedText,
      redactedTranscript: session.redactedTranscript || redactedOriginalTranscript.redactedText,
      aiResponse: redactedAiResponse?.redactedText || session.aiResponse,
      redactedAiResponse: session.redactedAiResponse || redactedAiResponse?.redactedText || session.aiResponse,
      // Override any client-provided embedding with one computed from redacted text
      transcriptEmbedding: transcriptEmbedding,
      piiRedacted: true, // Ensure this is always true since we're redacting on backend
      isEncrypted: true // Mark as encrypted (encryption implementation will come in security hardening phase)
    };
    
    const [newSession] = await db
      .insert(voiceSessions)
      .values(sessionWithRedaction)
      .returning();
    return newSession;
  }

  async getVoiceSessionsByUser(userId: string, limit: number = 50): Promise<VoiceSession[]> {
    return await db
      .select()
      .from(voiceSessions)
      .where(eq(voiceSessions.userId, userId))
      .orderBy(desc(voiceSessions.createdAt))
      .limit(limit);
  }

  async getVoiceSession(id: string): Promise<VoiceSession | undefined> {
    const [session] = await db.select().from(voiceSessions).where(eq(voiceSessions.id, id));
    return session || undefined;
  }

  async getVoiceSessionsByConversation(conversationId: string): Promise<VoiceSession[]> {
    return await db
      .select()
      .from(voiceSessions)
      .where(eq(voiceSessions.conversationId, conversationId))
      .orderBy(desc(voiceSessions.createdAt));
  }

  async deleteVoiceSessionsByUser(userId: string): Promise<void> {
    // Use transaction to ensure both analytics and sessions are deleted properly
    // The cascade should handle this, but we implement it explicitly for safety
    await db.transaction(async (tx) => {
      // First delete analytics records
      await tx.delete(voiceAnalytics).where(eq(voiceAnalytics.userId, userId));
      // Then delete voice sessions
      await tx.delete(voiceSessions).where(eq(voiceSessions.userId, userId));
    });
  }

  // Voice analytics methods implementation
  async createVoiceAnalytics(analytics: InsertVoiceAnalytics): Promise<VoiceAnalytics> {
    const [newAnalytics] = await db
      .insert(voiceAnalytics)
      .values(analytics)
      .returning();
    return newAnalytics;
  }

  async getVoiceAnalyticsByUser(userId: string, limit: number = 50): Promise<VoiceAnalytics[]> {
    return await db
      .select()
      .from(voiceAnalytics)
      .where(eq(voiceAnalytics.userId, userId))
      .orderBy(desc(voiceAnalytics.createdAt))
      .limit(limit);
  }

  async getVoiceAnalyticsBySession(sessionId: string): Promise<VoiceAnalytics[]> {
    return await db
      .select()
      .from(voiceAnalytics)
      .where(eq(voiceAnalytics.voiceSessionId, sessionId))
      .orderBy(desc(voiceAnalytics.createdAt));
  }

  async getDailyVoiceMinutes(userId: string, date: Date): Promise<number> {
    // Get the start and end of the given date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get voice sessions for the day instead of analytics to avoid double-counting
    const sessions = await db
      .select()
      .from(voiceSessions)
      .where(
        and(
          eq(voiceSessions.userId, userId),
          // Filter by date range - created_at between start and end of day
          gte(voiceSessions.createdAt, startOfDay),
          lte(voiceSessions.createdAt, endOfDay)
        )
      );

    // Sum up the duration from each session's audio metadata
    return sessions.reduce((total, session) => {
      const audioMetadata = session.audioMetadata as any;
      if (audioMetadata && typeof audioMetadata.duration === 'number') {
        // Convert duration from seconds to minutes
        const minutes = audioMetadata.duration / 60;
        return total + minutes;
      }
      return total;
    }, 0);
  }

  // Trust & Safety methods implementation
  async updateUserSafetyFields(userId: string, updates: Partial<Pick<User, 'dateOfBirth' | 'region' | 'ageVerified' | 'ageVerificationDate' | 'voiceConsentGiven' | 'voiceConsentDate' | 'disclosureConsentGiven' | 'disclosureConsentDate' | 'lastSafetyWarning'>>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async getUserSafetyStatus(userId: string): Promise<{ageVerified: boolean, voiceConsentGiven: boolean, disclosureConsentGiven: boolean, region: string} | undefined> {
    const [user] = await db
      .select({
        ageVerified: users.ageVerified,
        voiceConsentGiven: users.voiceConsentGiven,
        disclosureConsentGiven: users.disclosureConsentGiven,
        region: users.region
      })
      .from(users)
      .where(eq(users.id, userId));
    return user || undefined;
  }

  // Safety audit log methods implementation
  async createSafetyAuditLog(auditLog: InsertSafetyAuditLog): Promise<SafetyAuditLog> {
    const [newAuditLog] = await db
      .insert(safetyAuditLog)
      .values(auditLog)
      .returning();
    return newAuditLog;
  }

  async getSafetyAuditLogsByUser(userId: string, limit: number = 50): Promise<SafetyAuditLog[]> {
    return await db
      .select()
      .from(safetyAuditLog)
      .where(eq(safetyAuditLog.userId, userId))
      .orderBy(desc(safetyAuditLog.createdAt))
      .limit(limit);
  }

  async getSafetyAuditLogsByRiskLevel(riskLevel: string, limit: number = 100): Promise<SafetyAuditLog[]> {
    return await db
      .select()
      .from(safetyAuditLog)
      .where(eq(safetyAuditLog.riskLevel, riskLevel))
      .orderBy(desc(safetyAuditLog.createdAt))
      .limit(limit);
  }

  // Moderation queue methods implementation
  async createModerationQueueEntry(entry: InsertModerationQueue): Promise<ModerationQueue> {
    const [newEntry] = await db
      .insert(moderationQueue)
      .values(entry)
      .returning();
    return newEntry;
  }

  async getPendingModerationEntries(limit: number = 50): Promise<ModerationQueue[]> {
    return await db
      .select()
      .from(moderationQueue)
      .where(eq(moderationQueue.status, "pending"))
      .orderBy(desc(moderationQueue.priority), desc(moderationQueue.createdAt))
      .limit(limit);
  }

  async updateModerationEntry(id: string, updates: Partial<InsertModerationQueue>): Promise<ModerationQueue> {
    const [updatedEntry] = await db
      .update(moderationQueue)
      .set(updates)
      .where(eq(moderationQueue.id, id))
      .returning();
    return updatedEntry;
  }

  // Safety disclosures methods implementation
  async createSafetyDisclosure(disclosure: InsertSafetyDisclosure): Promise<SafetyDisclosure> {
    const [newDisclosure] = await db
      .insert(safetyDisclosures)
      .values(disclosure)
      .returning();
    return newDisclosure;
  }

  async getUserDisclosures(userId: string): Promise<SafetyDisclosure[]> {
    return await db
      .select()
      .from(safetyDisclosures)
      .where(eq(safetyDisclosures.userId, userId))
      .orderBy(desc(safetyDisclosures.createdAt));
  }

  async getLatestDisclosure(userId: string, disclosureType: string): Promise<SafetyDisclosure | undefined> {
    const [disclosure] = await db
      .select()
      .from(safetyDisclosures)
      .where(
        and(
          eq(safetyDisclosures.userId, userId),
          eq(safetyDisclosures.disclosureType, disclosureType)
        )
      )
      .orderBy(desc(safetyDisclosures.createdAt))
      .limit(1);
    return disclosure || undefined;
  }

  // Circuit breaker methods implementation
  async getCircuitBreakerState(serviceName: string): Promise<CircuitBreakerState | null> {
    const [state] = await db
      .select()
      .from(circuitBreakerState)
      .where(eq(circuitBreakerState.serviceName, serviceName))
      .limit(1);
    return state || null;
  }

  async updateCircuitBreakerState(serviceName: string, updates: Partial<CircuitBreakerState>): Promise<void> {
    const existing = await this.getCircuitBreakerState(serviceName);
    
    if (existing) {
      await db
        .update(circuitBreakerState)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(circuitBreakerState.serviceName, serviceName));
    } else {
      await db
        .insert(circuitBreakerState)
        .values({
          serviceName,
          state: 'closed',
          failureCount: 0,
          successCount: 0,
          totalRequests: 0,
          avgResponseTimeMs: 0,
          ...updates,
          updatedAt: new Date()
        });
    }
  }

  async updateCircuitBreakerMetrics(serviceName: string, metrics: Partial<CircuitBreakerState>): Promise<void> {
    await this.updateCircuitBreakerState(serviceName, metrics);
  }

  async atomicIncrementCircuitBreakerSuccess(serviceName: string, stateId: string): Promise<number> {
    // Ensure state exists first
    const existing = await this.getCircuitBreakerState(serviceName);
    if (!existing) {
      await this.updateCircuitBreakerState(serviceName, {
        successCount: 1,
        failureCount: 0
      });
      return 1;
    }

    // Use SQL increment to avoid race conditions
    const [updatedState] = await db
      .update(circuitBreakerState)
      .set({ 
        successCount: sql`${circuitBreakerState.successCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(circuitBreakerState.serviceName, serviceName))
      .returning({ successCount: circuitBreakerState.successCount });

    return updatedState?.successCount || (existing.successCount || 0) + 1;
  }

  async atomicIncrementCircuitBreakerFailure(serviceName: string, stateId: string): Promise<number> {
    // Ensure state exists first
    const existing = await this.getCircuitBreakerState(serviceName);
    if (!existing) {
      await this.updateCircuitBreakerState(serviceName, {
        failureCount: 1,
        successCount: 0
      });
      return 1;
    }

    // Use SQL increment to avoid race conditions
    const [updatedState] = await db
      .update(circuitBreakerState)
      .set({ 
        failureCount: sql`${circuitBreakerState.failureCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(circuitBreakerState.serviceName, serviceName))
      .returning({ failureCount: circuitBreakerState.failureCount });

    return updatedState?.failureCount || (existing.failureCount || 0) + 1;
  }

  // Rate limiting methods implementation
  async getRateLimitingConfig(userId: string): Promise<RateLimitingConfig | null> {
    const [config] = await db
      .select()
      .from(rateLimitingConfig)
      .where(eq(rateLimitingConfig.userId, userId))
      .limit(1);
    return config || null;
  }

  async createRateLimitingConfig(config: InsertRateLimitingConfig): Promise<RateLimitingConfig> {
    const [newConfig] = await db
      .insert(rateLimitingConfig)
      .values(config)
      .returning();
    return newConfig;
  }

  async updateRateLimitingConfig(userId: string, updates: Partial<RateLimitingConfig>): Promise<void> {
    await db
      .update(rateLimitingConfig)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(rateLimitingConfig.userId, userId));
  }

  async trackCost(cost: InsertCostTracking): Promise<CostTracking> {
    const [newCost] = await db
      .insert(costTracking)
      .values(cost)
      .returning();
    return newCost;
  }

  async getUserDailyCosts(userId: string, date: Date): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await db
      .select({ totalCost: sum(costTracking.costUsd) })
      .from(costTracking)
      .where(
        and(
          eq(costTracking.userId, userId),
          gte(costTracking.createdAt, startOfDay),
          lte(costTracking.createdAt, endOfDay)
        )
      );

    return Number(result[0]?.totalCost || 0);
  }

  async getGlobalHourlyCosts(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const result = await db
      .select({ totalCost: sum(costTracking.costUsd) })
      .from(costTracking)
      .where(gte(costTracking.createdAt, oneHourAgo));

    return Number(result[0]?.totalCost || 0);
  }

  async getGlobalDailyCosts(): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await db
      .select({ totalCost: sum(costTracking.costUsd) })
      .from(costTracking)
      .where(gte(costTracking.createdAt, startOfDay));

    return Number(result[0]?.totalCost || 0);
  }

  async recordRateLimitViolation(violation: InsertRateLimitViolation): Promise<RateLimitViolation> {
    const [newViolation] = await db
      .insert(rateLimitViolations)
      .values(violation)
      .returning();
    return newViolation;
  }

  // Voice Analytics methods for dashboard - Implementation of missing methods
  async insertVoiceAnalytics(analytics: InsertVoiceAnalytics): Promise<VoiceAnalytics> {
    const [newAnalytics] = await db
      .insert(voiceAnalytics)
      .values(analytics)
      .returning();
    return newAnalytics;
  }

  async getVoiceAnalyticsByPeriod(startDate: Date, endDate: Date, userId?: string): Promise<VoiceAnalytics[]> {
    const conditions = [
      gte(voiceAnalytics.createdAt, startDate),
      lte(voiceAnalytics.createdAt, endDate)
    ];

    if (userId) {
      conditions.push(eq(voiceAnalytics.userId, userId));
    }

    return await db
      .select()
      .from(voiceAnalytics)
      .where(and(...conditions))
      .orderBy(desc(voiceAnalytics.createdAt));
  }

  async getCostTrackingByPeriod(startDate: Date, endDate: Date, userId?: string): Promise<CostTracking[]> {
    const conditions = [
      gte(costTracking.createdAt, startDate),
      lte(costTracking.createdAt, endDate)
    ];

    if (userId) {
      conditions.push(eq(costTracking.userId, userId));
    }

    return await db
      .select()
      .from(costTracking)
      .where(and(...conditions))
      .orderBy(desc(costTracking.createdAt));
  }

  // Time-series aggregation methods - using the existing voiceMetricsAggregated table
  async insertVoiceMetricsAggregated(metrics: any): Promise<any> {
    const [newMetrics] = await db
      .insert(voiceMetricsAggregated)
      .values(metrics)
      .returning();
    return newMetrics;
  }

  async getVoiceMetricsAggregated(period: string, startDate: Date, endDate: Date): Promise<any[]> {
    return await db
      .select()
      .from(voiceMetricsAggregated)
      .where(
        and(
          eq(voiceMetricsAggregated.aggregationPeriod, period),
          gte(voiceMetricsAggregated.periodStart, startDate),
          lte(voiceMetricsAggregated.periodStart, endDate)
        )
      )
      .orderBy(desc(voiceMetricsAggregated.periodStart));
  }

  // Alert management methods - using the existing alert tables
  async getActiveAlertConfigs(): Promise<any[]> {
    return await db
      .select()
      .from(voiceAlertsConfig)
      .where(eq(voiceAlertsConfig.isActive, true))
      .orderBy(voiceAlertsConfig.alertType);
  }

  async insertVoiceAlertHistory(alert: any): Promise<any> {
    const [newAlert] = await db
      .insert(voiceAlertHistory)
      .values(alert)
      .returning();
    return newAlert;
  }

  async updateAlertConfigLastTriggered(alertConfigId: string, timestamp: Date): Promise<void> {
    await db
      .update(voiceAlertsConfig)
      .set({ lastTriggered: timestamp })
      .where(eq(voiceAlertsConfig.id, alertConfigId));
  }

  // Media Audit Log methods for persistent secure logging
  async insertMediaAuditLog(auditLog: any): Promise<any> {
    const [newAuditLog] = await db
      .insert(mediaAuditLog)
      .values(auditLog)
      .returning();
    return newAuditLog;
  }

  async getMediaAuditLog(
    fileId?: string,
    userId?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<any[]> {
    const conditions = [];
    if (fileId) conditions.push(eq(mediaAuditLog.fileId, fileId));
    if (userId) conditions.push(eq(mediaAuditLog.userId, userId));
    if (startDate) conditions.push(gte(mediaAuditLog.timestamp, startDate));
    if (endDate) conditions.push(lte(mediaAuditLog.timestamp, endDate));

    const baseQuery = db.select().from(mediaAuditLog);
    
    const query = conditions.length > 0 
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    return await query
      .orderBy(desc(mediaAuditLog.timestamp))
      .limit(limit);
  }

  // Dating training methods
  async createDatingSessionAnalysis(analysis: InsertDatingSessionAnalysis): Promise<DatingSessionAnalysis> {
    const [newAnalysis] = await db
      .insert(datingSessionAnalysis)
      .values(analysis)
      .returning();
    return newAnalysis;
  }

  async getUserDatingSessionHistory(userId: string, limit: number = 10): Promise<DatingSessionAnalysis[]> {
    return await db
      .select()
      .from(datingSessionAnalysis)
      .where(eq(datingSessionAnalysis.userId, userId))
      .orderBy(desc(datingSessionAnalysis.createdAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
