#!/bin/bash
# AIOS Logs Tail Script
# 모든 로그를 실시간으로 추적합니다.

LOGS_DIR="/var/log/aios"

echo "Tailing all AIOS logs (Ctrl+C to stop)..."
echo ""

# tmux를 사용할 수 있으면 사용, 아니면 tail 사용
if command -v tmux &> /dev/null; then
    echo "Using tmux for multi-pane view..."
    tmux new-session -d -s aios-logs
    tmux send-keys -t aios-logs "tail -f $LOGS_DIR/crypto.log" Enter
    tmux split-window -h -t aios-logs "tail -f $LOGS_DIR/kis.log"
    tmux split-window -h -t aios-logs "tail -f $LOGS_DIR/toss.log"
    tmux select-layout -t aios-logs even-horizontal
    tmux attach-session -t aios-logs
else
    echo "Tailing logs (install tmux for multi-pane view)..."
    echo ""
    tail -f $LOGS_DIR/crypto.log &
    tail -f $LOGS_DIR/kis.log &
    tail -f $LOGS_DIR/toss.log &
    wait
fi
