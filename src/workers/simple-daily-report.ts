/**
 * Simple Daily Report Dashboard
 * 간단한 일일 종합 보고서 - 사용자가 필요한 정보만 표시
 */

export function getSimpleDailyReportHTML(): string {
  const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI 암호화폐 자동매매 대시보드</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
        }

        header {
            background: white;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
        }

        h1 {
            font-size: 28px;
            margin-bottom: 15px;
            color: #333;
        }

        .header-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
        }

        .status-text {
            font-size: 14px;
            color: #666;
        }

        .refresh-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
        }

        .refresh-btn:hover {
            background: #5568d3;
        }

        .card {
            background: white;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
        }

        .card-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 20px;
            color: #333;
            padding-bottom: 15px;
            border-bottom: 2px solid #f0f0f0;
        }

        .report-section {
            margin-bottom: 20px;
        }

        .report-section h3 {
            font-size: 14px;
            font-weight: 600;
            color: #667eea;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .report-content {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }

        .market-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 15px;
        }

        .market-item {
            background: white;
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #e0e0e0;
        }

        .market-symbol {
            font-size: 12px;
            color: #999;
            margin-bottom: 5px;
        }

        .market-price {
            font-size: 16px;
            font-weight: 600;
            color: #333;
        }

        .portfolio-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 15px;
        }

        .portfolio-stat {
            background: white;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #e0e0e0;
        }

        .portfolio-label {
            font-size: 12px;
            color: #999;
            margin-bottom: 5px;
        }

        .portfolio-value {
            font-size: 18px;
            font-weight: 700;
            color: #333;
        }

        .positive {
            color: #00b347;
        }

        .negative {
            color: #e74c3c;
        }

        .positions-list {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            overflow: hidden;
        }

        .position-item {
            display: grid;
            grid-template-columns: 80px 1fr 100px 100px;
            gap: 12px;
            align-items: center;
            padding: 12px 15px;
            border-bottom: 1px solid #f0f0f0;
        }

        .position-item:last-child {
            border-bottom: none;
        }

        .position-symbol {
            font-weight: 600;
            color: #333;
        }

        .position-qty {
            font-size: 12px;
            color: #666;
        }

        .position-pnl {
            text-align: right;
            font-weight: 600;
        }

        .strategy-list {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 15px;
        }

        .strategy-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #f0f0f0;
        }

        .strategy-item:last-child {
            border-bottom: none;
        }

        .strategy-symbol {
            font-weight: 600;
            color: #333;
        }

        .strategy-text {
            color: #666;
        }

        .error-message {
            background: #fff3cd;
            border: 1px solid #ffc107;
            color: #856404;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        .timestamp {
            text-align: center;
            font-size: 12px;
            color: #999;
            margin-top: 20px;
        }

        @media (max-width: 768px) {
            .market-grid {
                grid-template-columns: repeat(2, 1fr);
            }

            .portfolio-grid {
                grid-template-columns: 1fr;
            }

            .position-item {
                grid-template-columns: 1fr;
                gap: 5px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="header-info">
                <div>
                    <h1>🚀 AI 암호화폐 자동매매</h1>
                    <p class="status-text">Cloudflare Workers | 실시간 운영 중</p>
                </div>
                <button class="refresh-btn" onclick="location.reload()">🔄 새로고침</button>
            </div>
        </header>

        <div class="card">
            <div class="card-title">📋 팀장 일일 종합 보고서</div>
            <div id="reportContent">
                <div class="error-message">
                    📊 시스템 초기화 중... (데이터 로드 대기)
                </div>
            </div>
        </div>

        <div class="timestamp" id="lastUpdate">마지막 업데이트: -</div>
    </div>

    <script>
        async function loadDailyReport() {
            try {
                const response = await fetch('/api/crypto/daily-report');
                if (!response.ok) {
                    throw new Error('API 응답 실패: ' + response.status);
                }
                return await response.json();
            } catch (error) {
                console.error('데이터 로드 실패:', error);
                return null;
            }
        }

        function formatNumber(num) {
            return Math.floor(num).toLocaleString('ko-KR');
        }

        async function refreshDashboard() {
            const report = await loadDailyReport();

            if (!report) {
                document.getElementById('reportContent').innerHTML = '<div class="error-message">⚠️ 데이터를 로드할 수 없습니다. 로컬 API 서버 상태를 확인해주세요.</div>';
                return;
            }

            let html = '';

            // 1. 시장 현황
            html += '<div class="report-section"><h3>📈 시장 현황</h3><div class="report-content"><div class="market-grid">';
            const markets = ['BTC', 'ETH', 'SOL', 'ADA'];
            for (const symbol of markets) {
                let price = 0;
                const key = 'KRW-' + symbol;
                const status = report.market_status ? report.market_status[key] : null;
                if (status && status.price > 0) {
                    price = status.price;
                } else if (report.portfolio && report.portfolio.positions) {
                    const pos = report.portfolio.positions.find(p => p.symbol === key);
                    if (pos && pos.current_price > 0) {
                        price = pos.current_price;
                    }
                }
                const displayPrice = price > 0 ? '₩' + formatNumber(price) : '-';
                html += '<div class="market-item"><div class="market-symbol">' + symbol + '</div><div class="market-price">' + displayPrice + '</div></div>';
            }
            html += '</div></div></div>';

            // 2. 포트폴리오 현황
            html += '<div class="report-section"><h3>💰 포트폴리오 현황</h3><div class="report-content"><div class="portfolio-grid">';
            const portfolio = report.portfolio || {};
            const totalAssets = portfolio.total_assets || 0;
            const totalPnl = portfolio.total_pnl || 0;
            const totalReturn = portfolio.total_return || 0;
            const pnlClass = totalPnl >= 0 ? 'positive' : 'negative';
            html += '<div class="portfolio-stat"><div class="portfolio-label">총 자산</div><div class="portfolio-value">₩' + formatNumber(totalAssets) + '</div></div>';
            html += '<div class="portfolio-stat"><div class="portfolio-label">총 손익</div><div class="portfolio-value ' + pnlClass + '">' + totalReturn.toFixed(2) + '% (₩' + formatNumber(totalPnl) + ')</div></div>';
            html += '</div>';

            // 각 포지션 상세
            html += '<div style="margin-top: 15px;"><div style="font-size: 12px; color: #999; margin-bottom: 10px;">보유 포지션</div><div class="positions-list">';
            const positions = portfolio.positions || [];
            if (positions.length > 0) {
                for (const pos of positions) {
                    const pnlPct = pos.pnl_pct || 0;
                    const pnl = pos.pnl || 0;
                    const pnlClass = pnl >= 0 ? 'positive' : 'negative';
                    const qty = pos.quantity || 0;
                    let displayQty = qty > 1 ? qty.toFixed(2) : qty.toFixed(8);
                    displayQty = parseFloat(displayQty).toString();
                    html += '<div class="position-item"><div class="position-symbol">' + pos.symbol + '</div><div class="position-qty">' + displayQty + '개</div><div class="position-pnl ' + pnlClass + '">' + pnlPct.toFixed(2) + '%</div><div class="position-pnl ' + pnlClass + '">₩' + formatNumber(pnl) + '</div></div>';
                }
            } else {
                html += '<div style="padding: 15px; text-align: center; color: #999;">포지션 없음</div>';
            }
            html += '</div></div></div>';

            // 3. 오늘의 매매 전략
            html += '<div class="report-section"><h3>🎯 오늘의 매매 전략</h3><div class="report-content"><div class="strategy-list">';
            const strategy = report.strategy || [];
            if (strategy.length > 0) {
                for (const item of strategy) {
                    html += '<div class="strategy-item"><span class="strategy-symbol">' + item.symbol + '</span><span class="strategy-text">' + item.strategy + ' ' + item.reason + '</span></div>';
                }
            } else {
                html += '<div style="padding: 15px; text-align: center; color: #999;">전략 정보 없음</div>';
            }
            html += '</div></div>';

            // 4. 조치사항
            html += '<div class="report-section"><h3>⚠️ 조치사항</h3><div class="report-content">';
            const actions = report.actions || [];
            if (actions.length > 0) {
                html += '<ul style="padding-left: 20px;">';
                for (const action of actions) {
                    html += '<li style="margin-bottom: 8px;">' + action + '</li>';
                }
                html += '</ul>';
            } else {
                html += '<div style="padding: 10px 0; color: #666;">없음 (정상 운영)</div>';
            }
            html += '</div></div>';

            document.getElementById('reportContent').innerHTML = html;

            const now = new Date();
            const dateStr = now.toLocaleString('ko-KR');
            document.getElementById('lastUpdate').textContent = '마지막 업데이트: ' + dateStr;
        }

        document.addEventListener('DOMContentLoaded', function() {
            refreshDashboard();
            setInterval(refreshDashboard, 10000);
        });
    </script>
</body>
</html>`;

  return htmlContent;
}
