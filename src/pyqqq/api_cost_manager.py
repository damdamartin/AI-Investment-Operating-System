"""
Claude API 비용 관리자 - 팀장이 추가
과다 사용 방지 및 토큰 최적화
"""

import time
from datetime import datetime, timedelta
from typing import Dict, Any
import logging
from config import settings

logger = logging.getLogger(__name__)


class RateLimiter:
    """API 요청 비율 제한 (Exponential Backoff)"""

    def __init__(self, max_requests_per_minute: int = 60):
        self.max_requests_per_minute = max_requests_per_minute
        self.request_times = []
        self.retry_count = 0
        self.max_retries = 3

    async def wait_if_needed(self):
        """필요시 대기"""
        now = time.time()

        # 1분 이내의 요청만 유지
        self.request_times = [t for t in self.request_times if now - t < 60]

        # 제한에 도달하면 대기
        if len(self.request_times) >= self.max_requests_per_minute:
            wait_time = 60 - (now - self.request_times[0]) + 1
            if wait_time > 0:
                logger.warning(f"Rate limit 도달, {wait_time:.1f}초 대기")
                await asyncio.sleep(wait_time)

        self.request_times.append(now)

    def get_retry_delay(self) -> float:
        """재시도 대기 시간 (exponential backoff)"""
        return 2 ** self.retry_count + (0.1 * self.retry_count)

    def reset(self):
        """재시도 카운터 리셋"""
        self.retry_count = 0

    def increment_retry(self):
        """재시도 카운터 증가"""
        if self.retry_count < self.max_retries:
            self.retry_count += 1


class TokenCounter:
    """토큰 사용량 추적"""

    def __init__(self):
        self.daily_tokens = {}  # date -> count
        self.monthly_tokens = {}  # month -> count
        self.token_budget_daily = 1000000  # 일일 1M 토큰
        self.token_budget_monthly = 20000000  # 월 20M 토큰

        # Claude 3.5 Sonnet 가격 (USD)
        self.price_per_1k_input = 0.003
        self.price_per_1k_output = 0.015

    def log_tokens(self, input_tokens: int, output_tokens: int):
        """토큰 사용 기록"""
        today = datetime.now().date().isoformat()
        month = datetime.now().strftime("%Y-%m")

        self.daily_tokens[today] = self.daily_tokens.get(today, 0) + input_tokens + output_tokens
        self.monthly_tokens[month] = self.monthly_tokens.get(month, 0) + input_tokens + output_tokens

        # 예산 체크
        if self.daily_tokens[today] > self.token_budget_daily:
            logger.warning(
                f"⚠️ 일일 토큰 예산 초과: {self.daily_tokens[today]:,} / {self.token_budget_daily:,}"
            )

        if self.monthly_tokens[month] > self.token_budget_monthly:
            logger.error(
                f"🔴 월 토큰 예산 초과: {self.monthly_tokens[month]:,} / {self.token_budget_monthly:,}"
            )

    def get_usage_stats(self) -> Dict[str, Any]:
        """사용량 통계"""
        today = datetime.now().date().isoformat()
        month = datetime.now().strftime("%Y-%m")

        daily_usage = self.daily_tokens.get(today, 0)
        monthly_usage = self.monthly_tokens.get(month, 0)

        # 비용 계산 (대략적)
        daily_cost = (daily_usage / 1000) * (self.price_per_1k_input + self.price_per_1k_output) / 2
        monthly_cost = (monthly_usage / 1000) * (self.price_per_1k_input + self.price_per_1k_output) / 2

        return {
            "daily": {
                "tokens": daily_usage,
                "budget": self.token_budget_daily,
                "usage_pct": (daily_usage / self.token_budget_daily) * 100,
                "cost_usd": daily_cost,
                "cost_krw": daily_cost * 1300  # 대략 환율
            },
            "monthly": {
                "tokens": monthly_usage,
                "budget": self.token_budget_monthly,
                "usage_pct": (monthly_usage / self.token_budget_monthly) * 100,
                "cost_usd": monthly_cost,
                "cost_krw": monthly_cost * 1300
            }
        }


class APIErrorHandler:
    """Claude API 에러 처리"""

    @staticmethod
    async def handle_error(error: Exception, retry_count: int = 0, max_retries: int = 3) -> bool:
        """
        에러 처리 및 재시도 판단

        Returns:
            True: 재시도 권장
            False: 재시도 불가
        """

        error_msg = str(error)

        # 1. Rate Limit (429)
        if "429" in error_msg or "rate_limit" in error_msg.lower():
            logger.warning(f"Rate limit 오류 (시도 {retry_count}/{max_retries})")
            return retry_count < max_retries

        # 2. Token Limit (400)
        if "token" in error_msg.lower() and "exceeded" in error_msg.lower():
            logger.error("🔴 토큰 제한 초과 - 프롬프트를 축약하거나 배치 작업을 줄이세요")
            return False

        # 3. Network Error (연결 실패)
        if any(x in error_msg.lower() for x in ["connection", "timeout", "network"]):
            logger.warning(f"네트워크 오류 (시도 {retry_count}/{max_retries})")
            return retry_count < max_retries

        # 4. Authorization Error (401, 403)
        if "401" in error_msg or "403" in error_msg or "unauthorized" in error_msg.lower():
            logger.error("🔴 인증 오류 - API 키를 확인하세요")
            return False

        # 5. 기타 오류
        logger.error(f"예상치 못한 오류: {error_msg}")
        return retry_count < max_retries

    @staticmethod
    async def get_retry_delay(retry_count: int) -> float:
        """재시도 대기 시간"""
        # exponential backoff: 1s, 2s, 4s, 8s...
        return min(2 ** retry_count, 60)  # 최대 60초


class PromptOptimizer:
    """프롬프트 토큰 최적화"""

    @staticmethod
    def optimize_research_prompt(symbol: str, symbol_name: str) -> str:
        """리서치팀 프롬프트 축약"""

        prompt = f"""당신은 리서치 애널리스트입니다. {symbol} ({symbol_name})를 분석하세요.

결과는 JSON으로:
- signal: "BUY" | "SELL" | "HOLD"
- confidence: 0.0~1.0
- reasoning: 2-3줄 요약
"""
        return prompt

    @staticmethod
    def optimize_analysis_prompt(symbol: str, current_price: float) -> str:
        """분석팀 프롬프트 축약"""

        prompt = f"""기술분석: {symbol} @ {current_price}원

결과 JSON:
- signal: "BUY" | "SELL" | "HOLD"
- confidence: 0.0~1.0
- target: 목표가
- stop: 손절가
"""
        return prompt

    @staticmethod
    def optimize_strategy_prompt(symbol: str) -> str:
        """전략팀 프롬프트 축약"""

        prompt = f"""{symbol}의 거래 계획.

JSON:
- action: "BUY" | "SELL" | "HOLD"
- quantity: 수량
- entry: 진입가
- stop: 손절가
- target: 익절가
"""
        return prompt


class APICallWrapper:
    """
    Claude API 호출 래퍼
    - Rate limiting
    - 재시도 로직
    - 토큰 추적
    - 에러 처리
    """

    def __init__(self, client):
        self.client = client
        self.rate_limiter = RateLimiter(max_requests_per_minute=60)
        self.token_counter = TokenCounter()

    async def call_claude(
        self,
        prompt: str,
        max_tokens: int = 1024,
        team_name: str = "unknown"
    ) -> str:
        """
        Claude API 호출 (안전)

        Args:
            prompt: 프롬프트
            max_tokens: 최대 토큰
            team_name: 팀 이름 (로깅용)

        Returns:
            응답 텍스트
        """

        retry_count = 0

        while retry_count < self.rate_limiter.max_retries:
            try:
                # Rate limiting 대기
                await self.rate_limiter.wait_if_needed()

                # API 호출
                message = self.client.messages.create(
                    model=settings.claude_model,
                    max_tokens=max_tokens,
                    messages=[{"role": "user", "content": prompt}]
                )

                # 토큰 기록
                usage = message.usage
                self.token_counter.log_tokens(
                    usage.input_tokens,
                    usage.output_tokens
                )

                # 성공
                self.rate_limiter.reset()
                logger.debug(f"[{team_name}] API 호출 성공 (입력: {usage.input_tokens}, 출력: {usage.output_tokens})")

                return message.content[0].text

            except Exception as e:
                retry_count += 1

                should_retry = await APIErrorHandler.handle_error(e, retry_count)

                if should_retry:
                    delay = await APIErrorHandler.get_retry_delay(retry_count - 1)
                    logger.warning(f"[{team_name}] {delay:.1f}초 후 재시도 ({retry_count}/{self.rate_limiter.max_retries})")
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"[{team_name}] 최종 실패: {str(e)}")
                    raise

        raise Exception(f"[{team_name}] 최대 재시도 횟수 초과")

    def get_cost_report(self) -> str:
        """비용 리포트"""
        stats = self.token_counter.get_usage_stats()

        report = f"""
=== Claude API 비용 리포트 ===
[일일]
- 사용: {stats['daily']['tokens']:,} 토큰 ({stats['daily']['usage_pct']:.1f}%)
- 비용: ${stats['daily']['cost_usd']:.2f} (₩{stats['daily']['cost_krw']:,.0f})

[월]
- 사용: {stats['monthly']['tokens']:,} 토큰 ({stats['monthly']['usage_pct']:.1f}%)
- 비용: ${stats['monthly']['cost_usd']:.2f} (₩{stats['monthly']['cost_krw']:,.0f})
================================
"""
        return report


import asyncio

if __name__ == "__main__":
    # 테스트
    from anthropic import Anthropic

    client = Anthropic()
    wrapper = APICallWrapper(client)

    async def test():
        response = await wrapper.call_claude(
            prompt="Hello, Claude!",
            team_name="test"
        )
        print(response)
        print(wrapper.get_cost_report())

    asyncio.run(test())
