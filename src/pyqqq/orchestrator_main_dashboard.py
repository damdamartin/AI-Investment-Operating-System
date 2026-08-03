"""
팀장용 통합 대시보드
시간대별로 자동 전환:
- 09:00~15:30: 간단 대시보드 (실시간 모니터링)
- 15:30 이후: 일일보고서 (시장현황 + 전략 + 결과)
"""

import asyncio
from datetime import datetime
from typing import Dict, Any
from dashboard_simple import SimpleTeamLeadDashboard
from daily_report import DailyReport


class OrchestratorMainDashboard:
    """팀장용 통합 대시보드 (자동 전환)"""

    def __init__(self):
        self.simple_dashboard = SimpleTeamLeadDashboard()
        self.daily_report = DailyReport()

    async def show_dashboard(self, trading_data: Dict[str, Any] = None) -> None:
        """시간대별로 자동 전환하는 대시보드"""

        now = datetime.now()
        hour = now.hour
        minute = now.minute

        # 거래 시간 여부 판단
        if 9 <= hour < 15.5 or (hour == 15 and minute < 30):
            # 09:00~15:30: 간단 대시보드
            await self._show_simple_dashboard()
        elif hour >= 15 and minute >= 30 or hour > 15:
            # 15:30 이후: 일일보고서
            if trading_data:
                await self._show_daily_report(trading_data)
            else:
                print("\n⚠️ 일일보고서를 표시하려면 거래 데이터가 필요합니다.")
                print("   usage: await orchestrator.show_dashboard(trading_data=data)")
        else:
            # 그 외: 준비 중
            await self._show_preparing_dashboard()

    async def _show_simple_dashboard(self) -> None:
        """간단 대시보드 (09:00~15:30)"""

        await self.simple_dashboard.print_dashboard()

    async def _show_daily_report(self, trading_data: Dict[str, Any]) -> None:
        """일일보고서 (15:30 이후)"""

        await self.daily_report.generate_daily_report(trading_data)

    async def _show_preparing_dashboard(self) -> None:
        """준비 중 대시보드 (장 시간 외)"""

        now = datetime.now()
        hour = now.hour
        minute = now.minute
        current_time = f"{hour:02d}:{minute:02d}"

        # 현재 단계
        if 6 <= hour < 8.5:
            phase = "📊 사전분석중 (06:30~08:00)"
        elif 8.5 <= hour < 9:
            phase = "👥 팀회의중 (08:00~09:00)"
        else:
            phase = "⏳ 준비 중"

        print("\n" + "="*70)
        print("📊 AI 자동매매 - 팀장 현황판")
        print("="*70)
        print(f"\n⏰ 시간: {current_time}")
        print(f"📍 상태: {phase}")
        print(f"\n💡 09:00 장 오픈 대기 중...")
        print("   → 09:00 정확히 거래 시작")
        print("   → 15:30 장 마감 시 일일보고서 자동 전환")
        print("\n" + "="*70 + "\n")


# 테스트
async def test():
    """테스트"""

    orchestrator = OrchestratorMainDashboard()

    # 현재 시간에 따라 자동으로 대시보드 전환
    print("\n[테스트 1] 현재 시간에 따른 자동 전환")
    await orchestrator.show_dashboard()

    # 거래 데이터와 함께 호출하면 일일보고서 표시
    print("\n[테스트 2] 일일보고서 (거래 데이터 포함)")
    sample_trading_data = {
        'results': {
            'total_trades': 3,
            'successful_trades': 2,
            'failed_trades': 1,
            'win_rate': 66.7,
            'total_pnl': 45000,
            'total_pnl_pct': 0.45,
            'avg_pnl_per_trade': 15000,
            'best_trade': 'Samsung +3.1%',
            'worst_trade': 'SK Hynix -1.2%',
            'max_drawdown': -2.1,
            'stop_loss_compliance': 100,
            'order_execution_speed': 0.8
        },
        'team_performance': {
            'research': {
                'accuracy': 75,
                'feedback': '삼성전자 실적 정확 분석'
            },
            'analysis': {
                'accuracy': 95,
                'feedback': 'VWAP 기반 진입 효과적'
            },
            'strategy': {
                'accuracy': 85,
                'feedback': '포지션 최적화'
            },
            'risk': {
                'accuracy': 100,
                'feedback': '손절 준수율 100%'
            }
        }
    }

    # 강제로 일일보고서 표시 (테스트용)
    print("\n[강제 표시] 일일보고서 (15:30 이후)")
    await orchestrator._show_daily_report(sample_trading_data)


if __name__ == "__main__":
    asyncio.run(test())
