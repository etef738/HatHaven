import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart3, 
  Calendar, 
  Heart, 
  MessageCircle, 
  TrendingUp, 
  Users, 
  Award,
  AlertTriangle,
  Star,
  Target
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useAuth } from "@/hooks/use-auth";
import Navbar from "@/components/navbar";
import ScoreCard from "@/components/score-card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";

interface DashboardData {
  user: {
    id: string;
    username: string;
    subscriptionTier: string;
    createdAt: string;
  };
  conversations: Array<{
    id: string;
    mode: string;
    scenarioType?: string;
    timestamp: string;
    messageCount: number;
  }>;
  recentScores: Array<{
    id: string;
    scores: {
      engagement: number;
      empathy: number;
      flow: number;
      overall: number;
    };
    feedback?: string;
    createdAt: string;
  }>;
  analytics: {
    userMetrics: {
      totalConversations: number;
      averageSessionLength: number;
      favoriteScenarios: string[];
      improvementAreas: string[];
      engagementScore: number;
      retentionRisk: 'low' | 'medium' | 'high';
    };
    usageTrends: {
      dailyActivity: Record<string, number>;
      totalEvents: number;
      averageEventsPerDay: number;
    };
    progressMetrics: {
      trend: 'improving' | 'stable' | 'declining';
      averageImprovement: number;
      strongestSkill: string;
      weakestSkill: string;
    };
    attachmentMetrics: {
      conversationFrequency: number;
      sessionDuration: number;
      emotionalDependency: number;
      healthyBoundaries: boolean;
      recommendations: string[];
    };
  };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState("overview");
  useDocumentTitle("Dashboard");

  const { data: dashboardData, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-6 py-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <p className="text-muted-foreground">Loading your dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-6 py-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Unable to load dashboard</h2>
              <p className="text-muted-foreground">
                {error?.message || "There was an error loading your data. Please try again."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { analytics } = dashboardData;

  // Prepare chart data
  const activityData = Object.entries(analytics.usageTrends.dailyActivity)
    .slice(-7)
    .map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      conversations: count,
    }));

  const skillsData = dashboardData.recentScores.slice(0, 5).map((score, index) => ({
    session: `Session ${index + 1}`,
    engagement: score.scores.engagement,
    empathy: score.scores.empathy,
    flow: score.scores.flow,
    overall: score.scores.overall,
  }));

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'declining': return <TrendingUp className="w-4 h-4 text-red-600 rotate-180" />;
      default: return <TrendingUp className="w-4 h-4 text-gray-600 rotate-90" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-serif font-bold">
                  Welcome back, {dashboardData.user.username}!
                </h1>
                <p className="text-muted-foreground">
                  Track your progress and see how you're improving over time.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge 
                  variant="secondary" 
                  className="bg-gradient-to-r from-primary to-secondary text-white"
                >
                  {dashboardData.user.subscriptionTier.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* AI Disclosure Banner */}
            <Card className="bg-muted/50 border-muted">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Heart className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium mb-1">AI Companion Reminder:</p>
                    <p className="text-muted-foreground">
                      Heart & Playground is designed for personal growth and dating practice. 
                      Our AI companions are not licensed therapists and should not replace professional mental health services.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="progress" data-testid="tab-progress">Progress</TabsTrigger>
              <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
              <TabsTrigger value="wellness" data-testid="tab-wellness">Wellness</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="metric-total-conversations">
                      {analytics.userMetrics.totalConversations}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {analytics.usageTrends.averageEventsPerDay.toFixed(1)} per day average
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Engagement Score</CardTitle>
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="metric-engagement-score">
                      {analytics.userMetrics.engagementScore}/10
                    </div>
                    <Progress value={analytics.userMetrics.engagementScore * 10} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Progress Trend</CardTitle>
                    {getTrendIcon(analytics.progressMetrics.trend)}
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold capitalize" data-testid="metric-progress-trend">
                      {analytics.progressMetrics.trend}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {analytics.progressMetrics.averageImprovement > 0 ? '+' : ''}
                      {analytics.progressMetrics.averageImprovement.toFixed(1)} points
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Session Length</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="metric-session-length">
                      {Math.round(analytics.userMetrics.averageSessionLength)}m
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Average session duration
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Activity Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={activityData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line 
                          type="monotone" 
                          dataKey="conversations" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button 
                      asChild 
                      className="w-full bg-gradient-to-r from-primary to-secondary text-white"
                      data-testid="button-start-heart-mode"
                    >
                      <Link href="/chat">
                        <Heart className="w-4 h-4 mr-2" />
                        Start Heart Mode Chat
                      </Link>
                    </Button>
                    
                    <Button 
                      asChild 
                      variant="outline" 
                      className="w-full"
                      data-testid="button-practice-scenario"
                    >
                      <Link href="/scenarios">
                        <Users className="w-4 h-4 mr-2" />
                        Practice Dating Scenario
                      </Link>
                    </Button>

                    <div className="pt-2 border-t border-border">
                      <h4 className="font-medium mb-2">Recommendations</h4>
                      <div className="space-y-2">
                        {analytics.attachmentMetrics.recommendations.slice(0, 2).map((rec, index) => (
                          <p key={index} className="text-sm text-muted-foreground">
                            • {rec}
                          </p>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Progress Tab */}
            <TabsContent value="progress" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Latest Performance */}
                {dashboardData.recentScores.length > 0 && (
                  <ScoreCard
                    title="Latest Performance"
                    scores={dashboardData.recentScores[0].scores}
                    previousScores={dashboardData.recentScores[1]?.scores}
                  />
                )}

                {/* Skills Progress Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Skills Progress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={skillsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="session" />
                        <YAxis domain={[0, 10]} />
                        <Tooltip />
                        <Bar dataKey="engagement" fill="hsl(var(--primary))" />
                        <Bar dataKey="empathy" fill="hsl(var(--secondary))" />
                        <Bar dataKey="flow" fill="hsl(var(--chart-3))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Skills Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Award className="w-5 h-5 text-green-600" />
                      <span>Strongest Skill</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold capitalize" data-testid="strongest-skill">
                      {analytics.progressMetrics.strongestSkill}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Keep up the great work in this area!
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Target className="w-5 h-5 text-blue-600" />
                      <span>Focus Area</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold capitalize" data-testid="focus-area">
                      {analytics.progressMetrics.weakestSkill}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Practice more to improve this skill
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      <span>Improvement Rate</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold" data-testid="improvement-rate">
                      {analytics.progressMetrics.averageImprovement > 0 ? '+' : ''}
                      {analytics.progressMetrics.averageImprovement.toFixed(1)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Points per session
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Conversation History</CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardData.conversations.length > 0 ? (
                    <div className="space-y-4">
                      {dashboardData.conversations.slice(0, 10).map((conversation) => (
                        <div 
                          key={conversation.id} 
                          className="flex items-center justify-between p-4 border border-border rounded-lg"
                          data-testid={`conversation-${conversation.id}`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              conversation.mode === 'heart' 
                                ? 'bg-gradient-to-r from-primary to-secondary' 
                                : 'bg-secondary'
                            }`}>
                              {conversation.mode === 'heart' ? (
                                <Heart className="w-5 h-5 text-white" />
                              ) : (
                                <Users className="w-5 h-5 text-white" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">
                                {conversation.mode === 'heart' ? 'Heart Mode' : 'Dating Training'}
                                {conversation.scenarioType && ` - ${conversation.scenarioType.replace('_', ' ')}`}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {conversation.messageCount} messages
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              {new Date(conversation.timestamp).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(conversation.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No conversations yet. Start chatting to see your history!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Wellness Tab */}
            <TabsContent value="wellness" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Usage Patterns */}
                <Card>
                  <CardHeader>
                    <CardTitle>Usage Patterns</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Daily Conversations</span>
                        <span className="font-medium">
                          {analytics.attachmentMetrics.conversationFrequency.toFixed(1)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Average Session</span>
                        <span className="font-medium">
                          {analytics.attachmentMetrics.sessionDuration.toFixed(0)} minutes
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm">Healthy Boundaries</span>
                        <Badge 
                          className={analytics.attachmentMetrics.healthyBoundaries 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                          }
                        >
                          {analytics.attachmentMetrics.healthyBoundaries ? 'Good' : 'Monitor'}
                        </Badge>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm">Retention Risk</span>
                        <Badge className={getRiskColor(analytics.userMetrics.retentionRisk)}>
                          {analytics.userMetrics.retentionRisk.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Wellness Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle>Wellness Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.attachmentMetrics.recommendations.map((recommendation, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                          <p className="text-sm text-muted-foreground">
                            {recommendation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Professional Support Notice */}
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-amber-800">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Professional Support</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-amber-700">
                    Remember that Heart & Playground is designed for personal growth and dating practice. 
                    If you're experiencing mental health concerns, please consider consulting with a qualified 
                    mental health professional. Our AI companions are not a substitute for professional therapy.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
