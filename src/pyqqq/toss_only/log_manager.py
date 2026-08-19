"""🔧 P1 수정 #3: 로그 압축 및 관리 유틸리티"""

import os
import gzip
import logging
from pathlib import Path
from datetime import datetime
from logging.handlers import RotatingFileHandler

logger = logging.getLogger(__name__)


class TossLogManager:
    """Toss 거래 로그 자동 압축 및 관리"""

    def __init__(self, log_dir: str, rotation_mb: int = 100, backup_count: int = 5):
        """
        Args:
            log_dir: 로그 파일 저장 디렉토리
            rotation_mb: 로그 파일 회전 크기 (MB)
            backup_count: 보관할 최대 로그 파일 개수
        """
        self.log_dir = Path(log_dir)
        self.rotation_bytes = rotation_mb * 1024 * 1024  # MB → Bytes
        self.backup_count = backup_count

        # 로그 디렉토리 생성
        self.log_dir.mkdir(parents=True, exist_ok=True)

    def compress_old_logs(self) -> int:
        """🔧 P1 수정 #3: 오래된 로그 파일 압축"""
        compressed_count = 0

        try:
            # 로그 파일 검색 (.log 파일)
            log_files = list(self.log_dir.glob("*.log"))

            for log_file in log_files:
                # 이미 압축된 파일은 제외
                if log_file.suffix == ".gz":
                    continue

                # 파일 크기 확인
                file_size = log_file.stat().st_size
                if file_size < self.rotation_bytes:
                    continue  # 크기 미만이면 압축 안 함

                # 압축 처리
                gz_file = log_file.with_suffix(".log.gz")
                try:
                    with open(log_file, "rb") as f_in:
                        with gzip.open(gz_file, "wb") as f_out:
                            f_out.writelines(f_in)

                    # 원본 파일 삭제
                    log_file.unlink()
                    compressed_count += 1
                    logger.info(
                        f"✅ 로그 압축: {log_file.name} "
                        f"({file_size / 1024 / 1024:.1f}MB) → {gz_file.name}"
                    )
                except Exception as e:
                    logger.error(f"❌ 로그 압축 실패 ({log_file.name}): {e}")

        except Exception as e:
            logger.error(f"❌ 로그 관리 오류: {e}")

        return compressed_count

    def cleanup_old_backups(self) -> int:
        """🔧 P1 수정 #3: 오래된 백업 파일 삭제"""
        deleted_count = 0

        try:
            # 압축된 로그 파일 (.log.gz) 검색
            gz_files = sorted(
                self.log_dir.glob("*.log.gz"),
                key=lambda x: x.stat().st_mtime,  # 수정 시간 기준 정렬
                reverse=True
            )

            # 최신 backup_count개 파일만 보관, 나머지 삭제
            for gz_file in gz_files[self.backup_count:]:
                try:
                    gz_file.unlink()
                    deleted_count += 1
                    logger.info(f"🗑️ 오래된 로그 삭제: {gz_file.name}")
                except Exception as e:
                    logger.error(f"❌ 파일 삭제 실패 ({gz_file.name}): {e}")

        except Exception as e:
            logger.error(f"❌ 정리 중 오류: {e}")

        return deleted_count

    def get_log_dir_size_mb(self) -> float:
        """로그 디렉토리 전체 용량 (MB)"""
        total_size = 0
        try:
            for file in self.log_dir.rglob("*"):
                if file.is_file():
                    total_size += file.stat().st_size
        except Exception as e:
            logger.error(f"❌ 디렉토리 크기 계산 오류: {e}")

        return total_size / 1024 / 1024

    async def run_maintenance(self) -> dict:
        """🔧 P1 수정 #3: 주기적 로그 유지보수 실행"""
        result = {
            "compressed": self.compress_old_logs(),
            "deleted": self.cleanup_old_backups(),
            "dir_size_mb": self.get_log_dir_size_mb(),
        }

        logger.info(
            f"📊 로그 관리 완료: 압축 {result['compressed']}개, "
            f"삭제 {result['deleted']}개, 현재 크기 {result['dir_size_mb']:.1f}MB"
        )

        return result


def setup_rotating_logger(
    name: str,
    log_dir: str = "/Users/mac/Desktop/trading_logs/",
    rotation_mb: int = 100,
    backup_count: int = 5,
) -> logging.Logger:
    """🔧 P1 수정 #3: 자동 회전 로거 설정"""

    logger_obj = logging.getLogger(name)

    if not logger_obj.handlers:
        # 로그 디렉토리 생성
        Path(log_dir).mkdir(parents=True, exist_ok=True)

        # 파일명: toss_trading_YYYYMMDD_HHMMSS.log
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_file = Path(log_dir) / f"toss_trading_{timestamp}.log"

        # RotatingFileHandler: 파일 크기 도달 시 자동 회전
        handler = RotatingFileHandler(
            log_file,
            maxBytes=rotation_mb * 1024 * 1024,  # MB → Bytes
            backupCount=backup_count,
        )

        # 포맷 설정
        formatter = logging.Formatter(
            "%(asctime)s | %(name)s | %(levelname)-8s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)

        logger_obj.addHandler(handler)
        logger_obj.setLevel(logging.INFO)

        logging.info(f"✅ 로그 초기화: {log_file}")

    return logger_obj
