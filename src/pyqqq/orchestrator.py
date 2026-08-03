"""
AI 총괄 관리자(Orchestrator) - 4팀의 신호를 수집하고 최종 거래 결정을 내립니다.
리서치팀, 종목분석팀, 매매전략팀, 리스크관리팀의 의견을 통합해서 최종 신호를 결정합니다.
"""

import json
from datetime import datetime
from typing import List, Dict, Any, Optional
import asyncio
from dataclasses import dataclass


@dataclass
class CycleRecord:
    """매매 사이클 기록 - AI Hedge Fund v2 개념 차용"""
    cycle_id: str
    timestamp: datetime
    symbols_analyzed: List[str]
    research_signals: Dict[str, Any]
    analysis_signals: Dict[str, Any]
    strategy_signals: Dict[str, Any]
    final_signals: Dict[str, Any]
    executed_trades: List[Dict]
    portfolio_state: Dict[str, Any]
    performance_metrics: Dict[str, Any]


class AIOrchestrator:
    """
    AI 총괄 관리자
    - 4팀의 신호를 수집
    - 가중 앙상블로 최종 신호 결정
    - 거래 실행
    - 성과 평가
    """

    def __init__(self):
        self.research_agent = None
        self.analysis_agent = None
        self.strategy_agent = None
        self.watchlist_manager = None
        self.order_engine = None
        self.monitor = None

        # 팀별 신뢰도 가중치 (초기값)
        self.weights = {
            "research": 0.25,
            "analysis": 0.35,
            "strategy": 0.25,
            "trend": 0.15
        }

        self.cycles = []  # CycleRecord 저장

    def set_agents(
        self,
        research_agent,
        analysis_agent,
        strategy_agent,
        watchlist_manager,
        order_engine,
        monitor
    ):
        """각 팀의 에이전트 설정"""
        self.research_agent = research_agent
        self.analysis_agent = analysis_agent
        self.strategy_agent = strategy_agent
        self.watchlist_manager = watchlist_manager
        self.order_engine = order_engine
        self.monitor = monitor

    async def run_trading_cycle(
        self,
        watchlist: List[Dict],
        portfolio_value: float,
        current_positions: Dict = None
    ) -> CycleRecord:
        """
        전체 거래 사이클을 실행합니다.

        Args:
            watchlist: 분석할 종목 리스트
            portfolio_value: 포트폴리오 총액
            current_positions: 현재 보유 포지션

        Returns:
            CycleRecord: 이 사이클의 모든 기록
        """

        cycle_id = self._generate_cycle_id()
        cycle_start = datetime.now()
        current_positions = current_positions or {}

        print(f"\n{'='*60}")
        print(f"📊 거래 사이클 시작: {cycle_id}")
        print(f"{'='*60}")

        # 1단계: 각 팀의 신호 수집 (병렬 처리)
        print("\n[Step 1] 신호 생성...")
        research_signals = await self._collect_research_signals(watchlist)
        analysis_signals = await self._collect_analysis_signals(watchlist)
        strategy_signals = await self._collect_strategy_signals(
            watchlist, research_signals, analysis_signals, portfolio_value
        )

        # 2단계: 신호 통합 (앙상블)
        print("\n[Step 2] 신호 앙상블...")
        final_signals = self._ensemble_signals(
            research_signals,
            analysis_signals,
            strategy_signals
        )

        # 3단계: 워치리스트 업데이트
        print("\n[Step 3] 워치리스트 업데이트...")
        watchlist_update = await self._update_watchlist(
            watchlist, final_signals, current_positions
        )

        # 4단계: 거래 실행
        print("\n[Step 4] 거래 실행...")
        executed_trades = await self._execute_trades(final_signals, portfolio_value)

        # 5단계: 성과 평가
        print("\n[Step 5] 성과 평가...")
        performance = await self._evaluate_performance(executed_trades)

        # 사이클 기록 저장
        cycle = CycleRecord(
            cycle_id=cycle_id,
            timestamp=cycle_start,
            symbols_analyzed=[s.get("code") for s in watchlist],
            research_signals=research_signals,
            analysis_signals=analysis_signals,
            strategy_signals=strategy_signals,
            final_signals=final_signals,
            executed_trades=executed_trades,
            portfolio_state={
                "portfolio_value": portfolio_value,
                "positions": current_positions
            },
            performance_metrics=performance
        )

        self.cycles.append(cycle)

        print(f"\n✅ 거래 사이클 완료: {len(executed_trades)}건의 거래 실행")
        print(f"{'='*60}\n")

        return cycle

    async def _collect_research_signals(self, watchlist: List[Dict]) -> Dict[str, Any]:
        """리서치팀 신호 수집"""

        if not self.research_agent:
            return {}

        signals = {}
        for symbol_info in watchlist:
            signal = self.research_agent.analyze_symbol(
                symbol_info.get("code"),
                symbol_info.get("name")
            )
            signals[symbol_info.get("code")] = signal

        return signals

    async def _collect_analysis_signals(self, watchlist: List[Dict]) -> Dict[str, Any]:
        """종목분석팀 신호 수집"""

        if not self.analysis_agent:
            return {}

        signals = {}
        for symbol_info in watchlist:
            # 실제로는 현재가, 기술지표 등을 조회해야 함
            signal = self.analysis_agent.analyze_symbol(
                symbol_info.get("code"),
                symbol_info.get("name"),
                current_price=0,  # 실제 가격으로 교체 필요
            )
            signals[symbol_info.get("code")] = signal

        return signals

    async def _collect_strategy_signals(
        self,
        watchlist: List[Dict],
        research_signals: Dict,
        analysis_signals: Dict,
        portfolio_value: float
    ) -> Dict[str, Any]:
        """매매전략팀 신호 수집"""

        if not self.strategy_agent:
            return {}

        signals = {}
        for symbol_info in watchlist:
            code = symbol_info.get("code")

            if code not in research_signals or code not in analysis_signals:
                continue

            strategy = self.strategy_agent.generate_trade_plan(
                symbol=code,
                symbol_name=symbol_info.get("name"),
                market=symbol_info.get("market", "KR"),
                research_signal=research_signals[code],
                analysis_signal=analysis_signals[code],
                current_price=0,  # 실제 가격으로 교체 필요
                portfolio_value=portfolio_value
            )
            signals[code] = strategy

        return signals

    def _ensemble_signals(
        self,
        research_signals: Dict,
        analysis_signals: Dict,
        strategy_signals: Dict
    ) -> Dict[str, Any]:
        """
        다중 신호를 가중 앙상블로 통합합니다.
        """

        final_signals = {}

        # 공통 종목만 처리
        common_symbols = set(research_signals.keys()) & set(analysis_signals.keys())

        for symbol in common_symbols:
            research = research_signals.get(symbol, {})
            analysis = analysis_signals.get(symbol, {})
            strategy = strategy_signals.get(symbol, {})

            # 신호를 점수로 변환
            research_score = self._signal_to_score(research.get("signal"))
            analysis_score = self._signal_to_score(analysis.get("signal"))
            strategy_score = self._signal_to_score(strategy.get("action"))

            # 가중 평균
            ensemble_score = (
                research_score * self.weights["research"] +
                analysis_score * self.weights["analysis"] +
                strategy_score * self.weights["strategy"]
            )

            # 점수를 신호로 변환
            if ensemble_score >= 0.65:
                final_signal = "BUY"
            elif ensemble_score <= 0.35:
                final_signal = "SELL"
            else:
                final_signal = "HOLD"

            final_signals[symbol] = {
                "signal": final_signal,
                "ensemble_score": ensemble_score,
                "confidence": abs(ensemble_score - 0.5) * 2,  # 0.5에서 멀수록 신뢰도 높음
                "components": {
                    "research": research.get("signal"),
                    "analysis": analysis.get("signal"),
                    "strategy": strategy.get("action")
                }
            }

        return final_signals

    async def _update_watchlist(
        self,
        current_watchlist: List[Dict],
        signals: Dict,
        current_positions: Dict
    ) -> Dict[str, Any]:
        """워치리스트 동적 업데이트"""

        if not self.watchlist_manager:
            return {"watchlist": current_watchlist}

        # 신호를 리스트 형식으로 변환
        signal_list = [
            {
                "symbol": symbol,
                "signal": data.get("signal"),
                "confidence": data.get("confidence", 0)
            }
            for symbol, data in signals.items()
        ]

        update_result = self.watchlist_manager.update_watchlist(
            current_watchlist, signal_list
        )

        return update_result

    async def _execute_trades(
        self,
        signals: Dict,
        portfolio_value: float
    ) -> List[Dict]:
        """
        최종 신호를 기반으로 거래를 실행합니다.
        """

        if not self.order_engine:
            return []

        executed_trades = []

        for symbol, signal_data in signals.items():
            if signal_data.get("signal") != "BUY":
                continue

            # 실제 거래 실행 (mock)
            # 실제 구현에서는 order_engine.execute_order() 호출

            trade = {
                "symbol": symbol,
                "action": "BUY",
                "quantity": 0,  # 실제 수량으로 교체 필요
                "price": 0,  # 실제 가격으로 교체 필요
                "confidence": signal_data.get("confidence", 0),
                "timestamp": datetime.now().isoformat()
            }

            executed_trades.append(trade)

        return executed_trades

    async def _evaluate_performance(
        self,
        executed_trades: List[Dict]
    ) -> Dict[str, Any]:
        """
        성과를 평가하고 팀별 정확도를 계산합니다.
        """

        if not executed_trades:
            return {
                "trades_count": 0,
                "success_rate": 0,
                "avg_return": 0,
                "team_scores": {}
            }

        # 추후 실제 거래 결과와 비교해서 정확도 계산
        return {
            "trades_count": len(executed_trades),
            "success_rate": 0,  # 추후 계산
            "avg_return": 0,    # 추후 계산
            "team_scores": {
                "research": 0.5,
                "analysis": 0.5,
                "strategy": 0.5
            }
        }

    def update_weights(self, new_weights: Dict[str, float]) -> None:
        """
        팀의 가중치를 업데이트합니다.
        성과평가 결과에 따라 자동으로 조정됩니다.
        """

        total = sum(new_weights.values())
        self.weights = {k: v / total for k, v in new_weights.items()}

        print(f"✅ 가중치 업데이트:")
        for team, weight in self.weights.items():
            print(f"   {team}: {weight:.1%}")

    def _signal_to_score(self, signal: str) -> float:
        """신호를 점수로 변환 (0~1)"""

        signal_map = {
            "BUY": 1.0,
            "HOLD": 0.5,
            "SELL": 0.0,
            None: 0.5
        }

        return signal_map.get(signal, 0.5)

    def _generate_cycle_id(self) -> str:
        """사이클 ID 생성"""
        return f"CYCLE_{datetime.now().strftime('%Y%m%d%H%M%S')}"

    def get_cycle_history(self, limit: int = 10) -> List[CycleRecord]:
        """사이클 기록 조회"""
        return self.cycles[-limit:]

    def generate_daily_report(self) -> Dict[str, Any]:
        """일일 리포트 생성"""

        today_cycles = [c for c in self.cycles if c.timestamp.date() == datetime.now().date()]

        if not today_cycles:
            return {"status": "no_data"}

        total_trades = sum(len(c.executed_trades) for c in today_cycles)
        total_pnl = 0  # 실제로는 P&L 계산

        return {
            "date": datetime.now().isoformat(),
            "cycles_count": len(today_cycles),
            "total_trades": total_trades,
            "total_pnl": total_pnl,
            "team_performance": self._calculate_team_performance(today_cycles)
        }

    def _calculate_team_performance(self, cycles: List[CycleRecord]) -> Dict[str, Any]:
        """팀별 성과 계산"""

        return {
            "research": {"accuracy": 0, "signals": 0},
            "analysis": {"accuracy": 0, "signals": 0},
            "strategy": {"accuracy": 0, "signals": 0}
        }


if __name__ == "__main__":
    orchestrator = AIOrchestrator()
    print("AI 총괄 관리자(Orchestrator)가 준비되었습니다.")
