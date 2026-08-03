"""
리서치팀 에이전트 - 뉴스, 공시, 산업동향, 거시경제 분석
최신 정보를 분석해서 긍정/부정/중립 신호를 생성합니다.
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Optional
import anthropic

# 팀장 추가: 데이터 소스 및 API 비용 관리 통합
from data_source_manager import DataSourceManager
from api_cost_manager import APICallWrapper
from config import settings

class ResearchAgent:
    def __init__(self, data_source_manager=None, api_wrapper=None):
        self.client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        self.model = settings.claude_model

        # 팀장 추가: 데이터 소스와 API 래퍼 주입
        self.data_source = data_source_manager
        self.api_wrapper = api_wrapper or APICallWrapper(self.client)

    async def analyze_symbol(self, symbol: str, symbol_name: str, recent_news: list = None) -> dict:
        """
        종목의 뉴스, 공시, 산업 정보를 분석해서 신호를 생성합니다.

        Args:
            symbol: 종목코드 (예: 005930)
            symbol_name: 종목명 (예: Samsung Electronics)
            recent_news: 최신 뉴스 리스트 (optional)

        Returns:
            {
                'signal': 'BUY' | 'SELL' | 'HOLD',
                'confidence': 0.0~1.0,
                'reasoning': str,
                'factors': list,
                'timestamp': str
            }
        """

        # 팀장 추가: 데이터 소스에서 실제 뉴스 조회
        if self.data_source and not recent_news:
            try:
                recent_news = await self.data_source.news.get_recent_news(symbol)
            except Exception as e:
                print(f"뉴스 데이터 조회 오류: {e}")
                recent_news = []

        prompt = f"""
당신은 경험 많은 리서치 애널리스트입니다. 주어진 정보를 분석해서 투자 신호를 생성하세요.

[종목 정보]
- 종목코드: {symbol}
- 종목명: {symbol_name}
- 분석 시간: {datetime.now().isoformat()}

[최근 뉴스/정보]
{self._format_news(recent_news) if recent_news else "뉴스 데이터를 조회할 수 없습니다. 일반적인 분석을 기반으로 판단하세요."}

[분석 관점]
1. 긍정 신호 (BUY):
   - 신제품 출시/기술 혁신
   - 실적 개선 (매출, 순이익)
   - 산업 트렌드 긍정
   - 주요 계약/파트너십
   - 정부 정책 지원

2. 부정 신호 (SELL):
   - 실적 악화/적자
   - 제품 결함/리콜
   - 경영진 교체
   - 소송/규제 이슈
   - 산업 불황

3. 중립 신호 (HOLD):
   - 명확한 신호 없음
   - 상충되는 정보

[응답 형식]
JSON 형식으로 다음을 포함:
- signal: "BUY" | "SELL" | "HOLD"
- confidence: 0.0~1.0 (신뢰도)
- reasoning: 종합적인 분석 근거 (2-3줄)
- factors: 주요 긍정/부정 요인 리스트
- market_context: 거시경제/산업 영향
"""

        try:
            # 팀장 추가: API 래퍼를 통한 안전한 호출 (rate limiting, 재시도, 토큰 추적)
            if self.api_wrapper:
                response_text = await self.api_wrapper.call_claude(
                    prompt=prompt,
                    max_tokens=1024,
                    team_name="research"
                )
            else:
                # Fallback: 직접 호출
                message = self.client.messages.create(
                    model=self.model,
                    max_tokens=1024,
                    messages=[{"role": "user", "content": prompt}]
                )
                response_text = message.content[0].text

            # JSON 파싱
            try:
                # "```json" 형식으로 감싸져 있을 수 있음
                if "```json" in response_text:
                    json_str = response_text.split("```json")[1].split("```")[0]
                else:
                    json_str = response_text

                analysis = json.loads(json_str)
            except json.JSONDecodeError:
                # 파싱 실패 시 기본값
                analysis = {
                    "signal": "HOLD",
                    "confidence": 0.5,
                    "reasoning": response_text,
                    "factors": [],
                    "market_context": ""
                }

            analysis["timestamp"] = datetime.now().isoformat()
            analysis["symbol"] = symbol
            analysis["symbol_name"] = symbol_name

            return analysis

        except Exception as e:
            print(f"리서치팀 분석 오류 ({symbol}): {e}")
            return {
                "signal": "HOLD",
                "confidence": 0.0,
                "reasoning": f"API 오류: {str(e)}",
                "factors": [],
                "timestamp": datetime.now().isoformat(),
                "symbol": symbol,
                "symbol_name": symbol_name
            }

    def _format_news(self, news_list: list) -> str:
        """뉴스 리스트를 포맷팅"""
        if not news_list:
            return ""

        formatted = ""
        for i, news in enumerate(news_list[:5], 1):  # 최근 5개만
            if isinstance(news, dict):
                title = news.get("title", "")
                date = news.get("date", "")
                summary = news.get("summary", "")
                formatted += f"{i}. [{date}] {title}\n   {summary}\n\n"
            else:
                formatted += f"{i}. {news}\n"

        return formatted

    def batch_analyze(self, symbols: list[dict]) -> list[dict]:
        """
        여러 종목을 배치 분석합니다.

        Args:
            symbols: [{"code": "005930", "name": "Samsung"}] 형식

        Returns:
            분석 결과 리스트
        """
        results = []
        for symbol_info in symbols:
            result = self.analyze_symbol(
                symbol_info.get("code"),
                symbol_info.get("name")
            )
            results.append(result)

        return results


if __name__ == "__main__":
    # 테스트
    agent = ResearchAgent()

    result = agent.analyze_symbol(
        "005930",
        "Samsung Electronics",
        recent_news=[
            "삼성전자, AI 칩 신제품 발표",
            "메모리 반도체 가격 상승 기조",
            "중국 경쟁사와의 기술 격차 확대"
        ]
    )

    print(json.dumps(result, indent=2, ensure_ascii=False))
