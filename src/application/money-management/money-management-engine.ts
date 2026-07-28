import type { OrderIntent } from "../../domain/orders/index.js";
import { CashBalance, MoneyCheck } from "../../domain/portfolio/index.js";
import type { Money } from "../../domain/value-objects/index.js";

export interface MoneyManagementLimits {
  maxOrderAmount: Money;
  maxStrategyAllocation: Money;
  minCashAfterOrder: Money;
}

export interface MoneyManagementState {
  cashBalance: CashBalance;
  currentStrategyAllocation: Money;
}

export interface MoneyManagementInput {
  moneyCheckId: string;
  orderIntent: OrderIntent;
  requestedAmount: Money;
  state: MoneyManagementState;
  limits: MoneyManagementLimits;
  checkedAt: Date;
}

export interface MoneyManagementOutput {
  moneyCheck: MoneyCheck;
  reasonCodes: string[];
  cashAfterOrder: Money | undefined;
  safetyType: "MONEY_MANAGEMENT_CHECK_ONLY";
}

export class MoneyManagementEngine {
  evaluate(input: MoneyManagementInput): MoneyManagementOutput {
    const reasonCodes: string[] = [];
    assertSameCurrency(input.requestedAmount, input.state.cashBalance.available, "requested amount");
    assertSameCurrency(input.limits.maxOrderAmount, input.requestedAmount, "max order amount");
    assertSameCurrency(input.limits.maxStrategyAllocation, input.requestedAmount, "max strategy allocation");
    assertSameCurrency(input.limits.minCashAfterOrder, input.requestedAmount, "minimum cash after order");
    assertSameCurrency(input.state.currentStrategyAllocation, input.requestedAmount, "current strategy allocation");

    const cashAfterOrder = input.state.cashBalance.available.subtract(input.requestedAmount);
    const strategyAllocationAfterOrder = input.state.currentStrategyAllocation.add(input.requestedAmount);

    if (input.state.cashBalance.available.isLessThan(input.requestedAmount)) {
      reasonCodes.push("insufficient_available_cash");
    }

    if (input.requestedAmount.isGreaterThan(input.limits.maxOrderAmount)) {
      reasonCodes.push("max_order_amount_exceeded");
    }

    if (strategyAllocationAfterOrder.isGreaterThan(input.limits.maxStrategyAllocation)) {
      reasonCodes.push("max_strategy_allocation_exceeded");
    }

    if (cashAfterOrder.isLessThan(input.limits.minCashAfterOrder)) {
      reasonCodes.push("minimum_cash_after_order_breached");
    }

    const moneyCheck = new MoneyCheck({
      id: input.moneyCheckId,
      orderIntentId: input.orderIntent.id,
      result: reasonCodes.length > 0 ? "FAIL" : "PASS",
      ...(reasonCodes.length > 0
        ? {}
        : {
            approvedQuantity: input.orderIntent.quantity,
            approvedAmount: input.requestedAmount,
            cashAfterOrder
          }),
      reasons: reasonCodes,
      checkedAt: input.checkedAt
    });

    return {
      moneyCheck,
      reasonCodes,
      cashAfterOrder: reasonCodes.length > 0 ? undefined : cashAfterOrder,
      safetyType: "MONEY_MANAGEMENT_CHECK_ONLY"
    };
  }
}

function assertSameCurrency(left: Money, right: Money, label: string): void {
  left.compare(right);
  void label;
}
