#!/bin/bash

# 🔧 P1 수정 #3: 미국 거래 24시간 연속 실행

PROJECT_DIR="/Users/mac/Documents/Codex/AI-Investment-Operating-System"
LOG_DIR="/Users/mac/Desktop/trading_logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 로그 디렉토리 생성
mkdir -p "$LOG_DIR"

echo "🚀 미국 거래 자동매매 시작 (24시간 모드)..."
echo "📁 프로젝트: $PROJECT_DIR"
echo "📋 로그: $LOG_DIR/us_trading_$TIMESTAMP.log"

export PYTHONPATH="$PROJECT_DIR/src:$PYTHONPATH"
export TOSS_ONLY_EXECUTION_MODE="LIVE"
export TOSS_ONLY_ALLOW_LIVE_ORDERS="true"
export TOSS_LOG_ROTATION_MB="100"
export TOSS_LOG_BACKUP_COUNT="5"

# 미국 거래 백그라운드 실행 (60초 주기)
nohup python3 << 'PYTHON_SCRIPT' > "$LOG_DIR/us_trading_$TIMESTAMP.log" 2>&1 &
import asyncio
import sys
import time
from datetime import datetime

sys.path.insert(0, '$PROJECT_DIR/src')

from pyqqq.toss_client import TossSecuritiesClient
from pyqqq.toss_only import TossOnlyTradingEngine
from pyqqq.toss_only.config import TossOnlyConfig
from pyqqq.toss_only.market_data import TossClientMarketDataProvider, CompositeTossMarketDataProvider
from pyqqq.toss_only.order_gateway import TossOnlyOrderGateway

async def run_us_trading():
    config = TossOnlyConfig()
    client = TossSecuritiesClient()
    provider = CompositeTossMarketDataProvider(TossClientMarketDataProvider(client))
    gateway = TossOnlyOrderGateway(config=config, toss_client=client)
    engine = TossOnlyTradingEngine(market_data=provider, config=config, order_gateway=gateway)

    iteration = 0
    while True:
        iteration += 1
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        try:
            # 사이클 실행 (주문 제출)
            result = await engine.run_cycle(submit_orders=True)

            print(f"[{now}] 🔄 사이클 #{iteration} 완료: 후보={len(result.candidates)}, 신호={len(result.setups)}, 주문={len(result.orders)}")

        except Exception as e:
            print(f"[{now}] ❌ 사이클 오류: {e}")

        # 60초 대기
        await asyncio.sleep(60)

asyncio.run(run_us_trading())
PYTHON_SCRIPT

US_PID=$!
echo "✅ 프로세스 ID: $US_PID"
echo "$US_PID" > "$LOG_DIR/us_trading.pid"

echo ""
echo "================================"
echo "📊 미국 거래 시작 완료"
echo "================================"
echo "🔵 프로세스: $US_PID"
echo ""
echo "📋 로그 파일:"
echo "   $LOG_DIR/us_trading_$TIMESTAMP.log"
echo ""
echo "📌 실시간 모니터링:"
echo "   tail -f $LOG_DIR/us_trading_$TIMESTAMP.log"
echo ""
echo "🛑 중지 명령:"
echo "   kill $US_PID"
echo "================================"
