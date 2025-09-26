import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConversationRadarChart, ConversationProgressComparison, ConversationScoresData } from '@/components/ConversationRadarChart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Heart, 
  Coffee, 
  Utensils, 
  Users, 
  Briefcase, 
  Calendar,
  Clock,
  Target,
  TrendingUp,
  BarChart3,
  Zap
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface DatingSession {
  sessionId: string;
  date: string;
  scenarioType: string;
  scores: ConversationScoresData;
}

interface ProgressData {
  recentSessions: DatingSession[];
  overallProgress: {
    averageImprovement: number;
    strongestSkill: string;
    weakestSkill: string;
    trend: string;
  };
}

const SCENARIO_ICONS: Record<string, any> = {
  coffee_shop: Coffee,
  restaurant: Utensils,
  first_date: Heart,
  speed_dating: Clock,
  group_hangout: Users,
  online_to_offline: Calendar,
  workplace_social: Briefcase,
  activity_date: Target
};

const SCENARIO_NAMES: Record<string, string> = {
  coffee_shop: 'Coffee Shop',
  restaurant: 'Restaurant Date',
  first_date: 'First Date',
  speed_dating: 'Speed Dating',
  group_hangout: 'Group Hangout',
  online_to_offline: 'Online to Offline',
  workplace_social: 'Workplace Social',
  activity_date: 'Activity Date'
};

export default function DatingTrainingDashboard() {
  const [selectedScenario, setSelectedScenario] = useState<string>('coffee_shop');
  const [mockConversation, setMockConversation] = useState<any[]>([]);

  // Fetch user progress data
  const { data: progressData, isLoading: progressLoading, error: progressError } = useQuery({
    queryKey: ['/api/dating/progress'],
    queryFn: async () => {
      const response = await fetch('/api/dating/progress');
      if (!response.ok) throw new Error('Failed to fetch progress');
      return response.json() as Promise<ProgressData>;
    }
  });

  // Mock conversation analyzer
  const analyzeMutation = useMutation({
    mutationFn: async (data: { conversationHistory: any[]; scenarioType: string }) => {
      const response = await apiRequest('/api/dating/analyze', 'POST', data) as unknown;
      return response as {
        scores: ConversationScoresData;
        sessionId: string;
        timestamp: string;
        scenarioType: string;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dating/progress'] });
    }
  });

  const generateMockConversation = (scenario: string) => {
    const mockConversations = {
      coffee_shop: [
        { role: 'assistant', content: "Hi! Thanks for meeting me here. I love this coffee shop!" },
        { role: 'user', content: "Hey! No problem at all. This place does have great ambiance. What's your favorite drink here?" },
        { role: 'assistant', content: "I usually go for their lavender latte - it's unique! What about you, are you a coffee person?" },
        { role: 'user', content: "Ooh, lavender latte sounds interesting! I'm definitely a coffee person, usually just a cappuccino though. I might have to try your recommendation. So what brought you to this neighborhood?" }
      ],
      restaurant: [
        { role: 'assistant', content: "This place is beautiful! Have you been here before?" },
        { role: 'user', content: "First time actually, but I've heard amazing things about their menu. The atmosphere is really nice - feels like the perfect place for a good conversation. What catches your eye on the menu?" },
        { role: 'assistant', content: "I was thinking about the salmon. I love how they have all these creative preparations. Are you much of a foodie?" },
        { role: 'user', content: "The salmon does sound great! I'd say I'm definitely a foodie - I love trying new cuisines and cooking at home too. There's something so satisfying about creating something delicious from scratch. Do you cook much yourself?" }
      ],
      speed_dating: [
        { role: 'assistant', content: "Hi there! I'm Sarah, nice to meet you!" },
        { role: 'user', content: "Hey Sarah! I'm Alex. So we have 3 minutes - that's exciting and terrifying at the same time! What's been the most interesting part of your day so far?" },
        { role: 'assistant', content: "Haha, I know right? Honestly, this whole speed dating thing is new for me but I figured why not try something adventurous. I'm a teacher, so most of my day was spent with 8-year-olds. What about you?" },
        { role: 'user', content: "A teacher! That's wonderful - you must have incredible patience and creativity. I work in graphic design, so my day was quite different - lots of quiet focus and problem-solving. I admire people who work with kids. What grade do you teach?" }
      ]
    };

    return mockConversations[scenario as keyof typeof mockConversations] || mockConversations.coffee_shop;
  };

  const handleAnalyzeConversation = () => {
    const conversation = generateMockConversation(selectedScenario);
    setMockConversation(conversation);
    analyzeMutation.mutate({
      conversationHistory: conversation,
      scenarioType: selectedScenario
    });
  };

  if (progressLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
          <div className="h-48 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (progressError) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTitle>Error Loading Dashboard</AlertTitle>
          <AlertDescription>
            Failed to load your dating training progress. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const recentScores = progressData?.recentSessions?.[0]?.scores;
  const previousScores = progressData?.recentSessions?.[1]?.scores;

  return (
    <div className="container mx-auto p-6 space-y-8" data-testid="dating-dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dating Training Dashboard</h1>
          <p className="text-muted-foreground">
            Master your conversation skills across different dating scenarios
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Select value={selectedScenario} onValueChange={setSelectedScenario}>
            <SelectTrigger className="w-48" data-testid="scenario-selector">
              <SelectValue placeholder="Choose scenario" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SCENARIO_NAMES).map(([key, name]) => {
                const Icon = SCENARIO_ICONS[key];
                return (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center space-x-2">
                      <Icon className="h-4 w-4" />
                      <span>{name}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          
          <Button 
            onClick={handleAnalyzeConversation}
            disabled={analyzeMutation.isPending}
            data-testid="button-analyze-conversation"
          >
            {analyzeMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent mr-2" />
                Analyzing...
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4 mr-2" />
                Analyze Sample
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Analysis Results */}
      {analyzeMutation.data && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
          <Zap className="h-4 w-4" />
          <AlertTitle>Analysis Complete!</AlertTitle>
          <AlertDescription>
            Your conversation in the {SCENARIO_NAMES[selectedScenario]} scenario has been analyzed. 
            Check the results below.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="current-session" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="current-session" data-testid="tab-current-session">
            Current Session
          </TabsTrigger>
          <TabsTrigger value="progress" data-testid="tab-progress">
            Progress Tracking
          </TabsTrigger>
          <TabsTrigger value="scenarios" data-testid="tab-scenarios">
            All Scenarios
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            Insights
          </TabsTrigger>
        </TabsList>

        {/* Current Session Analysis */}
        <TabsContent value="current-session" className="space-y-6">
          {analyzeMutation.data ? (
            <ConversationRadarChart
              scores={analyzeMutation.data.scores}
              previousScores={recentScores}
              scenarioType={analyzeMutation.data.scenarioType}
              sessionId={analyzeMutation.data.sessionId}
              showComparison={false}
            />
          ) : recentScores ? (
            <ConversationRadarChart
              scores={recentScores}
              previousScores={previousScores}
              scenarioType={progressData?.recentSessions[0].scenarioType}
              sessionId={progressData?.recentSessions[0].sessionId}
              showComparison={!!previousScores}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <h3 className="text-lg font-semibold mb-2">Ready to Practice?</h3>
                <p className="text-muted-foreground mb-4">
                  Select a scenario and click "Analyze Sample" to see how our conversation analysis works!
                </p>
                <Button 
                  onClick={handleAnalyzeConversation}
                  disabled={analyzeMutation.isPending}
                  size="lg"
                  data-testid="button-start-practice"
                >
                  Start Practice Session
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Progress Tracking */}
        <TabsContent value="progress" className="space-y-6">
          {progressData && progressData.recentSessions.length > 0 ? (
            <ConversationProgressComparison sessionHistory={progressData.recentSessions} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Track Your Progress</h3>
                <p className="text-muted-foreground">
                  Complete more training sessions to see your improvement over time!
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* All Scenarios */}
        <TabsContent value="scenarios" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(SCENARIO_NAMES).map(([key, name]) => {
              const Icon = SCENARIO_ICONS[key];
              const sessionData = progressData?.recentSessions.find(s => s.scenarioType === key);
              const isCompleted = !!sessionData;
              
              return (
                <Card 
                  key={key} 
                  className={`cursor-pointer transition-all hover:shadow-md ${selectedScenario === key ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedScenario(key)}
                  data-testid={`scenario-card-${key}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Icon className={`h-6 w-6 ${isCompleted ? 'text-green-600' : 'text-muted-foreground'}`} />
                      {isCompleted && (
                        <Badge variant="secondary" className="text-xs">
                          Completed
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-sm">{name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {sessionData ? (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Overall: {sessionData.scores.overall}/10</div>
                        <div>Last: {new Date(sessionData.date).toLocaleDateString()}</div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Not completed yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Insights */}
        <TabsContent value="insights" className="space-y-6">
          {progressData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>Overall Progress</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Trend</span>
                    <Badge 
                      variant={progressData.overallProgress.trend === 'improving' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {progressData.overallProgress.trend}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Average Improvement</span>
                    <span className="font-medium">
                      +{progressData.overallProgress.averageImprovement.toFixed(1)} points
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Strongest Skill</span>
                    <Badge variant="outline" className="capitalize">
                      {progressData.overallProgress.strongestSkill}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Growth Opportunity</span>
                    <Badge variant="outline" className="capitalize">
                      {progressData.overallProgress.weakestSkill}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <h4 className="font-medium text-green-600 mb-1">Keep Doing</h4>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• Your {progressData.overallProgress.strongestSkill} skills are excellent</li>
                      <li>• Maintain your current practice frequency</li>
                    </ul>
                  </div>
                  
                  <div className="text-sm">
                    <h4 className="font-medium text-orange-600 mb-1">Focus On</h4>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• Practice scenarios that challenge your {progressData.overallProgress.weakestSkill}</li>
                      <li>• Try speed dating scenarios for quick skill building</li>
                    </ul>
                  </div>
                  
                  <div className="text-sm">
                    <h4 className="font-medium text-blue-600 mb-1">Next Steps</h4>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• Complete all 8 scenario types</li>
                      <li>• Practice with increasing difficulty levels</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}