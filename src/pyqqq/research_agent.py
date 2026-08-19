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
try:
    from .data_source_manager import DataSourceManager
except ImportError:
    DataSourceManager = None

try:
    from .api_cost_manager import APICallWrapper
except ImportError:
    APICallWrapper = None

from .config import settings

class ResearchAgent:
    def __init__(self, data_source_manager=None, api_wrapper=None):
        self.client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        self.model = settings.claude_model

        # 팀장 추가: 데이터 소스와 API 래퍼 주입
        self.data_source = data_source_manager
        if api_wrapper:
            self.api_wrapper = api_wrapper
        elif APICallWrapper:
            self.api_wrapper = APICallWrapper(self.client)
        else:
            self.api_wrapper = None

    async def analyze_symbol(self, symbol: str, symbol_name: str, recent_news: list = None) -> dict:
        """
        로컬 키워드 분석 기반 신호 (Claude API 비용 절감)

        Args:
            symbol: 종목코드
            symbol_name: 종목명
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

        # 뉴스 데이터 조회 (있으면)
        if self.data_source and not recent_news:
            try:
                recent_news = await self.data_source.news.get_recent_news(symbol)
            except:
                recent_news = []

        # 로컬 키워드 기반 신호 분석
        positive_keywords = ["신제품", "실적 개선", "호재", "증가", "성공", "계약", "파트너십", "공모"]
        negative_keywords = ["실적 악화", "부진", "하락", "손실", "리스크", "우려", "악재", "소송"]

        positive_count = 0
        negative_count = 0
        factors = []

        if recent_news:
            for news in recent_news[:5]:  # 최근 5개만 확인
                news_text = str(news).lower()

                for keyword in positive_keywords:
                    if keyword.lower() in news_text:
                        positive_count += 1
                        if keyword not in factors:
                            factors.append(f"✅ {keyword}")

                for keyword in negative_keywords:
                    if keyword.lower() in news_text:
                        negative_count += 1
                        if keyword not in factors:
                            factors.append(f"❌ {keyword}")

        # 신호 결정 (작업지시서 #5: 명확한 신호만 허용)
        if positive_count == 0 and negative_count == 0:
            # 뉴스 없음: HOLD
            signal = "HOLD"
            confidence = 0.0
            reasoning = "뉴스 데이터 부족: 거래 신호 생성 불가"
        elif positive_count >= negative_count + 2:
            # 긍정 신호가 명확히 많음
            signal = "BUY"
            confidence = min(0.95, 0.5 + (positive_count * 0.1))
            reasoning = f"긍정 신호 {positive_count}개 > 부정 신호 {negative_count}개. 매수 신호"
        elif negative_count >= positive_count + 1:
            # 부정 신호가 명확히 많음
            signal = "SELL"
            confidence = min(0.95, 0.5 + (negative_count * 0.1))
            reasoning = f"부정 신호 {negative_count}개 > 긍정 신호 {positive_count}개. 매도 신호"
        else:
            # 신호 충돌 또는 약함
            signal = "HOLD"
            confidence = 0.0
            reasoning = f"신호 약함: 긍정={positive_count}, 부정={negative_count}"

        return {
            "signal": signal,
            "confidence": confidence,
            "reasoning": reasoning,
            "factors": factors if factors else ["정보 부족"],
            "market_context": f"{symbol_name} 종목의 최근 뉴스 기반 분석",
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
