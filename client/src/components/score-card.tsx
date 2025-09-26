import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface ScoreData {
  engagement: number;
  empathy: number;
  flow: number;
  overall: number;
  feedback?: string;
  strengths?: string[];
  improvements?: string[];
}

interface ScoreCardProps {
  title: string;
  scores: ScoreData;
  previousScores?: ScoreData;
  showDetails?: boolean;
}

export default function ScoreCard({ 
  title, 
  scores, 
  previousScores, 
  showDetails = true 
}: ScoreCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 8) return "bg-green-100";
    if (score >= 6) return "bg-yellow-100";
    return "bg-red-100";
  };

  const getTrendIcon = (current: number, previous?: number) => {
    if (!previous) return <Minus className="w-4 h-4 text-muted-foreground" />;
    if (current > previous) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (current < previous) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const scoreMetrics = [
    { label: "Engagement", value: scores.engagement, previous: previousScores?.engagement },
    { label: "Empathy", value: scores.empathy, previous: previousScores?.empathy },
    { label: "Flow", value: scores.flow, previous: previousScores?.flow },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold gradient-text">
              {scores.overall.toFixed(1)}
            </span>
            <span className="text-sm text-muted-foreground">/10</span>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Overall Score Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Score</span>
            <div className="flex items-center space-x-1">
              {getTrendIcon(scores.overall, previousScores?.overall)}
              <span className={getScoreColor(scores.overall)}>
                {scores.overall.toFixed(1)}/10
              </span>
            </div>
          </div>
          <Progress 
            value={scores.overall * 10} 
            className="h-2"
            data-testid="progress-overall-score"
          />
        </div>

        {/* Individual Metrics */}
        <div className="grid grid-cols-1 gap-4">
          {scoreMetrics.map((metric) => (
            <div key={metric.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{metric.label}</span>
                <div className="flex items-center space-x-1">
                  {getTrendIcon(metric.value, metric.previous)}
                  <span className={getScoreColor(metric.value)}>
                    {metric.value.toFixed(1)}
                  </span>
                </div>
              </div>
              <Progress 
                value={metric.value * 10} 
                className="h-1.5"
                data-testid={`progress-${metric.label.toLowerCase()}`}
              />
            </div>
          ))}
        </div>

        {showDetails && (
          <>
            {/* Strengths */}
            {scores.strengths && scores.strengths.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-green-700">Strengths</h4>
                <div className="flex flex-wrap gap-1">
                  {scores.strengths.map((strength, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="bg-green-100 text-green-800 text-xs"
                      data-testid={`strength-${index}`}
                    >
                      {strength}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Areas for Improvement */}
            {scores.improvements && scores.improvements.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-blue-700">Areas to Improve</h4>
                <div className="flex flex-wrap gap-1">
                  {scores.improvements.map((improvement, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="bg-blue-100 text-blue-800 text-xs"
                      data-testid={`improvement-${index}`}
                    >
                      {improvement}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Feedback */}
            {scores.feedback && (
              <div>
                <h4 className="text-sm font-medium mb-2">Detailed Feedback</h4>
                <p className="text-sm text-muted-foreground leading-relaxed" data-testid="detailed-feedback">
                  {scores.feedback}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
