"""Run one Toss-only KR/US stock trading cycle.

No execution mode default is provided. Set TOSS_ONLY_EXECUTION_MODE explicitly
to READ_ONLY or LIVE. Live orders require both:
  TOSS_ONLY_EXECUTION_MODE=LIVE
  TOSS_ONLY_ALLOW_LIVE_ORDERS=true
and the existing Toss client must not be in read-only mode.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import asdict, is_dataclass
from datetime import datetime

from src.pyqqq.toss_client import TossSecuritiesClient
from src.pyqqq.toss_only import TossOnlyTradingEngine
from src.pyqqq.toss_only.config import TossOnlyConfig
from src.pyqqq.toss_only.market_data import CompositeTossMarketDataProvider, TossClientMarketDataProvider
from src.pyqqq.toss_only.order_gateway import TossOnlyOrderGateway
from src.pyqqq.toss_only.log_manager import TossLogManager, setup_rotating_logger  # 🔧 P1 수정 #3


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def _json_default(value):
    if is_dataclass(value):
        return asdict(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


async def main() -> None:
    config = TossOnlyConfig()

    # 🔧 P1 수정 #3: 로그 매니저 초기화
    log_manager = TossLogManager(
        log_dir=config.log_dir,
        rotation_mb=config.log_rotation_mb,
        backup_count=config.log_backup_count
    )

    # 🔧 P1 수정 #3: 자동 회전 로거 설정
    setup_rotating_logger(
        name="toss_trading",
        log_dir=config.log_dir,
        rotation_mb=config.log_rotation_mb,
        backup_count=config.log_backup_count
    )

    toss_client = TossSecuritiesClient()
    provider = CompositeTossMarketDataProvider(TossClientMarketDataProvider(toss_client))
    gateway = TossOnlyOrderGateway(config=config, toss_client=toss_client)
    engine = TossOnlyTradingEngine(market_data=provider, config=config, order_gateway=gateway)

    try:
        # 🔧 P1 수정 #3: 거래 전 로그 유지보수 수행
        maintenance = await log_manager.run_maintenance()
        logging.info(f"📊 로그 유지보수: {maintenance}")

        result = await engine.run_cycle()
        print(json.dumps(result, default=_json_default, ensure_ascii=False, indent=2))
    finally:
        if hasattr(provider, "close"):
            await provider.close()
        await toss_client.close()

        # 🔧 P1 수정 #3: 거래 후 로그 유지보수 수행
        await log_manager.run_maintenance()


if __name__ == "__main__":
    asyncio.run(main())
