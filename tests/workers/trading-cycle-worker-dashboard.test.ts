/**
 * Trading Cycle Worker Dashboard Tests
 * Tests for the performance metrics dashboard UI
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getDashboardHTML } from "../../src/workers/trading-cycle-worker-dashboard.js";

describe("Trading Cycle Worker Dashboard", () => {
  let html: string;

  beforeEach(() => {
    html = getDashboardHTML();
  });

  describe("HTML Structure", () => {
    it("should return valid HTML string", () => {
      expect(html).toBeTruthy();
      expect(typeof html).toBe("string");
      expect(html.length).toBeGreaterThan(1000);
    });

    it("should include DOCTYPE and html tags", () => {
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html");
      expect(html).toContain("</html>");
    });

    it("should have proper meta tags", () => {
      expect(html).toContain('charset="UTF-8"');
      expect(html).toContain("viewport");
      expect(html).toContain("width=device-width");
    });

    it("should include proper title", () => {
      expect(html).toContain("🤖 Dual-Team Auto-Trading Dashboard");
    });
  });

  describe("Chart.js Integration", () => {
    it("should include Chart.js CDN", () => {
      expect(html).toContain("cdn.jsdelivr.net/npm/chart.js");
    });

    it("should have team comparison chart canvas", () => {
      expect(html).toContain('id="team-comparison-chart"');
    });
  });

  describe("Performance Metrics Section", () => {
    it("should have performance metrics section", () => {
      expect(html).toContain('class="performance-metrics"');
      expect(html).toContain("📊 거래 성과 분석");
    });

    it("should have daily performance section", () => {
      expect(html).toContain('class="daily-performance"');
      expect(html).toContain("📈 오늘 성과");
      expect(html).toContain('id="kis-today-pnl"');
      expect(html).toContain('id="toss-today-pnl"');
    });

    it("should have monthly performance table", () => {
      expect(html).toContain('class="monthly-performance"');
      expect(html).toContain("📊 이달 성과");
      expect(html).toContain("performance-table");
      expect(html).toContain('id="kis-monthly"');
      expect(html).toContain('id="toss-monthly"');
    });

    it("should have all monthly metrics columns", () => {
      expect(html).toContain('id="kis-pnl"');
      expect(html).toContain('id="kis-roi"');
      expect(html).toContain('id="kis-win-rate"');
      expect(html).toContain('id="kis-dd"');
      expect(html).toContain('id="kis-sharpe"');
      expect(html).toContain('id="kis-trades"');
    });

    it("should have team comparison section", () => {
      expect(html).toContain('class="team-comparison"');
      expect(html).toContain("⚔️ 팀별 성과 비교");
    });

    it("should have recent triggers section", () => {
      expect(html).toContain('class="recent-triggers"');
      expect(html).toContain("🎯 최근 손절/익절 기록");
      expect(html).toContain('id="trigger-list"');
    });

    it("should have symbol performance section", () => {
      expect(html).toContain('class="symbol-performance"');
      expect(html).toContain("🏆 종목별 성과");
      expect(html).toContain('id="top-symbols-list"');
      expect(html).toContain('id="worst-symbols-list"');
    });
  });

  describe("JavaScript Functions", () => {
    it("should include updatePerformanceMetrics function", () => {
      expect(html).toContain("updatePerformanceMetrics");
      expect(html).toContain("setInterval(updatePerformanceMetrics, 5000)");
    });

    it("should include updateDailyPerformance function", () => {
      expect(html).toContain("updateDailyPerformance");
      expect(html).toContain("/api/performance/today?broker=KIS");
      expect(html).toContain("/api/performance/today?broker=TOSS");
    });

    it("should include updateMonthlyPerformance function", () => {
      expect(html).toContain("updateMonthlyPerformance");
      expect(html).toContain("/api/performance/monthly");
    });

    it("should include updateComparisonChart function", () => {
      expect(html).toContain("updateComparisonChart");
      expect(html).toContain("/api/performance/comparison");
      expect(html).toContain("new Chart(ctx");
    });

    it("should include updateSymbolPerformance function", () => {
      expect(html).toContain("updateSymbolPerformance");
      expect(html).toContain("/api/performance/top-symbols");
      expect(html).toContain("/api/performance/worst-symbols");
    });

    it("should include updateTriggerList function", () => {
      expect(html).toContain("updateTriggerList");
    });

    it("should have parseCurrency utility function", () => {
      expect(html).toContain("parseCurrency");
    });

    it("should have proper API base URL setup", () => {
      expect(html).toContain("const API_BASE = window.location.origin");
    });

    it("should update dashboard every 3 seconds", () => {
      expect(html).toContain("setInterval(updateDashboard, 3000)");
    });

    it("should update performance metrics every 5 seconds", () => {
      expect(html).toContain("setInterval(updatePerformanceMetrics, 5000)");
    });
  });

  describe("CSS Styling", () => {
    it("should have performance metrics CSS", () => {
      expect(html).toContain(".performance-metrics");
      expect(html).toContain("background: rgba(255,255,255, 0.02)");
    });

    it("should have metric card styles", () => {
      expect(html).toContain(".metric-card");
      expect(html).toContain(".metric-value");
    });

    it("should have positive and negative value styles", () => {
      expect(html).toContain(".value.positive");
      expect(html).toContain(".value.negative");
      expect(html).toContain("color: #10b981"); // positive green
      expect(html).toContain("color: #ef4444"); // negative red
    });

    it("should have performance table styles", () => {
      expect(html).toContain(".performance-table");
    });

    it("should have trigger item styles", () => {
      expect(html).toContain(".trigger-item");
      expect(html).toContain(".trigger-item.stop-loss");
      expect(html).toContain(".trigger-item.take-profit");
    });

    it("should have symbol item ranking styles", () => {
      expect(html).toContain(".symbol-item.rank-1");
      expect(html).toContain(".symbol-item.rank-2");
      expect(html).toContain(".symbol-item.rank-3");
    });

    it("should have responsive grid layout", () => {
      expect(html).toContain("grid-template-columns");
      expect(html).toContain("repeat(auto-fit, minmax(200px, 1fr))");
    });
  });

  describe("Team Panels", () => {
    it("should have KIS team panel", () => {
      expect(html).toContain("KIS Team");
      expect(html).toContain('id="kis-portfolio-krw"');
      expect(html).toContain('id="kis-portfolio-usd"');
      expect(html).toContain('id="kis-pnl"');
    });

    it("should have Toss team panel", () => {
      expect(html).toContain("Toss Team");
      expect(html).toContain('id="toss-portfolio"');
      expect(html).toContain('id="toss-pnl"');
    });

    it("should have Alpaca team panel", () => {
      expect(html).toContain("Alpaca Team");
      expect(html).toContain('id="alpaca-portfolio"');
      expect(html).toContain('id="alpaca-pnl"');
    });
  });

  describe("API Integration Points", () => {
    const apiEndpoints = [
      "/api/performance/today",
      "/api/performance/monthly",
      "/api/performance/comparison",
      "/api/performance/top-symbols",
      "/api/performance/worst-symbols",
    ];

    apiEndpoints.forEach((endpoint) => {
      it(`should reference ${endpoint} endpoint`, () => {
        expect(html).toContain(endpoint);
      });
    });

    it("should dynamically construct team status endpoints", () => {
      // Team status endpoints are constructed dynamically in updateTeam()
      expect(html).toContain("/api/${teamName}-status");
    });
  });

  describe("Accessibility & UX", () => {
    it("should have proper heading hierarchy", () => {
      expect(html).toContain("<h1>");
      expect(html).toContain("<h2>");
      expect(html).toContain("<h3>");
    });

    it("should have proper form elements", () => {
      expect(html).toContain("<button");
    });

    it("should have id attributes for dynamic updates", () => {
      expect(html).toContain('id="');
    });

    it("should have class attributes for styling", () => {
      expect(html).toContain('class="');
    });

    it("should support dark mode", () => {
      expect(html).toContain("rgba(255,255,255");
    });
  });

  describe("Performance Features", () => {
    it("should use Promise.all for parallel API calls", () => {
      expect(html).toContain("Promise.all");
    });

    it("should have error handling in try-catch blocks", () => {
      expect(html).toContain("try {");
      expect(html).toContain("catch (error)");
      expect(html).toContain("console.error");
    });

    it("should destroy and recreate chart to prevent memory leaks", () => {
      expect(html).toContain("performanceChart.destroy()");
    });
  });

  describe("Data Formatting", () => {
    it("should format currency values", () => {
      expect(html).toContain("formatCurrency");
      expect(html).toContain("Intl.NumberFormat");
    });

    it("should handle both KRW and USD currencies", () => {
      expect(html).toContain("KRW");
      expect(html).toContain("USD");
    });

    it("should parse currency strings correctly", () => {
      expect(html).toContain("parseCurrency");
      expect(html).toContain("replace(/[^\\d.-]/g");
    });
  });

  describe("Real-time Updates", () => {
    it("should initialize dashboard on page load", () => {
      expect(html).toContain("updateDashboard()");
      expect(html).toContain("updatePerformanceMetrics()");
    });

    it("should update dashboard at 3-second interval", () => {
      expect(html).toContain("setInterval(updateDashboard, 3000)");
    });

    it("should update performance metrics at 5-second interval", () => {
      expect(html).toContain("setInterval(updatePerformanceMetrics, 5000)");
    });

    it("should handle empty states gracefully", () => {
      expect(html).toContain("계산 중...");
      expect(html).toContain("거래 데이터 로딩 중...");
    });
  });
});
