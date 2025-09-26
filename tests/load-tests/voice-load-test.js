/**
 * K6 Load Test for Voice Processing Pipeline
 * Tests 500 concurrent voice sessions with p95 latency targets
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const voiceSessionErrors = new Rate('voice_session_errors');
const sttLatency = new Trend('stt_latency_ms');
const llmLatency = new Trend('llm_latency_ms'); 
const ttsLatency = new Trend('tts_latency_ms');
const e2eLatency = new Trend('e2e_voice_latency_ms');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 50 },    // Ramp up to 50 users
    { duration: '3m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 500 },   // Ramp to 500 concurrent users
    { duration: '10m', target: 500 },  // Stay at 500 users for 10 minutes
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // P95 < 5 seconds
    e2e_voice_latency_ms: ['p(95)<8000'], // End-to-end P95 < 8 seconds
    stt_latency_ms: ['p(95)<2000'],     // STT P95 < 2 seconds
    llm_latency_ms: ['p(95)<3000'],     // LLM P95 < 3 seconds  
    tts_latency_ms: ['p(95)<2000'],     // TTS P95 < 2 seconds
    voice_session_errors: ['rate<0.05'], // Error rate < 5%
    http_req_failed: ['rate<0.05'],      // HTTP error rate < 5%
  },
};

// Test data
const testMessages = [
  "Hello, how are you doing today?",
  "I'm feeling a bit nervous about my upcoming date.",
  "Can you help me practice some conversation starters?",
  "What would be a good response if someone asks about my hobbies?",
  "I want to work on being more confident when speaking.",
  "How should I handle awkward silences during a conversation?",
  "Can we practice some dating scenarios together?",
  "I'm not sure how to show interest without being too forward.",
];

const scenarios = ['coffee_shop', 'restaurant', 'first_date'];

let authToken = null;
let userId = null;

// Setup function - create test user and authenticate
export function setup() {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:5000';
  
  // Create test user
  const userResponse = http.post(`${baseUrl}/api/auth/signup`, {
    username: `loadtest_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email: `loadtest${Date.now()}@example.com`,
    password: 'TestPassword123!',
    age: 25,
    dateOfBirth: '1998-01-01',
    region: 'US'
  });
  
  if (userResponse.status !== 200) {
    console.error('Failed to create test user:', userResponse.body);
    return;
  }

  const userData = userResponse.json();
  console.log('Created test user:', userData.user.username);
  
  return {
    authToken: userData.token,
    userId: userData.user.id,
    baseUrl: baseUrl
  };
}

export default function (data) {
  if (!data || !data.authToken) {
    console.error('No authentication data available');
    return;
  }

  const { baseUrl, authToken, userId } = data;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
    'X-Trace-ID': `load_test_${Date.now()}_${__VU}_${__ITER}`
  };

  // Simulate voice session workflow
  const sessionStart = Date.now();

  try {
    // Step 1: Generate voice input (simulate STT)
    const message = testMessages[Math.floor(Math.random() * testMessages.length)];
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    const mode = Math.random() > 0.5 ? 'heart' : 'dating_training';

    // Step 2: Send chat message (simulates voice -> STT -> LLM pipeline)
    const chatStart = Date.now();
    const chatResponse = http.post(`${baseUrl}/api/chat/companion`, JSON.stringify({
      message: message,
      mode: mode,
      scenarioType: mode === 'dating_training' ? scenario : undefined,
      isVoiceInput: true, // Flag to indicate this came from voice
      audioMetadata: {
        duration: Math.random() * 10 + 2, // 2-12 seconds
        format: 'webm',
        sampleRate: 16000
      }
    }), { 
      headers: headers,
      timeout: '30s' 
    });

    const chatEnd = Date.now();
    const chatLatency = chatEnd - chatStart;

    // Check chat response
    const chatSuccess = check(chatResponse, {
      'Chat request successful': (r) => r.status === 200,
      'Chat response has content': (r) => {
        try {
          const body = r.json();
          return body && body.response && body.response.length > 0;
        } catch (e) {
          return false;
        }
      },
      'Chat latency acceptable': (r) => chatLatency < 10000, // 10 seconds max
    });

    if (!chatSuccess || chatResponse.status !== 200) {
      voiceSessionErrors.add(1);
      return;
    }

    // Extract timing metadata from response
    const chatData = chatResponse.json();
    if (chatData.timingMetadata) {
      sttLatency.add(chatData.timingMetadata.sttLatencyMs || 0);
      llmLatency.add(chatData.timingMetadata.aiProcessingMs || 0);
    }

    // Step 3: Simulate TTS request (text -> speech)
    const ttsStart = Date.now();
    const ttsResponse = http.post(`${baseUrl}/api/chat/voice/synthesize`, JSON.stringify({
      text: chatData.response.substring(0, 500), // Limit text length for TTS
      voice: 'nova',
      speed: 1.0
    }), { 
      headers: headers,
      timeout: '15s' 
    });

    const ttsEnd = Date.now();
    const ttsLatency_value = ttsEnd - ttsStart;

    // Check TTS response
    const ttsSuccess = check(ttsResponse, {
      'TTS request successful': (r) => r.status === 200,
      'TTS returns audio': (r) => r.body && r.body.length > 0,
      'TTS latency acceptable': (r) => ttsLatency_value < 5000, // 5 seconds max
    });

    if (!ttsSuccess) {
      voiceSessionErrors.add(1);
    } else {
      ttsLatency.add(ttsLatency_value);
    }

    // Calculate end-to-end latency
    const sessionEnd = Date.now();
    const e2eLatency_value = sessionEnd - sessionStart;
    e2eLatency.add(e2eLatency_value);

    // Step 4: Simulate analytics tracking (optional)
    if (Math.random() < 0.1) { // 10% of requests track analytics
      http.post(`${baseUrl}/api/analytics/voice`, JSON.stringify({
        voiceSessionId: chatData.voiceSessionId || 'test_session',
        sttLatencyMs: chatData.timingMetadata?.sttLatencyMs || Math.floor(Math.random() * 1000),
        aiProcessingMs: chatLatency,
        ttsLatencyMs: ttsLatency_value,
        totalLatencyMs: e2eLatency_value,
        transcriptAccuracy: Math.floor(Math.random() * 20) + 80, // 80-100%
        errorOccurred: !chatSuccess || !ttsSuccess
      }), { 
        headers: headers,
        timeout: '5s' 
      });
    }

    // Add some variation to simulate real user behavior
    sleep(Math.random() * 2 + 0.5); // 0.5-2.5 seconds between requests

  } catch (error) {
    console.error('Voice session error:', error);
    voiceSessionErrors.add(1);
  }
}

// Cleanup function
export function teardown(data) {
  if (data && data.userId && data.authToken) {
    const { baseUrl, authToken, userId } = data;
    
    // Cleanup test user (optional)
    console.log('Cleaning up test user:', userId);
    
    // In production, you might want to clean up test data
    // http.delete(`${baseUrl}/api/admin/test-users/${userId}`, {
    //   headers: { 'Authorization': `Bearer ${authToken}` }
    // });
  }
}