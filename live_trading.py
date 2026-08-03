#!/usr/bin/env python3
"""
🔴 실제 매매 시스템 (Python)
업비트 공식 SDK 사용

실행:
export UPBIT_ACCESS_KEY="your_key"
export UPBIT_SECRET_KEY="your_secret"
python3 live_trading.py
"""

import os
import sys
import requests
from pyupbit import Upbit

def main():
    print("🔴 실제 매매 시스템 시작\n")

    # 1. API 키 확인
    access_key = os.getenv("UPBIT_ACCESS_KEY")
    secret_key = os.getenv("UPBIT_SECRET_KEY")

    if not access_key or not secret_key:
        print("❌ API 키 설정 필요:")
        print("export UPBIT_ACCESS_KEY=your_key")
        print("export UPBIT_SECRET_KEY=your_secret")
        sys.exit(1)

    # 2. Upbit 클라이언트 생성
    print("📋 계좌 정보 로드 중...\n")
    try:
        upbit = Upbit(access_key, secret_key)
    except Exception as e:
        print(f"❌ Upbit 연결 실패: {e}")
        sys.exit(1)

    # 3. 계좌 조회
    try:
        balances = upbit.get_balances()
        print("보유 자산:")
        for balance in balances:
            bal = float(balance['balance']) if isinstance(balance['balance'], str) else balance['balance']
            locked = float(balance['locked']) if isinstance(balance['locked'], str) else balance['locked']

            if bal > 0 or locked > 0:
                print(f"  {balance['currency']}: {bal:.8f} (잠금: {locked:.8f})")

        # KRW 잔금 확인
        krw_balance = next((b for b in balances if b['currency'] == 'KRW'), None)
        if krw_balance:
            krw_bal = float(krw_balance['balance']) if isinstance(krw_balance['balance'], str) else krw_balance['balance']
            print(f"\n💰 사용 가능한 KRW: {krw_bal:,.0f}")
        else:
            print("\n❌ KRW 계좌 없음")
            sys.exit(1)

    except Exception as e:
        print(f"❌ 계좌 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # 4. 시장 선택
    print("\n매매할 시장을 선택하세요:")
    print("1. KRW-BTC (비트코인)")
    print("2. KRW-ETH (이더리움)")
    print("3. KRW-XRP (리플)")
    print("4. KRW-DOGE (도지코인)")

    choice = input("\n선택 (1-4): ").strip()
    market_map = {
        "1": "KRW-BTC",
        "2": "KRW-ETH",
        "3": "KRW-XRP",
        "4": "KRW-DOGE"
    }

    market = market_map.get(choice)
    if not market:
        print("❌ 잘못된 선택")
        sys.exit(1)

    # 5. 투자 금액 입력
    amount_str = input(f"\n투자 금액 (KRW, 기본값: 10000): ").strip()
    invest_amount = int(amount_str) if amount_str else 10000

    # 6. 시세 조회
    print(f"\n📊 {market} 시세 조회 중...")
    try:
        # Upbit 공개 API로 시세 조회
        url = f"https://api.upbit.com/v1/ticker?markets={market}"
        response = requests.get(url)

        if response.status_code != 200:
            print(f"❌ 시세 조회 실패: {response.status_code}")
            sys.exit(1)

        ticker = response.json()[0]
        current_price = float(ticker['trade_price'])
        change_rate = float(ticker.get('signed_change_rate', 0))

        print(f"   현재가: {current_price:,.0f} KRW")
        print(f"   변동률: {change_rate*100:.2f}%")

    except Exception as e:
        print(f"❌ 시세 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # 7. 신호 생성
    print(f"\n🎯 신호 분석 중...")

    # 신호 조건: ±0.1% 이상 (테스트용으로 민감하게 설정)
    if change_rate > 0.001:  # 0.1% 이상 상승
        signal = "BUY"
        confidence = min(0.95, 0.5 + change_rate * 5)
        reason = f"상승 트렌드: {change_rate*100:.2f}%"
    elif change_rate < -0.001:  # 0.1% 이상 하락
        signal = "SELL"
        confidence = min(0.95, 0.5 + abs(change_rate) * 5)
        reason = f"하락 트렌드: {change_rate*100:.2f}%"
    else:
        signal = "HOLD"
        confidence = 0
        reason = "신호 없음"

    print(f"   신호: {signal} (신뢰도: {confidence*100:.0f}%)")
    print(f"   이유: {reason}")

    if signal == "HOLD":
        print("\n신호 없음 - 거래 취소")
        sys.exit(0)

    # 8. 주문 확인
    print(f"\n⚠️  경고: 실제 매매가 실행됩니다!")
    print(f"시장: {market}")
    print(f"신호: {signal}")
    print(f"금액: {invest_amount:,.0f} KRW")
    print(f"가격: {current_price:,.0f} KRW")

    confirm = input("\n계속하시겠습니까? (yes/no): ").strip().lower()

    if confirm != "yes":
        print("❌ 취소되었습니다.")
        sys.exit(0)

    # 9. 주문 실행
    print("\n🚀 주문 실행 중...\n")

    try:
        if signal == "BUY":
            # BUY 주문
            volume = invest_amount / current_price
            print(f"💰 BUY 주문: {volume:.8f} {market.split('-')[1]}")
            print(f"   금액: {invest_amount:,.0f} KRW")

            result = upbit.buy_limit_order(market, current_price, volume)

        else:  # SELL
            # 보유 자산 확인
            crypto = market.split('-')[1]
            crypto_balance = next((b for b in balances if b['currency'] == crypto), None)

            if not crypto_balance or crypto_balance['balance'] == 0:
                print(f"❌ {crypto} 잔고 없음")
                sys.exit(1)

            volume = crypto_balance['balance']
            print(f"💰 SELL 주문: {volume:.8f} {crypto}")
            print(f"   금액: {volume * current_price:,.0f} KRW")

            result = upbit.sell_limit_order(market, current_price, volume)

        # 10. 결과
        if result:
            print(f"\n✅ 주문 생성됨!")
            print(f"주문 ID: {result.get('uuid', 'N/A')}")
            print(f"상태: {result.get('state', 'N/A')}")
            print(f"\n🎉 실제 매매 완료!")
        else:
            print(f"\n❌ 주문 실패")

    except Exception as e:
        print(f"❌ 주문 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
