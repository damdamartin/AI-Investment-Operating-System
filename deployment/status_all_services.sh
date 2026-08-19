#!/bin/bash
# AIOS Services Status Script
# 모든 서비스와 heartbeat 상태를 확인합니다.

echo "========================================="
echo "AIOS Services Status Report"
echo "========================================="
echo ""

# 함수: 각 서비스 상태 확인
check_service() {
    local name=$1
    local service="aios-$name"

    echo "[$name]"
    systemctl status $service --no-pager | grep -E "Active|Since|Process"

    # Heartbeat 확인
    local hb_file="/var/lib/aios/${name}_heartbeat.json"
    if [ -f "$hb_file" ]; then
        local timestamp=$(jq -r '.timestamp' "$hb_file" 2>/dev/null || echo "N/A")
        local loop=$(jq -r '.loop_count' "$hb_file" 2>/dev/null || echo "N/A")
        local status=$(jq -r '.status' "$hb_file" 2>/dev/null || echo "N/A")
        echo "  Heartbeat: $timestamp (loop: $loop, status: $status)"
    else
        echo "  Heartbeat: NO FILE"
    fi

    # 최근 로그
    local log_file="/var/log/aios/${name}.log"
    if [ -f "$log_file" ]; then
        local lines=$(wc -l < "$log_file")
        echo "  Log lines: $lines"
        echo "  Recent:"
        tail -3 "$log_file" | sed 's/^/    /'
    fi

    echo ""
}

check_service "crypto"
check_service "kis"
check_service "toss"

# Healthcheck timer
echo "[Healthcheck Timer]"
systemctl status aios-healthcheck.timer --no-pager | grep -E "Active|Trigger"
echo ""

# 요약
echo "========================================="
echo "Summary:"
echo "========================================="

for name in crypto kis toss; do
    status=$(systemctl is-active "aios-$name")
    echo "aios-$name: $status"
done

echo ""
echo "Full status: sudo systemctl status aios-*"
echo "View logs: tail -f /var/log/aios/*.log"
