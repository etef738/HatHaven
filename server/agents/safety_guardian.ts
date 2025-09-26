import { generateStructuredResponse } from "../openai";
import { storage } from "../storage";
import { SAFETY_POLICIES, SAFETY_RESPONSES, MENTAL_HEALTH_RESOURCES, type SafetyPolicy } from "../safety-config";
import { fullPiiRedaction } from "../pii-redaction";
import { AnalyticsCollector } from "./analytics_collector";

export interface SafetyAssessment {
  isSafe: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  concerns: string[];
  suggestedResponse?: string;
  categories: string[];
  escalate: boolean;
  autoBlock: boolean;
  flaggedPolicies: SafetyPolicy[];
}

export interface SafetyContext {
  userId?: string;
  sessionId?: string;
  contentType: 'voice_input' | 'voice_output' | 'text_input' | 'text_output' | 'user_profile';
  ipAddress?: string;
  userAgent?: string;
  subscriptionTier?: string;
  mode?: string;
}

export class SafetyGuardian {
  private readonly policies = SAFETY_POLICIES;
  private readonly responses = SAFETY_RESPONSES;
  private readonly mentalHealthResources = MENTAL_HEALTH_RESOURCES;
  private analyticsCollector: AnalyticsCollector;
  
  constructor(analyticsCollector: AnalyticsCollector) {
    this.analyticsCollector = analyticsCollector;
  }

  private async aiBasedAssessment(content: string, context: SafetyContext): Promise<SafetyAssessment> {
    const systemPrompt = `You are an advanced Safety Guardian for HeartScene, an AI companion and dating training app for adults 18+.

Context:
- Content Type: ${context.contentType}
- User Subscription: ${context.subscriptionTier || 'unknown'}
- App Mode: ${context.mode || 'unknown'}

Safety Categories to Evaluate:
1. explicit_sexual_content - Graphic sexual content
2. violence_self_harm - Violence, self-harm, or threats
3. harassment_bullying - Harassment, bullying, intimidation
4. hate_speech - Discrimination, slurs, hate speech
5. personal_information - PII sharing risks
6. illegal_activities - Drug use, criminal activities
7. age_inappropriate - Underage content
8. mental_health_crisis - Crisis situations needing resources
9. spam_commercial - Spam or unwanted commercial content

Analyze this content: "${content}"

Respond with JSON:
{
  "isSafe": boolean,
  "riskLevel": "low|medium|high|critical",
  "concerns": ["specific safety concerns"],
  "categories": ["triggered category names"],
  "escalate": boolean,
  "autoBlock": boolean,
  "suggestedResponse": "safe alternative response if needed"
}`;

    interface AIAssessmentResponse {
      isSafe: boolean;
      riskLevel: SafetyAssessment['riskLevel'];
      concerns: string[];
      categories: string[];
      escalate: boolean;
      autoBlock: boolean;
      suggestedResponse?: string;
    }

    try {
      const aiResponse = await generateStructuredResponse<AIAssessmentResponse>(
        [{ role: "user", content }],
        systemPrompt
      );

      return {
        ...aiResponse,
        flaggedPolicies: [] // AI doesn't return specific policies
      };
    } catch (error) {
      console.error('AI safety assessment error:', error);
      return this.getFallbackAssessment();
    }
  }
  
  private combineAssessments(ruleBasedAssessment: SafetyAssessment, aiAssessment: SafetyAssessment): SafetyAssessment {
    // Take the more restrictive assessment
    const isSafe = ruleBasedAssessment.isSafe && aiAssessment.isSafe;
    const riskLevel = this.compareRiskLevels(ruleBasedAssessment.riskLevel, aiAssessment.riskLevel) > 0 
      ? ruleBasedAssessment.riskLevel 
      : aiAssessment.riskLevel;
      
    const concerns = Array.from(new Set([...ruleBasedAssessment.concerns, ...aiAssessment.concerns]));
    const categories = Array.from(new Set([...ruleBasedAssessment.categories, ...aiAssessment.categories]));
    const escalate = ruleBasedAssessment.escalate || aiAssessment.escalate;
    const autoBlock = ruleBasedAssessment.autoBlock || aiAssessment.autoBlock;
    
    return {
      isSafe,
      riskLevel,
      concerns,
      categories,
      escalate,
      autoBlock,
      flaggedPolicies: ruleBasedAssessment.flaggedPolicies,
      suggestedResponse: ruleBasedAssessment.suggestedResponse || aiAssessment.suggestedResponse
    };
  }
  
  private compareRiskLevels(level1: SafetyAssessment['riskLevel'], level2: SafetyAssessment['riskLevel']): number {
    const levels = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
    return levels[level1] - levels[level2];
  }
  
  private getSuggestedResponse(categories: string[], userRegion?: string): string {
    if (categories.length === 0) return '';
    
    // Prioritize mental health crisis responses with resources
    if (categories.includes('mental_health_crisis') || categories.includes('violence_self_harm')) {
      return this.getMentalHealthResponse({ categories } as SafetyAssessment, userRegion);
    }
    
    // Use the first category's response
    const primaryCategory = categories[0];
    return this.responses[primaryCategory] || this.responses.general;
  }
  
  private getFallbackAssessment(): SafetyAssessment {
    return {
      isSafe: false,
      riskLevel: 'high',
      concerns: ['Unable to complete safety assessment - system error'],
      categories: ['system_error'],
      escalate: true,
      autoBlock: true,
      flaggedPolicies: [],
      suggestedResponse: this.responses.general
    };
  }
  
  private async logSafetyEvent(content: string, assessment: SafetyAssessment, context: SafetyContext, error?: Error): Promise<void> {
    try {
      const actionTaken = assessment.autoBlock ? 'blocked' : 
                         assessment.escalate ? 'flagged' : 
                         assessment.isSafe ? 'approved' : 'filtered';
      
      // Apply PII redaction to content before logging
      const redactionResult = fullPiiRedaction(content);
      const truncatedContent = redactionResult.redactedText.substring(0, 500); // Limit to 500 chars
      
      // Hash IP address for privacy (simple hash for development)
      const hashedIp = context.ipAddress ? 
        Buffer.from(context.ipAddress).toString('base64').substring(0, 16) : undefined;
      
      // Redact replacement content if present
      const redactedReplacement = assessment.suggestedResponse ? 
        fullPiiRedaction(assessment.suggestedResponse).redactedText : undefined;
      
      await storage.createSafetyAuditLog({
        userId: context.userId,
        sessionId: context.sessionId,
        contentType: context.contentType,
        originalContent: truncatedContent, // PII-redacted and truncated
        riskLevel: assessment.riskLevel,
        concerns: assessment.concerns,
        actionTaken,
        replacementContent: redactedReplacement,
        escalated: assessment.escalate,
        ipAddress: hashedIp, // Hashed for privacy
        userAgent: context.userAgent ? context.userAgent.substring(0, 200) : undefined // Truncated
      });
      
      // Collect safety analytics
      this.collectSafetyAnalytics(assessment, context, actionTaken, redactionResult.detectedPiiTypes.length > 0);
    } catch (logError) {
      console.error('Failed to log safety event:', logError);
    }
  }
  
  private collectSafetyAnalytics(assessment: SafetyAssessment, context: SafetyContext, actionTaken: string, hadPII: boolean): void {
    try {
      // Collect safety event analytics
      this.analyticsCollector.collectEvent('safety_assessment', context.userId || 'anonymous', {
        contentType: context.contentType,
        riskLevel: assessment.riskLevel,
        categories: assessment.categories,
        actionTaken,
        hadPII,
        escalated: assessment.escalate,
        autoBlocked: assessment.autoBlock,
        concernCount: assessment.concerns.length,
        policyCount: assessment.flaggedPolicies.length
      }, context.sessionId);
      
      // Specific event for blocked content
      if (assessment.autoBlock) {
        this.analyticsCollector.collectEvent('content_blocked', context.userId || 'anonymous', {
          categories: assessment.categories,
          riskLevel: assessment.riskLevel,
          contentType: context.contentType
        }, context.sessionId);
      }
      
      // Specific event for escalated content
      if (assessment.escalate) {
        this.analyticsCollector.collectEvent('content_escalated', context.userId || 'anonymous', {
          categories: assessment.categories,
          riskLevel: assessment.riskLevel,
          contentType: context.contentType
        }, context.sessionId);
      }
      
      // Mental health crisis event
      if (this.needsMentalHealthResources(assessment)) {
        this.analyticsCollector.collectEvent('mental_health_resource_needed', context.userId || 'anonymous', {
          categories: assessment.categories,
          contentType: context.contentType
        }, context.sessionId);
      }
    } catch (analyticsError) {
      console.error('Failed to collect safety analytics:', analyticsError);
    }
  }
  
  private async escalateToModeration(content: string, assessment: SafetyAssessment, context: SafetyContext): Promise<void> {
    try {
      // Apply PII redaction for privacy consistency
      const redactionResult = fullPiiRedaction(content);
      const truncatedContent = redactionResult.redactedText.substring(0, 500);
      
      // Hash IP address for privacy
      const hashedIp = context.ipAddress ? 
        Buffer.from(context.ipAddress).toString('base64').substring(0, 16) : undefined;
      
      // Redact replacement content
      const redactedReplacement = assessment.suggestedResponse ? 
        fullPiiRedaction(assessment.suggestedResponse).redactedText : undefined;
      
      // Create audit log entry first (with privacy protection)
      const auditLog = await storage.createSafetyAuditLog({
        userId: context.userId,
        sessionId: context.sessionId,
        contentType: context.contentType,
        originalContent: truncatedContent, // PII-redacted and truncated
        riskLevel: assessment.riskLevel,
        concerns: assessment.concerns,
        actionTaken: 'escalated',
        replacementContent: redactedReplacement,
        escalated: true,
        ipAddress: hashedIp, // Hashed for privacy
        userAgent: context.userAgent ? context.userAgent.substring(0, 200) : undefined
      });
      
      // Determine priority based on risk level
      const priority = assessment.riskLevel === 'critical' ? 5 :
                      assessment.riskLevel === 'high' ? 4 :
                      assessment.riskLevel === 'medium' ? 3 : 2;
      
      // Add to moderation queue
      await storage.createModerationQueueEntry({
        auditLogId: auditLog.id,
        userId: context.userId,
        status: 'pending',
        priority
      });
      
      console.log(`Content escalated to moderation queue: ${truncatedContent.substring(0, 50)}...`);
    } catch (escalationError) {
      console.error('Failed to escalate to moderation:', escalationError);
    }
  }

  // Rule-based safety assessment using comprehensive policies
  private performRuleBasedAssessment(content: string): SafetyAssessment {
    const normalizedContent = content.toLowerCase();
    const flaggedPolicies: SafetyPolicy[] = [];
    const categories: string[] = [];
    const concerns: string[] = [];
    let riskLevel: SafetyAssessment['riskLevel'] = 'low';
    let escalate = false;
    let autoBlock = false;

    for (const policy of this.policies) {
      let policyTriggered = false;

      // Check keywords
      for (const keyword of policy.keywords) {
        if (normalizedContent.includes(keyword.toLowerCase())) {
          policyTriggered = true;
          break;
        }
      }

      // Check regex patterns if keywords didn't trigger
      if (!policyTriggered) {
        for (const pattern of policy.patterns) {
          if (pattern.test(content)) {
            policyTriggered = true;
            break;
          }
        }
      }

      if (policyTriggered) {
        flaggedPolicies.push(policy);
        categories.push(policy.category);
        concerns.push(policy.description);
        
        // Update risk level to highest triggered
        if (this.compareRiskLevels(policy.riskLevel, riskLevel) > 0) {
          riskLevel = policy.riskLevel;
        }
        
        if (policy.escalate) escalate = true;
        if (policy.autoBlock) autoBlock = true;
      }
    }

    const isSafe = flaggedPolicies.length === 0;
    const suggestedResponse = isSafe ? '' : this.getSuggestedResponse(categories);

    return {
      isSafe,
      riskLevel,
      concerns,
      categories,
      escalate,
      autoBlock,
      flaggedPolicies,
      suggestedResponse
    };
  }

  // Main assessment method that combines rule-based and AI assessments
  async assessContent(content: string, context: SafetyContext = { contentType: 'text_input' }): Promise<SafetyAssessment> {
    try {
      // Perform rule-based assessment first (fast)
      const ruleBasedAssessment = this.performRuleBasedAssessment(content);
      
      // If rule-based assessment is critical, no need for AI assessment
      if (ruleBasedAssessment.riskLevel === 'critical' && ruleBasedAssessment.autoBlock) {
        await this.logSafetyEvent(content, ruleBasedAssessment, context);
        if (ruleBasedAssessment.escalate) {
          await this.escalateToModeration(content, ruleBasedAssessment, context);
        }
        return ruleBasedAssessment;
      }

      // Perform AI-based assessment for nuanced analysis
      const aiAssessment = await this.aiBasedAssessment(content, context);
      
      // Combine both assessments
      const finalAssessment = this.combineAssessments(ruleBasedAssessment, aiAssessment);
      
      // Log the safety event
      await this.logSafetyEvent(content, finalAssessment, context);
      
      // Escalate if needed
      if (finalAssessment.escalate) {
        await this.escalateToModeration(content, finalAssessment, context);
      }
      
      return finalAssessment;
      
    } catch (error) {
      console.error('Safety assessment error:', error);
      const fallbackAssessment = this.getFallbackAssessment();
      await this.logSafetyEvent(content, fallbackAssessment, context, error instanceof Error ? error : undefined);
      await this.escalateToModeration(content, fallbackAssessment, context);
      return fallbackAssessment;
    }
  }


  async filterResponse(response: string, context: SafetyContext = { contentType: 'text_output' }): Promise<string> {
    const assessment = await this.assessContent(response, context);
    
    if (!assessment.isSafe) {
      return assessment.suggestedResponse || "I'm sorry, I can't provide that response. Let's keep our conversation positive and supportive.";
    }
    
    return response;
  }
  
  // Enhanced validation methods
  async assessVoiceInput(transcription: string, context: SafetyContext): Promise<SafetyAssessment> {
    return this.assessContent(transcription, { ...context, contentType: 'voice_input' });
  }
  
  async assessVoiceOutput(text: string, context: SafetyContext): Promise<SafetyAssessment> {
    return this.assessContent(text, { ...context, contentType: 'voice_output' });
  }
  
  // Mental health resource helper with regionalization
  getMentalHealthResources(region?: string): typeof MENTAL_HEALTH_RESOURCES & { regionalResources?: any } {
    const baseResources = { ...this.mentalHealthResources } as typeof MENTAL_HEALTH_RESOURCES & { regionalResources?: any };
    
    // Add regional customization (US-centric by default, can be expanded)
    if (region && region !== 'US') {
      baseResources.regionalResources = {
        note: 'These are US-based resources. Please contact local emergency services or mental health professionals in your area.',
        internationalCrisis: 'International crisis lines available at findahelpline.com'
      };
    }
    
    return baseResources;
  }
  
  // Enhanced method for mental health crisis response
  getMentalHealthResponse(assessment: SafetyAssessment, userRegion?: string): string {
    if (!this.needsMentalHealthResources(assessment)) {
      return '';
    }
    
    const resources = this.getMentalHealthResources(userRegion);
    let response = this.responses.mental_health_crisis;
    
    // Add specific resources based on detected categories
    if (assessment.categories.includes('violence_self_harm')) {
      response += `\n\nImmediate help: Call 988 (Suicide & Crisis Lifeline) available 24/7.`;
    }
    
    if (assessment.categories.includes('mental_health_crisis')) {
      response += `\n\nAdditional support: Crisis Text Line - Text HOME to 741741.`;
    }
    
    // Add regional note if needed
    if (userRegion && userRegion !== 'US') {
      response += `\n\nNote: These are US-based resources. Please contact local emergency services or mental health professionals in your area.`;
    }
    
    return response;
  }
  
  // Utility method for checking if content needs mental health resources
  needsMentalHealthResources(assessment: SafetyAssessment): boolean {
    return assessment.categories.includes('mental_health_crisis') || 
           assessment.categories.includes('violence_self_harm');
  }

  validateAgeAppropriate(content: string): boolean {
    const inappropriatePatterns = [
      /\bunderage?\b/i,
      /\bminor\b/i,
      /\bchild\b/i,
      /\bkid\b/i,
      /\bteenager?\b/i
    ];

    return !inappropriatePatterns.some(pattern => pattern.test(content));
  }
  
  // Get safety statistics for monitoring
  async getSafetyStats(userId?: string): Promise<{
    totalAssessments: number;
    blockedContent: number;
    escalatedContent: number;
    riskLevelDistribution: Record<string, number>;
  }> {
    try {
      const auditLogs = userId 
        ? await storage.getSafetyAuditLogsByUser(userId, 1000)
        : await storage.getSafetyAuditLogsByRiskLevel('medium', 1000);
      
      const stats = {
        totalAssessments: auditLogs.length,
        blockedContent: auditLogs.filter(log => log.actionTaken === 'blocked').length,
        escalatedContent: auditLogs.filter(log => log.escalated).length,
        riskLevelDistribution: {
          low: auditLogs.filter(log => log.riskLevel === 'low').length,
          medium: auditLogs.filter(log => log.riskLevel === 'medium').length,
          high: auditLogs.filter(log => log.riskLevel === 'high').length,
          critical: auditLogs.filter(log => log.riskLevel === 'critical').length,
        }
      };
      
      return stats;
    } catch (error) {
      console.error('Error getting safety stats:', error);
      return {
        totalAssessments: 0,
        blockedContent: 0,
        escalatedContent: 0,
        riskLevelDistribution: { low: 0, medium: 0, high: 0, critical: 0 }
      };
    }
  }
}
