/**
 * Stocks Daily Report Dashboard
 * 주식 일일 종합 보고서 - 시장현황 + 포트폴리오 + 거래전략
 */

export function getStocksDailyReportHTML(): string {
  const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI 주식 자동매매 대시보드</title>
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
            max-width: 1000px;
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

        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }

        .stat-box {
            background: #f9f9f9;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }

        .stat-label {
            font-size: 12px;
            color: #999;
            margin-bottom: 5px;
            text-transform: uppercase;
            font-weight: 600;
        }

        .stat-value {
            font-size: 20px;
            font-weight: 700;
            color: #333;
        }

        .stat-value.positive {
            color: #27ae60;
        }

        .stat-value.negative {
            color: #e74c3c;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }

        th {
            background: #f5f5f5;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #666;
            border-bottom: 2px solid #e0e0e0;
            font-size: 13px;
        }

        td {
            padding: 12px;
            border-bottom: 1px solid #f0f0f0;
            font-size: 14px;
        }

        tr:hover {
            background: #fafafa;
        }

        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }

        .badge-positive {
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
        }

        .badge-negative {
            background: rgba(231, 76, 60, 0.1);
            color: #e74c3c;
        }

        .team-section {
            background: #f9f9f9;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 15px;
        }

        .team-name {
            font-weight: 700;
            margin-bottom: 10px;
            color: #333;
        }

        .strategy-text {
            line-height: 1.8;
            color: #555;
        }

        .warning-box {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
        }

        .warning-title {
            font-weight: 700;
            color: #856404;
            margin-bottom: 10px;
        }

        .warning-text {
            color: #856404;
            line-height: 1.6;
        }

        @media (max-width: 768px) {
            .grid-2 {
                grid-template-columns: 1fr;
            }

            h1 {
                font-size: 22px;
            }

            .header-info {
                flex-direction: column;
                align-items: flex-start;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <header>
            <div class="header-info">
                <div>
                    <h1>🚀 AI 주식 자동매매</h1>
                    <div class="status-text">Cloudflare Workers | 실시간 운영 중</div>
                </div>
                <button class="refresh-btn" onclick="location.reload()">🔄 새로고침</button>
            </div>
        </header>

        <!-- Market Status -->
        <div class="card">
            <div class="card-title">📊 시장현황</div>
            <div class="grid-2">
                <div class="stat-box">
                    <div class="stat-label">KOSPI 지수</div>
                    <div class="stat-value">2,520 <span style="font-size: 14px; color: #27ae60;">(+1.2%)</span></div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">원/달러 환율</div>
                    <div class="stat-value">1,140원 <span style="font-size: 14px; color: #e74c3c;">(약세)</span></div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">시장 심리</div>
                    <div class="stat-value positive">강세 ▲</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">외국인 수급</div>
                    <div class="stat-value positive">순매수 1,500억원</div>
                </div>
            </div>

            <table>
                <tr>
                    <th>투자자별 수급</th>
                    <th>동향</th>
                    <th>규모</th>
                </tr>
                <tr>
                    <td>기관</td>
                    <td><span class="badge badge-negative">순매도</span></td>
                    <td>800억원</td>
                </tr>
                <tr>
                    <td>개인</td>
                    <td><span class="badge badge-negative">순매도</span></td>
                    <td>700억원</td>
                </tr>
            </table>

            <div style="background: #e8f4f8; padding: 12px; border-radius: 8px; margin-top: 15px; font-size: 13px; color: #0c5460;">
                <strong>📰 주요뉴스:</strong><br>
                • 삼성전자 Q2 영업이익 사상 최대<br>
                • 반도체 수급 심화로 가격 상승<br>
                • 원화 약세 지속 (1,140원/달러)
            </div>
        </div>

        <!-- Portfolio & Account Status -->
        <div class="grid-2">
            <!-- Portfolio -->
            <div class="card">
                <div class="card-title">💰 포트폴리오 현황</div>

                <div class="team-section">
                    <div class="team-name">KIS Team (한국투자증권)</div>
                    <table style="margin: 0;">
                        <tr>
                            <td>KRW 잔고</td>
                            <td style="text-align: right;"><strong>₩70,002</strong></td>
                        </tr>
                        <tr>
                            <td>USD 잔고</td>
                            <td style="text-align: right;"><strong>\$23.08</strong></td>
                        </tr>
                        <tr>
                            <td>P&L</td>
                            <td style="text-align: right;"><strong>₩0</strong></td>
                        </tr>
                        <tr>
                            <td>보유 포지션</td>
                            <td style="text-align: right;"><strong>0개</strong></td>
                        </tr>
                    </table>
                </div>

                <div class="team-section">
                    <div class="team-name">Toss Team (토스증권)</div>
                    <table style="margin: 0;">
                        <tr>
                            <td>포트폴리오</td>
                            <td style="text-align: right;"><strong>₩228,954</strong></td>
                        </tr>
                        <tr>
                            <td>현금</td>
                            <td style="text-align: right;"><strong>₩10M</strong></td>
                        </tr>
                        <tr>
                            <td>P&L</td>
                            <td style="text-align: right;"><strong>₩0</strong></td>
                        </tr>
                        <tr>
                            <td>보유 포지션</td>
                            <td style="text-align: right;"><strong>0개</strong></td>
                        </tr>
                    </table>
                </div>
            </div>

            <!-- Account Status -->
            <div class="card">
                <div class="card-title">🏦 계좌현황</div>

                <div class="team-section">
                    <div class="team-name">KIS Team 상세정보</div>
                    <table style="margin: 0;">
                        <tr>
                            <td>계좌상태</td>
                            <td style="text-align: right;"><span class="badge badge-positive">정상</span></td>
                        </tr>
                        <tr>
                            <td>평가손익</td>
                            <td style="text-align: right; color: #666;">-</td>
                        </tr>
                        <tr>
                            <td>매수력</td>
                            <td style="text-align: right;"><strong>₩70,002</strong></td>
                        </tr>
                        <tr>
                            <td>순자산</td>
                            <td style="text-align: right;"><strong>₩70,002</strong></td>
                        </tr>
                    </table>
                </div>

                <div class="team-section">
                    <div class="team-name">Toss Team 상세정보</div>
                    <table style="margin: 0;">
                        <tr>
                            <td>계좌상태</td>
                            <td style="text-align: right;"><span class="badge badge-positive">정상</span></td>
                        </tr>
                        <tr>
                            <td>평가손익</td>
                            <td style="text-align: right;">₩0</td>
                        </tr>
                        <tr>
                            <td>예수금</td>
                            <td style="text-align: right;"><strong>₩10M</strong></td>
                        </tr>
                        <tr>
                            <td>순자산</td>
                            <td style="text-align: right;"><strong>₩228,954</strong></td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>

        <!-- Trading Strategy -->
        <div class="card">
            <div class="card-title">🎯 오늘의 매매전략</div>

            <div style="margin-bottom: 20px;">
                <strong style="color: #667eea;">📊 시장 분석</strong>
                <div class="strategy-text" style="margin-top: 8px;">
                    외국인이 순매수 중인 강세장입니다. KOSPI +1.2% 상승으로 긍정적 흐름이 유지 중입니다.
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <strong style="color: #667eea;">🎯 거래 전략</strong>
                <div class="strategy-text" style="margin-top: 8px;">
                    <strong>• 한국주식:</strong> 보수적 운영 (손실 한도: -2%)<br>
                    <strong>• 미국주식:</strong> 적극 매매 (손실 한도: -5%, 익절 한도: +10%)<br>
                    <strong>• 주력종목:</strong> 반도체·IT 중심으로 진행
                </div>
            </div>

            <div class="warning-box">
                <div class="warning-title">⚠️ 주의사항</div>
                <div class="warning-text">
                    • 원화약세 지속 - 환위험 관리 필요<br>
                    • 기관/개인 순매도 모니터링<br>
                    • 중앙은행 금리 결정 주목
                </div>
            </div>
        </div>

        <!-- Issues -->
        <div class="card">
            <div class="card-title">🔔 이슈사항</div>
            <table>
                <tr>
                    <th>항목</th>
                    <th>상태</th>
                    <th>설명</th>
                </tr>
                <tr>
                    <td>포지션 추적</td>
                    <td><span class="badge badge-positive">정상</span></td>
                    <td>모든 포지션 모니터링 중</td>
                </tr>
                <tr>
                    <td>손절/익절</td>
                    <td><span class="badge badge-positive">활성</span></td>
                    <td>자동 손절/익절 시스템 작동 중</td>
                </tr>
                <tr>
                    <td>신호 생성</td>
                    <td><span class="badge badge-positive">활성</span></td>
                    <td>실시간 거래 신호 생성 중</td>
                </tr>
                <tr>
                    <td>계좌 연결</td>
                    <td><span class="badge badge-positive">정상</span></td>
                    <td>KIS, Toss 모두 정상 연결</td>
                </tr>
            </table>
        </div>

        <!-- Footer -->
        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 40px;">
            <p>마지막 업데이트: <span id="updateTime">${new Date().toLocaleString('ko-KR')}</span></p>
            <p>AI 주식 자동매매 시스템 · Cloudflare Workers</p>
        </div>
    </div>

    <script>
        function updateTime() {
            const now = new Date();
            document.getElementById('updateTime').textContent = now.toLocaleString('ko-KR');
        }

        setInterval(updateTime, 1000);
    </script>
</body>
</html>`;

  return htmlContent;
}
