/**
 * Risk Validator
 * 주문 전 위험 및 자금 검증
 */

import type { D1Database } from "@cloudflare/workers-types";
import type { CryptoSignal } from "../strategy/signal-generator.js";

export interface RiskCheckResult {
  passed: boolean;
  dailyLossExceeded: boolean;
  maxPositionExceeded: boolean;
  killSwitchActive: boolean;
  reasons: string[];
}

export interface MoneyCheckResult {
  passed: boolean;
  availableBalance: number;
  requiredAmount: number;
  reasons: string[];
}

export class RiskValidator {
  private db: D1Database;
  private killSwitchActive = false;
  private dailyLossLimit = -0.02; // -2% (손실 한도)
  private maxPositionSizePercent = 0.1; // 10% (최대 포지션)

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * 리스크 검증
   */
  async validateRisk(signal: CryptoSignal, quantity: number, accountValue: number): Promise<RiskCheckResult> {
    const reasons: string[] = [];

    // 1. 킬 스위치 확인
    if (this.killSwitchActive) {
      return {
        passed: false,
        dailyLossExceeded: false,
        maxPositionExceeded: false,
        killSwitchActive: true,
        reasons: ["Kill switch is active"]
      };
    }

    // 2. 일일 손실 한도 확인
    const dailyLoss = await this.getDailyLoss();
    const dailyLossExceeded = dailyLoss < this.dailyLossLimit * accountValue;
    if (dailyLossExceeded) {
      reasons.push(`Daily loss limit exceeded: ${dailyLoss.toFixed(0)} / ${(this.dailyLossLimit * accountValue).toFixed(0)}`);
    }

    // 3. 최대 포지션 크기 확인
    const positionValue = quantity * signal.price;
    const maxPositionValue = accountValue * this.maxPositionSizePercent;
    const maxPositionExceeded = positionValue > maxPositionValue;
    if (maxPositionExceeded) {
      reasons.push(
        `Max position size exceeded: ${(positionValue / accountValue * 100).toFixed(2)}% / ${(this.maxPositionSizePercent * 100).toFixed(2)}%`
      );
    }

    // 4. 신호 신뢰도 확인
    if (signal.confidence < 0.5) {
      reasons.push(`Signal confidence too low: ${(signal.confidence * 100).toFixed(0)}%`);
    }

    return {
      passed: !dailyLossExceeded && !maxPositionExceeded && signal.confidence >= 0.5,
      dailyLossExceeded,
      maxPositionExceeded,
      killSwitchActive: false,
      reasons
    };
  }

  /**
   * 자금 검증
   */
  async validateMoney(quantity: number, price: number, accounts: Array<{ currency: string; balance: number }>): Promise<MoneyCheckResult> {
    const reasons: string[] = [];

    // KRW 잔액 확인
    const krwAccount = accounts.find((a) => a.currency === "KRW");
    if (!krwAccount) {
      return {
        passed: false,
        availableBalance: 0,
        requiredAmount: quantity * price,
        reasons: ["KRW account not found"]
      };
    }

    const requiredAmount = quantity * price * 1.001; // 0.1% 수수료 포함
    const availableBalance = krwAccount.balance;

    if (availableBalance < requiredAmount) {
      reasons.push(
        `Insufficient balance: ${availableBalance.toFixed(0)} < ${requiredAmount.toFixed(0)}`
      );
      return {
        passed: false,
        availableBalance,
        requiredAmount,
        reasons
      };
    }

    return {
      passed: true,
      availableBalance,
      requiredAmount,
      reasons
    };
  }

  /**
   * 일일 손실 조회
   */
  private async getDailyLoss(): Promise<number> {
    try {
      const today = new Date().toISOString().split("T")[0];
      const result = await this.db
        .prepare(
          `
        SELECT SUM(profit_loss) as total_loss FROM crypto_fills
        WHERE DATE(filled_at) = ?
      `
        )
        .bind(today)
        .first<{ total_loss: number | null }>();

      return result?.total_loss ?? 0;
    } catch (error) {
      console.error(`[RiskValidator] Error getting daily loss: ${error}`);
      return 0;
    }
  }

  /**
   * 킬 스위치 활성화
   */
  activateKillSwitch(reason: string): void {
    this.killSwitchActive = true;
    console.error(`[RiskValidator] Kill switch activated: ${reason}`);
  }

  /**
   * 킬 스위치 해제
   */
  deactivateKillSwitch(): void {
    this.killSwitchActive = false;
    console.log(`[RiskValidator] Kill switch deactivated`);
  }

  /**
   * 킬 스위치 상태
   */
  isKillSwitchActive(): boolean {
    return this.killSwitchActive;
  }

  /**
   * 설정 변경
   */
  setLimits(dailyLossPercent: number, maxPositionPercent: number): void {
    this.dailyLossLimit = dailyLossPercent;
    this.maxPositionSizePercent = maxPositionPercent;
    console.log(
      `[RiskValidator] Limits updated: daily_loss=${(dailyLossPercent * 100).toFixed(2)}%, max_position=${(maxPositionPercent * 100).toFixed(2)}%`
    );
  }
}
