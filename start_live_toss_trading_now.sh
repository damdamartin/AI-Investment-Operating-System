#!/bin/bash
# 🚀 Toss 실계좌 자동매매 시작 스크립트
# 오늘 밤부터 미국주식 실제 거래 시작

set -e

cd /Users/mac/Documents/Codex/AI-Investment-Operating-System

echo "=========================================="
echo "🚀 Toss 실계좌 자동매매 시작"
echo "=========================================="
echo ""

# 환경변수 설정
export TOSS_ONLY_EXECUTION_MODE="LIVE"
export TOSS_ONLY_ALLOW_LIVE_ORDERS="true"
export TOSS_ONLY_MAX_CANDIDATES="8"
export TOSS_ONLY_MIN_CANDIDATE_SCORE="0.45"
export TOSS_ONLY_MIN_SETUP_CONFIDENCE="0.50"  # 낮춤: 0.60 → 0.50
export TOSS_ONLY_RISK_PER_TRADE_PCT="0.03"
export TOSS_ONLY_MAX_POSITION_PCT="0.35"
export TOSS_ONLY_FRACTIONAL_TRADING_ENABLED="true"

# KIS_TRADING_ENABLED는 반드시 false
export KIS_TRADING_ENABLED="false"

# Toss 인증정보 (기존 .env에서 자동으로 로드됨)
# 필요 시 .env 파일 확인

echo "⚙️  설정:"
echo "  TOSS_ONLY_EXECUTION_MODE: $TOSS_ONLY_EXECUTION_MODE"
echo "  TOSS_ONLY_ALLOW_LIVE_ORDERS: $TOSS_ONLY_ALLOW_LIVE_ORDERS"
echo "  KIS_TRADING_ENABLED: $KIS_TRADING_ENABLED"
echo ""

# 로그 파일
LOG_FILE="/Users/mac/Desktop/trading_logs/toss_live_trading_$(date +%Y%m%d_%H%M%S).log"
mkdir -p "$(dirname "$LOG_FILE")"

echo "📝 로그 파일: $LOG_FILE"
echo ""

# 매매 사이클 시작
echo "🔄 첫 번째 매매 사이클 실행 중..."
echo ""

python3 run_toss_only_trading.py 2>&1 | tee "$LOG_FILE"

echo ""
echo "=========================================="
echo "✅ Toss 실계좌 매매 완료"
echo "=========================================="
echo ""
echo "📊 결과는 다음 파일을 확인하세요:"
echo "  $LOG_FILE"
echo ""
echo "🔔 KIS 알림: 비활성화됨"
echo "🟢 상태: 실계좌 자동매매 중"
