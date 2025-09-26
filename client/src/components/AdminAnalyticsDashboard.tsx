import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, AlertTriangle, Clock, DollarSign, Mic, TrendingUp, Users, Zap } from 'lucide-react';
import { VoiceAnalyticsDashboard, AnalyticsMetricsData } from '@shared/schema';

// Using shared types from @shared/schema

export function AdminAnalyticsDashboard() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [period, setPeriod] = useState<'hour' | 'day' | 'week' | 'month'>('day');

  // Convert date-only strings to datetime strings for API calls
  const getStartDateTime = (dateStr: string) => `${dateStr}T00:00:00.000Z`;
  const getEndDateTime = (dateStr: string) => `${dateStr}T23:59:59.999Z`;

  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useQuery({
    queryKey: ['/api/admin/analytics/dashboard', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const startDateTime = getStartDateTime(dateRange.startDate);
      const endDateTime = getEndDateTime(dateRange.endDate);
      const response = await fetch(`/api/admin/analytics/dashboard?startDate=${encodeURIComponent(startDateTime)}&endDate=${encodeURIComponent(endDateTime)}`);
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Admin access required for analytics dashboard');
        }
        throw new Error('Failed to fetch dashboard data');
      }
      return response.json() as Promise<VoiceAnalyticsDashboard>;
    }
  });

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/admin/analytics/metrics', period, dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const startDateTime = getStartDateTime(dateRange.startDate);
      const endDateTime = getEndDateTime(dateRange.endDate);
      const response = await fetch(`/api/admin/analytics/metrics?period=${period}&startDate=${encodeURIComponent(startDateTime)}&endDate=${encodeURIComponent(endDateTime)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch metrics data');
      }
      return response.json() as Promise<MetricsData>;
    }
  });

  const formatLatency = (value: number) => `${value.toFixed(0)}ms`;
  const formatPercentage = (value: number) => `${(value * 100).toFixed(2)}%`;
  const formatCurrency = (value: number) => `$${value.toFixed(4)}`;

  const COLORS = {
    p50: '#8884d8',
    p95: '#82ca9d',
    p99: '#ffc658',
    ttft: '#ff7300',
    errorRate: '#ff0000',
    requests: '#00C49F'
  };

  if (dashboardError) {
    return (
      <Alert data-testid="error-dashboard-access">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          {dashboardError.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="loading-dashboard">
        <div className="text-lg">Loading analytics dashboard...</div>
      </div>
    );
  }

  const { kpiMetrics, timeSeriesData, costMetrics, alerts } = dashboardData || {};
  const activeAlerts = alerts?.filter(alert => !alert.acknowledged) || [];
  const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'high');

  return (
    <div className="p-6 space-y-6" data-testid="analytics-dashboard">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Voice Analytics Dashboard</h1>
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
            <SelectTrigger className="w-32" data-testid="select-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">Hourly</SelectItem>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="px-3 py-2 border rounded-md"
              data-testid="input-start-date"
            />
            <span>to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="px-3 py-2 border rounded-md"
              data-testid="input-end-date"
            />
          </div>
        </div>
      </div>

      {/* Critical Alerts */}
      {criticalAlerts.length > 0 && (
        <Alert data-testid="alert-critical">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Critical Alerts ({criticalAlerts.length})</AlertTitle>
          <AlertDescription>
            {criticalAlerts.map(alert => (
              <div key={alert.id} className="mt-2">
                <Badge variant="destructive" className="mr-2">{alert.type.toUpperCase()}</Badge>
                {alert.message}
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card data-testid="card-p95-latency">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P95 Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-p95-latency">
              {kpiMetrics ? formatLatency(kpiMetrics.p95LatencyMs) : '---'}
            </div>
            {kpiMetrics?.p95LatencyMs && kpiMetrics.p95LatencyMs > 2500 && (
              <Badge variant="destructive" className="mt-2">Above Threshold</Badge>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-ttft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time to First Token</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-ttft">
              {kpiMetrics ? formatLatency(kpiMetrics.ttftMs) : '---'}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-error-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-error-rate">
              {kpiMetrics ? formatPercentage(kpiMetrics.errorRate) : '---'}
            </div>
            {kpiMetrics?.errorRate && kpiMetrics.errorRate > 0.05 && (
              <Badge variant="destructive" className="mt-2">High Error Rate</Badge>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-total-requests">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-requests">
              {kpiMetrics ? kpiMetrics.totalRequests.toLocaleString() : '---'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="latency" data-testid="tabs-analytics">
        <TabsList>
          <TabsTrigger value="latency">Latency Metrics</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
          <TabsTrigger value="alerts">Alert Management</TabsTrigger>
        </TabsList>

        <TabsContent value="latency" className="space-y-6">
          <Card data-testid="card-latency-chart">
            <CardHeader>
              <CardTitle>Latency Percentiles Over Time</CardTitle>
              <CardDescription>P50, P95, P99 latency and Time to First Token</CardDescription>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <div className="h-96 flex items-center justify-center">Loading metrics...</div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={metricsData?.metrics?.map(m => ({ 
                    timestamp: new Date(m.timestamp).toLocaleDateString(),
                    ...m.data 
                  })) || timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatLatency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="p50LatencyMs" stroke={COLORS.p50} name="P50 Latency" strokeWidth={2} />
                    <Line type="monotone" dataKey="p95LatencyMs" stroke={COLORS.p95} name="P95 Latency" strokeWidth={2} />
                    <Line type="monotone" dataKey="p99LatencyMs" stroke={COLORS.p99} name="P99 Latency" strokeWidth={2} />
                    <Line type="monotone" dataKey="ttftMs" stroke={COLORS.ttft} name="TTFT" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-error-rate-chart">
              <CardHeader>
                <CardTitle>Error Rate Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metricsData?.metrics?.map(m => ({ 
                    timestamp: new Date(m.timestamp).toLocaleDateString(),
                    errorRate: m.data.errorRate * 100
                  })) || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                    <Bar dataKey="errorRate" fill={COLORS.errorRate} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="card-request-volume">
              <CardHeader>
                <CardTitle>Request Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metricsData?.metrics?.map(m => ({ 
                    timestamp: new Date(m.timestamp).toLocaleDateString(),
                    totalRequests: m.data.totalRequests
                  })) || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="totalRequests" fill={COLORS.requests} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="costs" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card data-testid="card-total-cost">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-cost">
                  {costMetrics ? formatCurrency(costMetrics.totalCost) : '---'}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-avg-cost-per-request">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Cost/Request</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-avg-cost-per-request">
                  {costMetrics ? formatCurrency(costMetrics.avgCostPerRequest) : '---'}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-daily-active-users">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-daily-active-users">
                  {kpiMetrics ? kpiMetrics.avgDailyActiveUsers.toLocaleString() : '---'}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-daily-costs-chart">
            <CardHeader>
              <CardTitle>Daily Cost Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={costMetrics?.dailyCosts || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="cost" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card data-testid="card-alerts">
            <CardHeader>
              <CardTitle>Alert Management</CardTitle>
              <CardDescription>Monitor system alerts and acknowledgments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts && alerts.length > 0 ? (
                  alerts.map(alert => (
                    <div 
                      key={alert.id} 
                      className={`p-4 border rounded-lg ${alert.acknowledged ? 'bg-gray-50' : 'bg-white'}`}
                      data-testid={`alert-${alert.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={alert.severity === 'high' ? 'destructive' : alert.severity === 'medium' ? 'secondary' : 'outline'}
                          >
                            {alert.type.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{alert.message}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">
                            {new Date(alert.triggeredAt).toLocaleString()}
                          </span>
                          {!alert.acknowledged && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              data-testid={`button-acknowledge-${alert.id}`}
                            >
                              Acknowledge
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500" data-testid="text-no-alerts">
                    No alerts to display
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}