#!/bin/bash

# 암호화폐 자동매매 실시간 모니터링 스크립트
# 사용법:
#   bash monitor_crypto_trading.sh <GCP_VM_IP> <MONITOR_TYPE> [GCP_VM_USER]
#
#   MONITOR_TYPE:
#     logs     - 실시간 로그 (가장 중요)
#     heartbeat - Heartbeat 파일 모니터링 (매 5초)
#     trades   - 거래 기록 모니터링
#     all      - 전체 상태 (한눈에 보기)

set -e

GCP_IP=$1
MONITOR_TYPE=${2:-logs}
GCP_USER=${3:-ubuntu}

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
    echo "❌ 사용법:"
    echo "   bash monitor_crypto_trading.sh <GCP_VM_IP> <MONITOR_TYPE> [GCP_VM_USER]"
    echo ""
    echo "예시:"
    echo "   bash monitor_crypto_trading.sh 34.64.178.159 logs"
    echo "   bash monitor_crypto_trading.sh 34.64.178.159 heartbeat"
    echo "   bash monitor_crypto_trading.sh 34.64.178.159 trades"
    echo "   bash monitor_crypto_trading.sh 34.64.178.159 all"
    exit 1
fi

echo "🚀 암호화폐 자동매매 모니터링 시작..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "VM IP: $GCP_IP"
echo "모니터링 유형: $MONITOR_TYPE"
echo "사용자: $GCP_USER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 종료하려면 Ctrl+C 를 누르세요"
echo ""

case $MONITOR_TYPE in
    logs)
        echo "📋 실시간 로그 모니터링 (실시간 추적 - 가장 중요)"
        echo ""
        echo "예상 로그:"
        echo "  LOOP START"
        echo "  ACCOUNT OK: KRW ..."
        echo "  MARKET DATA OK"
        echo "  SIGNAL: BUY/SELL/HOLD"
        echo "  LOOP END"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        $SSH_CMD "${GCP_USER}@${GCP_IP}" "sudo journalctl -u aios-crypto-trader -f"
        ;;

    heartbeat)
        echo "💓 Heartbeat 파일 모니터링 (매 5초 갱신)"
        echo ""
        echo "확인할 것:"
        echo "  - timestamp: 계속 변경되는가?"
        echo "  - loop_count: 계속 증가하는가?"
        echo "  - status: 'running'인가?"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        $SSH_CMD "${GCP_USER}@${GCP_IP}" "watch -n 5 'echo \"📊 마지막 갱신: \$(date +%H:%M:%S)\"; echo \"\"; cat /tmp/crypto_heartbeat.json | jq .'"
        ;;

    trades)
        echo "📈 거래 기록 모니터링"
        echo ""
        echo "거래가 발생하면 여기에 나타납니다."
        echo "주문 미실행 = 거래 신호 부재 또는 위험도 거부 (정상)"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        $SSH_CMD "${GCP_USER}@${GCP_IP}" "tail -f /tmp/crypto_trades.json"
        ;;

    all)
        echo "📊 전체 상태 모니터링"
        echo ""
        echo "다음 정보를 표시합니다:"
        echo "  1. 서비스 상태"
        echo "  2. 최근 Heartbeat"
        echo "  3. 거래 기록"
        echo "  4. 최근 로그"
        echo ""
        echo "5초마다 갱신됩니다..."
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""

        # 무한 루프로 5초마다 갱신
        while true; do
            clear
            echo "🚀 암호화폐 자동매매 실시간 모니터링"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "마지막 갱신: $(date '+%Y-%m-%d %H:%M:%S')"
            echo ""

            # 1️⃣ 서비스 상태
            echo "1️⃣ 서비스 상태:"
            $SSH_CMD "${GCP_USER}@${GCP_IP}" "sudo systemctl status aios-crypto-trader --no-pager | head -3" 2>/dev/null || echo "  ❌ 확인 불가"
            echo ""

            # 2️⃣ Heartbeat
            echo "2️⃣ Heartbeat (최근 상태):"
            HEARTBEAT=$($SSH_CMD "${GCP_USER}@${GCP_IP}" "cat /tmp/crypto_heartbeat.json 2>/dev/null || echo '{}'")
            echo "$HEARTBEAT" | jq '.' 2>/dev/null || echo "  파일 아직 생성 안 됨"
            echo ""

            # 3️⃣ 거래 기록
            echo "3️⃣ 거래 기록:"
            TRADE_COUNT=$($SSH_CMD "${GCP_USER}@${GCP_IP}" "cat /tmp/crypto_trades.json 2>/dev/null | jq 'length' 2>/dev/null || echo 0")
            if [ "$TRADE_COUNT" -eq 0 ]; then
                echo "  거래 기록: 없음 (신호 없음 또는 조건 미충족)"
            else
                echo "  거래 기록: $TRADE_COUNT개"
                # 최근 1개만 표시
                $SSH_CMD "${GCP_USER}@${GCP_IP}" "tail -1 /tmp/crypto_trades.json | jq ." 2>/dev/null || true
            fi
            echo ""

            # 4️⃣ 최근 로그
            echo "4️⃣ 최근 로그 (최근 5줄):"
            $SSH_CMD "${GCP_USER}@${GCP_IP}" "sudo journalctl -u aios-crypto-trader -n 5 --no-pager" 2>/dev/null || echo "  로그 없음"
            echo ""

            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "💡 Ctrl+C로 종료, 자동 갱신: 5초"

            sleep 5
        done
        ;;

    *)
        echo "❌ 알 수 없는 모니터링 유형: $MONITOR_TYPE"
        echo ""
        echo "사용 가능한 유형:"
        echo "  logs     - 실시간 로그"
        echo "  heartbeat - Heartbeat 모니터링"
        echo "  trades   - 거래 기록"
        echo "  all      - 전체 상태"
        exit 1
        ;;
esac
