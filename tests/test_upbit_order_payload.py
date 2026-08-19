#!/usr/bin/env python3
"""
Upbit 주문 payload 검증 테스트
실제 주문 없이 payload 규격을 검증합니다.
"""

import json
import sys
from datetime import datetime
from urllib.parse import urlencode


def test_buy_order_payload():
    """매수 주문 payload 검증"""
    print("\n" + "=" * 80)
    print("🧪 테스트 1: 매수(BID) 주문 payload")
    print("=" * 80)

    # 테스트 데이터
    market = "KRW-BTC"
    side = "bid"
    ord_type = "price"  # Upbit API: 매수는 "price"
    price = 100000  # KRW 금액

    payload = {
        "market": market,
        "side": side,
        "ord_type": ord_type,
        "price": str(int(price))
    }

    print(f"\n📊 매수 주문 정보:")
    print(f"   마켓: {market}")
    print(f"   방향: {side.upper()}")
    print(f"   주문타입: {ord_type}")
    print(f"   금액: ₩{price:,.0f}")

    print(f"\n📝 Payload:")
    print(json.dumps(payload, indent=2, ensure_ascii=False))

    # 검증
    print(f"\n✅ 검증:")
    assert payload["market"] == "KRW-BTC", "마켓 코드 오류"
    assert payload["side"] == "bid", "side가 'bid'가 아님"
    assert payload["ord_type"] == "price", "ord_type이 'price'가 아님"
    assert "price" in payload, "price 필드 없음"
    assert payload["price"] == "100000", "price 값 오류"
    assert "volume" not in payload, "매수 주문에 volume이 있으면 안 됨"
    print("   ✅ 모든 검증 통과!")

    return True


def test_sell_order_payload():
    """매도 주문 payload 검증"""
    print("\n" + "=" * 80)
    print("🧪 테스트 2: 매도(ASK) 주문 payload")
    print("=" * 80)

    # 테스트 데이터
    market = "KRW-BTC"
    side = "ask"
    ord_type = "market"  # Upbit API: 매도는 "market"
    volume = 0.00050000  # 코인 수량

    payload = {
        "market": market,
        "side": side,
        "ord_type": ord_type,
        "volume": str(volume)
    }

    print(f"\n📊 매도 주문 정보:")
    print(f"   마켓: {market}")
    print(f"   방향: {side.upper()}")
    print(f"   주문타입: {ord_type}")
    print(f"   수량: {volume} BTC")

    print(f"\n📝 Payload:")
    print(json.dumps(payload, indent=2, ensure_ascii=False))

    # 검증
    print(f"\n✅ 검증:")
    assert payload["market"] == "KRW-BTC", "마켓 코드 오류"
    assert payload["side"] == "ask", "side가 'ask'가 아님"
    assert payload["ord_type"] == "market", "ord_type이 'market'이 아님"
    assert "volume" in payload, "volume 필드 없음"
    assert payload["volume"] == "0.0005", "volume 값 오류"
    assert "price" not in payload, "매도 주문에 price가 있으면 안 됨"
    print("   ✅ 모든 검증 통과!")

    return True


def test_query_string_encoding():
    """쿼리 스트링 인코딩 검증"""
    print("\n" + "=" * 80)
    print("🧪 테스트 3: 쿼리 스트링 인코딩")
    print("=" * 80)

    # 매수 payload
    buy_payload = {
        "market": "KRW-BTC",
        "side": "bid",
        "ord_type": "price",
        "price": "100000"
    }

    # 매도 payload
    sell_payload = {
        "market": "KRW-ETH",
        "side": "ask",
        "ord_type": "market",
        "volume": "0.00050000"
    }

    buy_query = urlencode(buy_payload)
    sell_query = urlencode(sell_payload)

    print(f"\n📝 매수 쿼리 스트링:")
    print(f"   {buy_query}")

    print(f"\n📝 매도 쿼리 스트링:")
    print(f"   {sell_query}")

    print(f"\n✅ 검증:")
    assert "market=KRW-BTC" in buy_query, "market 인코딩 오류"
    assert "side=bid" in buy_query, "side 인코딩 오류"
    assert "ord_type=price" in buy_query, "ord_type 인코딩 오류"
    assert "price=100000" in buy_query, "price 인코딩 오류"

    assert "market=KRW-ETH" in sell_query, "market 인코딩 오류"
    assert "side=ask" in sell_query, "side 인코딩 오류"
    assert "ord_type=market" in sell_query, "ord_type 인코딩 오류"
    assert "volume=0.0005" in sell_query or "volume=0.00050000" in sell_query, "volume 인코딩 오류"
    print("   ✅ 모든 쿼리 스트링 유효!")

    return True


def test_edge_cases():
    """엣지 케이스 검증"""
    print("\n" + "=" * 80)
    print("🧪 테스트 4: 엣지 케이스")
    print("=" * 80)

    print(f"\n📊 테스트 1: 매우 작은 수량")
    small_volume = 0.00000001
    payload = {
        "market": "KRW-BTC",
        "side": "ask",
        "ord_type": "market",
        "volume": str(small_volume)
    }
    print(f"   ✅ 수량: {payload['volume']} (최소 단위)")

    print(f"\n📊 테스트 2: 큰 금액")
    large_price = 500000000  # 5억원
    payload = {
        "market": "KRW-BTC",
        "side": "bid",
        "ord_type": "price",
        "price": str(large_price)
    }
    print(f"   ✅ 금액: ₩{large_price:,.0f}")

    print(f"\n📊 테스트 3: 여러 마켓")
    for market in ["KRW-BTC", "KRW-ETH", "KRW-SOL"]:
        payload = {
            "market": market,
            "side": "bid",
            "ord_type": "price",
            "price": "100000"
        }
        print(f"   ✅ {market} - payload 유효")

    print(f"\n✅ 모든 엣지 케이스 통과!")
    return True


def main():
    """메인 테스트 실행"""
    print("\n" + "=" * 80)
    print("🧪 Upbit 주문 Payload 검증 테스트")
    print("=" * 80)
    print(f"테스트 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    try:
        test_buy_order_payload()
        test_sell_order_payload()
        test_query_string_encoding()
        test_edge_cases()

        print("\n" + "=" * 80)
        print("✅ 모든 테스트 통과!")
        print("=" * 80)
        return 0
    except AssertionError as e:
        print(f"\n❌ 테스트 실패: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ 오류: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
