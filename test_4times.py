import asyncio
from pyupbit import Upbit
from src.pyqqq.config import settings

async def test_4trades():
    upbit = Upbit(settings.upbit_access_key, settings.upbit_secret_key)
    markets = ["KRW-BTC", "KRW-ETH", "KRW-SOL", "KRW-ADA"]
    
    print("\n🚀 4번 테스트 매매 시작!\n")
    
    for i in range(4):
        try:
            market = markets[i]
            balances = upbit.get_balances()
            krw = next((b for b in balances if b['currency'] == 'KRW'), None)
            cash = float(krw['balance']) if krw else 0
            
            if cash > 5000:
                # 매수
                buy_amount = min(int(cash * 0.1), 20000)
                print(f"#{i+1} 매수: {market} @ ₩{buy_amount:,}")
                order = upbit.buy_market_order(market, buy_amount)
                if order.get('uuid'):
                    print(f"   ✅ UUID: {order['uuid'][:8]}...\n")
                
                await asyncio.sleep(3)
                
                # 매도
                holdings = upbit.get_balances()
                coin = next((b for b in holdings if b['currency'] != 'KRW' and float(b['balance']) > 0), None)
                if coin:
                    print(f"#{i+1} 매도: {market}")
                    order = upbit.sell_market_order(market, float(coin['balance']))
                    if order.get('uuid'):
                        print(f"   ✅ UUID: {order['uuid'][:8]}...\n")
                
                await asyncio.sleep(3)
        except Exception as e:
            print(f"❌ 오류: {e}\n")
    
    print("✅ 4번 테스트 완료!")
    print("\n🚀 이제 부스터 시작합니다...\n")
    
    # 부스터 시작
    import subprocess
    subprocess.Popen(["python3", "-m", "src.pyqqq.strategy_upbit"], 
                     stdout=open("/tmp/booster.log", "w"),
                     stderr=subprocess.STDOUT)
    print("✅ 부스터 실행 시작!")
    print("   로그: /tmp/booster.log")

asyncio.run(test_4trades())
