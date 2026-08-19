#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

: "${TOSS_ONLY_EXECUTION_MODE:?Set TOSS_ONLY_EXECUTION_MODE explicitly to READ_ONLY or LIVE}"
: "${TOSS_READ_ONLY_MODE:?Set TOSS_READ_ONLY_MODE explicitly to true or false}"

export TOSS_ONLY_ALLOW_LIVE_ORDERS="${TOSS_ONLY_ALLOW_LIVE_ORDERS:-false}"
export LIVE_TRADING_ENABLED="${LIVE_TRADING_ENABLED:-false}"

python3 run_toss_only_daemon.py
