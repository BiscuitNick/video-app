import React, { memo, useEffect, useState, useRef } from 'react';
import type { PerformanceMetrics } from './types';
import './PerformanceMonitor.css';

interface PerformanceMonitorProps {
  enabled?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  updateInterval?: number; // ms
}

/**
 * PerformanceMonitor displays real-time performance metrics
 * Shows FPS, frame time, dropped frames, and memory usage
 */
export const PerformanceMonitor = memo<PerformanceMonitorProps>(({
  enabled = true,
  position = 'top-right',
  updateInterval = 100,
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    frameTime: 0,
    droppedFrames: 0,
    memoryUsage: 0,
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const droppedFramesRef = useRef(0);
  const rafIdRef = useRef<number>();

  useEffect(() => {
    if (!enabled) return;

    let lastUpdateTime = performance.now();
    let framesInInterval = 0;
    let frameTimesInInterval: number[] = [];

    const measureFrame = () => {
      const now = performance.now();
      const deltaTime = now - lastTimeRef.current;
      lastTimeRef.current = now;

      framesInInterval++;
      frameTimesInInterval.push(deltaTime);

      // Detect dropped frames (assuming 60 FPS target)
      const targetFrameTime = 1000 / 60;
      if (deltaTime > targetFrameTime * 1.5) {
        const droppedCount = Math.floor(deltaTime / targetFrameTime) - 1;
        droppedFramesRef.current += droppedCount;
      }

      // Update metrics at specified interval
      if (now - lastUpdateTime >= updateInterval) {
        const elapsedSeconds = (now - lastUpdateTime) / 1000;
        const fps = Math.round(framesInInterval / elapsedSeconds);

        // Calculate average frame time
        const avgFrameTime =
          frameTimesInInterval.reduce((sum, time) => sum + time, 0) /
          frameTimesInInterval.length;

        // Get memory usage if available
        let memoryUsage = 0;
        if ((performance as any).memory) {
          const memory = (performance as any).memory;
          memoryUsage = Math.round(memory.usedJSHeapSize / 1048576); // Convert to MB
        }

        setMetrics({
          fps,
          frameTime: Math.round(avgFrameTime * 100) / 100,
          droppedFrames: droppedFramesRef.current,
          memoryUsage,
        });

        // Reset for next interval
        framesInInterval = 0;
        frameTimesInInterval = [];
        lastUpdateTime = now;
      }

      rafIdRef.current = requestAnimationFrame(measureFrame);
    };

    rafIdRef.current = requestAnimationFrame(measureFrame);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [enabled, updateInterval]);

  if (!enabled) return null;

  // Determine color based on FPS
  const getFpsColor = (fps: number): string => {
    if (fps >= 55) return '#00ff00'; // Green
    if (fps >= 40) return '#ffff00'; // Yellow
    if (fps >= 25) return '#ff9900'; // Orange
    return '#ff0000'; // Red
  };

  const positionClass = `performance-monitor-${position}`;

  return (
    <div className={`performance-monitor ${positionClass}`}>
      <div className="performance-monitor-content">
        <div className="metric-row">
          <span className="metric-label">FPS:</span>
          <span className="metric-value" style={{ color: getFpsColor(metrics.fps) }}>
            {metrics.fps}
          </span>
        </div>

        <div className="metric-row">
          <span className="metric-label">Frame:</span>
          <span className="metric-value">
            {metrics.frameTime.toFixed(2)}ms
          </span>
        </div>

        <div className="metric-row">
          <span className="metric-label">Dropped:</span>
          <span className="metric-value" style={{ color: metrics.droppedFrames > 0 ? '#ff9900' : '#888' }}>
            {metrics.droppedFrames}
          </span>
        </div>

        {metrics.memoryUsage !== undefined && metrics.memoryUsage > 0 && (
          <div className="metric-row">
            <span className="metric-label">Memory:</span>
            <span className="metric-value">
              {metrics.memoryUsage}MB
            </span>
          </div>
        )}

        {/* FPS Graph */}
        <FpsGraph fps={metrics.fps} />
      </div>
    </div>
  );
});

PerformanceMonitor.displayName = 'PerformanceMonitor';

/**
 * FpsGraph displays a small graph of FPS over time
 */
const FpsGraph = memo<{ fps: number }>(({ fps }) => {
  const [history, setHistory] = useState<number[]>([]);
  const maxHistory = 30;

  useEffect(() => {
    setHistory((prev) => {
      const newHistory = [...prev, fps];
      return newHistory.slice(-maxHistory);
    });
  }, [fps]);

  const maxFps = 60;
  const width = 100;
  const height = 30;

  // Generate SVG path for the graph
  const generatePath = (): string => {
    if (history.length === 0) return '';

    const points = history.map((value, index) => {
      const x = (index / (maxHistory - 1)) * width;
      const y = height - (value / maxFps) * height;
      return `${x},${y}`;
    });

    return `M${points.join(' L')}`;
  };

  return (
    <div className="fps-graph">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Background grid */}
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <line x1="0" y1="0" x2={width} y2="0" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <line x1="0" y1={height} x2={width} y2={height} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

        {/* FPS path */}
        {history.length > 0 && (
          <path
            d={generatePath()}
            fill="none"
            stroke="#00ff00"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
});

FpsGraph.displayName = 'FpsGraph';

/**
 * usePerformanceMonitor hook - For programmatic access to performance metrics
 */
export function usePerformanceMonitor(updateInterval: number = 100) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    frameTime: 0,
    droppedFrames: 0,
    memoryUsage: 0,
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const droppedFramesRef = useRef(0);

  useEffect(() => {
    let lastUpdateTime = performance.now();
    let framesInInterval = 0;
    let frameTimesInInterval: number[] = [];
    let rafId: number;

    const measureFrame = () => {
      const now = performance.now();
      const deltaTime = now - lastTimeRef.current;
      lastTimeRef.current = now;

      framesInInterval++;
      frameTimesInInterval.push(deltaTime);

      // Detect dropped frames
      const targetFrameTime = 1000 / 60;
      if (deltaTime > targetFrameTime * 1.5) {
        const droppedCount = Math.floor(deltaTime / targetFrameTime) - 1;
        droppedFramesRef.current += droppedCount;
      }

      // Update metrics
      if (now - lastUpdateTime >= updateInterval) {
        const elapsedSeconds = (now - lastUpdateTime) / 1000;
        const fps = Math.round(framesInInterval / elapsedSeconds);
        const avgFrameTime =
          frameTimesInInterval.reduce((sum, time) => sum + time, 0) /
          frameTimesInInterval.length;

        let memoryUsage = 0;
        if ((performance as any).memory) {
          const memory = (performance as any).memory;
          memoryUsage = Math.round(memory.usedJSHeapSize / 1048576);
        }

        setMetrics({
          fps,
          frameTime: Math.round(avgFrameTime * 100) / 100,
          droppedFrames: droppedFramesRef.current,
          memoryUsage,
        });

        framesInInterval = 0;
        frameTimesInInterval = [];
        lastUpdateTime = now;
      }

      rafId = requestAnimationFrame(measureFrame);
    };

    rafId = requestAnimationFrame(measureFrame);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [updateInterval]);

  return metrics;
}
