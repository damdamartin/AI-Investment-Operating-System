import asyncio
from src.pyqqq.upbit_client import UpbitClient

async def test():
    client = UpbitClient()
    
    # 디버그: 현재가 확인
    ticker = await client.get_ticker("KRW-BTC")
    print(f"BTC 현재가: ₩{ticker['trade_price']:,.0f}")
    
    # 디버그: 주문 전에 payload 확인
    print("\n주문 시도...")
    result = await client.place_order(
        market="KRW-BTC",
        side="bid",
        ord_type="market",
        price=50000  # ₩50,000
    )
    
    print(f"결과: {result}")

asyncio.run(test())
