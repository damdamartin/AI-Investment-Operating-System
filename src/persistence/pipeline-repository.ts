import { randomUUID } from "node:crypto";
import type { Asset } from "../domain/assets/index.js";
import type { MoneyCheck, Position } from "../domain/portfolio/index.js";
import type { RiskCheck } from "../domain/risk/index.js";
import type { Signal } from "../domain/strategy/index.js";
import type { D1QueryResultRow } from "./d1-http-client.js";

/**
 * Narrow dependency this repository needs from a D1 client. Kept separate
 * from `D1HttpClient` itself so tests can supply an in-memory fake without
 * touching HTTP.
 */
export interface PipelineDatabase {
  query(sql: string, params?: ReadonlyArray<string | number | boolean | null>): Promise<{ results: D1QueryResultRow[] }>;
}

export type OrderRecommendationStatus =
  | "PENDING_HUMAN_SUBMISSION"
  | "ACKNOWLEDGED"
  | "SUBMITTED_BY_HUMAN"
  | "DISMISSED"
  | "EXPIRED";

export interface OrderRecommendationInput {
  signalId: string;
  riskCheckId: string;
  moneyCheckId: string;
  assetId: string;
  direction: "BUY" | "SELL";
  recommendedQuantity: string;
  recommendedAmountMajor: string;
  recommendedCurrency: "KRW" | "USD";
  reasoning?: string;
}

export interface AuditLogInput {
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Persistence for the automated recommendation pipeline. This repository has
 * no concept of a real broker order - its terminal write is
 * `order_recommendations`, which a human reviews and acts on outside this
 * codebase. See migrations/d1/0001_pipeline_schema.sql.
 */
export class PipelineRepository {
  constructor(private readonly db: PipelineDatabase) {}

  async createCycleRun(startedAt: Date): Promise<string> {
    const id = randomUUID();
    await this.db.query(
      `insert into cycle_runs (id, started_at, status) values (?, ?, 'RUNNING')`,
      [id, startedAt.toISOString()]
    );
    return id;
  }

  async completeCycleRun(id: string, finishedAt: Date, status: "COMPLETED" | "FAILED", error?: string): Promise<void> {
    await this.db.query(
      `update cycle_runs set finished_at = ?, status = ?, error = ? where id = ?`,
      [finishedAt.toISOString(), status, error ?? null, id]
    );
  }

  /** Finds an existing asset by (market, symbol) or inserts a new one. Returns the row id. */
  async upsertAsset(asset: Pick<Asset, "symbol" | "name" | "market" | "assetType">): Promise<string> {
    const marketCode = asset.market.code;
    const assetTypeCode = asset.assetType.code;

    const existing = await this.db.query(`select id from assets where market = ? and symbol = ?`, [
      marketCode,
      asset.symbol
    ]);
    const existingId = existing.results[0]?.id;
    if (typeof existingId === "string") return existingId;

    const id = randomUUID();
    await this.db.query(
      `insert into assets (id, symbol, name, market, asset_type) values (?, ?, ?, ?, ?)`,
      [id, asset.symbol, asset.name, marketCode, assetTypeCode]
    );
    return id;
  }

  /** Finds an existing strategy version by (strategyName, version) or inserts a new one. Returns the row id. */
  async upsertStrategyVersion(
    strategyName: string,
    version: string,
    definition: Record<string, unknown> = {}
  ): Promise<string> {
    const existing = await this.db.query(
      `select id from strategy_versions where strategy_name = ? and version = ?`,
      [strategyName, version]
    );
    const existingId = existing.results[0]?.id;
    if (typeof existingId === "string") return existingId;

    const id = randomUUID();
    await this.db.query(
      `insert into strategy_versions (id, strategy_name, version, definition_json) values (?, ?, ?, ?)`,
      [id, strategyName, version, JSON.stringify(definition)]
    );
    return id;
  }

  async insertSignal(signal: Signal, cycleRunId: string, strategyVersionId: string, assetId: string): Promise<string> {
    await this.db.query(
      `insert into signals (id, cycle_run_id, strategy_version_id, asset_id, direction, score_set_json, scoring_version, generated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        signal.id,
        cycleRunId,
        strategyVersionId,
        assetId,
        signal.direction,
        JSON.stringify(signal.scoreSet.scores),
        signal.scoreSet.scoringVersion,
        signal.generatedAt.toISOString()
      ]
    );
    return signal.id;
  }

  async insertRiskCheck(riskCheck: RiskCheck, signalId: string): Promise<string> {
    await this.db.query(
      `insert into risk_checks (id, signal_id, result, risk_level, failed_limit_ids_json, warnings_json, checked_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
      [
        riskCheck.id,
        signalId,
        riskCheck.result,
        riskCheck.riskLevel,
        JSON.stringify(riskCheck.failedLimitIds),
        JSON.stringify(riskCheck.warnings),
        riskCheck.checkedAt.toISOString()
      ]
    );
    return riskCheck.id;
  }

  async insertMoneyCheck(moneyCheck: MoneyCheck, signalId: string): Promise<string> {
    await this.db.query(
      `insert into money_checks (id, signal_id, result, approved_quantity, approved_amount_major, approved_currency, reasons_json, warnings_json, checked_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        moneyCheck.id,
        signalId,
        moneyCheck.result,
        moneyCheck.approvedQuantity?.toString() ?? null,
        moneyCheck.approvedAmount?.toMajorString() ?? null,
        moneyCheck.approvedAmount?.currency.code ?? null,
        JSON.stringify(moneyCheck.reasons),
        JSON.stringify(moneyCheck.warnings),
        moneyCheck.checkedAt.toISOString()
      ]
    );
    return moneyCheck.id;
  }

  async insertOrderRecommendation(input: OrderRecommendationInput): Promise<string> {
    const id = randomUUID();
    await this.db.query(
      `insert into order_recommendations
         (id, signal_id, risk_check_id, money_check_id, asset_id, direction, recommended_quantity, recommended_amount_major, recommended_currency, reasoning)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.signalId,
        input.riskCheckId,
        input.moneyCheckId,
        input.assetId,
        input.direction,
        input.recommendedQuantity,
        input.recommendedAmountMajor,
        input.recommendedCurrency,
        input.reasoning ?? null
      ]
    );
    return id;
  }

  async listPendingRecommendations(): Promise<D1QueryResultRow[]> {
    const result = await this.db.query(
      `select * from order_recommendations where status = 'PENDING_HUMAN_SUBMISSION' order by created_at desc`
    );
    return result.results;
  }

  /** Human-driven transition. Never called by the orchestrator itself. */
  async markRecommendationDecided(
    id: string,
    status: Extract<OrderRecommendationStatus, "SUBMITTED_BY_HUMAN" | "DISMISSED">,
    decidedBy: string,
    decidedAt: Date
  ): Promise<void> {
    await this.db.query(`update order_recommendations set status = ?, decided_by = ?, decided_at = ? where id = ?`, [
      status,
      decidedBy,
      decidedAt.toISOString(),
      id
    ]);
  }

  async insertAuditLog(input: AuditLogInput): Promise<string> {
    const id = randomUUID();
    await this.db.query(
      `insert into audit_log (id, actor, action, resource_type, resource_id, reason, metadata_json)
       values (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.actor, input.action, input.resourceType, input.resourceId, input.reason ?? null, JSON.stringify(input.metadata ?? {})]
    );
    return id;
  }

  /** Create a new position after successful order execution */
  async insertPosition(position: Position): Promise<string> {
    const entryPriceStr = position.entryPrice.toString();
    const slPriceStr = position.stopLoss.toString();
    const tpPriceStr = position.takeProfit.toString();

    const entryParts = entryPriceStr.split(" ");
    const slParts = slPriceStr.split(" ");
    const tpParts = tpPriceStr.split(" ");

    const entryMajor = entryParts[0] ?? "0";
    const entryCurrency = entryParts[1] ?? "KRW";
    const slMajor = slParts[0] ?? "0";
    const slCurrency = slParts[1] ?? "KRW";
    const tpMajor = tpParts[0] ?? "0";
    const tpCurrency = tpParts[1] ?? "KRW";

    await this.db.query(
      `insert into positions
         (id, asset_id, order_recommendation_id, quantity, entry_price_major, entry_price_currency,
          entry_date, stop_loss_major, stop_loss_currency, take_profit_major, take_profit_currency, status)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        position.id,
        position.assetId,
        position.orderRecommendationId,
        position.quantity.toString(),
        entryMajor,
        entryCurrency,
        position.entryDate.toISOString(),
        slMajor,
        slCurrency,
        tpMajor,
        tpCurrency,
        "OPEN"
      ]
    );
    return position.id;
  }

  /** Get all open positions */
  async getOpenPositions(): Promise<D1QueryResultRow[]> {
    const result = await this.db.query(`select * from positions where status = 'OPEN' order by entry_date asc`);
    return result.results;
  }

  /** Get open positions for a specific asset */
  async getOpenPositionsByAsset(assetId: string): Promise<D1QueryResultRow[]> {
    const result = await this.db.query(
      `select * from positions where status = 'OPEN' and asset_id = ? order by entry_date asc`,
      [assetId]
    );
    return result.results;
  }

  /** Close a position and record the trigger */
  async closePosition(position: Position, triggerType: "STOP_LOSS" | "TAKE_PROFIT", triggerPrice: string): Promise<void> {
    const parts = triggerPrice.split(" ");
    const triggerMajor = parts[0] ?? "0";
    const triggerCurrency = parts[1] ?? "KRW";

    // Update position status
    await this.db.query(
      `update positions set status = ?, close_reason = ?, closed_at = ?, last_check_at = ? where id = ?`,
      [
        "CLOSED",
        position.closeReason ?? null,
        position.closedAt?.toISOString() ?? new Date().toISOString(),
        position.lastCheckAt?.toISOString() ?? new Date().toISOString(),
        position.id
      ]
    );

    // Record the trigger event
    const triggerId = randomUUID();
    await this.db.query(
      `insert into position_triggers
         (id, position_id, trigger_type, triggered_price_major, triggered_price_currency, triggered_at, close_quantity, close_reason)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        triggerId,
        position.id,
        triggerType,
        triggerMajor,
        triggerCurrency,
        position.closedAt?.toISOString() ?? new Date().toISOString(),
        position.quantity.toString(),
        position.closeReason ?? triggerType
      ]
    );
  }
}
