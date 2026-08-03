import asyncio
from pyupbit import Upbit
from src.pyqqq.config import settings
from datetime import datetime, timedelta

async def live_trading_1week():
    upbit = Upbit(settings.upbit_access_key, settings.upbit_secret_key)
    markets = ["KRW-BTC", "KRW-ETH", "KRW-SOL", "KRW-ADA"]
    start = datetime.now()
    end = start + timedelta(days=7)
    trades = 0
    success = 0
    print(f"\n🚀 1주일 자동매매 시작!")
    print(f"   기간: {start} ~ {end}")
    print(f"   종목: {markets}\n")
    market_idx = 0
    while datetime.now() < end:
        try:
            market = markets[market_idx % len(markets)]
            balances = upbit.get_balances()
            krw = next((b for b in balances if b['currency'] == 'KRW'), None)
            cash = float(krw['balance']) if krw else 0
            if cash > 5000:
                buy_amount = min(int(cash * 0.1), 20000)
                print(f"📨 매수: {market} @ ₩{buy_amount:,}")
                order = upbit.buy_market_order(market, buy_amount)
                if order and order.get('uuid'):
                    trades += 1
                    success += 1
                    print(f"   ✅ UUID: {order['uuid'][:8]}...")
                await asyncio.sleep(5)
                holdings = upbit.get_balances()
                coin = next((b for b in holdings if b['currency'] != 'KRW' and float(b['balance']) > 0), None)
                if coin:
                    print(f"📨 매도: {market}")
                    order = upbit.sell_market_order(market, float(coin['balance']))
                    if order and order.get('uuid'):
                        trades += 1
                        success += 1
                        print(f"   ✅ UUID: {order['uuid'][:8]}...")
                await asyncio.sleep(10)
                market_idx += 1
        except Exception as e:
            print(f"❌ 오류: {e}")
            await asyncio.sleep(10)
    print(f"\n🎉 1주일 자동매매 완료! 거래: {trades}회, 성공: {success}회")

asyncio.run(live_trading_1week())
