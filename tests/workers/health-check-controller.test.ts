/**
 * Tests for HealthCheckController
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { HealthCheckController } from "../../src/workers/health-check-controller.js";

describe("HealthCheckController", () => {
  let mockDB: any;
  let controller: HealthCheckController;

  beforeEach(() => {
    // Create mock D1 database
    mockDB = {
      prepare: vi.fn()
    };
    controller = new HealthCheckController(mockDB);
  });

  describe("checkDatabase", () => {
    it("should return UP status when database query succeeds", async () => {
      const mockPrepare = vi.fn(() => ({
        first: vi.fn().mockResolvedValue({ test: 1 })
      }));
      mockDB.prepare = mockPrepare;

      const response = await controller.getHealth();
      const data = (await response.json()) as any;

      expect(data.checks.database.status).toBe("UP");
      expect(data.checks.database.latency).toBeDefined();
      expect(data.checks.database.latency).toBeGreaterThanOrEqual(0);
    });

    it("should return DOWN status when database query fails", async () => {
      const mockPrepare = vi.fn(() => ({
        first: vi.fn().mockRejectedValue(new Error("Connection failed"))
      }));
      mockDB.prepare = mockPrepare;

      const response = await controller.getHealth();
      const data = (await response.json()) as any;

      expect(data.checks.database.status).toBe("DOWN");
      expect(data.checks.database.message).toContain("Connection failed");
    });

    it("should include latency measurement", async () => {
      const mockPrepare = vi.fn(() => ({
        first: vi.fn().mockResolvedValue({ test: 1 })
      }));
      mockDB.prepare = mockPrepare;

      const response = await controller.getHealth();
      const data = (await response.json()) as any;

      expect(data.checks.database.latency).toBeGreaterThanOrEqual(0);
      expect(typeof data.checks.database.latency).toBe("number");
    });
  });

  describe("getHealth", () => {
    it("should return overall UP status when all checks pass", async () => {
      const mockPrepare = vi.fn(() => ({
        first: vi.fn().mockResolvedValue({ test: 1 })
      }));
      mockDB.prepare = mockPrepare;

      const response = await controller.getHealth();
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data.status).toBe("UP");
      expect(data.checks).toBeDefined();
      expect(data.checks.database).toBeDefined();
      expect(data.checks.kis).toBeDefined();
      expect(data.checks.toss).toBeDefined();
      expect(data.checks.worker).toBeDefined();
    });

    it("should handle mixed service states correctly", async () => {
      const mockPrepare = vi.fn(() => ({
        first: vi.fn().mockResolvedValue({ test: 1 })
      }));
      mockDB.prepare = mockPrepare;

      const response = await controller.getHealth();
      const data = (await response.json()) as any;

      // All services should be UP in this case
      expect(["UP", "DEGRADED"]).toContain(data.status);
      expect(data.checks.database.status).toBe("UP");
    });

    it("should include timestamp", async () => {
      const mockPrepare = vi.fn(() => ({
        first: vi.fn().mockResolvedValue({ test: 1 })
      }));
      mockDB.prepare = mockPrepare;

      const response = await controller.getHealth();
      const data = (await response.json()) as any;

      expect(data.timestamp).toBeDefined();
      expect(new Date(data.timestamp).getTime()).toBeGreaterThan(0);
    });

    it("should include uptime", async () => {
      const mockPrepare = vi.fn(() => ({
        first: vi.fn().mockResolvedValue({ test: 1 })
      }));
      mockDB.prepare = mockPrepare;

      const response = await controller.getHealth();
      const data = (await response.json()) as any;

      expect(data.uptime).toBeDefined();
      expect(typeof data.uptime).toBe("number");
      expect(data.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("checkWorkerHealth", () => {
    it("should return position count", async () => {
      const mockPrepare = vi.fn(() => ({
        first: vi.fn().mockResolvedValue({ count: 5 })
      }));
      mockDB.prepare = mockPrepare;

      const response = await controller.getHealth();
      const data = (await response.json()) as any;

      expect(data.checks.worker.positions).toBe(5);
      expect(data.checks.worker.status).toBe("UP");
    });

    it("should return 0 positions when count fails", async () => {
      const mockPrepare = vi.fn(() => ({
        first: vi.fn().mockRejectedValue(new Error("Count failed"))
      }));
      mockDB.prepare = mockPrepare;

      const response = await controller.getHealth();
      const data = (await response.json()) as any;

      expect(data.checks.worker.positions).toBe(0);
      expect(data.checks.worker.status).toBe("DOWN");
    });
  });

  describe("KIS and Toss API checks", () => {
    it("should have KIS API status", async () => {
      const mockPrepare = vi.fn(() => ({
        first: vi.fn().mockResolvedValue({ test: 1 })
      }));
      mockDB.prepare = mockPrepare;

      const response = await controller.getHealth();
      const data = (await response.json()) as any;

      expect(data.checks.kis).toBeDefined();
      expect(data.checks.kis.status).toBe("UP");
      expect(data.checks.kis.message).toBeDefined();
    });

    it("should have Toss API status", async () => {
      const mockPrepare = vi.fn(() => ({
        first: vi.fn().mockResolvedValue({ test: 1 })
      }));
      mockDB.prepare = mockPrepare;

      const response = await controller.getHealth();
      const data = (await response.json()) as any;

      expect(data.checks.toss).toBeDefined();
      expect(data.checks.toss.status).toBe("UP");
      expect(data.checks.toss.message).toBeDefined();
    });
  });
});
