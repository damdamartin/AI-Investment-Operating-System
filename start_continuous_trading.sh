#!/bin/bash

# 🔄 24시간 연속 자동매매 - 한국 장(09:00) + 미국 장(22:30) 자동 시작
# 사용법: bash start_continuous_trading.sh
# 특징: 매일 09:00과 22:30에 자동으로 시작, 종료 후 다음 시간까지 대기

PROJECT_DIR="/Users/mac/Documents/Codex/AI-Investment-Operating-System"
LOG_FILE="/Users/mac/Desktop/trading_logs/continuous_trading.log"

# 로그 디렉토리 생성
mkdir -p /Users/mac/Desktop/trading_logs

echo "🔄 24시간 연속 자동매매 시작 스크립트" | tee -a "$LOG_FILE"
echo "======================================" | tee -a "$LOG_FILE"
echo "📅 시작 시간: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

TRADING_PIDS=()

# 자동매매 시작 함수
start_trading() {
    local market=$1
    local start_hour=$2
    local end_hour=$3

    # 기존 프로세스 종료
    if [ ! -z "$TRADING_PID" ] && ps -p $TRADING_PID > /dev/null; then
        echo "🛑 이전 자동매매 종료 중... (PID: $TRADING_PID)" | tee -a "$LOG_FILE"
        bash "$PROJECT_DIR/stop_auto_trading.sh" 2>/dev/null || kill -9 $TRADING_PID 2>/dev/null
        sleep 2
    fi

    echo "🚀 $market 자동매매 시작 ($(date '+%H:%M:%S'))" | tee -a "$LOG_FILE"
    cd "$PROJECT_DIR"
    nohup bash start_auto_trading.sh > /dev/null 2>&1 &
    TRADING_PID=$!
    echo "✅ 시작됨 (PID: $TRADING_PID)" | tee -a "$LOG_FILE"
}

# 무한 루프: 매일 09:00(국내)과 22:30(미국) 시작
while true; do
    HOUR=$(date +%H)
    MINUTE=$(date +%M)
    WEEKDAY=$(date +%w)
    CURRENT_TIME=$(printf "%02d:%02d" $HOUR $MINUTE)

    # 평일 확인 (월-금: 1-5)
    IS_WEEKDAY=$( [ $WEEKDAY -ge 1 ] && [ $WEEKDAY -le 5 ] && echo "1" || echo "0" )

    # 국내 장 개장 시간: 09:00 (평일만)
    if [ "$CURRENT_TIME" = "09:00" ] && [ "$IS_WEEKDAY" = "1" ]; then
        echo "" | tee -a "$LOG_FILE"
        echo "╔════════════════════════════════════════╗" | tee -a "$LOG_FILE"
        echo "║ 🇰🇷 한국 주식시장 개장 - 자동매매 시작" | tee -a "$LOG_FILE"
        echo "╚════════════════════════════════════════╝" | tee -a "$LOG_FILE"
        start_trading "국내장(한국)" "09:00" "15:30"
        sleep 120  # 2분 대기 (같은 분에 다시 시작되지 않도록)
    fi

    # 미국 장 개장 시간: 22:30 (평일만)
    if [ "$CURRENT_TIME" = "22:30" ] && [ "$IS_WEEKDAY" = "1" ]; then
        echo "" | tee -a "$LOG_FILE"
        echo "╔════════════════════════════════════════╗" | tee -a "$LOG_FILE"
        echo "║ 🇺🇸 미국 주식시장 개장 - 자동매매 시작" | tee -a "$LOG_FILE"
        echo "╚════════════════════════════════════════╝" | tee -a "$LOG_FILE"
        start_trading "미국장(미국)" "22:30" "05:00"
        sleep 120  # 2분 대기
    fi

    # 매분 상태 출력 (로그 기록용)
    if [ $((MINUTE % 10)) -eq 0 ]; then
        STATUS="⏰ $CURRENT_TIME"
        if [ ! -z "$TRADING_PID" ] && ps -p $TRADING_PID > /dev/null; then
            STATUS="$STATUS | ✅ 거래 중 (PID: $TRADING_PID)"
        else
            STATUS="$STATUS | ⏳ 대기 중"
        fi
        echo "$STATUS" >> "$LOG_FILE"
    fi

    # 60초마다 확인
    sleep 60
done
