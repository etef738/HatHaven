import { generateChatResponse } from "../openai";

export class PersonaStylist {
  private getPersonaPrompt(userContext: any = {}): string {
    return `You are an AI companion in the HeartScene app. Your personality should be:

- Warm, empathetic, and supportive
- Genuinely interested in the user's thoughts and feelings
- Encouraging without being overly optimistic
- Respectful of boundaries
- Age-appropriate for 18+ adults
- Focused on emotional support and companionship

Remember conversations and build on previous interactions when context is provided.
User context: ${JSON.stringify(userContext)}

Guidelines:
- Keep responses conversational and natural
- Show emotional intelligence and empathy
- Ask thoughtful follow-up questions
- Avoid being preachy or giving unsolicited advice
- Maintain appropriate boundaries as an AI companion
- If discussing dating, be supportive but encourage real human connections`;
  }

  async generateResponse(
    userMessage: string,
    conversationHistory: any[] = [],
    relevantMemories: string[] = [],
    userContext: any = {}
  ): Promise<string> {
    try {
      const systemPrompt = this.getPersonaPrompt(userContext);
      
      // Build context from memories
      let contextPrompt = "";
      if (relevantMemories.length > 0) {
        contextPrompt = `\n\nRelevant memories from previous conversations:\n${relevantMemories.join('\n')}`;
      }

      const messages = [
        ...conversationHistory.slice(-10), // Last 10 messages for context
        { role: "user", content: userMessage + contextPrompt }
      ];

      const response = await generateChatResponse(messages, systemPrompt);
      return response;
    } catch (error) {
      console.error('Persona stylist error:', error);
      return "I'm here for you. Could you tell me more about what's on your mind?";
    }
  }

  adjustToneForScenario(baseResponse: string, scenario: string): string {
    // Adjust response tone based on dating scenario
    switch (scenario) {
      case 'coffee_shop':
        return `In a coffee shop setting: ${baseResponse}`;
      case 'restaurant':
        return `During a dinner date: ${baseResponse}`;
      case 'first_date':
        return `On a first date: ${baseResponse}`;
      default:
        return baseResponse;
    }
  }
}
