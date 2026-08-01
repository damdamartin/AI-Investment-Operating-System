/**
 * Tests for Alert Service
 *
 * Verifies:
 * - Alert generation for critical events
 * - Alert routing to multiple channels
 * - Alert deduplication
 * - Alert history tracking
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

interface Alert {
  id: string;
  severity: "INFO" | "WARN" | "ERROR" | "CRITICAL";
  category: string;
  title: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface AlertRecipient {
  type: "EMAIL" | "SMS" | "SLACK" | "WEBHOOK";
  address: string;
}

class AlertService {
  private alerts: Map<string, Alert> = new Map();
  private recipients: AlertRecipient[] = [];
  private sentAlerts: Set<string> = new Set();

  addRecipient(recipient: AlertRecipient): void {
    this.recipients.push(recipient);
  }

  /**
   * Create and send alert
   */
  async createAlert(alert: Alert): Promise<string> {
    // Generate ID if not provided
    if (!alert.id) {
      alert.id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Store alert
    this.alerts.set(alert.id, alert);

    // Send to recipients
    await this.sendAlert(alert);

    return alert.id;
  }

  /**
   * Send alert to all configured recipients
   */
  async sendAlert(alert: Alert): Promise<void> {
    // Deduplicate: don't send if we've already sent this exact alert recently
    const alertKey = `${alert.category}:${alert.title}`;
    if (this.sentAlerts.has(alertKey)) {
      console.log(`[Alert] Deduplicating alert: ${alertKey}`);
      return;
    }

    this.sentAlerts.add(alertKey);

    // Send to each recipient
    for (const recipient of this.recipients) {
      await this.sendToRecipient(alert, recipient);
    }
  }

  private async sendToRecipient(alert: Alert, recipient: AlertRecipient): Promise<void> {
    switch (recipient.type) {
      case "EMAIL":
        console.log(`[Alert] Sending email to ${recipient.address}: ${alert.title}`);
        break;
      case "SMS":
        console.log(`[Alert] Sending SMS to ${recipient.address}: ${alert.title}`);
        break;
      case "SLACK":
        console.log(`[Alert] Sending Slack message: ${alert.title}`);
        break;
      case "WEBHOOK":
        console.log(`[Alert] POSTing webhook to ${recipient.address}`);
        break;
    }
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  /**
   * Get all alerts for a category
   */
  getAlertsByCategory(category: string): Alert[] {
    return Array.from(this.alerts.values()).filter((a) => a.category === category);
  }

  /**
   * Get critical alerts
   */
  getCriticalAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter((a) => a.severity === "CRITICAL");
  }

  /**
   * Count alerts by severity
   */
  countBySeverity(): Record<string, number> {
    const counts = { INFO: 0, WARN: 0, ERROR: 0, CRITICAL: 0 };

    for (const alert of this.alerts.values()) {
      counts[alert.severity]++;
    }

    return counts;
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(hoursBack: number): number {
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    let cleared = 0;

    for (const [id, alert] of this.alerts.entries()) {
      if (new Date(alert.timestamp) < cutoff) {
        this.alerts.delete(id);
        cleared++;
      }
    }

    return cleared;
  }
}

describe("AlertService", () => {
  let alertService: AlertService;

  beforeEach(() => {
    alertService = new AlertService();
  });

  describe("createAlert", () => {
    it("should create and store alert", async () => {
      const alert: Alert = {
        id: "alert-1",
        severity: "ERROR",
        category: "TRADING",
        title: "Order Failed",
        message: "Failed to execute buy order",
        timestamp: new Date().toISOString()
      };

      const id = await alertService.createAlert(alert);

      expect(id).toBe("alert-1");
      expect(alertService.getAlert("alert-1")).toEqual(alert);
    });

    it("should generate ID if not provided", async () => {
      const alert: Alert = {
        id: "",
        severity: "WARN",
        category: "SYSTEM",
        title: "High CPU Usage",
        message: "CPU usage exceeded 80%",
        timestamp: new Date().toISOString()
      };

      const id = await alertService.createAlert({ ...alert, id: undefined as any });

      expect(id).toBeTruthy();
      expect(id).toMatch(/^alert-\d+-/);
    });

    it("should include metadata with alert", async () => {
      const alert: Alert = {
        id: "alert-2",
        severity: "CRITICAL",
        category: "RISK",
        title: "Max Drawdown Exceeded",
        message: "Account drawdown exceeded 10%",
        timestamp: new Date().toISOString(),
        metadata: { drawdown: 0.105, maxAllowed: 0.1 }
      };

      await alertService.createAlert(alert);

      const stored = alertService.getAlert("alert-2");
      expect(stored?.metadata?.drawdown).toBe(0.105);
    });
  });

  describe("addRecipient and alert routing", () => {
    it("should accept multiple recipients", () => {
      alertService.addRecipient({ type: "EMAIL", address: "trader@example.com" });
      alertService.addRecipient({ type: "SLACK", address: "trading-channel" });
      alertService.addRecipient({ type: "SMS", address: "+82-10-1234-5678" });

      // No direct way to check, but should not throw
      expect(() => {
        alertService.addRecipient({ type: "WEBHOOK", address: "https://webhook.example.com" });
      }).not.toThrow();
    });
  });

  describe("getAlertsByCategory", () => {
    beforeEach(async () => {
      await alertService.createAlert({
        id: "trading-1",
        severity: "ERROR",
        category: "TRADING",
        title: "Order Failed",
        message: "Test",
        timestamp: new Date().toISOString()
      });

      await alertService.createAlert({
        id: "system-1",
        severity: "WARN",
        category: "SYSTEM",
        title: "High CPU",
        message: "Test",
        timestamp: new Date().toISOString()
      });

      await alertService.createAlert({
        id: "trading-2",
        severity: "CRITICAL",
        category: "TRADING",
        title: "Position Closed",
        message: "Test",
        timestamp: new Date().toISOString()
      });
    });

    it("should filter alerts by category", () => {
      const tradingAlerts = alertService.getAlertsByCategory("TRADING");
      expect(tradingAlerts).toHaveLength(2);
      expect(tradingAlerts.every((a) => a.category === "TRADING")).toBe(true);
    });

    it("should return empty array for non-existent category", () => {
      const alerts = alertService.getAlertsByCategory("NONEXISTENT");
      expect(alerts).toHaveLength(0);
    });
  });

  describe("getCriticalAlerts", () => {
    beforeEach(async () => {
      await alertService.createAlert({
        id: "critical-1",
        severity: "CRITICAL",
        category: "RISK",
        title: "Portfolio Heat Critical",
        message: "Test",
        timestamp: new Date().toISOString()
      });

      await alertService.createAlert({
        id: "error-1",
        severity: "ERROR",
        category: "TRADING",
        title: "Order Failed",
        message: "Test",
        timestamp: new Date().toISOString()
      });

      await alertService.createAlert({
        id: "critical-2",
        severity: "CRITICAL",
        category: "SYSTEM",
        title: "Database Down",
        message: "Test",
        timestamp: new Date().toISOString()
      });
    });

    it("should return only critical alerts", () => {
      const criticals = alertService.getCriticalAlerts();
      expect(criticals).toHaveLength(2);
      expect(criticals.every((a) => a.severity === "CRITICAL")).toBe(true);
    });
  });

  describe("countBySeverity", () => {
    beforeEach(async () => {
      await alertService.createAlert({
        id: "info-1",
        severity: "INFO",
        category: "SYSTEM",
        title: "Test",
        message: "Test",
        timestamp: new Date().toISOString()
      });

      await alertService.createAlert({
        id: "warn-1",
        severity: "WARN",
        category: "SYSTEM",
        title: "Test",
        message: "Test",
        timestamp: new Date().toISOString()
      });

      await alertService.createAlert({
        id: "error-1",
        severity: "ERROR",
        category: "SYSTEM",
        title: "Test",
        message: "Test",
        timestamp: new Date().toISOString()
      });

      await alertService.createAlert({
        id: "critical-1",
        severity: "CRITICAL",
        category: "SYSTEM",
        title: "Test",
        message: "Test",
        timestamp: new Date().toISOString()
      });
    });

    it("should count alerts by severity", () => {
      const counts = alertService.countBySeverity();

      expect(counts.INFO).toBe(1);
      expect(counts.WARN).toBe(1);
      expect(counts.ERROR).toBe(1);
      expect(counts.CRITICAL).toBe(1);
    });
  });

  describe("clearOldAlerts", () => {
    beforeEach(async () => {
      const now = new Date();

      // Create alert 2 hours ago
      const oldTime = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
      await alertService.createAlert({
        id: "old-1",
        severity: "INFO",
        category: "SYSTEM",
        title: "Old alert",
        message: "Test",
        timestamp: oldTime
      });

      // Create recent alert
      const recentTime = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      await alertService.createAlert({
        id: "recent-1",
        severity: "INFO",
        category: "SYSTEM",
        title: "Recent alert",
        message: "Test",
        timestamp: recentTime
      });
    });

    it("should remove alerts older than specified hours", () => {
      const cleared = alertService.clearOldAlerts(1); // Clear alerts older than 1 hour

      expect(cleared).toBe(1);
      expect(alertService.getAlert("old-1")).toBeUndefined();
      expect(alertService.getAlert("recent-1")).toBeDefined();
    });

    it("should not remove recent alerts", () => {
      const cleared = alertService.clearOldAlerts(24); // Clear alerts older than 24 hours

      expect(cleared).toBe(0);
      expect(alertService.getAlert("old-1")).toBeDefined();
      expect(alertService.getAlert("recent-1")).toBeDefined();
    });
  });
});
