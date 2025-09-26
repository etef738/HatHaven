import { generateChatResponse } from "../openai";

export class RAGResearcher {
  private knowledgeBase = {
    dating_tips: [
      "Active listening is one of the most attractive qualities on a date",
      "Ask open-ended questions to keep conversations flowing naturally",
      "Show genuine interest in their hobbies and passions",
      "Be yourself rather than trying to impress with false personas",
      "Good conversation is a balance of asking questions and sharing about yourself"
    ],
    conversation_starters: [
      "What's something you've been excited about lately?",
      "What's the best part of your day usually?",
      "If you could travel anywhere right now, where would you go?",
      "What's something you're passionate about that people might not expect?",
      "What's a skill you'd love to learn?"
    ],
    relationship_advice: [
      "Healthy relationships require mutual respect and communication",
      "It's important to maintain your own identity and interests",
      "Trust and honesty form the foundation of lasting relationships",
      "Conflict is normal, but how you handle it matters",
      "Personal growth continues throughout healthy relationships"
    ],
    red_flags: [
      "Pressuring for personal information too quickly",
      "Dismissive or disrespectful behavior",
      "Excessive negativity or complaining",
      "Unwillingness to answer reasonable questions",
      "Making inappropriate comments or suggestions"
    ]
  };

  async researchTopic(topic: string, context?: string): Promise<string> {
    const relevantInfo = this.findRelevantInformation(topic);
    
    if (relevantInfo.length === 0) {
      return "I don't have specific information about that topic, but I'm here to help with dating and relationship conversations.";
    }

    try {
      const systemPrompt = `You are a knowledgeable relationship and dating expert. Using the provided information, give helpful, practical advice.

Available information: ${relevantInfo.join('\n')}
User question/context: ${topic}
${context ? `Additional context: ${context}` : ''}

Provide helpful, actionable advice while being supportive and encouraging.`;

      const response = await generateChatResponse(
        [{ role: "user", content: topic }],
        systemPrompt
      );

      return response;
    } catch (error) {
      console.error('RAG research error:', error);
      return "Here's what I know: " + relevantInfo.slice(0, 2).join(' ');
    }
  }

  private findRelevantInformation(query: string): string[] {
    const queryLower = query.toLowerCase();
    const relevant: string[] = [];

    // Search through knowledge base
    Object.entries(this.knowledgeBase).forEach(([category, items]) => {
      if (queryLower.includes(category.replace('_', ' ')) || 
          category.split('_').some(word => queryLower.includes(word))) {
        relevant.push(...items);
      } else {
        // Check individual items for relevance
        items.forEach(item => {
          const itemWords = item.toLowerCase().split(' ');
          const queryWords = queryLower.split(' ');
          
          if (queryWords.some(word => itemWords.includes(word) && word.length > 3)) {
            relevant.push(item);
          }
        });
      }
    });

    return Array.from(new Set(relevant)); // Remove duplicates
  }

  getScenarioSpecificAdvice(scenarioType: string): string[] {
    const scenarioAdvice = {
      coffee_shop: [
        "Coffee shop dates are casual, so keep the conversation light and fun",
        "It's okay to have some comfortable silences while sipping your drinks",
        "Ask about their coffee preferences - it's an easy conversation starter",
        "Keep the first meeting short (30-60 minutes) to leave them wanting more"
      ],
      restaurant: [
        "Let them order first and be considerate about timing",
        "Don't be afraid to ask for recommendations if you're unsure about the menu",
        "Table etiquette matters - put your phone away and focus on them",
        "Offer to split the bill, but be prepared to pay if they prefer"
      ],
      first_date: [
        "First date nerves are normal - acknowledge them with humor if appropriate",
        "Focus on having fun rather than trying to be perfect",
        "End the date when you're both still having a good time",
        "Be clear about your interest in a second date if you feel a connection"
      ]
    };

    return scenarioAdvice[scenarioType as keyof typeof scenarioAdvice] || [];
  }
}
