from __future__ import annotations

import logging
from .config import TossOnlyConfig
from .models import Candidate, Instrument, MarketRegime, Quote
from .universe_scanner import UniverseScanner

logger = logging.getLogger(__name__)


class ThemeDetector:
    """
    동적 시장 체제 감지 및 종목 추천

    Phase 1 (현재): UniverseScanner의 동적 풀에서 종목 검색
    Phase 2 (미래): Yahoo Finance API로 실시간 스크리닝
    Phase 3 (미래): 전문 데이터 API (Finviz, Seeking Alpha)와 통합
    """

    def __init__(self, config: TossOnlyConfig):
        self.config = config
        self.scanner = UniverseScanner()

    def all_instruments(self) -> list[Instrument]:
        """
        모든 테마에서 모든 종목 반환 (하드코딩 제거, 동적 검색)

        UniverseScanner에서 관리하는 테마별 종목 풀을 사용합니다.
        """
        return self.scanner.get_all_instruments()

    def detect_regime(
        self,
        quotes: dict[str, Quote],
        catalyst_scores: dict[str, float] | None = None,
    ) -> MarketRegime:
        """
        시장 체제 감지: 현재 시장 신호에 맞는 지배적 테마 선택

        알고리즘:
        1. 각 테마의 종목들의 모멘텀, 유동성, 촉매 분석
        2. 테마별 점수 계산 (가중치: 모멘텀 45% + 유동성 25% + 촉매 30%)
        3. 점수 0.5 이상의 테마를 상위 3개 선택
        4. 지배적 테마 기반으로 종목 추천
        """
        catalyst_scores = catalyst_scores or {}
        theme_scores: dict[str, float] = {}
        notes: list[str] = []

        # 각 테마별로 종목 점수 계산
        for theme in self.config.theme_names:
            # UniverseScanner에서 테마의 종목 리스트 가져오기
            instruments = self.scanner.instruments_for_theme(theme)
            members = [quotes[instr.symbol] for instr in instruments if instr.symbol in quotes]

            if not members:
                theme_scores[theme] = 0.0
                logger.debug(f"Theme {theme}: no quotes available")
                continue

            # 모멘텀 계산 (일일 변화율)
            momentum = [
                _bounded((quote.change_pct or 0.0) / 6.0, floor=-1.0, ceiling=1.0)
                for quote in members
            ]
            # 유동성 계산 (상대거래량)
            rel_volume = [
                _bounded(((quote.relative_volume or 1.0) - 1.0) / 2.0, floor=-1.0, ceiling=1.0)
                for quote in members
            ]
            # 촉매 점수
            catalyst = [_bounded(catalyst_scores.get(quote.symbol, 0.50), floor=0.0, ceiling=1.0) for quote in members]

            # 테마 점수 = 가중 평균
            theme_scores[theme] = _normalize(
                _avg(momentum) * 0.45 + _avg(rel_volume) * 0.25 + _avg(catalyst) * 0.30
            )
            logger.info(f"Theme {theme}: momentum={_avg(momentum):.2f}, volume={_avg(rel_volume):.2f}, catalyst={_avg(catalyst):.2f} → score={theme_scores[theme]:.2f}")

        # 지배적 테마 선택 (점수 0.5 이상, 상위 3개)
        dominant = [
            theme for theme, score in sorted(theme_scores.items(), key=lambda item: item[1], reverse=True)
            if score >= 0.50
        ][:3]

        if not dominant:
            # 강한 신호가 없으면 가장 높은 점수 테마 사용
            dominant = [max(theme_scores, key=theme_scores.get)] if theme_scores else ["US_MEGACAP_TECH"]
            notes.append("⚠️ 강한 시장 신호 없음 - 가장 높은 점수 테마 사용")
        else:
            notes.append(f"✅ 지배적 테마 감지: {', '.join(dominant)}")

        risk_on_score = _bounded(_avg([score for score in theme_scores.values() if score > 0]), floor=0.0, ceiling=1.0)
        logger.info(f"Market regime detected: risk_on={risk_on_score:.2f}, themes={dominant}")

        return MarketRegime(risk_on_score=risk_on_score, dominant_themes=dominant, notes=notes)

    def build_candidates(
        self,
        regime: MarketRegime,
        quotes: dict[str, Quote],
        catalyst_scores: dict[str, float] | None = None,
        catalyst_summaries: dict[str, str] | None = None,
    ) -> list[Candidate]:
        """
        시장 체제에 맞는 후보 종목 생성 (동적 검색)

        프로세스:
        1. 지배적 테마에서 종목 리스트 가져오기 (UniverseScanner 사용)
        2. 주가 데이터로 필터링 (유효한 주가 + 유동성)
        3. 유동성, 모멘텀, 촉매 점수 계산
        4. 종목 점수로 랭킹 (상위 N개만 선택)
        """
        catalyst_scores = catalyst_scores or {}
        catalyst_summaries = catalyst_summaries or {}
        candidates: dict[str, Candidate] = {}

        # 지배적 테마에서만 종목 추출 (하드코딩 제거, 동적 검색)
        for theme in regime.dominant_themes:
            logger.info(f"Building candidates for theme: {theme}")

            # UniverseScanner에서 테마의 종목 가져오기
            instruments = self.scanner.instruments_for_theme(theme)
            logger.debug(f"  Theme {theme} has {len(instruments)} instruments")

            for instr in instruments:
                symbol = instr.symbol
                quote = quotes.get(symbol)

                # 주가 필터링
                if not quote or quote.price <= 0:
                    logger.debug(f"  Skipping {symbol}: no quote or zero price")
                    continue

                # 점수 계산
                liquidity_score = _bounded((quote.relative_volume or 1.0) / 2.5, floor=0.2, ceiling=1.0)
                momentum_score = _normalize((quote.change_pct or 0.0) / 8.0)
                catalyst_score = _bounded(catalyst_scores.get(symbol, 0.50), floor=0.0, ceiling=1.0)

                candidate = Candidate(
                    symbol=symbol,
                    name=instr.name,
                    market=instr.market,
                    currency=instr.currency,
                    theme=theme,
                    reason=f"{theme} 테마 (동적 감지); 출처={quote.source}",  # 동적 감지임을 표시
                    liquidity_score=liquidity_score,
                    momentum_score=momentum_score,
                    catalyst_score=catalyst_score,
                    issue_summary=catalyst_summaries.get(symbol, ""),
                )

                # 동일 종목이 여러 테마에 있으면 가장 높은 점수만 유지
                previous = candidates.get(symbol)
                if previous is None or candidate.score > previous.score:
                    candidates[symbol] = candidate
                    logger.debug(f"  ✓ {symbol}: score={candidate.score:.2f}, liquidity={liquidity_score:.2f}, momentum={momentum_score:.2f}")

        # 점수로 정렬 후 상위 N개만 반환
        ranked = sorted(candidates.values(), key=lambda candidate: candidate.score, reverse=True)
        result = [
            candidate for candidate in ranked
            if candidate.score >= self.config.min_candidate_score
        ][: self.config.max_candidates]

        logger.info(f"Generated {len(result)} candidates from {len(candidates)} screened instruments")
        return result


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _bounded(value: float, floor: float = 0.0, ceiling: float = 1.0) -> float:
    return max(floor, min(ceiling, value))


def _normalize(value: float) -> float:
    return _bounded((value + 1.0) / 2.0)
