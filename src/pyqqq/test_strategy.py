"""
PyQQQ 시스템 테스트 (Phase 2: Toss API 완전 연동)
"""
import asyncio
import sys
sys.path.insert(0, '/Users/mac/Documents/Codex/AI-Investment-Operating-System')

from src.pyqqq.strategy import TradingStrategy
from src.pyqqq.claude_analyzer import ClaudeAnalyzer
from src.pyqqq.toss_client import TossSecuritiesClient
from src.pyqqq.position_manager import Position, PositionManager
from datetime import datetime


async def test_claude_analyzer():
    """Claude 분석 테스트"""
    print("\n🧪 Claude 분석 테스트")
    print("=" * 60)

    analyzer = ClaudeAnalyzer()

    # 삼성전자 분석
    result = await analyzer.analyze_stock(
        symbol="005930",
        current_price=65000,
        recent_data={
            "price_change": "+2.5%",
            "volume": "12.5B",
            "pe_ratio": 12.5,
            "market_cap": "2,000T"
        }
    )

    print(f"종목: Samsung Electronics (005930)")
    print(f"신호: {result['recommendation']}")
    print(f"신뢰도: {result['confidence']:.1%}")
    print(f"진입가: {result['entry_price']:,.0f}원")
    print(f"손절가: {result['stop_loss_price']:,.0f}원")
    print(f"익절가: {result['take_profit_price']:,.0f}원")
    print(f"근거: {result['reasoning']}")
    return True


async def test_toss_client():
    """Toss API 테스트 (Phase 2)"""
    print("\n🧪 Toss Securities API 테스트 (Phase 2)")
    print("=" * 60)

    toss = TossSecuritiesClient()

    try:
        # 1. 인증 테스트
        print("📍 1️⃣  Toss API 인증 중...")
        auth_result = await toss.authenticate()
        if not auth_result:
            print("❌ 인증 실패 - IP 화이트리스트 확인 필요")
            print("   등록된 IP: 34.158.219.64")
            return False

        # 2. 계좌 잔고 조회
        print("📍 2️⃣  계좌 잔고 조회 중...")
        balance = await toss.get_account_balance()
        if balance:
            print(f"  ✅ 현금: {balance.get('cash', 0):,.0f}원")
            print(f"  ✅ 총자산: {balance.get('total_value', 0):,.0f}원")
            print(f"  ✅ 매수력: {balance.get('buying_power', 0):,.0f}원")
        else:
            print("  ⚠️  잔고 조회 실패")
            return False

        # 3. 보유주식 조회
        print("📍 3️⃣  보유주식 조회 중...")
        holdings = await toss.get_holdings()
        print(f"  ✅ 보유주식: {len(holdings)}개")
        if holdings:
            for h in holdings[:3]:
                qty = h.get('quantity', 0)
                price = h.get('purchasePrice', 0)
                print(f"     - {h.get('symbol')}: {qty}주 @ {price:,.0f}원")

        # 4. 실시간 시세 조회
        print("📍 4️⃣  실시간 시세 조회 중...")
        for symbol in ["005930", "000660"]:  # 삼성전자, SK하이닉스
            price = await toss.get_stock_price(symbol)
            if price:
                print(f"  ✅ {symbol}: {price:,.0f}원")
            else:
                print(f"  ⚠️  {symbol}: 조회 실패")

        # 5. 주문 조회 (PENDING)
        print("📍 5️⃣  대기 중인 주문 조회 중...")
        orders = await toss.get_orders(status="PENDING")
        print(f"  ✅ 대기 주문: {len(orders)}개")
        if orders:
            for o in orders[:3]:
                print(f"     - {o.get('orderId')}: {o.get('symbol')} {o.get('quantity')}주")

        await toss.close()
        return True

    except Exception as e:
        print(f"❌ Toss API 오류: {e}")
        await toss.close()
        return False


async def test_position_manager():
    """포지션 관리자 테스트"""
    print("\n🧪 포지션 관리자 테스트")
    print("=" * 60)

    pm = PositionManager()

    # 포지션 생성
    pos1 = Position(
        symbol="005930",
        quantity=10,
        entry_price=65000,
        entry_time=datetime.now(),
        stop_loss_price=61750,
        take_profit_price=71500
    )
    pm.add_position(pos1)

    # 포지션 업데이트
    pm.update_all_positions("005930", 66000)
    print(f"📍 포지션 업데이트: 65000원 → 66000원")

    # P&L 확인
    pos = pm.get_position_by_symbol("005930")
    if pos:
        print(f"  ✅ P&L: {pos.pnl:+,.0f}원 ({pos.pnl_pct:+.2f}%)")
        print(f"  ✅ 손절: {pos.stop_loss_price:,.0f}원")
        print(f"  ✅ 익절: {pos.take_profit_price:,.0f}원")

    # 포트폴리오 요약
    summary = pm.get_portfolio_summary()
    print(f"📍 포트폴리오 요약:")
    print(f"  ✅ 열린 포지션: {summary['open_positions_count']}개")
    print(f"  ✅ 포지션 가치: {summary['open_positions_value']:,.0f}원")
    print(f"  ✅ P&L: {summary['open_pnl']:+,.0f}원")

    return True


async def test_full_cycle():
    """전체 사이클 테스트"""
    print("\n🧪 전체 거래 사이클 테스트")
    print("=" * 60)

    strategy = TradingStrategy()

    print(f"📍 Watchlist: {len(strategy.watchlist)}개 종목")
    for stock in strategy.watchlist:
        print(f"   - {stock['name']} ({stock['symbol']})")

    print("\n📍 한 사이클 실행 중...")
    await strategy._run_cycle()
    print("✅ 사이클 완료")

    return True


async def main():
    """모든 테스트 실행"""
    print("\n" + "=" * 60)
    print("🚀 PyQQQ Phase 2 테스트: Toss API 완전 연동")
    print("=" * 60)

    results = {}

    try:
        # 1️⃣  Claude 분석 테스트
        print("\n[1/5] Claude 분석 테스트...")
        results['claude'] = await test_claude_analyzer()

        # 2️⃣  Toss API 테스트
        print("\n[2/5] Toss API 테스트...")
        results['toss'] = await test_toss_client()

        # 3️⃣  포지션 관리자 테스트
        print("\n[3/5] 포지션 관리자 테스트...")
        results['position'] = await test_position_manager()

        # 4️⃣  전체 사이클 테스트
        print("\n[4/5] 전체 거래 사이클 테스트...")
        results['cycle'] = await test_full_cycle()

    except Exception as e:
        print(f"❌ 테스트 오류: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # 결과 요약
        print("\n" + "=" * 60)
        print("📊 테스트 결과 요약")
        print("=" * 60)
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name:15} {status}")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
