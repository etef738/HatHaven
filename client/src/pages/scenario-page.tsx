import { useState } from "react";
import { Coffee, Utensils, TreePine, Play, Award, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/navbar";
import ChatBox from "@/components/chat-box";
import ScoreCard from "@/components/score-card";
import { useDocumentTitle } from "@/hooks/use-document-title";

type ScenarioType = 'coffee_shop' | 'restaurant' | 'first_date';

interface Scenario {
  id: ScenarioType;
  title: string;
  description: string;
  icon: React.ReactNode;
  difficulty: number;
  duration: string;
  image: string;
  objectives: string[];
}

const scenarios: Scenario[] = [
  {
    id: 'coffee_shop',
    title: 'Coffee Shop Meet',
    description: 'Practice first impressions and casual conversation in a relaxed coffee shop setting.',
    icon: <Coffee className="w-6 h-6" />,
    difficulty: 1,
    duration: '~10 mins',
    image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250',
    objectives: [
      'Make a good first impression',
      'Ask about their interests',
      'Share something about yourself',
      'Suggest a follow-up meeting'
    ]
  },
  {
    id: 'restaurant',
    title: 'Dinner Date',
    description: 'Navigate deeper conversations and handle potential awkward moments during dinner.',
    icon: <Utensils className="w-6 h-6" />,
    difficulty: 2,
    duration: '~15 mins',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250',
    objectives: [
      'Navigate menu discussion',
      'Handle any awkward silences',
      'Discuss future goals and interests',
      'Show genuine interest in their responses',
      'End the date on a positive note'
    ]
  },
  {
    id: 'first_date',
    title: 'First Date Walk',
    description: 'Master the art of getting to know someone while handling nerves and building chemistry.',
    icon: <TreePine className="w-6 h-6" />,
    difficulty: 3,
    duration: '~20 mins',
    image: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250',
    objectives: [
      'Build comfortable rapport',
      'Find common interests',
      'Handle nerves appropriately',
      'Create moments of connection',
      'Express interest in a second date'
    ]
  }
];

export default function ScenarioPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  useDocumentTitle("Dating Training");
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [performanceScores, setPerformanceScores] = useState<any>(null);

  const analyzePerformanceMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await apiRequest("POST", "/api/analyze/performance", {
        conversationId
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setPerformanceScores(data);
      setShowResults(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStartScenario = (scenarioId: ScenarioType) => {
    setSelectedScenario(scenarioId);
    setIsActive(true);
    setShowResults(false);
    setPerformanceScores(null);
  };

  const handleBackToScenarios = () => {
    setSelectedScenario(null);
    setIsActive(false);
    setShowResults(false);
    setPerformanceScores(null);
    setConversationId(null);
  };

  const handleMessageSent = () => {
    // Track that conversation has started
  };

  const handleConversationCreated = (id: string) => {
    setConversationId(id);
  };

  const handleEndScenario = () => {
    if (conversationId) {
      analyzePerformanceMutation.mutate(conversationId);
    } else {
      toast({
        title: "No conversation to analyze",
        description: "Start chatting to get performance feedback!",
        variant: "default",
      });
    }
  };

  const getDifficultyDots = (difficulty: number) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3].map((dot) => (
          <div
            key={dot}
            className={`w-2 h-2 rounded-full ${
              dot <= difficulty ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>
    );
  };

  // Show scenario chat interface
  if (isActive && selectedScenario && !showResults) {
    const scenario = scenarios.find(s => s.id === selectedScenario)!;
    
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 container mx-auto px-6 py-8">
          <div className="max-w-4xl mx-auto h-full">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                    {scenario.icon}
                  </div>
                  <div>
                    <h1 className="text-2xl font-serif font-bold">{scenario.title}</h1>
                    <p className="text-muted-foreground">Dating Training Scenario</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={handleBackToScenarios}
                    data-testid="button-back-to-scenarios"
                  >
                    Back to Scenarios
                  </Button>
                  <Button
                    onClick={handleEndScenario}
                    disabled={analyzePerformanceMutation.isPending}
                    className="bg-gradient-to-r from-primary to-secondary text-white"
                    data-testid="button-end-scenario"
                  >
                    {analyzePerformanceMutation.isPending ? 'Analyzing...' : 'Get Feedback'}
                  </Button>
                </div>
              </div>
              
              {/* Objectives */}
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Award className="w-5 h-5" />
                    <span>Scenario Objectives</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {scenario.objectives.map((objective, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-secondary rounded-full" />
                        <span className="text-sm">{objective}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="h-[calc(100vh-300px)]">
              <ChatBox 
                mode="dating_training"
                scenarioType={selectedScenario}
                onMessageSent={handleMessageSent}
                onConversationCreated={handleConversationCreated}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show performance results
  if (showResults && performanceScores) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-6 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-serif font-bold mb-2">Scenario Complete!</h1>
              <p className="text-muted-foreground">
                Here's your performance analysis and feedback from our dating coach.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Performance Scores */}
              <ScoreCard
                title="Performance Scores"
                scores={performanceScores.scores}
              />

              {/* Dating Coach Feedback */}
              {performanceScores.coachFeedback && (
                <Card>
                  <CardHeader>
                    <CardTitle>Dating Coach Feedback</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Advice</h4>
                      <p className="text-sm text-muted-foreground">
                        {performanceScores.coachFeedback.advice}
                      </p>
                    </div>
                    
                    {performanceScores.coachFeedback.tips && (
                      <div>
                        <h4 className="font-medium mb-2">Tips for Improvement</h4>
                        <ul className="space-y-1">
                          {performanceScores.coachFeedback.tips.map((tip: string, index: number) => (
                            <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                              <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="text-center space-y-4">
              <Button
                onClick={handleBackToScenarios}
                className="bg-gradient-to-r from-primary to-secondary text-white px-8"
                data-testid="button-try-another-scenario"
              >
                Try Another Scenario
              </Button>
              <p className="text-sm text-muted-foreground">
                Keep practicing to improve your conversation skills!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show scenario selection
  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary/5 via-background to-primary/5">
      <Navbar />
      
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Play className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-serif font-bold mb-4">
              Dating Training Scenarios
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Practice realistic dating scenarios in a safe environment. 
              Get detailed feedback and improve your conversation skills.
            </p>
          </div>

          {/* User Progress */}
          <Card className="mb-8 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg mb-1">Welcome back, {user?.username}!</h3>
                  <p className="text-muted-foreground">Choose a scenario to continue improving your dating skills.</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Subscription</p>
                  <Badge variant="secondary" className="bg-gradient-to-r from-primary to-secondary text-white">
                    {user?.subscriptionTier?.toUpperCase() || 'FREE'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scenarios Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {scenarios.map((scenario) => (
              <Card 
                key={scenario.id} 
                className="group hover:shadow-xl transition-all duration-300 cursor-pointer"
                onClick={() => handleStartScenario(scenario.id)}
                data-testid={`scenario-card-${scenario.id}`}
              >
                <CardHeader className="p-0">
                  <img 
                    src={scenario.image}
                    alt={`${scenario.title} scenario`}
                    className="w-full h-48 object-cover rounded-t-lg group-hover:scale-105 transition-transform duration-300"
                  />
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                      {scenario.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{scenario.title}</h3>
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                    {scenario.description}
                  </p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">Difficulty:</span>
                      {getDifficultyDots(scenario.difficulty)}
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-secondary font-medium">{scenario.duration}</span>
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-secondary hover:opacity-90 text-white"
                    data-testid={`button-start-${scenario.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartScenario(scenario.id);
                    }}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Scenario
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tips Section */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-primary" />
                <span>Tips for Success</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Before You Start</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Be yourself and respond naturally</li>
                    <li>• Focus on having a genuine conversation</li>
                    <li>• Don't worry about being perfect</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">During the Scenario</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Ask open-ended questions</li>
                    <li>• Listen actively to responses</li>
                    <li>• Share something about yourself</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
