#!/bin/bash

# Crypto API Test Script
# Tests all 7 crypto endpoints
# Usage: ./scripts/test-crypto-api.sh [base_url]

BASE_URL="${1:-http://localhost:8787}"
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}Crypto API Endpoint Test Suite${NC}"
echo -e "${BOLD}========================================${NC}"
echo "Base URL: $BASE_URL"
echo ""

# Helper function to test endpoints
test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local description=$4

  echo -e "${BOLD}Testing: $description${NC}"
  echo -e "${YELLOW}$method $endpoint${NC}"

  if [ -n "$data" ]; then
    echo -e "Data: ${YELLOW}$data${NC}"
    local response=$(curl -s -X $method "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data")
  else
    local response=$(curl -s -X $method "$BASE_URL$endpoint")
  fi

  # Check if response is valid JSON
  if echo "$response" | jq . >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Response:${NC}"
    echo "$response" | jq '.'
  else
    echo -e "${RED}✗ Invalid JSON response:${NC}"
    echo "$response"
  fi
  echo ""
}

# Test 1: GET /api/crypto/status
test_endpoint "GET" "/api/crypto/status" "" "1. GET /api/crypto/status - Engine Status"

# Test 2: GET /api/crypto/balances
test_endpoint "GET" "/api/crypto/balances" "" "2. GET /api/crypto/balances - Portfolio Balances"

# Test 3: GET /api/crypto/orders (all)
test_endpoint "GET" "/api/crypto/orders" "" "3. GET /api/crypto/orders - All Orders"

# Test 4: GET /api/crypto/orders (filtered)
test_endpoint "GET" "/api/crypto/orders?status=submitted&limit=10" "" "3b. GET /api/crypto/orders (filtered) - Submitted Orders"

# Test 5: GET /api/crypto/positions
test_endpoint "GET" "/api/crypto/positions" "" "4. GET /api/crypto/positions - Open Positions"

# Test 6: POST /api/crypto/strategy/enable (enable)
test_endpoint "POST" "/api/crypto/strategy/enable" \
  '{"enabled":true,"markets":["KRW-BTC","KRW-ETH"],"minConfidence":60}' \
  "5. POST /api/crypto/strategy/enable - Enable Strategy"

# Test 7: POST /api/crypto/strategy/enable (disable)
test_endpoint "POST" "/api/crypto/strategy/enable" \
  '{"enabled":false,"markets":["KRW-BTC"],"minConfidence":60}' \
  "5b. POST /api/crypto/strategy/enable - Disable Strategy"

# Test 8: POST /api/crypto/kill-switch/activate (activate)
test_endpoint "POST" "/api/crypto/kill-switch/activate" \
  '{"action":"activate","reason":"Testing kill switch"}' \
  "6. POST /api/crypto/kill-switch/activate - Activate Kill Switch"

# Test 9: POST /api/crypto/kill-switch/activate (deactivate)
test_endpoint "POST" "/api/crypto/kill-switch/activate" \
  '{"action":"deactivate","reason":"Testing complete"}' \
  "6b. POST /api/crypto/kill-switch/activate - Deactivate Kill Switch"

# Test 10: GET /api/crypto/performance
test_endpoint "GET" "/api/crypto/performance" "" "7. GET /api/crypto/performance - Performance Metrics"

# Test 11: GET /api/crypto/performance (daily)
test_endpoint "GET" "/api/crypto/performance?period=day" "" "7b. GET /api/crypto/performance (daily) - Daily Performance"

# Test 12: GET /api/crypto/performance (custom range)
test_endpoint "GET" "/api/crypto/performance?period=custom&startDate=2026-08-01&endDate=2026-08-31" "" \
  "7c. GET /api/crypto/performance (custom range) - Custom Date Range"

# Test error cases
echo -e "${BOLD}Testing: Error Cases${NC}"
echo ""

# Test 13: Invalid request body
test_endpoint "POST" "/api/crypto/strategy/enable" \
  '{"enabled":true}' \
  "ERROR TEST 1: POST /api/crypto/strategy/enable - Missing markets"

# Test 14: Invalid action
test_endpoint "POST" "/api/crypto/kill-switch/activate" \
  '{"action":"invalid","reason":"test"}' \
  "ERROR TEST 2: POST /api/crypto/kill-switch/activate - Invalid action"

# Summary
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}Test Suite Complete${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""
echo -e "${GREEN}✓ All endpoints tested${NC}"
echo ""
echo "Endpoints tested:"
echo "  1. GET /api/crypto/status"
echo "  2. GET /api/crypto/balances"
echo "  3. GET /api/crypto/orders"
echo "  4. GET /api/crypto/positions"
echo "  5. POST /api/crypto/strategy/enable"
echo "  6. POST /api/crypto/kill-switch/activate"
echo "  7. GET /api/crypto/performance"
echo ""
echo "For detailed API documentation, see CRYPTO_API.md"
