import logging
import httpx
import json
import os
from typing import Dict, Any, Optional
from datetime import datetime


logger = logging.getLogger(__name__)

# 로컬 파일 저장 경로
TRADES_FILE = "/tmp/crypto_trades.json"
POSITIONS_FILE = "/tmp/crypto_positions.json"


class DashboardClient:
    """대시보드 API 클라이언트 (실시간 거래 데이터 전송)"""

    def __init__(self, dashboard_url: str = "https://ai-investment-trading-cycle-production.junkim-life360.workers.dev"):
        self.dashboard_url = dashboard_url
        self.client = httpx.Client(timeout=10.0)

    def send_trade_order(self, trade_data: Dict[str, Any]) -> bool:
        """거래 주문 데이터를 대시보드로 전송 + 로컬 파일 저장"""
        try:
            payload = {
                "timestamp": datetime.now().isoformat(),
                "market": trade_data.get("market"),
                "side": trade_data.get("side"),
                "volume": trade_data.get("volume"),
                "price": trade_data.get("price"),
                "amount": trade_data.get("amount"),
                "order_uuid": trade_data.get("order_uuid"),
                "status": trade_data.get("status", "submitted"),
                "confidence": trade_data.get("confidence")
            }

            # 1️⃣ 로컬 JSON 파일에 저장 (대시보드 서빙용)
            try:
                trades = []
                if os.path.exists(TRADES_FILE):
                    with open(TRADES_FILE, 'r') as f:
                        trades = json.load(f)

                trades.insert(0, payload)  # 최신 항목을 맨 앞에
                trades = trades[:100]  # 최근 100개만 유지

                with open(TRADES_FILE, 'w') as f:
                    json.dump(trades, f, indent=2)

                logger.info(f"✅ 로컬 파일 저장: {len(trades)}개 거래 기록")
            except Exception as e:
                logger.warning(f"⚠️  로컬 파일 저장 실패: {e}")

            # 2️⃣ Worker API로 전송 (백업)
            try:
                response = self.client.post(
                    f"{self.dashboard_url}/api/crypto/orders",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )

                if response.status_code in (200, 201):
                    logger.info(f"✅ 대시보드에 거래 기록 전송 성공: {trade_data.get('market')}")
                else:
                    logger.warning(f"⚠️  대시보드 전송 실패 ({response.status_code})")
            except Exception as e:
                logger.warning(f"⚠️  대시보드 API 오류: {e}")

            return True

        except Exception as e:
            logger.error(f"❌ 거래 기록 저장 오류: {e}")
            return False

    def send_position_update(self, position_data: Dict[str, Any]) -> bool:
        """포지션 업데이트 데이터 전송"""
        try:
            payload = {
                "timestamp": datetime.now().isoformat(),
                "symbol": position_data.get("symbol"),
                "quantity": position_data.get("quantity"),
                "entry_price": position_data.get("entry_price"),
                "current_price": position_data.get("current_price"),
                "pnl": position_data.get("pnl"),
                "pnl_percent": position_data.get("pnl_percent"),
                "status": position_data.get("status")
            }

            response = self.client.post(
                f"{self.dashboard_url}/api/crypto/positions",
                json=payload,
                headers={"Content-Type": "application/json"}
            )

            if response.status_code in (200, 201):
                logger.info(f"✅ 포지션 업데이트 전송 성공: {position_data.get('symbol')}")
                return True
            else:
                logger.warning(f"⚠️  포지션 업데이트 전송 실패 ({response.status_code})")
                return False

        except Exception as e:
            logger.error(f"❌ 포지션 업데이트 전송 오류: {e}")
            return False

    def send_account_status(self, account_data: Dict[str, Any]) -> bool:
        """계좌 현황 데이터 전송 (잔고, 포지션, 포트폴리오)"""
        try:
            payload = {
                "timestamp": datetime.now().isoformat(),
                "krw_balance": account_data.get("krw_balance", 0),
                "krw_locked": account_data.get("krw_locked", 0),
                "total_assets": account_data.get("total_assets", 0),
                "total_gain": account_data.get("total_gain", 0),
                "total_return": account_data.get("total_return", 0),
                "positions": account_data.get("positions", []),
                "holdings": account_data.get("holdings", [])
            }

            response = self.client.post(
                f"{self.dashboard_url}/api/crypto/account",
                json=payload,
                headers={"Content-Type": "application/json"}
            )

            if response.status_code in (200, 201):
                logger.info(f"✅ 계좌 현황 전송 성공 (잔액: ₩{account_data.get('krw_balance', 0):,.0f})")
                return True
            else:
                logger.warning(f"⚠️  계좌 현황 전송 실패 ({response.status_code})")
                return False

        except Exception as e:
            logger.error(f"❌ 계좌 현황 전송 오류: {e}")
            return False

    def send_daily_report(self, report_data: Dict[str, Any]) -> bool:
        """📋 일일 종합 보고서 전송"""
        try:
            payload = {
                "timestamp": datetime.now().isoformat(),
                "date": report_data.get("date"),
                "market_status": report_data.get("market_status", {}),
                "portfolio": report_data.get("portfolio", {}),
                "strategy": report_data.get("strategy", []),
                "actions": report_data.get("actions", [])
            }

            # 로컬 파일에 저장
            report_file = "/tmp/daily_report.json"
            try:
                with open(report_file, 'w') as f:
                    json.dump(payload, f, indent=2, ensure_ascii=False)
                logger.info(f"✅ 일일 보고서 저장: {report_data.get('date')}")
            except Exception as e:
                logger.warning(f"⚠️  일일 보고서 파일 저장 실패: {e}")

            # Worker API로 전송
            try:
                response = self.client.post(
                    f"{self.dashboard_url}/api/crypto/daily-report",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )

                if response.status_code in (200, 201):
                    logger.info(f"✅ 일일 보고서 전송 성공: {report_data.get('date')}")
                    return True
                else:
                    logger.warning(f"⚠️  일일 보고서 전송 실패 ({response.status_code})")
                    return False
            except Exception as e:
                logger.warning(f"⚠️  일일 보고서 API 오류: {e}")
                return False

        except Exception as e:
            logger.error(f"❌ 일일 보고서 전송 오류: {e}")
            return False

    def close(self):
        """클라이언트 종료"""
        self.client.close()
