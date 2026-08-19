#!/usr/bin/env python3
"""
Mac에서 부스터 설정을 VM으로 실시간 전송
- Mac의 설정 파일 변경 감지
- VM의 API 서버로 HTTP POST 전송
- 거래 신호도 실시간으로 전송 가능

사용:
    python3 mac_booster_client.py --vm-ip 34.50.1.187 --watch
"""
import json
import asyncio
import logging
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional
import aiohttp
import asyncio
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

CONFIG_PATH = Path("/Users/mac/Documents/Codex/AI-Investment-Operating-System/config/booster_config.json")


class BoosterConfigClient:
    """Mac → VM 부스터 설정 전송 클라이언트"""

    def __init__(self, vm_ip: str, vm_port: int = 8765):
        self.vm_ip = vm_ip
        self.vm_port = vm_port
        self.api_url = f"http://{vm_ip}:{vm_port}"
        self.last_config = None
        self.session: Optional[aiohttp.ClientSession] = None

    async def init_session(self):
        """HTTP 세션 초기화"""
        self.session = aiohttp.ClientSession()

    async def close_session(self):
        """HTTP 세션 종료"""
        if self.session:
            await self.session.close()

    async def send_config(self, config: dict) -> bool:
        """부스터 설정을 VM으로 전송"""
        try:
            if not self.session:
                await self.init_session()

            # API 엔드포인트
            endpoint = f"{self.api_url}/booster/config"

            logger.info(f"📤 설정 전송 중... ({self.vm_ip}:{self.vm_port})")

            async with self.session.post(
                endpoint,
                json=config,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    logger.info(f"✅ 설정 전송 성공: {result['message']}")
                    self.last_config = config
                    return True
                else:
                    error_text = await resp.text()
                    logger.error(f"❌ 설정 전송 실패 (HTTP {resp.status}): {error_text}")
                    return False

        except asyncio.TimeoutError:
            logger.error(f"❌ VM 연결 타임아웃 ({self.vm_ip}:{self.vm_port})")
            return False
        except Exception as e:
            logger.error(f"❌ 설정 전송 오류: {e}")
            return False

    async def get_config_from_vm(self) -> Optional[dict]:
        """VM에서 현재 설정 조회"""
        try:
            if not self.session:
                await self.init_session()

            endpoint = f"{self.api_url}/booster/config"

            async with self.session.get(
                endpoint,
                timeout=aiohttp.ClientTimeout(total=5)
            ) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    return result.get("config")
                else:
                    logger.error(f"❌ 설정 조회 실패 (HTTP {resp.status})")
                    return None

        except Exception as e:
            logger.error(f"❌ 설정 조회 오류: {e}")
            return None

    async def send_trading_signal(
        self,
        coin: str,
        signal_type: str,
        confidence: float,
        amount: float
    ) -> bool:
        """거래 신호 전송 (BUY/SELL)"""
        try:
            if not self.session:
                await self.init_session()

            endpoint = f"{self.api_url}/booster/signal"

            signal_data = {
                "type": signal_type.upper(),
                "coin": coin,
                "confidence": confidence,
                "amount": amount
            }

            logger.info(f"📨 신호 전송: {signal_type.upper()} {coin} @{confidence}")

            async with self.session.post(
                endpoint,
                json=signal_data,
                timeout=aiohttp.ClientTimeout(total=5)
            ) as resp:
                if resp.status == 200:
                    logger.info(f"✅ 신호 전송 성공")
                    return True
                else:
                    logger.error(f"❌ 신호 전송 실패 (HTTP {resp.status})")
                    return False

        except Exception as e:
            logger.error(f"❌ 신호 전송 오류: {e}")
            return False

    async def get_vm_status(self) -> Optional[dict]:
        """VM 부스터 상태 조회"""
        try:
            if not self.session:
                await self.init_session()

            endpoint = f"{self.api_url}/booster/status"

            async with self.session.get(
                endpoint,
                timeout=aiohttp.ClientTimeout(total=5)
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    logger.error(f"❌ 상태 조회 실패 (HTTP {resp.status})")
                    return None

        except Exception as e:
            logger.warning(f"⚠️  VM 상태 조회 불가 (연결 불가): {e}")
            return None


class ConfigFileWatcher(FileSystemEventHandler):
    """부스터 설정 파일 감시"""

    def __init__(self, client: BoosterConfigClient):
        self.client = client
        self.last_event_time = 0

    def on_modified(self, event):
        """파일 수정 감지"""
        if event.src_path == str(CONFIG_PATH):
            # 중복 이벤트 무시 (1초 내)
            now = datetime.now().timestamp()
            if now - self.last_event_time < 1:
                return

            self.last_event_time = now

            try:
                logger.info(f"🔄 설정 파일 변경 감지: {CONFIG_PATH}")
                config = json.loads(CONFIG_PATH.read_text())
                asyncio.create_task(self.client.send_config(config))
            except Exception as e:
                logger.error(f"❌ 설정 파일 읽기 오류: {e}")


async def watch_and_sync(vm_ip: str, vm_port: int = 8765):
    """파일 감시 및 실시간 동기화"""
    logger.info(f"🚀 부스터 설정 감시 시작 (VM: {vm_ip}:{vm_port})")
    logger.info(f"📁 감시 대상: {CONFIG_PATH}")

    client = BoosterConfigClient(vm_ip, vm_port)
    await client.init_session()

    # 초기 설정 전송
    try:
        config = json.loads(CONFIG_PATH.read_text())
        await client.send_config(config)
    except Exception as e:
        logger.error(f"❌ 초기 설정 전송 실패: {e}")

    # 파일 감시 시작
    observer = Observer()
    watcher = ConfigFileWatcher(client)
    observer.schedule(watcher, path=str(CONFIG_PATH.parent), recursive=False)
    observer.start()

    try:
        # 주기적으로 VM 상태 확인
        while True:
            await asyncio.sleep(10)
            status = await client.get_vm_status()
            if status:
                logger.info(f"✅ VM 상태 정상: {status['mode']} (활성={status['enabled']})")
            else:
                logger.warning(f"⚠️  VM 연결 불가 (재시도 중...)")
    except KeyboardInterrupt:
        logger.info("⛔ 감시 중단")
    finally:
        observer.stop()
        observer.join()
        await client.close_session()


async def send_single_config(vm_ip: str, config_path: Optional[str] = None):
    """일회성 설정 전송"""
    config_file = Path(config_path or CONFIG_PATH)

    if not config_file.exists():
        logger.error(f"❌ 설정 파일을 찾을 수 없음: {config_file}")
        return

    client = BoosterConfigClient(vm_ip)
    await client.init_session()

    try:
        config = json.loads(config_file.read_text())
        logger.info(f"📋 설정 내용:")
        logger.info(json.dumps(config, indent=2))

        success = await client.send_config(config)
        if success:
            logger.info("✅ 설정 전송 성공!")
        else:
            logger.error("❌ 설정 전송 실패!")

    finally:
        await client.close_session()


async def test_signal(vm_ip: str):
    """테스트 신호 전송"""
    client = BoosterConfigClient(vm_ip)
    await client.init_session()

    try:
        # 테스트 신호: BTC 매수
        await client.send_trading_signal(
            coin="KRW-BTC",
            signal_type="BUY",
            confidence=0.75,
            amount=100000
        )

        # 3초 후 매도 신호
        await asyncio.sleep(3)
        await client.send_trading_signal(
            coin="KRW-BTC",
            signal_type="SELL",
            confidence=0.65,
            amount=100000
        )

        logger.info("✅ 테스트 신호 전송 완료")
    finally:
        await client.close_session()


async def main():
    parser = argparse.ArgumentParser(
        description="Mac → GCP VM 부스터 설정 동기화"
    )
    parser.add_argument(
        "--vm-ip",
        default="34.50.1.187",
        help="GCP VM IP 주소 (기본값: 34.50.1.187)"
    )
    parser.add_argument(
        "--vm-port",
        type=int,
        default=8765,
        help="VM API 포트 (기본값: 8765)"
    )
    parser.add_argument(
        "--watch",
        action="store_true",
        help="파일 감시 모드 (실시간 동기화)"
    )
    parser.add_argument(
        "--send",
        action="store_true",
        help="일회성 설정 전송"
    )
    parser.add_argument(
        "--config",
        help="커스텀 설정 파일 경로"
    )
    parser.add_argument(
        "--test-signal",
        action="store_true",
        help="테스트 거래 신호 전송"
    )

    args = parser.parse_args()

    if args.watch:
        await watch_and_sync(args.vm_ip, args.vm_port)
    elif args.send:
        await send_single_config(args.vm_ip, args.config)
    elif args.test_signal:
        await test_signal(args.vm_ip)
    else:
        # 기본값: 파일 감시 모드
        await watch_and_sync(args.vm_ip, args.vm_port)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("종료됨")
