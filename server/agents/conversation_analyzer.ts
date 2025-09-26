import { generateStructuredResponse } from "../openai";

export interface ConversationScores {
  engagement: number; // 1-10
  empathy: number; // 1-10
  flow: number; // 1-10
  confidence: number; // 1-10
  authenticity: number; // 1-10
  overall: number; // 1-10
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export class ConversationAnalyzer {
  async analyzeConversation(
    conversationHistory: any[],
    scenarioType?: string
  ): Promise<ConversationScores> {
    const systemPrompt = `You are an expert conversation analyst for a dating training app. Analyze this conversation and provide detailed scoring.

${scenarioType ? `Scenario: ${scenarioType}` : 'Mode: Heart Mode (AI companion)'}

Conversation: ${JSON.stringify(conversationHistory)}

Score the user's conversation skills (1-10 scale):
- Engagement: How actively they participate and show interest
- Empathy: How well they understand and respond to emotions
- Flow: How smoothly the conversation progresses
- Confidence: How self-assured and comfortable they appear in the conversation
- Authenticity: How genuine and true to themselves they seem
- Overall: General conversation quality

Provide JSON response:
{
  "engagement": number,
  "empathy": number, 
  "flow": number,
  "confidence": number,
  "authenticity": number,
  "overall": number,
  "feedback": "detailed analysis",
  "strengths": ["list of conversation strengths"],
  "improvements": ["specific areas to improve"]
}`;

    try {
      const scores = await generateStructuredResponse<ConversationScores>(
        [{ role: "user", content: "Analyze this conversation" }],
        systemPrompt
      );

      // Ensure scores are within valid range
      scores.engagement = Math.max(1, Math.min(10, scores.engagement));
      scores.empathy = Math.max(1, Math.min(10, scores.empathy));
      scores.flow = Math.max(1, Math.min(10, scores.flow));
      scores.confidence = Math.max(1, Math.min(10, scores.confidence));
      scores.authenticity = Math.max(1, Math.min(10, scores.authenticity));
      scores.overall = Math.max(1, Math.min(10, scores.overall));

      return scores;
    } catch (error) {
      console.error('Conversation analysis error:', error);
      return {
        engagement: 5,
        empathy: 5,
        flow: 5,
        confidence: 5,
        authenticity: 5,
        overall: 5,
        feedback: "Unable to complete detailed analysis. Keep practicing natural conversation!",
        strengths: ["Participating in conversation"],
        improvements: ["Continue practicing active listening", "Ask more open-ended questions"]
      };
    }
  }

  calculateProgressMetrics(recentScores: ConversationScores[]): any {
    if (recentScores.length === 0) {
      return {
        trend: 'stable',
        averageImprovement: 0,
        strongestSkill: 'engagement',
        weakestSkill: 'flow'
      };
    }

    const latest = recentScores[0];
    const previous = recentScores[1] || latest;

    const engagementTrend = latest.engagement - previous.engagement;
    const empathyTrend = latest.empathy - previous.empathy;
    const flowTrend = latest.flow - previous.flow;
    const confidenceTrend = latest.confidence - previous.confidence;
    const authenticityTrend = latest.authenticity - previous.authenticity;

    const averageImprovement = (engagementTrend + empathyTrend + flowTrend + confidenceTrend + authenticityTrend) / 5;

    // Find strongest and weakest skills
    const skills = {
      engagement: latest.engagement,
      empathy: latest.empathy,
      flow: latest.flow,
      confidence: latest.confidence,
      authenticity: latest.authenticity
    };

    const strongestSkill = Object.keys(skills).reduce((a, b) => 
      skills[a as keyof typeof skills] > skills[b as keyof typeof skills] ? a : b
    );

    const weakestSkill = Object.keys(skills).reduce((a, b) => 
      skills[a as keyof typeof skills] < skills[b as keyof typeof skills] ? a : b
    );

    return {
      trend: averageImprovement > 0.5 ? 'improving' : averageImprovement < -0.5 ? 'declining' : 'stable',
      averageImprovement,
      strongestSkill,
      weakestSkill
    };
  }
}
