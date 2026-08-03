from anthropic import Anthropic
from typing import Dict, Any, Optional
from .config import settings
from .technical_indicators import analyze_market
import json


class ClaudeAnalyzer:
    """Claude AI를 이용한 암호화폐 분석"""

    def __init__(self):
        self.client = Anthropic(api_key=settings.claude_api_key)
        self.model = settings.claude_model

    def analyze_crypto(
        self,
        symbol: str,
        ticker: Dict[str, Any],
        ohlc_data: Optional[list] = None
    ) -> Dict[str, Any]:
        """암호화폐 분석 및 매매 신호 생성 (Claude AI + 기술적 지표)"""

        # 기술적 지표 계산
        indicators = {}
        if ohlc_data:
            indicators = analyze_market(ticker, ohlc_data)

        current_price = float(ticker.get('trade_price', 0))

        # 신호 분석 프롬프트 (🚀 부스터 모드: 급등락주 초단타)
        prompt = f"""
당신은 암호화폐 초단타 전문 트레이더입니다. **급등락주 중심** 분석하고 **30초 단위 초단타 신호**를 제시하세요.

**종목**: {symbol}
**현재가**: ₩{current_price:,.0f}

**시장 데이터**:
- 24h 고가: ₩{ticker.get('high_price', 0):,.0f}
- 24h 저가: ₩{ticker.get('low_price', 0):,.0f}
- 거래량: {ticker.get('trade_volume', 0):.4f}

**기술적 지표**:
{json.dumps(indicators, indent=2, ensure_ascii=False, default=str)}

**급등락주 부스터 모드 분석** (30초 초단타):
- ⚡ 변동성 우선: 24h 변동률 5% 이상 종목만 거래
- 🔴 급락 신호: RSI < 30 + 저점 형성 → 즉시 BUY (신뢰도 75%)
- 🟢 급등 신호: 볼린저밴드 돌파 + 거래량 증가 → BUY (신뢰도 70%)
- 💹 단기 수익: 익절 +3~5% (초단타 목표)
- 🛡️ 손절: -2~3% (빠른 손실 제한)

**응답 형식** (JSON만 응답):
{{
  "recommendation": "BUY" 또는 "SELL" 또는 "HOLD",
  "confidence": 0.60~0.95,
  "entry_price": {current_price},
  "stop_loss_price": 손절가 (진입가 -2~3%만),
  "take_profit_price": 익절가 (진입가 +3~5%),
  "reasoning": "급등락주 분석 근거 2-3줄",
  "signal_strength": "약세" 또는 "중립" 또는 "강세"
}}

**필수 조건**:
- 변동성이 낮으면 무조건 HOLD (급등락주 아님)
- 신뢰도 60% 이상만 BUY/SELL 신호
- 익절/손절은 반드시 3~5%/2~3% 범위 유지
- 보유 금지: 즉시 수익 취득 후 매도"""

        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=1000,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            response_text = None
            for block in message.content:
                # ThinkingBlock 건너뛰기, TextBlock만 찾기
                if block.type == 'text' and hasattr(block, 'text'):
                    response_text = block.text
                    break

            if not response_text:
                return self._fallback_analysis(symbol, current_price)

            # JSON 파싱
            try:
                result = json.loads(response_text)
                return self._validate_analysis(result, current_price)
            except json.JSONDecodeError:
                start = response_text.find('{')
                end = response_text.rfind('}') + 1
                if start >= 0 and end > start:
                    result = json.loads(response_text[start:end])
                    return self._validate_analysis(result, current_price)
                else:
                    return self._fallback_analysis(symbol, current_price)

        except Exception as e:
            print(f"❌ Claude 분석 오류 ({symbol}): {e}")
            return self._fallback_analysis(symbol, current_price)

    def _validate_analysis(self, analysis: Dict, current_price: float) -> Dict[str, Any]:
        """분석 결과 검증"""
        # confidence 범위 조정
        confidence = float(analysis.get('confidence', 0.65))
        if confidence < 0.6:
            confidence = 0.6
        if confidence > 0.95:
            confidence = 0.95

        return {
            "recommendation": analysis.get("recommendation", "HOLD").upper(),
            "confidence": confidence,
            "entry_price": float(analysis.get("entry_price", current_price)),
            "stop_loss_price": float(analysis.get("stop_loss_price", current_price * 0.95)),
            "take_profit_price": float(analysis.get("take_profit_price", current_price * 1.1)),
            "reasoning": analysis.get("reasoning", ""),
            "signal_strength": analysis.get("signal_strength", "중립")
        }

    def _fallback_analysis(self, symbol: str, current_price: float) -> Dict[str, Any]:
        """분석 실패 시 기본값 (보수적)"""
        return {
            "recommendation": "HOLD",
            "confidence": 0.5,
            "entry_price": current_price,
            "stop_loss_price": current_price * 0.93,
            "take_profit_price": current_price * 1.08,
            "reasoning": "Claude 분석 불가 - 기본 HOLD",
            "signal_strength": "중립"
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
