# 🚀 부스터 설정 동기화 전체 가이드

## 문제 & 해결책

| 문제 | 원인 | 해결책 |
|------|------|--------|
| **1. 부스터 미작동** | VM의 부스터 로직이 활성화되지 않음 | `booster_loader.py`로 설정 동적 로드 |
| **2. Mac-VM 통신 불가** | 일방향 배포만 가능 | REST API 기반 실시간 동기화 |
| **3. 업로드 실패** | SCP/배포 오류 | 자동화 배포 스크립트 + 상태 확인 |

---

## 📋 설정 단계

### **Step 1: VM에 필요한 파일 배포**

```bash
cd /Users/mac/Documents/Codex/AI-Investment-Operating-System

# 배포 스크립트 실행 권한 설정
chmod +x deploy_to_vm.sh

# 전체 배포 (설정 + 코드)
./deploy_to_vm.sh all

# 또는 부스터 설정만 배포
./deploy_to_vm.sh booster

# 또는 코드만 배포
./deploy_to_vm.sh code
```

**배포 결과:**
```
✅ VM 연결 성공 ✓
✅ 부스터 설정 배포 완료
✅ 부스터 코드 배포 완료
✅ 서비스 재시작 완료
✅ 배포 완료!
```

---

### **Step 2: Mac에서 부스터 실시간 감시 시작**

**필수 패키지 설치:**
```bash
pip install aiohttp watchdog
```

**명령어 선택:**

#### **옵션 A: 실시간 감시 모드 (권장)**
```bash
python3 mac_booster_client.py --vm-ip 34.50.1.187 --watch
```

**출력 예시:**
```
🚀 부스터 설정 감시 시작 (VM: 34.50.1.187:8765)
📁 감시 대상: /Users/mac/Documents/Codex/AI-Investment-Operating-System/config/booster_config.json
📋 설정 내용: { "mode": "BOOSTER", "enabled": true, ... }
✅ 설정 전송 성공: 부스터 설정이 업데이트되었습니다
✅ VM 상태 정상: BOOSTER (활성=True)
```

#### **옵션 B: 일회성 설정 전송**
```bash
python3 mac_booster_client.py --vm-ip 34.50.1.187 --send
```

#### **옵션 C: 테스트 신호 전송**
```bash
python3 mac_booster_client.py --vm-ip 34.50.1.187 --test-signal
```

**출력 예시:**
```
📨 신호 전송: BUY KRW-BTC @0.75
✅ 신호 전송 성공
📨 신호 전송: SELL KRW-BTC @0.65
✅ 신호 전송 성공
✅ 테스트 신호 전송 완료
```

---

### **Step 3: 부스터 설정 수정 (Mac)**

`/Users/mac/Documents/Codex/AI-Investment-Operating-System/config/booster_config.json` 파일을 수정하면:

1. Mac이 파일 변경 감지 (watchdog)
2. VM의 API 서버로 HTTP POST 전송
3. VM이 즉시 새 설정 적용
4. 거래에 반영됨 ✅

**예시: 신호 신뢰도 변경**

```json
{
  "signal": {
    "min_confidence": 0.70  // 60% → 70%로 변경
  }
}
```

**결과:**
```
🔄 설정 파일 변경 감지
📤 설정 전송 중... (34.50.1.187:8765)
✅ 설정 전송 성공
```

---

## 🔧 VM 배포 구조

### VM의 디렉토리 구조
```
/home/ubuntu/AI-Investment-Operating-System/
├── src/pyqqq/
│   ├── strategy_upbit.py         ← 부스터 로직 (메인)
│   ├── booster_loader.py         ← 설정 로더 (새로 추가)
│   ├── booster_config_api.py     ← API 서버 (새로 추가)
│   ├── upbit_client.py
│   └── ...
├── config/
│   ├── booster_config.json       ← 기본 설정
│   └── booster_config_live.json  ← 실시간 설정 (Mac에서 전송)
└── systemd/
    └── aios-crypto-trader.service
```

### systemd 서비스 설정
```bash
# VM에서 실행되는 명령어
sudo systemctl start aios-crypto-trader
sudo systemctl status aios-crypto-trader
sudo journalctl -u aios-crypto-trader -f
```

---

## 📊 모니터링

### VM 상태 확인 (Mac에서)

```bash
# Heartbeat 파일 모니터링
watch -n 5 'ssh -i ~/.ssh/google_compute_engine ubuntu@34.50.1.187 "cat /tmp/crypto_heartbeat.json | jq ."'

# 또는
ssh -i ~/.ssh/google_compute_engine ubuntu@34.50.1.187 "cat /tmp/crypto_heartbeat.json" | jq .
```

**Heartbeat 출력 예시:**
```json
{
  "timestamp": "2026-08-04T15:30:45.123456",
  "loop_count": 1845,
  "status": "RUNNING",
  "krw_balance": 1500000,
  "holdings_count": 3,
  "last_successful_order": "2026-08-04T15:30:30.123456"
}
```

### 실시간 로그 확인
```bash
ssh -i ~/.ssh/google_compute_engine ubuntu@34.50.1.187 "sudo journalctl -u aios-crypto-trader -f"
```

---

## ✅ 체크리스트

### 초기 설정 (1회)
- [ ] VM에 배포 스크립트 실행: `./deploy_to_vm.sh all`
- [ ] 배포 완료 확인
- [ ] Mac에 필수 패키지 설치: `pip install aiohttp watchdog`

### 일일 운영
- [ ] Mac에서 부스터 감시 시작: `python3 mac_booster_client.py --watch`
- [ ] VM Heartbeat 모니터링
- [ ] 거래 로그 확인

### 문제 해결
- [ ] 부스터 미작동 → 설정 파일 확인
- [ ] Mac-VM 연결 실패 → SSH 설정 확인
- [ ] 배포 오류 → `deploy_to_vm.sh` 재실행

---

## 🐛 문제 해결

### 문제 1: "VM 연결 실패"
```
❌ VM 연결 실패. SSH 설정을 확인하세요.
```

**해결:**
```bash
# SSH 키 확인
ls -la ~/.ssh/google_compute_engine

# VM SSH 테스트
ssh -i ~/.ssh/google_compute_engine ubuntu@34.50.1.187 "echo 'Connected'"

# gcloud 설정 확인
gcloud config list
gcloud auth list
```

### 문제 2: "설정 전송 실패 (HTTP 400)"
```
❌ 설정 전송 실패 (HTTP 400)
```

**해결:**
1. 설정 파일 JSON 형식 확인
2. 필수 필드 확인: `mode`, `enabled`
3. VM API 서버 상태 확인

```bash
# VM에서 API 포트 확인
ssh ubuntu@34.50.1.187 "sudo lsof -i :8765"

# API 서버 로그 확인
ssh ubuntu@34.50.1.187 "sudo journalctl -u booster-api -f"
```

### 문제 3: "부스터 여전히 작동 안 함"
```bash
# VM에서 부스터 설정 확인
ssh ubuntu@34.50.1.187 "cat /tmp/booster_config_live.json | jq ."

# 부스터 로더 로그 확인
ssh ubuntu@34.50.1.187 "sudo journalctl -u aios-crypto-trader | grep -i booster"
```

---

## 🚀 고급 설정

### Mac에 백그라운드 데몬으로 실행

```bash
# LaunchAgent 파일 생성
cat > ~/Library/LaunchAgents/com.booster.sync.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.booster.sync</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/mac/Documents/Codex/AI-Investment-Operating-System/mac_booster_client.py</string>
        <string>--watch</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/booster-sync.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/booster-sync.log</string>
</dict>
</plist>
EOF

# 백그라운드 실행
launchctl load ~/Library/LaunchAgents/com.booster.sync.plist

# 상태 확인
launchctl list | grep com.booster

# 로그 확인
tail -f /tmp/booster-sync.log
```

---

## 📝 요약

| 구성 | 역할 |
|------|------|
| **deploy_to_vm.sh** | Mac → VM 코드/설정 배포 |
| **booster_config_api.py** | VM의 REST API 서버 (설정 수신) |
| **booster_loader.py** | VM의 동적 설정 로더 |
| **mac_booster_client.py** | Mac의 실시간 감시 & 전송 |
| **booster_config.json** | 부스터 설정 (Mac에서 수정) |

---

## 🎯 다음 단계

1. ✅ **Step 1: 배포** → `./deploy_to_vm.sh all` 실행
2. ✅ **Step 2: 감시 시작** → `python3 mac_booster_client.py --watch` 실행
3. ✅ **Step 3: 설정 수정** → `booster_config.json` 파일 수정 후 자동 동기화
4. ✅ **Step 4: 모니터링** → Heartbeat & 로그 확인

---

**문제 발생 시 위 체크리스트와 문제 해결 섹션을 참고하세요.**
