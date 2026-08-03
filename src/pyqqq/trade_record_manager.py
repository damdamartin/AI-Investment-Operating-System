import logging
import json
import os
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from pathlib import Path


logger = logging.getLogger(__name__)


class TradeRecordManager:
    """거래 기록 관리 및 성과 통계 계산"""

    def __init__(self, records_dir: str = "/tmp/crypto_trade_records"):
        """
        Args:
            records_dir: 거래 기록 저장 디렉토리
        """
        self.records_dir = records_dir
        Path(records_dir).mkdir(parents=True, exist_ok=True)
        logger.info(f"✅ TradeRecordManager 초기화: {records_dir}")

    def get_record_file(self, date: datetime = None) -> str:
        """날짜별 기록 파일 경로 반환"""
        if date is None:
            date = datetime.now()

        date_str = date.strftime("%Y-%m-%d")
        return os.path.join(self.records_dir, f"trades_{date_str}.json")

    def save_trade_record(self, performance: Dict[str, Any]) -> bool:
        """
        거래 성과 기록 저장

        Args:
            performance: _evaluate_trade_performance() 반환값

        Returns:
            저장 성공 여부
        """
        try:
            record_file = self.get_record_file()

            # 기존 기록 로드
            records = []
            if os.path.exists(record_file):
                try:
                    with open(record_file, 'r', encoding='utf-8') as f:
                        records = json.load(f)
                except json.JSONDecodeError:
                    logger.warning(f"⚠️  기존 파일 파싱 실패: {record_file}")
                    records = []

            # 새 기록 추가 (중복 제거)
            order_id = performance.get("order_id")
            existing = [r for r in records if r.get("order_id") != order_id]

            new_record = {
                **performance,
                "recorded_at": datetime.now().isoformat()
            }
            existing.append(new_record)

            # 파일 저장
            with open(record_file, 'w', encoding='utf-8') as f:
                json.dump(existing, f, indent=2, ensure_ascii=False)

            logger.info(
                f"💾 거래 기록 저장: {performance.get('market')} "
                f"{performance.get('side')} | "
                f"손익: ₩{performance.get('profit_loss', 0):,.0f}"
            )
            return True

        except Exception as e:
            logger.error(f"❌ 거래 기록 저장 실패: {e}")
            return False

    def get_daily_trades(self, date: datetime = None) -> List[Dict[str, Any]]:
        """
        일일 거래 조회

        Args:
            date: 조회 날짜 (기본값: 오늘)

        Returns:
            거래 기록 목록
        """
        try:
            record_file = self.get_record_file(date)

            if not os.path.exists(record_file):
                logger.info(f"⚠️  거래 기록 없음: {record_file}")
                return []

            with open(record_file, 'r', encoding='utf-8') as f:
                records = json.load(f)

            logger.info(f"✅ {len(records)}개 거래 기록 로드")
            return records

        except Exception as e:
            logger.error(f"❌ 거래 기록 로드 실패: {e}")
            return []

    def calculate_daily_statistics(self, date: datetime = None) -> Dict[str, Any]:
        """
        일일 거래 통계 계산

        Args:
            date: 통계 날짜 (기본값: 오늘)

        Returns:
            {
                "date": "2026-08-02",
                "total_trades": 15,
                "winning_trades": 10,
                "losing_trades": 5,
                "win_rate": 66.67,
                "total_profit_loss": 5000.00,
                "total_profit_loss_pct": 2.50,
                "average_pnl": 333.33,
                "average_pnl_pct": 0.17,
                "max_gain": 1500.00,
                "max_loss": -750.00,
                "max_gain_pct": 5.00,
                "max_loss_pct": -3.00,
                "buy_trades": 10,
                "sell_trades": 5,
                "average_holding_time": 180,  # 초
                "total_fees": 500.00,
                "total_slippage": 150.00,
                "by_market": {...}  # 종목별 통계
            }
        """
        try:
            trades = self.get_daily_trades(date)

            if not trades:
                logger.warning(f"⚠️  통계 계산: 거래 기록 없음")
                return {
                    "date": (date or datetime.now()).strftime("%Y-%m-%d"),
                    "total_trades": 0,
                    "winning_trades": 0,
                    "losing_trades": 0,
                    "win_rate": 0.0,
                    "total_profit_loss": 0.0,
                    "total_profit_loss_pct": 0.0
                }

            # 기본 통계
            total_trades = len(trades)
            winning_trades = len([t for t in trades if t.get("profit_loss", 0) > 0])
            losing_trades = len([t for t in trades if t.get("profit_loss", 0) < 0])
            win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0.0

            # 손익 통계
            total_pnl = sum(t.get("profit_loss", 0) for t in trades)
            total_pnl_pct = sum(t.get("profit_loss_pct", 0) for t in trades)
            average_pnl = total_pnl / total_trades if total_trades > 0 else 0.0
            average_pnl_pct = total_pnl_pct / total_trades if total_trades > 0 else 0.0

            max_gain = max((t.get("profit_loss", 0) for t in trades), default=0.0)
            max_loss = min((t.get("profit_loss", 0) for t in trades), default=0.0)

            max_gain_pct = max((t.get("profit_loss_pct", 0) for t in trades), default=0.0)
            max_loss_pct = min((t.get("profit_loss_pct", 0) for t in trades), default=0.0)

            # 거래 방향별 통계
            buy_trades = len([t for t in trades if t.get("side") == "BUY"])
            sell_trades = len([t for t in trades if t.get("side") == "SELL"])

            # 평균 보유시간
            holding_times = [t.get("holding_time", 0) for t in trades]
            average_holding_time = sum(holding_times) // len(holding_times) if holding_times else 0

            # 수수료 및 슬리피지
            total_fees = sum(t.get("fees", 0) for t in trades)
            total_slippage = sum(t.get("slippage", 0) for t in trades)

            # 종목별 통계
            by_market = {}
            for trade in trades:
                market = trade.get("market", "unknown")
                if market not in by_market:
                    by_market[market] = {
                        "trades": 0,
                        "wins": 0,
                        "losses": 0,
                        "pnl": 0.0,
                        "pnl_pct": 0.0
                    }

                by_market[market]["trades"] += 1
                pnl = trade.get("profit_loss", 0)
                if pnl > 0:
                    by_market[market]["wins"] += 1
                elif pnl < 0:
                    by_market[market]["losses"] += 1

                by_market[market]["pnl"] += pnl
                by_market[market]["pnl_pct"] += trade.get("profit_loss_pct", 0)

            # 종목별 평균 계산
            for market in by_market:
                count = by_market[market]["trades"]
                by_market[market]["pnl_pct"] = by_market[market]["pnl_pct"] / count if count > 0 else 0.0
                by_market[market]["win_rate"] = (
                    by_market[market]["wins"] / count * 100 if count > 0 else 0.0
                )

            statistics = {
                "date": (date or datetime.now()).strftime("%Y-%m-%d"),
                "total_trades": total_trades,
                "winning_trades": winning_trades,
                "losing_trades": losing_trades,
                "win_rate": round(win_rate, 2),
                "total_profit_loss": round(total_pnl, 2),
                "total_profit_loss_pct": round(total_pnl_pct, 4),
                "average_pnl": round(average_pnl, 2),
                "average_pnl_pct": round(average_pnl_pct, 4),
                "max_gain": round(max_gain, 2),
                "max_loss": round(max_loss, 2),
                "max_gain_pct": round(max_gain_pct, 4),
                "max_loss_pct": round(max_loss_pct, 4),
                "buy_trades": buy_trades,
                "sell_trades": sell_trades,
                "average_holding_time": average_holding_time,
                "total_fees": round(total_fees, 2),
                "total_slippage": round(total_slippage, 2),
                "by_market": by_market
            }

            logger.info(
                f"📊 일일 통계: 총{total_trades}회 | "
                f"승률: {win_rate:.1f}% | "
                f"손익: ₩{total_pnl:,.0f} ({total_pnl_pct:.2f}%)"
            )

            return statistics

        except Exception as e:
            logger.error(f"❌ 통계 계산 실패: {e}")
            import traceback
            traceback.print_exc()
            return {}

    def get_monthly_statistics(self, year: int = None, month: int = None) -> Dict[str, Any]:
        """
        월별 거래 통계 계산

        Args:
            year: 년도 (기본값: 현재 년도)
            month: 월 (기본값: 현재 월)

        Returns:
            월별 통계
        """
        try:
            now = datetime.now()
            if year is None:
                year = now.year
            if month is None:
                month = now.month

            # 해당 월의 모든 날짜에 대한 통계 수집
            all_trades = []
            current_date = datetime(year, month, 1)
            while current_date.month == month:
                daily_trades = self.get_daily_trades(current_date)
                all_trades.extend(daily_trades)
                current_date += timedelta(days=1)

            if not all_trades:
                return {
                    "year": year,
                    "month": month,
                    "total_trades": 0
                }

            # 월별 통계 계산 (일별 통계와 동일한 로직)
            total_trades = len(all_trades)
            winning_trades = len([t for t in all_trades if t.get("profit_loss", 0) > 0])
            losing_trades = len([t for t in all_trades if t.get("profit_loss", 0) < 0])
            win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0.0

            total_pnl = sum(t.get("profit_loss", 0) for t in all_trades)
            total_pnl_pct = sum(t.get("profit_loss_pct", 0) for t in all_trades)

            statistics = {
                "year": year,
                "month": month,
                "total_trades": total_trades,
                "winning_trades": winning_trades,
                "losing_trades": losing_trades,
                "win_rate": round(win_rate, 2),
                "total_profit_loss": round(total_pnl, 2),
                "total_profit_loss_pct": round(total_pnl_pct, 4),
                "daily_count": len([d for d in range(1, 32) if os.path.exists(self.get_record_file(datetime(year, month, min(d, 28))))])
            }

            logger.info(
                f"📊 {year}-{month:02d} 월별 통계: 총{total_trades}회 | "
                f"승률: {win_rate:.1f}% | 손익: ₩{total_pnl:,.0f}"
            )

            return statistics

        except Exception as e:
            logger.error(f"❌ 월별 통계 계산 실패: {e}")
            return {}

    def export_trades_csv(self, date: datetime = None, output_file: str = None) -> bool:
        """
        거래 기록을 CSV로 내보내기

        Args:
            date: 내보낼 날짜
            output_file: 출력 파일 경로

        Returns:
            내보내기 성공 여부
        """
        try:
            trades = self.get_daily_trades(date)

            if not trades:
                logger.warning("⚠️  내보낼 거래 기록 없음")
                return False

            if output_file is None:
                date_str = (date or datetime.now()).strftime("%Y-%m-%d")
                output_file = os.path.join(self.records_dir, f"trades_{date_str}.csv")

            # CSV 헤더
            headers = [
                "timestamp", "market", "side", "entry_price", "actual_entry",
                "exit_price", "quantity", "fees", "slippage", "profit_loss",
                "profit_loss_pct", "holding_time", "status", "order_id"
            ]

            # CSV 작성
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(",".join(headers) + "\n")

                for trade in trades:
                    row = [
                        str(trade.get("timestamp", "")),
                        str(trade.get("market", "")),
                        str(trade.get("side", "")),
                        str(trade.get("entry_price", "")),
                        str(trade.get("actual_entry", "")),
                        str(trade.get("exit_price", "")),
                        str(trade.get("quantity", "")),
                        str(trade.get("fees", "")),
                        str(trade.get("slippage", "")),
                        str(trade.get("profit_loss", "")),
                        str(trade.get("profit_loss_pct", "")),
                        str(trade.get("holding_time", "")),
                        str(trade.get("status", "")),
                        str(trade.get("order_id", ""))
                    ]
                    f.write(",".join(row) + "\n")

            logger.info(f"✅ CSV 내보내기: {output_file}")
            return True

        except Exception as e:
            logger.error(f"❌ CSV 내보내기 실패: {e}")
            return False
