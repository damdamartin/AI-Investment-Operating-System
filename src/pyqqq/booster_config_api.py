"""
부스터 설정 실시간 동기화 API
- Mac에서 설정 변경 → VM에 HTTP POST로 전달
- VM은 설정을 받아서 즉시 적용
"""
import asyncio
import json
import logging
from datetime import datetime
from aiohttp import web
from pathlib import Path

logger = logging.getLogger(__name__)

BOOSTER_CONFIG_PATH = Path("/tmp/booster_config_live.json")


class BoosterConfigAPI:
    """실시간 부스터 설정 API 서버"""

    def __init__(self, port=8765):
        self.port = port
        self.app = web.Application()
        self.setup_routes()
        self.current_config = {}

    def setup_routes(self):
        """API 라우트 설정"""
        self.app.router.add_post("/booster/config", self.update_config)
        self.app.router.add_get("/booster/config", self.get_config)
        self.app.router.add_post("/booster/signal", self.apply_signal)
        self.app.router.add_get("/booster/status", self.get_status)

    async def update_config(self, request):
        """부스터 설정 업데이트"""
        try:
            data = await request.json()

            # 설정 검증
            validated_config = self._validate_config(data)

            # 파일에 저장
            BOOSTER_CONFIG_PATH.write_text(json.dumps(validated_config, indent=2))
            self.current_config = validated_config

            logger.info(f"✅ 부스터 설정 업데이트됨: {validated_config.get('mode')}")

            return web.json_response({
                "status": "success",
                "message": "부스터 설정이 업데이트되었습니다",
                "config": validated_config,
                "timestamp": datetime.now().isoformat()
            })
        except Exception as e:
            logger.error(f"❌ 설정 업데이트 실패: {e}")
            return web.json_response({
                "status": "error",
                "message": str(e)
            }, status=400)

    async def get_config(self, request):
        """현재 부스터 설정 조회"""
        try:
            if BOOSTER_CONFIG_PATH.exists():
                config = json.loads(BOOSTER_CONFIG_PATH.read_text())
            else:
                config = self.current_config

            return web.json_response({
                "status": "success",
                "config": config,
                "timestamp": datetime.now().isoformat()
            })
        except Exception as e:
            return web.json_response({
                "status": "error",
                "message": str(e)
            }, status=400)

    async def apply_signal(self, request):
        """외부에서 거래 신호 전달 (실시간)"""
        try:
            data = await request.json()

            signal = {
                "type": data.get("type"),  # BUY, SELL
                "coin": data.get("coin"),
                "confidence": data.get("confidence", 0.6),
                "amount": data.get("amount"),
                "timestamp": datetime.now().isoformat()
            }

            logger.info(f"📨 외부 신호 수신: {signal['type']} {signal['coin']} @{signal['confidence']}")

            return web.json_response({
                "status": "success",
                "message": "신호가 적용되었습니다",
                "signal": signal
            })
        except Exception as e:
            return web.json_response({
                "status": "error",
                "message": str(e)
            }, status=400)

    async def get_status(self, request):
        """부스터 현재 상태"""
        return web.json_response({
            "status": "active",
            "mode": self.current_config.get("mode", "BOOSTER"),
            "enabled": self.current_config.get("enabled", True),
            "timestamp": datetime.now().isoformat()
        })

    def _validate_config(self, config):
        """설정 검증"""
        required_fields = ["mode", "enabled"]
        for field in required_fields:
            if field not in config:
                raise ValueError(f"필수 필드 누락: {field}")

        return {
            "mode": config.get("mode", "BOOSTER"),
            "enabled": config.get("enabled", True),
            "signal": config.get("signal", {}),
            "trading": config.get("trading", {}),
            "risk": config.get("risk", {}),
            "updated_at": datetime.now().isoformat()
        }

    async def start(self):
        """서버 시작"""
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", self.port)
        await site.start()
        logger.info(f"🚀 부스터 설정 API 서버 시작: 0.0.0.0:{self.port}")


async def run_api_server():
    """부스터 API 서버 독립 실행"""
    api = BoosterConfigAPI(port=8765)
    await api.start()

    # 영구 실행
    while True:
        await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(run_api_server())
