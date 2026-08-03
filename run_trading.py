import asyncio
from src.pyqqq.upbit_client import UpbitClient
from src.pyqqq.portfolio_monitor import PortfolioMonitor
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def ultra_short_trading(duration_days=7):
    """급등락주 초단타 거래"""
    client = UpbitClient()
    
    # 급등락주 선정
    markets = ["KRW-SOL", "KRW-ADA"]  # 변동성 높은 종목
    
    start_time = datetime.now()
    end_time = start_time + timedelta(days=duration_days)
    
    trades = 0
    
    print(f"\n🚀 거래 시작: {start_time}")
    print(f"   대상: {markets}")
    print(f"   기간: {duration_days}일\n")
    
    while datetime.now() < end_time:
        try:
            # 현금 조회
            balance = await client.get_account_balance()
            cash = balance.get('balance', 0) if balance else 0
            
            if cash > 50000:
                # 매수
                result = await client.place_order(
                    market=markets[0],
                    side="bid",
                    ord_type="market",
                    price=min(cash * 0.2, 100000)
                )
                if result and result.get('uuid'):
                    print(f"✅ [{datetime.now().strftime('%H:%M:%S')}] 매수: {markets[0]}")
                    trades += 1
                
                await asyncio.sleep(5)
                
                # 매도
                holdings = await client.get_all_balances()
                for h in holdings:
                    if h['market'] == markets[0] and h['balance'] > 0:
                        result = await client.place_order(
                            market=markets[0],
                            side="ask",
                            ord_type="market",
                            volume=h['balance']
                        )
                        if result and result.get('uuid'):
                            print(f"✅ [{datetime.now().strftime('%H:%M:%S')}] 매도: {markets[0]}")
                            trades += 1
            
            await asyncio.sleep(10)
        
        except Exception as e:
            logger.error(f"❌ 오류: {e}")
            await asyncio.sleep(10)
    
    print(f"\n🎉 거래 완료!")
    print(f"   총 거래: {trades}회")
    print(f"   기간: {duration_days}일")

if __name__ == "__main__":
    asyncio.run(ultra_short_trading(duration_days=7))
