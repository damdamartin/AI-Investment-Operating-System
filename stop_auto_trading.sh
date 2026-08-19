#!/bin/bash

# 🛑 4팀 통합 AI 자동매매 시스템 중지 스크립트
# 모든 MainTradingSystem 관련 프로세스를 정리

LOG_DIR="/Users/mac/Desktop/trading_logs"
LOCK_FILE="/tmp/aios_main_trading_system.lock"

echo "🛑 4팀 통합 AI 자동매매 시스템 중지 중..."
echo ""

# 1️⃣ 모든 MainTradingSystem 프로세스 찾기
PIDS=$(pgrep -af 'main_trading_system|MainTradingSystem' | grep -v grep | awk '{print $1}')

if [ -z "$PIDS" ]; then
    echo "⚠️  실행 중인 MainTradingSystem 프로세스가 없습니다."
else
    echo "📋 종료할 프로세스:"
    for PID in $PIDS; do
        echo "  - PID: $PID"
    done
    echo ""

    # 2️⃣ 각 프로세스 종료 시도 (SIGTERM)
    for PID in $PIDS; do
        if ps -p $PID > /dev/null 2>&1; then
            echo "🛑 PID $PID 종료 중..."
            kill -TERM $PID
        fi
    done

    # 3️⃣ 3초 대기
    sleep 3

    # 4️⃣ 남아있는 프로세스 강제 종료 (SIGKILL)
    REMAINING=$(pgrep -af 'main_trading_system|MainTradingSystem' | grep -v grep | awk '{print $1}')
    if [ ! -z "$REMAINING" ]; then
        echo "⚠️  일부 프로세스가 여전히 실행 중입니다. 강제 종료 중..."
        for PID in $REMAINING; do
            echo "💥 PID $PID 강제 종료"
            kill -9 $PID 2>/dev/null
        done
    fi
fi

# 5️⃣ 락 파일 제거
if [ -f "$LOCK_FILE" ]; then
    echo "🗑️  락 파일 정리: $LOCK_FILE"
    rm -f "$LOCK_FILE"
fi

# 6️⃣ PID 파일 정리
PID_FILE="$LOG_DIR/aios_main.pid"
if [ -f "$PID_FILE" ]; then
    rm -f "$PID_FILE"
fi

# 7️⃣ 최종 확인
sleep 1
FINAL_COUNT=$(pgrep -af 'main_trading_system|MainTradingSystem' | grep -v grep | wc -l)

echo ""
echo "================================"
echo "✅ 자동매매 시스템 중지 완료"
echo "================================"
echo "📊 남은 프로세스: $FINAL_COUNT개"
echo ""

if [ $FINAL_COUNT -eq 0 ]; then
    echo "✅ 모든 프로세스가 정리되었습니다."
else
    echo "⚠️  경고: 여전히 $FINAL_COUNT개의 프로세스가 실행 중입니다."
    echo "     수동으로 종료하세요: killall -9 python3"
fi
