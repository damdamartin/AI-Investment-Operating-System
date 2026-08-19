#!/bin/bash

# 🇺🇸 미국 개장시간(22:30 한국시간) 대기 후 자동매매 시작
# 사용법: bash start_at_us_market_open.sh

PROJECT_DIR="/Users/mac/Documents/Codex/AI-Investment-Operating-System"

echo "🇺🇸 미국 주식 시장 개장 대기 스크립트"
echo "=========================================="

while true; do
    # 현재 시간 확인
    HOUR=$(date +%H)
    MINUTE=$(date +%M)
    CURRENT_TIME=$(printf "%02d:%02d" $HOUR $MINUTE)

    # 미국 개장 시간: 22:30 (한국시간)
    US_MARKET_OPEN="22:30"

    # 요일 확인 (0=Sunday, 1-5=Mon-Fri, 6=Saturday)
    WEEKDAY=$(date +%w)

    echo "⏰ 현재 한국 시간: $CURRENT_TIME"
    echo "   목표: 미국 개장 $US_MARKET_OPEN (평일만)"

    # 평일 확인 (월-금: 1-5)
    if [ $WEEKDAY -ge 1 ] && [ $WEEKDAY -le 5 ]; then
        # 현재 시간이 22:30 이상인지 확인
        if [ "$HOUR" -gt 22 ] || ([ "$HOUR" -eq 22 ] && [ "$MINUTE" -ge 30 ]); then
            echo "✅ 미국 시장 개장 시간입니다!"
            echo "🚀 자동매매 시스템 시작..."

            # 자동매매 시작
            cd "$PROJECT_DIR"
            bash start_auto_trading.sh

            # 스크립트 종료
            exit 0
        else
            # 개장까지 남은 시간 계산
            MINUTES_LEFT=$(( (22 - HOUR) * 60 + (30 - MINUTE) ))
            echo "⏳ 개장까지 약 $MINUTES_LEFT분 남음"
        fi
    else
        WEEKDAY_NAME=""
        if [ $WEEKDAY -eq 0 ]; then WEEKDAY_NAME="일요일"; fi
        if [ $WEEKDAY -eq 6 ]; then WEEKDAY_NAME="토요일"; fi

        echo "⚠️  오늘은 $WEEKDAY_NAME - 미국 시장 휴무"
        echo "📅 내일(월요일) 22:30 대기 예정"
    fi

    # 60초마다 확인
    echo "💤 60초 후 다시 확인..."
    sleep 60
done
