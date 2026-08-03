"""
장 마감 후 일일보고서 (15:30 이후)
시장현황 → 매매전략 → 거래결과
"""

import asyncio
from datetime import datetime
from typing import Dict, Any, List
import anthropic
from config import settings


class DailyReport:
    """장 마감 후 일일보고서"""

    def __init__(self):
        self.report_date = datetime.now().strftime('%Y-%m-%d')
        self.report_time = "15:30"
        self.claude_client = anthropic.Anthropic(api_key=settings.claude_api_key)

    async def generate_daily_report(self, trading_data: Dict[str, Any]) -> str:
        """일일보고서 생성"""

        # 1. 시장현황 수집
        market_status = await self._get_market_status()

        # 2. 오늘의 매매전략 (시장현황 기반)
        trading_strategy = await self._analyze_trading_strategy(market_status)

        # 3. 거래결과
        trading_results = trading_data.get('results', {})

        # 4. 팀별 성과
        team_performance = trading_data.get('team_performance', {})

        # 5. 보고서 생성
        report = self._format_report(
            market_status,
            trading_strategy,
            trading_results,
            team_performance
        )

        self._print_report(report)
        return report

    async def _get_market_status(self) -> Dict[str, Any]:
        """시장현황 조회"""

        return {
            'date': self.report_date,
            'time': '15:30',
            'kospi': {
                'value': 2520,
                'change': '+1.2%',
                'trend': '상승',
                'sentiment': '강세'
            },
            'foreign_investor': {
                'net_buy': 150000000000,  # 1500억원 순매수
                'trend': '순매수'
            },
            'institutional_investor': {
                'net_buy': -80000000000,  # 800억원 순매도
                'trend': '순매도'
            },
            'individual_investor': {
                'net_buy': -70000000000,  # 700억원 순매도
                'trend': '순매도'
            },
            'key_news': [
                '삼성전자 Q2 영업이익 사상 최대',
                '반도체 수급 심화로 가격 상승',
                '원화 약세 지속 (1,140원/달러)'
            ],
            'won_usd': 1140,
            'won_usd_trend': '약세',
            'market_outlook': '긍정적'
        }

    async def _analyze_trading_strategy(self, market_status: Dict[str, Any]) -> str:
        """시장현황 기반 매매전략 분석"""

        prompt = f"""
당신은 투자 전략가입니다. 오늘의 시장현황을 분석하고 내일의 매매전략을 제시하세요.

[오늘 시장현황]
- KOSPI: {market_status['kospi']['value']} ({market_status['kospi']['change']})
- 시장 심리: {market_status['kospi']['sentiment']}
- 외국인: 순매수 {market_status['foreign_investor']['net_buy']//1000000000}억원
- 기관: 순매도 {market_status['institutional_investor']['net_buy']//1000000000}억원
- 개인: 순매도 {market_status['individual_investor']['net_buy']//1000000000}억원
- 주요 뉴스: {', '.join(market_status['key_news'])}
- 원/달러: {market_status['won_usd']}원 (약세 지속)

[요구사항]
간단하게 2-3줄로 내일 예상되는 시장과 매매전략을 제시하세요.

응답 형식:
시장 전망: [내일 예상 시장]
매매 전략: [추천 거래 방식]
주의사항: [주의할 점]
"""

        try:
            message = self.claude_client.messages.create(
                model=settings.claude_model,
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}]
            )
            return message.content[0].text
        except Exception as e:
            return f"시장 분석 불가 ({str(e)[:50]})"

    def _format_report(
        self,
        market_status: Dict[str, Any],
        strategy: str,
        results: Dict[str, Any],
        team_performance: Dict[str, Any]
    ) -> str:
        """보고서 포맷팅"""

        report = f"""
{'='*80}
📊 AI 자동매매 시스템 - 일일보고서
{'='*80}

📅 날짜: {market_status['date']} (목요일)
⏰ 보고 시간: {market_status['time']}

{'─'*80}
📈 [1] 시장현황
{'─'*80}

🇰🇷 KOSPI 지수
   현재가: {market_status['kospi']['value']:,}
   변동: {market_status['kospi']['change']}
   추세: {market_status['kospi']['trend']}
   심리: {market_status['kospi']['sentiment']}

💱 환율
   원/달러: {market_status['won_usd']:.0f}원
   추세: {market_status['won_usd_trend']}

📊 투자자별 수급
   ├─ 외국인: 순매수 {market_status['foreign_investor']['net_buy']//1000000000:,}억원 ⬆️
   ├─ 기관: 순매도 {abs(market_status['institutional_investor']['net_buy'])//1000000000:,}억원 ⬇️
   └─ 개인: 순매도 {abs(market_status['individual_investor']['net_buy'])//1000000000:,}억원 ⬇️

📰 주요 뉴스
   • {market_status['key_news'][0]}
   • {market_status['key_news'][1]}
   • {market_status['key_news'][2]}

{'─'*80}
🎯 [2] 오늘의 매매전략 (시장현황 기반)
{'─'*80}

{strategy}

{'─'*80}
📋 [3] 오늘의 거래결과
{'─'*80}

📊 거래통계
   거래 건수: {results.get('total_trades', 0)}건
   성공: {results.get('successful_trades', 0)}건 | 실패: {results.get('failed_trades', 0)}건
   승률: {results.get('win_rate', 0):.1f}%

💰 수익현황
   총 손익: ₩{results.get('total_pnl', 0):+,} ({results.get('total_pnl_pct', 0):+.2%})
   평균 거래 수익: ₩{results.get('avg_pnl_per_trade', 0):+,}
   최고 거래: {results.get('best_trade', 'N/A')}
   최악 거래: {results.get('worst_trade', 'N/A')}

⚠️ 위험관리
   최대 낙폭: {results.get('max_drawdown', 0):.1f}%
   손절 준수율: {results.get('stop_loss_compliance', 0):.0f}%
   주문 체결 속도: {results.get('order_execution_speed', 0):.2f}초

{'─'*80}
🏆 [4] 팀별 성과평가
{'─'*80}

리서치팀
   신호 정확도: {team_performance.get('research', {}).get('accuracy', 0):.0f}%
   평가: ⭐⭐⭐⭐⭐
   피드백: {team_performance.get('research', {}).get('feedback', 'N/A')}

분석팀
   기술적 정확도: {team_performance.get('analysis', {}).get('accuracy', 0):.0f}%
   평가: ⭐⭐⭐⭐⭐
   피드백: {team_performance.get('analysis', {}).get('feedback', 'N/A')}

전략팀
   포지션 크기 최적성: {team_performance.get('strategy', {}).get('accuracy', 0):.0f}%
   평가: ⭐⭐⭐⭐
   피드백: {team_performance.get('strategy', {}).get('feedback', 'N/A')}

리스크팀
   위험관리 정확도: {team_performance.get('risk', {}).get('accuracy', 0):.0f}%
   평가: ⭐⭐⭐⭐⭐
   피드백: {team_performance.get('risk', {}).get('feedback', 'N/A')}

{'─'*80}
📅 [5] 내일 준비사항
{'─'*80}

⏰ 시작: 06:00 출근 → 06:30 뉴스 분석 시작
🎯 주력 종목: [확인 필요]
⚠️ 주의사항: [확인 필요]
💡 특별 전략: [확인 필요]

{'─'*80}
✅ 보고서 작성: AI 자동매매 시스템 팀장
📤 배포: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
{'='*80}
"""
        return report

    def _print_report(self, report: str) -> None:
        """보고서 출력"""
        print(report)


async def test_daily_report():
    """테스트"""

    report_generator = DailyReport()

    # 샘플 거래 데이터
    trading_data = {
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
                'feedback': '삼성전자 실적 정확 분석 완료'
            },
            'analysis': {
                'accuracy': 95,
                'feedback': 'VWAP 기반 진입 효과적'
            },
            'strategy': {
                'accuracy': 85,
                'feedback': '포지션 크기 최적화 완료'
            },
            'risk': {
                'accuracy': 100,
                'feedback': '손절 준수율 100% 달성'
            }
        }
    }

    await report_generator.generate_daily_report(trading_data)


if __name__ == "__main__":
    asyncio.run(test_daily_report())
