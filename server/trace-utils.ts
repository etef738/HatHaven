/**
 * Trace ID utilities for end-to-end latency measurement coordination
 * Ensures single trace ID propagates across STT → LLM → TTS pipeline
 */

import type { Request } from "express";

/**
 * Gets or generates a trace ID for request correlation
 * Priority: incoming X-Trace-ID header > generate new one
 */
export function getOrGenerateTraceId(req: Request, prefix: string = 'voice'): string {
  // Check for incoming trace ID from client
  const incomingTraceId = req.headers['x-trace-id'] as string;
  
  if (incomingTraceId && typeof incomingTraceId === 'string' && incomingTraceId.length > 0) {
    // Validate trace ID format (basic validation)
    if (/^[a-zA-Z0-9_-]+$/.test(incomingTraceId)) {
      return incomingTraceId;
    }
  }
  
  // Generate new trace ID if none provided or invalid
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Creates timing metadata object for consistent latency reporting
 */
export function createTimingMetadata(
  traceId: string,
  phase: string,
  startTime: number,
  additionalMetrics: Record<string, number> = {}
): {
  traceId: string;
  phase: string;
  totalLatencyMs: number;
  timestamp: string;
  [key: string]: any;
} {
  const totalLatencyMs = Math.round(performance.now() - startTime);
  
  return {
    traceId,
    phase,
    totalLatencyMs,
    timestamp: new Date().toISOString(),
    ...additionalMetrics
  };
}

/**
 * Logs structured timing event for analysis
 */
export function logTimingEvent(
  event: string,
  userId: string,
  timingMetadata: ReturnType<typeof createTimingMetadata>,
  additionalData: Record<string, any> = {}
): void {
  console.log(JSON.stringify({
    event,
    userId,
    ...timingMetadata,
    ...additionalData
  }));
}