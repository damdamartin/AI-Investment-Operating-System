#!/bin/bash
# 🕐 한국증권 9시 자동매매 모니터링 스크립트
# 9시 정확하게 자동매매를 시작하고 결과를 추적합니다

set -e

PROJECT_DIR="/Users/mac/Documents/Codex/AI-Investment-Operating-System"
LOG_DIR="/Users/mac/Desktop/trading_logs"
MONITOR_LOG="$LOG_DIR/monitor_9am_$(date +%Y%m%d).log"
STARTED_FLAG="$LOG_DIR/.monitor_9am_started_$(date +%Y%m%d)"

mkdir -p "$LOG_DIR"

echo "============================================" | tee -a "$MONITOR_LOG"
echo "🕐 한국증권 9시 자동매매 모니터링 시작"
echo "============================================" | tee -a "$MONITOR_LOG"
echo "현재 시간: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$MONITOR_LOG"
echo "대기 시작..." | tee -a "$MONITOR_LOG"
echo ""

# 9시까지 대기 (08:50부터 체크 시작)
while true; do
    CURRENT_HOUR=$(date +%H)
    CURRENT_MIN=$(date +%M)

    # 🔧 수정: 09:00~09:05 사이에 한 번만 실행되도록 플래그 사용
    if [ "$CURRENT_HOUR" -eq 9 ] && [ "$CURRENT_MIN" -le 5 ] && [ ! -f "$STARTED_FLAG" ]; then
        echo ""
        echo "🚀🚀🚀 한국증권 시장 개장! 9시 도착 $(date '+%H:%M:%S')" | tee -a "$MONITOR_LOG"
        echo "💥 자동매매 시작..." | tee -a "$MONITOR_LOG"
        echo ""

        # 🔧 플래그 생성: 하루에 한 번만 실행되도록
        touch "$STARTED_FLAG"

        # 실계좌 자동매매 실행
        cd "$PROJECT_DIR"

        # 환경변수 설정
        export TOSS_ONLY_EXECUTION_MODE="LIVE"
        export TOSS_ONLY_ALLOW_LIVE_ORDERS="true"
        export TOSS_ONLY_MIN_SETUP_CONFIDENCE="0.40"
        export KIS_TRADING_ENABLED="false"

        # 거래 실행
        TRADING_LOG="$LOG_DIR/toss_live_trading_9am_$(date +%Y%m%d_%H%M%S).log"
        echo "📝 거래 로그: $TRADING_LOG" | tee -a "$MONITOR_LOG"

        python3 run_toss_only_trading.py 2>&1 | tee -a "$TRADING_LOG" "$MONITOR_LOG"

        echo ""
        echo "============================================" | tee -a "$MONITOR_LOG"
        echo "✅ 9시 자동매매 완료!" | tee -a "$MONITOR_LOG"
        echo "============================================" | tee -a "$MONITOR_LOG"
        echo "로그 파일:" | tee -a "$MONITOR_LOG"
        echo "  - 모니터링: $MONITOR_LOG" | tee -a "$MONITOR_LOG"
        echo "  - 거래: $TRADING_LOG" | tee -a "$MONITOR_LOG"
        echo ""

        # 거래 후 하루에 한 번만 실행하도록 종료
        exit 0
    fi

    # 진행 상황 표시 (매분 마다)
    if [ $((CURRENT_MIN % 5)) -eq 0 ]; then
        echo "⏳ $(date '+%H:%M:%S') - 대기 중..." | tee -a "$MONITOR_LOG"
    fi

    # 1초 대기 후 다시 체크
    sleep 1
done
