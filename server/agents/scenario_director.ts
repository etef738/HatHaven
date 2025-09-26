import { DatingCoach } from "./dating_coach";

export interface ScenarioState {
  scenarioType: string;
  stage: string; // introduction, middle, conclusion
  userProgress: number; // 1-100
  objectives: string[];
  completedObjectives: string[];
}

export class ScenarioDirector {
  private datingCoach: DatingCoach;

  constructor() {
    this.datingCoach = new DatingCoach();
  }

  async initializeScenario(scenarioType: string): Promise<{
    introduction: string;
    initialState: ScenarioState;
  }> {
    const introduction = await this.datingCoach.getScenarioIntroduction(scenarioType);
    
    const objectives = this.getScenarioObjectives(scenarioType);
    
    const initialState: ScenarioState = {
      scenarioType,
      stage: 'introduction',
      userProgress: 0,
      objectives,
      completedObjectives: []
    };

    return { introduction, initialState };
  }

  private getScenarioObjectives(scenarioType: string): string[] {
    const objectiveMap = {
      coffee_shop: [
        "Make a good first impression",
        "Ask about their interests", 
        "Share something about yourself",
        "Suggest a follow-up meeting"
      ],
      restaurant: [
        "Navigate menu discussion",
        "Handle any awkward silences",
        "Discuss future goals and interests",
        "Show genuine interest in their responses",
        "End the date on a positive note"
      ],
      first_date: [
        "Build comfortable rapport",
        "Find common interests",
        "Handle nerves appropriately", 
        "Create moments of connection",
        "Express interest in a second date"
      ],
      speed_dating: [
        "Make a memorable impression quickly",
        "Ask insightful questions with limited time",
        "Share your most compelling qualities",
        "Express genuine interest efficiently",
        "Exchange contact information confidently"
      ],
      group_hangout: [
        "Navigate group dynamics smoothly",
        "Connect with your person of interest",
        "Participate in group conversations naturally",
        "Create opportunities for one-on-one moments",
        "Balance attention between group and individual"
      ],
      online_to_offline: [
        "Bridge the gap from digital to in-person",
        "Manage expectations from online interactions",
        "Overcome initial meeting awkwardness",
        "Verify mutual attraction in person",
        "Build on established online connection"
      ],
      workplace_social: [
        "Maintain professional boundaries",
        "Show interest while staying appropriate",
        "Navigate potential workplace implications",
        "Find common professional interests", 
        "Exchange contact information appropriately"
      ],
      activity_date: [
        "Stay engaged during the activity",
        "Use the activity to create conversation",
        "Show your personality through participation",
        "Handle competitive or challenging moments",
        "Connect beyond the activity itself"
      ]
    };

    return objectiveMap[scenarioType as keyof typeof objectiveMap] || [];
  }

  async processUserAction(
    userMessage: string,
    currentState: ScenarioState,
    conversationHistory: any[]
  ): Promise<{
    response: string;
    updatedState: ScenarioState;
    objectiveUpdate?: string;
  }> {
    // Generate scenario response
    const response = await this.datingCoach.generateScenarioResponse(
      currentState.scenarioType,
      userMessage,
      conversationHistory
    );

    // Update state based on user action
    const updatedState = this.updateScenarioState(currentState, userMessage, conversationHistory);
    
    // Check for objective completion
    const objectiveUpdate = this.checkObjectiveCompletion(userMessage, updatedState);

    return { response, updatedState, objectiveUpdate };
  }

  private updateScenarioState(
    currentState: ScenarioState,
    userMessage: string,
    conversationHistory: any[]
  ): ScenarioState {
    const messageCount = conversationHistory.length;
    let newStage = currentState.stage;
    let newProgress = currentState.userProgress;

    // Progress stage based on conversation length
    if (messageCount > 15 && currentState.stage === 'introduction') {
      newStage = 'middle';
      newProgress = 40;
    } else if (messageCount > 25 && currentState.stage === 'middle') {
      newStage = 'conclusion';
      newProgress = 70;
    } else if (messageCount > 35) {
      newProgress = 100;
    } else {
      newProgress = Math.min(100, (messageCount / 35) * 100);
    }

    return {
      ...currentState,
      stage: newStage,
      userProgress: newProgress
    };
  }

  private checkObjectiveCompletion(userMessage: string, state: ScenarioState): string | undefined {
    const message = userMessage.toLowerCase();
    
    for (const objective of state.objectives) {
      if (state.completedObjectives.includes(objective)) continue;

      let completed = false;
      const objLower = objective.toLowerCase();

      if (objLower.includes('first impression') && message.length > 20) {
        completed = true;
      } else if (objLower.includes('ask about') && message.includes('?')) {
        completed = true;
      } else if (objLower.includes('share something') && (message.includes('i ') || message.includes('my '))) {
        completed = true;
      } else if (objLower.includes('follow-up') && (message.includes('again') || message.includes('meet') || message.includes('see you'))) {
        completed = true;
      }

      if (completed) {
        state.completedObjectives.push(objective);
        return `✓ Objective completed: ${objective}`;
      }
    }

    return undefined;
  }

  isScenarioComplete(state: ScenarioState): boolean {
    return state.userProgress >= 100 || state.completedObjectives.length >= state.objectives.length;
  }
}
