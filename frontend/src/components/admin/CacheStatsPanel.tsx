/**
 * Subtask 20.5: Cache Statistics UI
 *
 * Displays cache usage metrics, hit/miss ratio, and provides controls
 * for manual cache clearing and cache warming.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import {
  getLRUCacheManager,
  LRUCacheManager,
} from '../../lib/thumbnail-cache/LRUCacheManager';
import {
  getThumbnailWorkerService,
  ThumbnailWorkerService,
} from '../../lib/thumbnail-cache/ThumbnailWorkerService';
import {
  getRetryManager,
  RetryManager,
} from '../../lib/thumbnail-cache/RetryManager';
import { CacheStats } from '../../lib/thumbnail-cache/types';

interface CacheStatsState extends CacheStats {
  maxSizeBytes: number;
  usagePercent: number;
  averageEntrySize: number;
}

export function CacheStatsPanel() {
  const [stats, setStats] = useState<CacheStatsState | null>(null);
  const [workerStats, setWorkerStats] = useState<any>(null);
  const [bandwidthMetrics, setBandwidthMetrics] = useState<any>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [warmingProgress, setWarmingProgress] = useState(0);
  const [isWarming, setIsWarming] = useState(false);
  const [cacheManager] = useState<LRUCacheManager>(() => getLRUCacheManager());
  const [workerService] = useState<ThumbnailWorkerService>(() =>
    getThumbnailWorkerService()
  );
  const [retryManager] = useState<RetryManager>(() => getRetryManager());

  // Load stats on mount and set up polling
  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  // Load all statistics
  const loadStats = useCallback(async () => {
    try {
      const cacheStats = await cacheManager.getDetailedStats();
      setStats(cacheStats);

      const wStats = workerService.getStats();
      setWorkerStats(wStats);

      const bwMetrics = retryManager.getBandwidthEstimate();
      setBandwidthMetrics(bwMetrics);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    }
  }, [cacheManager, workerService, retryManager]);

  // Clear cache
  const handleClearCache = useCallback(async () => {
    if (!confirm('Are you sure you want to clear the entire thumbnail cache?')) {
      return;
    }

    setIsClearing(true);
    try {
      await cacheManager.clear();
      await loadStats();
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert('Failed to clear cache');
    } finally {
      setIsClearing(false);
    }
  }, [cacheManager, loadStats]);

  // Reset statistics
  const handleResetStats = useCallback(() => {
    cacheManager.resetStats();
    retryManager.resetBandwidthMetrics();
    loadStats();
  }, [cacheManager, retryManager, loadStats]);

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Format bandwidth
  const formatBandwidth = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  // Get network speed badge
  const getNetworkSpeedBadge = () => {
    if (!bandwidthMetrics) return null;

    const speed = retryManager.getNetworkSpeed();
    const variant =
      speed === 'fast' ? 'default' : speed === 'medium' ? 'secondary' : 'destructive';

    return <Badge variant={variant}>{speed.toUpperCase()}</Badge>;
  };

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cache Statistics</CardTitle>
          <CardDescription>Loading cache statistics...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Thumbnail Cache Statistics</CardTitle>
              <CardDescription>
                Real-time cache performance and usage metrics
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetStats}
              >
                Reset Stats
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearCache}
                disabled={isClearing}
              >
                {isClearing ? 'Clearing...' : 'Clear Cache'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="workers">Workers</TabsTrigger>
              <TabsTrigger value="network">Network</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Cache Usage"
                  value={`${stats.usagePercent.toFixed(1)}%`}
                  subtitle={`${formatBytes(stats.totalSizeBytes)} / ${formatBytes(stats.maxSizeBytes)}`}
                />
                <MetricCard
                  label="Cached Items"
                  value={stats.itemCount.toString()}
                  subtitle={`Avg: ${formatBytes(stats.averageEntrySize)}`}
                />
                <MetricCard
                  label="Hit Rate"
                  value={`${(stats.hitRate * 100).toFixed(1)}%`}
                  subtitle={`${stats.hitCount} hits / ${stats.missCount} misses`}
                />
                <MetricCard
                  label="Evictions"
                  value={stats.evictionCount.toString()}
                  subtitle="Total evicted items"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <Label>Cache Capacity</Label>
                  <span className="text-muted-foreground">
                    {formatBytes(stats.totalSizeBytes)} / {formatBytes(stats.maxSizeBytes)}
                  </span>
                </div>
                <Progress value={stats.usagePercent} />
              </div>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                  label="Cache Hits"
                  value={stats.hitCount.toString()}
                  subtitle="Total successful retrievals"
                />
                <MetricCard
                  label="Cache Misses"
                  value={stats.missCount.toString()}
                  subtitle="Total cache misses"
                />
                <MetricCard
                  label="Hit Rate"
                  value={`${(stats.hitRate * 100).toFixed(2)}%`}
                  subtitle={`${stats.hitCount + stats.missCount} total requests`}
                />
              </div>

              <div className="space-y-2">
                <Label>Hit Rate Distribution</Label>
                <div className="flex gap-2">
                  <div
                    className="h-8 bg-green-500 rounded"
                    style={{ width: `${stats.hitRate * 100}%` }}
                  />
                  <div
                    className="h-8 bg-red-500 rounded"
                    style={{ width: `${(1 - stats.hitRate) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Hits ({(stats.hitRate * 100).toFixed(1)}%)</span>
                  <span>Misses ({((1 - stats.hitRate) * 100).toFixed(1)}%)</span>
                </div>
              </div>
            </TabsContent>

            {/* Workers Tab */}
            <TabsContent value="workers" className="space-y-4 pt-4">
              {workerStats && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    label="Total Workers"
                    value={workerStats.totalWorkers.toString()}
                    subtitle="Worker pool size"
                  />
                  <MetricCard
                    label="Available Workers"
                    value={workerStats.availableWorkers.toString()}
                    subtitle="Idle workers"
                  />
                  <MetricCard
                    label="Active Requests"
                    value={workerStats.activeRequests.toString()}
                    subtitle="Processing now"
                  />
                  <MetricCard
                    label="Pending Requests"
                    value={workerStats.pendingRequests.toString()}
                    subtitle="In queue"
                  />
                </div>
              )}

              {workerStats && (
                <div className="space-y-2">
                  <Label>Worker Utilization</Label>
                  <Progress
                    value={
                      workerStats.totalWorkers > 0
                        ? ((workerStats.totalWorkers - workerStats.availableWorkers) /
                            workerStats.totalWorkers) *
                          100
                        : 0
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {workerStats.totalWorkers - workerStats.availableWorkers} of{' '}
                    {workerStats.totalWorkers} workers busy
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Network Tab */}
            <TabsContent value="network" className="space-y-4 pt-4">
              {bandwidthMetrics && (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard
                      label="Estimated Bandwidth"
                      value={formatBandwidth(bandwidthMetrics.estimatedBandwidth)}
                      subtitle={
                        <div className="flex items-center gap-2">
                          <span>Network Speed:</span>
                          {getNetworkSpeedBadge()}
                        </div>
                      }
                    />
                    <MetricCard
                      label="Samples Collected"
                      value={bandwidthMetrics.sampleCount.toString()}
                      subtitle="Bandwidth measurements"
                    />
                    <MetricCard
                      label="Last Updated"
                      value={new Date(bandwidthMetrics.lastUpdated).toLocaleTimeString()}
                      subtitle="Latest measurement"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Recommended Concurrency</Label>
                    <p className="text-2xl font-bold">
                      {retryManager.getSuggestedConcurrency()} parallel loads
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Based on current network conditions
                    </p>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// Metric card component
function MetricCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}
