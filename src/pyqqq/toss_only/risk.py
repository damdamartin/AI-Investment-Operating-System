from __future__ import annotations

import logging

from .config import TossOnlyConfig
from .models import AccountSnapshot, RiskDecision, Signal, TechnicalSetup, TradePlan

logger = logging.getLogger(__name__)


class TossOnlyRiskManager:
    """Small-account aware risk and position sizing for Toss stock trades."""

    def __init__(self, config: TossOnlyConfig):
        self.config = config

    def build_plan(self, account: AccountSnapshot, setup: TechnicalSetup) -> TradePlan | None:
        if setup.signal != Signal.BUY:
            return None
        if setup.entry_price is None or setup.stop_loss is None or setup.take_profit is None:
            logger.error(f"❌ Setup missing prices: {setup.symbol} - entry={setup.entry_price}, stop={setup.stop_loss}, tp={setup.take_profit}")
            return None
        if setup.stop_loss >= setup.entry_price:
            logger.error(f"❌ Invalid stop loss for {setup.symbol}: stop={setup.stop_loss} >= entry={setup.entry_price}")
            return None

        equity = max(account.us_equity, account.cash.usd)
        cash_available = account.cash.usd
        min_cash_after_order = self.config.min_usd_cash_after_order
        min_order_notional = self.config.min_order_notional_usd
        if setup.currency == "KRW":
            equity = max(account.kr_equity, account.cash.krw)
            cash_available = account.cash.krw
            min_cash_after_order = self.config.min_krw_cash_after_order
            min_order_notional = self.config.min_order_notional_krw

        risk_budget = equity * self.config.risk_per_trade_pct
        max_notional = equity * self.config.max_position_pct
        per_share_risk = setup.entry_price - setup.stop_loss

        if per_share_risk <= 0:
            logger.error(f"❌ Invalid risk for {setup.symbol}: per_share_risk={per_share_risk}")
            return None

        risk_sized_qty = risk_budget / per_share_risk
        notional_sized_qty = max_notional / setup.entry_price
        cash_sized_qty = max(0.0, (cash_available - min_cash_after_order) / setup.entry_price)
        quantity = min(risk_sized_qty, notional_sized_qty, cash_sized_qty)

        logger.info(f"📊 Plan sizing for {setup.symbol}: risk_qty={risk_sized_qty:.6f}, notional_qty={notional_sized_qty:.6f}, cash_qty={cash_sized_qty:.6f}, final_qty={quantity:.6f}")

        if setup.market == "KR" or not self.config.fractional_trading_enabled:
            quantity = float(int(quantity))
        else:
            quantity = round(quantity, 6)

        if quantity <= 0:
            logger.error(f"❌ Quantity too small for {setup.symbol}: {quantity}")
            return None

        notional = quantity * setup.entry_price
        return TradePlan(
            symbol=setup.symbol,
            market=setup.market,
            currency=setup.currency,
            side="BUY",
            quantity=quantity,
            entry_price=setup.entry_price,
            stop_loss=setup.stop_loss,
            take_profit=setup.take_profit,
            risk_amount=round(quantity * per_share_risk, 4),
            notional=round(notional, 4),
            confidence=setup.confidence,
            upside_pct=setup.upside_pct,
            downside_pct=setup.downside_pct,
            reward_risk_ratio=setup.reward_risk_ratio,
            rationale=setup.reasoning,
        )

    def validate(self, account: AccountSnapshot, plan: TradePlan) -> RiskDecision:
        reasons: list[str] = []

        if plan.entry_price <= 0 or plan.entry_price in {150, 1000, 10000, 50000, 100000}:
            reasons.append("invalid or placeholder entry price")
        if plan.quantity <= 0:
            reasons.append("quantity must be positive")
        min_order_notional = (
            self.config.min_order_notional_krw if plan.currency == "KRW"
            else self.config.min_order_notional_usd
        )
        cash_available = account.cash.krw if plan.currency == "KRW" else account.cash.usd
        min_cash_after_order = (
            self.config.min_krw_cash_after_order if plan.currency == "KRW"
            else self.config.min_usd_cash_after_order
        )
        equity = account.kr_equity if plan.currency == "KRW" else account.us_equity

        if plan.notional < min_order_notional:
            reasons.append("order notional below minimum")
        if plan.notional > cash_available:
            reasons.append(f"insufficient {plan.currency} cash")
        if cash_available - plan.notional < min_cash_after_order:
            reasons.append(f"minimum {plan.currency} cash after order would be violated")
        if plan.risk_amount > equity * self.config.risk_per_trade_pct * 1.01:
            reasons.append("risk amount exceeds per-trade budget")
        if plan.stop_loss >= plan.entry_price:
            reasons.append("stop loss must be below entry")
        if plan.take_profit <= plan.entry_price:
            reasons.append("take profit must be above entry")
        if plan.reward_risk_ratio is not None and plan.reward_risk_ratio < 1.0:
            reasons.append("reward/risk ratio below 1.0")

        if not reasons:
            logger.info(f"✅ Plan approved for {plan.symbol}: qty={plan.quantity}, notional={plan.notional}")
        else:
            logger.warning(f"⚠️ Plan rejected for {plan.symbol}: {', '.join(reasons)}")

        return RiskDecision(approved=not reasons, reasons=reasons or ["approved"], adjusted_plan=plan)
