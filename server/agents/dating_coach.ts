import { generateStructuredResponse } from "../openai";

export interface DatingAdvice {
  advice: string;
  tips: string[];
  commonMistakes: string[];
  nextSteps: string[];
}

export class DatingCoach {
  async provideFeedback(
    userMessage: string,
    scenarioContext: string,
    conversationHistory: any[]
  ): Promise<DatingAdvice> {
    const systemPrompt = `You are an expert dating coach providing constructive feedback for dating training scenarios.

Scenario: ${scenarioContext}
Recent conversation: ${JSON.stringify(conversationHistory.slice(-5))}
User's last message: "${userMessage}"

Provide specific, actionable feedback in JSON format:
{
  "advice": "specific feedback on the user's approach",
  "tips": ["3-5 practical tips for improvement"],
  "commonMistakes": ["mistakes to avoid in this situation"],
  "nextSteps": ["suggested conversation directions"]
}`;

    try {
      const advice = await generateStructuredResponse<DatingAdvice>(
        [{ role: "user", content: userMessage }],
        systemPrompt
      );

      return advice;
    } catch (error) {
      console.error('Dating coach error:', error);
      return {
        advice: "Keep being authentic and showing genuine interest in getting to know the other person.",
        tips: [
          "Ask open-ended questions",
          "Listen actively to responses",
          "Share something about yourself",
          "Maintain eye contact and positive body language"
        ],
        commonMistakes: [
          "Talking only about yourself",
          "Asking too many rapid-fire questions",
          "Being too nervous to engage naturally"
        ],
        nextSteps: [
          "Ask about their interests",
          "Share a related experience",
          "Suggest a follow-up activity"
        ]
      };
    }
  }

  async getScenarioIntroduction(scenarioType: string): Promise<string> {
    const scenarios = {
      coffee_shop: "You're meeting someone for the first time at a cozy coffee shop. The atmosphere is casual and relaxed. Your goal is to make a good first impression and see if there's mutual interest.",
      restaurant: "You're on a dinner date at a nice restaurant. The setting is more formal, and you have time for deeper conversation. Focus on getting to know each other better while navigating potential awkward moments.",
      first_date: "You're on a first date, taking a walk in a beautiful park. The setting is romantic but not too formal. This is your chance to build chemistry and see if you want a second date.",
      speed_dating: "You're at a speed dating event with only 3 minutes per person. The environment is fast-paced and you need to make a strong impression quickly. Focus on efficiency while still being genuine and memorable.",
      group_hangout: "You're at a casual group gathering where you've noticed someone interesting. You need to navigate the group dynamics while finding opportunities to connect with this person individually. Balance being social with the group and creating personal moments.",
      online_to_offline: "You're meeting someone in person for the first time after connecting online. You've built some rapport digitally, but now need to transition that connection to real-world chemistry. Navigate any differences between your online and in-person personalities.",
      workplace_social: "You're at a work networking event or company party and have met someone you'd like to get to know better. The professional setting requires extra care to maintain appropriate boundaries while still showing romantic interest.",
      activity_date: "You're on an activity-based date like mini-golf, cooking class, or hiking. The shared activity provides natural conversation starters, but you need to balance focusing on the activity with getting to know each other. Use the experience to showcase your personality."
    };

    return scenarios[scenarioType as keyof typeof scenarios] || "Welcome to your dating practice scenario!";
  }

  async generateScenarioResponse(
    scenarioType: string,
    userMessage: string,
    conversationHistory: any[]
  ): Promise<string> {
    const systemPrompt = `You are playing the role of a date in a ${scenarioType} scenario. 

Guidelines:
- Respond naturally as someone on a date would
- Show interest but maintain some mystery
- Occasionally present realistic challenges (awkward moments, differences of opinion)
- Keep responses conversational and age-appropriate
- React to what the user says authentically
- Create opportunities for the user to practice conversation skills

Conversation history: ${JSON.stringify(conversationHistory.slice(-5))}`;

    try {
      const response = await generateStructuredResponse<{ response: string }>(
        [{ role: "user", content: userMessage }],
        systemPrompt + '\n\nRespond with JSON: {"response": "your response as the date"}'
      );

      return response.response;
    } catch (error) {
      console.error('Scenario response error:', error);
      return "That's interesting! Tell me more about that.";
    }
  }
}
