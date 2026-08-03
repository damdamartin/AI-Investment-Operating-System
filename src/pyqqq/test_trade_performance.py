"""
팀원3 (실행·평가팀) - 거래 성과평가 테스트

테스트 항목:
1. _evaluate_trade_performance() - 수수료·슬리피지 계산
2. TradeRecordManager - 거래 기록 저장/조회
3. 일일 통계 계산 - 승률, 손익 통계
"""

import unittest
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# 상대 import 설정
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from strategy_upbit import UpbitTradingStrategy
from trade_record_manager import TradeRecordManager
from position_manager import Position, PositionStatus


class TestTradePerformanceEvaluation(unittest.TestCase):
    """거래 성과평가 테스트"""

    def setUp(self):
        """테스트 준비"""
        self.strategy = UpbitTradingStrategy()

    def test_evaluate_buy_order_basic(self):
        """기본 BUY 주문 성과평가"""
        order = {
            "uuid": "test-order-123",
            "market": "KRW-BTC",
            "side": "BUY",
            "price": 10000000.0,  # 진입가
            "volume": 0.1,
            "state": "done",
            "created_at": datetime.now().isoformat()
        }

        position = Position(
            symbol="KRW-BTC",
            quantity=0.1,
            entry_price=10000000.0,
            entry_time=datetime.now(),
            stop_loss_price=9800000.0,
            take_profit_price=10500000.0,
            status=PositionStatus.OPEN,
            current_price=10100000.0  # 현재가 (체결가)
        )

        result = self.strategy._evaluate_trade_performance(order, position)

        # 검증
        self.assertEqual(result["order_id"], "test-order-123")
        self.assertEqual(result["market"], "KRW-BTC")
        self.assertEqual(result["side"], "BUY")
        self.assertEqual(result["entry_price"], 10000000.0)
        self.assertEqual(result["actual_entry"], 10100000.0)
        self.assertGreater(result["slippage"], 0)  # 슬리피지 > 0
        self.assertGreater(result["fees"], 0)  # 수수료 > 0
        self.assertEqual(result["status"], "success")

        # 수익률 계산 검증 (체결가 > 진입가)
        self.assertGreater(result["profit_loss"], 0)

        print(f"✅ 기본 BUY 성과평가:")
        print(f"   진입가: ₩{result['entry_price']:,.0f}")
        print(f"   체결가: ₩{result['actual_entry']:,.0f}")
        print(f"   슬리피지: ₩{result['slippage']:,.0f} ({result['slippage_pct']:.2f}%)")
        print(f"   수수료: ₩{result['fees']:,.0f}")
        print(f"   손익: ₩{result['profit_loss']:,.0f} ({result['profit_loss_pct']:.2f}%)")

    def test_evaluate_sell_order_with_loss(self):
        """손실 발생 SELL 주문 성과평가"""
        order = {
            "uuid": "test-order-456",
            "market": "KRW-ETH",
            "side": "SELL",
            "price": 2000000.0,  # 매도가
            "volume": 1.0,
            "state": "done",
            "created_at": (datetime.now() - timedelta(minutes=5)).isoformat()
        }

        position = Position(
            symbol="KRW-ETH",
            quantity=1.0,
            entry_price=2100000.0,  # 진입가 (매도가보다 높음 = 손실)
            entry_time=datetime.now() - timedelta(minutes=5),
            stop_loss_price=1950000.0,
            take_profit_price=2250000.0,
            status=PositionStatus.CLOSED,
            exit_price=1950000.0  # 체결가
        )

        result = self.strategy._evaluate_trade_performance(order, position)

        # 검증
        self.assertEqual(result["market"], "KRW-ETH")
        self.assertEqual(result["side"], "SELL")
        self.assertLess(result["profit_loss"], 0)  # 손실 < 0
        self.assertLess(result["profit_loss_pct"], 0)  # 손실률 < 0
        self.assertGreater(result["holding_time"], 0)  # 보유시간 > 0

        print(f"✅ 손실 SELL 성과평가:")
        print(f"   진입가: ₩{result['entry_price']:,.0f}")
        print(f"   체결가: ₩{result['exit_price']:,.0f}")
        print(f"   손익: ₩{result['profit_loss']:,.0f} ({result['profit_loss_pct']:.2f}%)")
        print(f"   보유시간: {result['holding_time']}초")

    def test_evaluate_order_without_position(self):
        """Position 없이 주문 성과평가"""
        order = {
            "uuid": "test-order-789",
            "market": "KRW-XRP",
            "side": "BUY",
            "price": 500.0,
            "volume": 100.0,
            "state": "done",
            "created_at": datetime.now().isoformat()
        }

        result = self.strategy._evaluate_trade_performance(order)

        # 검증
        self.assertEqual(result["order_id"], "test-order-789")
        self.assertEqual(result["market"], "KRW-XRP")
        self.assertIn("status", result)

        print(f"✅ Position 없는 성과평가: {result['status']}")


class TestTradeRecordManager(unittest.TestCase):
    """거래 기록 관리 테스트"""

    def setUp(self):
        """테스트 준비"""
        self.test_dir = "/tmp/test_crypto_records"
        Path(self.test_dir).mkdir(parents=True, exist_ok=True)
        self.manager = TradeRecordManager(records_dir=self.test_dir)

    def tearDown(self):
        """테스트 정리"""
        import shutil
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    def test_save_single_trade_record(self):
        """단일 거래 기록 저장"""
        performance = {
            "order_id": "order-001",
            "market": "KRW-BTC",
            "side": "BUY",
            "entry_price": 10000000.0,
            "actual_entry": 10100000.0,
            "exit_price": 10200000.0,
            "quantity": 0.1,
            "slippage": 100000.0,
            "slippage_pct": 1.0,
            "fees": 10000.0,
            "fees_pct": 0.1,
            "profit_loss": 9000.0,  # 10200000 - 10100000 - 100000 - 10000
            "profit_loss_pct": 0.09,
            "holding_time": 300,
            "status": "success",
            "timestamp": datetime.now().isoformat()
        }

        result = self.manager.save_trade_record(performance)
        self.assertTrue(result)

        # 저장 확인
        trades = self.manager.get_daily_trades()
        self.assertEqual(len(trades), 1)
        self.assertEqual(trades[0]["order_id"], "order-001")

        print(f"✅ 거래 기록 저장: {performance['market']} {performance['side']}")

    def test_save_multiple_records(self):
        """여러 거래 기록 저장"""
        for i in range(5):
            performance = {
                "order_id": f"order-{i:03d}",
                "market": "KRW-BTC" if i % 2 == 0 else "KRW-ETH",
                "side": "BUY" if i % 2 == 0 else "SELL",
                "entry_price": 10000000.0 if i % 2 == 0 else 2000000.0,
                "actual_entry": 10000000.0,
                "exit_price": 10100000.0 if i % 2 == 0 else 1950000.0,
                "quantity": 0.1 if i % 2 == 0 else 1.0,
                "slippage": 0.0,
                "slippage_pct": 0.0,
                "fees": 10000.0 if i % 2 == 0 else 2000.0,
                "fees_pct": 0.1,
                "profit_loss": 10000.0 if i % 2 == 0 else -50000.0,
                "profit_loss_pct": 0.1 if i % 2 == 0 else -2.5,
                "holding_time": 300 + i * 60,
                "status": "success",
                "timestamp": datetime.now().isoformat()
            }
            self.manager.save_trade_record(performance)

        trades = self.manager.get_daily_trades()
        self.assertEqual(len(trades), 5)

        print(f"✅ {len(trades)}개 거래 기록 저장 완료")

    def test_calculate_daily_statistics(self):
        """일일 통계 계산"""
        # 샘플 데이터 저장
        for i in range(10):
            profit = 50000 if i < 7 else -30000  # 7승 3패
            performance = {
                "order_id": f"order-{i:03d}",
                "market": "KRW-BTC",
                "side": "BUY",
                "entry_price": 10000000.0,
                "actual_entry": 10000000.0,
                "exit_price": 10000000.0,
                "quantity": 0.1,
                "slippage": 0.0,
                "slippage_pct": 0.0,
                "fees": 10000.0,
                "fees_pct": 0.1,
                "profit_loss": profit,
                "profit_loss_pct": profit / 1000000.0,
                "holding_time": 300,
                "status": "success",
                "timestamp": datetime.now().isoformat()
            }
            self.manager.save_trade_record(performance)

        # 통계 계산
        stats = self.manager.calculate_daily_statistics()

        # 검증
        self.assertEqual(stats["total_trades"], 10)
        self.assertEqual(stats["winning_trades"], 7)
        self.assertEqual(stats["losing_trades"], 3)
        self.assertAlmostEqual(stats["win_rate"], 70.0, places=1)

        print(f"✅ 일일 통계 계산:")
        print(f"   총 거래수: {stats['total_trades']}")
        print(f"   승리/패배: {stats['winning_trades']} / {stats['losing_trades']}")
        print(f"   승률: {stats['win_rate']:.1f}%")
        print(f"   총 손익: ₩{stats['total_profit_loss']:,.0f}")
        print(f"   평균 수익: ₩{stats['average_pnl']:,.0f}")

    def test_export_to_csv(self):
        """CSV 내보내기"""
        # 샘플 데이터 저장
        for i in range(3):
            performance = {
                "order_id": f"order-{i:03d}",
                "market": "KRW-BTC",
                "side": "BUY" if i % 2 == 0 else "SELL",
                "entry_price": 10000000.0,
                "actual_entry": 10000000.0,
                "exit_price": 10100000.0,
                "quantity": 0.1,
                "slippage": 0.0,
                "slippage_pct": 0.0,
                "fees": 10000.0,
                "fees_pct": 0.1,
                "profit_loss": 10000.0,
                "profit_loss_pct": 0.1,
                "holding_time": 300,
                "status": "success",
                "timestamp": datetime.now().isoformat()
            }
            self.manager.save_trade_record(performance)

        # CSV 내보내기
        output_file = os.path.join(self.test_dir, "trades_export.csv")
        result = self.manager.export_trades_csv(output_file=output_file)
        self.assertTrue(result)
        self.assertTrue(os.path.exists(output_file))

        # 파일 내용 검증
        with open(output_file, 'r') as f:
            lines = f.readlines()
            self.assertGreater(len(lines), 1)  # 헤더 + 데이터

        print(f"✅ CSV 내보내기: {output_file}")


class TestIntegrationTradeFlow(unittest.TestCase):
    """E2E 거래 흐름 테스트"""

    def setUp(self):
        """테스트 준비"""
        self.test_dir = "/tmp/test_crypto_integration"
        Path(self.test_dir).mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        """테스트 정리"""
        import shutil
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    def test_complete_trade_lifecycle(self):
        """완전한 거래 생명주기 테스트"""
        strategy = UpbitTradingStrategy()
        strategy.trade_record_manager = TradeRecordManager(records_dir=self.test_dir)

        # 1. 주문 생성
        order = {
            "uuid": "full-test-order",
            "market": "KRW-BTC",
            "side": "BUY",
            "price": 10000000.0,
            "volume": 0.1,
            "state": "done",
            "created_at": datetime.now().isoformat()
        }

        position = Position(
            symbol="KRW-BTC",
            quantity=0.1,
            entry_price=10000000.0,
            entry_time=datetime.now(),
            stop_loss_price=9800000.0,
            take_profit_price=10500000.0,
            status=PositionStatus.OPEN,
            current_price=10100000.0
        )

        # 2. 성과평가
        performance = strategy._evaluate_trade_performance(order, position)

        # 3. 기록 저장
        strategy.trade_record_manager.save_trade_record(performance)

        # 4. 통계 확인
        stats = strategy.trade_record_manager.calculate_daily_statistics()

        # 검증
        self.assertEqual(stats["total_trades"], 1)
        self.assertEqual(stats["winning_trades"], 1)

        print(f"✅ 완전한 거래 생명주기:")
        print(f"   주문 생성 → 성과평가 → 기록저장 → 통계계산")
        print(f"   손익: ₩{performance['profit_loss']:,.0f}")
        print(f"   통계: {stats['total_trades']}회, 승률 {stats['win_rate']:.1f}%")


def run_tests():
    """테스트 실행"""
    print("=" * 70)
    print("팀원3 (실행·평가팀) - 거래 성과평가 테스트")
    print("=" * 70)

    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # 테스트 케이스 추가
    suite.addTests(loader.loadTestsFromTestCase(TestTradePerformanceEvaluation))
    suite.addTests(loader.loadTestsFromTestCase(TestTradeRecordManager))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegrationTradeFlow))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # 결과 요약
    print("\n" + "=" * 70)
    print(f"테스트 결과: {result.testsRun}개 실행")
    print(f"  ✅ 성공: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"  ❌ 실패: {len(result.failures)}")
    print(f"  ⚠️  에러: {len(result.errors)}")
    print("=" * 70)

    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
