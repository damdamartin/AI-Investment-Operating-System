# Crypto API Endpoints

Complete REST API for controlling and monitoring the Crypto Engine.

**Base URL**: `https://ai-investment-trading-cycle-production.workers.dev` (or your deployment)

---

## Table of Contents

1. [GET /api/crypto/status](#1-get-apicryptostatus) - Engine status & health check
2. [GET /api/crypto/balances](#2-get-apicryptobalances) - Portfolio balances
3. [GET /api/crypto/orders](#3-get-apicryptoorders) - Order list with pagination
4. [GET /api/crypto/positions](#4-get-apicryptopositions) - Active positions
5. [POST /api/crypto/strategy/enable](#5-post-apicryptostrategyenable) - Control trading signals
6. [POST /api/crypto/kill-switch/activate](#6-post-apicryptokill-switchactivate) - Emergency stop
7. [GET /api/crypto/performance](#7-get-apicryptoperformance) - Performance analytics

---

## 1. GET /api/crypto/status

Returns current status of crypto engine and health metrics.

### Request

```bash
curl -X GET https://ai-investment-trading-cycle-production.workers.dev/api/crypto/status
```

### Response (200 OK)

```json
{
  "data": {
    "status": "active",
    "killSwitch": {
      "active": false,
      "reason": null,
      "activatedAt": null
    },
    "engine": {
      "running": true,
      "signalGenerationActive": true,
      "orderExecutionActive": true,
      "fillTrackingActive": true
    },
    "health": {
      "apiConnection": "ok",
      "websocketConnection": "connected",
      "databaseConnection": "ok",
      "lastUpdate": 1722530400123
    }
  },
  "timestamp": 1722530400123
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| status | string | Engine status: "active", "paused", "stopped" |
| killSwitch.active | boolean | True if kill switch is active |
| killSwitch.reason | string \| null | Reason for kill switch activation |
| engine.running | boolean | Is engine running? |
| engine.signalGenerationActive | boolean | Are new signals being generated? |
| engine.orderExecutionActive | boolean | Are orders being executed? |
| engine.fillTrackingActive | boolean | Are fills being tracked? |
| health.* | string | Health status of each subsystem |

---

## 2. GET /api/crypto/balances

Returns portfolio balances and current positions with metrics.

### Request

```bash
curl -X GET https://ai-investment-trading-cycle-production.workers.dev/api/crypto/balances
```

### Response (200 OK)

```json
{
  "data": {
    "portfolio": {
      "totalValue": 7500000,
      "cash": 2500000,
      "cryptoValue": 5000000,
      "totalGain": 1300000,
      "totalReturn": 0.2127,
      "updatedAt": 1722530400123
    },
    "positions": [
      {
        "market": "KRW-BTC",
        "quantity": 0.1,
        "avgPrice": 40200000,
        "currentPrice": 42100000,
        "totalCost": 4020000,
        "currentValue": 4210000,
        "gain": 190000,
        "return": 0.0472,
        "percent": 56.1
      },
      {
        "market": "KRW-ETH",
        "quantity": 0.5,
        "avgPrice": 2900000,
        "currentPrice": 2800000,
        "totalCost": 1450000,
        "currentValue": 1400000,
        "gain": -50000,
        "return": -0.0345,
        "percent": 18.7
      }
    ],
    "assetAllocation": [
      {
        "market": "KRW-BTC",
        "percent": 56.1
      },
      {
        "market": "KRW-ETH",
        "percent": 18.7
      }
    ]
  },
  "timestamp": 1722530400123
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| portfolio.totalValue | number | Total portfolio value (cash + crypto) in KRW |
| portfolio.cash | number | Available cash balance |
| portfolio.cryptoValue | number | Total value of crypto holdings |
| portfolio.totalGain | number | Total profit/loss from entry |
| portfolio.totalReturn | number | Return rate (0.2127 = 21.27%) |
| positions[].market | string | Market pair (e.g., KRW-BTC) |
| positions[].quantity | number | Holding quantity |
| positions[].avgPrice | number | Average entry price |
| positions[].currentPrice | number | Current market price |
| positions[].totalCost | number | Total cost basis |
| positions[].currentValue | number | Current position value |
| positions[].gain | number | Unrealized gain/loss |
| positions[].return | number | Position return rate |
| positions[].percent | number | Portfolio allocation % |

---

## 3. GET /api/crypto/orders

Returns list of orders with pagination and status filtering.

### Request

```bash
# Get all orders (default)
curl -X GET "https://ai-investment-trading-cycle-production.workers.dev/api/crypto/orders"

# Get submitted orders with limit
curl -X GET "https://ai-investment-trading-cycle-production.workers.dev/api/crypto/orders?status=submitted&limit=20&offset=0"

# Filter by status
curl -X GET "https://ai-investment-trading-cycle-production.workers.dev/api/crypto/orders?status=done"
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string | "all" | all, pending, submitted, partial, done, canceled, failed |
| limit | number | 50 | Results per page (max 100) |
| offset | number | 0 | Pagination offset |

### Response (200 OK)

```json
{
  "data": {
    "orders": [
      {
        "id": "ord-1722530400-abc123",
        "market": "KRW-BTC",
        "side": "BUY",
        "orderType": "LIMIT",
        "price": 42000000,
        "volume": 0.05,
        "status": "submitted",
        "exchangeOrderId": "upbit-uuid-xyz",
        "confidence": 85,
        "createdAt": 1722530390123,
        "submittedAt": 1722530395123,
        "doneAt": null,
        "filledVolume": 0.0,
        "filledPrice": 0
      }
    ],
    "total": 45,
    "page": 1,
    "pageSize": 50
  },
  "timestamp": 1722530400123
}
```

---

## 4. GET /api/crypto/positions

Returns currently open positions (active holdings).

### Request

```bash
curl -X GET https://ai-investment-trading-cycle-production.workers.dev/api/crypto/positions
```

### Response (200 OK)

```json
{
  "data": {
    "positions": [
      {
        "market": "KRW-BTC",
        "quantity": 0.1,
        "avgPrice": 40200000,
        "currentPrice": 42100000,
        "totalCost": 4020000,
        "currentValue": 4210000,
        "unrealizedPnl": 190000,
        "unrealizedReturn": 0.0472,
        "trades": [
          {
            "id": "trade-KRW-BTC",
            "entryPrice": 40200000,
            "quantity": 0.1,
            "entryAt": 1722444000000
          }
        ]
      }
    ],
    "totalCount": 3,
    "openCount": 3
  },
  "timestamp": 1722530400123
}
```

---

## 5. POST /api/crypto/strategy/enable

Enable or disable trading signals for specific markets.

### Request

```bash
# Enable strategy
curl -X POST https://ai-investment-trading-cycle-production.workers.dev/api/crypto/strategy/enable \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "markets": ["KRW-BTC", "KRW-ETH", "KRW-SOL"],
    "minConfidence": 60
  }'

# Disable strategy
curl -X POST https://ai-investment-trading-cycle-production.workers.dev/api/crypto/strategy/enable \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false,
    "markets": ["KRW-BTC"],
    "minConfidence": 60
  }'
```

### Request Body

```json
{
  "enabled": true,
  "markets": ["KRW-BTC", "KRW-ETH", "KRW-SOL"],
  "minConfidence": 60
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| enabled | boolean | Yes | Enable (true) or disable (false) |
| markets | string[] | Yes | List of market pairs to apply to |
| minConfidence | number | No | Minimum confidence threshold (0-100) |

### Response (200 OK)

```json
{
  "data": {
    "success": true,
    "message": "Strategy enabled for 3 markets",
    "config": {
      "enabled": true,
      "markets": ["KRW-BTC", "KRW-ETH", "KRW-SOL"],
      "minConfidence": 60,
      "updatedAt": 1722530400123
    }
  },
  "timestamp": 1722530400123
}
```

### Response (400 Bad Request)

```json
{
  "error": true,
  "code": "INVALID_REQUEST",
  "message": "markets must be an array",
  "details": {
    "reason": "Invalid input",
    "timestamp": 1722530400123
  }
}
```

---

## 6. POST /api/crypto/kill-switch/activate

Activate or deactivate emergency kill switch to halt all trading.

### Request

```bash
# Activate kill switch
curl -X POST https://ai-investment-trading-cycle-production.workers.dev/api/crypto/kill-switch/activate \
  -H "Content-Type: application/json" \
  -d '{
    "action": "activate",
    "reason": "Manual activation by admin - checking prices"
  }'

# Deactivate kill switch
curl -X POST https://ai-investment-trading-cycle-production.workers.dev/api/crypto/kill-switch/activate \
  -H "Content-Type: application/json" \
  -d '{
    "action": "deactivate",
    "reason": "Issue resolved, resuming trading"
  }'
```

### Request Body

```json
{
  "action": "activate|deactivate",
  "reason": "Manual activation by admin"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| action | string | Yes | "activate" or "deactivate" |
| reason | string | No | Reason for action |

### Response (200 OK)

```json
{
  "data": {
    "success": true,
    "killSwitch": {
      "active": true,
      "reason": "Manual activation by admin",
      "activatedAt": 1722530400123,
      "activatedBy": "admin"
    }
  },
  "timestamp": 1722530400123
}
```

### Response (400 Bad Request)

```json
{
  "error": true,
  "code": "INVALID_ACTION",
  "message": "action must be 'activate' or 'deactivate'",
  "details": {
    "reason": "Invalid action value",
    "timestamp": 1722530400123
  }
}
```

---

## 7. GET /api/crypto/performance

Returns performance metrics and daily P&L breakdown.

### Request

```bash
# Get monthly performance (default)
curl -X GET "https://ai-investment-trading-cycle-production.workers.dev/api/crypto/performance"

# Get daily performance
curl -X GET "https://ai-investment-trading-cycle-production.workers.dev/api/crypto/performance?period=day"

# Get custom date range
curl -X GET "https://ai-investment-trading-cycle-production.workers.dev/api/crypto/performance?period=custom&startDate=2026-08-01&endDate=2026-08-31"
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| period | string | "month" | day, week, month, all |
| startDate | string | - | YYYY-MM-DD format (optional) |
| endDate | string | - | YYYY-MM-DD format (optional) |

### Response (200 OK)

```json
{
  "data": {
    "period": "month",
    "startDate": 1722556800000,
    "endDate": 1725235199000,
    "metrics": {
      "totalReturn": 0.185,
      "dailyReturn": 0.008,
      "monthlyReturn": 0.123,
      "volatility": 0.123,
      "maxDrawdown": -0.082,
      "sharpeRatio": 1.87,
      "winRate": 0.644,
      "profitFactor": 1.82,
      "tradeCount": 45,
      "winCount": 29,
      "lossCount": 16,
      "averageWin": 15000,
      "averageLoss": 8200,
      "bestTrade": 45000,
      "worstTrade": -25000,
      "consecutiveWins": 3,
      "consecutiveLosses": 2
    },
    "daily": [
      {
        "date": "2026-08-01",
        "return": 0.015,
        "pnl": 112500,
        "trades": 3,
        "wins": 2
      },
      {
        "date": "2026-08-02",
        "return": -0.005,
        "pnl": -37500,
        "trades": 2,
        "wins": 1
      }
    ]
  },
  "timestamp": 1722530400123
}
```

### Performance Metrics Explained

| Metric | Description |
|--------|-------------|
| totalReturn | Total return rate for period |
| dailyReturn | Average daily return |
| monthlyReturn | Average monthly return |
| volatility | Standard deviation of daily returns |
| maxDrawdown | Largest peak-to-trough decline |
| sharpeRatio | Return per unit of risk (higher is better) |
| winRate | Percentage of winning trades (0-1) |
| profitFactor | Gross profit / gross loss ratio |
| tradeCount | Total number of trades |
| winCount | Number of winning trades |
| lossCount | Number of losing trades |
| averageWin | Average profit per winning trade |
| averageLoss | Average loss per losing trade |
| bestTrade | Best single trade P&L |
| worstTrade | Worst single trade P&L |
| consecutiveWins | Current/recent win streak |
| consecutiveLosses | Current/recent loss streak |

---

## Error Response Format

All endpoints return consistent error responses:

```json
{
  "error": true,
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    "reason": "Technical reason for error",
    "timestamp": 1722530400123
  }
}
```

Common error codes:
- `CRYPTO_ENGINE_ERROR` - General engine error
- `INVALID_REQUEST` - Invalid request parameters
- `INVALID_ACTION` - Invalid action parameter
- `DATABASE_ERROR` - Database query failed

---

## Rate Limiting & CORS

- CORS: Enabled for all origins (`Access-Control-Allow-Origin: *`)
- Methods: GET, POST, OPTIONS
- Rate limiting: Not implemented (add as needed)
- Response format: Always JSON

---

## Testing

See `tests/workers/crypto-api-controller.test.ts` for comprehensive test coverage (23 tests, 100% passing).

### Run Tests

```bash
npm test -- tests/workers/crypto-api-controller.test.ts
```

---

## Integration

### In TypeScript/JavaScript

```typescript
const response = await fetch('https://ai-investment-trading-cycle-production.workers.dev/api/crypto/status');
const data = await response.json();
console.log(data.data.status);
```

### In Python

```python
import requests

response = requests.get(
    'https://ai-investment-trading-cycle-production.workers.dev/api/crypto/status'
)
data = response.json()
print(data['data']['status'])
```

### In cURL (bash)

```bash
#!/bin/bash

# Get status
curl -X GET https://ai-investment-trading-cycle-production.workers.dev/api/crypto/status | jq '.'

# Get balances
curl -X GET https://ai-investment-trading-cycle-production.workers.dev/api/crypto/balances | jq '.data.portfolio'

# Get orders
curl -X GET "https://ai-investment-trading-cycle-production.workers.dev/api/crypto/orders?status=done&limit=10" | jq '.data.orders'

# Activate kill switch
curl -X POST https://ai-investment-trading-cycle-production.workers.dev/api/crypto/kill-switch/activate \
  -H "Content-Type: application/json" \
  -d '{"action":"activate","reason":"Emergency stop"}'
```

---

## Deployment

The crypto API is deployed as part of the main trading-cycle-worker on Cloudflare Workers:

```bash
npm run deploy
```

Endpoints are available at:
- Production: `https://ai-investment-trading-cycle-production.workers.dev/api/crypto/*`
- Staging: `https://ai-investment-trading-cycle-staging.workers.dev/api/crypto/*` (if configured)

---

## Future Enhancements

- API authentication (API keys)
- Rate limiting per client
- WebSocket support for real-time updates
- Advanced filtering and search
- Historical data export
- Advanced analytics (Sharpe ratio, Sortino ratio, etc.)
