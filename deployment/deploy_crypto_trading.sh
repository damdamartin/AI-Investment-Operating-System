#!/bin/bash

# GCP VM에 암호화폐 자동매매 배포 스크립트
# 사용법: bash deploy_crypto_trading.sh <GCP_VM_IP> [GCP_VM_USER]

set -e  # 에러 발생 시 스크립트 중단

GCP_IP=$1
GCP_USER=${2:-ubuntu}
PROJECT_DIR="/home/${GCP_USER}/aios-booster"
PYTHON_BIN="/usr/bin/python3"

# SSH 키 설정 (기본값은 Google Cloud 기본 키)
SSH_KEY_PATH="${HOME}/.ssh/google_compute_engine"
if [ ! -f "$SSH_KEY_PATH" ]; then
    SSH_KEY_PATH="${HOME}/.ssh/id_rsa"
fi
if [ ! -f "$SSH_KEY_PATH" ]; then
    SSH_KEY_PATH=""
fi

# SSH 명령어 기본값
SSH_CMD="ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no"
SCP_CMD="scp -o ConnectTimeout=10 -o StrictHostKeyChecking=no"

# SSH 키가 있으면 명시적으로 지정
if [ -n "$SSH_KEY_PATH" ]; then
    SSH_CMD="$SSH_CMD -i $SSH_KEY_PATH"
    SCP_CMD="$SCP_CMD -i $SSH_KEY_PATH"
fi

if [ -z "$GCP_IP" ]; then
    echo "❌ 사용법: bash deploy_crypto_trading.sh <GCP_VM_IP> [GCP_VM_USER]"
    echo "   예: bash deploy_crypto_trading.sh 34.123.45.67 ubuntu"
    exit 1
fi

echo "🚀 GCP VM에 암호화폐 자동매매 배포 중..."
echo "   VM IP: $GCP_IP"
echo "   사용자: $GCP_USER"
echo "   SSH 키: $SSH_KEY_PATH"
echo ""

# 1️⃣ SSH 연결 테스트 (재시도 로직 포함)
echo "1️⃣ SSH 연결 테스트..."
SSH_SUCCESS=false
for attempt in 1 2 3; do
    echo "   시도 $attempt/3..."
    if $SSH_CMD "${GCP_USER}@${GCP_IP}" "echo ✅ SSH 연결 성공" 2>/dev/null; then
        SSH_SUCCESS=true
        break
    fi
    if [ $attempt -lt 3 ]; then
        echo "   3초 대기 중..."
        sleep 3
    fi
done

if [ "$SSH_SUCCESS" = false ]; then
    echo "❌ SSH 연결 실패!"
    echo ""
    echo "📋 문제 해결 방법:"
    echo "   1. GCP 콘솔에서 VM 상태 확인 (RUNNING 상태인가?)"
    echo "   2. VM의 외부 IP 확인 (34.64.178.159가 맞나?)"
    echo "   3. 방화벽 규칙에서 SSH(포트 22) 허용 확인"
    echo "   4. SSH 공개 키 등록 확인 (Compute Engine → 메타데이터 → SSH 키)"
    echo "   5. gcloud CLI 사용 (brew install google-cloud-sdk)"
    echo ""
    echo "💡 대체 방법:"
    echo "   GCP 콘솔 → VM 인스턴스 → SSH 버튼 클릭하여 웹 터미널 사용"
    exit 1
fi

# 2️⃣ 기존 서비스 중지
echo ""
echo "2️⃣ 기존 서비스 중지 중..."
$SSH_CMD "${GCP_USER}@${GCP_IP}" "sudo systemctl stop aios-crypto-trader 2>/dev/null || true" || true
sleep 2

# 3️⃣ 프로젝트 디렉토리 생성
echo ""
echo "3️⃣ 프로젝트 디렉토리 생성..."
$SSH_CMD "${GCP_USER}@${GCP_IP}" "mkdir -p $PROJECT_DIR"

# 4️⃣ 코드 업로드
echo ""
echo "4️⃣ 코드 업로드 중..."
if [ -d "src" ]; then
    $SCP_CMD -r src/ "${GCP_USER}@${GCP_IP}:${PROJECT_DIR}/"
fi
if [ -d "deployment" ]; then
    $SCP_CMD -r deployment/ "${GCP_USER}@${GCP_IP}:${PROJECT_DIR}/"
fi
if [ -f ".env" ]; then
    $SCP_CMD .env "${GCP_USER}@${GCP_IP}:${PROJECT_DIR}/"
fi
if [ -d "pyqqq" ]; then
    $SCP_CMD -r pyqqq/ "${GCP_USER}@${GCP_IP}:${PROJECT_DIR}/"
fi

# 5️⃣ Python 의존성 설치
echo ""
echo "5️⃣ Python 의존성 설치..."
$SSH_CMD "${GCP_USER}@${GCP_IP}" "cd $PROJECT_DIR && \
$PYTHON_BIN -m pip install --quiet \
    pyupbit aiohttp websockets pydantic python-dotenv anthropic requests httpx"

# 6️⃣ systemd 서비스 파일 설치
echo ""
echo "6️⃣ systemd 서비스 설정..."
$SSH_CMD "${GCP_USER}@${GCP_IP}" "sudo cp $PROJECT_DIR/deployment/crypto-trading.service /etc/systemd/system/aios-crypto-trader.service"
$SSH_CMD "${GCP_USER}@${GCP_IP}" "sudo systemctl daemon-reload"
$SSH_CMD "${GCP_USER}@${GCP_IP}" "sudo systemctl enable aios-crypto-trader"

# 7️⃣ 서비스 시작
echo ""
echo "7️⃣ 서비스 시작 중..."
$SSH_CMD "${GCP_USER}@${GCP_IP}" "sudo systemctl start aios-crypto-trader"
sleep 3

# 8️⃣ 서비스 상태 확인
echo ""
echo "8️⃣ 서비스 상태 확인..."
$SSH_CMD "${GCP_USER}@${GCP_IP}" "sudo systemctl status aios-crypto-trader --no-pager | head -15" || true

# 9️⃣ 프로세스 확인
echo ""
echo "9️⃣ 프로세스 확인..."
$SSH_CMD "${GCP_USER}@${GCP_IP}" "ps aux | grep strategy_upbit | grep -v grep" || echo "프로세스 시작 중..."

# 🔟 하트비트 파일 확인
echo ""
echo "🔟 하트비트 파일 확인..."
$SSH_CMD "${GCP_USER}@${GCP_IP}" "cat /tmp/crypto_heartbeat.json 2>/dev/null || echo '파일 아직 생성 안 됨 (잠시 대기)'" || true

# 외부 IP 확인
echo ""
echo "✅ 배포 완료!"
echo ""
EXTERNAL_IP=$($SSH_CMD "${GCP_USER}@${GCP_IP}" "curl -s https://api.ipify.org" 2>/dev/null || echo "unknown")
echo "📋 Upbit API 화이트리스트 업데이트"
echo "   1. [Upbit 마이페이지](https://upbit.com/mypage) 접속"
echo "   2. API 관리 → IP 화이트리스트"
echo "   3. 다음 IP 추가:"
echo "      🌐 $EXTERNAL_IP"
echo ""
echo "📊 모니터링 명령어:"
echo ""
echo "   A. 실시간 로그 (실시간 추적):"
echo "      $SSH_CMD ${GCP_USER}@${GCP_IP} \"sudo journalctl -u aios-crypto-trader -f\""
echo ""
echo "   B. 하트비트 모니터링 (매 5초 갱신):"
echo "      $SSH_CMD ${GCP_USER}@${GCP_IP} \"watch -n 5 'cat /tmp/crypto_heartbeat.json | jq .\'\""
echo ""
echo "   C. 거래 기록 모니터링:"
echo "      $SSH_CMD ${GCP_USER}@${GCP_IP} \"tail -f /tmp/crypto_trades.json\""
echo ""
echo "⚠️  주의사항:"
echo "   - 배포 후 30초 정도 기다려야 heartbeat 파일이 생성됩니다"
echo "   - 만약 2분 이상 heartbeat가 갱신 안 되면: systemctl restart aios-crypto-trader"
echo "   - 주문 기록이 없는 경우: 거래 신호를 찾지 못했을 수 있습니다 (정상)"
echo ""
