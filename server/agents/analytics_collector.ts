export interface AnalyticsEvent {
  eventType: string;
  userId: string;
  timestamp: Date;
  properties: Record<string, any>;
  sessionId?: string;
}

export interface VoiceKPIMetrics {
  totalLatencyMs: number;
  sttLatencyMs: number;
  aiProcessingMs: number;
  ttsLatencyMs: number;
  ttftMs?: number; // Time To First Token for streaming
  errorOccurred: boolean;
  errorType?: string;
  safetyBlocked: boolean;
  transcriptAccuracy?: number;
  costUsd?: number;
  sessionId: string;
  userId: string;
}

export interface PercentileMetrics {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
  sampleCount: number;
}

export interface VoiceAnalyticsDashboard {
  periodStart: Date;
  periodEnd: Date;
  latencyMetrics: PercentileMetrics;
  errorRate: number;
  safetyBlockRate: number;
  totalSessions: number;
  totalCost: number;
  alerts: Array<{
    type: string;
    severity: string;
    message: string;
    timestamp: Date;
  }>;
}

export interface UserMetrics {
  totalConversations: number;
  averageSessionLength: number;
  favoriteScenarios: string[];
  improvementAreas: string[];
  engagementScore: number;
  retentionRisk: 'low' | 'medium' | 'high';
}

export class AnalyticsCollector {
  private events: AnalyticsEvent[] = [];
  private storage: any;

  constructor(storage: any) {
    this.storage = storage;
  }

  collectEvent(
    eventType: string,
    userId: string,
    properties: Record<string, any> = {},
    sessionId?: string
  ): void {
    const event: AnalyticsEvent = {
      eventType,
      userId,
      timestamp: new Date(),
      properties,
      sessionId
    };

    this.events.push(event);
    
    // In production, this would send to analytics service
    console.log('Analytics event:', event);
  }

  // Common event collection methods
  trackConversationStart(userId: string, mode: string, sessionId: string): void {
    this.collectEvent('conversation_start', userId, { mode }, sessionId);
  }

  trackConversationEnd(
    userId: string,
    mode: string,
    messageCount: number,
    duration: number,
    sessionId: string
  ): void {
    this.collectEvent('conversation_end', userId, {
      mode,
      messageCount,
      duration
    }, sessionId);
  }

  trackScenarioCompletion(
    userId: string,
    scenarioType: string,
    completionRate: number,
    score: any,
    sessionId: string
  ): void {
    this.collectEvent('scenario_completion', userId, {
      scenarioType,
      completionRate,
      score
    }, sessionId);
  }

  trackUserAction(
    userId: string,
    action: string,
    context: Record<string, any> = {}
  ): void {
    this.collectEvent('user_action', userId, { action, ...context });
  }

  // Enhanced voice KPI tracking methods
  async trackVoiceKPIs(metrics: VoiceKPIMetrics): Promise<void> {
    const event: AnalyticsEvent = {
      eventType: 'voice_kpi',
      userId: metrics.userId,
      timestamp: new Date(),
      properties: {
        totalLatencyMs: metrics.totalLatencyMs,
        sttLatencyMs: metrics.sttLatencyMs,
        aiProcessingMs: metrics.aiProcessingMs,
        ttsLatencyMs: metrics.ttsLatencyMs,
        errorOccurred: metrics.errorOccurred,
        errorType: metrics.errorType,
        safetyBlocked: metrics.safetyBlocked,
        transcriptAccuracy: metrics.transcriptAccuracy,
        costUsd: metrics.costUsd
      },
      sessionId: metrics.sessionId
    };

    this.events.push(event);
    
    // Store in database for aggregation
    try {
      await this.storage.insertVoiceAnalytics({
        userId: metrics.userId,
        voiceSessionId: metrics.sessionId,
        sttLatencyMs: metrics.sttLatencyMs,
        aiProcessingMs: metrics.aiProcessingMs,
        ttsLatencyMs: metrics.ttsLatencyMs,
        ttftMs: metrics.ttftMs,
        totalLatencyMs: metrics.totalLatencyMs,
        transcriptAccuracy: metrics.transcriptAccuracy,
        safetyBlockedInput: metrics.safetyBlocked,
        safetyBlockedOutput: metrics.safetyBlocked,
        errorOccurred: metrics.errorOccurred,
        errorType: metrics.errorType
      });
    } catch (error) {
      console.error('Failed to store voice analytics:', error);
    }
  }

  async calculatePercentiles(values: number[]): Promise<PercentileMetrics> {
    if (values.length === 0) {
      return {
        p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0, sampleCount: 0
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;
    
    return {
      p50: sorted[Math.floor(len * 0.5)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
      avg: sorted.reduce((sum, val) => sum + val, 0) / len,
      min: sorted[0],
      max: sorted[len - 1],
      sampleCount: len
    };
  }

  async getVoiceAnalyticsDashboard(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<VoiceAnalyticsDashboard> {
    try {
      // Get voice analytics data for the period
      const analytics = await this.storage.getVoiceAnalyticsByPeriod(
        startDate,
        endDate,
        userId
      );

      if (analytics.length === 0) {
        return {
          periodStart: startDate,
          periodEnd: endDate,
          latencyMetrics: { p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0, sampleCount: 0 },
          errorRate: 0,
          safetyBlockRate: 0,
          totalSessions: 0,
          totalCost: 0,
          alerts: []
        };
      }

      const latencies = analytics.map((a: any) => a.totalLatencyMs).filter((l: number | null) => l !== null) as number[];
      const latencyMetrics = await this.calculatePercentiles(latencies);
      
      const totalSessions = analytics.length;
      const errorSessions = analytics.filter((a: any) => a.errorOccurred).length;
      const safetyBlocks = analytics.filter((a: any) => a.safetyBlockedInput || a.safetyBlockedOutput).length;
      
      const errorRate = totalSessions > 0 ? (errorSessions / totalSessions) * 100 : 0;
      const safetyBlockRate = totalSessions > 0 ? (safetyBlocks / totalSessions) * 100 : 0;

      // Get cost data
      const costData = await this.storage.getCostTrackingByPeriod(startDate, endDate, userId);
      const totalCost = costData.reduce((sum: number, c: any) => sum + (c.costUsd || 0), 0) / 100; // Convert cents to dollars

      // Check for alerts
      const alerts = [];
      if (latencyMetrics.p95 > 2500) { // Alert if p95 > 2.5s
        alerts.push({
          type: 'latency_high',
          severity: 'warning',
          message: `P95 latency (${latencyMetrics.p95}ms) exceeds threshold of 2500ms`,
          timestamp: new Date()
        });
      }
      
      if (errorRate > 5) { // Alert if error rate > 5%
        alerts.push({
          type: 'error_rate_high',
          severity: 'critical',
          message: `Error rate (${errorRate.toFixed(2)}%) exceeds threshold of 5%`,
          timestamp: new Date()
        });
      }

      return {
        periodStart: startDate,
        periodEnd: endDate,
        latencyMetrics,
        errorRate,
        safetyBlockRate,
        totalSessions,
        totalCost,
        alerts
      };
    } catch (error) {
      console.error('Failed to generate voice analytics dashboard:', error);
      throw error;
    }
  }

  async aggregateVoiceMetrics(
    period: 'hour' | 'day' | 'week' | 'month',
    startTime: Date
  ): Promise<void> {
    try {
      const endTime = new Date(startTime);
      switch (period) {
        case 'hour':
          endTime.setHours(endTime.getHours() + 1);
          break;
        case 'day':
          endTime.setDate(endTime.getDate() + 1);
          break;
        case 'week':
          endTime.setDate(endTime.getDate() + 7);
          break;
        case 'month':
          endTime.setMonth(endTime.getMonth() + 1);
          break;
      }

      const analytics = await this.storage.getVoiceAnalyticsByPeriod(startTime, endTime);
      
      if (analytics.length === 0) return;

      const latencies = analytics.map((a: any) => a.totalLatencyMs).filter((l: number | null) => l !== null) as number[];
      const percentiles = await this.calculatePercentiles(latencies);
      
      const totalSessions = analytics.length;
      const errorSessions = analytics.filter((a: any) => a.errorOccurred).length;
      const safetyBlocks = analytics.filter((a: any) => a.safetyBlockedInput || a.safetyBlockedOutput).length;
      
      const errorRate = Math.round((errorSessions / totalSessions) * 10000); // Store as basis points
      const safetyBlockRate = Math.round((safetyBlocks / totalSessions) * 10000);

      // Calculate averages
      const avgSttLatency = Math.round(analytics.reduce((sum: number, a: any) => sum + (a.sttLatencyMs || 0), 0) / analytics.length);
      const avgTtsLatency = Math.round(analytics.reduce((sum: number, a: any) => sum + (a.ttsLatencyMs || 0), 0) / analytics.length);
      const avgAiProcessing = Math.round(analytics.reduce((sum: number, a: any) => sum + (a.aiProcessingMs || 0), 0) / analytics.length);

      // Get cost data
      const costData = await this.storage.getCostTrackingByPeriod(startTime, endTime);
      const totalCostUsd = costData.reduce((sum: number, c: any) => sum + (c.costUsd || 0), 0);
      
      // Get voice minutes
      const voiceMinutes = analytics.reduce((sum: number, a: any) => sum + (a.dailyVoiceMinutes || 0), 0);

      await this.storage.insertVoiceMetricsAggregated({
        aggregationPeriod: period,
        periodStart: startTime,
        totalSessions,
        totalErrorSessions: errorSessions,
        totalSafetyBlocks: safetyBlocks,
        p50LatencyMs: percentiles.p50,
        p95LatencyMs: percentiles.p95,
        p99LatencyMs: percentiles.p99,
        avgSttLatencyMs: avgSttLatency,
        avgTtsLatencyMs: avgTtsLatency,
        avgAiProcessingMs: avgAiProcessing,
        errorRate,
        safetyBlockRate,
        totalCostUsd,
        totalVoiceMinutes: voiceMinutes
      });

    } catch (error) {
      console.error(`Failed to aggregate voice metrics for ${period}:`, error);
    }
  }

  async checkAlertThresholds(): Promise<void> {
    try {
      const alertConfigs = await this.storage.getActiveAlertConfigs();
      const now = new Date();
      
      for (const config of alertConfigs) {
        const periodStart = new Date(now.getTime() - config.periodMinutes * 60 * 1000);
        const analytics = await this.storage.getVoiceAnalyticsByPeriod(periodStart, now);
        
        if (analytics.length === 0) continue;
        
        let currentValue = 0;
        let shouldTrigger = false;
        
        switch (config.alertType) {
          case 'latency_high': {
            const latencies = analytics.map((a: any) => a.totalLatencyMs).filter((l: number | null) => l !== null) as number[];
            if (latencies.length > 0) {
              const percentiles = await this.calculatePercentiles(latencies);
              currentValue = percentiles.p95;
              shouldTrigger = currentValue > config.threshold;
            }
            break;
          }
          case 'error_rate_high': {
            const errorRate = (analytics.filter((a: any) => a.errorOccurred).length / analytics.length) * 100;
            currentValue = Math.round(errorRate * 100); // Convert to basis points
            shouldTrigger = currentValue > config.threshold;
            break;
          }
          case 'cost_high': {
            const costData = await this.storage.getCostTrackingByPeriod(periodStart, now);
            currentValue = costData.reduce((sum: number, c: any) => sum + (c.costUsd || 0), 0);
            shouldTrigger = currentValue > config.threshold;
            break;
          }
        }
        
        if (shouldTrigger) {
          const severity = currentValue > config.threshold * 1.5 ? 'critical' : 'warning';
          const message = this.generateAlertMessage(config.alertType, currentValue, config.threshold);
          
          await this.storage.insertVoiceAlertHistory({
            alertConfigId: config.id,
            alertType: config.alertType,
            currentValue,
            threshold: config.threshold,
            severity,
            message
          });
          
          // Update last triggered time
          await this.storage.updateAlertConfigLastTriggered(config.id, now);
          
          console.warn(`Voice Analytics Alert: ${message}`);
        }
      }
    } catch (error) {
      console.error('Failed to check alert thresholds:', error);
    }
  }

  private generateAlertMessage(alertType: string, currentValue: number, threshold: number): string {
    switch (alertType) {
      case 'latency_high':
        return `High P95 latency detected: ${currentValue}ms (threshold: ${threshold}ms)`;
      case 'error_rate_high':
        return `High error rate detected: ${(currentValue / 100).toFixed(2)}% (threshold: ${(threshold / 100).toFixed(2)}%)`;
      case 'cost_high':
        return `High cost detected: $${(currentValue / 100).toFixed(2)} (threshold: $${(threshold / 100).toFixed(2)})`;
      default:
        return `Alert triggered for ${alertType}: ${currentValue} (threshold: ${threshold})`;
    }
  }

  async generateUserMetrics(userId: string): Promise<UserMetrics> {
    // Get conversations from database
    const conversations = await this.storage.getConversationsByUser(userId, 100);
    const performanceScores = await this.storage.getPerformanceScoresByUser(userId, 50);
    
    const totalConversations = conversations.length;
    
    // Calculate average session length based on message count (proxy for time)
    const averageSessionLength = conversations.length > 0
      ? conversations.reduce((sum: number, conv: any) => {
          const messageCount = Array.isArray(conv.content) ? conv.content.length : 0;
          return sum + messageCount * 2; // Estimate 2 minutes per message exchange
        }, 0) / conversations.length
      : 0;

    // Find favorite scenarios from dating training conversations
    const scenarioConversations = conversations.filter((c: any) => c.mode === 'dating_training' && c.scenarioType);
    const scenarioCounts = scenarioConversations.reduce((counts: Record<string, number>, conv: any) => {
      const scenario = conv.scenarioType!;
      counts[scenario] = (counts[scenario] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const favoriteScenarios = Object.entries(scenarioCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([scenario]) => scenario);

    // Calculate engagement score based on recent activity
    const recentConversations = conversations.filter((conv: any) => {
      const daysSinceConv = (Date.now() - conv.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceConv <= 7;
    });

    const engagementScore = Math.min(10, recentConversations.length);

    // Assess retention risk based on last conversation
    const lastActivity = conversations.length > 0 
      ? Math.max(...conversations.map((c: any) => c.timestamp.getTime()))
      : 0;
    
    const daysSinceLastActivity = (Date.now() - lastActivity) / (1000 * 60 * 60 * 24);
    
    let retentionRisk: 'low' | 'medium' | 'high' = 'low';
    if (daysSinceLastActivity > 14) {
      retentionRisk = 'high';
    } else if (daysSinceLastActivity > 7) {
      retentionRisk = 'medium';
    }

    // Calculate improvement areas based on performance scores
    const improvementAreas = this.calculateImprovementAreas(performanceScores);

    return {
      totalConversations,
      averageSessionLength,
      favoriteScenarios,
      improvementAreas,
      engagementScore,
      retentionRisk
    };
  }

  async getUsageTrends(userId: string, days: number = 30): Promise<any> {
    const conversations = await this.storage.getConversationsByUser(userId, 100);
    
    // Filter conversations within the specified days
    const recentConversations = conversations.filter((conv: any) => {
      const convAge = (Date.now() - conv.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      return convAge <= days;
    });

    // Group conversations by date
    const convsByDate = recentConversations.reduce((groups: Record<string, number>, conv: any) => {
      const date = conv.timestamp.toISOString().split('T')[0];
      groups[date] = (groups[date] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);

    return {
      dailyActivity: convsByDate,
      totalEvents: recentConversations.length,
      averageEventsPerDay: recentConversations.length / days
    };
  }

  private calculateImprovementAreas(performanceScores: any[]): string[] {
    if (performanceScores.length === 0) {
      return ['engagement', 'empathy', 'conversation_flow'];
    }

    // Calculate averages for each metric
    const totals = performanceScores.reduce((acc, score) => {
      const scores = score.scores as any;
      acc.engagement += scores.engagement || 0;
      acc.empathy += scores.empathy || 0;
      acc.flow += scores.flow || 0;
      acc.count++;
      return acc;
    }, { engagement: 0, empathy: 0, flow: 0, count: 0 });

    const averages = {
      engagement: totals.engagement / totals.count,
      empathy: totals.empathy / totals.count,
      flow: totals.flow / totals.count
    };

    // Find areas with scores below 7 (needs improvement)
    const improvementAreas: string[] = [];
    if (averages.engagement < 7) improvementAreas.push('engagement');
    if (averages.empathy < 7) improvementAreas.push('empathy');
    if (averages.flow < 7) improvementAreas.push('conversation_flow');

    // If no areas need improvement, return the lowest scoring area
    if (improvementAreas.length === 0) {
      const lowest = Object.entries(averages).sort(([,a], [,b]) => a - b)[0][0];
      if (lowest === 'flow') return ['conversation_flow'];
      return [lowest];
    }

    return improvementAreas;
  }
}
