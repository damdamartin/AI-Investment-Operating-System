"""
팀장용 간단한 대시보드 - 핵심만 한눈에
"""

import asyncio
from datetime import datetime
from typing import Dict, Any


class SimpleTeamLeadDashboard:
    """팀장이 한눈에 파악하는 간단한 대시보드"""

    def __init__(self):
        self.current_portfolio = {
            'total_assets': 298956,
            'cash': 70000,
            'invested': 228956,
        }
        self.positions = []
        self.daily_pnl = 0
        self.daily_pnl_pct = 0.0

    async def print_dashboard(self) -> None:
        """간단한 대시보드 출력"""

        now = datetime.now()
        hour = now.hour
        minute = now.minute
        current_time = f"{hour:02d}:{minute:02d}"

        # 현재 단계 판단
        if 6 <= hour < 8.5:
            phase = "📊 사전분석중 (06:30~08:00)"
            phase_emoji = "🔵"
        elif 8.5 <= hour < 9:
            phase = "👥 팀회의중 (08:00~09:00)"
            phase_emoji = "🟣"
        elif 9 <= hour < 9.5:
            phase = "⚡ 개장폭발 (09:00~09:30)"
            phase_emoji = "🔴"
        elif 9.5 <= hour < 15.5:
            phase = "📈 정상거래중 (09:30~15:30)"
            phase_emoji = "🟢"
        elif 15.5 <= hour < 16:
            phase = "🏁 장마감정리 (15:30~16:00)"
            phase_emoji = "🟡"
        elif 16 <= hour < 18:
            phase = "📋 일일리포트 (16:00~18:00)"
            phase_emoji = "🟠"
        elif 18 <= hour < 19:
            phase = "🏆 팀회의평가 (18:00~19:00)"
            phase_emoji = "🟣"
        else:
            phase = "⏳ 대기중"
            phase_emoji = "⚪"

        # 간단한 대시보드 출력
        print("\n" + "="*70)
        print("📊 AI 자동매매 - 팀장 현황판")
        print("="*70)

        # 1. 현재 시간 및 단계
        print(f"\n⏰ 시간: {current_time}")
        print(f"{phase_emoji} 상태: {phase}")

        # 2. 포트폴리오 (가장 중요)
        print(f"\n💰 포트폴리오")
        print(f"   총자산: ₩{self.current_portfolio['total_assets']:,}")
        print(f"   현금: ₩{self.current_portfolio['cash']:,}")
        print(f"   투자액: ₩{self.current_portfolio['invested']:,}")

        # 3. 거래 상태 (진행 중인 것만)
        print(f"\n📈 거래 상태")
        if self.positions:
            for pos in self.positions:
                print(f"   {pos['symbol']} {pos['name']}: {pos['quantity']}주 (손익 {pos['pnl_pct']:+.2%})")
        else:
            print(f"   진행 중인 거래 없음")

        # 4. 오늘의 수익 (가장 관심 있는 정보)
        print(f"\n📊 오늘의 성과")
        print(f"   수익/손실: ₩{self.daily_pnl:+,} ({self.daily_pnl_pct:+.2%})")

        # 5. 다음 할 일 (간단히)
        if 6 <= hour < 9:
            next_action = "09:00 거래 시작 준비"
        elif 9 <= hour < 15.5:
            next_action = "실시간 모니터링 (손절/익절)"
        elif 15.5 <= hour < 16:
            next_action = "모든 포지션 청산"
        elif 16 <= hour < 18:
            next_action = "일일 거래 분석"
        elif 18 <= hour < 19:
            next_action = "팀 성과 회의"
        else:
            next_action = "내일 준비"

        print(f"\n⏭️ 다음: {next_action}")

        print("\n" + "="*70 + "\n")


if __name__ == "__main__":
    async def test():
        dashboard = SimpleTeamLeadDashboard()
        dashboard.current_portfolio = {
            'total_assets': 298956,
            'cash': 70000,
            'invested': 228956,
        }
        dashboard.positions = [
            {'symbol': '005930', 'name': 'Samsung', 'quantity': 2, 'pnl_pct': 0.015},
            {'symbol': '000660', 'name': 'SK Hynix', 'quantity': 1, 'pnl_pct': -0.001},
        ]
        dashboard.daily_pnl = 12000
        dashboard.daily_pnl_pct = 0.04

        await dashboard.print_dashboard()

    asyncio.run(test())
