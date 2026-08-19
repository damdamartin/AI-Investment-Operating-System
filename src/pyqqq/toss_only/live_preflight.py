from __future__ import annotations

import asyncio
import json
import os
import subprocess
from dataclasses import dataclass, field
from urllib.request import urlopen

from .models import ExecutionMode


OPERATION_STATUS_URL = "https://ai-investment-operating-system-worker.junkim-life360.workers.dev/operation-status"
HEALTH_URL = "https://ai-investment-operating-system-worker.junkim-life360.workers.dev/health"


@dataclass(frozen=True)
class LivePreflightResult:
    approved: bool
    blockers: list[str] = field(default_factory=list)
    status: dict | None = None
    health: dict | None = None


class TossOnlyLivePreflight:
    """Final safety gate before any Toss broker-write request."""

    async def check(self, execution_mode: ExecutionMode, allow_live_orders: bool) -> LivePreflightResult:
        blockers: list[str] = []

        if execution_mode != ExecutionMode.LIVE:
            blockers.append("execution mode is not LIVE")
        if not allow_live_orders:
            blockers.append("TOSS_ONLY_ALLOW_LIVE_ORDERS is not true")
        if os.getenv("LIVE_TRADING_ENABLED", "false").lower() != "true":
            blockers.append("LIVE_TRADING_ENABLED is not true")

        status = await asyncio.to_thread(_fetch_json, OPERATION_STATUS_URL)
        health = await asyncio.to_thread(_fetch_json, HEALTH_URL)

        if not status:
            blockers.append("operation-status endpoint unavailable")
        else:
            if status.get("mode") == "MONITORING_ONLY":
                blockers.append("operation worker mode is MONITORING_ONLY")
            if status.get("liveBrokerWriteAllowed") is not True:
                blockers.append("liveBrokerWriteAllowed is not true")
            if status.get("tossOrderSubmissionAllowed") is not True:
                blockers.append("tossOrderSubmissionAllowed is not true")

        if not health:
            blockers.append("health endpoint unavailable")
        elif health.get("status") != "OK":
            blockers.append("health status is not OK")

        return LivePreflightResult(
            approved=not blockers,
            blockers=blockers,
            status=status,
            health=health,
        )


def _fetch_json(url: str) -> dict | None:
    try:
        with urlopen(url, timeout=10) as response:
            return json.load(response)
    except Exception:
        try:
            completed = subprocess.run(
                ["curl", "-sS", "--max-time", "10", url],
                check=True,
                capture_output=True,
                text=True,
            )
            return json.loads(completed.stdout)
        except Exception:
            return None
