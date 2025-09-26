import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';

export interface ConversationScoresData {
  engagement: number;
  empathy: number;
  flow: number;
  confidence: number;
  authenticity: number;
  overall: number;
  feedback?: string;
  strengths?: string[];
  improvements?: string[];
}

interface RadarChartProps {
  scores: ConversationScoresData;
  previousScores?: ConversationScoresData;
  scenarioType?: string;
  sessionId?: string;
  showComparison?: boolean;
}

const chartConfig = {
  current: {
    label: "Current Session",
    color: "hsl(var(--chart-1))",
  },
  previous: {
    label: "Previous Session",
    color: "hsl(var(--chart-2))",
  },
};

const SCORE_DIMENSIONS = [
  { key: 'engagement', label: 'Engagement', description: 'How actively you participate and show interest' },
  { key: 'empathy', label: 'Empathy', description: 'How well you understand and respond to emotions' },
  { key: 'flow', label: 'Flow', description: 'How smoothly the conversation progresses' },
  { key: 'confidence', label: 'Confidence', description: 'How self-assured and comfortable you appear' },
  { key: 'authenticity', label: 'Authenticity', description: 'How genuine and true to yourself you seem' }
];

export function ConversationRadarChart({ 
  scores, 
  previousScores, 
  scenarioType, 
  sessionId,
  showComparison = false 
}: RadarChartProps) {
  // Prepare data for radar chart
  const radarData = SCORE_DIMENSIONS.map(dimension => {
    const dataPoint: any = {
      subject: dimension.label,
      fullLabel: dimension.description,
      current: scores[dimension.key as keyof ConversationScoresData] as number,
    };
    
    if (showComparison && previousScores) {
      dataPoint.previous = previousScores[dimension.key as keyof ConversationScoresData] as number;
      dataPoint.improvement = dataPoint.current - dataPoint.previous;
    }
    
    return dataPoint;
  });

  // Calculate average score and improvement
  const currentAverage = SCORE_DIMENSIONS.reduce((sum, dim) => 
    sum + (scores[dim.key as keyof ConversationScoresData] as number), 0) / SCORE_DIMENSIONS.length;
  
  const previousAverage = previousScores 
    ? SCORE_DIMENSIONS.reduce((sum, dim) => 
        sum + (previousScores[dim.key as keyof ConversationScoresData] as number), 0) / SCORE_DIMENSIONS.length
    : 0;

  const totalImprovement = showComparison ? currentAverage - previousAverage : 0;

  // Find strongest and weakest skills
  const strongestSkill = SCORE_DIMENSIONS.reduce((max, dim) => 
    (scores[dim.key as keyof ConversationScoresData] as number) > (scores[max.key as keyof ConversationScoresData] as number) ? dim : max
  );
  
  const weakestSkill = SCORE_DIMENSIONS.reduce((min, dim) => 
    (scores[dim.key as keyof ConversationScoresData] as number) < (scores[min.key as keyof ConversationScoresData] as number) ? dim : min
  );

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="bg-background/95 border border-border rounded-lg shadow-lg p-3 backdrop-blur-sm">
          <h4 className="font-medium text-sm text-foreground mb-1">{label}</h4>
          <p className="text-xs text-muted-foreground mb-2">{data.fullLabel}</p>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-[hsl(var(--chart-1))]">Current:</span>
              <span className="font-medium">{data.current}/10</span>
            </div>
            {showComparison && data.previous !== undefined && (
              <>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[hsl(var(--chart-2))]">Previous:</span>
                  <span className="font-medium">{data.previous}/10</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>Change:</span>
                  <span className={`font-medium ${data.improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.improvement >= 0 ? '+' : ''}{data.improvement.toFixed(1)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Conversation Skills Analysis</span>
            {scenarioType && (
              <Badge variant="secondary" className="capitalize">
                {scenarioType.replace('_', ' ')}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Multi-dimensional analysis of your conversation performance
            {sessionId && ` • Session ${sessionId.slice(-6)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[400px]">
            <RadarChart data={radarData} margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis 
                dataKey="subject" 
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                className="text-xs"
              />
              <PolarRadiusAxis 
                angle={90} 
                domain={[0, 10]} 
                tickCount={6}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                axisLine={false}
              />
              <Radar
                name="Current Session"
                dataKey="current"
                stroke="hsl(var(--chart-1))"
                fill="hsl(var(--chart-1))"
                fillOpacity={0.15}
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-1))', strokeWidth: 2, r: 4 }}
              />
              {showComparison && previousScores && (
                <Radar
                  name="Previous Session"
                  dataKey="previous"
                  stroke="hsl(var(--chart-2))"
                  fill="hsl(var(--chart-2))"
                  fillOpacity={0.1}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: 'hsl(var(--chart-2))', strokeWidth: 2, r: 3 }}
                />
              )}
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
            </RadarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {currentAverage.toFixed(1)}/10
            </div>
            {showComparison && (
              <div className={`text-sm ${totalImprovement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalImprovement >= 0 ? '↗' : '↘'} {Math.abs(totalImprovement).toFixed(1)} from last session
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Strongest Skill</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-green-600 capitalize">
              {strongestSkill.label}
            </div>
            <div className="text-sm text-muted-foreground">
              {(scores[strongestSkill.key as keyof ConversationScoresData] as number).toFixed(1)}/10
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Growth Opportunity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-orange-600 capitalize">
              {weakestSkill.label}
            </div>
            <div className="text-sm text-muted-foreground">
              {(scores[weakestSkill.key as keyof ConversationScoresData] as number).toFixed(1)}/10
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Feedback */}
      {(scores.feedback || scores.strengths || scores.improvements) && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {scores.feedback && (
              <div>
                <h4 className="font-medium text-sm text-foreground mb-2">Feedback</h4>
                <p className="text-sm text-muted-foreground">{scores.feedback}</p>
              </div>
            )}
            
            {scores.strengths && scores.strengths.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-green-600 mb-2">Strengths</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {scores.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {scores.improvements && scores.improvements.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-orange-600 mb-2">Areas for Improvement</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {scores.improvements.map((improvement, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-orange-500 mr-2">→</span>
                      {improvement}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Progress comparison component for multiple sessions
interface ProgressComparisonProps {
  sessionHistory: Array<{
    sessionId: string;
    date: string;
    scores: ConversationScoresData;
    scenarioType: string;
  }>;
}

export function ConversationProgressComparison({ sessionHistory }: ProgressComparisonProps) {
  if (sessionHistory.length < 2) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Complete more sessions to see your progress over time!</p>
        </CardContent>
      </Card>
    );
  }

  const latest = sessionHistory[0];
  const previous = sessionHistory[1];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversationRadarChart
          scores={latest.scores}
          previousScores={previous.scores}
          scenarioType={latest.scenarioType}
          sessionId={latest.sessionId}
          showComparison={true}
        />
        
        <Card>
          <CardHeader>
            <CardTitle>Progress Summary</CardTitle>
            <CardDescription>Your improvement over recent sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {SCORE_DIMENSIONS.map(dim => {
                const currentScore = latest.scores[dim.key as keyof ConversationScoresData] as number;
                const previousScore = previous.scores[dim.key as keyof ConversationScoresData] as number;
                const change = currentScore - previousScore;
                
                return (
                  <div key={dim.key} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{dim.label}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">
                        {previousScore.toFixed(1)} → {currentScore.toFixed(1)}
                      </span>
                      <Badge 
                        variant={change >= 0 ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {change >= 0 ? '+' : ''}{change.toFixed(1)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}