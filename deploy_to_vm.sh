#!/bin/bash
# Mac → GCP VM 자동 배포 스크립트
# 사용: ./deploy_to_vm.sh [booster|all]

set -e

# 설정
VM_IP="34.50.1.187"
VM_USER="ubuntu"
SSH_KEY=~/.ssh/google_compute_engine
REMOTE_PATH="/home/ubuntu/AI-Investment-Operating-System"
LOCAL_PATH="/Users/mac/Documents/Codex/AI-Investment-Operating-System"

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 1. SSH 접속 테스트
check_connection() {
    log_info "VM 연결 확인 중..."
    if ssh -i $SSH_KEY -o ConnectTimeout=5 $VM_USER@$VM_IP "echo 'Connected'" &>/dev/null; then
        log_info "VM 연결 성공 ✓"
    else
        log_error "VM 연결 실패. SSH 설정을 확인하세요."
        exit 1
    fi
}

# 2. 부스터 설정 배포
deploy_booster() {
    log_info "부스터 설정 배포 중..."

    # 로컬 부스터 파일 확인
    if [ ! -f "$LOCAL_PATH/config/booster_config.json" ]; then
        log_error "부스터 설정 파일을 찾을 수 없습니다: $LOCAL_PATH/config/booster_config.json"
        exit 1
    fi

    # VM으로 SCP 전송
    scp -i $SSH_KEY "$LOCAL_PATH/config/booster_config.json" \
        $VM_USER@$VM_IP:$REMOTE_PATH/config/booster_config_live.json

    log_info "부스터 설정 배포 완료"
}

# 3. 부스터 로직 배포
deploy_booster_code() {
    log_info "부스터 코드 배포 중..."

    # 필요한 파일 목록
    files=(
        "src/pyqqq/strategy_upbit.py"
        "src/pyqqq/booster_config_api.py"
        "src/pyqqq/upbit_client.py"
        "src/pyqqq/claude_analyzer.py"
        "src/pyqqq/position_manager.py"
    )

    for file in "${files[@]}"; do
        if [ -f "$LOCAL_PATH/$file" ]; then
            scp -i $SSH_KEY "$LOCAL_PATH/$file" \
                $VM_USER@$VM_IP:$REMOTE_PATH/$file
            log_info "배포: $file"
        else
            log_warn "파일을 찾을 수 없음: $file (스킵)"
        fi
    done

    log_info "부스터 코드 배포 완료"
}

# 4. VM에서 서비스 재시작
restart_service() {
    log_info "VM 서비스 재시작 중..."

    ssh -i $SSH_KEY $VM_USER@$VM_IP << 'EOF'
    sudo systemctl restart aios-crypto-trader
    sleep 2
    sudo systemctl status aios-crypto-trader --no-pager | head -10
EOF

    log_info "서비스 재시작 완료"
}

# 5. 배포 후 상태 확인
verify_deployment() {
    log_info "배포 상태 확인 중..."

    ssh -i $SSH_KEY $VM_USER@$VM_IP << 'EOF'
    echo "=== Heartbeat 상태 ==="
    cat /tmp/crypto_heartbeat.json 2>/dev/null | jq . || echo "Heartbeat 파일 없음"

    echo ""
    echo "=== 부스터 설정 ==="
    cat /home/ubuntu/AI-Investment-Operating-System/config/booster_config_live.json 2>/dev/null | jq . || echo "설정 파일 없음"

    echo ""
    echo "=== 최근 로그 ==="
    sudo journalctl -u aios-crypto-trader -n 10 --no-pager || echo "로그 조회 실패"
EOF
}

# 메인 로직
main() {
    MODE=${1:-"all"}

    case $MODE in
        booster)
            log_info "부스터 전용 배포 모드"
            check_connection
            deploy_booster
            restart_service
            ;;
        code)
            log_info "코드 전용 배포 모드"
            check_connection
            deploy_booster_code
            restart_service
            ;;
        all)
            log_info "전체 배포 모드 (설정 + 코드)"
            check_connection
            deploy_booster
            deploy_booster_code
            restart_service
            ;;
        *)
            log_error "사용법: ./deploy_to_vm.sh [booster|code|all]"
            exit 1
            ;;
    esac

    sleep 3
    verify_deployment
    log_info "배포 완료!"
}

main "$@"
