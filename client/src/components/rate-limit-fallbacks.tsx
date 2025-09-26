/**
 * Rate Limit Fallback UI Components
 * Provides user-friendly fallback experiences when rate limits are hit
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, CreditCard, Zap, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface RateLimitError {
  type: 'global_rate_limit' | 'service_rate_limit' | 'quota_exceeded' | 'cost_limit_exceeded' | 'global_cost_limit_exceeded';
  serviceType?: string;
  retryAfter?: number;
  fallbackSuggestion?: string;
  upgradeRequired?: boolean;
  quotaInfo?: {
    type: string;
    limit: number;
    current: number;
  };
  costInfo?: {
    limitType: string;
    limit: number;
    current: number;
  };
}

interface RateLimitFallbackProps {
  error: RateLimitError;
  onRetry?: () => void;
  onUpgrade?: () => void;
  onTextMode?: () => void;
}

export function RateLimitFallback({ error, onRetry, onUpgrade, onTextMode }: RateLimitFallbackProps) {
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (error.retryAfter) {
      setRetryCountdown(Math.ceil(error.retryAfter / 1000));
      
      const interval = setInterval(() => {
        setRetryCountdown(prev => {
          if (prev && prev <= 1) {
            clearInterval(interval);
            return null;
          }
          return prev ? prev - 1 : null;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [error.retryAfter]);

  const getErrorIcon = () => {
    switch (error.type) {
      case 'quota_exceeded':
      case 'cost_limit_exceeded':
        return <CreditCard className="h-5 w-5" />;
      case 'global_cost_limit_exceeded':
        return <Zap className="h-5 w-5" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  };

  const getErrorTitle = () => {
    switch (error.type) {
      case 'global_rate_limit':
        return 'System Busy';
      case 'service_rate_limit':
        return `${error.serviceType?.toUpperCase()} Service Limit Reached`;
      case 'quota_exceeded':
        return 'Usage Quota Exceeded';
      case 'cost_limit_exceeded':
        return 'Daily Spending Limit Reached';
      case 'global_cost_limit_exceeded':
        return 'Service Temporarily Unavailable';
      default:
        return 'Rate Limit Reached';
    }
  };

  const getErrorDescription = () => {
    switch (error.type) {
      case 'global_rate_limit':
        return 'Our servers are experiencing high demand. Please wait a moment and try again.';
      case 'service_rate_limit':
        return `You've reached the ${error.serviceType} service limit. Please wait before making another request.`;
      case 'quota_exceeded':
        return error.quotaInfo 
          ? `You've used ${error.quotaInfo.current} of ${error.quotaInfo.limit} ${error.quotaInfo.type} this period.`
          : 'You\'ve reached your usage quota for this period.';
      case 'cost_limit_exceeded':
        return error.costInfo
          ? `You've spent $${error.costInfo.current.toFixed(2)} of your $${error.costInfo.limit.toFixed(2)} ${error.costInfo.limitType} limit.`
          : 'You\'ve reached your spending limit for this period.';
      case 'global_cost_limit_exceeded':
        return 'We\'re temporarily limiting usage due to high demand. Service will resume shortly.';
      default:
        return 'Please wait before trying again.';
    }
  };

  const getSeverity = (): "default" | "destructive" => {
    return error.type.includes('cost_limit') || error.type === 'quota_exceeded' ? 'destructive' : 'default';
  };

  const handleTextModeSwitch = () => {
    onTextMode?.();
    toast({
      title: "Switched to Text Mode",
      description: "Voice features are temporarily disabled to stay within limits.",
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto" data-testid="rate-limit-fallback">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {getErrorIcon()}
          {getErrorTitle()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant={getSeverity()}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Service Temporarily Limited</AlertTitle>
          <AlertDescription className="text-sm">
            {getErrorDescription()}
          </AlertDescription>
        </Alert>

        {/* Quota Progress Bar */}
        {error.quotaInfo && (
          <div className="space-y-2" data-testid="quota-progress">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{error.quotaInfo.type} Usage</span>
              <span>{error.quotaInfo.current} / {error.quotaInfo.limit}</span>
            </div>
            <Progress 
              value={(error.quotaInfo.current / error.quotaInfo.limit) * 100}
              className="h-2"
            />
          </div>
        )}

        {/* Cost Progress Bar */}
        {error.costInfo && (
          <div className="space-y-2" data-testid="cost-progress">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{error.costInfo.limitType} Spending</span>
              <span>${error.costInfo.current.toFixed(2)} / ${error.costInfo.limit.toFixed(2)}</span>
            </div>
            <Progress 
              value={(error.costInfo.current / error.costInfo.limit) * 100}
              className="h-2"
            />
          </div>
        )}

        {/* Retry Countdown */}
        {retryCountdown && (
          <div className="text-center" data-testid="retry-countdown">
            <div className="text-sm text-muted-foreground">
              Can retry in {retryCountdown} seconds
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* Fallback Options */}
          {error.fallbackSuggestion === 'text_only_mode' && (
            <Button
              variant="outline"
              onClick={handleTextModeSwitch}
              className="w-full"
              data-testid="button-text-mode"
            >
              Switch to Text Mode
            </Button>
          )}

          {/* Upgrade Option */}
          {error.upgradeRequired && onUpgrade && (
            <Button
              onClick={onUpgrade}
              className="w-full"
              data-testid="button-upgrade"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
          )}

          {/* Retry Option */}
          {onRetry && (
            <Button
              variant="secondary"
              onClick={onRetry}
              disabled={!!retryCountdown}
              className="w-full"
              data-testid="button-retry"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {retryCountdown ? `Retry in ${retryCountdown}s` : 'Try Again'}
            </Button>
          )}
        </div>

        {/* Help Text */}
        <div className="text-xs text-muted-foreground text-center">
          Rate limits help ensure fair usage for all users. 
          {error.upgradeRequired && ' Consider upgrading for higher limits.'}
        </div>
      </CardContent>
    </Card>
  );
}

interface UsageStatsProps {
  dailyVoiceMinutes: number;
  dailyCostUsd: number;
  tier: string;
  quotas: {
    dailyVoiceMinutes: number;
    monthlySttCalls: number;
    monthlyTtsCharacters: number;
    monthlyLlmTokens: number;
  };
}

export function UsageStatsWidget({ dailyVoiceMinutes, dailyCostUsd, tier, quotas }: UsageStatsProps) {
  const voiceUsagePercent = (dailyVoiceMinutes / quotas.dailyVoiceMinutes) * 100;
  const isNearLimit = voiceUsagePercent > 80;

  return (
    <Card className="w-full" data-testid="usage-stats-widget">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Usage Today</span>
          <span className="text-xs bg-secondary px-2 py-1 rounded-full">{tier}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Voice Minutes */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>Voice Minutes</span>
            <span className={isNearLimit ? 'text-destructive' : 'text-muted-foreground'}>
              {dailyVoiceMinutes} / {quotas.dailyVoiceMinutes}
            </span>
          </div>
          <Progress 
            value={voiceUsagePercent}
            className={`h-2 ${isNearLimit ? 'bg-destructive/20' : ''}`}
          />
          {isNearLimit && (
            <div className="text-xs text-destructive">
              ⚠️ Approaching daily limit
            </div>
          )}
        </div>

        {/* Cost */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>Cost Today</span>
            <span className="text-muted-foreground">
              ${dailyCostUsd.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground text-center">
            Reset at midnight • Upgrade for higher limits
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CircuitBreakerStatusProps {
  services: Array<{
    name: string;
    state: 'open' | 'closed' | 'half_open';
    failureCount: number;
    responseTime: number;
  }>;
}

export function CircuitBreakerStatus({ services }: CircuitBreakerStatusProps) {
  const getStatusColor = (state: string) => {
    switch (state) {
      case 'open': return 'text-destructive';
      case 'half_open': return 'text-yellow-500';
      case 'closed': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (state: string) => {
    switch (state) {
      case 'open': return '🔴';
      case 'half_open': return '🟡';
      case 'closed': return '🟢';
      default: return '⚪';
    }
  };

  return (
    <Card className="w-full" data-testid="circuit-breaker-status">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Service Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {services.map((service) => (
            <div key={service.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span>{getStatusIcon(service.state)}</span>
                <span className="font-medium">{service.name}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{service.responseTime}ms</span>
                <span className={getStatusColor(service.state)}>
                  {service.state}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}