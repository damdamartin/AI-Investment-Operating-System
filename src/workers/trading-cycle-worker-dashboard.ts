/**
 * AI Trading Dashboard - Crypto Tab Redesign
 * Displays real-time trading data with proper structure
 * Cache busting with timestamps
 */

export function getDashboardHTML(): string {
  // Timestamp for cache busting
  const timestamp = Date.now();

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🤖 Multi-Asset Trading Dashboard</title>
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%);
      color: #e0e0e0;
      padding: 20px;
    }

    .container { max-width: 1800px; margin: 0 auto; }

    header {
      margin-bottom: 30px;
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 2px solid #333;
    }
    h1 {
      font-size: 36px;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #3b82f6, #10b981);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .header-subtitle {
      color: #888;
      font-size: 14px;
      margin-top: 8px;
    }
    .last-update {
      font-size: 11px;
      color: #666;
      margin-top: 8px;
    }

    /* Tab Navigation */
    .tab-navigation {
      display: flex;
      gap: 5px;
      margin-bottom: 30px;
      border-bottom: 2px solid #333;
      overflow-x: auto;
      padding-bottom: 0;
    }
    .tab-button {
      padding: 14px 24px;
      background: transparent;
      border: none;
      color: #888;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border-bottom: 3px solid transparent;
      transition: all 0.3s;
      white-space: nowrap;
    }
    .tab-button:hover {
      color: #e0e0e0;
    }
    .tab-button.active {
      color: #3b82f6;
      border-bottom-color: #3b82f6;
    }

    .tab-content {
      display: none;
      animation: fadeIn 0.3s ease-in;
    }
    .tab-content.active {
      display: block;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Grid Layouts */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }

    @media (max-width: 1400px) {
      .grid-3 { grid-template-columns: repeat(2, 1fr); }
      .grid-4 { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 768px) {
      .grid-2 { grid-template-columns: 1fr; }
      .grid-3 { grid-template-columns: 1fr; }
      .grid-4 { grid-template-columns: 1fr; }
    }

    /* Panels & Cards */
    .panel {
      background: rgba(255,255,255, 0.02);
      border: 1px solid #444;
      border-radius: 10px;
      padding: 24px;
      backdrop-filter: blur(10px);
    }

    .card-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #555;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* Metrics Grid */
    .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .metric-box {
      background: rgba(255,255,255, 0.03);
      border: 1px solid #333;
      border-radius: 8px;
      padding: 14px;
    }
    .metric-label {
      font-size: 11px;
      color: #888;
      text-transform: uppercase;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
    .metric-value {
      font-size: 20px;
      font-weight: bold;
      color: #e0e0e0;
    }
    .metric-unit {
      font-size: 12px;
      color: #666;
      margin-left: 4px;
    }
    .positive { color: #10b981; }
    .negative { color: #ef4444; }
    .neutral { color: #f59e0b; }

    /* Status Indicators */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: rgba(255,255,255, 0.05);
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    .status-online { background: #10b981; }
    .status-offline { background: #ef4444; }
    .status-warning { background: #f59e0b; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-top: 12px;
    }
    th {
      background: rgba(0,0,0, 0.3);
      padding: 10px;
      text-align: left;
      font-weight: 600;
      color: #aaa;
      border-bottom: 2px solid #333;
    }
    td {
      padding: 10px;
      border-bottom: 1px solid #222;
    }
    tr:hover { background: rgba(255,255,255, 0.02); }

    .empty-state {
      text-align: center;
      color: #666;
      padding: 40px 20px;
      font-size: 13px;
    }

    /* Chart / Progress */
    .progress-bar {
      width: 100%;
      height: 6px;
      background: rgba(255,255,255, 0.05);
      border-radius: 3px;
      overflow: hidden;
      margin: 8px 0;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #10b981);
      width: 60%;
    }

    /* Crypto Submenu */
    .crypto-submenu {
      display: flex;
      gap: 10px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .submenu-btn {
      padding: 10px 16px;
      background: rgba(255,255,255, 0.05);
      border: 1px solid #333;
      color: #888;
      font-size: 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.3s;
      font-weight: 500;
    }
    .submenu-btn:hover {
      background: rgba(255,255,255, 0.1);
      color: #e0e0e0;
      border-color: #555;
    }
    .submenu-btn.active {
      background: rgba(59, 130, 246, 0.2);
      color: #3b82f6;
      border-color: #3b82f6;
    }

    .crypto-view {
      display: none;
    }
    .crypto-view.active {
      display: block;
    }

    /* Stocks Team Panel */
    .team-panel {
      background: rgba(255,255,255, 0.02);
      border: 1px solid #444;
      border-radius: 10px;
      padding: 24px;
    }
    .team-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #555;
    }
    .team-name {
      font-size: 20px;
      font-weight: bold;
    }
    .team-badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-kis {
      background: rgba(59, 130, 246, 0.2);
      color: #3b82f6;
    }
    .badge-toss {
      background: rgba(168, 85, 247, 0.2);
      color: #a855f7;
    }

    /* Section */
    .section {
      background: rgba(255,255,255, 0.02);
      border: 1px solid #333;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 12px;
    }
    .section-title {
      font-size: 12px;
      color: #aaa;
      text-transform: uppercase;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #333;
      letter-spacing: 0.5px;
    }

    .update-time {
      font-size: 11px;
      color: #888;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #222;
    }

    /* Input Group */
    .input-group {
      margin: 14px 0;
      display: flex;
      gap: 10px;
    }
    .input-group input {
      flex: 1;
      padding: 10px 12px;
      background: rgba(255,255,255, 0.05);
      border: 1px solid #333;
      color: #e0e0e0;
      border-radius: 6px;
      font-size: 12px;
    }
    .input-group button {
      padding: 10px 16px;
      background: #3b82f6;
      border: none;
      color: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.3s;
    }
    .input-group button:hover {
      background: #2563eb;
    }

    /* Big Value Display */
    .value-large {
      font-size: 48px;
      font-weight: bold;
      margin: 20px 0;
      line-height: 1;
    }

    /* Alert Box */
    .alert {
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 12px;
      font-size: 12px;
    }
    .alert-info {
      background: rgba(59, 130, 246, 0.1);
      border-left: 3px solid #3b82f6;
      color: #e0e0e0;
    }
    .alert-warning {
      background: rgba(245, 158, 11, 0.1);
      border-left: 3px solid #f59e0b;
      color: #fbbf24;
    }
    .alert-danger {
      background: rgba(239, 68, 68, 0.1);
      border-left: 3px solid #ef4444;
      color: #fca5a5;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🤖 Multi-Asset Trading Dashboard</h1>
      <div class="header-subtitle">
        Live tracking: Stocks (한국/미국) + Crypto (Upbit)
      </div>
      <div class="last-update">
        Last update: <span id="last-update">--:--:--</span>
      </div>
    </header>

    <!-- Main Tab Navigation -->
    <div class="tab-navigation">
      <button class="tab-button active" onclick="switchTab('dashboard')">📊 Dashboard</button>
      <button class="tab-button" onclick="switchTab('stocks')">📈 Stocks</button>
      <button class="tab-button" onclick="switchTab('crypto')">🪙 Crypto</button>
      <button class="tab-button" onclick="switchTab('settings')">⚙️ Settings</button>
    </div>

    <!-- ===== DASHBOARD TAB (Market Status + Trading Strategy) ===== -->
    <div id="dashboard" class="tab-content active">
      <!-- Market Status & Trading Strategy Section -->
      <div style="margin-bottom: 24px;">
        <div style="margin-bottom: 14px; font-size: 18px; font-weight: 600; color: #e0e0e0;">📊 오늘의 시장현황 & 매매전략</div>
        <div class="grid-2">
          <!-- Market Status Card -->
          <div class="panel">
            <div class="card-title">📈 시장현황</div>
            <div style="font-size: 12px; line-height: 1.8;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px; background: rgba(255,255,255, 0.02); border-radius: 4px;">
                <span style="color: #888;">KOSPI 지수</span>
                <span style="color: #10b981; font-weight: 600;">2,520 (+1.2%)</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px; background: rgba(255,255,255, 0.02); border-radius: 4px;">
                <span style="color: #888;">시장 심리</span>
                <span style="color: #10b981; font-weight: 600;">강세 ▲</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px; background: rgba(255,255,255, 0.02); border-radius: 4px;">
                <span style="color: #888;">원/달러</span>
                <span style="color: #ef4444; font-weight: 600;">1,140원 (약세)</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px; background: rgba(255,255,255, 0.02); border-radius: 4px;">
                <span style="color: #888;">외국인</span>
                <span style="color: #10b981; font-weight: 600;">순매수 1,500억원</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px; background: rgba(255,255,255, 0.02); border-radius: 4px;">
                <span style="color: #888;">기관</span>
                <span style="color: #ef4444; font-weight: 600;">순매도 800억원</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px; background: rgba(255,255,255, 0.02); border-radius: 4px;">
                <span style="color: #888;">개인</span>
                <span style="color: #ef4444; font-weight: 600;">순매도 700억원</span>
              </div>
              <div style="margin-top: 12px; padding: 10px; background: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6; border-radius: 4px; font-size: 11px; color: #aaa;">
                <strong style="color: #e0e0e0;">주요뉴스:</strong><br>삼성전자 사상 최대 실적 • 반도체 수급 심화
              </div>
            </div>
          </div>

          <!-- Trading Strategy Card -->
          <div class="panel">
            <div class="card-title">🎯 오늘의 매매전략</div>
            <div style="font-size: 12px; line-height: 1.8; color: #d0d0d0;">
              <div style="margin-bottom: 14px;">
                <strong style="color: #3b82f6;">📊 시장 분석</strong><br>
                <span style="color: #aaa;">외국인이 순매수 중인 강세장입니다.<br>KOSPI +1.2% 상승으로 긍정적 흐름 유지 중</span>
              </div>
              <div style="margin-bottom: 14px;">
                <strong style="color: #3b82f6;">🎯 거래 전략</strong><br>
                <span style="color: #aaa;">• 한국주식: 보수적 (-2% 한도)<br>
                • 미국주식: 적극 (-5% ~ +10%)<br>
                • 주력: 반도체·IT 중심</span>
              </div>
              <div style="padding: 10px; background: rgba(245, 158, 11, 0.1); border-left: 3px solid #f59e0b; border-radius: 4px; font-size: 11px;">
                <strong style="color: #fbbf24;">⚠️ 주의사항</strong><br>
                <span style="color: #aaa;">원화약세 지속, 기관/개인 순매도 모니터링</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Team Performance Summary -->
      <div style="margin-bottom: 24px;">
        <div style="margin-bottom: 14px; font-size: 18px; font-weight: 600; color: #e0e0e0;">💰 팀 포트폴리오 현황</div>
        <div class="grid-2">
          <!-- KIS Team Summary -->
          <div class="team-panel">
            <div class="team-header">
              <span class="status-badge">
                <span class="status-dot status-online"></span>
                <span>KIS Team</span>
              </span>
              <span class="team-badge badge-kis">한국투자증권</span>
            </div>
            <div class="metrics-grid">
              <div class="metric-box">
                <div class="metric-label">Portfolio (KRW)</div>
                <div class="metric-value" id="kis-summary-krw">₩7M</div>
              </div>
              <div class="metric-box">
                <div class="metric-label">Portfolio (USD)</div>
                <div class="metric-value" id="kis-summary-usd">$2.3K</div>
              </div>
              <div class="metric-box">
                <div class="metric-label">Today P&L</div>
                <div class="metric-value" id="kis-summary-pnl">₩0</div>
              </div>
              <div class="metric-box">
                <div class="metric-label">Positions</div>
                <div class="metric-value" id="kis-summary-pos">0</div>
              </div>
            </div>
          </div>

          <!-- Toss Team Summary -->
          <div class="team-panel">
            <div class="team-header">
              <span class="status-badge">
                <span class="status-dot status-online"></span>
                <span>Toss Team</span>
              </span>
              <span class="team-badge badge-toss">토스증권</span>
            </div>
            <div class="metrics-grid">
              <div class="metric-box">
                <div class="metric-label">Portfolio</div>
                <div class="metric-value" id="toss-summary-portfolio">₩10M</div>
              </div>
              <div class="metric-box">
                <div class="metric-label">Today P&L</div>
                <div class="metric-value" id="toss-summary-pnl">₩0</div>
              </div>
              <div class="metric-box">
                <div class="metric-label">Positions</div>
                <div class="metric-value" id="toss-summary-pos">0</div>
              </div>
              <div class="metric-box">
                <div class="metric-label">Cash</div>
                <div class="metric-value" id="toss-summary-cash">₩10M</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== STOCKS TAB ===== -->
    <div id="stocks" class="tab-content">
      <div style="margin-bottom: 20px;">
        <div class="alert alert-info">
          <strong>🔴 Real-time Trading Log</strong> • Stocks: KIS + Toss Teams
        </div>
      </div>

      <div class="grid-2">
        <!-- KIS Team Panel -->
        <div class="team-panel">
          <div class="team-header">
            <span class="status-badge">
              <span class="status-dot status-online" id="kis-status"></span>
              <span>KIS Team</span>
            </span>
            <span class="team-badge badge-kis">한국투자증권</span>
          </div>

          <div class="metrics-grid">
            <div class="metric-box">
              <div class="metric-label">Portfolio (KRW)</div>
              <div class="metric-value" id="kis-portfolio-krw">₩7M</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Portfolio (USD)</div>
              <div class="metric-value" id="kis-portfolio-usd">$2.3K</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Positions</div>
              <div class="metric-value" id="kis-positions">0</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">P&L</div>
              <div class="metric-value" id="kis-pnl">₩0</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">📊 Active Positions</div>
            <div id="kis-positions-table">
              <div class="empty-state">No positions</div>
            </div>
          </div>

          <div class="update-time">Updated: <span id="kis-time">--:--:--</span></div>
        </div>

        <!-- Toss Team Panel -->
        <div class="team-panel">
          <div class="team-header">
            <span class="status-badge">
              <span class="status-dot status-online" id="toss-status"></span>
              <span>Toss Team</span>
            </span>
            <span class="team-badge badge-toss">토스증권</span>
          </div>

          <div class="metrics-grid">
            <div class="metric-box">
              <div class="metric-label">Portfolio</div>
              <div class="metric-value" id="toss-portfolio">₩10M</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Positions</div>
              <div class="metric-value" id="toss-positions">0</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">P&L</div>
              <div class="metric-value" id="toss-pnl">₩0</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Cash</div>
              <div class="metric-value" id="toss-cash">₩10M</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">📊 Active Positions</div>
            <div id="toss-positions-table">
              <div class="empty-state">No positions</div>
            </div>
          </div>

          <div class="update-time">Updated: <span id="toss-time">--:--:--</span></div>
        </div>
      </div>
    </div>

    <!-- ===== CRYPTO TAB ===== -->
    <div id="crypto" class="tab-content">
      <div class="alert alert-info">
        🪙 <strong>Upbit Crypto Trading System</strong> • Real-time WebSocket • Auto-trading enabled
      </div>

      <!-- Crypto Submenu -->
      <div class="crypto-submenu">
        <button class="submenu-btn active" onclick="switchCryptoView('dashboard')">📊 Dashboard</button>
        <button class="submenu-btn" onclick="switchCryptoView('portfolio')">💼 Portfolio</button>
        <button class="submenu-btn" onclick="switchCryptoView('positions')">📈 Active Positions</button>
        <button class="submenu-btn" onclick="switchCryptoView('trades')">📋 Trade History</button>
        <button class="submenu-btn" onclick="switchCryptoView('signals')">🎯 Signal Status</button>
        <button class="submenu-btn" onclick="switchCryptoView('market')">📊 Market Status</button>
        <button class="submenu-btn" onclick="switchCryptoView('performance')">📈 Performance</button>
        <button class="submenu-btn" onclick="switchCryptoView('settings')">⚙️ Settings</button>
      </div>

      <!-- 1. Dashboard View -->
      <div id="crypto-dashboard" class="crypto-view active">
        <div class="grid-3">
          <!-- Portfolio Overview -->
          <div class="panel">
            <div class="card-title">💼 Portfolio Status</div>
            <div style="padding: 12px 0;">
              <div style="margin-bottom: 16px;">
                <div class="metric-label">Total Assets</div>
                <div class="value-large positive" id="crypto-total-assets">₩7.5M</div>
              </div>
              <div style="margin-bottom: 16px;">
                <div class="metric-label">Today's P&L</div>
                <div class="value-large" id="crypto-today-pnl">+₩123K</div>
              </div>
              <div>
                <div class="metric-label">Cumulative Return</div>
                <div style="font-size: 24px; font-weight: bold; color: #10b981;" id="crypto-total-return">+18.5%</div>
              </div>
            </div>
          </div>

          <!-- Market Status -->
          <div class="panel">
            <div class="card-title">📊 Market Status</div>
            <div style="padding: 12px 0; font-size: 12px;">
              <div style="margin-bottom: 12px; padding: 8px; background: rgba(255,255,255, 0.02); border-radius: 4px;">
                <div style="color: #888; margin-bottom: 4px;">Market Condition</div>
                <div style="font-weight: bold; font-size: 16px;" id="crypto-market-condition">UPTREND</div>
              </div>
              <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span style="color: #888;">Volatility</span>
                  <span id="crypto-volatility">12.3%</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width: 45%;"></div></div>
              </div>
              <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span style="color: #888;">Trading Volume (24h)</span>
                  <span id="crypto-volume">45.2B</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width: 72%;"></div></div>
              </div>
            </div>
          </div>

          <!-- Risk Settings -->
          <div class="panel">
            <div class="card-title">⚡ Risk Management</div>
            <div style="padding: 12px 0; font-size: 12px;">
              <div style="margin-bottom: 14px;">
                <div style="color: #888; margin-bottom: 4px;">Daily Loss Limit</div>
                <div style="font-weight: bold; font-size: 16px;">-2.0% (-₩150K)</div>
              </div>
              <div style="margin-bottom: 14px;">
                <div style="color: #888; margin-bottom: 4px;">Max Positions</div>
                <div style="font-weight: bold;">2 / 5</div>
              </div>
              <div>
                <div style="color: #888; margin-bottom: 4px;">Position Size</div>
                <div style="font-weight: bold;">20%</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Price Table -->
        <div class="panel" style="margin-top: 20px;">
          <div class="card-title">📈 Real-time Prices</div>
          <div id="crypto-prices-table">
            <table>
              <tr>
                <th>Market</th>
                <th>Price</th>
                <th>Change</th>
                <th>Volume (24h)</th>
                <th>Signal</th>
                <th>Confidence</th>
              </tr>
              <tr>
                <td><strong>BTC</strong></td>
                <td id="btc-price">42.1M</td>
                <td id="btc-change" class="positive">+2.1%</td>
                <td>5.2K</td>
                <td id="btc-signal" style="color: #10b981; font-weight: bold;">BUY</td>
                <td><div class="progress-bar" style="width: 100px; margin: 0;"><div class="progress-fill" style="width: 85%;"></div></div>85%</td>
              </tr>
              <tr>
                <td><strong>ETH</strong></td>
                <td id="eth-price">2.8M</td>
                <td id="eth-change" class="negative">-0.8%</td>
                <td>28K</td>
                <td id="eth-signal" style="color: #ef4444; font-weight: bold;">SELL</td>
                <td><div class="progress-bar" style="width: 100px; margin: 0;"><div class="progress-fill" style="width: 62%;"></div></div>62%</td>
              </tr>
              <tr>
                <td><strong>SOL</strong></td>
                <td id="sol-price">135K</td>
                <td id="sol-change" class="positive">+0.3%</td>
                <td>125K</td>
                <td id="sol-signal" style="color: #f59e0b; font-weight: bold;">HOLD</td>
                <td><div class="progress-bar" style="width: 100px; margin: 0;"><div class="progress-fill" style="width: 40%;"></div></div>40%</td>
              </tr>
            </table>
          </div>
        </div>
      </div>

      <!-- 2. Portfolio View -->
      <div id="crypto-portfolio" class="crypto-view">
        <div class="panel">
          <div class="card-title">💰 Asset Allocation</div>
          <div style="padding: 20px 0;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
              <div style="text-align: center; padding: 12px; background: rgba(255,255,255, 0.02); border-radius: 8px;">
                <div style="color: #888; margin-bottom: 4px; font-size: 12px;">Cash</div>
                <div style="font-size: 24px; font-weight: bold;">₩2.5M</div>
                <div style="color: #888; font-size: 11px; margin-top: 4px;">33%</div>
              </div>
              <div style="text-align: center; padding: 12px; background: rgba(255,255,255, 0.02); border-radius: 8px;">
                <div style="color: #888; margin-bottom: 4px; font-size: 12px;">Crypto Assets</div>
                <div style="font-size: 24px; font-weight: bold;">₩5.0M</div>
                <div style="color: #888; font-size: 11px; margin-top: 4px;">67%</div>
              </div>
            </div>

            <table>
              <tr>
                <th>Asset</th>
                <th>Quantity</th>
                <th>Avg. Entry</th>
                <th>Current</th>
                <th>Eval Value</th>
                <th>Gain/Loss</th>
                <th>Return %</th>
              </tr>
              <tr>
                <td><strong>BTC</strong></td>
                <td>0.1</td>
                <td>40.2M</td>
                <td>42.1M</td>
                <td>4.21M</td>
                <td class="positive">+190K</td>
                <td class="positive">+4.7%</td>
              </tr>
              <tr>
                <td><strong>ETH</strong></td>
                <td>0.5</td>
                <td>2.9M</td>
                <td>2.8M</td>
                <td>1.4M</td>
                <td class="negative">-50K</td>
                <td class="negative">-1.7%</td>
              </tr>
              <tr>
                <td><strong>SOL</strong></td>
                <td>2.0</td>
                <td>140K</td>
                <td>135K</td>
                <td>270K</td>
                <td class="negative">-10K</td>
                <td class="negative">-3.6%</td>
              </tr>
            </table>
          </div>
        </div>
      </div>

      <!-- 3. Active Positions View -->
      <div id="crypto-positions" class="crypto-view">
        <div class="panel">
          <div class="card-title">📈 Active Positions</div>
          <table>
            <tr>
              <th>Market</th>
              <th>Entry Price</th>
              <th>Current Price</th>
              <th>Quantity</th>
              <th>Return %</th>
              <th>Holding Time</th>
              <th>TP Price</th>
              <th>SL Price</th>
            </tr>
            <tr>
              <td><strong>BTC</strong></td>
              <td>40.2M</td>
              <td>42.1M</td>
              <td>0.1</td>
              <td class="positive">+4.7%</td>
              <td>2h 15m</td>
              <td>42.2M</td>
              <td>39.4M</td>
            </tr>
            <tr>
              <td><strong>ETH</strong></td>
              <td>2.9M</td>
              <td>2.8M</td>
              <td>0.5</td>
              <td class="negative">-1.7%</td>
              <td>5h 30m</td>
              <td>3.05M</td>
              <td>2.76M</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- 4. Trade History View -->
      <div id="crypto-trades" class="crypto-view">
        <div class="panel">
          <div class="card-title">📋 Recent Trade History (Last 10)</div>
          <table>
            <tr>
              <th>Time</th>
              <th>Market</th>
              <th>Direction</th>
              <th>Price</th>
              <th>Qty</th>
              <th>Status</th>
              <th>Return %</th>
              <th>Holding</th>
            </tr>
            <tr>
              <td>14:32</td>
              <td><strong>BTC</strong></td>
              <td style="color: #10b981; font-weight: bold;">BUY</td>
              <td>42.0M</td>
              <td>0.05</td>
              <td><span class="status-badge"><span class="status-dot status-online"></span>FILLED</span></td>
              <td class="positive">+2.4%</td>
              <td>32m</td>
            </tr>
            <tr>
              <td>14:28</td>
              <td><strong>ETH</strong></td>
              <td style="color: #ef4444; font-weight: bold;">SELL</td>
              <td>2.8M</td>
              <td>0.25</td>
              <td><span class="status-badge"><span class="status-dot status-online"></span>FILLED</span></td>
              <td class="negative">-0.8%</td>
              <td>1h 20m</td>
            </tr>
            <tr>
              <td>14:15</td>
              <td><strong>SOL</strong></td>
              <td style="color: #10b981; font-weight: bold;">BUY</td>
              <td>135K</td>
              <td>2.00</td>
              <td><span class="status-badge"><span class="status-dot status-online"></span>FILLED</span></td>
              <td class="negative">-3.6%</td>
              <td>5h 30m</td>
            </tr>
            <tr>
              <td>13:45</td>
              <td><strong>BTC</strong></td>
              <td style="color: #ef4444; font-weight: bold;">SELL</td>
              <td>41.8M</td>
              <td>0.05</td>
              <td><span class="status-badge"><span class="status-dot status-online"></span>FILLED</span></td>
              <td class="positive">+1.2%</td>
              <td>45m</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- 5. Signal Status View -->
      <div id="crypto-signals" class="crypto-view">
        <div class="grid-3">
          <!-- Active Signals -->
          <div class="panel">
            <div class="card-title">🔄 Active Signals</div>
            <table style="font-size: 11px;">
              <tr>
                <th>Market</th>
                <th>Signal</th>
                <th>Confidence</th>
                <th>Age</th>
              </tr>
              <tr>
                <td><strong>BTC</strong></td>
                <td style="color: #10b981; font-weight: bold;">BUY</td>
                <td>85%</td>
                <td>2m</td>
              </tr>
              <tr>
                <td><strong>ETH</strong></td>
                <td style="color: #ef4444; font-weight: bold;">SELL</td>
                <td>62%</td>
                <td>5m</td>
              </tr>
            </table>
          </div>

          <!-- Pending Signals -->
          <div class="panel">
            <div class="card-title">⏳ Pending Signals</div>
            <table style="font-size: 11px;">
              <tr>
                <th>Market</th>
                <th>Signal</th>
                <th>Confidence</th>
                <th>Waiting</th>
              </tr>
              <tr>
                <td><strong>SOL</strong></td>
                <td style="color: #f59e0b; font-weight: bold;">HOLD</td>
                <td>40%</td>
                <td>8m</td>
              </tr>
              <tr>
                <td><strong>ADA</strong></td>
                <td style="color: #f59e0b; font-weight: bold;">WAIT</td>
                <td>35%</td>
                <td>12m</td>
              </tr>
            </table>
          </div>

          <!-- Signal Accuracy -->
          <div class="panel">
            <div class="card-title">📊 Signal Accuracy</div>
            <div style="padding: 12px 0; font-size: 12px;">
              <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span>Today</span>
                  <span style="font-weight: bold;">72%</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width: 72%;"></div></div>
              </div>
              <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span>This Week</span>
                  <span style="font-weight: bold;">68%</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width: 68%;"></div></div>
              </div>
              <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span>This Month</span>
                  <span style="font-weight: bold;">64.4%</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width: 64%;"></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 6. Market Status View -->
      <div id="crypto-market" class="crypto-view">
        <div class="panel">
          <div class="card-title">📊 Detailed Market Status</div>
          <table>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Change</th>
              <th>Status</th>
            </tr>
            <tr>
              <td>Market Trend</td>
              <td><strong>UPTREND</strong></td>
              <td class="positive">+2.3%</td>
              <td><span class="status-badge"><span class="status-dot status-online"></span>Active</span></td>
            </tr>
            <tr>
              <td>Volatility Index</td>
              <td>12.3%</td>
              <td class="neutral">+0.5%</td>
              <td>Normal</td>
            </tr>
            <tr>
              <td>Trading Volume (24h)</td>
              <td>45.2B KRW</td>
              <td class="positive">+8.1%</td>
              <td>High</td>
            </tr>
            <tr>
              <td>Market Cap Change</td>
              <td class="positive">+3.2%</td>
              <td></td>
              <td>Bullish</td>
            </tr>
            <tr>
              <td>Fear & Greed Index</td>
              <td><strong>62</strong></td>
              <td class="positive">+5</td>
              <td>Greed</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- 7. Performance View -->
      <div id="crypto-performance" class="crypto-view">
        <div class="grid-2">
          <!-- Profitability Metrics -->
          <div class="panel">
            <div class="card-title">💰 Profitability</div>
            <table style="font-size: 12px;">
              <tr>
                <td>Total Return</td>
                <td style="text-align: right; color: #10b981; font-weight: bold;">+18.5%</td>
              </tr>
              <tr>
                <td>Daily Return</td>
                <td style="text-align: right; color: #10b981; font-weight: bold;">+0.8%</td>
              </tr>
              <tr>
                <td>Monthly Return</td>
                <td style="text-align: right; color: #10b981; font-weight: bold;">+12.3%</td>
              </tr>
              <tr>
                <td>Average Trade Return</td>
                <td style="text-align: right; color: #10b981; font-weight: bold;">+0.41%</td>
              </tr>
            </table>
          </div>

          <!-- Risk Metrics -->
          <div class="panel">
            <div class="card-title">⚠️ Risk Analysis</div>
            <table style="font-size: 12px;">
              <tr>
                <td>Volatility</td>
                <td style="text-align: right; font-weight: bold;">12.3%</td>
              </tr>
              <tr>
                <td>Max Drawdown</td>
                <td style="text-align: right; color: #ef4444; font-weight: bold;">-8.2%</td>
              </tr>
              <tr>
                <td>Sharpe Ratio</td>
                <td style="text-align: right; color: #10b981; font-weight: bold;">1.87</td>
              </tr>
              <tr>
                <td>Info Ratio</td>
                <td style="text-align: right; color: #10b981; font-weight: bold;">1.42</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Trading Statistics -->
        <div class="panel" style="margin-top: 20px;">
          <div class="card-title">📊 Trading Statistics</div>
          <div class="grid-4">
            <div class="metric-box">
              <div class="metric-label">Total Trades</div>
              <div class="metric-value">45</div>
              <div style="font-size: 11px; color: #888; margin-top: 4px;">completed</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Win Rate</div>
              <div class="metric-value positive">64.4%</div>
              <div style="font-size: 11px; color: #888; margin-top: 4px;">29 wins / 16 losses</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Avg. Trade Time</div>
              <div class="metric-value">2.3h</div>
              <div style="font-size: 11px; color: #888; margin-top: 4px;">hold duration</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Profit Factor</div>
              <div class="metric-value positive">1.82</div>
              <div style="font-size: 11px; color: #888; margin-top: 4px;">gain/loss ratio</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 8. Settings View -->
      <div id="crypto-settings" class="crypto-view">
        <div class="grid-2">
          <!-- Risk Settings -->
          <div class="panel">
            <div class="card-title">⚡ Risk Settings</div>
            <div style="padding: 12px 0;">
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 6px;">Daily Loss Limit</label>
                <div class="input-group">
                  <input type="text" value="-2.0% [-150,000 KRW]" readonly>
                </div>
              </div>
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 6px;">Max Positions</label>
                <div class="input-group">
                  <input type="text" value="5">
                  <button>Update</button>
                </div>
              </div>
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 6px;">Position Size %</label>
                <div class="input-group">
                  <input type="text" value="20">
                  <button>Update</button>
                </div>
              </div>
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 6px;">Min Cash Reserve</label>
                <div class="input-group">
                  <input type="text" value="5% [₩375,000]" readonly>
                </div>
              </div>
            </div>
          </div>

          <!-- System Controls -->
          <div class="panel">
            <div class="card-title">🔧 System Control</div>
            <div style="padding: 12px 0; font-size: 12px;">
              <div style="margin-bottom: 14px; padding: 12px; background: rgba(255,255,255, 0.02); border-radius: 6px;">
                <div style="color: #888; margin-bottom: 4px;">Trading Status</div>
                <div style="font-weight: bold; color: #10b981;">🟢 RUNNING</div>
              </div>
              <div style="margin-bottom: 14px; padding: 12px; background: rgba(255,255,255, 0.02); border-radius: 6px;">
                <div style="color: #888; margin-bottom: 4px;">Signal Generation</div>
                <div style="font-weight: bold; color: #10b981;">🟢 ACTIVE</div>
              </div>
              <div style="margin-bottom: 14px; padding: 12px; background: rgba(255,255,255, 0.02); border-radius: 6px;">
                <div style="color: #888; margin-bottom: 4px;">Kill Switch</div>
                <div style="font-weight: bold; color: #ef4444;">🔴 OFF (Ready)</div>
              </div>
              <div style="display: flex; gap: 8px; margin-top: 14px;">
                <button style="flex: 1; padding: 10px; background: #10b981; border: none; color: white; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">Enable Kill Switch</button>
                <button style="flex: 1; padding: 10px; background: #6b7280; border: none; color: white; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">Pause Trading</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== SETTINGS TAB ===== -->
    <div id="settings" class="tab-content">
      <div class="panel">
        <div class="card-title">⚙️ System Settings</div>
        <div style="padding: 20px; color: #888; font-size: 12px;">
          <p style="margin-bottom: 12px;">Configure API keys, trading parameters, and alerts from here.</p>
          <button style="padding: 10px 16px; background: #3b82f6; border: none; color: white; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">Open Settings</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    // ============= CONSTANTS & GLOBALS =============
    const API_BASE = window.location.origin;
    const CACHE_BUST = '${timestamp}';

    // ============= UTILITY FUNCTIONS =============
    function formatCurrency(value, currency = 'KRW') {
      if (currency === 'USD') {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 2
        }).format(value);
      }
      return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 0
      }).format(value);
    }

    function updateLastUpdateTime() {
      const now = new Date();
      document.getElementById('last-update').textContent = now.toLocaleTimeString('ko-KR');
    }

    // ============= TAB NAVIGATION =============
    function switchTab(tabName) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));

      document.getElementById(tabName).classList.add('active');
      event.target.classList.add('active');
    }

    function switchCryptoView(viewName) {
      document.querySelectorAll('.crypto-view').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.submenu-btn').forEach(el => el.classList.remove('active'));

      document.getElementById('crypto-' + viewName).classList.add('active');
      event.target.classList.add('active');
    }

    // ============= DATA FETCHING =============
    async function fetchWithCacheBust(url) {
      try {
        const separator = url.includes('?') ? '&' : '?';
        const bustUrl = \`\${url}\${separator}t=\${CACHE_BUST}\`;
        const response = await fetch(bustUrl);
        if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
        return await response.json();
      } catch (error) {
        console.error('Fetch error:', error);
        return null;
      }
    }

    async function updateTeamData(teamName) {
      try {
        const data = await fetchWithCacheBust(\`\${API_BASE}/api/\${teamName}-status\`);
        if (!data) return;

        const prefix = teamName.toLowerCase();
        const status = document.getElementById(\`\${prefix}-status\`);
        const portfolio = data.portfolio || {};

        // Update status indicator
        if (status) {
          status.className = 'status-dot status-online';
        }

        // Update metrics
        if (teamName === 'kis') {
          const krwEl = document.getElementById(\`\${prefix}-portfolio-krw\`);
          const usdEl = document.getElementById(\`\${prefix}-portfolio-usd\`);
          if (krwEl) krwEl.textContent = formatCurrency(portfolio.krw || 0, 'KRW');
          if (usdEl) usdEl.textContent = formatCurrency(portfolio.usd || 0, 'USD');
        } else {
          const portEl = document.getElementById(\`\${prefix}-portfolio\`);
          if (portEl) portEl.textContent = formatCurrency(portfolio.totalValue || 0, 'KRW');
        }

        const posEl = document.getElementById(\`\${prefix}-positions\`);
        if (posEl) posEl.textContent = (data.positions || []).length;

        const pnlEl = document.getElementById(\`\${prefix}-pnl\`);
        if (pnlEl) {
          const pnlValue = portfolio.totalPnL || 0;
          pnlEl.textContent = formatCurrency(pnlValue, 'KRW');
          pnlEl.className = 'metric-value ' + (pnlValue >= 0 ? 'positive' : 'negative');
        }

        // Update positions table
        const posTable = document.getElementById(\`\${prefix}-positions-table\`);
        if (posTable) {
          if (!data.positions || data.positions.length === 0) {
            posTable.innerHTML = '<div class="empty-state">No positions</div>';
          } else {
            let html = '<table><tr><th>Symbol</th><th>Qty</th><th>Entry</th><th>P&L</th><th>Return</th></tr>';
            for (const pos of data.positions) {
              const pnlClass = pos.pnl >= 0 ? 'positive' : 'negative';
              html += \`<tr>
                <td><strong>\${pos.symbol}</strong></td>
                <td>\${pos.quantity}</td>
                <td>\${formatCurrency(pos.entryPrice, 'KRW')}</td>
                <td class="\${pnlClass}">\${formatCurrency(pos.pnl, 'KRW')}</td>
                <td class="\${pnlClass}">\${pos.pnlPercent.toFixed(2)}%</td>
              </tr>\`;
            }
            html += '</table>';
            posTable.innerHTML = html;
          }
        }

        const timeEl = document.getElementById(\`\${prefix}-time\`);
        if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('ko-KR');
      } catch (error) {
        console.error(\`Error updating \${teamName}:\`, error);
      }
    }

    async function updateCryptoData() {
      try {
        const [balanceResp, perfResp] = await Promise.all([
          fetchWithCacheBust(\`\${API_BASE}/api/crypto/balances\`),
          fetchWithCacheBust(\`\${API_BASE}/api/crypto/performance\`)
        ]);

        if (balanceResp && balanceResp.data) {
          const portfolio = balanceResp.data.portfolio || {};
          const totalEl = document.getElementById('crypto-total-assets');
          const returnEl = document.getElementById('crypto-total-return');

          if (totalEl) totalEl.textContent = formatCurrency(portfolio.totalAssets || 0, 'KRW');
          if (returnEl) {
            const ret = Number(portfolio.totalReturn || 0);
            returnEl.textContent = ret.toFixed(2) + '%';
            returnEl.style.color = ret >= 0 ? '#10b981' : '#ef4444';
          }
        }

        if (perfResp && perfResp.data) {
          const trades = perfResp.data.trades || {};
          const todayPnlEl = document.getElementById('crypto-today-pnl');
          if (todayPnlEl) {
            const todayPnl = Number(trades.todayPnL || 0);
            todayPnlEl.textContent = (todayPnl >= 0 ? '+' : '') + formatCurrency(todayPnl, 'KRW');
            todayPnlEl.className = 'value-large ' + (todayPnl >= 0 ? 'positive' : 'negative');
          }
        }
      } catch (error) {
        console.error('Crypto data error:', error);
      }
    }

    async function updateDashboard() {
      updateLastUpdateTime();
      await Promise.all([
        updateTeamData('kis'),
        updateTeamData('toss'),
        updateCryptoData()
      ]);
    }

    // ============= INITIALIZATION =============
    updateDashboard();
    setInterval(updateDashboard, 3000); // Update every 3 seconds
  </script>
</body>
</html>
  `;
}
