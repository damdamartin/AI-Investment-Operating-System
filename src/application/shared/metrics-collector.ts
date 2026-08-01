/**
 * Metrics Collector
 * Collects and stores system metrics for monitoring and debugging
 */

export type MetricType = "COUNTER" | "GAUGE" | "HISTOGRAM";

export interface Metric {
  name: string;
  value: number;
  type: MetricType;
  labels: Record<string, string>;
  timestamp: Date;
}

export interface MetricQueryOptions {
  metric?: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
  labels?: Record<string, string>;
}

export interface ErrorRecord {
  context: string;
  error: string;
  stack?: string | undefined;
  timestamp: Date;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
}

export class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();
  private errors: ErrorRecord[] = [];
  private maxMetricsPerName: number = 1000; // Keep last 1000 metrics per metric name
  private maxErrors: number = 500;

  /**
   * Record a metric value
   */
  recordMetric(
    name: string,
    value: number,
    type: MetricType = "GAUGE",
    labels: Record<string, string> = {}
  ): void {
    const metric: Metric = {
      name,
      value: this.normalizeValue(value),
      type,
      labels,
      timestamp: new Date()
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricsForName = this.metrics.get(name)!;
    metricsForName.push(metric);

    // Keep only last N metrics to avoid memory overflow
    if (metricsForName.length > this.maxMetricsPerName) {
      metricsForName.shift();
    }
  }

  /**
   * Record an error event
   */
  recordError(
    context: string,
    error: Error | string,
    severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL" = "ERROR"
  ): void {
    const errorRecord: ErrorRecord = {
      context,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date(),
      severity
    };

    this.errors.push(errorRecord);

    // Keep only last N errors to avoid memory overflow
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }
  }

  /**
   * Get metrics by name and optional time range
   */
  getMetrics(options: MetricQueryOptions = {}): Metric[] {
    const { metric: metricName, timeRange, labels: filterLabels } = options;

    let results: Metric[] = [];

    if (metricName) {
      results = this.metrics.get(metricName) || [];
    } else {
      // Get all metrics
      for (const metricsArray of this.metrics.values()) {
        results.push(...metricsArray);
      }
    }

    // Filter by time range
    if (timeRange) {
      results = results.filter((m) => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end);
    }

    // Filter by labels
    if (filterLabels && Object.keys(filterLabels).length > 0) {
      results = results.filter((m) => {
        for (const [key, value] of Object.entries(filterLabels)) {
          if (m.labels[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    return results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get error records with optional filtering
   */
  getErrors(context?: string, severity?: string): ErrorRecord[] {
    let results = this.errors;

    if (context) {
      results = results.filter((e) => e.context.includes(context));
    }

    if (severity) {
      results = results.filter((e) => e.severity === severity);
    }

    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get aggregated metrics statistics
   */
  getMetricsStats(metricName: string): MetricStats | null {
    const metrics = this.metrics.get(metricName);

    if (!metrics || metrics.length === 0) {
      return null;
    }

    const values = metrics.map((m) => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;

    const sorted = [...values].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;

    return {
      name: metricName,
      count: metrics.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: Math.round(avg * 1000) / 1000,
      p50,
      p95,
      p99,
      sum
    };
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Clear all metrics (be careful!)
   */
  clear(): void {
    this.metrics.clear();
    this.errors = [];
  }

  /**
   * Get summary statistics
   */
  getSummary(): MetricsSummary {
    const metricNames = Array.from(this.metrics.keys());
    const statsByMetric: Record<string, MetricStats> = {};

    for (const name of metricNames) {
      const stats = this.getMetricsStats(name);
      if (stats) {
        statsByMetric[name] = stats;
      }
    }

    const errorsBySeverity = {
      INFO: this.errors.filter((e) => e.severity === "INFO").length,
      WARNING: this.errors.filter((e) => e.severity === "WARNING").length,
      ERROR: this.errors.filter((e) => e.severity === "ERROR").length,
      CRITICAL: this.errors.filter((e) => e.severity === "CRITICAL").length
    };

    return {
      timestamp: new Date().toISOString(),
      totalMetrics: this.metrics.size,
      totalErrors: this.errors.length,
      errorsBySeverity,
      stats: statsByMetric
    };
  }

  /**
   * Normalize value to avoid floating-point precision issues
   */
  private normalizeValue(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
  }
}

export interface MetricStats {
  name: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  sum: number;
}

export interface MetricsSummary {
  timestamp: string;
  totalMetrics: number;
  totalErrors: number;
  errorsBySeverity: Record<string, number>;
  stats: Record<string, MetricStats>;
}

// Global metrics collector instance
export const globalMetricsCollector = new MetricsCollector();
