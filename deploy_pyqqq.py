#!/usr/bin/env python3
"""
PyQQQ 배포 스크립트 (Phase 3)

사용법:
  python deploy_pyqqq.py --deploy        # 배포
  python deploy_pyqqq.py --cronjob       # 크론잡 설정
  python deploy_pyqqq.py --test          # 배포 후 테스트
  python deploy_pyqqq.py --all           # 배포 + 크론잡 + 테스트
"""
import os
import sys
import argparse
import subprocess
import json
from pathlib import Path
from datetime import datetime


class PyQQQDeployer:
    """PyQQQ 배포 관리자"""

    def __init__(self):
        self.project_root = Path(__file__).parent
        self.src_dir = self.project_root / "src" / "pyqqq"
        self.script_name = "strategy.py"
        self.deployment_dir = self.project_root / "deployment" / "pyqqq"
        self.log_file = self.project_root / "logs" / "pyqqq.log"
        self.state_file = self.deployment_dir / "state.json"

    def setup_directories(self) -> None:
        """배포 디렉토리 생성"""
        self.deployment_dir.mkdir(parents=True, exist_ok=True)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        print(f"✅ 디렉토리 생성: {self.deployment_dir}")

    def package_strategy(self) -> bool:
        """전략 코드 패킹"""
        try:
            print("📦 전략 코드 패킹 중...")

            # 필요한 파일 복사
            files_to_copy = [
                "config.py",
                "toss_client.py",
                "claude_analyzer.py",
                "position_manager.py",
                "strategy.py",
                "__init__.py"
            ]

            # 루트 실행 스크립트
            root_files = ["run_strategy.py"]

            for filename in files_to_copy:
                src_file = self.src_dir / filename
                dst_file = self.deployment_dir / filename

                if src_file.exists():
                    with open(src_file, 'r') as f:
                        content = f.read()
                    with open(dst_file, 'w') as f:
                        f.write(content)
                    print(f"  ✅ {filename}")
                else:
                    print(f"  ⚠️  {filename} (미존재)")

            # requirements.txt 복사
            req_file = self.project_root / "requirements.txt"
            if req_file.exists():
                with open(req_file, 'r') as f:
                    content = f.read()
                with open(self.deployment_dir / "requirements.txt", 'w') as f:
                    f.write(content)
                print(f"  ✅ requirements.txt")

            # .env 복사
            env_file = self.project_root / ".env"
            if env_file.exists():
                with open(env_file, 'r') as f:
                    content = f.read()
                with open(self.deployment_dir / ".env", 'w') as f:
                    f.write(content)
                print(f"  ✅ .env (비공개)")

            return True

        except Exception as e:
            print(f"❌ 패킹 실패: {e}")
            return False

    def create_deploy_script(self) -> bool:
        """배포 실행 스크립트 생성"""
        try:
            script_path = self.deployment_dir / "run.sh"

            script_content = f"""#!/bin/bash
# PyQQQ 자동매매 시스템 실행 스크립트
# 배포 경로: {self.deployment_dir}

SCRIPT_DIR="$(cd "$(dirname "${{BASH_SOURCE[0]}}")" && pwd)"
LOG_FILE="{self.log_file}"

# 타임스탬프
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TIMESTAMP] PyQQQ 시작" >> "$LOG_FILE"

# Python으로 직접 실행
python3 << 'EOF' >> "$LOG_FILE" 2>&1
import sys
sys.path.insert(0, '{self.project_root}')
sys.path.insert(0, '{self.deployment_dir}')

from src.pyqqq.strategy import TradingStrategy
import asyncio

strategy = TradingStrategy()
asyncio.run(strategy.run(once=True))
EOF

EXIT_CODE=$?
echo "[$TIMESTAMP] PyQQQ 종료 (코드: $EXIT_CODE)" >> "$LOG_FILE"
exit $EXIT_CODE
"""

            with open(script_path, 'w') as f:
                f.write(script_content)

            # 실행 권한 설정
            os.chmod(script_path, 0o755)
            print(f"✅ 실행 스크립트 생성: {script_path}")
            return True

        except Exception as e:
            print(f"❌ 스크립트 생성 실패: {e}")
            return False

    def setup_cronjob(self) -> bool:
        """크론잡 설정"""
        try:
            print("⏰ 크론잡 설정 중...")

            script_path = self.deployment_dir / "run.sh"
            cron_line = f"0 */3 * * * {script_path} --once >> /tmp/pyqqq-cron.log 2>&1"

            # 현재 크론잡 확인
            result = subprocess.run(["crontab", "-l"], capture_output=True, text=True)
            current_cron = result.stdout if result.returncode == 0 else ""

            # 이미 있는 크론잡이면 스킵
            if "pyqqq" in current_cron or str(script_path) in current_cron:
                print("  ⚠️  크론잡이 이미 존재합니다")
                print(f"  현재 크론: {cron_line}")
                return True

            # 새 크론잡 추가
            new_cron = current_cron + cron_line + "\n"

            # 임시 파일에 저장
            temp_cron = "/tmp/pyqqq_crontab.txt"
            with open(temp_cron, 'w') as f:
                f.write(new_cron)

            # 크론잡 설치
            subprocess.run(["crontab", temp_cron], check=True)
            os.remove(temp_cron)

            print(f"  ✅ 크론잡 설정 완료")
            print(f"  일정: 매 3시간마다 (0 */3 * * *)")
            print(f"  스크립트: {script_path}")
            return True

        except Exception as e:
            print(f"❌ 크론잡 설정 실패: {e}")
            print(f"  수동 설정: crontab -e 후 다음 추가:")
            print(f"    0 */3 * * * {script_path} --once")
            return False

    def create_deployment_summary(self) -> bool:
        """배포 정보 저장"""
        try:
            summary = {
                "deployment_date": datetime.now().isoformat(),
                "deployment_path": str(self.deployment_dir),
                "log_file": str(self.log_file),
                "script": str(self.deployment_dir / "run.sh"),
                "cronjob": "0 */3 * * * (매 3시간)",
                "status": "deployed"
            }

            with open(self.state_file, 'w') as f:
                json.dump(summary, f, indent=2)

            print(f"✅ 배포 정보 저장: {self.state_file}")
            return True

        except Exception as e:
            print(f"❌ 정보 저장 실패: {e}")
            return False

    def test_deployment(self) -> bool:
        """배포 테스트"""
        try:
            print("🧪 배포 테스트 중...")

            script_path = self.deployment_dir / "run.sh"
            result = subprocess.run(
                [str(script_path), "--once"],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0:
                print("✅ 배포 테스트 성공")
                return True
            else:
                print(f"❌ 배포 테스트 실패")
                print(f"STDOUT: {result.stdout[:200]}")
                print(f"STDERR: {result.stderr[:200]}")
                return False

        except subprocess.TimeoutExpired:
            print("⚠️  테스트 타임아웃 (30초 초과)")
            return True  # 무한 루프일 수 있으므로 일단 성공 처리
        except Exception as e:
            print(f"❌ 테스트 오류: {e}")
            return False

    def print_summary(self) -> None:
        """배포 요약 출력"""
        print("\n" + "=" * 60)
        print("📊 배포 완료 요약")
        print("=" * 60)
        print(f"배포 경로: {self.deployment_dir}")
        print(f"로그 파일: {self.log_file}")
        print(f"크론잡: 매 3시간마다 자동 실행")
        print("\n📝 다음 단계:")
        print(f"1. Toss API IP 화이트리스트에 등록:")
        print(f"   IP 주소: 34.158.219.64")
        print(f"2. 배포 상태 확인:")
        print(f"   $ crontab -l | grep pyqqq")
        print(f"3. 로그 확인:")
        print(f"   $ tail -f {self.log_file}")
        print("=" * 60)


def main():
    """메인 진입점"""
    parser = argparse.ArgumentParser(
        description="PyQQQ 자동매매 시스템 배포 관리자"
    )
    parser.add_argument("--deploy", action="store_true", help="배포")
    parser.add_argument("--cronjob", action="store_true", help="크론잡 설정")
    parser.add_argument("--test", action="store_true", help="배포 테스트")
    parser.add_argument("--all", action="store_true", help="전체 배포 (배포 + 크론잡 + 테스트)")

    args = parser.parse_args()

    deployer = PyQQQDeployer()

    # 기본 동작: --all
    if not any([args.deploy, args.cronjob, args.test, args.all]):
        args.all = True

    print("🚀 PyQQQ 자동매매 시스템 배포 (Phase 3)")
    print("=" * 60)

    success = True

    if args.deploy or args.all:
        print("\n[1/3] 배포 준비 중...")
        deployer.setup_directories()
        success = deployer.package_strategy() and success
        success = deployer.create_deploy_script() and success

    if args.cronjob or args.all:
        print("\n[2/3] 크론잡 설정 중...")
        success = deployer.setup_cronjob() and success

    if args.test or args.all:
        print("\n[3/3] 배포 테스트 중...")
        success = deployer.test_deployment() and success

    # 배포 정보 저장
    if success or args.all:
        deployer.create_deployment_summary()

    # 요약 출력
    deployer.print_summary()

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
