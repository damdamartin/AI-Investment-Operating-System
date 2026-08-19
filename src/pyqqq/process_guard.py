"""
메인 자동매매 프로세스 단일 실행 보장
락 파일을 사용해 동일한 MainTradingSystem이 여러 개 실행되지 않도록 함
"""

import os
import sys
import psutil
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

LOCK_FILE = "/tmp/aios_main_trading_system.lock"


class ProcessGuard:
    """메인 프로세스 단일 실행 관리"""

    @staticmethod
    def acquire_lock() -> bool:
        """
        락을 획득하거나 실패

        Returns:
            True: 락 획득 성공 (이 프로세스가 단일 인스턴스)
            False: 이미 다른 프로세스가 실행 중
        """
        try:
            current_pid = os.getpid()

            # 기존 락 파일 확인
            if os.path.exists(LOCK_FILE):
                try:
                    with open(LOCK_FILE, 'r') as f:
                        existing_pid = int(f.read().strip())
                except (ValueError, IOError):
                    # 손상된 락 파일 → 초기화
                    ProcessGuard._write_lock(current_pid)
                    return True

                # 기존 PID가 살아있는지 확인
                if ProcessGuard._is_process_alive(existing_pid):
                    logger.error(
                        f"❌ 이미 다른 MainTradingSystem이 실행 중입니다 (PID: {existing_pid}). "
                        f"새 프로세스 시작 불가 (현재 PID: {current_pid})"
                    )
                    return False
                else:
                    # Stale lock → 정리하고 재취득
                    logger.warning(
                        f"⚠️  Stale lock 감지 (PID: {existing_pid} 종료됨) → 정리 후 재취득"
                    )
                    ProcessGuard._write_lock(current_pid)
                    return True
            else:
                # 락 파일 없음 → 새로 생성
                ProcessGuard._write_lock(current_pid)
                logger.info(f"✅ 락 획득 성공 (PID: {current_pid})")
                return True

        except Exception as e:
            logger.error(f"❌ 락 획득 실패: {e}")
            return False

    @staticmethod
    def release_lock() -> None:
        """
        종료 시 락 파일 제거
        """
        try:
            if os.path.exists(LOCK_FILE):
                os.remove(LOCK_FILE)
                logger.info(f"✅ 락 파일 제거됨 ({LOCK_FILE})")
        except Exception as e:
            logger.error(f"⚠️  락 파일 제거 실패: {e}")

    @staticmethod
    def _write_lock(pid: int) -> None:
        """현재 PID를 락 파일에 기록"""
        try:
            with open(LOCK_FILE, 'w') as f:
                f.write(str(pid))
            logger.info(f"✅ 락 파일 생성: {LOCK_FILE} (PID: {pid})")
        except Exception as e:
            logger.error(f"❌ 락 파일 쓰기 실패: {e}")

    @staticmethod
    def _is_process_alive(pid: int) -> bool:
        """
        주어진 PID의 프로세스가 실행 중인지 확인

        Args:
            pid: 확인할 프로세스 ID

        Returns:
            True: 프로세스 실행 중
            False: 프로세스 종료됨 또는 존재하지 않음
        """
        try:
            process = psutil.Process(pid)
            # 프로세스가 존재하고 실행 중인지 확인
            return process.is_running()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return False
        except Exception:
            return False

    @staticmethod
    def get_running_pids() -> list[int]:
        """
        현재 실행 중인 MainTradingSystem 프로세스 ID 목록

        Returns:
            실행 중인 PID 리스트
        """
        pids = []
        try:
            for proc in psutil.process_iter(['pid', 'cmdline']):
                try:
                    cmdline = ' '.join(proc.cmdline())
                    if 'MainTradingSystem' in cmdline or 'main_trading_system' in cmdline:
                        if proc.is_running():
                            pids.append(proc.pid)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
        except Exception as e:
            logger.warning(f"⚠️  프로세스 검색 실패: {e}")

        return pids

    @staticmethod
    def verify_single_instance() -> bool:
        """
        현재 실행 중인 인스턴스가 단 1개인지 확인

        Returns:
            True: 단일 인스턴스 OK
            False: 중복 실행 감지
        """
        pids = ProcessGuard.get_running_pids()
        current_pid = os.getpid()

        if len(pids) > 1:
            logger.warning(
                f"⚠️  중복 실행 감지! "
                f"현재: {current_pid}, 실행 중: {pids}"
            )
            return False
        elif len(pids) == 1 and pids[0] != current_pid:
            logger.error(
                f"❌ 다른 인스턴스 발견 (PID: {pids[0]}). "
                f"현재 프로세스: {current_pid}"
            )
            return False

        return True


async def main():
    """테스트"""
    logging.basicConfig(level=logging.INFO)

    print("\n" + "="*70)
    print("🔒 ProcessGuard 테스트")
    print("="*70)

    # 1. 락 획득
    if ProcessGuard.acquire_lock():
        print("✅ 락 획득 성공")

        # 2. 단일 인스턴스 확인
        if ProcessGuard.verify_single_instance():
            print("✅ 단일 인스턴스 확인됨")
        else:
            print("❌ 중복 실행 감지")

        # 3. 실행 중인 PID 확인
        pids = ProcessGuard.get_running_pids()
        print(f"📋 실행 중인 인스턴스: {pids}")

        # 4. 락 해제
        ProcessGuard.release_lock()
        print("✅ 락 해제됨")

    else:
        print("❌ 락 획득 실패 (다른 프로세스가 실행 중)")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
