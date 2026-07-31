#!/bin/bash

# Real-time Trading Data Monitor
# Shows live KIS & Toss team performance

BASE_URL="https://ai-investment-trading-cycle-production.junkim-life360.workers.dev"

clear
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  🤖 DUAL-TEAM AUTO-TRADING MONITOR (Real-time)               ║"
echo "║  KIS Team 🐳 | Toss Team 💜                                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Function to fetch and format team data
show_team_data() {
  local team=$1
  local emoji=$2

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$emoji $team Team Status"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  local response=$(curl -s "$BASE_URL/api/${team,,}-status")

  if echo "$response" | jq -e '.status == "error"' > /dev/null 2>&1; then
    echo "❌ Error: $(echo $response | jq -r '.error')"
    return
  fi

  local portfolio=$(echo "$response" | jq '.portfolio')
  local positions=$(echo "$response" | jq '.positions')
  local timestamp=$(echo "$response" | jq -r '.timestamp')

  # Portfolio metrics
  local totalValue=$(echo "$portfolio" | jq -r '.totalValue')
  local positionValue=$(echo "$portfolio" | jq -r '.positionValue')
  local cashValue=$(echo "$portfolio" | jq -r '.cashValue')
  local totalPnL=$(echo "$portfolio" | jq -r '.totalPnL')
  local pnlPercent=$(echo "$portfolio" | jq -r '.totalPnLPercent')

  printf "📊 포트폴리오:     ₩%-15s\n" "$(numfmt --to=iec-i --suffix=B $totalValue 2>/dev/null || echo $totalValue)"
  printf "💰 현금:          ₩%-15s\n" "$(numfmt --to=iec-i --suffix=B $cashValue 2>/dev/null || echo $cashValue)"
  printf "📈 포지션:        ₩%-15s\n" "$(numfmt --to=iec-i --suffix=B $positionValue 2>/dev/null || echo $positionValue)"

  # P&L with color
  if (( $(echo "$totalPnL >= 0" | bc -l) )); then
    echo "✅ P&L:           +₩$totalPnL ($pnlPercent%)"
  else
    echo "⚠️  P&L:           -₩$totalPnL ($pnlPercent%)"
  fi

  # Positions
  local posCount=$(echo "$positions" | jq 'length')
  echo "🎯 포지션 개수:    $posCount개"

  if [ "$posCount" -gt 0 ]; then
    echo ""
    echo "  종목    수량   진입가    현재가    P&L    수익률"
    echo "  ──────────────────────────────────────────────"
    echo "$positions" | jq -r '.[] |
      "  \(.symbol) \(.quantity)주 \(.entryPrice) → \(.currentPrice) \(.pnl) \(.pnlPercent)%"'
  fi

  echo ""
  echo "🕐 Update: $(date -r <(echo "$timestamp") '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo $timestamp)"
  echo ""
}

# Main monitoring loop
while true; do
  clear
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║  🤖 DUAL-TEAM AUTO-TRADING MONITOR                           ║"
  echo "║  Last Update: $(date '+%Y-%m-%d %H:%M:%S')                        ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""

  # Show both teams
  show_team_data "KIS" "🐳"
  show_team_data "Toss" "💜"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📲 Dashboard: $BASE_URL/dashboard"
  echo "⏰ Next update in 3 seconds... (Ctrl+C to exit)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  sleep 3
done
