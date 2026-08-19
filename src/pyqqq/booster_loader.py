"""
부스터 설정 로더 및 동기화
- VM에서 부스터 설정을 실시간으로 로드/업데이트
- Mac에서 변경 시 즉시 반영
"""
import json
import logging
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

BOOSTER_CONFIG_LOCAL = Path("/tmp/booster_config_live.json")
BOOSTER_CONFIG_BACKUP = Path("/home/ubuntu/AI-Investment-Operating-System/config/booster_config.json")


class BoosterConfigLoader:
    """부스터 설정 동적 로더"""

    def __init__(self):
        self.config: Dict = {}
        self.last_loaded = None
        self.last_modified = None

    def load_config(self) -> Dict:
        """부스터 설정 로드 (우선순위)"""
        try:
            # 1. 실시간 설정 파일 확인 (Mac에서 전송한 최신 설정)
            if BOOSTER_CONFIG_LOCAL.exists():
                config = self._load_from_file(BOOSTER_CONFIG_LOCAL)
                logger.info("✅ 실시간 부스터 설정 로드됨")
            # 2. 백업 설정 파일 (배포 시 기본 설정)
            elif BOOSTER_CONFIG_BACKUP.exists():
                config = self._load_from_file(BOOSTER_CONFIG_BACKUP)
                logger.info("✅ 백업 부스터 설정 로드됨")
            else:
                # 3. 기본 설정 (전혀 없으면)
                config = self._get_default_config()
                logger.warning("⚠️  기본 부스터 설정 사용")

            self.config = config
            self.last_loaded = datetime.now().isoformat()
            return config

        except Exception as e:
            logger.error(f"❌ 부스터 설정 로드 실패: {e}")
            return self._get_default_config()

    def _load_from_file(self, file_path: Path) -> Dict:
        """파일에서 설정 로드"""
        content = json.loads(file_path.read_text())

        # 설정 검증
        required_keys = ["mode", "enabled"]
        for key in required_keys:
            if key not in content:
                raise ValueError(f"필수 키 누락: {key}")

        return content

    def get_booster_enabled(self) -> bool:
        """부스터 활성화 여부"""
        return self.config.get("enabled", False)

    def get_signal_config(self) -> Dict:
        """신호 설정"""
        return self.config.get("signal", {
            "min_confidence": 0.60,
            "volatility_threshold": 5.0,
            "use_claude_ai": True
        })

    def get_trading_config(self) -> Dict:
        """거래 설정"""
        return self.config.get("trading", {
            "target_coins": ["KRW-BTC", "KRW-ETH"],
            "buy_mode": "MARKET",
            "sell_mode": "MARKET"
        })

    def get_position_config(self) -> Dict:
        """포지션 설정"""
        return self.config.get("position", {
            "max_hold_seconds": 300,
            "target_profit": 3.5,
            "stop_loss": -2.5
        })

    def get_risk_config(self) -> Dict:
        """리스크 설정"""
        return self.config.get("risk", {
            "daily_loss_limit": -10.0,
            "consecutive_losses_limit": 3,
            "max_drawdown": -5.0
        })

    def is_within_operating_hours(self) -> bool:
        """운영 시간 확인"""
        booster_period = self.config.get("booster_period", {})
        operating_hours = booster_period.get("operating_hours", "09:00-23:00")

        if operating_hours == "24/7":
            return True

        try:
            start_time, end_time = operating_hours.split("-")
            start_hour = int(start_time.split(":")[0])
            end_hour = int(end_time.split(":")[0])

            current_hour = datetime.now().hour

            if start_hour <= end_hour:
                return start_hour <= current_hour < end_hour
            else:  # 자정을 넘는 경우
                return current_hour >= start_hour or current_hour < end_hour

        except Exception as e:
            logger.warning(f"⚠️  운영 시간 파싱 오류: {e}")
            return True

    def check_config_updated(self) -> bool:
        """설정 파일이 변경되었는지 확인"""
        if BOOSTER_CONFIG_LOCAL.exists():
            modified_time = BOOSTER_CONFIG_LOCAL.stat().st_mtime
            if self.last_modified is None or modified_time > self.last_modified:
                self.last_modified = modified_time
                return True
        return False

    def reload_if_changed(self) -> bool:
        """변경 시 자동 재로드"""
        if self.check_config_updated():
            logger.info("🔄 부스터 설정 변경 감지 → 재로드")
            self.load_config()
            return True
        return False

    def _get_default_config(self) -> Dict:
        """기본 부스터 설정"""
        return {
            "mode": "BOOSTER",
            "enabled": True,
            "signal": {
                "min_confidence": 0.60,
                "volatility_threshold": 5.0,
                "use_claude_ai": True
            },
            "trading": {
                "target_coins": ["KRW-BTC", "KRW-ETH", "KRW-SOL"],
                "buy_mode": "MARKET",
                "sell_mode": "MARKET"
            },
            "position": {
                "max_hold_seconds": 300,
                "target_profit": 3.5,
                "stop_loss": -2.5
            },
            "risk": {
                "daily_loss_limit": -10.0,
                "consecutive_losses_limit": 3,
                "max_drawdown": -5.0
            },
            "booster_period": {
                "operating_hours": "09:00-23:00",
                "timezone": "KST"
            }
        }

    def print_config(self):
        """설정 출력 (디버깅)"""
        logger.info("=" * 50)
        logger.info("📋 현재 부스터 설정")
        logger.info("=" * 50)
        logger.info(f"부스터 활성화: {self.get_booster_enabled()}")
        logger.info(f"신호 설정: {json.dumps(self.get_signal_config(), indent=2)}")
        logger.info(f"거래 설정: {json.dumps(self.get_trading_config(), indent=2)}")
        logger.info(f"포지션 설정: {json.dumps(self.get_position_config(), indent=2)}")
        logger.info(f"리스크 설정: {json.dumps(self.get_risk_config(), indent=2)}")
        logger.info(f"운영 시간 확인: {self.is_within_operating_hours()}")
        logger.info("=" * 50)
