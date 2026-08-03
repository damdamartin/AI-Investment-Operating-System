"""
AI 자동매매 시스템 - 전체 통합 시스템
4인 에이전트 팀을 통합하는 메인 엔트리포인트입니다.

사용법:
    from ai_auto_trading_system import AIAutoTradingSystem

    system = AIAutoTradingSystem()
    await system.start()
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Any
import os

from research_agent import ResearchAgent
from analysis_agent import AnalysisAgent
from strategy_agent import StrategyAgent
from watchlist_manager import WatchlistManager
from order_execution_engine import OrderExecutionEngine
from realtime_monitor import RealtimeMonitor
from orchestrator import AIOrchestrator
from performance_evaluator import PerformanceEvaluator


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AIAutoTradingSystem:
    """
    AI 자동매매 시스템 - 4인 에이전트 팀 통합

    팀 구성:
    - 팀장: AI 총괄 관리자(Orchestrator)
    - 팀원1: 리서치팀 + 종목분석팀
    - 팀원2: 매매전략팀 + 리스트관리팀
    - 팀원3: 주문실행엔진 + 실시간모니터링
    """

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or self._load_default_config()
        self.running = False

        # 팀원1: 리서치 + 분석 에이전트
        self.research_agent = ResearchAgent()
        self.analysis_agent = AnalysisAgent()

        # 팀원2: 매매전략 + 리스트관리 에이전트
        self.strategy_agent = StrategyAgent()
        self.watchlist_manager = WatchlistManager()

        # 팀원3: 주문실행 + 모니터링
        self.order_engine = OrderExecutionEngine()
        self.monitor = RealtimeMonitor()

        # 팀장: 총괄 관리자
        self.orchestrator = AIOrchestrator()
        self.performance_evaluator = PerformanceEvaluator()

        # 에이전트 연결
        self._setup_agents()

        logger.info("✅ AI 자동매매 시스템 초기화 완료")
        logger.info("   - 팀원1: 리서치/분석 에이전트")
        logger.info("   - 팀원2: 매매전략/리스트관리 에이전트")
        logger.info("   - 팀원3: 주문실행/모니터링")
        logger.info("   - 팀장: AI 총괄 관리자")

    def _load_default_config(self) -> Dict[str, Any]:
        """기본 설정 로드"""
        return {
            "update_interval_seconds": 60,  # 1분마다 사이클 실행
            "watchlist": [
                {"code": "005930", "name": "Samsung Electronics", "market": "KR"},
                {"code": "000660", "name": "SK Hynix", "market": "KR"},
            ],
            "portfolio_value": 1000000,
            "max_positions": 5,
            "stop_loss_pct": {"KR": 0.02, "US": 0.05},
            "take_profit_pct": {"KR": 0.03, "US": 0.10}
        }

    def _setup_agents(self):
        """에이전트들을 서로 연결"""

        # Orchestrator에 모든 에이전트 설정
        self.orchestrator.set_agents(
            research_agent=self.research_agent,
            analysis_agent=self.analysis_agent,
            strategy_agent=self.strategy_agent,
            watchlist_manager=self.watchlist_manager,
            order_engine=self.order_engine,
            monitor=self.monitor
        )

        # 모니터에 주문 엔진 설정
        self.monitor.set_order_engine(self.order_engine)

        logger.info("✅ 에이전트 연결 완료")

    async def start(self):
        """자동매매 시스템 시작"""

        self.running = True
        logger.info("🚀 AI 자동매매 시스템 시작")

        try:
            # 실시간 모니터링 시작 (별도 태스크)
            monitor_task = asyncio.create_task(self.monitor.start_monitoring())

            # 거래 사이클 시작
            while self.running:
                try:
                    await self._run_trading_cycle()
                    await asyncio.sleep(self.config["update_interval_seconds"])
                except KeyboardInterrupt:
                    logger.info("사용자가 시스템을 중지했습니다.")
                    break
                except Exception as e:
                    logger.error(f"거래 사이클 오류: {e}")
                    await asyncio.sleep(30)

        finally:
            await self.stop()

    async def _run_trading_cycle(self):
        """거래 사이클 실행"""

        try:
            cycle = await self.orchestrator.run_trading_cycle(
                watchlist=self.config["watchlist"],
                portfolio_value=self.config["portfolio_value"]
            )

            # 성과 평가
            self._evaluate_cycle_performance(cycle)

        except Exception as e:
            logger.error(f"사이클 실행 오류: {e}")

    def _evaluate_cycle_performance(self, cycle):
        """사이클 성과 평가"""

        # 실제 구현에서는 거래 결과를 받아서
        # performance_evaluator.record_signal() 호출
        pass

    async def stop(self):
        """자동매매 시스템 중지"""

        logger.info("⏹️ AI 자동매매 시스템 중지 중...")
        self.running = False
        self.monitor.stop_monitoring()

        # 최종 리포트 생성
        self._generate_final_report()

        logger.info("✅ AI 자동매매 시스템 중지 완료")

    def _generate_final_report(self):
        """최종 리포트 생성"""

        report = {
            "timestamp": datetime.now().isoformat(),
            "system_status": "stopped",
            "total_cycles": len(self.orchestrator.cycles),
            "performance": self.performance_evaluator.generate_daily_report(),
            "improvements": self.performance_evaluator.generate_improvement_suggestions()
        }

        logger.info("\n" + "="*60)
        logger.info("📊 최종 성과 리포트")
        logger.info("="*60)
        logger.info(f"총 거래 사이클: {report['total_cycles']}")
        logger.info(f"전체 정확도: {report['performance'].get('overall_accuracy', 0):.1%}")
        logger.info(f"평균 수익률: {report['performance'].get('avg_return', 0):+.2%}")
        logger.info("="*60 + "\n")

    def get_system_status(self) -> Dict[str, Any]:
        """시스템 상태 조회"""

        return {
            "running": self.running,
            "uptime": datetime.now().isoformat(),
            "orchestrator_cycles": len(self.orchestrator.cycles),
            "positions": self.monitor.get_portfolio_status(),
            "team_performance": {
                "research": self.performance_evaluator.get_team_accuracy("research"),
                "analysis": self.performance_evaluator.get_team_accuracy("analysis"),
                "strategy": self.performance_evaluator.get_team_accuracy("strategy")
            }
        }

    def generate_report(self, filepath: str = None) -> None:
        """리포트 생성 및 저장"""

        filepath = filepath or f"trading_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        self.performance_evaluator.export_metrics(filepath)
        logger.info(f"📄 리포트 저장: {filepath}")


async def main():
    """메인 엔트리포인트"""

    # 자동매매 시스템 시작
    system = AIAutoTradingSystem()

    try:
        await system.start()
    except KeyboardInterrupt:
        logger.info("키보드 인터럽트 감지")
        await system.stop()
    except Exception as e:
        logger.error(f"시스템 오류: {e}")
        await system.stop()


if __name__ == "__main__":
    asyncio.run(main())
