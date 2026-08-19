"""
AIOS Heartbeat Module - Service Health Monitoring
각 자동매매 루프가 주기적으로 heartbeat 파일을 갱신하여 서비스 상태를 기록합니다.
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any


class Heartbeat:
    """각 서비스의 heartbeat를 관리합니다."""

    def __init__(self, service_name: str):
        """
        Args:
            service_name: "crypto", "kis", "toss"
        """
        self.service_name = service_name
        # Mac 로컬 개발용: /tmp 사용, 프로덕션: /var/lib/aios
        heartbeat_base = Path("/var/lib/aios")
        if not heartbeat_base.exists():
            heartbeat_base = Path("/tmp/aios")
        self.heartbeat_dir = heartbeat_base
        self.heartbeat_file = self.heartbeat_dir / f"{service_name}_heartbeat.json"
        self.heartbeat_dir.mkdir(parents=True, exist_ok=True)
        self.loop_count = 0

    def update(
        self,
        status: str = "running",
        trading_enabled: bool = True,
        last_account_check_at: Optional[datetime] = None,
        last_market_data_at: Optional[datetime] = None,
        last_analysis_at: Optional[datetime] = None,
        last_order_attempt_at: Optional[datetime] = None,
        last_successful_order_at: Optional[datetime] = None,
        last_error: Optional[str] = None,
        account_balance: Optional[float] = None,
        positions_count: int = 0,
        **extra_data
    ):
        """
        Heartbeat 파일을 갱신합니다.

        Args:
            status: "running", "idle", "error", "waiting"
            trading_enabled: 거래 활성화 여부
            last_*_at: 마지막 이벤트 시간
            last_error: 마지막 에러 메시지
            account_balance: 계좌 잔고
            positions_count: 보유 포지션 수
            **extra_data: 추가 데이터
        """
        import os

        self.loop_count += 1

        data = {
            "service": self.service_name,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "timestamp_unix": datetime.utcnow().timestamp(),
            "pid": os.getpid(),
            "loop_count": self.loop_count,
            "status": status,
            "trading_enabled": trading_enabled,
            "last_account_check_at": last_account_check_at.isoformat() + "Z" if last_account_check_at else None,
            "last_market_data_at": last_market_data_at.isoformat() + "Z" if last_market_data_at else None,
            "last_analysis_at": last_analysis_at.isoformat() + "Z" if last_analysis_at else None,
            "last_order_attempt_at": last_order_attempt_at.isoformat() + "Z" if last_order_attempt_at else None,
            "last_successful_order_at": last_successful_order_at.isoformat() + "Z" if last_successful_order_at else None,
            "last_error": last_error,
            "account_balance": account_balance,
            "positions_count": positions_count,
            **extra_data
        }

        try:
            with open(self.heartbeat_file, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"[ERROR] Failed to write heartbeat: {e}")

    @classmethod
    def read(cls, service_name: str) -> Optional[Dict[str, Any]]:
        """Heartbeat 파일을 읽습니다."""
        heartbeat_file = Path("/var/lib/aios") / f"{service_name}_heartbeat.json"
        if not heartbeat_file.exists():
            return None

        try:
            with open(heartbeat_file) as f:
                return json.load(f)
        except Exception as e:
            print(f"[ERROR] Failed to read heartbeat: {e}")
            return None

    @classmethod
    def is_stale(cls, service_name: str, max_age_seconds: int = 120) -> bool:
        """Heartbeat가 오래되었는지 확인합니다."""
        data = cls.read(service_name)
        if not data:
            return True

        try:
            timestamp = datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))
            age = (datetime.utcnow() - timestamp.replace(tzinfo=None)).total_seconds()
            return age > max_age_seconds
        except Exception:
            return True
