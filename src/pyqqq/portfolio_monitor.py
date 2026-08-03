"""
팀장 직접 구현: 실시간 포트폴리오 현황 모니터링

사용자의 지적:
"매매를 하기 위한 연료가 계좌의 현황에서 나오는데 이걸 왜 파악하지 않는거야?"

목표:
1. 실제 보유종목 조회
2. 각 종목의 현재가 수집
3. 손익 계산
4. 포트폴리오 전체 가치 계산
5. 실시간 모니터링 대시보드
"""

import asyncio
import logging
import json
from datetime import datetime
from typing import Dict, List, Optional
import time

logger = logging.getLogger(__name__)


class PortfolioMonitor:
    """포트폴리오 실시간 모니터링"""

    def __init__(self, upbit_client):
        self.upbit = upbit_client
        self.holdings: Dict[str, Dict] = {}  # 보유종목
        self.portfolio_value = 0.0  # 전체 포트폴리오 가치
        self.total_pnl = 0.0  # 총 손익
        self.total_return = 0.0  # 총 수익률
        self.last_update = None
        self.update_interval = 60  # 60초마다 업데이트

    async def update_portfolio(self):
        """포트폴리오 정보 업데이트"""
        try:
            # 1. 보유종목 조회
            self.holdings = await self._fetch_holdings()

            if not self.holdings:
                logger.warning("⚠️  보유종목 없음")
                return False

            # 2. 각 종목의 현재가 수집
            await self._fetch_current_prices()

            # 3. 손익 계산
            await self._calculate_pnl()

            # 4. 포트폴리오 가치 계산
            self._calculate_portfolio_value()

            # 5. 통계 출력
            self._log_portfolio_status()

            # 6. 메모리 상태 동기화
            self.sync_memory_state()

            self.last_update = datetime.now()
            return True

        except Exception as e:
            logger.error(f"❌ 포트폴리오 업데이트 오류: {e}")
            return False

    async def _fetch_holdings(self) -> Dict[str, Dict]:
        """보유종목 조회 (동기/비동기 모두 지원)"""
        holdings = {}
        try:
            logger.info("📊 보유종목 조회 중...")

            balances = None

            # 1. get_all_balances() 시도 (async 메서드)
            try:
                if hasattr(self.upbit, 'get_all_balances'):
                    balances = await self.upbit.get_all_balances()
                    logger.debug("✅ get_all_balances() 사용")
            except Exception as e:
                logger.debug(f"⚠️  get_all_balances() 실패: {e}")

            # 2. pyupbit 직접 사용 (동기 메서드)
            if not balances:
                try:
                    if hasattr(self.upbit, 'upbit'):
                        raw_balances = self.upbit.upbit.get_balances()
                        logger.debug(f"✅ pyupbit.get_balances() 사용 (타입: {type(raw_balances)})")

                        # 데이터 형식 검증 (list 또는 dict 모두 처리)
                        balances_list = []
                        if isinstance(raw_balances, list):
                            balances_list = raw_balances
                        elif isinstance(raw_balances, dict):
                            balances_list = list(raw_balances.values()) if raw_balances else []
                        else:
                            logger.error(f"❌ 예상하지 못한 데이터 형식: {type(raw_balances)}")
                            return {}

                        # balances 리스트로 변환
                        balances = balances_list

                except Exception as e:
                    logger.error(f"❌ pyupbit 오류: {e}")
                    return {}

            # 3. balances 처리
            if balances:
                try:
                    for b in balances:
                        if isinstance(b, dict):
                            currency = b.get('currency')
                            balance = float(b.get('balance', 0))
                            locked = float(b.get('locked', 0))
                            avg_buy_price = float(b.get('avg_buy_price', 0))

                            if balance > 0 or locked > 0 or currency == 'KRW':
                                holdings[currency] = {
                                    'balance': balance,
                                    'locked': locked,
                                    'avg_buy_price': avg_buy_price,
                                    'current_price': 0,
                                    'current_value': 0,
                                    'cost': balance * avg_buy_price if avg_buy_price > 0 else 0,
                                    'pnl': 0,
                                    'pnl_pct': 0
                                }
                        else:
                            # 특수 객체인 경우
                            logger.debug(f"⚠️  비 dict 항목 무시: {type(b)}")

                    if holdings:
                        logger.info(f"✅ 보유종목 {len(holdings)}개 조회 완료")
                    else:
                        logger.warning("⚠️  보유종목 없음 (현금만 보유 중)")

                except Exception as e:
                    logger.error(f"❌ balances 처리 오류: {e}")
                    return {}

            return holdings

        except Exception as e:
            logger.error(f"❌ 보유종목 조회 오류: {e}")
            return {}

    async def _fetch_current_prices(self):
        """현재가 수집"""
        try:
            for symbol, holding in self.holdings.items():
                if symbol == 'KRW':
                    continue

                market = f"KRW-{symbol}" if symbol != 'KRW' else symbol

                try:
                    ticker = await self.upbit.get_ticker(market)
                    if ticker:
                        current_price = float(ticker.get('trade_price', 0))
                        self.holdings[symbol]['current_price'] = current_price
                except Exception as e:
                    logger.warning(f"⚠️  {market} 시세 조회 실패: {e}")

        except Exception as e:
            logger.error(f"❌ 현재가 수집 오류: {e}")

    async def _calculate_pnl(self):
        """손익 계산"""
        try:
            total_krw_value = 0  # KRW 환산 가치

            for symbol, holding in self.holdings.items():
                if symbol == 'KRW':
                    total_krw_value += holding.get('balance', 0)
                    continue

                balance = holding.get('balance', 0)
                current_price = holding.get('current_price', 0)
                avg_buy_price = holding.get('avg_buy_price', 0)

                if balance > 0 and avg_buy_price > 0:
                    # 현재 가치 (KRW)
                    current_value = balance * current_price
                    total_krw_value += current_value

                    # 손익
                    cost = balance * avg_buy_price
                    pnl = current_value - cost
                    pnl_pct = (pnl / cost * 100) if cost > 0 else 0

                    holding['current_value'] = current_value
                    holding['cost'] = cost
                    holding['pnl'] = pnl
                    holding['pnl_pct'] = pnl_pct

            self.portfolio_value = total_krw_value

        except Exception as e:
            logger.error(f"❌ 손익 계산 오류: {e}")

    def _calculate_portfolio_value(self):
        """포트폴리오 전체 가치 계산"""
        try:
            self.total_pnl = 0.0
            total_cost = 0.0

            for symbol, holding in self.holdings.items():
                if symbol == 'KRW':
                    continue

                pnl = holding.get('pnl', 0)
                cost = holding.get('cost', 0)

                self.total_pnl += pnl
                total_cost += cost

            # 수익률
            self.total_return = (self.total_pnl / total_cost * 100) if total_cost > 0 else 0

        except Exception as e:
            logger.error(f"❌ 포트폴리오 가치 계산 오류: {e}")

    def _log_portfolio_status(self):
        """포트폴리오 상태 로깅"""
        logger.info("\n" + "=" * 70)
        logger.info("📊 포트폴리오 현황")
        logger.info("=" * 70)

        # 전체 요약
        logger.info(f"💰 총 자산: ₩{self.portfolio_value:,.0f}")
        logger.info(f"📈 총 손익: ₩{self.total_pnl:,.0f} ({self.total_return:+.2f}%)")

        # 각 종목
        logger.info("\n📋 보유 종목:")
        for symbol, holding in sorted(self.holdings.items()):
            if symbol == 'KRW':
                logger.info(f"  [{symbol}] ₩{holding.get('balance', 0):,.0f}")
            else:
                balance = holding.get('balance', 0)
                current_price = holding.get('current_price', 0)
                current_value = holding.get('current_value', 0)
                pnl = holding.get('pnl', 0)
                pnl_pct = holding.get('pnl_pct', 0)

                if balance > 0:
                    logger.info(f"  [{symbol}]")
                    logger.info(f"    보유: {balance}")
                    logger.info(f"    현재가: ₩{current_price:,.0f}")
                    logger.info(f"    가치: ₩{current_value:,.0f}")
                    logger.info(f"    손익: ₩{pnl:,.0f} ({pnl_pct:+.2f}%)")

        logger.info("=" * 70 + "\n")

    def get_portfolio_summary(self) -> Dict:
        """포트폴리오 요약 반환"""
        return {
            "total_value": self.portfolio_value,
            "total_pnl": self.total_pnl,
            "total_return": self.total_return,
            "holdings": self.holdings,
            "last_update": self.last_update.isoformat() if self.last_update else None
        }

    def sync_memory_state(self):
        """메모리 포지션 상태를 실제 계좌와 동기화"""
        try:
            import os
            memory_file = "/tmp/booster_pause_state.json"

            # 현재 포지션 목록 생성
            positions = []
            krw_cash = 0

            for symbol, holding in self.holdings.items():
                if symbol == 'KRW':
                    krw_cash = holding.get('balance', 0)
                else:
                    if holding.get('balance', 0) > 0:
                        positions.append({
                            'symbol': symbol,
                            'balance': holding.get('balance', 0),
                            'avg_buy_price': holding.get('avg_buy_price', 0),
                            'current_price': holding.get('current_price', 0),
                            'pnl': holding.get('pnl', 0),
                            'pnl_pct': holding.get('pnl_pct', 0)
                        })

            # 메모리 상태 파일 업데이트
            if os.path.exists(memory_file):
                try:
                    with open(memory_file, 'r') as f:
                        state = json.load(f)
                except Exception as e:
                    logger.warning(f"⚠️  메모리 상태 파일 읽기 실패: {e}")
                    state = {}
            else:
                state = {}

            # 포지션 정보 업데이트
            state.update({
                'timestamp': datetime.now().isoformat(),
                'status': 'ACTIVE' if positions else 'IDLE',
                'portfolio': {
                    'krw_cash': krw_cash,
                    'coins_in_memory': len(positions),
                    'coins_in_actual_account': len(positions),
                    'total_real_assets': self.portfolio_value
                },
                'positions': positions,
                'last_sync': datetime.now().isoformat()
            })

            # 파일에 쓰기
            with open(memory_file, 'w') as f:
                json.dump(state, f, indent=2)

            logger.debug(f"✅ 메모리 상태 동기화: {len(positions)}개 포지션")

        except Exception as e:
            logger.warning(f"⚠️  메모리 동기화 오류: {e}")

    async def initialize_memory(self):
        """메모리 포지션 초기화 (부스터 시작 시)"""
        try:
            memory_file = "/tmp/booster_pause_state.json"

            # 현재 계좌 상태 조회
            await self.update_portfolio()

            # 메모리 상태 초기화
            krw_cash = 0
            for symbol, holding in self.holdings.items():
                if symbol == 'KRW':
                    krw_cash = holding.get('balance', 0)
                    break

            initial_state = {
                'timestamp': datetime.now().isoformat(),
                'status': 'INITIALIZED',
                'reason': '부스터 시작 시 메모리 초기화',
                'portfolio': {
                    'krw_cash': krw_cash,
                    'coins_in_memory': 0,
                    'coins_in_actual_account': 0,
                    'total_real_assets': krw_cash
                },
                'positions': [],
                'initialized': True
            }

            with open(memory_file, 'w') as f:
                json.dump(initial_state, f, indent=2)

            logger.info(f"✅ 메모리 초기화 완료: ₩{krw_cash:,.0f}")
            return True

        except Exception as e:
            logger.error(f"❌ 메모리 초기화 오류: {e}")
            return False

    async def start_monitoring(self):
        """포트폴리오 모니터링 시작 (백그라운드)"""
        logger.info("🚀 포트폴리오 모니터링 시작")

        while True:
            try:
                await self.update_portfolio()
                await asyncio.sleep(self.update_interval)
            except Exception as e:
                logger.error(f"❌ 모니터링 오류: {e}")
                await asyncio.sleep(5)
