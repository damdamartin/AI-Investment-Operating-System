import asyncio
from src.pyqqq.upbit_client import UpbitClient
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def live_trading(duration_days=7):
    """실거래: 급등락주 초단타 거래 (1주일)"""
    client = UpbitClient()
    
    # 더 많은 종목 선택지
    all_markets = ["KRW-BTC", "KRW-ETH", "KRW-SOL", "KRW-ADA", 
                   "KRW-DOGE", "KRW-XRP", "KRW-LTC", "KRW-LINK"]
    
    start_time = datetime.now()
    end_time = start_time + timedelta(days=duration_days)
    
    trades = 0
    success = 0
    failed = 0
    
    print(f"\n🚀 실시간 초단타 거래 시작!")
    print(f"   종목: {all_markets}")
    print(f"   기간: {duration_days}일")
    print(f"   시작: {start_time}\n")
    
    market_idx = 0
    
    while datetime.now() < end_time:
        try:
            market = all_markets[market_idx % len(all_markets)]
            
            # 현금 조회
            balance = await client.get_account_balance()
            cash = balance.get('balance', 0) if balance else 0
            
            if cash > 50000:
                # 매수 시도
                buy_amount = min(cash * 0.1, 50000)  # 10% 또는 최대 50,000원
                result = await client.place_order(
                    market=market,
                    side="bid",
                    ord_type="market",
                    price=buy_amount
                )
                
                trades += 1
                if result and result.get('uuid'):
                    success += 1
                    print(f"✅ #{trades} 매수 성공: {market} @ ₩{buy_amount:,.0f} (UUID: {result['uuid'][:8]}...)")
                else:
                    failed += 1
                    print(f"❌ #{trades} 매수 실패: {market}")
                    market_idx += 1  # 다음 종목으로
                
                # 5초 대기
                await asyncio.sleep(5)
                
                # 매도 시도
                holdings = await client.get_all_balances()
                if holdings:
                    for h in holdings:
                        if h['market'] == market and h['balance'] > 0:
                            result = await client.place_order(
                                market=market,
                                side="ask",
                                ord_type="market",
                                volume=h['balance']
                            )
                            
                            trades += 1
                            if result and result.get('uuid'):
                                success += 1
                                print(f"✅ #{trades} 매도 성공: {market} x {h['balance']:.8f} (UUID: {result['uuid'][:8]}...)")
                            else:
                                failed += 1
                                print(f"❌ #{trades} 매도 실패: {market}")
                
                # 10초 간격
                await asyncio.sleep(10)
            
        except Exception as e:
            logger.error(f"❌ 오류: {e}")
            await asyncio.sleep(10)
    
    print(f"\n🎉 실거래 완료!")
    print(f"   총 거래 시도: {trades}회")
    print(f"   성공: {success}회 ✅")
    print(f"   실패: {failed}회 ❌")
    print(f"   성공률: {(success/(trades or 1)*100):.1f}%")

if __name__ == "__main__":
    asyncio.run(live_trading(duration_days=7))
