from __future__ import annotations

import os
from dataclasses import dataclass, field

from .models import ExecutionMode


def _required_execution_mode() -> ExecutionMode:
    raw_mode = os.getenv("TOSS_ONLY_EXECUTION_MODE", "LIVE")
    try:
        return ExecutionMode(raw_mode)
    except ValueError as exc:
        allowed = ", ".join(mode.value for mode in ExecutionMode)
        raise ValueError(f"TOSS_ONLY_EXECUTION_MODE must be one of: {allowed}") from exc


@dataclass(frozen=True)
class TossOnlyConfig:
    execution_mode: ExecutionMode = field(default_factory=_required_execution_mode)
    allow_live_orders: bool = os.getenv("TOSS_ONLY_ALLOW_LIVE_ORDERS", "false").lower() == "true"
    max_candidates: int = int(os.getenv("TOSS_ONLY_MAX_CANDIDATES", "8"))
    min_candidate_score: float = float(os.getenv("TOSS_ONLY_MIN_CANDIDATE_SCORE", "0.45"))
    min_setup_confidence: float = float(os.getenv("TOSS_ONLY_MIN_SETUP_CONFIDENCE", "0.40"))  # 0.40으로 설정
    risk_per_trade_pct: float = float(os.getenv("TOSS_ONLY_RISK_PER_TRADE_PCT", "0.10"))
    max_position_pct: float = float(os.getenv("TOSS_ONLY_MAX_POSITION_PCT", "0.50"))
    min_usd_cash_after_order: float = float(os.getenv("TOSS_ONLY_MIN_USD_CASH_AFTER_ORDER", "1.0"))
    min_krw_cash_after_order: float = float(os.getenv("TOSS_ONLY_MIN_KRW_CASH_AFTER_ORDER", "1000"))
    min_order_notional_usd: float = float(os.getenv("TOSS_ONLY_MIN_ORDER_NOTIONAL_USD", "5.0"))
    min_order_notional_krw: float = float(os.getenv("TOSS_ONLY_MIN_ORDER_NOTIONAL_KRW", "5000"))
    fractional_trading_enabled: bool = (
        os.getenv("TOSS_ONLY_FRACTIONAL_TRADING_ENABLED", "true").lower() == "true"
    )

    # 🔧 P1 수정 #2: 토큰 설정 및 갱신
    toss_api_token: str = os.getenv("TOSS_API_TOKEN", "")
    toss_api_secret: str = os.getenv("TOSS_API_SECRET", "")
    token_refresh_interval_seconds: int = int(os.getenv("TOSS_TOKEN_REFRESH_INTERVAL", "3600"))  # 기본 1시간

    # 🔧 P1 수정 #3: 로그 설정
    log_dir: str = os.getenv("TOSS_LOG_DIR", "/Users/mac/Desktop/trading_logs/")
    log_rotation_mb: int = int(os.getenv("TOSS_LOG_ROTATION_MB", "100"))  # 100MB 단위 압축
    log_backup_count: int = int(os.getenv("TOSS_LOG_BACKUP_COUNT", "5"))  # 최대 5개 파일 보관

    # 🔴 DEPRECATED: 더 이상 여기서 하드코딩하지 않습니다
    # 대신 UniverseScanner에서 동적으로 종목을 관리합니다
    # themes: dict[str, list[tuple[str, str, str, str]]] = field(
    #     default_factory=lambda: {...}
    # )

    # theme 이름 리스트만 유지 (검증용)
    theme_names: list[str] = field(
        default_factory=lambda: [
            "US_AI",
            "US_SEMICONDUCTOR",
            "US_MEGACAP_TECH",
            "US_EV",
            "US_ENERGY_POWER",
            "KR_SEMICONDUCTOR",
            "KR_BATTERY_EV",
            "KR_PLATFORM",
            "KR_SMALL_CAP_MOMENTUM",
        ]
    )
