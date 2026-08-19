#!/bin/bash
# 🚀 미국주식 자동매매 배포 및 시작 스크립트
# GCP VM에서 KIS + Toss 미국주식 실거래 시작

set -e

echo "========================================="
echo "🚀 미국주식 자동매매 시작"
echo "========================================="
echo ""

# 설정
GCP_IP="34.50.1.187"
GCP_USER="ubuntu"

echo "📋 설정 값:"
echo "  - GCP VM IP: $GCP_IP"
echo "  - 사용자: $GCP_USER"
echo "  - 거래 대상: AAPL, MSFT, GOOGL, TSLA, AMZN"
echo ""

# Step 1: 환경 설정 파일 생성
echo "1️⃣ 환경 설정 파일 생성..."

cat > /tmp/aios_us_stocks.env << 'EOF'
APP_ENV=production
LOG_LEVEL=info
LIVE_TRADING_ENABLED=true

# ===== KIS 한국투자증권 설정 =====
KIS_APP_KEY=PSBle8d4XW8O6YpFeRFMCtggxpXvwvW3SavG
KIS_APP_SECRET=PuCMV1vR6Se2R3plALA1KwnU9rscOhXJmopyalHMV3x7nPFLd/I7TU/BORWfpk1yJZi0RmnlZYtF1KfPoXDj0Eh3F39+NpZtOCHVdikisYGYG2J0NTKYvFhylh/WaPv0KXqS5GM+AFaMHUZyyeXq1e2/ZLz0PSbPH++J1HIGwifGNY95Hss=
KIS_ACCOUNT_NO=46410502-01
KIS_API_BASE_URL=https://openapi.koreainvestment.com:9443
KIS_TRADING_ENABLED=true

# ===== Toss 토스증권 설정 =====
TOSS_READ_ONLY_MODE=false
TOSS_API_BASE_URL=https://openapi.tossinvest.com
TOSS_CLIENT_ID=tsck_live_xOGg7QZbI1Im34ldMpal9D
TOSS_CLIENT_SECRET=tssk_live_L33b3zbjbfYaLBxlqnvYVpG9QWJtIetvkeJ4ZmK6cctA
TOSS_ACCOUNT_REF=1

# ===== 미국주식 거래 설정 =====
PIPELINE_WATCHLIST=AAPL:Apple Inc:US:STOCK,MSFT:Microsoft:US:STOCK,GOOGL:Google:US:STOCK,TSLA:Tesla:US:STOCK,AMZN:Amazon:US:STOCK
PIPELINE_BUY_THRESHOLD=65
PIPELINE_SELL_THRESHOLD=35
STOP_LOSS_PCT=-5
TAKE_PROFIT_PCT=10

# ===== 리스크 관리 =====
PIPELINE_RISK_MAX_ORDER_AMOUNT=3000000
PIPELINE_MONEY_MIN_CASH_AFTER_ORDER=500000
PIPELINE_MONEY_MAX_STRATEGY_ALLOCATION=5000000

# ===== API 설정 =====
NAVER_CLIENT_ID=replace-with-local-secret
NAVER_CLIENT_SECRET=replace-with-local-secret
CLAUDE_API_KEY=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
EOF

echo "✅ 설정 파일 생성 완료"
echo ""

# Step 2: GCP VM에 배포
echo "2️⃣ GCP VM에 설정 파일 배포..."
echo "   명령어:"
echo "   gcloud compute scp /tmp/aios_us_stocks.env ${GCP_USER}@ai-investment-vm:/tmp/"
echo "   gcloud compute ssh ${GCP_USER}@ai-investment-vm -- sudo cp /tmp/aios_us_stocks.env /etc/aios/aios.env"
echo ""

# Step 3: 서비스 재시작 명령어
echo "3️⃣ GCP VM에서 실행할 명령어:"
echo ""
echo "=== A. 설정 파일 업데이트 ==="
echo "gcloud compute scp /tmp/aios_us_stocks.env ubuntu@ai-investment-vm:/tmp/"
echo "gcloud compute ssh ubuntu@ai-investment-vm -- sudo cp /tmp/aios_us_stocks.env /etc/aios/aios.env"
echo ""
echo "=== B. 서비스 재시작 ==="
echo "gcloud compute ssh ubuntu@ai-investment-vm -- sudo systemctl restart aios-kis"
echo "gcloud compute ssh ubuntu@ai-investment-vm -- sudo systemctl restart aios-toss"
echo ""
echo "=== C. 상태 확인 ==="
echo "gcloud compute ssh ubuntu@ai-investment-vm -- sudo systemctl status aios-kis aios-toss --no-pager"
echo ""
echo "=== D. 로그 확인 ==="
echo "gcloud compute ssh ubuntu@ai-investment-vm -- sudo tail -f /var/log/aios/kis.log &"
echo "gcloud compute ssh ubuntu@ai-investment-vm -- sudo tail -f /var/log/aios/toss.log &"
echo ""

echo "========================================="
echo "📝 수동 배포 가이드"
echo "========================================="
echo ""
echo "방법 1: GCP Cloud Shell 사용 (권장)"
echo "-------"
echo "1. GCP 콘솔 접속: https://console.cloud.google.com"
echo "2. Cloud Shell 열기"
echo "3. 다음 명령어 실행:"
echo ""
cat > /tmp/deploy_commands.sh << 'DEPLOY_EOF'
# 설정 파일 업데이트
sudo tee /etc/aios/aios.env > /dev/null << 'ENVEOF'
APP_ENV=production
LOG_LEVEL=info
LIVE_TRADING_ENABLED=true

# ===== KIS 한국투자증권 설정 =====
KIS_APP_KEY=PSBle8d4XW8O6YpFeRFMCtggxpXvwvW3SavG
KIS_APP_SECRET=PuCMV1vR6Se2R3plALA1KwnU9rscOhXJmopyalHMV3x7nPFLd/I7TU/BORWfpk1yJZi0RmnlZYtF1KfPoXDj0Eh3F39+NpZtOCHVdikisYGYG2J0NTKYvFhylh/WaPv0KXqS5GM+AFaMHUZyyeXq1e2/ZLz0PSbPH++J1HIGwifGNY95Hss=
KIS_ACCOUNT_NO=46410502-01
KIS_API_BASE_URL=https://openapi.koreainvestment.com:9443
KIS_TRADING_ENABLED=true

# ===== Toss 토스증권 설정 =====
TOSS_READ_ONLY_MODE=false
TOSS_API_BASE_URL=https://openapi.tossinvest.com
TOSS_CLIENT_ID=tsck_live_xOGg7QZbI1Im34ldMpal9D
TOSS_CLIENT_SECRET=tssk_live_L33b3zbjbfYaLBxlqnvYVpG9QWJtIetvkeJ4ZmK6cctA
TOSS_ACCOUNT_REF=1

# ===== 미국주식 거래 설정 =====
PIPELINE_WATCHLIST=AAPL:Apple Inc:US:STOCK,MSFT:Microsoft:US:STOCK,GOOGL:Google:US:STOCK,TSLA:Tesla:US:STOCK,AMZN:Amazon:US:STOCK
PIPELINE_BUY_THRESHOLD=65
PIPELINE_SELL_THRESHOLD=35
STOP_LOSS_PCT=-5
TAKE_PROFIT_PCT=10

# ===== 리스크 관리 =====
PIPELINE_RISK_MAX_ORDER_AMOUNT=3000000
PIPELINE_MONEY_MIN_CASH_AFTER_ORDER=500000
PIPELINE_MONEY_MAX_STRATEGY_ALLOCATION=5000000

# ===== API 설정 =====
NAVER_CLIENT_ID=replace-with-local-secret
NAVER_CLIENT_SECRET=replace-with-local-secret
CLAUDE_API_KEY=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
ENVEOF

# 서비스 재시작
echo "🔄 KIS 서비스 재시작..."
sudo systemctl restart aios-kis
sleep 2

echo "🔄 Toss 서비스 재시작..."
sudo systemctl restart aios-toss
sleep 2

# 상태 확인
echo "📊 서비스 상태 확인..."
sudo systemctl status aios-kis --no-pager | head -10
echo ""
sudo systemctl status aios-toss --no-pager | head -10

# 로그 확인
echo ""
echo "📋 최근 로그..."
echo "=== KIS 로그 ==="
tail -5 /var/log/aios/kis.log

echo ""
echo "=== Toss 로그 ==="
tail -5 /var/log/aios/toss.log

echo ""
echo "✅ 미국주식 자동매매 시작 완료!"
DEPLOY_EOF

cat /tmp/deploy_commands.sh

echo ""
echo "========================================="
echo "💡 다음 단계"
echo "========================================="
echo ""
echo "1. 위 명령어를 GCP Cloud Shell에 복사 & 붙여넣기"
echo "2. Enter 키 눌러서 실행"
echo "3. 로그에서 거래 상황 확인"
echo ""
echo "실시간 모니터링:"
echo "  gcloud compute ssh ubuntu@ai-investment-vm -- tail -f /var/log/aios/kis.log"
echo "  gcloud compute ssh ubuntu@ai-investment-vm -- tail -f /var/log/aios/toss.log"
echo ""
