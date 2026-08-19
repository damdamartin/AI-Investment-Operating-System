#!/bin/bash

# Toss 자동매매만 시작 (KIS 제외)

PROJECT_DIR="/Users/mac/Documents/Codex/AI-Investment-Operating-System"
LOG_DIR="/Users/mac/Desktop/trading_logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$LOG_DIR"

echo "🚀 Toss 자동매매 엔진만 시작..."
echo "📁 프로젝트: $PROJECT_DIR"

export PYTHONPATH="$PROJECT_DIR/src:$PYTHONPATH"

# Toss 자동매매 시작
nohup python3 -c "
import asyncio
import sys
sys.path.insert(0, '$PROJECT_DIR/src')
from pyqqq.toss_auto_trading import run_toss_auto_trading
asyncio.run(run_toss_auto_trading(interval_seconds=60))
" > "$LOG_DIR/toss_trading_${TIMESTAMP}.log" 2>&1 &

TOSS_PID=$!
echo "✅ Toss PID: $TOSS_PID"
echo "$TOSS_PID" > "$LOG_DIR/toss.pid"

echo ""
echo "================================"
echo "📊 Toss 자동매매 시작 완료"
echo "================================"
echo "🔵 Toss: $TOSS_PID"
echo ""
echo "📋 로그 파일:"
echo "   $LOG_DIR/toss_trading_${TIMESTAMP}.log"
echo ""
echo "📌 실시간 로그:"
echo "   tail -f $LOG_DIR/toss_trading_${TIMESTAMP}.log"
echo ""
echo "🛑 중지:"
echo "   kill $TOSS_PID"
echo "================================"
