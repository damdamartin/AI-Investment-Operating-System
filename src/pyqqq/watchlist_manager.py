"""
리스트관리팀 에이전트 - 거래할 종목 워치리스트 동적 관리
신호가 강한 상승주를 자동으로 추가/제거합니다.
"""

import json
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Set
import os
import anthropic

# 팀장 추가: API 비용 관리 통합
from api_cost_manager import APICallWrapper
from config import settings


class WatchlistManager:
    def __init__(self, api_wrapper=None):
        self.client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        self.model = settings.claude_model

        # 팀장 추가: API 래퍼 주입
        self.api_wrapper = api_wrapper or APICallWrapper(self.client)

        # 기본 워치리스트 (필수 보유)
        self.core_watchlist = [
            {"code": "005930", "name": "Samsung Electronics", "market": "KR"},
            {"code": "000660", "name": "SK Hynix", "market": "KR"},
        ]

    async def update_watchlist(
        self,
        current_watchlist: List[Dict],
        signal_data: List[Dict],
        performance_data: Dict[str, Any] = None,
        portfolio_constraints: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        신호 데이터와 성과 데이터를 바탕으로 워치리스트를 동적으로 업데이트합니다.

        Args:
            current_watchlist: 현재 워치리스트
            signal_data: 각 종목의 신호 (research + analysis)
            performance_data: 종목별 성과 데이터
            portfolio_constraints: 포트폴리오 제약사항

        Returns:
            {
                'watchlist': updated_list,
                'added': 추가된 종목,
                'removed': 제거된 종목,
                'reasoning': 변경 근거,
                'performance_impact': 예상 영향,
                'timestamp': str
            }
        """

        performance_data = performance_data or {}
        portfolio_constraints = portfolio_constraints or {}

        prompt = f"""
당신은 포트폴리오 큐레이터입니다. 거래할 종목 리스트를 동적으로 관리하세요.

[현재 워치리스트]
{self._format_watchlist(current_watchlist)}

[신호 데이터 (상위 5개)]
{self._format_signals(signal_data[:5])}

[성과 현황]
{self._format_performance(performance_data)}

[포트폴리오 제약]
- 최대 동시 거래: {portfolio_constraints.get('max_positions', 5)}개
- 최대 포지션 비중: {portfolio_constraints.get('max_position_size', 10)}%
- 손실 한도: {portfolio_constraints.get('drawdown_limit', -5)}%

[의사결정 기준]
추가할 종목:
1. 리서치팀 + 분석팀 모두 BUY
2. 신뢰도 75% 이상
3. 강한 상승 신호
4. 현재 리스트에 없는 종목

제거할 종목:
1. 연속 손절 발생 (3회 이상)
2. 성과가 포트폴리오 평균 이하
3. 산업 부진 신호
4. 리스크 높음 신호

[응답 형식]
JSON으로:
- watchlist: 업데이트된 리스트
- added: [추가 종목 리스트]
- removed: [제거 종목 리스트]
- reasoning: 변경 근거
- expected_performance: 예상 성과
- next_check_time: 다음 점검 시간
"""

        try:
            # 팀장 추가: API 래퍼를 통한 안전한 호출
            if self.api_wrapper:
                response_text = await self.api_wrapper.call_claude(
                    prompt=prompt,
                    max_tokens=1024,
                    team_name="watchlist"
                )
            else:
                # Fallback
                message = self.client.messages.create(
                    model=self.model,
                    max_tokens=1024,
                    messages=[{"role": "user", "content": prompt}]
                )
                response_text = message.content[0].text

            try:
                if "```json" in response_text:
                    json_str = response_text.split("```json")[1].split("```")[0]
                else:
                    json_str = response_text

                result = json.loads(json_str)
            except json.JSONDecodeError:
                result = {
                    "watchlist": current_watchlist,
                    "added": [],
                    "removed": [],
                    "reasoning": response_text,
                    "expected_performance": "유지",
                    "next_check_time": datetime.now().isoformat()
                }

            result["timestamp"] = datetime.now().isoformat()
            return result

        except Exception as e:
            print(f"워치리스트 관리 오류: {e}")
            return {
                "watchlist": current_watchlist,
                "added": [],
                "removed": [],
                "reasoning": f"API 오류: {str(e)}",
                "timestamp": datetime.now().isoformat()
            }

    def validate_watchlist(self, watchlist: List[Dict]) -> Dict[str, Any]:
        """
        워치리스트의 유효성을 검증합니다.
        """
        errors = []
        warnings = []

        # 필수 종목 확인
        core_codes = {w["code"] for w in self.core_watchlist}
        current_codes = {w["code"] for w in watchlist}

        missing = core_codes - current_codes
        if missing:
            errors.append(f"필수 종목 누락: {missing}")

        # 중복 확인
        codes = [w["code"] for w in watchlist]
        if len(codes) != len(set(codes)):
            errors.append("중복된 종목 발견")

        # 수량 확인
        if len(watchlist) > 20:
            warnings.append("워치리스트가 너무 많음 (20개 이상)")

        if len(watchlist) < 3:
            warnings.append("워치리스트가 너무 적음 (3개 이상 권장)")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "total_count": len(watchlist),
            "timestamp": datetime.now().isoformat()
        }

    def _format_watchlist(self, watchlist: List[Dict]) -> str:
        """워치리스트 포맷팅"""
        lines = []
        for w in watchlist:
            lines.append(f"- {w.get('code')}: {w.get('name')} ({w.get('market')})")
        return "\n".join(lines) if lines else "빈 리스트"

    def _format_signals(self, signals: List[Dict]) -> str:
        """신호 데이터 포맷팅"""
        lines = []
        for sig in signals:
            lines.append(
                f"- {sig.get('symbol')}: {sig.get('signal')} "
                f"(신뢰: {sig.get('confidence', 0):.0%})"
            )
        return "\n".join(lines) if lines else "신호 없음"

    def _format_performance(self, perf: Dict) -> str:
        """성과 데이터 포맷팅"""
        lines = []
        for symbol, data in list(perf.items())[:5]:
            pnl = data.get("pnl_pct", 0)
            lines.append(f"- {symbol}: {pnl:+.2f}%")
        return "\n".join(lines) if lines else "성과 데이터 없음"


if __name__ == "__main__":
    manager = WatchlistManager()

    # 현재 워치리스트
    current = [
        {"code": "005930", "name": "Samsung", "market": "KR"},
        {"code": "000660", "name": "SK Hynix", "market": "KR"},
    ]

    # 신호 데이터
    signals = [
        {"symbol": "005930", "signal": "BUY", "confidence": 0.8},
        {"symbol": "000660", "signal": "HOLD", "confidence": 0.6},
        {"symbol": "051910", "signal": "BUY", "confidence": 0.85},
    ]

    result = manager.update_watchlist(current, signals)
    print(json.dumps(result, indent=2, ensure_ascii=False))

    # 유효성 검증
    validation = manager.validate_watchlist(result.get("watchlist", []))
    print("\n[유효성 검증]")
    print(json.dumps(validation, indent=2, ensure_ascii=False))
