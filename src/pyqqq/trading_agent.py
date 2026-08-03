"""
Claude AI 기반 거래 에이전트
- 자연언어 처리
- 함수 호출을 통한 명령 실행
- 대시보드와 통합
"""

import json
from anthropic import Anthropic
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class TradingAgent:
    """Claude를 이용한 거래 명령 에이전트"""

    def __init__(self, api_key: str = None):
        from .config import settings
        self.client = Anthropic(api_key=api_key or settings.claude_api_key)
        self.model = "claude-opus-5"
        self.config_file = Path('/Users/mac/Documents/Codex/AI-Investment-Operating-System/config/booster_config.json')
        self.conversation_history = []

    def _define_tools(self) -> list:
        """거래 관련 도구 정의"""
        return [
            {
                "name": "get_signals",
                "description": "현재 부스터가 분석 중인 매매 신호를 조회합니다",
                "input_schema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "get_current_price",
                "description": "특정 암호화폐의 현재 가격을 조회합니다",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "symbol": {
                            "type": "string",
                            "description": "코인 심볼 (예: BTC, ETH, SOL, ADA)"
                        }
                    },
                    "required": ["symbol"]
                }
            },
            {
                "name": "change_operating_mode",
                "description": "자동매매 운영 모드를 변경합니다",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "mode": {
                            "type": "string",
                            "enum": ["BOOSTER", "CONSERVATIVE", "GROWTH", "MANUAL"],
                            "description": "변경할 운영 모드"
                        },
                        "reason": {
                            "type": "string",
                            "description": "모드 변경 사유"
                        }
                    },
                    "required": ["mode"]
                }
            },
            {
                "name": "get_config",
                "description": "현재 운영 설정을 조회합니다",
                "input_schema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "get_portfolio",
                "description": "현재 포트폴리오 현황을 조회합니다",
                "input_schema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "place_order",
                "description": "시장가 주문을 실행합니다",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "symbol": {
                            "type": "string",
                            "description": "거래 심볼 (예: KRW-BTC)"
                        },
                        "side": {
                            "type": "string",
                            "enum": ["BUY", "SELL"],
                            "description": "매수/매도"
                        },
                        "amount": {
                            "type": "number",
                            "description": "거래 금액 (KRW)"
                        }
                    },
                    "required": ["symbol", "side", "amount"]
                }
            }
        ]

    def _execute_tool(self, tool_name: str, tool_input: dict) -> str:
        """도구 실행"""
        try:
            if tool_name == "get_signals":
                return self._get_signals()
            elif tool_name == "get_current_price":
                return self._get_price(tool_input["symbol"])
            elif tool_name == "change_operating_mode":
                return self._change_mode(tool_input["mode"], tool_input.get("reason", ""))
            elif tool_name == "get_config":
                return self._get_config()
            elif tool_name == "get_portfolio":
                return self._get_portfolio()
            elif tool_name == "place_order":
                return self._place_order(tool_input["symbol"], tool_input["side"], tool_input["amount"])
            else:
                return f"❌ 알 수 없는 도구: {tool_name}"
        except Exception as e:
            logger.error(f"❌ 도구 실행 오류: {e}")
            return f"❌ 오류: {str(e)}"

    def _get_signals(self) -> str:
        """현재 분석 중인 거래 신호 조회"""
        try:
            import os
            signal_file = "/tmp/current_signals.json"

            if not os.path.exists(signal_file):
                return "📊 현재 분석 중인 신호가 없습니다"

            with open(signal_file, 'r') as f:
                signals_data = json.load(f)

            total = signals_data.get("total_signals", 0)
            buy_signals = signals_data.get("buy_signals", [])
            sell_signals = signals_data.get("sell_signals", [])

            if total == 0:
                return "📊 현재 분석 중인 신호가 없습니다"

            msg = f"📊 현재 분석 신호 ({total}개):\n"

            if buy_signals:
                msg += f"\n🟢 매수 신호 ({len(buy_signals)}개):\n"
                for sig in buy_signals[:5]:  # 최대 5개만 표시
                    market = sig.get("market", "?")
                    confidence = sig.get("confidence", 0)
                    msg += f"  - {market}: 신뢰도 {confidence}%\n"

            if sell_signals:
                msg += f"\n🔴 매도 신호 ({len(sell_signals)}개):\n"
                for sig in sell_signals[:5]:  # 최대 5개만 표시
                    market = sig.get("market", "?")
                    msg += f"  - {market}\n"

            return msg
        except Exception as e:
            return f"❌ 신호 조회 오류: {str(e)}"

    def _get_price(self, symbol: str) -> str:
        """암호화폐 현재가 조회"""
        import subprocess
        try:
            result = subprocess.run(
                ["upbit", "market", "ticker", f"--symbol={symbol}"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                # JSON 파싱
                data = json.loads(result.stdout)
                price = data.get("trade_price", 0)
                return f"💹 {symbol} 현재가: ₩{price:,.0f}"
            else:
                return f"⚠️ {symbol} 조회 실패"
        except Exception as e:
            return f"❌ 가격 조회 오류: {str(e)}"

    def _change_mode(self, mode: str, reason: str) -> str:
        """운영 모드 변경"""
        try:
            with open(self.config_file, 'r') as f:
                config = json.load(f)

            old_mode = config.get("mode", "UNKNOWN")
            config["mode"] = mode

            # 모드별 설정 자동 적용
            mode_configs = {
                "BOOSTER": {
                    "strategy": {"cycle_seconds": 30},
                    "position": {"target_profit": 3.5, "stop_loss": -2.5, "hold_policy": "NO_HOLD"}
                },
                "CONSERVATIVE": {
                    "strategy": {"cycle_seconds": 300},
                    "position": {"target_profit": 2.0, "stop_loss": -4.0, "hold_policy": "SHORT_TERM"}
                },
                "GROWTH": {
                    "strategy": {"cycle_seconds": 60},
                    "position": {"target_profit": 5.0, "stop_loss": -3.0, "hold_policy": "MEDIUM_TERM"}
                },
                "MANUAL": {
                    "strategy": {"cycle_seconds": 0},
                    "position": {"hold_policy": "MANUAL"}
                }
            }

            if mode in mode_configs:
                config.update(mode_configs[mode])

            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)

            msg = f"✅ 운영 모드 변경: {old_mode} → {mode}"
            if reason:
                msg += f"\n📝 사유: {reason}"
            return msg
        except Exception as e:
            return f"❌ 모드 변경 오류: {str(e)}"

    def _get_config(self) -> str:
        """현재 설정 조회"""
        try:
            with open(self.config_file, 'r') as f:
                config = json.load(f)

            return f"""📊 현재 운영 설정:
- 모드: {config.get('mode')}
- 거래 활성화: {config.get('trading', {}).get('enabled')}
- 분석 주기: {config.get('strategy', {}).get('cycle_seconds')}초
- 수익 목표: {config.get('position', {}).get('target_profit')}%
- 손절 한도: {config.get('position', {}).get('stop_loss')}%
- 보유 정책: {config.get('position', {}).get('hold_policy')}"""
        except Exception as e:
            return f"❌ 설정 조회 오류: {str(e)}"

    def _get_portfolio(self) -> str:
        """포트폴리오 현황"""
        import subprocess
        try:
            result = subprocess.run(
                ["upbit", "accounts", "list"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                data = json.loads(result.stdout)

                # 데이터 형식 처리 (dict 또는 list)
                if isinstance(data, dict):
                    krw = data.get("KRW", {}).get("balance", 0)
                    holdings = {k: v.get("balance", 0) for k, v in data.items() if k != "KRW"}
                elif isinstance(data, list):
                    krw = 0
                    holdings = {}
                    for item in data:
                        if isinstance(item, dict):
                            currency = item.get("currency", "")
                            balance = float(item.get("balance", 0))
                            if currency == "KRW":
                                krw = balance
                            elif balance > 0:
                                holdings[currency] = balance
                else:
                    return "⚠️ 포트폴리오 조회 실패 (데이터 형식 오류)"

                # 보유 종목 출력
                holdings_str = ""
                if holdings:
                    holdings_str = "\n보유 종목:\n"
                    for currency, balance in holdings.items():
                        holdings_str += f"  - {currency}: {balance}\n"

                return f"""💰 포트폴리오:
현금 잔액: ₩{krw:,.0f}{holdings_str}"""
            else:
                return "⚠️ 포트폴리오 조회 실패"
        except Exception as e:
            return f"❌ 포트폴리오 조회 오류: {str(e)}"

    def _place_order(self, symbol: str, side: str, amount: float) -> str:
        """주문 실행"""
        import subprocess
        try:
            cmd = ["upbit", "orders", "create", f"--symbol={symbol}", f"--side={side}", f"--amount={amount}"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)

            if result.returncode == 0:
                return f"✅ {side} 주문 완료: {symbol} ₩{amount:,.0f}"
            else:
                return f"❌ 주문 실패: {result.stderr}"
        except Exception as e:
            return f"❌ 주문 오류: {str(e)}"

    def chat(self, user_message: str) -> str:
        """사용자 메시지에 응답"""
        # 대화 히스토리에 추가
        self.conversation_history.append({
            "role": "user",
            "content": user_message
        })

        # Claude 호출
        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            tools=self._define_tools(),
            messages=self.conversation_history,
            system="""당신은 암호화폐 자동매매 거래 에이전트입니다.
사용자의 자연언어 명령을 이해하고 적절한 도구를 사용하여 실행합니다.
- 가격 조회: "BTC 현재가는?" → get_current_price
- 모드 변경: "부스터 모드로 변경해" → change_operating_mode
- 포트폴리오: "현재 자산은?" → get_portfolio
- 주문: "BTC 100만원 매수" → place_order

항상 친절하고 정확하게 응답하세요."""
        )

        # 반복하며 도구 실행
        while response.stop_reason == "tool_use":
            assistant_message = {"role": "assistant", "content": response.content}
            self.conversation_history.append(assistant_message)

            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    tool_result = self._execute_tool(block.name, block.input)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": tool_result
                    })

            self.conversation_history.append({
                "role": "user",
                "content": tool_results
            })

            # 다시 Claude 호출
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                tools=self._define_tools(),
                messages=self.conversation_history
            )

        # 최종 응답 추출
        final_response = ""
        for block in response.content:
            if hasattr(block, "text"):
                final_response = block.text
                break

        # 대화 히스토리에 추가
        self.conversation_history.append({
            "role": "assistant",
            "content": final_response
        })

        return final_response


# 테스트
if __name__ == "__main__":
    agent = TradingAgent()

    # 테스트 명령어
    test_commands = [
        "현재 BTC 가격을 알려줘",
        "운영 모드를 CONSERVATIVE로 변경해",
        "현재 설정을 보여줘"
    ]

    for cmd in test_commands:
        print(f"\n👤 사용자: {cmd}")
        response = agent.chat(cmd)
        print(f"🤖 Claude: {response}")
