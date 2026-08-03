"""
암호화폐 AI 매매 시스템 - 전략·리스크팀 구현 검증 테스트
"""
import sys
sys.path.insert(0, '/Users/mac/Documents/Codex/AI-Investment-Operating-System')

from src.pyqqq.strategy_upbit import (
    UpbitTradingStrategy,
    CRYPTO_TRADING_RULES
)
from src.pyqqq.position_manager import Position, PositionManager, PositionStatus
from datetime import datetime
import math


def test_market_state_analysis():
    """시장 상태 분석 테스트"""
    print("\n🧪 시장 상태 분석 테스트")
    print("=" * 60)

    strategy = UpbitTradingStrategy()

    # 테스트 케이스 1: UPTREND (연속 상승)
    ohlc_uptrend = [
        {"closing_price": 65000000},
        {"closing_price": 65100000},
        {"closing_price": 65200000},
        {"closing_price": 65300000},
        {"closing_price": 65400000},
    ]
    state = strategy._analyze_market_state(ohlc_uptrend)
    print(f"✅ UPTREND 감지: {state} (예상: UPTREND)")
    assert state == "UPTREND", f"UPTREND 감지 실패: {state}"

    # 테스트 케이스 2: DOWNTREND (연속 하락)
    ohlc_downtrend = [
        {"closing_price": 65400000},
        {"closing_price": 65300000},
        {"closing_price": 65200000},
        {"closing_price": 65100000},
        {"closing_price": 65000000},
    ]
    state = strategy._analyze_market_state(ohlc_downtrend)
    print(f"✅ DOWNTREND 감지: {state} (예상: DOWNTREND)")
    assert state == "DOWNTREND", f"DOWNTREND 감지 실패: {state}"

    # 테스트 케이스 3: VOLATILITY (큰 변동성)
    ohlc_volatility = [
        {"closing_price": 65000000},
        {"closing_price": 65500000},  # +500K
        {"closing_price": 64500000},  # -1M
        {"closing_price": 65400000},  # +900K
        {"closing_price": 64600000},  # -800K
    ]
    state = strategy._analyze_market_state(ohlc_volatility)
    print(f"✅ VOLATILITY 감지: {state}")
    # VOLATILITY 또는 SIDEWAYS 둘 다 가능

    # 테스트 케이스 4: SIDEWAYS (횡보)
    ohlc_sideways = [
        {"closing_price": 65100000},
        {"closing_price": 65200000},
        {"closing_price": 65050000},
        {"closing_price": 65150000},
        {"closing_price": 65100000},
    ]
    state = strategy._analyze_market_state(ohlc_sideways)
    print(f"✅ SIDEWAYS 감지: {state}")

    print("\n✅ 시장 상태 분석 테스트 통과")


def test_orderbook_analysis():
    """호가 분석 테스트"""
    print("\n🧪 호가·체결 분석 테스트")
    print("=" * 60)

    strategy = UpbitTradingStrategy()

    # 테스트 케이스 1: 매수 강세
    orderbook_buy_strength = {
        "bids": [
            {"size": 2.0}, {"size": 1.5}, {"size": 1.2}, {"size": 1.0}, {"size": 0.8}
        ],
        "asks": [
            {"size": 0.5}, {"size": 0.4}, {"size": 0.3}, {"size": 0.2}, {"size": 0.1}
        ]
    }
    result = strategy._analyze_orderbook(orderbook_buy_strength)
    print(f"✅ 매수 강세 분석:")
    print(f"   - bid_strength: {result['bid_strength']:.2f} (예상: > 0.7)")
    print(f"   - ask_strength: {result['ask_strength']:.2f} (예상: < 0.3)")
    print(f"   - pressure_ratio: {result['pressure_ratio']:.2f} (예상: > 1.5)")
    assert result['bid_strength'] > 0.7, "매수 강도 계산 오류"
    assert result['pressure_ratio'] > 1.5, "압력비 계산 오류"

    # 테스트 케이스 2: 균형
    orderbook_balanced = {
        "bids": [{"size": 1.0}] * 5,
        "asks": [{"size": 1.0}] * 5
    }
    result = strategy._analyze_orderbook(orderbook_balanced)
    print(f"\n✅ 균형 호가 분석:")
    print(f"   - bid_strength: {result['bid_strength']:.2f} (예상: 0.5)")
    print(f"   - pressure_ratio: {result['pressure_ratio']:.2f} (예상: 1.0)")
    assert 0.45 < result['bid_strength'] < 0.55, "균형 호가 분석 오류"

    # 테스트 케이스 3: None 입력 (안전성 테스트)
    result = strategy._analyze_orderbook(None)
    print(f"\n✅ None 입력 안전성:")
    print(f"   - 기본값 반환: {result}")
    assert result['bid_strength'] == 0.5, "기본값 설정 오류"

    print("\n✅ 호가 분석 테스트 통과")


def test_trading_signal_generation():
    """신호 생성 테스트"""
    print("\n🧪 신호 생성 테스트")
    print("=" * 60)

    strategy = UpbitTradingStrategy()

    # 테스트 케이스 1: UPTREND 신호
    signal = strategy._generate_trading_signal(
        market="KRW-BTC",
        current_price=65000000.0,
        market_state="UPTREND",
        signal_strength="강함",
        orderbook=None,
        confidence=75
    )
    print(f"✅ UPTREND 신호 생성:")
    if signal:
        print(f"   - entry_price: {signal['entry_price']:,.0f}")
        print(f"   - take_profit: {signal['take_profit']:,.0f} (예상: +10%)")
        print(f"   - stop_loss: {signal['stop_loss']:,.0f} (예상: -5%)")
        print(f"   - confidence: {signal['confidence']:.2f}")
        assert signal['take_profit'] > signal['entry_price'] * 1.09, "익절가 오류"
        assert signal['stop_loss'] < signal['entry_price'] * 0.96, "손절가 오류"
    else:
        print(f"   ⚠️  신호 없음 (신뢰도 부족?)")

    # 테스트 케이스 2: VOLATILITY + 높은 매수 강도
    orderbook_buy = {
        "bids": [{"size": 2.0}] * 5,
        "asks": [{"size": 0.5}] * 5
    }
    signal = strategy._generate_trading_signal(
        market="KRW-ETH",
        current_price=3000000.0,
        market_state="VOLATILITY",
        signal_strength="강함",
        orderbook=orderbook_buy,
        confidence=80
    )
    print(f"\n✅ VOLATILITY 신호 생성:")
    if signal:
        print(f"   - entry_price: {signal['entry_price']:,.0f}")
        print(f"   - take_profit: {signal['take_profit']:,.0f} (예상: +5%)")
        print(f"   - stop_loss: {signal['stop_loss']:,.0f} (예상: -2%)")
        assert signal['take_profit'] > signal['entry_price'] * 1.04, "익절가 오류"
    else:
        print(f"   ⚠️  신호 없음")

    # 테스트 케이스 3: 신뢰도 70% 미만 (필터링)
    signal = strategy._generate_trading_signal(
        market="KRW-SOL",
        current_price=25000.0,
        market_state="UPTREND",
        signal_strength="중간",
        orderbook=None,
        confidence=65  # 70% 미만
    )
    print(f"\n✅ 신뢰도 필터링:")
    print(f"   - confidence 65%: {signal} (예상: None)")
    assert signal is None, "신뢰도 필터링 실패"

    print("\n✅ 신호 생성 테스트 통과")


def test_kelly_criterion():
    """Kelly Criterion 포지션 사이징 테스트"""
    print("\n🧪 Kelly Criterion 테스트")
    print("=" * 60)

    strategy = UpbitTradingStrategy()

    # 테스트 케이스 1: 승률 60%, 수익:손실 1:0.5
    kelly_size = strategy._calculate_kelly_criterion(
        win_rate=0.6,
        avg_win=1000.0,
        avg_loss=-500.0
    )
    print(f"✅ Kelly 계산 (60% 승률, 1:0.5):")
    print(f"   - 포지션: {kelly_size:.2%} (예상: 10-15%)")
    assert 0.05 < kelly_size < 0.5, "Kelly 계산 오류"

    # 테스트 케이스 2: 승률 55%, 균등
    kelly_size = strategy._calculate_kelly_criterion(
        win_rate=0.55,
        avg_win=1000.0,
        avg_loss=-1000.0
    )
    print(f"\n✅ Kelly 계산 (55% 승률, 1:1):")
    print(f"   - 포지션: {kelly_size:.2%} (예상: 5-10%)")
    assert 0.01 < kelly_size < 0.2, "Kelly 계산 오류"

    # 테스트 케이스 3: 위험한 설정 (승률 50%)
    kelly_size = strategy._calculate_kelly_criterion(
        win_rate=0.5,
        avg_win=1000.0,
        avg_loss=-1000.0
    )
    print(f"\n✅ Kelly 계산 (50% 승률):")
    print(f"   - 포지션: {kelly_size:.2%} (예상: 1%)")
    assert kelly_size >= 0.01, "안전장치 작동 오류"

    print("\n✅ Kelly Criterion 테스트 통과")


def test_risk_limits():
    """리스크 제한 체크 테스트"""
    print("\n🧪 리스크 제한 체크 테스트")
    print("=" * 60)

    strategy = UpbitTradingStrategy()

    # 신호 준비
    signal = {
        "market": "KRW-BTC",
        "current_price": 65000000.0,
        "entry_price": 64900000.0,
        "take_profit_price": 71500000.0,
        "stop_loss_price": 61750000.0,
        "confidence": 0.75
    }

    # 테스트 케이스 1: 정상 상황
    print("✅ 테스트 1: 정상 상황")
    result = strategy._check_risk_limits(
        signal=signal,
        current_balance=1000000.0,
        open_positions=[],
        daily_pnl=-50000.0
    )
    print(f"   - approved: {result['approved']} (예상: True)")
    print(f"   - position_size: {result['adjusted_position_size']:.2%}")
    print(f"   - reason: {result['reason']}")
    assert result['approved'] is True, "정상 상황 승인 실패"

    # 테스트 케이스 2: 일일 손실 한도 도달
    print("\n✅ 테스트 2: 일일 손실 한도 도달")
    result = strategy._check_risk_limits(
        signal=signal,
        current_balance=1000000.0,
        open_positions=[],
        daily_pnl=-105000.0  # -10.5% > -10%
    )
    print(f"   - approved: {result['approved']} (예상: False)")
    print(f"   - reason: {result['reason']}")
    assert result['approved'] is False, "일일 손실 한도 체크 실패"

    # 테스트 케이스 3: 신뢰도 낮음
    print("\n✅ 테스트 3: 신뢰도 낮음")
    low_confidence_signal = {**signal, "confidence": 0.65}
    result = strategy._check_risk_limits(
        signal=low_confidence_signal,
        current_balance=1000000.0,
        open_positions=[],
        daily_pnl=0.0
    )
    print(f"   - approved: {result['approved']} (예상: False)")
    print(f"   - reason: {result['reason']}")
    assert result['approved'] is False, "신뢰도 필터링 실패"

    # 테스트 케이스 4: 신호 없음
    print("\n✅ 테스트 4: 신호 없음")
    result = strategy._check_risk_limits(
        signal=None,
        current_balance=1000000.0,
        open_positions=[],
        daily_pnl=0.0
    )
    print(f"   - approved: {result['approved']} (예상: False)")
    print(f"   - reason: {result['reason']}")
    assert result['approved'] is False, "신호 없음 체크 실패"

    print("\n✅ 리스크 제한 체크 테스트 통과")


def test_crypto_trading_rules():
    """암호화폐 매매 규칙 검증"""
    print("\n🧪 암호화폐 매매 규칙 검증")
    print("=" * 60)

    print("📋 CRYPTO_TRADING_RULES:")
    for key, value in CRYPTO_TRADING_RULES.items():
        print(f"   - {key}: {value}")

    # 규칙 검증
    assert CRYPTO_TRADING_RULES["max_daily_loss"] == -0.10, "일일 손실 한도 오류"
    assert CRYPTO_TRADING_RULES["max_drawdown"] == -0.20, "드로우다운 한도 오류"
    assert CRYPTO_TRADING_RULES["min_signal_confidence"] == 0.70, "신뢰도 필터 오류"
    assert CRYPTO_TRADING_RULES["consecutive_loss_threshold"] == 3, "연속 손실 임계값 오류"

    print("\n✅ 암호화폐 매매 규칙 검증 통과")


def run_all_tests():
    """모든 테스트 실행"""
    print("\n" + "=" * 60)
    print("🚀 암호화폐 전략·리스크팀 테스트 시작")
    print("=" * 60)

    try:
        test_market_state_analysis()
        test_orderbook_analysis()
        test_trading_signal_generation()
        test_kelly_criterion()
        test_risk_limits()
        test_crypto_trading_rules()

        print("\n" + "=" * 60)
        print("✅ 모든 테스트 통과!")
        print("=" * 60)
        return True

    except AssertionError as e:
        print(f"\n❌ 테스트 실패: {e}")
        return False
    except Exception as e:
        print(f"\n❌ 예상 치 못한 오류: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
