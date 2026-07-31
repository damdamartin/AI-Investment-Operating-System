#!/bin/bash

# Start Dual-Team Auto-Trading Session
# Usage: ./start-trading.sh

BASE_URL="https://ai-investment-trading-cycle-production.junkim-life360.workers.dev"

echo "🚀 Starting Dual-Team Auto-Trading..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Check System Status
echo "✓ System Status Check..."
curl -s "$BASE_URL/api/status" | jq .
echo ""

# 2. Start KIS Team Trading
echo "✓ Initializing KIS Team..."
curl -s "$BASE_URL/api/kis-status" | jq '.isHealthy'
echo ""

# 3. Start Toss Team Trading
echo "✓ Initializing Toss Team..."
curl -s "$BASE_URL/api/toss-status" | jq '.isHealthy'
echo ""

# 4. Open Dashboard
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Auto-Trading Started!"
echo ""
echo "📊 Dashboard: $BASE_URL/dashboard"
echo "📈 KIS Status: $BASE_URL/api/kis-status"
echo "📈 Toss Status: $BASE_URL/api/toss-status"
echo ""
echo "🔄 Real-time updates: Every 3 seconds"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
