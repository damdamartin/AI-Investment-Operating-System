"""
매매전략팀 에이전트 - 진입/손절/익절, 목표가, 포지션 크기 결정
각 신호를 실제 거래 액션으로 변환합니다.
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any
import anthropic

# 팀장 추가: 데이터 소스 및 API 비용 관리 통합
from data_source_manager import DataSourceManager
from api_cost_manager import APICallWrapper
from config import settings

class StrategyAgent:
    def __init__(self, data_source_manager=None, api_wrapper=None):
        self.client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        self.model = settings.claude_model

        # 팀장 추가: 데이터 소스와 API 래퍼 주입
        self.data_source = data_source_manager
        self.api_wrapper = api_wrapper or APICallWrapper(self.client)

        # 마켓별 설정
        self.market_config = {
            "KR": {  # 한국주식 - 보수적
                "stop_loss_pct": 0.02,      # -2%
                "take_profit_pct": 0.03,   # +3%
                "position_size_pct": 0.05, # 포트폴리오 5%
                "max_concurrent": 3,       # 최대 3개 동시 진입
            },
            "US": {  # 미국주식 - 적극적
                "stop_loss_pct": 0.05,     # -5%
                "take_profit_pct": 0.10,   # +10%
                "position_size_pct": 0.08, # 포트폴리오 8%
                "max_concurrent": 5,       # 최대 5개 동시 진입
            }
        }

    async def generate_trade_plan(
        self,
        symbol: str,
        symbol_name: str,
        market: str,  # "KR" or "US"
        research_signal: dict,
        analysis_signal: dict,
        current_price: float = None,
        portfolio_value: float = 1000000,
        current_positions: dict = None
    ) -> dict:
        """
        리서치팀과 종목분석팀의 신호를 받아서 실제 거래 계획을 생성합니다.

        Args:
            symbol: 종목코드
            symbol_name: 종목명
            market: 시장 ("KR" 또는 "US")
            research_signal: 리서치팀 신호
            analysis_signal: 종목분석팀 신호
            current_price: 현재가
            portfolio_value: 포트폴리오 총액
            current_positions: 현재 보유 포지션

        Returns:
            {
                'action': 'BUY' | 'SELL' | 'HOLD',
                'quantity': int,
                'entry_price': float,
                'stop_loss_price': float,
                'take_profit_price': float,
                'position_size_pct': float,
                'position_size_amount': float,
                'expected_return': float,
                'max_loss': float,
                'risk_reward_ratio': float,
                'confidence': float,
                'reasoning': str,
                'market_rules': str
            }
        """

        # 팀장 추가: 현재가 자동 조회
        if not current_price and self.data_source:
            try:
                current_price = await self.data_source.price_feed.get_price(symbol)
                current_price = current_price or 0
            except Exception as e:
                print(f"현재가 조회 오류: {e}")
                current_price = 0

        config = self.market_config.get(market, self.market_config["KR"])
        current_positions = current_positions or {}

        prompt = f"""
당신은 경험 많은 포트폴리오 매니저입니다. 리서치팀과 분석팀의 신호를 받아서 구체적인 거래 계획을 세우세요.

[종목 정보]
- 종목코드: {symbol}
- 종목명: {symbol_name}
- 시장: {market} ({'한국주식 - 보수적' if market == 'KR' else '미국주식 - 적극적'})
- 현재가: {current_price:,.0f}
- 포트폴리오 총액: {portfolio_value:,.0f}

[리서치팀 신호]
- 신호: {research_signal.get('signal')}
- 신뢰도: {research_signal.get('confidence', 0):.1%}
- 근거: {research_signal.get('reasoning')}

[종목분석팀 신호]
- 신호: {analysis_signal.get('signal')}
- 신뢰도: {analysis_signal.get('confidence', 0):.1%}
- 목표가: {analysis_signal.get('target_price', current_price)}
- 손절가: {analysis_signal.get('stop_loss', current_price * 0.98)}

[현재 포지션]
- 보유 종목: {list(current_positions.keys()) if current_positions else 'None'}
- 활성 주문: 0

[매매 규칙]
- 시장: {market}
- 손절: {config['stop_loss_pct']:.1%}
- 익절: {config['take_profit_pct']:.1%}
- 포지션 크기: 포트폴리오 {config['position_size_pct']:.1%}
- 최대 동시 진입: {config['max_concurrent']}개

[의사결정]
두 팀의 신호가 모두 BUY면:
1. 진입가 = 현재가 기준
2. 수량 = 포트폴리오 {config['position_size_pct']:.1%} / 현재가
3. 손절 = 진입가 × (1 - {config['stop_loss_pct']:.1%})
4. 익절 = 진입가 × (1 + {config['take_profit_pct']:.1%})

[응답 형식]
JSON으로:
- action: "BUY" | "SELL" | "HOLD"
- quantity: 수량 (주)
- entry_price: 진입가
- stop_loss_price: 손절가
- take_profit_price: 익절가
- position_size_pct: 포트폴리오 비중
- position_size_amount: 금액
- expected_return: 기대수익
- max_loss: 최대손실
- risk_reward_ratio: 위험수익비율
- confidence: 신뢰도 (0~1)
- reasoning: 최종 판단 근거
- market_rules: 시장 규칙 적용 설명
"""

        try:
            # 팀장 추가: API 래퍼를 통한 안전한 호출
            if self.api_wrapper:
                response_text = await self.api_wrapper.call_claude(
                    prompt=prompt,
                    max_tokens=1024,
                    team_name="strategy"
                )
            else:
                # Fallback
                message = self.client.messages.create(
                    model=self.model,
                    max_tokens=1024,
                    messages=[{"role": "user", "content": prompt}]
                )
                response_text = message.content[0].text

            try:
                if "```json" in response_text:
                    json_str = response_text.split("```json")[1].split("```")[0]
                else:
                    json_str = response_text

                plan = json.loads(json_str)
            except json.JSONDecodeError:
                plan = {
                    "action": "HOLD",
                    "quantity": 0,
                    "entry_price": current_price,
                    "stop_loss_price": current_price * (1 - config['stop_loss_pct']),
                    "take_profit_price": current_price * (1 + config['take_profit_pct']),
                    "position_size_pct": 0,
                    "position_size_amount": 0,
                    "expected_return": 0,
                    "max_loss": 0,
                    "risk_reward_ratio": 0,
                    "confidence": 0.5,
                    "reasoning": response_text
                }

            plan["symbol"] = symbol
            plan["symbol_name"] = symbol_name
            plan["market"] = market
            plan["timestamp"] = datetime.now().isoformat()

            return plan

        except Exception as e:
            print(f"매매전략팀 오류 ({symbol}): {e}")
            return {
                "action": "HOLD",
                "quantity": 0,
                "entry_price": current_price,
                "stop_loss_price": current_price * (1 - config['stop_loss_pct']),
                "take_profit_price": current_price * (1 + config['take_profit_pct']),
                "position_size_pct": 0,
                "position_size_amount": 0,
                "expected_return": 0,
                "max_loss": 0,
                "risk_reward_ratio": 0,
                "confidence": 0.0,
                "reasoning": f"API 오류: {str(e)}",
                "symbol": symbol,
                "symbol_name": symbol_name,
                "market": market,
                "timestamp": datetime.now().isoformat()
            }


if __name__ == "__main__":
    agent = StrategyAgent()

    plan = agent.generate_trade_plan(
        symbol="005930",
        symbol_name="Samsung Electronics",
        market="KR",
        research_signal={
            "signal": "BUY",
            "confidence": 0.8,
            "reasoning": "신제품 출시 호재"
        },
        analysis_signal={
            "signal": "BUY",
            "confidence": 0.75,
            "target_price": 73000,
            "stop_loss": 68600
        },
        current_price=70000,
        portfolio_value=1000000
    )

    print(json.dumps(plan, indent=2, ensure_ascii=False))
