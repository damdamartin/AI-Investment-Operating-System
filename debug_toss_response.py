#!/usr/bin/env python3
"""토스증권 API 응답 구조 디버깅"""

import asyncio
import sys
import os
import json
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from pyqqq.toss_client import TossSecuritiesClient

async def debug():
    """API 응답 구조 분석"""

    toss = TossSecuritiesClient()

    # 인증
    await toss.authenticate()

    # 직접 holdings 조회
    session = await toss._ensure_session()
    headers = toss._get_headers()
    headers["x-tossinvest-account"] = toss.account_ref

    url = f"{toss.base_url}/api/v1/holdings"

    async with session.get(url, headers=headers) as resp:
        data = await resp.json()

        print("=" * 80)
        print("📋 /api/v1/holdings 응답 구조")
        print("=" * 80)

        result = data.get("result", {})
        items = result.get("items", [])

        print(f"\n📊 항목 수: {len(items)}")
        print("\n상세 정보:")

        for i, item in enumerate(items):
            print(f"\n[항목 {i+1}]")
            print(json.dumps(item, ensure_ascii=False, indent=2))

    # 현금 조회
    print("\n" + "=" * 80)
    print("💰 현금 조회")
    print("=" * 80)

    krw_url = f"{toss.base_url}/api/v1/buying-power"
    async with session.get(
        krw_url,
        headers=headers,
        params={"currency": "KRW"}
    ) as resp:
        krw_data = await resp.json()
        print("\nKRW 응답:")
        print(json.dumps(krw_data, ensure_ascii=False, indent=2))

    async with session.get(
        krw_url,
        headers=headers,
        params={"currency": "USD"}
    ) as resp:
        usd_data = await resp.json()
        print("\nUSD 응답:")
        print(json.dumps(usd_data, ensure_ascii=False, indent=2))

    # 종료
    await session.close()

if __name__ == "__main__":
    load_dotenv()
    asyncio.run(debug())
