/**
 * Database Query Helpers and Performance Benchmarks
 * Optimized queries for pgvector similarity search and conversation retrieval
 */

import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import { 
  conversations, 
  userMemories, 
  voiceSessions, 
  voiceAnalytics,
  users
} from '@shared/schema';

export interface VectorSearchResult {
  id: string;
  content: string;
  similarity: number;
  createdAt: Date;
  metadata?: any;
}

export interface ConversationContext {
  conversations: Array<{
    id: string;
    mode: string;
    content: any;
    timestamp: Date;
    similarity?: number;
  }>;
  memories: Array<{
    id: string;
    content: string;
    importance: number;
    similarity: number;
    createdAt: Date;
  }>;
  recentVoiceSessions: Array<{
    id: string;
    originalTranscript: string;
    redactedTranscript: string;
    createdAt: Date;
  }>;
}

export class DatabaseQueryHelpers {
  
  /**
   * Perform vector similarity search on user memories
   * Benchmarked for top-k=10 performance
   */
  async searchUserMemories(
    userId: string, 
    queryEmbedding: number[], 
    topK: number = 10,
    minSimilarity: number = 0.7
  ): Promise<VectorSearchResult[]> {
    const startTime = performance.now();
    
    try {
      // Use pgvector cosine similarity with optimized index
      const results = await db
        .select({
          id: userMemories.id,
          content: userMemories.content,
          importance: userMemories.importance,
          createdAt: userMemories.createdAt,
          similarity: sql<number>`1 - (${userMemories.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`
        })
        .from(userMemories)
        .where(
          and(
            eq(userMemories.userId, userId),
            sql`1 - (${userMemories.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector) > ${minSimilarity}`
          )
        )
        .orderBy(sql`${userMemories.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`)
        .limit(topK);

      const duration = performance.now() - startTime;
      
      console.log(`Memory vector search completed in ${duration.toFixed(2)}ms for ${results.length} results`);
      
      return results.map(row => ({
        id: row.id,
        content: row.content,
        similarity: row.similarity,
        createdAt: row.createdAt,
        metadata: { importance: row.importance }
      }));
      
    } catch (error) {
      console.error('Memory vector search error:', error);
      throw new Error('Failed to search user memories');
    }
  }

  /**
   * Perform vector similarity search on conversations
   * Optimized for conversation retrieval
   */
  async searchSimilarConversations(
    userId: string,
    queryEmbedding: number[],
    topK: number = 5,
    mode?: string
  ): Promise<VectorSearchResult[]> {
    const startTime = performance.now();
    
    try {
      const results = await db
        .select({
          id: conversations.id,
          mode: conversations.mode,
          scenarioType: conversations.scenarioType,
          content: conversations.content,
          timestamp: conversations.timestamp,
          similarity: sql<number>`1 - (${conversations.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`
        })
        .from(conversations)
        .where(
          and(
            eq(conversations.userId, userId),
            mode ? eq(conversations.mode, mode) : undefined,
            sql`1 - (${conversations.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector) > 0.6`
          )
        )
        .orderBy(sql`${conversations.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`)
        .limit(topK);

      const duration = performance.now() - startTime;
      
      console.log(`Conversation vector search completed in ${duration.toFixed(2)}ms for ${results.length} results`);
      
      return results.map(row => ({
        id: row.id,
        content: JSON.stringify(row.content),
        similarity: row.similarity,
        createdAt: row.timestamp,
        metadata: { 
          mode: row.mode, 
          scenarioType: row.scenarioType 
        }
      }));
      
    } catch (error) {
      console.error('Conversation vector search error:', error);
      throw new Error('Failed to search conversations');
    }
  }

  /**
   * Get recent conversation context for user
   * Optimized query with proper indexing
   */
  async getConversationContext(
    userId: string,
    queryEmbedding?: number[],
    contextWindow: number = 10
  ): Promise<ConversationContext> {
    const startTime = performance.now();
    
    try {
      // Get recent conversations (indexed by userId + timestamp)
      const recentConversations = await db
        .select({
          id: conversations.id,
          mode: conversations.mode,
          scenarioType: conversations.scenarioType,
          content: conversations.content,
          timestamp: conversations.timestamp
        })
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .orderBy(desc(conversations.timestamp))
        .limit(contextWindow);

      // Get relevant memories if query embedding provided
      let relevantMemories: VectorSearchResult[] = [];
      if (queryEmbedding) {
        relevantMemories = await this.searchUserMemories(userId, queryEmbedding, 5);
      } else {
        // Get most important recent memories
        const memoryResults = await db
          .select({
            id: userMemories.id,
            content: userMemories.content,
            importance: userMemories.importance,
            createdAt: userMemories.createdAt
          })
          .from(userMemories)
          .where(eq(userMemories.userId, userId))
          .orderBy(desc(userMemories.importance), desc(userMemories.createdAt))
          .limit(5);
          
        relevantMemories = memoryResults.map(row => ({
          id: row.id,
          content: row.content,
          similarity: 0, // No similarity calculation without query
          createdAt: row.createdAt,
          metadata: { importance: row.importance }
        }));
      }

      // Get recent voice sessions
      const recentVoiceSessions = await db
        .select({
          id: voiceSessions.id,
          originalTranscript: voiceSessions.originalTranscript,
          redactedTranscript: voiceSessions.redactedTranscript,
          createdAt: voiceSessions.createdAt
        })
        .from(voiceSessions)
        .where(eq(voiceSessions.userId, userId))
        .orderBy(desc(voiceSessions.createdAt))
        .limit(5);

      const duration = performance.now() - startTime;
      console.log(`Context retrieval completed in ${duration.toFixed(2)}ms`);

      return {
        conversations: recentConversations.map(conv => ({
          id: conv.id,
          mode: conv.mode,
          content: conv.content,
          timestamp: conv.timestamp
        })),
        memories: relevantMemories.map(mem => ({
          id: mem.id,
          content: mem.content,
          importance: mem.metadata?.importance || 5,
          similarity: mem.similarity,
          createdAt: mem.createdAt
        })),
        recentVoiceSessions: recentVoiceSessions
      };
      
    } catch (error) {
      console.error('Context retrieval error:', error);
      throw new Error('Failed to retrieve conversation context');
    }
  }

  /**
   * Benchmark vector search performance
   * Tests different k values and similarity thresholds
   */
  async benchmarkVectorSearch(
    userId: string,
    testEmbedding: number[]
  ): Promise<{
    results: Array<{
      topK: number;
      minSimilarity: number;
      latencyMs: number;
      resultCount: number;
    }>;
    avgLatency: number;
    recommendations: string[];
  }> {
    const testConfigs = [
      { topK: 5, minSimilarity: 0.8 },
      { topK: 10, minSimilarity: 0.7 },
      { topK: 20, minSimilarity: 0.6 },
      { topK: 50, minSimilarity: 0.5 }
    ];

    const results = [];
    
    for (const config of testConfigs) {
      const startTime = performance.now();
      
      try {
        const searchResults = await this.searchUserMemories(
          userId,
          testEmbedding,
          config.topK,
          config.minSimilarity
        );
        
        const latency = performance.now() - startTime;
        
        results.push({
          topK: config.topK,
          minSimilarity: config.minSimilarity,
          latencyMs: Math.round(latency * 100) / 100,
          resultCount: searchResults.length
        });
        
      } catch (error) {
        console.error(`Benchmark failed for config ${JSON.stringify(config)}:`, error);
      }
    }

    const avgLatency = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;
    
    // Generate performance recommendations
    const recommendations = [];
    if (avgLatency > 100) {
      recommendations.push("Consider adding more specific pgvector indexes");
    }
    if (results[1]?.latencyMs < 50) { // topK=10 
      recommendations.push("Performance is good for real-time queries");
    }
    if (results.some(r => r.latencyMs > 200)) {
      recommendations.push("Large k values may impact user experience");
    }

    return {
      results,
      avgLatency: Math.round(avgLatency * 100) / 100,
      recommendations
    };
  }

  /**
   * Get voice analytics performance metrics
   * Optimized for dashboard queries
   */
  async getVoicePerformanceMetrics(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<{
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    avgTtft: number;
    errorRate: number;
    totalRequests: number;
  }> {
    const startTime = performance.now();
    
    try {
      const whereConditions = [
        gte(voiceAnalytics.createdAt, startDate),
        lte(voiceAnalytics.createdAt, endDate)
      ];
      
      if (userId) {
        whereConditions.push(eq(voiceAnalytics.userId, userId));
      }

      // Use SQL aggregations for performance  
      const [metrics] = await db
        .select({
          p50Latency: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${voiceAnalytics.totalLatencyMs})`,
          p95Latency: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${voiceAnalytics.totalLatencyMs})`,
          p99Latency: sql<number>`PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${voiceAnalytics.totalLatencyMs})`,
          avgTtft: sql<number>`AVG(${voiceAnalytics.ttftMs})`,
          errorRate: sql<number>`AVG(CASE WHEN ${voiceAnalytics.errorOccurred} THEN 1.0 ELSE 0.0 END)`,
          totalRequests: sql<number>`COUNT(*)`
        })
        .from(voiceAnalytics)
        .where(and(...whereConditions));

      const duration = performance.now() - startTime;
      console.log(`Voice metrics query completed in ${duration.toFixed(2)}ms`);

      return {
        p50Latency: Math.round(metrics.p50Latency || 0),
        p95Latency: Math.round(metrics.p95Latency || 0), 
        p99Latency: Math.round(metrics.p99Latency || 0),
        avgTtft: Math.round(metrics.avgTtft || 0),
        errorRate: Number((metrics.errorRate || 0).toFixed(4)),
        totalRequests: Number(metrics.totalRequests || 0)
      };
      
    } catch (error) {
      console.error('Voice metrics query error:', error);
      throw new Error('Failed to retrieve voice performance metrics');
    }
  }
}

export const queryHelpers = new DatabaseQueryHelpers();