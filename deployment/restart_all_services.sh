#!/bin/bash
# AIOS Services Restart Script
# 모든 자동매매 서비스를 재시작합니다.

echo "Restarting all AIOS services..."
echo ""

sudo systemctl restart aios-crypto
echo "✓ aios-crypto restarted"

sudo systemctl restart aios-kis
echo "✓ aios-kis restarted"

sudo systemctl restart aios-toss
echo "✓ aios-toss restarted"

sleep 2

echo ""
echo "Service status:"
systemctl status aios-crypto --no-pager | grep -E "Active|Since"
systemctl status aios-kis --no-pager | grep -E "Active|Since"
systemctl status aios-toss --no-pager | grep -E "Active|Since"

echo ""
echo "Done!"
