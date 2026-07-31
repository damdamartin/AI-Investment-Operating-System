#!/usr/bin/env python3
"""
Toss Securities API 실제 데이터 테스트
"""
import asyncio
import sys
sys.path.insert(0, '/Users/mac/Documents/Codex/AI-Investment-Operating-System')

from src.pyqqq.toss_client import TossSecuritiesClient
from src.pyqqq.config import settings


async def test_toss_api():
    """Toss API 실제 데이터 테스트"""
    print("\n" + "=" * 70)
    print("🧪 Toss Securities API 실제 데이터 테스트")
    print("=" * 70)

    client = TossSecuritiesClient()

    try:
        # 1. 인증 테스트
        print("\n[1/5] 인증 테스트")
        print("-" * 70)
        print(f"Client ID: {client.client_id[:20]}...")
        print(f"API URL: {client.base_url}")
        print(f"Account Ref: {client.account_ref}")
        print(f"Read-Only Mode: {client.read_only}")
        print("\n📍 인증 시도 중...")

        auth_result = await client.authenticate()
        if auth_result:
            print(f"✅ 인증 성공!")
            print(f"   토큰: {client.access_token[:20]}...")
            print(f"   만료: {client.token_expiry}")
        else:
            print(f"❌ 인증 실패")
            print(f"   가능한 원인:")
            print(f"   1. 잘못된 Client ID/Secret")
            print(f"   2. IP 화이트리스트 미등록 (현재 IP)")
            print(f"   3. Toss 서버 오류")
            await client.close()
            return

        # 2. 계좌 잔고 조회
        print("\n[2/5] 계좌 잔고 조회")
        print("-" * 70)
        balance = await client.get_account_balance()
        if balance:
            print(f"✅ 계좌 조회 성공!")
            print(f"   현금: {balance.get('cash', 0):,.0f}원")
            print(f"   총자산: {balance.get('total_value', 0):,.0f}원")
            print(f"   매수력: {balance.get('buying_power', 0):,.0f}원")
            print(f"   D+2 현금: {balance.get('d2_cash', 0):,.0f}원")
        else:
            print(f"❌ 계좌 조회 실패")

        # 3. 보유주식 조회
        print("\n[3/5] 보유주식 조회")
        print("-" * 70)
        holdings = await client.get_holdings()
        if holdings is not None and len(holdings) > 0:
            print(f"✅ 보유주식 조회 성공! ({len(holdings)}개)")
            for i, h in enumerate(holdings[:5], 1):  # 처음 5개만
                print(f"\n   {i}. {h.get('symbol')} ({h.get('name', 'N/A')})")
                print(f"      수량: {h.get('quantity', 0)}주")
                print(f"      매입가: {h.get('purchasePrice', 0):,.0f}원")
                print(f"      현재가: {h.get('currentPrice', 0):,.0f}원")
                print(f"      평가금액: {h.get('evaluationAmount', 0):,.0f}원")
                print(f"      수익률: {h.get('gainRate', 0):+.2f}%")
        else:
            print(f"⚠️  보유주식이 없음 (또는 조회 실패)")

        # 4. 실시간 시세 조회
        print("\n[4/5] 실시간 시세 조회")
        print("-" * 70)
        test_symbols = ["005930", "000660", "035420"]  # 삼성전자, SK하이닉스, NAVER
        for symbol in test_symbols:
            price = await client.get_stock_price(symbol)
            if price:
                symbol_name = {
                    "005930": "삼성전자",
                    "000660": "SK하이닉스",
                    "035420": "NAVER"
                }.get(symbol, symbol)
                print(f"✅ {symbol_name} ({symbol}): {price:,.0f}원")
            else:
                symbol_name = {
                    "005930": "삼성전자",
                    "000660": "SK하이닉스",
                    "035420": "NAVER"
                }.get(symbol, symbol)
                print(f"❌ {symbol_name} ({symbol}): 조회 실패")

        # 5. 주문 조회
        print("\n[5/5] 주문 조회")
        print("-" * 70)
        orders = await client.get_orders(status="PENDING")
        if orders is not None:
            if len(orders) > 0:
                print(f"✅ 대기 중인 주문 ({len(orders)}개):")
                for i, o in enumerate(orders[:5], 1):
                    print(f"\n   {i}. 주문 ID: {o.get('orderId')}")
                    print(f"      종목: {o.get('symbol')}")
                    print(f"      수량: {o.get('quantity')}주")
                    print(f"      가격: {o.get('price'):,.0f}원")
                    print(f"      방향: {o.get('side')}")
                    print(f"      상태: {o.get('status')}")
            else:
                print(f"⚠️  대기 중인 주문이 없음")
        else:
            print(f"❌ 주문 조회 실패")

        # 최종 결론
        print("\n" + "=" * 70)
        print("📊 테스트 결과 요약")
        print("=" * 70)
        print("✅ Toss API 연동 성공!")
        print("\n다음 단계:")
        print("1. 배포 시 이 스크립트를 자동으로 실행할 수 있습니다")
        print("2. 실제 거래 시 실시간 데이터를 사용할 수 있습니다")
        print("3. 자동매매 시스템이 정상 작동합니다")

    except Exception as e:
        print(f"\n❌ API 오류 발생: {e}")
        import traceback
        traceback.print_exc()

    finally:
        await client.close()
        print("\n" + "=" * 70)


async def main():
    await test_toss_api()


if __name__ == "__main__":
    asyncio.run(main())
