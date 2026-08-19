"""
리서치팀 - 시장 분석 및 유망 종목 발굴 (점수 기반)
실계좌 기반 한국/미국 주식 시장 분석 후 유망 종목 선정
"""

import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any
import logging
import random

from .market_calendar import MarketCalendar

logger = logging.getLogger(__name__)


class ResearchTeamMarketAnalyzer:
    """리서치팀 - 시장 분석 및 종목 발굴 (점수 기반)"""

    def __init__(self):
        self.korean_stocks = [
            # 대형주 (고가)
            {"code": "005930", "name": "Samsung Electronics", "sector": "반도체"},
            {"code": "000660", "name": "SK Hynix", "sector": "반도체"},
            {"code": "051910", "name": "LG Chemistry", "sector": "화학"},
            {"code": "005380", "name": "Hyundai Motor", "sector": "자동차"},
            {"code": "000270", "name": "Kia Corporation", "sector": "자동차"},
            {"code": "068270", "name": "Celltrion", "sector": "바이오"},
            {"code": "207940", "name": "SM Entertainment", "sector": "엔터"},
            {"code": "035720", "name": "Kakao", "sector": "IT"},
            # 저가주 (소규모 계좌 최적화)
            {"code": "013000", "name": "HanmiGlobal", "sector": "제약"},
            {"code": "001050", "name": "Sewon Materials", "sector": "화학"},
            {"code": "013630", "name": "DRF", "sector": "건설"},
            {"code": "001430", "name": "Korelectric", "sector": "전기"},
            {"code": "001440", "name": "Korea Zinc", "sector": "철강"},
        ]

        self.us_stocks = [
            {"code": "AAPL", "name": "Apple", "sector": "Technology"},
            {"code": "MSFT", "name": "Microsoft", "sector": "Technology"},
            {"code": "GOOGL", "name": "Alphabet", "sector": "Technology"},
            {"code": "AMZN", "name": "Amazon", "sector": "Technology"},
            {"code": "NVDA", "name": "NVIDIA", "sector": "Technology"},
            {"code": "TSLA", "name": "Tesla", "sector": "Technology"},
            {"code": "META", "name": "Meta", "sector": "Technology"},
            {"code": "NFLX", "name": "Netflix", "sector": "Technology"},
        ]

        # 현재 강세 섹터 (시뮬레이션)
        self.kr_hot_sectors = ["반도체", "자동차"]
        self.us_hot_sectors = ["Technology", "AI"]

    async def analyze_market_and_select_stocks(
        self,
        kis_cash_krw: float = 0,  # 🆕 한국 계좌 현금
        toss_cash_usd: float = 0  # 🆕 미국 계좌 현금
    ) -> Dict[str, Any]:
        """
        시장 분석 및 유망 종목 선정 (계좌 잔액 기준)

        ⭐️ 핵심: 현금으로 구매 가능한 종목만 선정!

        Args:
            kis_cash_krw: 한국 계좌 현금 (KRW)
            toss_cash_usd: 미국 계좌 현금 (USD)

        Returns:
            {
                "timestamp": str,
                "market_status": {...},
                "analysis": {...},
                "selected_watchlist": [...]
            }
        """

        current_time = datetime.now()

        # 시장 상태 확인
        kr_session = MarketCalendar.get_market_session("KR", current_time)
        us_session = MarketCalendar.get_market_session("US", current_time)

        korea_market_open = kr_session["is_open"]
        us_market_open = us_session["is_open"]

        result = {
            "timestamp": current_time.isoformat(),
            "market_status": {
                "korea": "open" if korea_market_open else "closed",
                "us": "open" if us_market_open else "closed",
            },
            "analysis": {},
            "selected_watchlist": [],
            "cash_status": {  # 🆕 현금 상태 정보
                "kis_krw": kis_cash_krw,
                "toss_usd": toss_cash_usd
            }
        }

        # 한국 시장 분석 (현금 기준)
        if korea_market_open:
            logger.info("📊 한국 시장 분석 중...")
            korea_analysis = self._analyze_korea_market()
            result["analysis"]["korea"] = korea_analysis

            # 🆕 현금으로 구매 가능한 종목만 선정
            kr_candidates = await self._score_korean_stocks(
                korea_analysis,
                available_cash=kis_cash_krw  # 현금 정보 전달!
            )
            result["selected_watchlist"].extend(kr_candidates)

        # 미국 시장 분석 (현금 기준)
        if us_market_open:
            logger.info("📊 미국 시장 분석 중...")
            us_analysis = self._analyze_us_market()
            result["analysis"]["us"] = us_analysis

            # 🆕 현금으로 구매 가능한 종목만 선정
            us_candidates = await self._score_us_stocks(
                us_analysis,
                available_cash=toss_cash_usd  # 현금 정보 전달!
            )
            result["selected_watchlist"].extend(us_candidates)

        logger.info(
            f"✅ 리서치 완료: {len(result['selected_watchlist'])}개 종목 선정 "
            f"(현금: {kis_cash_krw:,.0f} KRW / ${toss_cash_usd:.2f})"
        )

        return result

    def _analyze_korea_market(self) -> Dict[str, Any]:
        """한국 시장 분석"""
        return {
            "sentiment": "neutral",
            "confidence": 0.6,
            "top_sectors": self.kr_hot_sectors,
            "reasoning": "기술주 중심의 관심, 반도체/자동차 섹터 모니터링",
            "market_indicators": {
                "kospi": 2650,
                "kosdaq": 830,
                "trend": "sideways",
                "volatility": "medium",
            }
        }

    def _analyze_us_market(self) -> Dict[str, Any]:
        """미국 시장 분석"""
        return {
            "sentiment": "bullish",
            "confidence": 0.65,
            "top_sectors": self.us_hot_sectors,
            "reasoning": "AI/기술주 강세, 성장주 주도",
            "market_indicators": {
                "sp500": 5850,
                "nasdaq": 18500,
                "trend": "uptrend",
                "volatility": "medium",
            }
        }

    async def _score_korean_stocks(
        self,
        analysis: Dict[str, Any],
        available_cash: float = 0  # 🆕 현금 정보
    ) -> List[Dict[str, Any]]:
        """
        한국 주식 점수 계산 및 선정 (현금 기준)

        ⭐️ 핵심: 현금으로 구매 가능한 종목만 선정!
        """

        scored_stocks = []

        for stock in self.korean_stocks:
            score = self._calculate_stock_score(
                stock,
                analysis,
                market="KR",
                available_cash=available_cash  # 🆕 현금 정보 전달!
            )

            # 🆕 구매 불가능한 종목은 무조건 제외
            if score["can_afford"]:  # 구매 가능한 종목만
                if score["total_score"] > 0.3:
                    scored_stocks.append(score)

        # 점수순 정렬 (높은 점수 우선)
        scored_stocks.sort(key=lambda x: x["total_score"], reverse=True)

        # 상위 10개 선정 (3개 → 10개로 확대)
        selected = scored_stocks[:10] if scored_stocks else []

        if not selected:
            logger.warning(f"⚠️ 한국: 구매 가능한 종목 없음 (현금: {available_cash:,.0f} KRW)")
        else:
            for stock in selected:
                logger.info(
                    f"🇰🇷 한국 주식 선정: {stock['code']} ({stock['name']}) "
                    f"점수: {stock['total_score']:.2f} (구매가능: {stock['estimated_price']:,.0f} KRW)"
                )

        return selected

    async def _score_us_stocks(
        self,
        analysis: Dict[str, Any],
        available_cash: float = 0  # 🆕 현금 정보 (USD)
    ) -> List[Dict[str, Any]]:
        """
        미국 주식 점수 계산 및 선정 (현금 기준)

        ⭐️ 핵심: 현금(USD)으로 구매 가능한 종목만 선정!
        """

        scored_stocks = []

        for stock in self.us_stocks:
            score = self._calculate_stock_score(
                stock,
                analysis,
                market="US",
                available_cash=available_cash  # 🆕 현금 정보 전달!
            )

            # 🆕 구매 불가능한 종목은 무조건 제외
            if score["can_afford"]:  # 구매 가능한 종목만
                if score["total_score"] > 0.3:
                    scored_stocks.append(score)

        # 점수순 정렬
        scored_stocks.sort(key=lambda x: x["total_score"], reverse=True)

        # 상위 10개 선정 (3개 → 10개로 확대)
        selected = scored_stocks[:10] if scored_stocks else []

        if not selected:
            logger.warning(f"⚠️ 미국: 구매 가능한 종목 없음 (현금: ${available_cash:.2f})")
        else:
            for stock in selected:
                logger.info(
                    f"🇺🇸 미국 주식 선정: {stock['code']} ({stock['name']}) "
                    f"점수: {stock['total_score']:.2f} (구매가능: ${stock['estimated_price']:.2f})"
                )

        return selected

    def _calculate_stock_score(
        self,
        stock: Dict[str, Any],
        analysis: Dict[str, Any],
        market: str,
        available_cash: float = 0  # 🆕 현금 정보
    ) -> Dict[str, Any]:
        """
        종목 점수 계산 (⭐️ 현금 기반)

        ⭐️ 핵심: 구매 불가능하면 total_score = 0!

        Returns:
            {
                "code": str,
                "name": str,
                "market": str,
                "can_afford": bool,  # 🆕 구매 가능 여부
                "estimated_price": float,  # 🆕 예상 주가
                "total_score": float (0-1),
                "reason": str,
                "features": {...}
            }
        """

        # 🆕 예상 주가 설정 (시뮬레이션)
        if market == "KR":
            estimated_prices = {
                "013000": 5000,    # HanmiGlobal
                "001050": 10000,   # Sewon
                "013630": 20000,   # DRF
                "001430": 22000,   # Korelectric
                "001440": 25000,   # Korea Zinc
                "005930": 60000,   # Samsung
                "000660": 100000,  # SK Hynix
                "000270": 80000,   # Kia
                "005380": 70000,   # Hyundai
                "051910": 90000,   # LG Chem
                "068270": 55000,   # Celltrion
                "207940": 35000,   # SM Ent
                "035720": 400000,  # Kakao
            }
            estimated_price = estimated_prices.get(stock["code"], 50000)
            can_afford = available_cash >= estimated_price
        else:  # US
            estimated_prices = {
                "AAPL": 230,
                "MSFT": 420,
                "GOOGL": 190,
                "AMZN": 180,
                "NVDA": 140,
                "TSLA": 250,
                "META": 500,
                "NFLX": 280,
            }
            estimated_price = estimated_prices.get(stock["code"], 200)
            can_afford = available_cash >= estimated_price

        # 🆕 구매 불가능하면 점수 0
        if not can_afford:
            return {
                "code": stock["code"],
                "name": stock["name"],
                "market": market,
                "can_afford": False,
                "estimated_price": estimated_price,
                "total_score": 0.0,  # ⭐️ 구매 불가 = 점수 0
                "reason": f"현금 부족 (필요: {estimated_price:,.0f}, 보유: {available_cash:,.0f})",
                "features": {},
            }

        # 각 점수 계산 (구매 가능할 때만)
        scores = {
            "liquidity_score": self._calculate_liquidity_score(stock, market),
            "volatility_score": self._calculate_volatility_score(stock, market),
            "trend_score": self._calculate_trend_score(stock, market),
            "news_score": self._calculate_news_score(stock, market),
            "sector_score": self._calculate_sector_score(stock, analysis),
            "risk_penalty": self._calculate_risk_penalty(stock, market),
        }

        # 가중 평균 (정규화)
        weights = {
            "liquidity_score": 0.15,
            "volatility_score": 0.15,
            "trend_score": 0.25,
            "news_score": 0.20,
            "sector_score": 0.20,
            "risk_penalty": -0.25,
        }

        total_score = sum(
            scores[key] * weight
            for key, weight in weights.items()
        )
        total_score = max(0, min(1, total_score))

        # 이유 생성
        reason = self._generate_reason(scores, stock, analysis)

        return {
            "code": stock["code"],
            "name": stock["name"],
            "market": market,
            "can_afford": True,  # ✅ 구매 가능
            "estimated_price": estimated_price,
            "total_score": total_score,
            "reason": reason,
            "features": scores,
        }

    def _calculate_liquidity_score(self, stock: Dict[str, Any], market: str) -> float:
        """거래대금/거래량 점수 (높을수록 좋음)"""
        # 시뮬레이션: 상위 5개 종목은 높은 점수
        if stock["code"] in ["NVDA", "MSFT", "AAPL", "005930", "000660"][:3]:
            return 0.85 + random.uniform(-0.05, 0.05)
        return 0.60 + random.uniform(-0.1, 0.1)

    def _calculate_volatility_score(self, stock: Dict[str, Any], market: str) -> float:
        """변동성 점수 (적절한 변동성이 높은 점수)"""
        # 시뮬레이션: 기술주는 높은 변동성
        if market == "US" and stock["sector"] == "Technology":
            return 0.70 + random.uniform(-0.05, 0.05)
        return 0.55 + random.uniform(-0.1, 0.1)

    def _calculate_trend_score(self, stock: Dict[str, Any], market: str) -> float:
        """추세 점수 (상승 추세일수록 높은 점수)"""
        # 시뮬레이션: 미국 시장이 상승 추세
        if market == "US":
            return 0.75 + random.uniform(-0.05, 0.05)
        return 0.50 + random.uniform(-0.1, 0.1)

    def _calculate_news_score(self, stock: Dict[str, Any], market: str) -> float:
        """뉴스 점수 (긍정 뉴스 비율)"""
        # 시뮬레이션: NVDA, AAPL, MSFT는 긍정 뉴스 많음
        if stock["code"] in ["NVDA", "AAPL", "MSFT"]:
            return 0.75 + random.uniform(-0.05, 0.05)
        return 0.55 + random.uniform(-0.1, 0.1)

    def _calculate_sector_score(
        self,
        stock: Dict[str, Any],
        analysis: Dict[str, Any]
    ) -> float:
        """섹터 점수 (핫 섹터일수록 높은 점수)"""
        hot_sectors = analysis.get("top_sectors", [])
        stock_sector = stock.get("sector", "")

        if stock_sector in hot_sectors:
            return 0.80 + random.uniform(-0.05, 0.05)
        return 0.50 + random.uniform(-0.1, 0.1)

    def _calculate_risk_penalty(self, stock: Dict[str, Any], market: str) -> float:
        """위험 페널티 (높을수록 위험도 높음)"""
        # 시뮬레이션: 대부분 낮은 위험도
        return 0.05 + random.uniform(-0.02, 0.02)

    def _generate_reason(
        self,
        scores: Dict[str, float],
        stock: Dict[str, Any],
        analysis: Dict[str, Any]
    ) -> str:
        """선정 이유 생성"""
        top_factors = []

        if scores["trend_score"] > 0.65:
            top_factors.append("상승 추세")
        if scores["sector_score"] > 0.70:
            top_factors.append(f"핫 섹터 ({stock.get('sector', 'N/A')})")
        if scores["news_score"] > 0.65:
            top_factors.append("긍정 뉴스")
        if scores["liquidity_score"] > 0.75:
            top_factors.append("높은 거래량")

        if not top_factors:
            top_factors = ["기술 지표 우호적"]

        return " + ".join(top_factors[:3])


async def main():
    """테스트"""
    import logging
    logging.basicConfig(level=logging.INFO)

    print("\n" + "="*70)
    print("🔬 ResearchTeamMarketAnalyzer (점수 기반) 테스트")
    print("="*70)

    analyzer = ResearchTeamMarketAnalyzer()
    result = await analyzer.analyze_market_and_select_stocks()

    print(f"\n📊 현재 시간: {result['timestamp']}")
    print(f"🇰🇷 한국 시장: {result['market_status']['korea']}")
    print(f"🇺🇸 미국 시장: {result['market_status']['us']}")
    print(f"\n📋 선정된 종목: {len(result['selected_watchlist'])}개")

    for stock in result["selected_watchlist"]:
        print(f"\n  📊 {stock['code']} ({stock['name']})")
        print(f"     점수: {stock['score']:.2f}")
        print(f"     이유: {stock['reason']}")
        print(f"     세부:")
        for key, value in stock["features"].items():
            print(f"        - {key}: {value:.2f}")


if __name__ == "__main__":
    asyncio.run(main())
