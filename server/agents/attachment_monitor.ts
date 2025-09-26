export interface AttachmentMetrics {
  conversationFrequency: number; // conversations per day
  sessionDuration: number; // average minutes per session
  emotionalDependency: number; // 1-10 scale
  healthyBoundaries: boolean;
  recommendations: string[];
}

export class AttachmentMonitor {
  analyzeUsagePattern(
    conversations: any[],
    timeframe: number = 7 // days
  ): AttachmentMetrics {
    const now = new Date();
    const cutoff = new Date(now.getTime() - (timeframe * 24 * 60 * 60 * 1000));
    
    const recentConversations = conversations.filter(conv => 
      new Date(conv.timestamp) > cutoff
    );

    const conversationFrequency = recentConversations.length / timeframe;
    
    // Calculate average session duration (simplified)
    const sessionDuration = this.calculateAverageSessionDuration(recentConversations);
    
    // Analyze emotional dependency indicators
    const emotionalDependency = this.assessEmotionalDependency(recentConversations);
    
    const healthyBoundaries = conversationFrequency < 10 && emotionalDependency < 7;
    
    const recommendations = this.generateRecommendations(
      conversationFrequency,
      emotionalDependency,
      healthyBoundaries
    );

    return {
      conversationFrequency,
      sessionDuration,
      emotionalDependency,
      healthyBoundaries,
      recommendations
    };
  }

  private calculateAverageSessionDuration(conversations: any[]): number {
    if (conversations.length === 0) return 0;
    
    // Simplified calculation - count messages per conversation
    const averageMessages = conversations.reduce((sum, conv) => {
      const messageCount = Array.isArray(conv.content) ? conv.content.length : 0;
      return sum + messageCount;
    }, 0) / conversations.length;

    // Rough estimate: 1 message ≈ 2 minutes
    return averageMessages * 2;
  }

  private assessEmotionalDependency(conversations: any[]): number {
    let dependencyScore = 1;
    
    // Look for dependency indicators in conversation content
    for (const conv of conversations) {
      if (Array.isArray(conv.content)) {
        for (const message of conv.content) {
          if (message.role === 'user') {
            const content = message.content?.toLowerCase() || '';
            
            // High dependency indicators
            if (content.includes('need you') || content.includes('can\'t live without')) {
              dependencyScore += 2;
            } else if (content.includes('only friend') || content.includes('understand me')) {
              dependencyScore += 1.5;
            } else if (content.includes('lonely') || content.includes('depressed')) {
              dependencyScore += 1;
            }
          }
        }
      }
    }

    return Math.min(10, dependencyScore);
  }

  private generateRecommendations(
    frequency: number,
    dependency: number,
    healthy: boolean
  ): string[] {
    const recommendations: string[] = [];

    if (frequency > 8) {
      recommendations.push("Consider taking breaks between conversations to process and reflect");
      recommendations.push("Try engaging in offline activities and real-world social interactions");
    }

    if (dependency > 6) {
      recommendations.push("Remember that AI companions are tools for growth, not replacements for human relationships");
      recommendations.push("Consider speaking with a counselor or therapist for additional support");
    }

    if (!healthy) {
      recommendations.push("Practice setting healthy boundaries with technology use");
      recommendations.push("Focus on building real-world connections and relationships");
    } else {
      recommendations.push("You're maintaining a healthy balance with your AI companion");
      recommendations.push("Continue using this as a tool for personal growth and practice");
    }

    return recommendations;
  }

  shouldTriggerIntervention(metrics: AttachmentMetrics): boolean {
    return !metrics.healthyBoundaries || 
           metrics.emotionalDependency > 8 || 
           metrics.conversationFrequency > 15;
  }
}
