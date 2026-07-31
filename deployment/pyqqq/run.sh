#!/bin/bash
# PyQQQ 자동매매 시스템 실행 스크립트
# 배포 경로: /Users/mac/Documents/Codex/AI-Investment-Operating-System/deployment/pyqqq

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/Users/mac/Documents/Codex/AI-Investment-Operating-System/logs/pyqqq.log"

# 타임스탬프
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TIMESTAMP] PyQQQ 시작" >> "$LOG_FILE"

# Python으로 직접 실행
python3 << 'EOF' >> "$LOG_FILE" 2>&1
import sys
sys.path.insert(0, '/Users/mac/Documents/Codex/AI-Investment-Operating-System')
sys.path.insert(0, '/Users/mac/Documents/Codex/AI-Investment-Operating-System/deployment/pyqqq')

from src.pyqqq.strategy import TradingStrategy
import asyncio

strategy = TradingStrategy()
asyncio.run(strategy.run(once=True))
EOF

EXIT_CODE=$?
echo "[$TIMESTAMP] PyQQQ 종료 (코드: $EXIT_CODE)" >> "$LOG_FILE"
exit $EXIT_CODE
