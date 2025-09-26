import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Activity, AlertTriangle, Check, Clock, Database, Server, Shield, Zap } from 'lucide-react';

interface SystemHealthData {
  status: string;
  timestamp: string;
  redis: {
    status: string;
    healthy: boolean;
    lastPing?: number;
    errorCount?: number;
    connectionCount?: number;
  };
  uptime_seconds: number;
  rateLimiting?: {
    mode: string;
    activeCount?: number;
    strictModeEnabled?: boolean;
  };
  database?: {
    status: string;
    connections?: number;
  };
}

interface PublicHealthData {
  status: string;
  timestamp: string;
  redis: {
    status: string;
    healthy: boolean;
  };
  uptime_seconds: number;
}

export function SystemHealthDashboard() {
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds
  
  // Fetch admin health data (detailed)
  const { data: adminHealth, isLoading: adminLoading, error: adminError, refetch: refetchAdmin } = useQuery({
    queryKey: ['/api/admin/health'],
    queryFn: async () => {
      const response = await fetch('/api/admin/health');
      if (!response.ok) {
        throw new Error('Failed to fetch admin health data');
      }
      return response.json() as Promise<SystemHealthData>;
    },
    refetchInterval: refreshInterval,
    retry: false,
  });

  // Fetch public health data (basic) as fallback
  const { data: publicHealth, isLoading: publicLoading } = useQuery({
    queryKey: ['/api/healthz'],
    queryFn: async () => {
      const response = await fetch('/api/healthz');
      if (!response.ok) {
        throw new Error('Failed to fetch public health data');
      }
      return response.json() as Promise<PublicHealthData>;
    },
    refetchInterval: refreshInterval,
    retry: false,
  });

  // Use admin data if available, fallback to public data
  const healthData = adminHealth || publicHealth;
  const isLoading = adminLoading && publicLoading;

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ok':
      case 'healthy':
      case 'green':
        return 'text-green-600';
      case 'degraded':
      case 'yellow':
        return 'text-yellow-600';
      case 'unhealthy':
      case 'red':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string, healthy?: boolean) => {
    if (healthy === false || status.toLowerCase() === 'red' || status.toLowerCase() === 'unhealthy') {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    if (status.toLowerCase() === 'yellow' || status.toLowerCase() === 'degraded') {
      return <Clock className="h-4 w-4 text-yellow-500" />;
    }
    return <Check className="h-4 w-4 text-green-500" />;
  };

  if (adminError && !publicHealth) {
    return (
      <div className="p-6">
        <Alert variant="destructive" data-testid="error-health-dashboard">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            Admin access required for system health monitoring
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100" data-testid="title-system-health">
              System Health Monitor
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Real-time monitoring of Redis, rate limiting, and system performance
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant={healthData?.status === 'ok' ? 'default' : 'destructive'} data-testid="badge-overall-status">
              {healthData?.status || 'Unknown'}
            </Badge>
            <Button 
              onClick={() => refetchAdmin()}
              size="sm"
              data-testid="button-refresh-health"
            >
              <Activity className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* System Overview */}
            <Card data-testid="card-system-overview">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Server className="h-5 w-5 mr-2" />
                  System Overview
                </CardTitle>
                <CardDescription>
                  Core system status and uptime
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Overall Status</span>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(healthData?.status || 'unknown')}
                      <span className={`text-sm font-medium ${getStatusColor(healthData?.status || 'unknown')}`} data-testid="text-overall-status">
                        {healthData?.status || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Uptime</span>
                    <span className="text-sm font-medium" data-testid="text-system-uptime">
                      {healthData ? formatUptime(healthData.uptime_seconds) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Last Updated</span>
                    <span className="text-sm text-gray-500" data-testid="text-last-updated">
                      {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleTimeString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Redis Health */}
            <Card data-testid="card-redis-health">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2" />
                  Redis Status
                </CardTitle>
                <CardDescription>
                  Cache and session store monitoring
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Connection</span>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(healthData?.redis?.status || 'unknown', healthData?.redis?.healthy)}
                      <span className={`text-sm font-medium ${getStatusColor(healthData?.redis?.status || 'unknown')}`} data-testid="text-redis-status">
                        {healthData?.redis?.healthy === false ? 'Not Connected' : 
                         healthData?.redis?.status === 'red' ? 'Memory Fallback' : 
                         healthData?.redis?.status || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  {adminHealth?.redis?.lastPing && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Last Ping</span>
                      <span className="text-sm font-medium" data-testid="text-redis-ping">
                        {adminHealth.redis.lastPing}ms
                      </span>
                    </div>
                  )}
                  {adminHealth?.redis?.errorCount !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Error Count</span>
                      <span className="text-sm font-medium" data-testid="text-redis-errors">
                        {adminHealth.redis.errorCount}
                      </span>
                    </div>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    {healthData?.redis?.healthy === false 
                      ? 'Using memory fallback for rate limiting'
                      : 'Redis monitoring and health checks active'
                    }
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rate Limiting */}
            <Card data-testid="card-rate-limiting">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Rate Limiting
                </CardTitle>
                <CardDescription>
                  API protection and throttling status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Mode</span>
                    <Badge 
                      variant={adminHealth?.rateLimiting?.strictModeEnabled ? 'destructive' : 'default'}
                      data-testid="badge-rate-limiting-mode"
                    >
                      {adminHealth?.rateLimiting?.mode || (healthData?.redis?.healthy === false ? 'Strict' : 'Normal')}
                    </Badge>
                  </div>
                  {adminHealth?.rateLimiting?.activeCount !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Active Limiters</span>
                      <span className="text-sm font-medium" data-testid="text-active-limiters">
                        {adminHealth.rateLimiting.activeCount}
                      </span>
                    </div>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    {healthData?.redis?.healthy === false 
                      ? 'Strict mode active - reduced limits due to Redis fallback'
                      : 'Normal rate limiting with Redis backing'
                    }
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Database Status */}
            {adminHealth?.database && (
              <Card data-testid="card-database-status">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Database className="h-5 w-5 mr-2" />
                    Database
                  </CardTitle>
                  <CardDescription>
                    PostgreSQL connection status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Status</span>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(adminHealth.database.status)}
                        <span className={`text-sm font-medium ${getStatusColor(adminHealth.database.status)}`} data-testid="text-database-status">
                          {adminHealth.database.status}
                        </span>
                      </div>
                    </div>
                    {adminHealth.database.connections && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Connections</span>
                        <span className="text-sm font-medium" data-testid="text-database-connections">
                          {adminHealth.database.connections}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Monitoring Controls */}
            <Card data-testid="card-monitoring-controls">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Monitoring Controls
                </CardTitle>
                <CardDescription>
                  Refresh rate and monitoring settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Refresh Rate</span>
                    <select 
                      value={refreshInterval}
                      onChange={(e) => setRefreshInterval(Number(e.target.value))}
                      className="text-sm border rounded px-2 py-1"
                      data-testid="select-refresh-interval"
                    >
                      <option value={1000}>1 second</option>
                      <option value={5000}>5 seconds</option>
                      <option value={10000}>10 seconds</option>
                      <option value={30000}>30 seconds</option>
                    </select>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Data Source</span>
                    <span className="text-sm font-medium" data-testid="text-data-source">
                      {adminHealth ? 'Admin Health' : 'Public Health'}
                    </span>
                  </div>
                  <Button 
                    onClick={() => window.location.reload()}
                    size="sm"
                    variant="outline"
                    className="w-full"
                    data-testid="button-reload-dashboard"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Reload Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}