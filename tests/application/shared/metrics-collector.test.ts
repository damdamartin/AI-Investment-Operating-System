/**
 * Tests for MetricsCollector
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MetricsCollector } from "../../../src/application/shared/metrics-collector.js";

describe("MetricsCollector", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe("recordMetric", () => {
    it("should record a metric", () => {
      collector.recordMetric("test.metric", 42, "GAUGE", { component: "test" });

      const metrics = collector.getMetrics({ metric: "test.metric" });
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(42);
      expect(metrics[0].type).toBe("GAUGE");
      expect(metrics[0].labels.component).toBe("test");
    });

    it("should record multiple metrics", () => {
      collector.recordMetric("metric.1", 10);
      collector.recordMetric("metric.2", 20);
      collector.recordMetric("metric.1", 30);

      expect(collector.getMetricNames()).toHaveLength(2);
      expect(collector.getMetrics({ metric: "metric.1" })).toHaveLength(2);
      expect(collector.getMetrics({ metric: "metric.2" })).toHaveLength(1);
    });

    it("should normalize values", () => {
      collector.recordMetric("test.metric", 0.1 + 0.2); // Common floating point issue

      const metrics = collector.getMetrics({ metric: "test.metric" });
      expect(metrics[0].value).toBeCloseTo(0.3, 5);
    });

    it("should handle invalid values", () => {
      collector.recordMetric("test.metric", Infinity);
      collector.recordMetric("test.metric", NaN);

      const metrics = collector.getMetrics({ metric: "test.metric" });
      // Both should be normalized to 0
      expect(metrics.every((m) => m.value === 0)).toBe(true);
    });
  });

  describe("recordError", () => {
    it("should record an error with Error object", () => {
      const error = new Error("Test error");
      collector.recordError("test.context", error, "ERROR");

      const errors = collector.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toBe("Test error");
      expect(errors[0].context).toBe("test.context");
      expect(errors[0].severity).toBe("ERROR");
      expect(errors[0].stack).toBeDefined();
    });

    it("should record an error with string message", () => {
      collector.recordError("test.context", "String error message", "WARNING");

      const errors = collector.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toBe("String error message");
      expect(errors[0].severity).toBe("WARNING");
    });

    it("should filter errors by context", () => {
      collector.recordError("context.a", "error 1");
      collector.recordError("context.b", "error 2");
      collector.recordError("context.a", "error 3");

      const filtered = collector.getErrors("context.a");
      expect(filtered).toHaveLength(2);
    });

    it("should filter errors by severity", () => {
      collector.recordError("test", "error 1", "ERROR");
      collector.recordError("test", "error 2", "WARNING");
      collector.recordError("test", "error 3", "ERROR");

      const critical = collector.getErrors(undefined, "ERROR");
      expect(critical).toHaveLength(2);
    });
  });

  describe("getMetrics", () => {
    beforeEach(() => {
      collector.recordMetric("test.metric", 10, "GAUGE", { type: "A" });
      collector.recordMetric("test.metric", 20, "GAUGE", { type: "B" });
      collector.recordMetric("test.metric", 30, "GAUGE", { type: "A" });
    });

    it("should get metrics by name", () => {
      const metrics = collector.getMetrics({ metric: "test.metric" });
      expect(metrics).toHaveLength(3);
    });

    it("should get all metrics when no filter provided", () => {
      collector.recordMetric("other.metric", 100);

      const metrics = collector.getMetrics();
      expect(metrics.length).toBeGreaterThanOrEqual(4);
    });

    it("should filter by labels", () => {
      const metrics = collector.getMetrics({ metric: "test.metric", labels: { type: "A" } });
      expect(metrics).toHaveLength(2);
      expect(metrics.every((m) => m.labels.type === "A")).toBe(true);
    });

    it("should filter by time range", () => {
      const now = new Date();
      const start = new Date(now.getTime() - 1000);
      const end = new Date(now.getTime() + 1000);

      const metrics = collector.getMetrics({
        metric: "test.metric",
        timeRange: { start, end }
      });

      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.every((m) => m.timestamp >= start && m.timestamp <= end)).toBe(true);
    });

    it("should sort metrics by timestamp", () => {
      const metrics = collector.getMetrics({ metric: "test.metric" });

      for (let i = 0; i < metrics.length - 1; i++) {
        expect(metrics[i].timestamp.getTime()).toBeLessThanOrEqual(metrics[i + 1].timestamp.getTime());
      }
    });
  });

  describe("getMetricsStats", () => {
    beforeEach(() => {
      collector.recordMetric("test.metric", 10);
      collector.recordMetric("test.metric", 20);
      collector.recordMetric("test.metric", 30);
      collector.recordMetric("test.metric", 40);
      collector.recordMetric("test.metric", 50);
    });

    it("should calculate basic statistics", () => {
      const stats = collector.getMetricsStats("test.metric");

      expect(stats).not.toBeNull();
      expect(stats!.min).toBe(10);
      expect(stats!.max).toBe(50);
      expect(stats!.avg).toBe(30);
      expect(stats!.count).toBe(5);
      expect(stats!.sum).toBe(150);
    });

    it("should calculate percentiles", () => {
      const stats = collector.getMetricsStats("test.metric");

      expect(stats!.p50).toBeDefined();
      expect(stats!.p95).toBeDefined();
      expect(stats!.p99).toBeDefined();
    });

    it("should return null for non-existent metric", () => {
      const stats = collector.getMetricsStats("non.existent");
      expect(stats).toBeNull();
    });
  });

  describe("getSummary", () => {
    it("should provide overall summary", () => {
      collector.recordMetric("metric.1", 10);
      collector.recordMetric("metric.2", 20);
      collector.recordError("context", "error", "ERROR");

      const summary = collector.getSummary();

      expect(summary.timestamp).toBeDefined();
      expect(summary.totalMetrics).toBeGreaterThan(0);
      expect(summary.totalErrors).toBe(1);
      expect(summary.errorsBySeverity.ERROR).toBe(1);
    });

    it("should track errors by severity", () => {
      collector.recordError("test", "critical", "CRITICAL");
      collector.recordError("test", "error", "ERROR");
      collector.recordError("test", "warning", "WARNING");
      collector.recordError("test", "info", "INFO");

      const summary = collector.getSummary();

      expect(summary.errorsBySeverity.CRITICAL).toBe(1);
      expect(summary.errorsBySeverity.ERROR).toBe(1);
      expect(summary.errorsBySeverity.WARNING).toBe(1);
      expect(summary.errorsBySeverity.INFO).toBe(1);
    });
  });

  describe("clear", () => {
    it("should clear all metrics and errors", () => {
      collector.recordMetric("test.metric", 10);
      collector.recordError("test", "error");

      expect(collector.getMetricNames()).toHaveLength(1);
      expect(collector.getErrors()).toHaveLength(1);

      collector.clear();

      expect(collector.getMetricNames()).toHaveLength(0);
      expect(collector.getErrors()).toHaveLength(0);
    });
  });

  describe("memory management", () => {
    it("should limit metrics per name", () => {
      const maxMetrics = 1000;

      for (let i = 0; i < maxMetrics + 100; i++) {
        collector.recordMetric("test.metric", i);
      }

      const metrics = collector.getMetrics({ metric: "test.metric" });
      expect(metrics.length).toBeLessThanOrEqual(maxMetrics);
    });

    it("should limit total errors", () => {
      const maxErrors = 500;

      for (let i = 0; i < maxErrors + 100; i++) {
        collector.recordError("test", `error ${i}`);
      }

      const errors = collector.getErrors();
      expect(errors.length).toBeLessThanOrEqual(maxErrors);
    });
  });
});
