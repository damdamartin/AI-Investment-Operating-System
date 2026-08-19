#!/bin/bash

# 암호화폐 자동매매 헬스체크 스크립트
# 사용법: bash check_crypto_health.sh <GCP_VM_IP> [GCP_VM_USER]

GCP_IP=$1
GCP_USER=${2:-ubuntu}

# SSH 키 설정
SSH_KEY_PATH="${HOME}/.ssh/google_compute_engine"
if [ ! -f "$SSH_KEY_PATH" ]; then
    SSH_KEY_PATH="${HOME}/.ssh/id_rsa"
fi
if [ ! -f "$SSH_KEY_PATH" ]; then
    SSH_KEY_PATH=""
fi

# SSH 명령어 기본값
SSH_CMD="ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no"

# SSH 키가 있으면 명시적으로 지정
if [ -n "$SSH_KEY_PATH" ]; then
    SSH_CMD="$SSH_CMD -i $SSH_KEY_PATH"
fi

if [ -z "$GCP_IP" ]; then
    echo "❌ 사용법: bash check_crypto_health.sh <GCP_VM_IP> [GCP_VM_USER]"
    exit 1
fi

echo "🏥 암호화폐 자동매매 헬스체크..."
echo "VM IP: $GCP_IP"
echo "사용자: $GCP_USER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1️⃣ 서비스 상태
echo "1️⃣ 서비스 상태:"
$SSH_CMD "${GCP_USER}@${GCP_IP}" "sudo systemctl status aios-crypto-trader --no-pager" 2>/dev/null | grep -E "Active|Loaded" || echo "  ❌ 서비스 상태 확인 실패"

# 2️⃣ 프로세스 확인
echo ""
echo "2️⃣ 실행 중인 프로세스:"
PROCESS_COUNT=$($SSH_CMD "${GCP_USER}@${GCP_IP}" "ps aux | grep '[s]trategy_upbit' | wc -l" 2>/dev/null)
if [ "$PROCESS_COUNT" -gt 0 ]; then
    echo "  ✅ Python 프로세스 $PROCESS_COUNT개 실행 중"
    $SSH_CMD "${GCP_USER}@${GCP_IP}" "ps aux | grep '[s]trategy_upbit'" || true
else
    echo "  ❌ Python 프로세스 없음"
fi

# 3️⃣ 하트비트 파일 확인
echo ""
echo "3️⃣ 하트비트 파일:"
HEARTBEAT_DATA=$($SSH_CMD "${GCP_USER}@${GCP_IP}" "cat /tmp/crypto_heartbeat.json 2>/dev/null" || echo "")
if [ -n "$HEARTBEAT_DATA" ]; then
    echo "  ✅ 하트비트 파일 존재"
    echo "$HEARTBEAT_DATA" | jq . 2>/dev/null || echo "$HEARTBEAT_DATA"
else
    echo "  ⚠️  하트비트 파일 아직 생성 안 됨 (프로세스 시작 직후, 최대 30초 대기)"
fi

# 4️⃣ 거래 기록 확인
echo ""
echo "4️⃣ 거래 기록:"
TRADE_COUNT=$($SSH_CMD "${GCP_USER}@${GCP_IP}" "cat /tmp/crypto_trades.json 2>/dev/null | jq 'length' 2>/dev/null || echo 0")
echo "  거래 기록: $TRADE_COUNT개"

# 5️⃣ 최근 로그 확인
echo ""
echo "5️⃣ 최근 로그 (최근 30줄):"
$SSH_CMD "${GCP_USER}@${GCP_IP}" "sudo journalctl -u aios-crypto-trader -n 30 --no-pager 2>/dev/null || echo '로그 없음'" || true

# 6️⃣ 에러 확인
echo ""
echo "6️⃣ 최근 에러 로그:"
ERROR_COUNT=$($SSH_CMD "${GCP_USER}@${GCP_IP}" "sudo journalctl -u aios-crypto-trader -p err -n 10 --no-pager 2>/dev/null | wc -l")
if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "  ⚠️  에러 $ERROR_COUNT줄:"
    $SSH_CMD "${GCP_USER}@${GCP_IP}" "sudo journalctl -u aios-crypto-trader -p err -n 10 --no-pager" || true
else
    echo "  ✅ 에러 없음"
fi

# 7️⃣ 디스크 사용량
echo ""
echo "7️⃣ 디스크 사용량:"
$SSH_CMD "${GCP_USER}@${GCP_IP}" "df -h | grep -E '^/dev|^Filesystem'" || true

# 8️⃣ 메모리 사용량
echo ""
echo "8️⃣ 메모리 사용량:"
$SSH_CMD "${GCP_USER}@${GCP_IP}" "free -h 2>/dev/null || vm_stat" || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 헬스체크 완료"
echo ""
echo "💡 팁:"
echo "   - heartbeat가 갱신 안 되면: $SSH_CMD ${GCP_USER}@${GCP_IP} \"sudo systemctl restart aios-crypto-trader\""
echo "   - 실시간 로그 보기: $SSH_CMD ${GCP_USER}@${GCP_IP} \"sudo journalctl -u aios-crypto-trader -f\""
