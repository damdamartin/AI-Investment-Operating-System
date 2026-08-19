#!/bin/bash

# 4팀 에이전트 통합 시스템 시작 스크립트

PROJECT_DIR="/Users/mac/Documents/Codex/AI-Investment-Operating-System"
LOG_DIR="/Users/mac/Desktop/trading_logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$LOG_DIR"

echo "🚀 4팀 에이전트 통합 자동매매 시스템 시작..."
echo "📁 프로젝트: $PROJECT_DIR"

export PYTHONPATH="$PROJECT_DIR/src:$PYTHONPATH"

# .env 파일 로드
set -a
source "$PROJECT_DIR/.env"
set +a

# 4팀 에이전트 시스템 시작
nohup python3 -c "
import asyncio
import sys
sys.path.insert(0, '$PROJECT_DIR/src')
from pyqqq.main_trading_system import main
asyncio.run(main())
" > "$LOG_DIR/4team_agent_system_${TIMESTAMP}.log" 2>&1 &

AGENT_PID=$!
echo "✅ 4팀 에이전트 시스템 PID: $AGENT_PID"
echo "$AGENT_PID" > "$LOG_DIR/4team_agent.pid"

echo ""
echo "================================"
echo "📊 4팀 에이전트 시스템 시작 완료"
echo "================================"
echo "🤖 팀장 + 리서치팀 + 분석팀 + 매매팀: $AGENT_PID"
echo ""
echo "📋 로그 파일:"
echo "   $LOG_DIR/4team_agent_system_${TIMESTAMP}.log"
echo ""
echo "📌 실시간 로그:"
echo "   tail -f $LOG_DIR/4team_agent_system_${TIMESTAMP}.log"
echo ""
echo "🛑 중지:"
echo "   kill $AGENT_PID"
echo "================================"
