/**
 * K6 Load Testing Configuration
 * Centralized configuration for different load test scenarios
 */

// Base configuration shared across all tests
export const baseConfig = {
  baseUrl: __ENV.BASE_URL || 'http://localhost:5000',
  adminEmail: 'admin@example.com',
  adminPassword: 'password',
};

// Different load test scenarios
export const scenarios = {
  // Smoke test - minimal load
  smoke: {
    stages: [
      { duration: '30s', target: 2 },
      { duration: '1m', target: 2 },
      { duration: '30s', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<3000'],
      http_req_failed: ['rate<0.01'],
    }
  },

  // Load test - normal traffic
  load: {
    stages: [
      { duration: '1m', target: 20 },
      { duration: '3m', target: 20 },
      { duration: '1m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<5000'],
      http_req_failed: ['rate<0.05'],
    }
  },

  // Stress test - high traffic
  stress: {
    stages: [
      { duration: '1m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 100 },
      { duration: '1m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<8000'],
      http_req_failed: ['rate<0.10'],
    }
  },

  // Spike test - sudden traffic spikes
  spike: {
    stages: [
      { duration: '30s', target: 10 },
      { duration: '30s', target: 100 }, // Spike
      { duration: '2m', target: 100 },
      { duration: '30s', target: 10 },
      { duration: '30s', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<10000'],
      http_req_failed: ['rate<0.15'],
    }
  },

  // Volume test - sustained high load (500 concurrent users as requested)
  volume: {
    stages: [
      { duration: '2m', target: 50 },
      { duration: '3m', target: 200 },
      { duration: '5m', target: 500 },
      { duration: '10m', target: 500 }, // 10 minutes at 500 users
      { duration: '2m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<8000'],
      e2e_voice_latency_ms: ['p(95)<10000'],
      voice_session_errors: ['rate<0.05'],
      http_req_failed: ['rate<0.05'],
    }
  }
};

// Performance targets for different tiers
export const performanceTargets = {
  free: {
    stt_p95: 3000,    // 3 seconds
    llm_p95: 5000,    // 5 seconds  
    tts_p95: 3000,    // 3 seconds
    e2e_p95: 10000,   // 10 seconds
    error_rate: 0.10  // 10%
  },
  premium: {
    stt_p95: 2000,    // 2 seconds
    llm_p95: 3000,    // 3 seconds
    tts_p95: 2000,    // 2 seconds  
    e2e_p95: 8000,    // 8 seconds
    error_rate: 0.05  // 5%
  },
  pro: {
    stt_p95: 1500,    // 1.5 seconds
    llm_p95: 2000,    // 2 seconds
    tts_p95: 1500,    // 1.5 seconds
    e2e_p95: 6000,    // 6 seconds  
    error_rate: 0.02  // 2%
  }
};

// Test data sets
export const testData = {
  messages: [
    "Hello, how are you doing today?",
    "I'm feeling a bit nervous about my upcoming date.",
    "Can you help me practice some conversation starters?", 
    "What would be a good response if someone asks about my hobbies?",
    "I want to work on being more confident when speaking.",
    "How should I handle awkward silences during a conversation?",
    "Can we practice some dating scenarios together?",
    "I'm not sure how to show interest without being too forward.",
    "What are some good questions to ask on a first date?",
    "I tend to get tongue-tied when I'm attracted to someone.",
    "How can I be more engaging in conversations?",
    "I want to practice being more expressive and animated.",
    "Can you help me work on my storytelling skills?",
    "I'm working on being a better listener in conversations.",
    "How do I recover from saying something embarrassing?"
  ],
  
  scenarios: ['coffee_shop', 'restaurant', 'first_date'],
  
  voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  
  modes: ['heart', 'dating_training']
};