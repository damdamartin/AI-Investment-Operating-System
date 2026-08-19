#!/bin/bash
# AIOS VM Services Install Script
# VM에서 systemd 서비스를 설치하고 자동시작을 활성화합니다.

set -e

echo "========================================="
echo "AIOS VM Services Installation"
echo "========================================="

# 1. 디렉토리 확인
echo "[1/5] Checking directories..."
if [ ! -d "/opt/aios/src" ]; then
    echo "ERROR: /opt/aios/src not found"
    exit 1
fi

if [ ! -f "/etc/aios/aios.env" ]; then
    echo "ERROR: /etc/aios/aios.env not found"
    exit 1
fi

echo "✓ Directories OK"

# 2. 로그 디렉토리 생성
echo "[2/5] Creating log directories..."
sudo mkdir -p /var/log/aios
sudo mkdir -p /var/lib/aios
sudo chown -R junkim_life360:junkim_life360 /var/log/aios
sudo chown -R junkim_life360:junkim_life360 /var/lib/aios
sudo chmod 755 /var/log/aios
sudo chmod 755 /var/lib/aios

echo "✓ Log directories created"

# 3. systemd 서비스 파일 복사
echo "[3/5] Installing systemd services..."
REPO_DIR="/opt/aios/src"

sudo cp ${REPO_DIR}/deployment/systemd/aios-crypto.service /etc/systemd/system/
sudo cp ${REPO_DIR}/deployment/systemd/aios-kis.service /etc/systemd/system/
sudo cp ${REPO_DIR}/deployment/systemd/aios-toss.service /etc/systemd/system/
sudo cp ${REPO_DIR}/deployment/systemd/aios-healthcheck.service /etc/systemd/system/
sudo cp ${REPO_DIR}/deployment/systemd/aios-healthcheck.timer /etc/systemd/system/

sudo chmod 644 /etc/systemd/system/aios-*.service
sudo chmod 644 /etc/systemd/system/aios-*.timer

echo "✓ Services installed"

# 4. daemon reload
echo "[4/5] Reloading systemd..."
sudo systemctl daemon-reload

echo "✓ Systemd reloaded"

# 5. 서비스 enable
echo "[5/5] Enabling services..."
sudo systemctl enable aios-crypto.service
sudo systemctl enable aios-kis.service
sudo systemctl enable aios-toss.service
sudo systemctl enable aios-healthcheck.timer

echo "✓ Services enabled"

echo ""
echo "========================================="
echo "Installation Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Start services:"
echo "     sudo systemctl start aios-crypto"
echo "     sudo systemctl start aios-kis"
echo "     sudo systemctl start aios-toss"
echo "     sudo systemctl start aios-healthcheck.timer"
echo ""
echo "  2. Check status:"
echo "     sudo systemctl status aios-crypto"
echo "     sudo systemctl status aios-kis"
echo "     sudo systemctl status aios-toss"
echo ""
echo "  3. View logs:"
echo "     tail -f /var/log/aios/crypto.log"
echo "     tail -f /var/log/aios/kis.log"
echo "     tail -f /var/log/aios/toss.log"
echo ""
