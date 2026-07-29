import { describe, expect, it } from "vitest";
import {
  Currency,
  Money,
  REQUIRED_MANUAL_APPROVAL_ATTESTATION,
  evaluateSmallCapitalReadiness,
  type ManualLiveApprovalRecord,
  type SmallCapitalCapitalLimits,
  type SmallCapitalKillSwitchSignal,
  type SmallCapitalOperatorSurfaceSignal,
  type SmallCapitalProposedOrder,
  type SmallCapitalReconciliationSignal
} from "../../src/index.js";
import type { ComplianceGateResult } from "../../src/application/compliance/index.js";

const NOW = new Date("2026-07-29T01:00:00Z");
const KRW = Currency.from("KRW");

function krw(amount: string): Money {
  return Money.fromMajor(amount, KRW);
}

function cleanCapitalLimits(): SmallCapitalCapitalLimits {
  return {
    maxOrderValue: krw("300000"),
    maxDailyNotionalExposure: krw("900000"),
    maxTotalCapitalExposure: krw("3000000")
  };
}

function cleanProposedOrder(overrides: Partial<SmallCapitalProposedOrder> = {}): SmallCapitalProposedOrder {
  return {
    market: "KR",
    assetType: "STOCK",
    orderType: "LIMIT",
    orderValue: krw("100000"),
    projectedDailyNotionalAfterOrder: krw("100000"),
    projectedTotalCapitalExposureAfterOrder: krw("100000"),
    withinRegularSessionWindow: true,
    isExtendedHours: false,
    isFractional: false,
    ...overrides
  };
}

function approvedManualApproval(overrides: Partial<ManualLiveApprovalRecord> = {}): ManualLiveApprovalRecord {
  return {
    id: "approval-1",
    scopePortfolioId: "portfolio-1",
    scopeStrategyVersionId: "strategy-version-1",
    approvalStatus: "APPROVED",
    approvedByName: "Jun Kim",
    approvedByRole: "OWNER",
    acknowledgedRisksStatement: REQUIRED_MANUAL_APPROVAL_ATTESTATION,
    approvedAt: new Date("2026-07-01T00:00:00Z"),
    expiresAt: new Date("2026-08-01T00:00:00Z"),
    safetyType: "MANUAL_LIVE_APPROVAL_RECORD_HUMAN_OWNED",
    ...overrides
  };
}

function cleanReconciliation(): SmallCapitalReconciliationSignal {
  return { liveReadinessBlocked: false, stale: false, reasonCodes: [] };
}

function cleanKillSwitch(): SmallCapitalKillSwitchSignal {
  return { allowed: true, blocksNewOrders: false, reasonCodes: [] };
}

function cleanOperatorSurface(): SmallCapitalOperatorSurfaceSignal {
  return {
    dashboardReachable: true,
    systemStatus: "OK",
    openCriticalAlertCount: 0,
    auditTrailRecorded: true
  };
}

function cleanCompliance(): ComplianceGateResult {
  return { allowed: true, reasons: [], limitations: [] };
}

function fullyCleanInput() {
  return {
    now: NOW,
    capitalLimits: cleanCapitalLimits(),
    proposedOrder: cleanProposedOrder(),
    manualApproval: approvedManualApproval(),
    reconciliation: cleanReconciliation(),
    killSwitch: cleanKillSwitch(),
    operatorSurface: cleanOperatorSurface(),
    compliance: cleanCompliance()
  };
}

describe("evaluateSmallCapitalReadiness", () => {
  it("is ready only when every gate is clean", () => {
    const report = evaluateSmallCapitalReadiness(fullyCleanInput());

    expect(report.readyForSmallCapitalLive).toBe(true);
    expect(report.blockingReasonCodes).toEqual([]);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.safetyType).toBe("SMALL_CAPITAL_READINESS_REPORT_EVALUATION_ONLY");
  });

  it("fails closed on a fully empty input", () => {
    const report = evaluateSmallCapitalReadiness({ now: NOW });

    expect(report.readyForSmallCapitalLive).toBe(false);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.blockingReasonCodes).toEqual(
      expect.arrayContaining([
        "missing_capital_limits",
        "missing_manual_live_approval_record",
        "missing_reconciliation_signal",
        "missing_kill_switch_signal",
        "missing_operator_surface_signal",
        "missing_compliance_gate"
      ])
    );
  });

  it("never sets liveBrokerWriteAllowed to true regardless of how clean the input is", () => {
    const report = evaluateSmallCapitalReadiness(fullyCleanInput());
    // Structural check: the literal type already forbids `true`, but this
    // also proves no runtime code path can widen it.
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(JSON.stringify(report)).not.toMatch(/"liveBrokerWriteAllowed":true/);
  });

  it("rejects a fully empty evaluation time", () => {
    const report = evaluateSmallCapitalReadiness({ now: new Date(Number.NaN) });
    expect(report.blockingReasonCodes).toContain("missing_or_invalid_evaluation_time");
  });

  describe("capital limits and proposed order", () => {
    it("blocks an order value above the max order value", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ orderValue: krw("400000") })
      });

      expect(report.blockingReasonCodes).toContain("order_value_exceeds_max_order_value");
      expect(report.readyForSmallCapitalLive).toBe(false);
    });

    it("blocks daily notional exposure above the max", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ projectedDailyNotionalAfterOrder: krw("950000") })
      });

      expect(report.blockingReasonCodes).toContain("daily_notional_exposure_exceeds_max");
    });

    it("blocks total capital exposure above the max", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ projectedTotalCapitalExposureAfterOrder: krw("3100000") })
      });

      expect(report.blockingReasonCodes).toContain("total_capital_exposure_exceeds_max");
    });

    it("blocks a disallowed market", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ market: "JP" })
      });

      expect(report.blockingReasonCodes).toContain("market_not_allowed_jp");
    });

    it("blocks a disallowed asset type (e.g. a future crypto/futures/options extension)", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ assetType: "CRYPTO" })
      });

      expect(report.blockingReasonCodes).toContain("asset_type_not_allowed_crypto");
    });

    it("blocks a market order (non-LIMIT order type)", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ orderType: "MARKET" })
      });

      expect(report.blockingReasonCodes).toContain("order_type_not_allowed_market");
    });

    it("blocks an order outside the regular session window", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ withinRegularSessionWindow: false })
      });

      expect(report.blockingReasonCodes).toContain("order_outside_regular_session_window");
    });

    it("blocks extended-hours orders", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ isExtendedHours: true })
      });

      expect(report.blockingReasonCodes).toContain("extended_hours_orders_not_allowed");
    });

    it("blocks fractional orders", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ isFractional: true })
      });

      expect(report.blockingReasonCodes).toContain("fractional_orders_not_allowed");
    });

    it("blocks a currency mismatch between the order and the capital limits instead of throwing", () => {
      const usd = Currency.from("USD");
      expect(() =>
        evaluateSmallCapitalReadiness({
          ...fullyCleanInput(),
          proposedOrder: cleanProposedOrder({ orderValue: Money.fromMajor("100.00", usd) })
        })
      ).not.toThrow();

      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        proposedOrder: cleanProposedOrder({ orderValue: Money.fromMajor("100.00", usd) })
      });
      expect(report.blockingReasonCodes).toContain("order_value_exceeds_max_order_value_currency_mismatch");
      expect(report.readyForSmallCapitalLive).toBe(false);
    });

    it("blocks a zero max order value as an invalid limit", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        capitalLimits: { ...cleanCapitalLimits(), maxOrderValue: krw("0") }
      });

      expect(report.blockingReasonCodes).toContain("invalid_capital_limit_max_order_value");
    });

    it("adds a warning but does not block when no proposed order is supplied", () => {
      const { proposedOrder: _proposedOrder, ...rest } = fullyCleanInput();
      const report = evaluateSmallCapitalReadiness(rest);

      expect(report.readyForSmallCapitalLive).toBe(true);
      expect(report.warnings).toContain("no_proposed_order_evaluated_against_numeric_limits");
    });
  });

  describe("manual live approval record — cannot be inferred or auto-populated", () => {
    it("blocks when the approval record is missing entirely", () => {
      const { manualApproval: _manualApproval, ...rest } = fullyCleanInput();
      const report = evaluateSmallCapitalReadiness(rest);
      expect(report.blockingReasonCodes).toContain("missing_manual_live_approval_record");
    });

    it("blocks a PENDING approval", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ approvalStatus: "PENDING" })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_status_pending");
    });

    it("blocks a REJECTED approval", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ approvalStatus: "REJECTED" })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_status_rejected");
    });

    it("blocks a REVOKED approval even if it once was APPROVED-shaped", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ approvalStatus: "APPROVED", revokedAt: new Date("2026-07-15T00:00:00Z") })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_revoked");
    });

    it("blocks an approval missing the approver's name", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ approvedByName: "" })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_missing_approver_name");
    });

    it("blocks an approval where the approver role is not OWNER", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ approvedByRole: "OPERATOR" })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_role_not_owner");
    });

    it("blocks an approval whose attestation text does not match verbatim (proves AI/code cannot fake sign-off)", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ acknowledgedRisksStatement: "I approve." })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_attestation_mismatch");
    });

    it("blocks an approval missing approvedAt", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ approvedAt: undefined })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_missing_approved_at");
    });

    it("blocks an approval missing an expiry", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ expiresAt: undefined })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_missing_expiry");
    });

    it("blocks an expired approval", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        manualApproval: approvedManualApproval({ expiresAt: new Date("2026-07-01T00:00:00Z") })
      });
      expect(report.blockingReasonCodes).toContain("manual_live_approval_expired");
    });
  });

  describe("reconciliation, kill switch, operator surface, compliance", () => {
    it("blocks when reconciliation live-readiness is blocked", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        reconciliation: { liveReadinessBlocked: true, stale: false, reasonCodes: ["reconciliation_not_fully_resolved"] }
      });
      expect(report.blockingReasonCodes).toContain("reconciliation_not_fully_resolved");
    });

    it("blocks when reconciliation is stale", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        reconciliation: { liveReadinessBlocked: false, stale: true, reasonCodes: [] }
      });
      expect(report.blockingReasonCodes).toContain("reconciliation_stale");
    });

    it("blocks when the kill switch gate disallows new orders", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        killSwitch: { allowed: false, blocksNewOrders: true, reasonCodes: ["kill_switch_active_global"] }
      });
      expect(report.blockingReasonCodes).toContain("kill_switch_blocks_new_orders");
    });

    it("blocks when the dashboard is unreachable", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        operatorSurface: { ...cleanOperatorSurface(), dashboardReachable: false }
      });
      expect(report.blockingReasonCodes).toContain("dashboard_unreachable");
    });

    it("blocks when the dashboard system status is not OK", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        operatorSurface: { ...cleanOperatorSurface(), systemStatus: "WARNING" }
      });
      expect(report.blockingReasonCodes).toContain("dashboard_system_status_not_ok_warning");
    });

    it("blocks when there are open critical alerts", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        operatorSurface: { ...cleanOperatorSurface(), openCriticalAlertCount: 2 }
      });
      expect(report.blockingReasonCodes).toContain("open_critical_alerts_present");
    });

    it("blocks when the audit trail was not recorded", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        operatorSurface: { ...cleanOperatorSurface(), auditTrailRecorded: false }
      });
      expect(report.blockingReasonCodes).toContain("audit_trail_not_recorded");
    });

    it("blocks and namespaces reasons when the compliance gate is not allowed", () => {
      const report = evaluateSmallCapitalReadiness({
        ...fullyCleanInput(),
        compliance: { allowed: false, reasons: ["missing_review_toss_api_terms"], limitations: [] }
      });
      expect(report.blockingReasonCodes).toContain("compliance_missing_review_toss_api_terms");
    });
  });

  it("is a pure function: calling it twice with equivalent input produces the same result", () => {
    const first = evaluateSmallCapitalReadiness(fullyCleanInput());
    const second = evaluateSmallCapitalReadiness(fullyCleanInput());
    expect(first).toEqual(second);
  });

  it("does not mutate its input", () => {
    const input = fullyCleanInput();
    const snapshotBefore = JSON.stringify(input, (_key, value) => (typeof value === "bigint" ? value.toString() : value));
    evaluateSmallCapitalReadiness(input);
    const snapshotAfter = JSON.stringify(input, (_key, value) => (typeof value === "bigint" ? value.toString() : value));
    expect(snapshotAfter).toBe(snapshotBefore);
  });
});
