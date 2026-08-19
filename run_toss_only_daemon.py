"""Run the Toss-only KR/US stock engine continuously.

This is the new Toss-only entry point.  It does not import account inquiry,
broker clients, or execution paths for other brokers.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import asdict, is_dataclass
from datetime import datetime

from src.pyqqq.toss_client import TossSecuritiesClient
from src.pyqqq.toss_only.config import TossOnlyConfig
from src.pyqqq.toss_only.engine import TossOnlyTradingEngine
from src.pyqqq.toss_only.market_data import CompositeTossMarketDataProvider, TossClientMarketDataProvider
from src.pyqqq.toss_only.order_gateway import TossOnlyOrderGateway


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("toss_only_daemon")


def _json_default(value):
    if is_dataclass(value):
        return asdict(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


async def main() -> None:
    interval_seconds = int(os.getenv("TOSS_ONLY_INTERVAL_SECONDS", "60"))
    config = TossOnlyConfig()
    toss_client = TossSecuritiesClient()
    provider = CompositeTossMarketDataProvider(TossClientMarketDataProvider(toss_client))
    gateway = TossOnlyOrderGateway(config=config, toss_client=toss_client)
    engine = TossOnlyTradingEngine(market_data=provider, config=config, order_gateway=gateway)

    logger.info("Starting Toss-only daemon mode=%s interval=%ss", config.execution_mode.value, interval_seconds)
    try:
        while True:
            result = await engine.run_cycle()
            logger.info(
                "cycle_result candidates=%s setups=%s plans=%s orders=%s",
                len(result.candidates),
                len(result.setups),
                len(result.plans),
                len(result.orders),
            )
            print(json.dumps(result, default=_json_default, ensure_ascii=False))
            await asyncio.sleep(interval_seconds)
    finally:
        if hasattr(provider, "close"):
            await provider.close()
        await toss_client.close()


if __name__ == "__main__":
    asyncio.run(main())
