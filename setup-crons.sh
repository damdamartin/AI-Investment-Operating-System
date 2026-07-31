#!/bin/bash

# Cloudflare Cron Triggers Setup Script
# Usage: export CLOUDFLARE_API_TOKEN="your-token" && bash setup-crons.sh

ACCOUNT_ID="87b29e119026eda88a305476a9c28adb"
WORKER_NAME="ai-investment-trading-cycle-production"
API_TOKEN="${CLOUDFLARE_API_TOKEN}"

if [ -z "$API_TOKEN" ]; then
  echo "❌ ERROR: CLOUDFLARE_API_TOKEN이 설정되지 않았습니다"
  echo ""
  echo "사용 방법:"
  echo "  export CLOUDFLARE_API_TOKEN=\"your-api-token\""
  echo "  bash setup-crons.sh"
  echo ""
  echo "토큰 생성:"
  echo "  1. https://dash.cloudflare.com/profile/api-tokens"
  echo "  2. 'Create Token' → 'Edit Cloudflare Workers' 선택"
  echo "  3. Permissions: Account > Workers Scripts (Write)"
  echo "  4. Create Token 클릭"
  exit 1
fi

echo "🔧 Cloudflare Cron Triggers 설정 중..."
echo "Account: $ACCOUNT_ID"
echo "Worker: $WORKER_NAME"
echo ""

# API 호출
RESPONSE=$(curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts/$WORKER_NAME/schedules" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schedules": [
      {"cron": "0 9 * * 1-5"},
      {"cron": "0 11 * * 1-5"},
      {"cron": "0 14 * * 1-5"},
      {"cron": "30 22 * * *"},
      {"cron": "30 0 * * *"},
      {"cron": "0 3 * * *"},
      {"cron": "0 6 * * *"}
    ]
  }')

echo "응답:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# 결과 확인
SUCCESS=$(echo "$RESPONSE" | jq -r '.success' 2>/dev/null)

if [ "$SUCCESS" = "true" ]; then
  echo ""
  echo "✅ Cron 설정 성공!"
  echo ""
  echo "설정된 스케줄:"
  echo "  평일 한국 주식:"
  echo "    - 09:00 KST (0 9 * * 1-5)"
  echo "    - 11:00 KST (0 11 * * 1-5)"
  echo "    - 14:00 KST (0 14 * * 1-5)"
  echo ""
  echo "  매일 미국 주식:"
  echo "    - 22:30 KST (30 22 * * *)"
  echo "    - 00:30 KST (30 0 * * *)"
  echo "    - 03:00 KST (0 3 * * *)"
  echo "    - 06:00 KST (0 6 * * *)"
  echo ""
  echo "🚀 자동매매 시스템이 시작되었습니다!"
else
  echo ""
  echo "❌ Cron 설정 실패"
  echo "에러: $(echo "$RESPONSE" | jq -r '.errors[0].message' 2>/dev/null)"
  exit 1
fi
