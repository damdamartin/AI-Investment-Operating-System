#!/bin/bash

# Google Cloud 배포 스크립트
# 사용법: bash deploy_to_gcp.sh <GCP_VM_IP> <GCP_VM_USER>

GCP_IP=$1
GCP_USER=${2:-ubuntu}
PROJECT_DIR="/home/${GCP_USER}/aios-booster"

if [ -z "$GCP_IP" ]; then
    echo "❌ 사용법: bash deploy_to_gcp.sh <GCP_VM_IP> [GCP_USER]"
    echo "   예: bash deploy_to_gcp.sh 34.123.45.67 ubuntu"
    exit 1
fi

echo "🚀 Google Cloud VM에 배포 중..."
echo "   VM IP: $GCP_IP"
echo "   사용자: $GCP_USER"

# 1️⃣ SSH 키 설정 확인
echo ""
echo "1️⃣ SSH 연결 테스트..."
ssh -o ConnectTimeout=5 "${GCP_USER}@${GCP_IP}" "echo ✅ SSH 연결 성공"
if [ $? -ne 0 ]; then
    echo "❌ SSH 연결 실패!"
    echo "   구글 클라우드 콘솔에서 SSH 키를 생성하셨나요?"
    exit 1
fi

# 2️⃣ 프로젝트 디렉토리 생성
echo ""
echo "2️⃣ VM에 프로젝트 디렉토리 생성..."
ssh "${GCP_USER}@${GCP_IP}" "mkdir -p $PROJECT_DIR"

# 3️⃣ 코드 복사
echo ""
echo "3️⃣ 코드 업로드 중..."
scp -r src/ .env "${GCP_USER}@${GCP_IP}:${PROJECT_DIR}/"

# 4️⃣ 의존성 설치
echo ""
echo "4️⃣ 파이썬 의존성 설치..."
ssh "${GCP_USER}@${GCP_IP}" "cd $PROJECT_DIR && python3 -m pip install -q pyupbit aiohttp websockets pydantic python-dotenv anthropic"

# 5️⃣ systemd 서비스 파일 생성
echo ""
echo "5️⃣ systemd 서비스 설정..."
ssh "${GCP_USER}@${GCP_IP}" "cat > /tmp/aios-booster.service << 'EOF'
[Unit]
Description=AIOS Auto Trading Booster
After=network.target

[Service]
Type=simple
User=${GCP_USER}
WorkingDirectory=${PROJECT_DIR}
ExecStart=/usr/bin/python3 -m src.pyqqq.strategy_upbit
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
"

ssh "${GCP_USER}@${GCP_IP}" "sudo mv /tmp/aios-booster.service /etc/systemd/system/"
ssh "${GCP_USER}@${GCP_IP}" "sudo systemctl daemon-reload"
ssh "${GCP_USER}@${GCP_IP}" "sudo systemctl enable aios-booster"
ssh "${GCP_USER}@${GCP_IP}" "sudo systemctl start aios-booster"

# 6️⃣ 외부 IP 확인
echo ""
echo "6️⃣ VM 외부 IP 확인..."
EXTERNAL_IP=$(ssh "${GCP_USER}@${GCP_IP}" "curl -s https://api.ipify.org")
echo "   🌐 구글 클라우드 외부 IP: $EXTERNAL_IP"

# 7️⃣ 상태 확인
echo ""
echo "7️⃣ 서비스 상태 확인..."
ssh "${GCP_USER}@${GCP_IP}" "sudo systemctl status aios-booster --no-pager | head -10"

echo ""
echo "✅ 배포 완료!"
echo ""
echo "📋 다음 단계:"
echo "   1. Upbit 마이페이지 → API 관리"
echo "   2. IP 화이트리스트에 다음 IP 추가:"
echo "      🌐 $EXTERNAL_IP"
echo ""
echo "🔍 로그 확인:"
echo "   ssh ${GCP_USER}@${GCP_IP} \"sudo journalctl -u aios-booster -f\""
