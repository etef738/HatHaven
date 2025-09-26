export interface SubscriptionInfo {
  tier: 'free' | 'pro' | 'premium';
  status: 'active' | 'expired' | 'cancelled';
  renewalDate?: Date;
  usageStats: {
    conversationsThisMonth: number;
    scenariosThisMonth: number;
    remainingFreeConversations?: number;
  };
}

export class BillingAgent {
  private subscriptionLimits = {
    free: {
      conversationsPerDay: 5,
      scenariosPerWeek: 1,
      features: ['basic_heart_mode', 'basic_progress_tracking']
    },
    pro: {
      conversationsPerDay: -1, // unlimited
      scenariosPerWeek: -1, // unlimited
      features: ['advanced_heart_mode', 'all_scenarios', 'detailed_analytics', 'voice_chat_beta']
    },
    premium: {
      conversationsPerDay: -1, // unlimited
      scenariosPerWeek: -1, // unlimited
      features: ['multiple_personalities', 'custom_scenarios', 'priority_support', 'early_access']
    }
  };

  async checkUsageLimits(userId: string, subscriptionTier: string): Promise<{
    canUseService: boolean;
    limitType?: string;
    upgradeMessage?: string;
  }> {
    const limits = this.subscriptionLimits[subscriptionTier as keyof typeof this.subscriptionLimits];
    
    if (!limits) {
      return {
        canUseService: false,
        limitType: 'invalid_subscription',
        upgradeMessage: 'Please check your subscription status.'
      };
    }

    // For MVP, we'll implement basic checks
    // In production, this would check actual usage from database
    
    if (subscriptionTier === 'free') {
      // Simulate some usage checking
      const dailyUsage = await this.getDailyUsage(userId);
      
      if (dailyUsage >= limits.conversationsPerDay) {
        return {
          canUseService: false,
          limitType: 'daily_conversation_limit',
          upgradeMessage: 'You\'ve reached your daily conversation limit. Upgrade to Pro for unlimited conversations!'
        };
      }
    }

    return { canUseService: true };
  }

  private async getDailyUsage(userId: string): Promise<number> {
    // Simplified implementation - in production would query database
    // for conversations created today
    // For development/testing, return low usage to allow testing
    return 1; // Fixed low usage for development
  }

  getFeatureAvailability(subscriptionTier: string): string[] {
    const limits = this.subscriptionLimits[subscriptionTier as keyof typeof this.subscriptionLimits];
    return limits?.features || [];
  }

  generateUpgradeRecommendation(
    currentTier: string,
    requestedFeature: string
  ): string {
    if (currentTier === 'free') {
      return "Upgrade to Pro to unlock unlimited conversations, all dating scenarios, and detailed performance analytics!";
    } else if (currentTier === 'pro' && 
               (requestedFeature.includes('multiple_personalities') || 
                requestedFeature.includes('custom_scenarios'))) {
      return "Upgrade to Premium for multiple AI personalities, custom scenario creation, and priority support!";
    }

    return "Your current subscription includes access to this feature.";
  }

  async processSubscriptionQuery(query: string, userSubscription: SubscriptionInfo): Promise<string> {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('upgrade') || queryLower.includes('pro') || queryLower.includes('premium')) {
      return this.generateUpgradeRecommendation(userSubscription.tier, query);
    }
    
    if (queryLower.includes('limit') || queryLower.includes('usage')) {
      const remaining = userSubscription.usageStats.remainingFreeConversations;
      if (remaining !== undefined) {
        return `You have ${remaining} free conversations remaining today. Your current tier is ${userSubscription.tier}.`;
      }
      return `Your current ${userSubscription.tier} subscription provides unlimited conversations.`;
    }
    
    if (queryLower.includes('cancel') || queryLower.includes('billing')) {
      return "For billing questions and subscription management, please contact our support team at support@heartandplayground.com";
    }

    return "I can help you with subscription questions, usage limits, and upgrade information. What would you like to know?";
  }
}
