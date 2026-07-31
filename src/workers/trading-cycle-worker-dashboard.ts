/**
 * Dual-Team Dashboard HTML Generator
 * Displays KIS Team and Toss Team side-by-side
 */

export function getDashboardHTML(): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🤖 Dual-Team Auto-Trading Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%);
      color: #e0e0e0;
      padding: 20px;
    }
    .container { max-width: 1600px; margin: 0 auto; }

    header {
      margin-bottom: 30px;
      text-align: center;
    }
    h1 { font-size: 32px; margin-bottom: 10px; }
    .header-subtitle { color: #888; font-size: 14px; }

    .teams-wrapper { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
    @media (max-width: 1400px) { .teams-wrapper { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 768px) { .teams-wrapper { grid-template-columns: 1fr; } }

    .team-panel {
      background: rgba(255,255,255, 0.02);
      border: 1px solid #444;
      border-radius: 8px;
      padding: 20px;
    }

    .team-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #555;
    }

    .team-name { font-size: 20px; font-weight: bold; }
    .team-badge { padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge-kis { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
    .badge-toss { background: rgba(168, 85, 247, 0.2); color: #a855f7; }
    .badge-alpaca { background: rgba(34, 197, 94, 0.2); color: #22c55e; }

    .status-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #10b981;
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .status-error { background: #ef4444; }

    .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 15px; }
    .metric-card {
      background: rgba(255,255,255, 0.05);
      border: 1px solid #333;
      border-radius: 6px;
      padding: 12px;
    }
    .metric-label { font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 6px; }
    .metric-value { font-size: 18px; font-weight: bold; }
    .positive { color: #10b981; }
    .negative { color: #ef4444; }

    .section {
      background: rgba(255,255,255, 0.05);
      border: 1px solid #333;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .section-title { font-size: 12px; color: #aaa; text-transform: uppercase; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #333; }

    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: rgba(0,0,0, 0.3); padding: 8px; text-align: left; font-weight: 600; color: #aaa; }
    td { padding: 8px; border-bottom: 1px solid #222; }
    tr:hover { background: rgba(255,255,255, 0.02); }

    .empty-state { text-align: center; color: #666; padding: 20px; font-size: 12px; }
    .update-time { font-size: 10px; color: #888; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🤖 Triple-Team Auto-Trading Dashboard</h1>
      <div class="header-subtitle">Live tracking KIS + Toss + Alpaca teams • Updates every 3 seconds</div>

      <div style="margin-top: 15px; padding: 12px; background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; border-radius: 6px; font-size: 13px;">
        <div style="color: #22c55e; margin-bottom: 8px;"><strong>🔴 실시간 거래 로그</strong></div>
        <div id="trade-log" style="max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 11px; color: #aaa;">
          <div style="color: #888;">로그 로딩 중...</div>
        </div>
        <div style="margin-top: 8px; font-size: 11px; color: #666;">
          <button onclick="location.reload()" style="padding: 6px 12px; background: #22c55e; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">새로고침</button>
          <button onclick="fetch('/api/recent-analysis').then(r => r.json()).then(d => console.log(d))" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; margin-left: 8px;">API 확인</button>
        </div>
      </div>
    </header>

    <div class="teams-wrapper">
      <!-- KIS Team -->
      <div class="team-panel">
        <div class="team-header">
          <span class="status-dot" id="kis-status"></span>
          <span class="team-name">KIS Team</span>
          <span class="team-badge badge-kis">한국투자증권</span>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">포트폴리오 (KRW)</div>
            <div class="metric-value" id="kis-portfolio-krw">₩7M</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">포트폴리오 (USD)</div>
            <div class="metric-value" id="kis-portfolio-usd">$2.3K</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">포지션</div>
            <div class="metric-value" id="kis-positions">0</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">P&L</div>
            <div class="metric-value" id="kis-pnl">₩0</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">📊 포지션</div>
          <div id="kis-positions-table">
            <div class="empty-state">포지션 없음</div>
          </div>
        </div>

        <div class="update-time">마지막 업데이트: <span id="kis-time">--:--:--</span></div>
      </div>

      <!-- Toss Team -->
      <div class="team-panel">
        <div class="team-header">
          <span class="status-dot" id="toss-status"></span>
          <span class="team-name">Toss Team</span>
          <span class="team-badge badge-toss">토스증권</span>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">포트폴리오</div>
            <div class="metric-value" id="toss-portfolio">₩10M</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">포지션</div>
            <div class="metric-value" id="toss-positions">0</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">P&L</div>
            <div class="metric-value" id="toss-pnl">₩0</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">현금</div>
            <div class="metric-value" id="toss-cash">₩10M</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">📊 포지션</div>
          <div id="toss-positions-table">
            <div class="empty-state">포지션 없음</div>
          </div>
        </div>

        <div class="update-time">마지막 업데이트: <span id="toss-time">--:--:--</span></div>
      </div>

      <!-- Alpaca Team -->
      <div class="team-panel">
        <div class="team-header">
          <span class="status-dot" id="alpaca-status"></span>
          <span class="team-name">Alpaca Team</span>
          <span class="team-badge badge-alpaca">미국주식</span>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">포트폴리오</div>
            <div class="metric-value" id="alpaca-portfolio">$10K</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">포지션</div>
            <div class="metric-value" id="alpaca-positions">0</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">P&L</div>
            <div class="metric-value" id="alpaca-pnl">$0</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">매매력</div>
            <div class="metric-value" id="alpaca-cash">$40K</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">📊 포지션</div>
          <div id="alpaca-positions-table">
            <div class="empty-state">포지션 없음</div>
          </div>
        </div>

        <div class="update-time">마지막 업데이트: <span id="alpaca-time">--:--:--</span></div>
      </div>
    </div>
  </div>

  <script>
    const API_BASE = window.location.origin;

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

    async function updateTeam(teamName) {
      try {
        const response = await fetch(\`\${API_BASE}/api/\${teamName}-status\`);
        const data = await response.json();

        if (data.status === 'error') {
          updateTeamUI(teamName, null);
          return;
        }

        updateTeamUI(teamName, data);
      } catch (e) {
        console.error(\`\${teamName} Error:\`, e);
        updateTeamUI(teamName, null);
      }
    }

    function updateTeamUI(teamName, data) {
      try {
        const prefix = teamName.toLowerCase();
        const statusDot = document.getElementById(\`\${prefix}-status\`);
        const isCurrency = teamName === 'alpaca' ? 'USD' : 'KRW';

        if (!data) {
          if (statusDot) statusDot.classList.add('status-error');
          const portfolioEl = document.getElementById(\`\${prefix}-portfolio\`);
          if (portfolioEl) portfolioEl.textContent = '❌ 오류';
          const posTableEl = document.getElementById(\`\${prefix}-positions-table\`);
          if (posTableEl) posTableEl.innerHTML = '<div class="empty-state">API 오류</div>';
          return;
        }

        if (statusDot) statusDot.classList.remove('status-error');

        // Update metrics
        const portfolio = data.portfolio || {};

        // KIS Team: Show KRW and USD separately
        if (teamName === 'kis' && portfolio.krw !== undefined && portfolio.usd !== undefined) {
          const krwEl = document.getElementById(\`\${prefix}-portfolio-krw\`);
          const usdEl = document.getElementById(\`\${prefix}-portfolio-usd\`);
          if (krwEl) krwEl.textContent = formatCurrency(portfolio.krw, 'KRW');
          if (usdEl) usdEl.textContent = formatCurrency(portfolio.usd, 'USD');
        } else {
          // Toss/Alpaca: Show single portfolio value
          const portfolioEl = document.getElementById(\`\${prefix}-portfolio\`);
          if (portfolioEl) {
            portfolioEl.textContent = formatCurrency(portfolio.totalValue || 0, isCurrency);
          }
        }

        // Cash: only show for Alpaca (buying power)
        if (teamName === 'alpaca') {
          const cashEl = document.getElementById(\`\${prefix}-cash\`);
          if (cashEl) {
            cashEl.textContent = formatCurrency(portfolio.buyingPower || 0, isCurrency);
          }
        }

        const posEl = document.getElementById(\`\${prefix}-positions\`);
        if (posEl) posEl.textContent = (data.positions || []).length;

        const pnlEl = document.getElementById(\`\${prefix}-pnl\`);
        if (pnlEl) {
          pnlEl.textContent = formatCurrency(portfolio.totalPnL || 0, isCurrency);
          pnlEl.className = 'metric-value ' + ((portfolio.totalPnL || 0) >= 0 ? 'positive' : 'negative');
        }

        // Update positions table
        const posTable = document.getElementById(\`\${prefix}-positions-table\`);
        if (posTable) {
          if (!data.positions || data.positions.length === 0) {
            posTable.innerHTML = '<div class="empty-state">포지션 없음</div>';
          } else {
            let html = '<table><tr><th>종목</th><th>수량</th><th>진입가</th><th>P&L</th><th>수익률</th></tr>';
            for (const pos of data.positions) {
              const pnlClass = pos.pnl >= 0 ? 'positive' : 'negative';
              html += \`<tr>
                <td><strong>\${pos.symbol}</strong></td>
                <td>\${pos.quantity}</td>
                <td>\${formatCurrency(pos.entryPrice, isCurrency)}</td>
                <td class="\${pnlClass}">\${formatCurrency(pos.pnl, isCurrency)}</td>
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
        console.error(\`[Dashboard] Error updating \${teamName}:\`, error);
      }
    }

    async function updateDashboard() {
      await Promise.all([
        updateTeam('kis'),
        updateTeam('toss'),
        updateTeam('alpaca')
      ]);
    }

    // Initial load
    updateDashboard();
    setInterval(updateDashboard, 3000); // Update every 3 seconds
  </script>
</body>
</html>
  `;
}
