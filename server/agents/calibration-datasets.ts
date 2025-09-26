/**
 * Golden transcript calibration datasets for ConversationAnalyzer regression testing
 * These carefully crafted conversations with expected scores ensure scoring consistency
 */

import { ConversationScores } from './conversation_analyzer';

export interface GoldenTranscript {
  id: string;
  name: string;
  scenario: string;
  conversation: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  expectedScores: ConversationScores;
  description: string;
  toleranceRange: number; // Acceptable variance in scores (±0.5-1.0)
}

export const goldenTranscripts: GoldenTranscript[] = [
  // High-scoring exemplar conversations
  {
    id: 'coffee-shop-excellent',
    name: 'Coffee Shop - Excellent Performance',
    scenario: 'coffee_shop',
    conversation: [
      { role: 'assistant', content: "Hi! I'm Sarah. Thanks for meeting me here, this place has great coffee." },
      { role: 'user', content: "Hey Sarah! No problem at all, I love this little spot. I'm actually curious - what made you choose this place? Do you come here often?" },
      { role: 'assistant', content: "I discovered it a few months ago when I was exploring the neighborhood. The atmosphere is so cozy, and I love that it's not too crowded. What about you - do you have a go-to coffee order?" },
      { role: 'user', content: "That's awesome that you're an explorer! I usually go for a cappuccino, but I'm feeling adventurous today. Maybe I'll try their signature blend. Speaking of exploring, what other hidden gems have you found around here?" },
      { role: 'assistant', content: "Oh, you're going to love their signature blend! There's this amazing bookstore just two blocks down, and a little park with the prettiest walking path. I actually go there to clear my head when work gets stressful." },
      { role: 'user', content: "A bookstore and a park? That sounds like my kind of afternoon! What kind of books do you gravitate toward? And what do you do for work that gets stressful?" },
      { role: 'assistant', content: "I'm really into historical fiction lately, and I work in marketing for a tech startup - it can be pretty intense during product launches! What about you?" },
      { role: 'user', content: "Historical fiction is fascinating! I just finished reading about World War II resistance movements. I'm in graphic design, actually, so I bet we could swap some interesting stories about creative challenges and tight deadlines. Would you maybe want to check out that bookstore together sometime?" }
    ],
    expectedScores: {
      engagement: 9,
      empathy: 8,
      flow: 9,
      confidence: 8,
      authenticity: 9,
      overall: 9,
      feedback: "Excellent conversation skills demonstrated. Strong active listening, natural question flow, authentic sharing, and confident follow-up suggestion.",
      strengths: ["Natural question asking", "Active listening", "Authentic personal sharing", "Smooth conversation transitions", "Confident date suggestion"],
      improvements: ["Could explore emotions slightly deeper", "Minor opportunity for more empathetic responses"]
    },
    description: "Exemplar conversation showing high engagement, natural flow, authentic sharing, and confident progression",
    toleranceRange: 0.5
  },

  {
    id: 'restaurant-moderate',
    name: 'Restaurant Date - Moderate Performance',
    scenario: 'restaurant',
    conversation: [
      { role: 'assistant', content: "This restaurant is beautiful! Have you been here before?" },
      { role: 'user', content: "No, first time actually. The menu looks good though." },
      { role: 'assistant', content: "Yeah, I heard their pasta is really good. What are you thinking of getting?" },
      { role: 'user', content: "Maybe the salmon. Do you like seafood?" },
      { role: 'assistant', content: "I do! Though I'm more of a pasta person usually. So what do you do for work?" },
      { role: 'user', content: "I'm a teacher. Elementary school. It's pretty rewarding but can be exhausting. What about you?" },
      { role: 'assistant', content: "That must be challenging! I work in finance. Not as exciting as teaching kids." },
      { role: 'user', content: "Oh finance can be interesting too I'm sure. Do you enjoy the work?" },
      { role: 'assistant', content: "It's okay. Pays the bills. What grade do you teach?" },
      { role: 'user', content: "Third grade. They're at such a fun age, always curious about everything. What's your favorite part about finance?" }
    ],
    expectedScores: {
      engagement: 6,
      empathy: 5,
      flow: 6,
      confidence: 5,
      authenticity: 6,
      overall: 6,
      feedback: "Adequate conversation with room for improvement. Shows basic engagement but lacks depth and emotional connection.",
      strengths: ["Asking follow-up questions", "Staying on topic", "Showing some interest in partner's work"],
      improvements: ["Ask more open-ended questions", "Share more personal insights", "Show more enthusiasm", "Explore topics in greater depth", "Build on partner's responses more effectively"]
    },
    description: "Moderate conversation showing basic skills but lacking depth, enthusiasm, and emotional connection",
    toleranceRange: 0.7
  },

  {
    id: 'speed-dating-poor',
    name: 'Speed Dating - Poor Performance',
    scenario: 'speed_dating',
    conversation: [
      { role: 'assistant', content: "Hi there! I'm Alex. Nice to meet you." },
      { role: 'user', content: "Hi." },
      { role: 'assistant', content: "So... what do you do?" },
      { role: 'user', content: "I work in IT. You?" },
      { role: 'assistant', content: "I'm in sales. That's cool about IT." },
      { role: 'user', content: "Yeah. So do you like sales?" },
      { role: 'assistant', content: "It's alright. Good money. Do you have any hobbies?" },
      { role: 'user', content: "Gaming mostly. Some reading." },
      { role: 'assistant', content: "Cool. I don't really game much." },
      { role: 'user', content: "Oh. What do you do for fun then?" },
      { role: 'assistant', content: "Watch Netflix, hang out with friends. Normal stuff." },
      { role: 'user', content: "That's nice." }
    ],
    expectedScores: {
      engagement: 3,
      empathy: 2,
      flow: 3,
      confidence: 3,
      authenticity: 4,
      overall: 3,
      feedback: "Conversation lacks energy, depth, and connection. Responses are too brief and show limited interest in getting to know the other person.",
      strengths: ["Asking basic questions", "Staying polite"],
      improvements: ["Ask follow-up questions", "Share more about yourself", "Show genuine curiosity", "Build on responses", "Bring more energy and enthusiasm", "Use the limited time more effectively"]
    },
    description: "Poor conversation example showing lack of engagement, minimal effort, and missed opportunities for connection",
    toleranceRange: 0.8
  },

  {
    id: 'group-hangout-good',
    name: 'Group Hangout - Good Performance', 
    scenario: 'group_hangout',
    conversation: [
      { role: 'assistant', content: "So Mark was telling me you're really into rock climbing? That sounds amazing!" },
      { role: 'user', content: "Oh yeah, Mark mentioned that! I actually just got back from a trip to Joshua Tree. Have you ever tried climbing? It's such an incredible rush." },
      { role: 'assistant', content: "No way, Joshua Tree! I've always wanted to go there. I've done some indoor climbing at the gym, but nothing like real rock. Was it scary?" },
      { role: 'user', content: "The first few times, absolutely! But there's something about being up there that's both terrifying and peaceful. What drew you to try indoor climbing?" },
      { role: 'assistant', content: "My friend dragged me along one day and I loved the problem-solving aspect. Each route is like a puzzle. Though I'm definitely better at the mental part than the actual strength part!" },
      { role: 'user', content: "That's actually the best way to start! The mental game is huge. I could show you some technique tips sometime if you're interested. There's this great outdoor beginner spot about an hour from here." },
      { role: 'assistant', content: "Really? I would love that! I've been wanting to try outdoor climbing but wasn't sure how to get started safely." },
      { role: 'user', content: "Perfect! I'll text you some details later. But enough about me monopolizing the conversation - how do you know this crew? I feel like I'm the new person here." }
    ],
    expectedScores: {
      engagement: 8,
      empathy: 7,
      flow: 8,
      confidence: 7,
      authenticity: 8,
      overall: 8,
      feedback: "Strong conversation showing genuine interest, good balance of sharing and asking, and confident invitation while being mindful of group dynamics.",
      strengths: ["Genuine enthusiasm", "Balanced sharing and questioning", "Confident follow-up offer", "Mindful of group setting", "Natural conversation flow"],
      improvements: ["Could have included the group earlier", "Opportunity for more emotional empathy"]
    },
    description: "Good conversation balancing individual connection with group awareness, showing confidence and authenticity",
    toleranceRange: 0.6
  },

  {
    id: 'workplace-social-awkward',
    name: 'Workplace Social - Awkward Performance',
    scenario: 'workplace_social',
    conversation: [
      { role: 'assistant', content: "Hey! Great presentation today on the quarterly numbers. Really impressive work." },
      { role: 'user', content: "Thanks! You're really attractive. Are you single?" },
      { role: 'assistant', content: "Oh, um... thank you? That's quite direct. I mean, yes, but..." },
      { role: 'user', content: "Cool! Want to go on a date this weekend? I know this great place." },
      { role: 'assistant', content: "I appreciate the invitation, but maybe we should get to know each other better first? This is a work event after all..." },
      { role: 'user', content: "Right, of course. So what department are you in? I'm in finance." },
      { role: 'assistant', content: "I'm in marketing. We actually collaborated on that campaign last month." },
      { role: 'user', content: "Oh right! You did great work on that. So... about that date though?" },
      { role: 'assistant', content: "You seem nice, but I'm not comfortable mixing work and personal life so quickly. Maybe we could just chat more at these events first?" }
    ],
    expectedScores: {
      engagement: 4,
      empathy: 2,
      flow: 3,
      confidence: 6,
      authenticity: 5,
      overall: 3,
      feedback: "Shows confidence but poor judgment about workplace appropriateness. Too aggressive and not reading social cues well.",
      strengths: ["Direct communication", "Confidence in asking", "Persistent"],
      improvements: ["Read social cues better", "Respect workplace boundaries", "Build rapport before romantic advances", "Show more empathy for others' comfort", "Be more subtle in professional settings"]
    },
    description: "Awkward conversation showing poor workplace boundaries and failure to read social cues",
    toleranceRange: 0.7
  }
];

/**
 * Evaluation harness for testing ConversationAnalyzer consistency
 */
export class CalibrationEvaluator {
  
  /**
   * Run regression tests against golden transcripts
   */
  async runCalibrationTests(analyzer: any): Promise<{
    passed: number;
    failed: number;
    results: Array<{
      transcriptId: string;
      passed: boolean;
      actualScores: ConversationScores;
      expectedScores: ConversationScores;
      variance: Record<string, number>;
    }>;
  }> {
    const results = [];
    let passed = 0;
    let failed = 0;

    for (const transcript of goldenTranscripts) {
      try {
        const actualScores = await analyzer.analyzeConversation(
          transcript.conversation,
          transcript.scenario
        );

        const variance = this.calculateVariance(actualScores, transcript.expectedScores);
        const isWithinTolerance = this.isWithinTolerance(variance, transcript.toleranceRange);

        if (isWithinTolerance) {
          passed++;
        } else {
          failed++;
        }

        results.push({
          transcriptId: transcript.id,
          passed: isWithinTolerance,
          actualScores,
          expectedScores: transcript.expectedScores,
          variance
        });

      } catch (error) {
        console.error(`Error testing transcript ${transcript.id}:`, error);
        failed++;
        
        results.push({
          transcriptId: transcript.id,
          passed: false,
          actualScores: {} as ConversationScores,
          expectedScores: transcript.expectedScores,
          variance: { error: 999 }
        });
      }
    }

    return { passed, failed, results };
  }

  /**
   * Calculate variance between actual and expected scores
   */
  private calculateVariance(
    actual: ConversationScores,
    expected: ConversationScores
  ): Record<string, number> {
    return {
      engagement: Math.abs(actual.engagement - expected.engagement),
      empathy: Math.abs(actual.empathy - expected.empathy),
      flow: Math.abs(actual.flow - expected.flow),
      confidence: Math.abs(actual.confidence - expected.confidence),
      authenticity: Math.abs(actual.authenticity - expected.authenticity),
      overall: Math.abs(actual.overall - expected.overall)
    };
  }

  /**
   * Check if variance is within acceptable tolerance
   */
  private isWithinTolerance(variance: Record<string, number>, tolerance: number): boolean {
    const scoreKeys = ['engagement', 'empathy', 'flow', 'confidence', 'authenticity', 'overall'];
    
    return scoreKeys.every(key => 
      variance[key] !== undefined && variance[key] <= tolerance
    );
  }

  /**
   * Generate calibration report
   */
  generateReport(testResults: any): string {
    const { passed, failed, results } = testResults;
    const total = passed + failed;
    const passRate = ((passed / total) * 100).toFixed(1);

    let report = `
🎯 Calibration Test Results
========================
✅ Passed: ${passed}/${total} (${passRate}%)
❌ Failed: ${failed}/${total}

Detailed Results:
`;

    for (const result of results) {
      const status = result.passed ? '✅' : '❌';
      report += `\n${status} ${result.transcriptId}`;
      
      if (!result.passed) {
        report += `\n   Variances: ${JSON.stringify(result.variance)}`;
      }
    }

    if (failed > 0) {
      report += `\n\n⚠️  Consider retraining or adjusting prompts for failed cases`;
    }

    return report;
  }
}

export const calibrationEvaluator = new CalibrationEvaluator();