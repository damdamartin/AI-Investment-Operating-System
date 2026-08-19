#!/bin/bash

# 🚀 4팀 통합 AI 자동매매 시스템 시작 스크립트
# 리서치팀 + 분석팀 + 매매팀 + 리스크팀 통합 실행
# 사용법: bash start_auto_trading.sh

PROJECT_DIR="/Users/mac/Documents/Codex/AI-Investment-Operating-System"
LOG_DIR="/Users/mac/Desktop/trading_logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PID_FILE="$LOG_DIR/aios_main.pid"
LOCK_FILE="/tmp/aios_main_trading_system.lock"

# 로그 디렉토리 생성
mkdir -p "$LOG_DIR"

echo "🚀 4팀 통합 AI 자동매매 시스템 시작..."
echo "📁 프로젝트: $PROJECT_DIR"
echo "📋 로그: $LOG_DIR"
echo ""

# 1️⃣ 이미 실행 중인 프로세스 확인
EXISTING_PIDS=$(pgrep -af 'main_trading_system|MainTradingSystem' | grep -v grep | awk '{print $1}')

if [ ! -z "$EXISTING_PIDS" ]; then
    echo "⚠️  경고: 이미 실행 중인 MainTradingSystem 프로세스가 있습니다!"
    echo "실행 중인 PID: $EXISTING_PIDS"
    echo ""

    # 활성 프로세스 확인
    for PID in $EXISTING_PIDS; do
        if ps -p $PID > /dev/null 2>&1; then
            echo "❌ PID $PID 프로세스가 실행 중입니다. 새 프로세스 시작을 중단합니다."
            echo ""
            echo "기존 프로세스를 중지하려면:"
            echo "  bash stop_auto_trading.sh"
            echo ""
            exit 1
        fi
    done
fi

# Python 경로 설정
export PYTHONPATH="$PROJECT_DIR/src:$PYTHONPATH"

# 📌 중요: 프로젝트 디렉토리로 이동 (load_dotenv()가 .env 파일을 찾기 위함)
cd "$PROJECT_DIR"

# 시스템 시작
echo "🤖 MainTradingSystem (4팀 통합) 시작..."
nohup python3 -c "
import asyncio
import sys
sys.path.insert(0, '$PROJECT_DIR/src')
from pyqqq.main_trading_system import MainTradingSystem

async def main():
    system = MainTradingSystem()
    await system.start(interval_seconds=60)

asyncio.run(main())
" > "$LOG_DIR/aios_main_${TIMESTAMP}.log" 2>&1 &

MAIN_PID=$!
echo "✅ MainTradingSystem PID: $MAIN_PID"

# PID 저장
echo "$MAIN_PID" > "$PID_FILE"

# 상태 확인
echo ""
echo "================================"
echo "📊 자동매매 시스템 시작 완료"
echo "================================"
echo "🤖 Main: $MAIN_PID"
echo ""
echo "📋 로그 파일:"
echo "  $LOG_DIR/aios_main_${TIMESTAMP}.log"
echo ""
echo "📌 프로세스 확인:"
echo "  ps aux | grep python3"
echo ""
echo "📌 실시간 로그 보기:"
echo "  tail -f $LOG_DIR/aios_main_${TIMESTAMP}.log"
echo ""
echo "📌 에러 로그만 보기:"
echo "  grep '❌\|ERROR' $LOG_DIR/aios_main_${TIMESTAMP}.log"
echo ""
echo "📌 모든 거래 신호 보기:"
echo "  grep '📍\|✅\|⚠️' $LOG_DIR/aios_main_${TIMESTAMP}.log"
echo ""
echo "🛑 중지:"
echo "  bash stop_auto_trading.sh"
echo "================================"
echo ""
echo "⏰ 시스템 상태:"
sleep 2
ps aux | grep -E "python3.*main_trading_system" | grep -v grep || echo "⚠️ 프로세스 확인 불가 (로드 중...)"
