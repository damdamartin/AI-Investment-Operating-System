# Performance Measurement API Documentation

## Overview

The Performance Measurement API provides REST endpoints for tracking and analyzing trading performance metrics across the KIS and TOSS brokers. All endpoints return JSON responses with consistent formatting.

**Base URL**: `https://ai-investment-trading-cycle-production.junkim-life360.workers.dev`

## Response Format

All responses follow this structure:

```json
{
  "status": "success" | "error",
  "data": { /* endpoint-specific data */ },
  "error": "error message (if status is error)",
  "timestamp": "2026-08-01T12:00:00.000Z"
}
```

## Endpoints

### 1. Get Today's Performance

**Endpoint**: `GET /api/performance/today`

**Parameters**:
- `broker` (string, optional): `KIS` or `TOSS` (default: `KIS`)

**Response**:
```json
{
  "status": "success",
  "data": {
    "date": "2026-08-01",
    "broker": "KIS",
    "trades": 5,
    "winRate": "60.00%",
    "totalPnL": "₩150,000",
    "totalPnLPercent": "1.50%",
    "avgWin": "₩75,000",
    "avgLoss": "₩25,000",
    "maxDrawdown": "2.50%",
    "sharpeRatio": "1.80"
  },
  "timestamp": "2026-08-01T12:00:00.000Z"
}
```

**Example Requests**:
```bash
# KIS today's performance
curl "https://api.example.com/api/performance/today?broker=KIS"

# TOSS today's performance
curl "https://api.example.com/api/performance/today?broker=TOSS"
```

---

### 2. Get Monthly Performance

**Endpoint**: `GET /api/performance/monthly`

**Parameters**:
- `year` (number, optional): Year (default: current year)
- `month` (number, optional): Month 1-12 (default: current month)

**Response**:
```json
{
  "status": "success",
  "data": {
    "period": "2026-08",
    "kis": {
      "totalPnL": "₩500,000",
      "roiPercent": "5.00%",
      "winRate": "65.00%",
      "tradesCount": 20,
      "maxDrawdown": "3.50%",
      "sharpeRatio": "1.90"
    },
    "toss": {
      "totalPnL": "₩450,000",
      "roiPercent": "4.50%",
      "winRate": "60.00%",
      "tradesCount": 18,
      "maxDrawdown": "4.00%",
      "sharpeRatio": "1.70"
    }
  },
  "timestamp": "2026-08-01T12:00:00.000Z"
}
```

**Example Requests**:
```bash
# August 2026
curl "https://api.example.com/api/performance/monthly?year=2026&month=8"

# Current month
curl "https://api.example.com/api/performance/monthly"
```

---

### 3. Get Team Comparison (KIS vs TOSS)

**Endpoint**: `GET /api/performance/comparison`

**Parameters**:
- `date` (string, optional): Date in YYYY-MM-DD format (default: today)

**Response**:
```json
{
  "status": "success",
  "data": {
    "date": "2026-08-01",
    "kis": {
      "totalPnL": "₩150,000",
      "winRate": "60.00%",
      "sharpeRatio": 1.8,
      "totalTrades": 5,
      "maxDrawdown": "2.50%"
    },
    "toss": {
      "totalPnL": "₩120,000",
      "winRate": "55.00%",
      "sharpeRatio": 1.6,
      "totalTrades": 4,
      "maxDrawdown": "3.00%"
    },
    "winner": "KIS",
    "winnerScore": "1.80"
  },
  "timestamp": "2026-08-01T12:00:00.000Z"
}
```

**Example Requests**:
```bash
# Today's comparison
curl "https://api.example.com/api/performance/comparison"

# Specific date comparison
curl "https://api.example.com/api/performance/comparison?date=2026-08-01"
```

---

### 4. Get Symbol Performance

**Endpoint**: `GET /api/performance/symbol/:symbol`

**Path Parameters**:
- `symbol` (string, required): Stock symbol (e.g., `005930` for Samsung)

**Response**:
```json
{
  "status": "success",
  "data": {
    "symbol": "005930",
    "kis": {
      "totalTrades": 10,
      "winRate": "70.00%",
      "avgWin": "₩50,000",
      "avgLoss": "₩15,000",
      "totalPnL": "₩275,000",
      "roiPercent": "2.75%"
    },
    "toss": {
      "totalTrades": 8,
      "winRate": "65.00%",
      "avgWin": "₩45,000",
      "avgLoss": "₩18,000",
      "totalPnL": "₩236,000",
      "roiPercent": "2.36%"
    },
    "totalTrades": 18
  },
  "timestamp": "2026-08-01T12:00:00.000Z"
}
```

**Example Requests**:
```bash
# Samsung (005930)
curl "https://api.example.com/api/performance/symbol/005930"

# SK Hynix (000660)
curl "https://api.example.com/api/performance/symbol/000660"
```

---

### 5. Get Top Performing Symbols

**Endpoint**: `GET /api/performance/top-symbols`

**Parameters**:
- `limit` (number, optional): Number of symbols to return (1-100, default: 5)
- `broker` (string, optional): `KIS` or `TOSS` (default: `KIS`)

**Response**:
```json
{
  "status": "success",
  "data": {
    "broker": "KIS",
    "limit": 5,
    "count": 2,
    "top": [
      {
        "symbol": "005930",
        "totalPnL": "₩275,000",
        "winRate": "70.00%",
        "trades": 10,
        "roiPercent": "2.75%"
      },
      {
        "symbol": "000660",
        "totalPnL": "₩160,000",
        "winRate": "62.50%",
        "trades": 8,
        "roiPercent": "1.60%"
      }
    ]
  },
  "timestamp": "2026-08-01T12:00:00.000Z"
}
```

**Example Requests**:
```bash
# Top 5 symbols for KIS
curl "https://api.example.com/api/performance/top-symbols?limit=5&broker=KIS"

# Top 10 symbols for TOSS
curl "https://api.example.com/api/performance/top-symbols?limit=10&broker=TOSS"
```

---

### 6. Get Worst Performing Symbols

**Endpoint**: `GET /api/performance/worst-symbols`

**Parameters**:
- `limit` (number, optional): Number of symbols to return (1-100, default: 5)
- `broker` (string, optional): `KIS` or `TOSS` (default: `KIS`)

**Response**:
```json
{
  "status": "success",
  "data": {
    "broker": "KIS",
    "limit": 5,
    "count": 1,
    "worst": [
      {
        "symbol": "005380",
        "totalPnL": "₩-100,000",
        "winRate": "20.00%",
        "trades": 5,
        "roiPercent": "-1.00%"
      }
    ]
  },
  "timestamp": "2026-08-01T12:00:00.000Z"
}
```

**Example Requests**:
```bash
# Worst 5 symbols for KIS
curl "https://api.example.com/api/performance/worst-symbols?limit=5&broker=KIS"

# Worst 3 symbols for TOSS
curl "https://api.example.com/api/performance/worst-symbols?limit=3&broker=TOSS"
```

---

### 7. Get Daily Performance Range

**Endpoint**: `GET /api/performance/range`

**Parameters**:
- `start` (string, required): Start date in YYYY-MM-DD format
- `end` (string, required): End date in YYYY-MM-DD format
- `broker` (string, optional): `KIS` or `TOSS` (default: `KIS`)

**Response**:
```json
{
  "status": "success",
  "data": {
    "broker": "KIS",
    "range": {
      "start": "2026-08-01",
      "end": "2026-08-03"
    },
    "count": 3,
    "days": [
      {
        "date": "2026-08-01",
        "trades": 5,
        "winRate": "60.00%",
        "totalPnL": "₩150,000",
        "totalPnLPercent": "1.50%",
        "sharpeRatio": "1.80"
      },
      {
        "date": "2026-08-02",
        "trades": 4,
        "winRate": "75.00%",
        "totalPnL": "₩200,000",
        "totalPnLPercent": "2.00%",
        "sharpeRatio": "2.10"
      },
      {
        "date": "2026-08-03",
        "trades": 3,
        "winRate": "50.00%",
        "totalPnL": "₩50,000",
        "totalPnLPercent": "0.50%",
        "sharpeRatio": "1.20"
      }
    ]
  },
  "timestamp": "2026-08-01T12:00:00.000Z"
}
```

**Example Requests**:
```bash
# KIS performance for August 1-31, 2026
curl "https://api.example.com/api/performance/range?start=2026-08-01&end=2026-08-31&broker=KIS"

# TOSS performance for a week
curl "https://api.example.com/api/performance/range?start=2026-08-01&end=2026-08-07&broker=TOSS"
```

---

## Error Responses

### 404 Not Found
```json
{
  "status": "error",
  "error": "No performance data found for symbol: UNKNOWN",
  "timestamp": "2026-08-01T12:00:00.000Z"
}
```

### 400 Bad Request
```json
{
  "status": "error",
  "error": "Invalid date format. Use YYYY-MM-DD",
  "timestamp": "2026-08-01T12:00:00.000Z"
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "error": "Failed to fetch today's performance: Database connection error",
  "timestamp": "2026-08-01T12:00:00.000Z"
}
```

---

## Response Headers

All responses include CORS headers for cross-origin requests:

```
Content-Type: application/json; charset=utf-8
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

---

## Number Formatting

### Currency (KRW)
- Formatted with currency symbol: `₩150,000`
- Thousands separated with commas
- No decimal places for KRW values

### Percentages
- Always 2 decimal places: `60.00%`
- Range: 0.00% to 100.00%

### Sharpe Ratio
- 2 decimal places: `1.80`
- Can be negative

### Dates
- ISO 8601 format: `2026-08-01T12:00:00.000Z`

---

## Rate Limiting

Currently no rate limits are implemented. Future versions may include:
- 100 requests per minute per IP
- Burst limits: 10 requests per second

---

## Usage Examples

### JavaScript/Node.js

```javascript
// Get today's KIS performance
const response = await fetch(
  'https://api.example.com/api/performance/today?broker=KIS'
);
const data = await response.json();
console.log(`Win Rate: ${data.data.winRate}`);
console.log(`Total P&L: ${data.data.totalPnL}`);

// Get monthly comparison
const monthlyResponse = await fetch(
  'https://api.example.com/api/performance/monthly?year=2026&month=8'
);
const monthlyData = await monthlyResponse.json();
console.log(`KIS Monthly ROI: ${monthlyData.data.kis.roiPercent}`);
```

### Python

```python
import requests
from datetime import date

# Get team comparison
response = requests.get(
    'https://api.example.com/api/performance/comparison',
    params={'date': '2026-08-01'}
)
data = response.json()
winner = data['data']['winner']
print(f"Winner: {winner}")

# Get top symbols
response = requests.get(
    'https://api.example.com/api/performance/top-symbols',
    params={'limit': 10, 'broker': 'KIS'}
)
symbols = response.json()['data']['top']
for symbol in symbols:
    print(f"{symbol['symbol']}: {symbol['totalPnL']}")
```

### cURL

```bash
# Get today's performance
curl -s "https://api.example.com/api/performance/today?broker=KIS" | jq '.data'

# Get top 5 symbols
curl -s "https://api.example.com/api/performance/top-symbols?limit=5" | jq '.data.top'

# Get range data for charting
curl -s "https://api.example.com/api/performance/range?start=2026-08-01&end=2026-08-31&broker=KIS" \
  | jq '.data.days[] | {date, trades, totalPnL}'
```

---

## Testing Checklist

- [x] Endpoint: GET /api/performance/today
  - [x] Response for KIS broker
  - [x] Response for TOSS broker
  - [x] Formatted currency (₩)
  - [x] Formatted percentages (2 decimals)
  - [x] Missing data handling

- [x] Endpoint: GET /api/performance/monthly
  - [x] Valid year/month parameters
  - [x] Default to current month
  - [x] Both brokers in response
  - [x] Missing data handling

- [x] Endpoint: GET /api/performance/comparison
  - [x] KIS vs TOSS comparison
  - [x] Winner determination (by Sharpe ratio)
  - [x] Custom date parameter

- [x] Endpoint: GET /api/performance/symbol/:symbol
  - [x] Valid symbol response
  - [x] 404 for unknown symbol
  - [x] Both brokers data
  - [x] Proper formatting

- [x] Endpoint: GET /api/performance/top-symbols
  - [x] Limit parameter validation
  - [x] Broker parameter support
  - [x] Default limit (5)
  - [x] Max limit (100)

- [x] Endpoint: GET /api/performance/worst-symbols
  - [x] Limit parameter validation
  - [x] Broker parameter support
  - [x] Proper sorting (ascending by P&L)

- [x] Endpoint: GET /api/performance/range
  - [x] Date format validation (YYYY-MM-DD)
  - [x] Start/end date parameters
  - [x] Broker parameter support
  - [x] Empty range handling

- [x] Response Format
  - [x] Consistent status field
  - [x] Timestamp in ISO 8601
  - [x] Error messages
  - [x] CORS headers
  - [x] Content-Type header

---

## Version History

### v1.0 (2026-08-01)
- Initial release with 7 performance endpoints
- Support for KIS and TOSS brokers
- Currency formatting and percentage formatting
- Daily, monthly, and symbol-level performance tracking
