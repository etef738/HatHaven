import { generateStructuredResponse } from "../openai";

export interface AgentDecision {
  selectedAgent: string;
  reason: string;
  priority: number;
}

export class SupervisorAgent {
  async routeRequest(
    userMessage: string,
    mode: 'heart' | 'dating_training',
    conversationHistory: any[]
  ): Promise<AgentDecision> {
    const systemPrompt = `You are the Supervisor Agent for HeartScene. Your job is to route user requests to the appropriate agent based on the context and mode.

Available agents:
- PersonaStylist: Maintains AI companion personality and voice
- MemoryManager: Handles conversation memory and recall
- SafetyGuardian: Content filtering and safety checks
- DatingCoach: Provides dating advice and guidance
- ConversationAnalyzer: Analyzes conversation performance
- ScenarioDirector: Manages dating practice scenarios
- AttachmentMonitor: Tracks user behavior patterns
- RAGResearcher: Provides context and knowledge
- BillingAgent: Handles subscription-related queries
- AnalyticsCollector: Collects usage metrics
- RedTeamAgent: Tests for safety vulnerabilities

Mode: ${mode}
User message: "${userMessage}"

Respond with JSON in this format:
{
  "selectedAgent": "agent_name",
  "reason": "explanation for selection",
  "priority": 1-10
}`;

    try {
      const decision = await generateStructuredResponse<AgentDecision>(
        [{ role: "user", content: userMessage }],
        systemPrompt
      );

      return decision;
    } catch (error) {
      console.error('Supervisor routing error:', error);
      // Default fallback
      return {
        selectedAgent: mode === 'heart' ? 'PersonaStylist' : 'DatingCoach',
        reason: 'Fallback due to routing error',
        priority: 5
      };
    }
  }
}
