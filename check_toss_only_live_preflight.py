"""Check whether the Toss-only system is allowed to submit live orders.

This script is read-only. It never places orders.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import asdict

from src.pyqqq.toss_only.config import TossOnlyConfig
from src.pyqqq.toss_only.live_preflight import TossOnlyLivePreflight


async def main() -> None:
    config = TossOnlyConfig()
    result = await TossOnlyLivePreflight().check(
        execution_mode=config.execution_mode,
        allow_live_orders=config.allow_live_orders,
    )
    print(json.dumps(asdict(result), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
