from anthropic import Anthropic
from typing import Dict, Any, Optional
from .config import settings
import json


class ClaudeAnalyzer:
    """Claude AI를 이용한 종목 분석"""

    def __init__(self):
        self.client = Anthropic(api_key=settings.claude_api_key)
        self.model = "claude-3-5-sonnet-20241022"

    async def analyze_stock(
        self,
        symbol: str,
        current_price: float,
        recent_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """종목 분석 및 매매 신호 생성"""

        prompt = f"""
당신은 전문 투자 분석가입니다. 다음 종목을 분석하고 매매 신호를 제시하세요.

**종목 정보**:
- 종목코드: {symbol}
- 현재가: {current_price:,.0f}원

**데이터**:
{json.dumps(recent_data or {}, indent=2, ensure_ascii=False)}

다음 JSON 형식으로 정확히 응답하세요:
{{
  "recommendation": "BUY" 또는 "SELL" 또는 "HOLD",
  "confidence": 0.0~1.0,
  "entry_price": {current_price},
  "stop_loss_price": 진입가 기준 -5%,
  "take_profit_price": 진입가 기준 +10%,
  "reasoning": "분석 근거 (2-3줄)"
}}
"""

        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            response_text = message.content[0].text

            # JSON 파싱
            try:
                result = json.loads(response_text)
                return result
            except json.JSONDecodeError:
                # JSON 블록 추출 시도
                start = response_text.find('{')
                end = response_text.rfind('}') + 1
                if start >= 0 and end > start:
                    result = json.loads(response_text[start:end])
                    return result
                else:
                    return self._fallback_analysis(symbol, current_price)

        except Exception as e:
            print(f"❌ Claude 분석 오류 ({symbol}): {e}")
            return self._fallback_analysis(symbol, current_price)

    def _fallback_analysis(self, symbol: str, current_price: float) -> Dict[str, Any]:
        """분석 실패 시 기본값"""
        return {
            "recommendation": "HOLD",
            "confidence": 0.5,
            "entry_price": current_price,
            "stop_loss_price": current_price * 0.95,
            "take_profit_price": current_price * 1.10,
            "reasoning": "Claude 분석 불가 - 기본 HOLD"
        }

    async def recommend_assets(self) -> list[Dict[str, Any]]:
        """새로운 종목 추천"""

        prompt = """
한국 주식 시장에서 현재 유망한 종목 3개를 추천하세요.

다음 JSON 형식으로 응답하세요:
[
  {
    "symbol": "종목코드",
    "name": "회사명",
    "reason": "추천 근거",
    "confidence": 0.0~1.0
  }
]
"""

        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            response_text = message.content[0].text

            # JSON 파싱
            start = response_text.find('[')
            end = response_text.rfind(']') + 1
            if start >= 0 and end > start:
                result = json.loads(response_text[start:end])
                return result
            return []

        except Exception as e:
            print(f"❌ 종목 추천 오류: {e}")
            return []
