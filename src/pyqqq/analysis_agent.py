"""
종목분석팀 에이전트 - 재무제표, 기술차트, 수급, 기술지표 분석
BUY/SELL/HOLD 신호를 생성합니다.
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any
import anthropic

# 팀장 추가: 데이터 소스 및 API 비용 관리 통합
from data_source_manager import DataSourceManager
from api_cost_manager import APICallWrapper
from config import settings

class AnalysisAgent:
    def __init__(self, data_source_manager=None, api_wrapper=None):
        self.client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        self.model = settings.claude_model

        # 팀장 추가: 데이터 소스와 API 래퍼 주입
        self.data_source = data_source_manager
        self.api_wrapper = api_wrapper or APICallWrapper(self.client)

    async def analyze_symbol(
        self,
        symbol: str,
        symbol_name: str,
        current_price: float = None,
        technical_indicators: Dict[str, Any] = None,
        financial_data: Dict[str, Any] = None,
        volume_data: Dict[str, Any] = None
    ) -> dict:
        """
        재무제표, 기술지표, 수급을 종합 분석해서 신호를 생성합니다.

        Args:
            symbol: 종목코드
            symbol_name: 종목명
            current_price: 현재가
            technical_indicators: 기술지표 데이터
            financial_data: 재무제표 데이터
            volume_data: 수급 데이터

        Returns:
            {
                'signal': 'BUY' | 'SELL' | 'HOLD',
                'confidence': 0.0~1.0,
                'entry_price': float,
                'target_price': float,
                'stop_loss': float,
                'reasoning': str,
                'technical_score': float,
                'financial_score': float,
                'volume_score': float,
                'timestamp': str
            }
        """

        # 팀장 추가: 데이터 소스에서 자동으로 데이터 조회
        if not current_price and self.data_source:
            try:
                current_price = await self.data_source.price_feed.get_price(symbol)
                current_price = current_price or 0
            except Exception as e:
                print(f"현재가 조회 오류: {e}")
                current_price = 0

        if not technical_indicators and self.data_source:
            try:
                technical_indicators = await self.data_source.indicators.get_indicators(symbol)
            except Exception as e:
                print(f"기술지표 조회 오류: {e}")
                technical_indicators = {}

        if not financial_data and self.data_source:
            try:
                financial_data = await self.data_source.financial.get_financial_data(symbol)
            except Exception as e:
                print(f"재무데이터 조회 오류: {e}")
                financial_data = {}

        # 기본값 설정
        if technical_indicators is None:
            technical_indicators = {}
        if financial_data is None:
            financial_data = {}
        if volume_data is None:
            volume_data = {}

        prompt = f"""
당신은 경험 많은 기술분석 및 펀더멘탈 애널리스트입니다.

[종목 정보]
- 종목코드: {symbol}
- 종목명: {symbol_name}
- 현재가: {current_price:,.0f}원
- 분석 시간: {datetime.now().isoformat()}

[기술 지표]
{self._format_technical_indicators(technical_indicators) if technical_indicators else "지표 데이터 없음"}

[재무 데이터]
{self._format_financial_data(financial_data) if financial_data else "재무 데이터 없음"}

[수급 현황]
{self._format_volume_data(volume_data) if volume_data else "수급 데이터 없음"}

[분석 기준]
1. 기술적 신호 (차트, 지표):
   - 이동평균선: 상향/하향/횡보
   - RSI: 과매수/과매도 여부
   - MACD: 추세 전환 신호
   - 저항선/지지선 위치
   - 거래량 추세

2. 재무적 신호:
   - PER, PBR: 밸류에이션
   - ROE, ROA: 수익성
   - 부채비율: 안정성
   - 매출/순이익 증감률

3. 수급 신호:
   - 거래량 증감
   - 기관/외인 수급
   - 공시 (증감자 거래)

[응답 형식]
JSON으로 다음을 포함:
- signal: "BUY" | "SELL" | "HOLD"
- confidence: 0.0~1.0 (신뢰도)
- entry_price: 추천 진입가 (current_price 기준)
- target_price: 목표가
- stop_loss: 손절가 (현재가 대비)
- reasoning: 분석 근거 (기술+재무+수급)
- technical_score: 0~100 (기술적 신호 점수)
- financial_score: 0~100 (재무적 신호 점수)
- volume_score: 0~100 (수급 신호 점수)
- next_resistance: 다음 저항선
- next_support: 다음 지지선
"""

        try:
            # 팀장 추가: API 래퍼를 통한 안전한 호출
            if self.api_wrapper:
                response_text = await self.api_wrapper.call_claude(
                    prompt=prompt,
                    max_tokens=1024,
                    team_name="analysis"
                )
            else:
                # Fallback
                message = self.client.messages.create(
                    model=self.model,
                    max_tokens=1024,
                    messages=[{"role": "user", "content": prompt}]
                )
                response_text = message.content[0].text

            # JSON 파싱
            try:
                if "```json" in response_text:
                    json_str = response_text.split("```json")[1].split("```")[0]
                else:
                    json_str = response_text

                analysis = json.loads(json_str)
            except json.JSONDecodeError:
                analysis = {
                    "signal": "HOLD",
                    "confidence": 0.5,
                    "entry_price": current_price,
                    "target_price": current_price * 1.05,
                    "stop_loss": current_price * 0.95,
                    "reasoning": response_text,
                    "technical_score": 50,
                    "financial_score": 50,
                    "volume_score": 50
                }

            analysis["timestamp"] = datetime.now().isoformat()
            analysis["symbol"] = symbol
            analysis["symbol_name"] = symbol_name
            analysis["current_price"] = current_price

            return analysis

        except Exception as e:
            print(f"종목분석팀 분석 오류 ({symbol}): {e}")
            return {
                "signal": "HOLD",
                "confidence": 0.0,
                "entry_price": current_price,
                "target_price": current_price,
                "stop_loss": current_price * 0.98,
                "reasoning": f"API 오류: {str(e)}",
                "technical_score": 50,
                "financial_score": 50,
                "volume_score": 50,
                "timestamp": datetime.now().isoformat(),
                "symbol": symbol,
                "symbol_name": symbol_name,
                "current_price": current_price
            }

    def _format_technical_indicators(self, indicators: Dict) -> str:
        """기술지표 포맷팅"""
        lines = []
        for key, value in indicators.items():
            if isinstance(value, float):
                lines.append(f"- {key}: {value:.2f}")
            else:
                lines.append(f"- {key}: {value}")
        return "\n".join(lines) if lines else "지표 없음"

    def _format_financial_data(self, data: Dict) -> str:
        """재무데이터 포맷팅"""
        lines = []
        for key, value in data.items():
            if isinstance(value, (int, float)):
                lines.append(f"- {key}: {value:,.0f}")
            else:
                lines.append(f"- {key}: {value}")
        return "\n".join(lines) if lines else "데이터 없음"

    def _format_volume_data(self, data: Dict) -> str:
        """수급데이터 포맷팅"""
        lines = []
        for key, value in data.items():
            if isinstance(value, (int, float)):
                lines.append(f"- {key}: {value:,.0f}")
            else:
                lines.append(f"- {key}: {value}")
        return "\n".join(lines) if lines else "데이터 없음"

    def batch_analyze(
        self,
        symbols: list[dict],
        get_price_fn=None,
        get_indicators_fn=None
    ) -> list[dict]:
        """
        여러 종목을 배치 분석합니다.

        Args:
            symbols: [{"code": "005930", "name": "Samsung"}]
            get_price_fn: 가격 조회 함수
            get_indicators_fn: 기술지표 조회 함수
        """
        results = []
        for symbol_info in symbols:
            code = symbol_info.get("code")
            name = symbol_info.get("name")

            # 가격 조회
            price = get_price_fn(code) if get_price_fn else 0

            # 기술지표 조회
            indicators = get_indicators_fn(code) if get_indicators_fn else {}

            result = self.analyze_symbol(code, name, price, indicators)
            results.append(result)

        return results


if __name__ == "__main__":
    # 테스트
    agent = AnalysisAgent()

    result = agent.analyze_symbol(
        "005930",
        "Samsung Electronics",
        current_price=70000,
        technical_indicators={
            "RSI_14": 65,
            "MACD": "positive",
            "Moving_Average_20": 68000,
            "Moving_Average_60": 69000
        },
        financial_data={
            "PER": 12.5,
            "PBR": 1.2,
            "ROE": 15.5,
            "부채비율": "40%"
        },
        volume_data={
            "거래량_평균": 15000000,
            "기관수급": "매수",
            "외인수급": "매수"
        }
    )

    print(json.dumps(result, indent=2, ensure_ascii=False))
