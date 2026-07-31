#!/usr/bin/env python3
"""
Toss API 상세 디버그 테스트
"""
import asyncio
import sys
sys.path.insert(0, '/Users/mac/Documents/Codex/AI-Investment-Operating-System')

from src.pyqqq.toss_client import TossSecuritiesClient
import json


async def debug_test():
    """상세 디버그 테스트"""
    print("\n" + "=" * 70)
    print("🔍 Toss API 상세 디버그 테스트")
    print("=" * 70)

    client = TossSecuritiesClient()

    # 인증
    print("\n[1] 인증 중...")
    auth_result = await client.authenticate()
    if not auth_result:
        print("❌ 인증 실패")
        return

    print(f"✅ 인증 성공")
    print(f"   토큰: {client.access_token[:30]}...")

    # 1. 보유주식 상세 조회
    print("\n[2] 보유주식 조회 (상세)")
    print("-" * 70)
    try:
        session = await client._ensure_session()
        url = f"{client.base_url}/api/v1/holdings"
        headers = client._get_headers()
        headers["x-tossinvest-account"] = client.account_ref

        print(f"URL: {url}")
        print(f"Headers: x-tossinvest-account={client.account_ref}")

        async with session.get(url, headers=headers, timeout=10) as resp:
            print(f"Status: {resp.status}")
            data = await resp.text()
            print(f"Response: {data[:500]}")

            if resp.status == 200:
                try:
                    json_data = json.loads(data)
                    print(f"Parsed JSON: {json.dumps(json_data, indent=2)[:500]}")
                except:
                    pass

    except Exception as e:
        print(f"❌ 오류: {e}")

    # 2. 시세 조회 상세
    print("\n[3] 시세 조회 (상세)")
    print("-" * 70)
    try:
        session = await client._ensure_session()
        url = f"{client.base_url}/api/v1/prices"
        headers = client._get_headers()
        params = {"symbols": "005930"}

        print(f"URL: {url}")
        print(f"Params: symbols=005930")

        async with session.get(url, headers=headers, params=params, timeout=10) as resp:
            print(f"Status: {resp.status}")
            data = await resp.text()
            print(f"Response: {data[:500]}")

            if resp.status == 200:
                try:
                    json_data = json.loads(data)
                    print(f"Parsed JSON: {json.dumps(json_data, indent=2)[:500]}")
                except:
                    pass

    except Exception as e:
        print(f"❌ 오류: {e}")

    # 3. 주문 조회 상세
    print("\n[4] 주문 조회 (상세)")
    print("-" * 70)
    try:
        session = await client._ensure_session()
        url = f"{client.base_url}/api/v1/orders"
        headers = client._get_headers()
        headers["x-tossinvest-account"] = client.account_ref
        params = {"status": "PENDING"}

        print(f"URL: {url}")
        print(f"Headers: x-tossinvest-account={client.account_ref}")
        print(f"Params: status=PENDING")

        async with session.get(url, headers=headers, params=params, timeout=10) as resp:
            print(f"Status: {resp.status}")
            data = await resp.text()
            print(f"Response: {data[:500]}")

            if resp.status == 200:
                try:
                    json_data = json.loads(data)
                    print(f"Parsed JSON: {json.dumps(json_data, indent=2)[:500]}")
                except:
                    pass

    except Exception as e:
        print(f"❌ 오류: {e}")

    await client.close()
    print("\n" + "=" * 70)


if __name__ == "__main__":
    asyncio.run(debug_test())
