"""
동적 종목 검색 시스템 - 시장신호에 맞춰 종목을 동적으로 발굴합니다.

테마별로 필터링 조건을 정의하고, 이를 기반으로 Yahoo Finance/주식 스크리닝에서
실시간으로 종목을 검색합니다.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Tuple
from .models import Instrument, Quote

logger = logging.getLogger(__name__)


class ThemeDefinition:
    """테마별 종목 검색 기준"""

    def __init__(
        self,
        name: str,
        keywords: List[str],
        min_market_cap: float = 1e9,  # $1B 이상
        min_volume: float = 1e6,  # 100만 주 이상
        description: str = ""
    ):
        self.name = name
        self.keywords = keywords  # 검색 키워드: 'AI', 'semiconductor', 등
        self.min_market_cap = min_market_cap
        self.min_volume = min_volume
        self.description = description


class UniverseScanner:
    """
    테마별 동적 종목 검색

    Phase 1: 하드코딩된 종목 풀 사용 (현재)
    Phase 2: Yahoo Finance API로 동적 검색
    Phase 3: 전문 스크리닝 API (Finviz, Seeking Alpha)와 통합
    """

    # 테마 정의 (필터링 기준)
    THEME_DEFINITIONS: Dict[str, ThemeDefinition] = {
        "US_AI": ThemeDefinition(
            name="US_AI",
            keywords=["AI", "artificial intelligence", "machine learning", "data center"],
            min_market_cap=10e9,  # $10B+
            description="AI 칩, 소프트웨어, 클라우드 인프라"
        ),
        "US_SEMICONDUCTOR": ThemeDefinition(
            name="US_SEMICONDUCTOR",
            keywords=["semiconductor", "chip", "fab", "wafer"],
            min_market_cap=5e9,  # $5B+
            description="반도체 제조, 설계, 장비"
        ),
        "US_MEGACAP_TECH": ThemeDefinition(
            name="US_MEGACAP_TECH",
            keywords=["technology", "software", "internet"],
            min_market_cap=100e9,  # $100B+ (Mega-cap만)
            description="기술 대형주"
        ),
        "US_EV": ThemeDefinition(
            name="US_EV",
            keywords=["electric vehicle", "EV", "battery", "autonomous"],
            min_market_cap=1e9,  # $1B+
            description="전기자동차, 배터리 기술"
        ),
        "US_ENERGY_POWER": ThemeDefinition(
            name="US_ENERGY_POWER",
            keywords=["nuclear", "renewable", "solar", "wind", "energy"],
            min_market_cap=1e9,  # $1B+
            description="에너지, 전력, 원자력"
        ),
        "KR_SEMICONDUCTOR": ThemeDefinition(
            name="KR_SEMICONDUCTOR",
            keywords=["반도체", "칩", "팹"],
            min_market_cap=100e8,  # ₩1T+
            description="한국 반도체"
        ),
        "KR_BATTERY_EV": ThemeDefinition(
            name="KR_BATTERY_EV",
            keywords=["배터리", "전기차", "EV"],
            min_market_cap=100e8,  # ₩1T+
            description="한국 배터리, 전기차"
        ),
        "KR_PLATFORM": ThemeDefinition(
            name="KR_PLATFORM",
            keywords=["플랫폼", "메신저", "검색", "포털"],
            min_market_cap=100e8,  # ₩1T+
            description="한국 플랫폼 기업"
        ),
        "KR_SMALL_CAP_MOMENTUM": ThemeDefinition(
            name="KR_SMALL_CAP_MOMENTUM",
            keywords=["소형주", "모멘텀"],
            min_market_cap=50e8,  # ₩500B+
            description="한국 소형주 모멘텀"
        ),
    }

    # Phase 1: 하드코딩된 종목 풀 (점진적으로 동적으로 전환)
    PHASE1_UNIVERSE: Dict[str, List[Tuple[str, str, str, str]]] = {
        "US_AI": [
            ("NVDA", "NVIDIA", "US", "USD"),
            ("MSFT", "Microsoft", "US", "USD"),
            ("GOOGL", "Alphabet", "US", "USD"),
            ("AMD", "AMD", "US", "USD"),
            ("AVGO", "Broadcom", "US", "USD"),
            ("QCOM", "Qualcomm", "US", "USD"),
            ("MSTR", "MicroStrategy", "US", "USD"),
        ],
        "US_SEMICONDUCTOR": [
            ("NVDA", "NVIDIA", "US", "USD"),
            ("AMD", "AMD", "US", "USD"),
            ("AVGO", "Broadcom", "US", "USD"),
            ("QCOM", "Qualcomm", "US", "USD"),
            ("TSM", "TSMC", "US", "USD"),
            ("MU", "Micron", "US", "USD"),
        ],
        "US_MEGACAP_TECH": [
            ("AAPL", "Apple", "US", "USD"),
            ("MSFT", "Microsoft", "US", "USD"),
            ("GOOGL", "Alphabet", "US", "USD"),
            ("META", "Meta", "US", "USD"),
            ("AMZN", "Amazon", "US", "USD"),
        ],
        "US_EV": [
            ("TSLA", "Tesla", "US", "USD"),
            ("RIVN", "Rivian", "US", "USD"),
            ("LI", "Li Auto", "US", "USD"),
            ("NIO", "NIO", "US", "USD"),
            ("LCID", "Lucid", "US", "USD"),
        ],
        "US_ENERGY_POWER": [
            ("CEG", "Constellation Energy", "US", "USD"),
            ("VST", "Vistra", "US", "USD"),
            ("GEV", "GE Vernova", "US", "USD"),
            ("SMCI", "Super Micro", "US", "USD"),
            ("DLTR", "Dollar Tree", "US", "USD"),
        ],
        "KR_SEMICONDUCTOR": [
            ("005930", "Samsung Electronics", "KR", "KRW"),
            ("000660", "SK Hynix", "KR", "KRW"),
            ("042700", "Hanmi Semiconductor", "KR", "KRW"),
            ("009420", "Cosmoem", "KR", "KRW"),
        ],
        "KR_BATTERY_EV": [
            ("373220", "LG Energy Solution", "KR", "KRW"),
            ("006400", "Samsung SDI", "KR", "KRW"),
            ("247540", "EcoPro BM", "KR", "KRW"),
            ("066570", "LG D&A", "KR", "KRW"),
        ],
        "KR_PLATFORM": [
            ("035420", "NAVER", "KR", "KRW"),
            ("035720", "Kakao", "KR", "KRW"),
            ("251270", "Naver Financial", "KR", "KRW"),
        ],
        "KR_SMALL_CAP_MOMENTUM": [
            ("013000", "HanmiGlobal", "KR", "KRW"),
            ("001050", "Sewon Materials", "KR", "KRW"),
            ("013630", "DRF", "KR", "KRW"),
            ("001430", "Korelectric", "KR", "KRW"),
            ("001440", "Korea Zinc", "KR", "KRW"),
            ("047000", "Hanwha", "KR", "KRW"),
        ],
    }

    def __init__(self):
        self.theme_definitions = self.THEME_DEFINITIONS
        self.universe = self.PHASE1_UNIVERSE

    def instruments_for_theme(self, theme: str) -> List[Instrument]:
        """
        테마에 맞는 종목 리스트 반환

        Phase 1: 하드코딩된 풀에서 반환
        Phase 2+: 동적 검색 결과 반환
        """
        if theme not in self.universe:
            logger.warning(f"Unknown theme: {theme}")
            return []

        instruments = []
        for symbol, name, market, currency in self.universe[theme]:
            instruments.append(
                Instrument(symbol=symbol, name=name, market=market, currency=currency)
            )
        return instruments

    def filter_by_quotes(
        self,
        instruments: List[Instrument],
        quotes: Dict[str, Quote],
        theme: str
    ) -> List[Instrument]:
        """
        주가 데이터 기반으로 종목 필터링

        - 가격이 0 이하: 제외
        - 유동성 부족: 제외
        """
        filtered = []
        for instr in instruments:
            quote = quotes.get(instr.symbol)
            if quote is None or quote.price <= 0:
                logger.debug(f"Filtered out {instr.symbol}: no quote or zero price")
                continue
            filtered.append(instr)
        return filtered

    def expand_universe_for_theme(self, theme: str) -> List[Instrument]:
        """
        테마를 기반으로 종목 확장 검색 (미래 기능)

        현재: Phase 1 풀에서 반환
        미래: Yahoo Finance 또는 전문 API에서 동적 검색
        """
        return self.instruments_for_theme(theme)

    def get_all_instruments(self) -> List[Instrument]:
        """모든 테마의 모든 종목 반환"""
        seen: set[Tuple[str, str]] = set()
        instruments: list[Instrument] = []
        for theme in self.universe.keys():
            for instr in self.instruments_for_theme(theme):
                key = (instr.market, instr.symbol)
                if key not in seen:
                    seen.add(key)
                    instruments.append(instr)
        return instruments

    def add_custom_universe(self, theme: str, symbols: List[Tuple[str, str, str, str]]):
        """
        사용자 정의 종목 추가

        Example:
            scanner.add_custom_universe("US_AI", [
                ("PLTR", "Palantir", "US", "USD"),
                ("CRWD", "CrowdStrike", "US", "USD"),
            ])
        """
        if theme not in self.universe:
            self.universe[theme] = []
        # 중복 제거
        existing = {s[0] for s in self.universe[theme]}
        for symbol, name, market, currency in symbols:
            if symbol not in existing:
                self.universe[theme].append((symbol, name, market, currency))
                logger.info(f"Added {symbol} to theme {theme}")
