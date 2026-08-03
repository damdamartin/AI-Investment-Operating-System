import asyncio
import logging
import time
import math
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from .config import settings
from .upbit_client import UpbitClient
from .claude_analyzer import ClaudeAnalyzer
from .position_manager import PositionManager, Position, PositionStatus
from .dashboard_client import DashboardClient
from .trade_record_manager import TradeRecordManager
from .portfolio_monitor import PortfolioMonitor  # 팀장: 포트폴리오 모니터링


# 로깅 설정
log_level = settings.log_level.upper() if isinstance(settings.log_level, str) else "INFO"
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# 암호화폐 매매 규칙 (부스터 모드: 최대 수익/리스크)
CRYPTO_TRADING_RULES = {
    "max_daily_loss": None,             # 일일 손실 무제한 (부스터 모드 - 손실 범위 없음)
    "position_sizing": "aggressive",    # 공격적 포지션 크기 (50-100%)
    "min_signal_confidence": 0.50,      # 신호 신뢰도 50% (낮음)
    "max_holding_time": 300,            # 최대 5분 보유 (초단타)
    "max_drawdown": None,               # 최대 드로우다운 무제한 (부스터)
    "consecutive_loss_threshold": 10,   # 연속 손실 10회
    "profit_targets": [0.01, 0.02, 0.05, 0.10],  # 수익 목표 1%, 2%, 5%, 10% (단타)
    "stop_loss_levels": [0.02, 0.05, 0.10, 0.20],  # 손절 수준 -2%, -5%, -10%, -20%
}


class UpbitTradingStrategy:
    """Upbit 암호화폐 자동매매 전략"""

    def __init__(self):
        self.upbit = UpbitClient()
        self.analyzer = ClaudeAnalyzer()
        self.position_manager = PositionManager()
        self.dashboard = DashboardClient()
        self.trade_record_manager = TradeRecordManager()  # 거래 기록 관리자
        self.portfolio_monitor = PortfolioMonitor(self.upbit)  # 팀장: 포트폴리오 모니터링
        self.markets = self._parse_markets()
        self.trading_active = True
        self.trading_enabled = settings.upbit_trading_enabled.lower() == 'true'
        self.ticker_cache: Dict[str, Dict] = {}  # 시세 캐시
        self.last_account_update = 0
        self.account_update_interval = 30  # 30초마다 계좌 상태 전송

        # 리스크 관리 변수
        self.daily_pnl = 0.0  # 일일 손익
        self.initial_portfolio_value = 0.0  # 초기 포트폴리오 가치
        self.consecutive_losses = 0  # 연속 손실 횟수
        self.max_portfolio_value = 0.0  # 최대 포트폴리오 가치 (드로우다운 추적)
        self.trade_history: List[Dict] = []  # 거래 기록 (성공/실패)
        self.active_orders: Dict[str, Dict] = {}  # 진행 중인 주문 추적

        # 팀장: 포트폴리오 변화 추적
        self.last_portfolio_state = None  # 이전 포트폴리오 상태
        self.portfolio_alerts = []  # 주요 변화/경고
        self.daily_report = None  # 일일 종합 보고서

    def _parse_markets(self) -> List[str]:
        """마켓 목록 파싱"""
        markets = [m.strip() for m in settings.upbit_markets.split(',')]
        logger.info(f"📊 초기 마켓: {', '.join(markets)}")
        return markets

    async def _select_today_gainers(self, limit: int = 5) -> List[str]:
        """당일 급등주 선정 및 markets 업데이트"""
        try:
            logger.info(f"🔄 당일 급등주 선정 중... (상위 {limit}개)")
            gainers = await self.upbit.get_today_top_gainers(limit=limit)
            if gainers:
                self.markets = gainers
                logger.info(f"✅ 거래 종목 변경 → {', '.join(self.markets)}")
                return gainers
            else:
                logger.warning("⚠️  급등주 선정 실패, 기존 종목 유지")
                return self.markets
        except Exception as e:
            logger.error(f"❌ 급등주 선정 오류: {e}")
            return self.markets

    async def _update_gainers_periodically(self) -> None:
        """30분마다 당일 급등주 업데이트"""
        update_interval = 1800  # 30분
        while self.trading_active:
            try:
                await asyncio.sleep(update_interval)
                logger.info("\n" + "=" * 80)
                logger.info("📈 당일 급등주 정기 업데이트 (30분마다)")
                logger.info("=" * 80)
                await self._select_today_gainers(limit=5)
            except Exception as e:
                logger.error(f"❌ 급등주 정기 업데이트 오류: {e}")
                await asyncio.sleep(10)

    async def run(self, once: bool = False) -> None:
        """자동매매 시작 (WebSocket 기반 실시간 시스템)"""
        logger.info("🚀 Upbit 암호화폐 자동매매 시작")
        logger.info(f"🔐 거래 활성화: {self.trading_enabled}")

        # Upbit API 인증 테스트
        if not await self.upbit.test_auth():
            logger.error("❌ Upbit API 인증 실패")
            return

        logger.info("✅ Upbit API 인증 성공")

        try:
            # 🚀 부스터 모드: 모든 보유 종목 시장가 매도 (급등락주 초단타 전용)
            logger.warning("=" * 80)
            logger.warning("🔴 [부스터 모드] 모든 보유 종목 시장가 매도 시작")
            logger.warning("=" * 80)
            await self._sell_all_holdings_market_order()
            logger.warning("=" * 80)

            # 📈 당일 급등주 선정 (초기)
            await self._select_today_gainers(limit=5)

            # 팀장: 실제 Upbit 보유자산으로부터 포지션 초기화
            await self._initialize_real_holdings()

            # 초기 계좌 상태 조회
            await self._send_account_status()

            if once:
                await self._run_cycle()
            else:
                # WebSocket 구독 태스크들
                ws_asset_task = asyncio.create_task(
                    self.upbit.subscribe_my_assets(self._on_asset_update)
                )
                ws_ticker_task = asyncio.create_task(
                    self.upbit.subscribe_ticker(self.markets, self._on_ticker_update)
                )
                analysis_task = asyncio.create_task(
                    self._analysis_loop()
                )
                # 팀장: 포트폴리오 모니터링
                portfolio_task = asyncio.create_task(
                    self.portfolio_monitor.start_monitoring()
                )
                # 🎯 팀장: 실시간 모니터링 & 분석
                team_lead_task = asyncio.create_task(
                    self._team_lead_monitor()
                )
                # 📋 팀장: 일일 종합 보고서 생성 (자정 1회)
                daily_report_task = asyncio.create_task(
                    self._generate_daily_report()
                )
                # 📈 당일 급등주 주기적 업데이트 (30분마다)
                gainers_update_task = asyncio.create_task(
                    self._update_gainers_periodically()
                )

                # 모든 태스크 실행
                await asyncio.gather(
                    ws_asset_task,
                    ws_ticker_task,
                    analysis_task,
                    portfolio_task,
                    team_lead_task,
                    daily_report_task,
                    gainers_update_task
                )
        except KeyboardInterrupt:
            logger.info("⏹️  사용자 중단")
        except Exception as e:
            logger.error(f"❌ 자동매매 오류: {e}")
        finally:
            self.position_manager.save_positions_to_file()
            await self.upbit.close()
            logger.info("🛑 Upbit 자동매매 종료")

    def _on_ticker_update(self, ticker_data: Dict) -> None:
        """📈 시세 업데이트 콜백 (WebSocket) - 실시간 시세를 position에 반영"""
        try:
            market = ticker_data.get('cd')  # 마켓 코드
            trade_price = float(ticker_data.get('tp', 0))  # 거래가

            if market and market in self.markets:
                # 1️⃣ 시세 캐시 업데이트
                self.ticker_cache[market] = {
                    'trade_price': trade_price,
                    'high_price': float(ticker_data.get('hp', 0)),
                    'low_price': float(ticker_data.get('lp', 0)),
                    'opening_price': float(ticker_data.get('op', 0)),
                    'prev_closing_price': float(ticker_data.get('pcp', 0)),
                    'trade_volume': float(ticker_data.get('tv', 0)),
                    'timestamp': ticker_data.get('tms')
                }

                # 2️⃣ 팀장: position_manager의 포지션 현재가 업데이트
                # 이것이 없으면 position의 손익이 계속 초기값으로 유지됨!
                position = self.position_manager.get_position_by_symbol(market)
                if position:
                    position.update_current_price(trade_price)
                    logger.debug(f"💹 {market}: ₩{trade_price:,.0f} (손익: {position.pnl_pct:+.2f}%)")
                else:
                    logger.debug(f"💹 {market}: ₩{trade_price:,.0f}")

        except Exception as e:
            logger.error(f"❌ 시세 처리 오류: {e}")

    async def _on_asset_update(self, asset_data: Dict) -> None:
        """자산 업데이트 콜백 (WebSocket) - 자산이 변동될 때마다 호출"""
        try:
            import time
            current_time = time.time()

            # 30초 간격으로만 대시보드 업데이트 (과도한 호출 방지)
            if current_time - self.last_account_update < self.account_update_interval:
                return

            logger.info(f"📊 자산 변동 감지 - 대시보드 업데이트")
            await self._send_account_status()
            self.last_account_update = current_time

        except Exception as e:
            logger.error(f"❌ 자산 업데이트 처리 오류: {e}")

    async def _sell_all_holdings_market_order(self) -> None:
        """🔴 부스터 모드: 모든 보유 종목 시장가 매도"""
        try:
            # 현재 보유 종목 조회
            balances = self.upbit.upbit.get_balances()

            if not balances:
                logger.info("ℹ️  보유 종목 없음")
                return

            total_sold = 0

            for item in balances:
                try:
                    currency = item.get('currency') if isinstance(item, dict) else getattr(item, 'currency', None)
                    balance = float(item.get('balance', 0) if isinstance(item, dict) else getattr(item, 'balance', 0))

                    # KRW는 스킵, 0 이하는 스킵
                    if currency == 'KRW' or balance <= 0:
                        continue

                    market = f"KRW-{currency}"

                    # 시장가 매도
                    logger.warning(f"🔴 {market} 매도 중... (수량: {balance})")
                    order = self.upbit.upbit.sell_market_order(market, balance)

                    if order and order.get('uuid'):
                        logger.warning(f"   ✅ 매도 완료! UUID: {order.get('uuid')}")
                        total_sold += 1
                    else:
                        logger.error(f"   ❌ 매도 실패")

                except Exception as e:
                    logger.error(f"❌ {currency} 매도 오류: {e}")

            if total_sold > 0:
                logger.warning(f"✅ {total_sold}개 종목 매도 완료")
            else:
                logger.info("ℹ️  매도한 종목 없음")

        except Exception as e:
            logger.error(f"❌ 모든 종목 매도 오류: {e}")

    async def _initialize_real_holdings(self) -> None:
        """📊 팀장: 실제 Upbit 계좌의 보유자산을 실시간 조회하여 포지션 초기화"""
        try:
            logger.info("\n" + "=" * 80)
            logger.info("🔧 실제 Upbit 계좌에서 보유자산 조회 및 Position 등록")
            logger.info("=" * 80)

            # 실시간 계좌 잔고 조회
            all_balances = await self.upbit.get_all_balances()
            if not all_balances:
                logger.warning("⚠️  계좌 조회 실패 - 보유 자산 없음")
                return

            total_buy = 0
            total_eval = 0
            total_pnl = 0
            position_count = 0

            for asset in all_balances:
                market = asset.get('market', '')
                balance = float(asset.get('balance', 0))
                avg_buy_price = float(asset.get('avg_buy_price', 0))

                # KRW는 스킵, 0 이상의 암호화폐만 처리
                if balance <= 0 or not market.startswith('KRW-'):
                    continue

                try:
                    # 실시간 시세 조회
                    ticker = await self.upbit.get_ticker(market)
                    if not ticker:
                        logger.warning(f"⚠️  {market} 시세 조회 실패")
                        continue

                    current_price = float(ticker.get('trade_price', 0))
                    buy_amount = balance * avg_buy_price
                    eval_amount = balance * current_price
                    pnl = eval_amount - buy_amount
                    pnl_pct = (pnl / buy_amount * 100) if buy_amount > 0 else 0

                    # 손절/익절 설정 (기본값: -2% 손절, +5% 익절)
                    stop_loss_price = avg_buy_price * 0.98
                    take_profit_price = avg_buy_price * 1.05

                    # Position 객체 생성
                    pos = Position(
                        symbol=market,
                        quantity=balance,
                        entry_price=avg_buy_price,
                        entry_time=datetime.now(),
                        stop_loss_price=stop_loss_price,
                        take_profit_price=take_profit_price
                    )
                    pos.update_current_price(current_price)

                    # position_manager에 추가
                    self.position_manager.add_position(pos)

                    logger.info(f"\n  [{market}]")
                    logger.info(f"    보유: {balance:.8f}")
                    logger.info(f"    진입가: ₩{avg_buy_price:,.0f}")
                    logger.info(f"    현재가: ₩{current_price:,.0f}")
                    logger.info(f"    매수금액: ₩{buy_amount:,.0f}")
                    logger.info(f"    평가금액: ₩{eval_amount:,.0f}")
                    logger.info(f"    손익: ₩{pnl:,.0f} ({pnl_pct:+.2f}%)")
                    logger.info(f"    손절: ₩{stop_loss_price:,.0f} | 익절: ₩{take_profit_price:,.0f}")

                    total_buy += buy_amount
                    total_eval += eval_amount
                    total_pnl += pnl
                    position_count += 1

                except Exception as e:
                    logger.error(f"❌ {market} 처리 오류: {e}")
                    continue

            # KRW 현금 조회
            krw_balance_data = await self.upbit.get_account_balance()
            krw_balance = float(krw_balance_data.get('balance', 0)) if krw_balance_data else 0

            # 전체 요약
            total_pnl_pct = (total_pnl / total_buy * 100) if total_buy > 0 else 0
            logger.info(f"\n" + "-" * 80)
            logger.info(f"💎 포트폴리오 총액")
            logger.info(f"    총 매수금액: ₩{total_buy:,.0f}")
            logger.info(f"    총 평가금액: ₩{total_eval:,.0f}")
            logger.info(f"    총 손익: ₩{total_pnl:,.0f} ({total_pnl_pct:+.2f}%)")
            logger.info(f"    KRW 현금: ₩{krw_balance:,.0f} (실시간 조회)")
            logger.info(f"    전체 자산: ₩{total_eval + krw_balance:,.0f}")
            logger.info("=" * 80 + "\n")

            logger.info(f"✅ {position_count}개 포지션 초기화 완료")

        except Exception as e:
            logger.error(f"❌ 포지션 초기화 오류: {e}", exc_info=True)

    async def _send_account_status(self) -> None:
        """📊 계좌 상태 조회 및 대시보드 전송

        팀장 구현: position_manager에서 현재 오픈 포지션 조회
        BTC, ETH, SOL, ADA의 실제 보유 상황과 손익 표시
        """
        try:
            # 실제 계좌 조회 (pyupbit)
            logger.info("📡 계좌 조회 시작...")
            balance_data = await self.upbit.get_account_balance()
            logger.info(f"📡 조회 결과: {type(balance_data)} = {balance_data}")
            if balance_data:
                krw_balance = float(balance_data.get('balance', 0))
                krw_locked = float(balance_data.get('locked', 0))
                logger.info(f"✅ 실시간 KRW 잔액: ₩{krw_balance:,.0f}")
            else:
                # 조회 실패 시 0 사용
                krw_balance = 0.0
                krw_locked = 0.0
                logger.warning("⚠️  실시간 KRW 잔액 조회 실패")

            # 1️⃣ position_manager에서 오픈 포지션 조회
            open_positions = self.position_manager.get_open_positions()

            holdings = []
            total_buy_price = 0.0
            total_eval_price = 0.0
            total_pnl = 0.0
            total_return = 0.0

            if open_positions:
                logger.info("\n" + "=" * 80)
                logger.info("📊 실시간 포트폴리오 현황 (자동매매 시스템)")
                logger.info("=" * 80)
                logger.info(f"🕐 업데이트: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                logger.info(f"💰 KRW 잔액: ₩{krw_balance:,.0f} (주문중: ₩{krw_locked:,.0f})")
                logger.info(f"📈 오픈 포지션: {len(open_positions)}개")

                # 2️⃣ 각 포지션의 손익 계산
                for pos in open_positions:
                    symbol = pos.symbol  # 예: "KRW-BTC"
                    qty = pos.quantity
                    entry_price = pos.entry_price
                    current_price = pos.current_price or entry_price

                    buy_value = qty * entry_price
                    eval_value = qty * current_price
                    pnl = eval_value - buy_value
                    pnl_pct = (pnl / buy_value * 100) if buy_value > 0 else 0

                    total_buy_price += buy_value
                    total_eval_price += eval_value
                    total_pnl += pnl

                    holdings.append({
                        'symbol': symbol,
                        'quantity': qty,
                        'entry_price': entry_price,
                        'current_price': current_price,
                        'buy_value': buy_value,
                        'eval_value': eval_value,
                        'pnl': pnl,
                        'pnl_pct': pnl_pct,
                        'status': pos.status.value
                    })

                    # 각 종목 상세 로깅
                    logger.info(f"\n  ▪️  [{symbol}]")
                    logger.info(f"      보유: {qty} 코인")
                    logger.info(f"      진입가: ₩{entry_price:,.0f} → 현재가: ₩{current_price:,.0f}")
                    logger.info(f"      투자원금: ₩{buy_value:,.0f}")
                    logger.info(f"      현재가치: ₩{eval_value:,.0f}")
                    logger.info(f"      손익: ₩{pnl:,.0f} ({pnl_pct:+.2f}%)")
                    logger.info(f"      상태: {pos.status.value} | 손절선: ₩{pos.stop_loss_price:,.0f} | 익절선: ₩{pos.take_profit_price:,.0f}")

                # 3️⃣ 전체 포트폴리오 요약
                total_return = (total_pnl / total_buy_price * 100) if total_buy_price > 0 else 0

                logger.info(f"\n" + "-" * 80)
                logger.info(f"💎 전체 포트폴리오 요약")
                logger.info(f"    총 투자원금: ₩{total_buy_price:,.0f}")
                logger.info(f"    현재 평가액: ₩{total_eval_price:,.0f}")
                logger.info(f"    총 손익: ₩{total_pnl:,.0f} ({total_return:+.2f}%)")
                logger.info(f"    전체 자산: ₩{krw_balance + total_eval_price:,.0f}")
                logger.info("=" * 80 + "\n")
            else:
                logger.warning("⚠️  현재 오픈 포지션이 없습니다")

            # 4️⃣ 대시보드 데이터 구성
            account_data = {
                'krw_balance': krw_balance,
                'krw_locked': krw_locked,
                'total_assets': krw_balance + total_eval_price,
                'total_buy_price': total_buy_price,
                'total_eval_price': total_eval_price,
                'total_pnl': total_pnl,
                'total_return': total_return,
                'holdings': holdings,
                'timestamp': datetime.now().isoformat()
            }

            # 5️⃣ 대시보드 전송
            self.dashboard.send_account_status(account_data)

        except Exception as e:
            logger.error(f"❌ 계좌 상태 전송 실패: {e}", exc_info=True)

    async def _generate_daily_report(self) -> None:
        """📋 팀장: 일일 종합 보고서 생성

        보고 내용:
        1. 시장 현황
        2. 포트폴리오 현황
        3. 오늘의 매매 전략
        4. 조치사항

        실행:
        - 자정 자동 생성
        - 매 5분마다 최신 정보로 업데이트 (실시간 보고)
        """
        import time
        last_report_date = datetime.now().date()
        last_update_time = 0

        while self.trading_active:
            try:
                await asyncio.sleep(10)  # 10초마다 체크
                current_time = time.time()
                current_date = datetime.now().date()

                # 매 5분마다 보고서 업데이트 (또는 자정에 생성)
                if current_date > last_report_date or (current_time - last_update_time > 300):
                    last_report_date = current_date
                    last_update_time = current_time

                    # 2️⃣ 포트폴리오 현황
                    open_positions = self.position_manager.get_open_positions()

                    # 1️⃣ 시장 현황 수집
                    market_status = {}
                    for market in self.markets:
                        if market in self.ticker_cache:
                            ticker = self.ticker_cache[market]
                            market_status[market] = {
                                'price': ticker.get('trade_price', 0),
                                'high': ticker.get('high_price', 0),
                                'low': ticker.get('low_price', 0),
                                'prev_close': ticker.get('prev_closing_price', 0)
                            }
                        else:
                            # 캐시가 없으면 현재 포지션의 current_price 사용
                            for pos in open_positions:
                                if pos.symbol == market:
                                    market_status[market] = {
                                        'price': pos.current_price or 0,
                                        'high': 0,
                                        'low': 0,
                                        'prev_close': 0
                                    }
                                    break
                    # 실시간 KRW 잔액 조회
                    krw_data = await self.upbit.get_account_balance()
                    krw_balance = float(krw_data.get('balance', 0)) if krw_data else 0

                    portfolio_data = {
                        'positions': [],
                        'total_pnl': 0,
                        'total_return': 0,
                        'total_assets': krw_balance  # 실시간 KRW 잔액
                    }

                    strategy_notes = []

                    for pos in open_positions:
                        if not pos.current_price:
                            continue

                        pnl = (pos.current_price - pos.entry_price) * pos.quantity
                        pnl_pct = ((pos.current_price - pos.entry_price) / pos.entry_price * 100)

                        portfolio_data['positions'].append({
                            'symbol': pos.symbol,
                            'quantity': pos.quantity,
                            'entry_price': pos.entry_price,
                            'current_price': pos.current_price,
                            'pnl': pnl,
                            'pnl_pct': pnl_pct
                        })
                        portfolio_data['total_pnl'] += pnl
                        portfolio_data['total_assets'] += pos.quantity * pos.current_price

                        # 3️⃣ 각 포지션별 거래 전략 결정
                        if pnl_pct >= 4.5:  # 익절 근처
                            strategy_notes.append({
                                'symbol': pos.symbol,
                                'strategy': '익절 신호 대기',
                                'reason': f'({pnl_pct:+.2f}%)'
                            })
                        elif pnl_pct <= -1.5:  # 손절 근처
                            strategy_notes.append({
                                'symbol': pos.symbol,
                                'strategy': '손실 제한 모드',
                                'reason': f'({pnl_pct:+.2f}%)'
                            })
                        else:
                            strategy_notes.append({
                                'symbol': pos.symbol,
                                'strategy': '상승 신호 대기',
                                'reason': f'({pnl_pct:+.2f}%)'
                            })

                    portfolio_data['total_return'] = (portfolio_data['total_pnl'] / 191154 * 100) if 191154 > 0 else 0

                    # 4️⃣ 일일 보고서 생성
                    self.daily_report = {
                        'date': datetime.now().strftime('%Y-%m-%d'),
                        'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                        'market_status': market_status,
                        'portfolio': portfolio_data,
                        'strategy': strategy_notes,
                        'actions': []  # 조치사항
                    }

                    # 로깅
                    logger.info("\n" + "=" * 80)
                    logger.info("📋 팀장 일일 종합 보고서")
                    logger.info("=" * 80)
                    logger.info(f"\n📈 시장 현황")
                    for symbol, status in market_status.items():
                        logger.info(f"  • {symbol}: ₩{status['price']:,.0f}")

                    logger.info(f"\n💰 포트폴리오 현황")
                    logger.info(f"  • 총 자산: ₩{portfolio_data['total_assets']:,.0f}")
                    logger.info(f"  • 수익률: {portfolio_data['total_return']:+.2f}% (₩{portfolio_data['total_pnl']:,.0f})")

                    logger.info(f"\n🎯 오늘의 매매 전략")
                    for note in strategy_notes:
                        logger.info(f"  • {note['symbol']}: {note['strategy']} {note['reason']}")

                    logger.info(f"\n⚠️  조치사항")
                    if self.daily_report['actions']:
                        for action in self.daily_report['actions']:
                            logger.info(f"  • {action}")
                    else:
                        logger.info(f"  • 없음 (정상 운영)")

                    logger.info("=" * 80 + "\n")

                    # 대시보드에 전송
                    self.dashboard.send_daily_report(self.daily_report)

            except Exception as e:
                logger.error(f"❌ 일일 보고서 생성 오류: {e}")
                await asyncio.sleep(10)

    async def _team_lead_monitor(self) -> None:
        """🎯 팀장의 실시간 모니터링 & 분석

        역할:
        1. 포트폴리오 상태 실시간 추적
        2. 변화 감지 & 분석
        3. 손절/익절 기회 식별
        4. 문제 자동 해결
        5. 변화가 있을 때만 보고
        """
        import time
        last_report_time = time.time()
        report_interval = 120  # 2분마다만 전체 보고 (변화 있을 때)

        while self.trading_active:
            try:
                await asyncio.sleep(30)  # 30초마다 체크
                current_time = time.time()

                # 현재 포트폴리오 상태 수집
                open_positions = self.position_manager.get_open_positions()

                if not open_positions:
                    continue

                # 현재 상태 수집
                current_state = {
                    'positions': [],
                    'total_pnl': 0,
                    'total_return': 0,
                    'timestamp': datetime.now()
                }

                alerts = []  # 주요 변화/경고

                for pos in open_positions:
                    if not pos.current_price:
                        continue

                    pnl = (pos.current_price - pos.entry_price) * pos.quantity
                    pnl_pct = ((pos.current_price - pos.entry_price) / pos.entry_price * 100)

                    current_state['positions'].append({
                        'symbol': pos.symbol,
                        'pnl': pnl,
                        'pnl_pct': pnl_pct,
                        'current_price': pos.current_price
                    })
                    current_state['total_pnl'] += pnl
                    current_state['total_return'] = (current_state['total_pnl'] / 191154 * 100)

                    # 🔴 팀장: 손절 근처 감지
                    if pos.current_price <= pos.stop_loss_price * 1.01 and pnl_pct < -1.5:
                        alerts.append({
                            'type': '손절_경고',
                            'symbol': pos.symbol,
                            'pnl_pct': pnl_pct,
                            'msg': f"⚠️ {pos.symbol}: 손절 근처 ({pnl_pct:.2f}%) - 모니터링 중"
                        })

                    # 🟢 팀장: 익절 기회 감지
                    if pos.current_price >= pos.take_profit_price * 0.98 and pnl_pct > 4.5:
                        alerts.append({
                            'type': '익절_기회',
                            'symbol': pos.symbol,
                            'pnl_pct': pnl_pct,
                            'msg': f"✅ {pos.symbol}: 익절 기회 ({pnl_pct:.2f}%) - 준비 완료"
                        })

                    # 📈 팀장: 주요 상승 감지
                    if pnl_pct > 3 and pnl_pct < 4.5:
                        alerts.append({
                            'type': '상승_추적',
                            'symbol': pos.symbol,
                            'pnl_pct': pnl_pct,
                            'msg': f"📈 {pos.symbol}: 상승 중 ({pnl_pct:.2f}%)"
                        })

                # 변화 감지: 이전 상태와 비교
                has_change = False
                if self.last_portfolio_state:
                    prev_pnl = self.last_portfolio_state.get('total_pnl', 0)
                    pnl_change = abs(current_state['total_pnl'] - prev_pnl)
                    if pnl_change > 500:  # ₩500 이상 변화
                        has_change = True

                # 변화가 있거나 2분 간격 보고 또는 경고 있을 때만 보고
                if has_change or (current_time - last_report_time > report_interval) or alerts:
                    logger.info("\n" + "=" * 80)
                    logger.info("🎯 팀장 모니터링 보고")
                    logger.info("=" * 80)
                    logger.info(f"🕐 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

                    # 경고/기회 보고
                    if alerts:
                        logger.info(f"\n📍 감지된 변화 ({len(alerts)}건):")
                        for alert in alerts:
                            logger.info(f"   {alert['msg']}")

                    # 포트폴리오 요약
                    logger.info(f"\n💎 현재 포트폴리오")
                    logger.info(f"   총 손익: ₩{current_state['total_pnl']:,.0f} ({current_state['total_return']:+.2f}%)")

                    # 각 포지션 상태
                    logger.info(f"\n📊 포지션 현황:")
                    for pos_info in current_state['positions']:
                        logger.info(f"   [{pos_info['symbol']}] {pos_info['pnl_pct']:+.2f}% (₩{pos_info['pnl']:,.0f})")

                    logger.info("=" * 80 + "\n")

                    # 상태 저장
                    self.last_portfolio_state = current_state
                    last_report_time = current_time

            except Exception as e:
                logger.error(f"❌ 팀장 모니터링 오류: {e}")
                await asyncio.sleep(10)

    async def _analysis_loop(self) -> None:
        """주기적 신호 분석 루프 (매 1분)"""
        last_reset_date = datetime.now().date()

        while self.trading_active:
            try:
                # ============================================
                # 일일 손실 리셋 (자정)
                # ============================================
                current_date = datetime.now().date()
                if current_date > last_reset_date:
                    logger.info("=" * 60)
                    logger.info(f"📊 일일 손실 리셋 (전일 손익: ₩{self.daily_pnl:,.0f})")
                    logger.info("=" * 60)
                    self.daily_pnl = 0.0
                    self.consecutive_losses = 0
                    last_reset_date = current_date

                # ============================================
                # 1. 신호 분석
                # ============================================
                signals = await self._analyze_markets()

                # 현재 신호를 파일에 저장 (대시보드용)
                self._save_current_signals(signals)

                # ============================================
                # 2. 신호 기반 매매
                # ============================================
                # 실시간 KRW 잔액 조회 (항상 조회)
                krw_balance = 0
                krw_balance_data = await self.upbit.get_account_balance()
                if krw_balance_data:
                    krw_balance = float(krw_balance_data.get('balance', 0))
                    logger.info(f"✅ 실시간 KRW 잔액: ₩{krw_balance:,.0f}")
                else:
                    logger.warning("⚠️  KRW 잔액 조회 실패")

                if krw_balance and krw_balance > 0:
                    for signal in signals:
                        if signal["recommendation"] == "BUY" and self.trading_enabled:
                            await self._execute_buy_order(signal, krw_balance)
                        elif signal["recommendation"] == "SELL" and self.trading_enabled:
                            # SELL 신호에서 market 추출
                            market = signal.get("market")
                            if market:
                                # 보유 포지션 찾기 (position_manager 사용)
                                position = self.position_manager.get_position_by_symbol(market)
                                if position:
                                    await self._execute_sell_order(position)

                # ============================================
                # 3. 보유 포지션 모니터링 (손절/익절) 🎯 부스터 모드
                # ============================================
                await self._monitor_positions()

                # ============================================
                # 4. 다음 분석까지 대기 (30초 - 초단타 모드)
                # ============================================
                await asyncio.sleep(30)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"❌ 분석 루프 오류: {e}")
                await asyncio.sleep(10)

    async def _run_cycle(self) -> None:
        """한 사이클 실행 (분석 → 매매 → 모니터링) - once 모드용"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        logger.info(f"[{timestamp}] 거래 사이클 시작")

        # 1. 계좌 잔고 확인
        balance = await self.upbit.get_account_balance()
        if not balance:
            logger.warning("⚠️  계좌 잔고 조회 실패")
            return

        krw_balance = float(balance.get('balance', 0))
        krw_locked = float(balance.get('locked', 0))
        logger.info(f"💰 KRW 잔액: ₩{krw_balance:,.0f} (예약: ₩{krw_locked:,.0f})")

        # 1.5. 계좌 현황을 대시보드로 전송
        try:
            # 암호화폐 보유 현황 조회
            all_balances = await self.upbit.get_all_balances()
            holdings = []
            total_buy_price = 0  # 총 매수가
            total_eval_price = 0  # 총 평가가
            total_quantity_krw = 0

            if all_balances:
                for asset in all_balances:
                    market = asset.get('market', '')
                    balance_crypto = float(asset.get('balance', 0))
                    avg_buy_price = float(asset.get('avg_buy_price', 0))

                    # KRW 제외, 암호화폐만 처리
                    if balance_crypto > 0 and market and market.startswith('KRW-'):
                        ticker = await self.upbit.get_ticker(market)
                        if ticker:
                            current_price = float(ticker.get('trade_price', 0))
                            buy_value = balance_crypto * avg_buy_price
                            eval_value = balance_crypto * current_price
                            gain = eval_value - buy_value

                            total_buy_price += buy_value
                            total_eval_price += eval_value

                            holdings.append({
                                'market': market,
                                'quantity': balance_crypto,
                                'avg_buy_price': avg_buy_price,
                                'current_price': current_price,
                                'buy_value': buy_value,
                                'eval_value': eval_value,
                                'gain': gain,
                                'gain_rate': (gain / buy_value * 100) if buy_value > 0 else 0
                            })

            # Upbit 스타일 포트폴리오 정보
            total_gain = total_eval_price - total_buy_price
            total_return = (total_gain / total_buy_price * 100) if total_buy_price > 0 else 0

            account_data = {
                'krw_balance': krw_balance,  # 보유현금
                'krw_locked': krw_locked,
                'total_assets': krw_balance + krw_locked + total_eval_price,  # 총 보유자산
                'total_buy_price': total_buy_price,  # 총 매수
                'total_eval_price': total_eval_price,  # 총 평가
                'total_gain': total_gain,  # 평가손익
                'total_return': total_return,  # 수익률 (%)
                'holdings': holdings
            }
            self.dashboard.send_account_status(account_data)
        except Exception as e:
            logger.warning(f"⚠️  계좌 현황 전송 실패: {e}")

        # 2. 마켓 분석 및 신호 생성
        signals = await self._analyze_markets()

        # 3. 신호 기반 매매 실행
        # 계좌 조회 (재시도 포함)
        krw_balance = krw_balance  # 이전 값 사용
        krw_balance_data = None
        retry_count = 0
        while not krw_balance_data and retry_count < 3:
            krw_balance_data = await self.upbit.get_account_balance()
            if not krw_balance_data:
                retry_count += 1
                if retry_count < 3:
                    await asyncio.sleep(2)

        if krw_balance_data:
            krw_balance = float(krw_balance_data.get('balance', 0))

        buy_count = 0
        sell_count = 0
        for signal in signals:
            if signal["recommendation"] == "BUY" and self.trading_enabled and krw_balance_data:
                success = await self._execute_buy_order(signal, krw_balance)
                if success:
                    buy_count += 1
            elif signal["recommendation"] == "SELL" and self.trading_enabled:
                # SELL 신호에서 market 추출
                market = signal.get("market")
                if market:
                    # 보유 포지션 찾기
                    for position in self.positions:
                        if position.symbol == market:
                            success = await self._execute_sell_order(position)
                            if success:
                                sell_count += 1
                            break

        if buy_count > 0 or sell_count > 0:
            logger.info(f"📈 매매 실행: BUY {buy_count}개, SELL {sell_count}개")
        else:
            logger.info("ℹ️  신호 없음 또는 거래 비활성화")

        # 4. 보유 포지션 모니터링 (손절/익절)
        await self._monitor_positions()

        logger.info("=" * 60)

    def _analyze_market_state(self, ohlc_data: List[Dict]) -> str:
        """
        시장 상태 분석 (시장상태 판단팀)

        입력: OHLC 캔들 데이터 (분봉)
        출력: 시장 상태 플래그 (UPTREND, DOWNTREND, SIDEWAYS, VOLATILITY)

        규칙:
        - UPTREND: 일정 기간 연속 상승
        - DOWNTREND: 일정 기간 연속 하락
        - VOLATILITY: 변동성 급증
        - SIDEWAYS: 횡보
        """
        if not ohlc_data or len(ohlc_data) < 5:
            return "SIDEWAYS"

        try:
            # 최근 5개 캔들 분석
            recent = ohlc_data[-5:]
            closes = [candle.get('closing_price', 0) for candle in recent]

            if not closes or any(c == 0 for c in closes):
                return "SIDEWAYS"

            # 상승 추세 확인
            uptrend_count = sum(1 for i in range(1, len(closes)) if closes[i] > closes[i-1])

            # 변동성 계산 (표준편차)
            avg_close = sum(closes) / len(closes)
            variance = sum((c - avg_close) ** 2 for c in closes) / len(closes)
            volatility = math.sqrt(variance) / avg_close

            # 시장 상태 판단
            if uptrend_count >= 4:
                return "UPTREND"
            elif uptrend_count <= 1:
                return "DOWNTREND"
            elif volatility > 0.05:  # 변동성 5% 이상
                return "VOLATILITY"
            else:
                return "SIDEWAYS"

        except Exception as e:
            logger.error(f"❌ 시장 상태 분석 오류: {e}")
            return "SIDEWAYS"

    def _analyze_orderbook(self, orderbook_data: Optional[Dict]) -> Dict[str, float]:
        """
        호가·체결 분석팀 - 매수/매도 강도 분석

        입력: 호가북 데이터 (bid/ask 잔량)
        출력: {
            "bid_strength": 0-1,  # 매수 강도
            "ask_strength": 0-1,  # 매도 강도
            "pressure_ratio": float  # 매집 신호 (bid/ask 비율)
        }
        """
        if not orderbook_data:
            return {
                "bid_strength": 0.5,
                "ask_strength": 0.5,
                "pressure_ratio": 1.0
            }

        try:
            bids = orderbook_data.get("bids", [])
            asks = orderbook_data.get("asks", [])

            # 상위 5개 호가의 잔량 합계
            bid_volume = sum(b.get("size", 0) for b in bids[:5])
            ask_volume = sum(a.get("size", 0) for a in asks[:5])

            total_volume = bid_volume + ask_volume

            if total_volume == 0:
                return {
                    "bid_strength": 0.5,
                    "ask_strength": 0.5,
                    "pressure_ratio": 1.0
                }

            # 강도 계산 (0-1)
            bid_strength = bid_volume / total_volume
            ask_strength = ask_volume / total_volume

            # 압력비 (매집 신호)
            pressure_ratio = bid_volume / ask_volume if ask_volume > 0 else 1.0

            return {
                "bid_strength": min(bid_strength, 1.0),
                "ask_strength": min(ask_strength, 1.0),
                "pressure_ratio": min(pressure_ratio, 3.0)  # 상한 3.0
            }

        except Exception as e:
            logger.error(f"❌ 호가 분석 오류: {e}")
            return {
                "bid_strength": 0.5,
                "ask_strength": 0.5,
                "pressure_ratio": 1.0
            }

    def _generate_trading_signal(
        self,
        market: str,
        current_price: float,
        market_state: str,
        signal_strength: str,
        orderbook: Optional[Dict],
        confidence: int
    ) -> Optional[Dict]:
        """
        초단타 전략팀 - 진입가·익절가·손절가 결정

        입력:
        - market_state: UPTREND/DOWNTREND/SIDEWAYS/VOLATILITY
        - signal_strength: 신호 강도 (Claude 분석)
        - orderbook: 호가북 데이터
        - confidence: 신뢰도 (0-100)

        출력: {
            "entry_price": float,
            "take_profit": float,
            "stop_loss": float,
            "holding_time": int (초),
            "confidence": float (0-1),
            "strategy": str (설명)
        }

        규칙:
        - 신뢰도 70% 이상만 진입
        - UPTREND + 신호강도 70% → 매수
        - VOLATILITY + bid_strength 80% → 매수
        - 수익 목표: 2%(보수) / 5%(중간) / 10%(적극)
        - 손절: -2%(매우적극) / -5%(적극) / -10%(최대감수)
        - 보유: 1-5분
        """
        if confidence < 70:
            return None

        try:
            orderbook_analysis = self._analyze_orderbook(orderbook)
            bid_strength = orderbook_analysis.get("bid_strength", 0.5)

            # 신호 생성 규칙
            signal = None
            strategy_desc = ""

            # 규칙 1: UPTREND + 신호 강도 높음
            if market_state == "UPTREND":
                signal = {
                    "entry_price": current_price * 0.995,  # 현재가 -0.5%
                    "take_profit": current_price * 1.10,    # 익절 +10% (적극)
                    "stop_loss": current_price * 0.95,      # 손절 -5% (적극)
                    "holding_time": 180,  # 3분
                    "confidence": confidence / 100.0,
                    "strategy": "상승세 추종 (UPTREND 적극 진입)"
                }
                strategy_desc = "📈 UPTREND: +10% 익절 / -5% 손절"

            # 규칙 2: VOLATILITY + 매수 강도 80% 이상
            elif market_state == "VOLATILITY" and bid_strength > 0.8:
                signal = {
                    "entry_price": current_price,
                    "take_profit": current_price * 1.05,    # 익절 +5% (중간)
                    "stop_loss": current_price * 0.98,      # 손절 -2% (매우적극)
                    "holding_time": 120,  # 2분
                    "confidence": confidence / 100.0,
                    "strategy": "변동성 급증 매수 (높은 매수 강도)"
                }
                strategy_desc = "⚡ VOLATILITY: +5% 익절 / -2% 손절"

            # 규칙 3: DOWNTREND는 공매도 (암호화폐에서는 신중함)
            elif market_state == "DOWNTREND" and confidence > 80:
                # 보수적으로: 하락장에서는 진입하지 않음
                signal = None
                strategy_desc = "⏸️  DOWNTREND: 진입 보류"

            # 규칙 4: SIDEWAYS 횡보장에서는 매우 신중함
            elif market_state == "SIDEWAYS":
                if confidence > 85 and bid_strength > 0.75:
                    signal = {
                        "entry_price": current_price,
                        "take_profit": current_price * 1.02,  # 익절 +2% (보수)
                        "stop_loss": current_price * 0.99,    # 손절 -1%
                        "holding_time": 60,  # 1분
                        "confidence": confidence / 100.0,
                        "strategy": "횡보장 박스 매매 (매우 신중)"
                    }
                    strategy_desc = "➡️  SIDEWAYS: +2% 익절 / -1% 손절"

            if signal:
                logger.info(f"✅ {market} 신호 생성: {strategy_desc}")
                return signal
            else:
                logger.debug(f"⏸️  {market} {strategy_desc}")
                return None

        except Exception as e:
            logger.error(f"❌ 신호 생성 오류 ({market}): {e}")
            return None

    def _calculate_kelly_criterion(
        self,
        win_rate: float,
        avg_win: float,
        avg_loss: float
    ) -> float:
        """
        Kelly Criterion을 사용한 포지션 사이징

        공식: f = (bp*p - q) / b
        - f: 베팅 비율 (0-1)
        - b: 배당률
        - p: 승률
        - q: 패율 (1-p)

        입력:
        - win_rate: 승률 (0-1)
        - avg_win: 평균 수익률
        - avg_loss: 평균 손실률 (음수)

        출력: 포지션 비중 (0-0.5, 최대 50%)
        """
        if win_rate <= 0 or win_rate >= 1:
            return 0.1  # 기본값 10%

        try:
            # Kelly 공식 변형
            b = avg_win / abs(avg_loss) if avg_loss != 0 else 1.0
            q = 1 - win_rate

            kelly_fraction = (b * win_rate - q) / b if b > 0 else 0

            # 보안: 최대 50% 제한
            kelly_fraction = max(0.01, min(kelly_fraction, 0.5))

            return kelly_fraction

        except Exception as e:
            logger.error(f"❌ Kelly Criterion 계산 오류: {e}")
            return 0.1

    def _check_risk_limits(
        self,
        signal: Optional[Dict],
        current_balance: float,
        open_positions: List[Position],
        daily_pnl: float
    ) -> Dict:
        """
        리스크 관리팀 - 주문 승인/거부 및 포지션 사이징

        입력:
        - signal: 거래 신호 (또는 None)
        - current_balance: 현재 계좌 잔액 (KRW)
        - open_positions: 열린 포지션 목록
        - daily_pnl: 일일 손익

        출력: {
            "approved": bool,  # 주문 승인 여부
            "adjusted_position_size": float,  # 조정된 포지션 비중
            "reason": str,  # 결과 설명
            "risk_status": {
                "daily_loss_pct": float,  # 일일 손실률
                "consecutive_losses": int,  # 연속 손실
                "max_drawdown_pct": float,  # 최대 드로우다운
                "portfolio_pnl": float  # 포트폴리오 손익
            }
        }

        검사 규칙:
        1. 일일 손실 한도: -10% 이상 손실 금지
        2. 포지션 사이징: Kelly Criterion 적용
        3. 연속 손실 3회 후 대기
        4. 최대 드로우다운: -20% 이상 금지
        """
        result = {
            "approved": False,
            "adjusted_position_size": 0.0,
            "reason": "기본값",
            "risk_status": {
                "daily_loss_pct": 0.0,
                "consecutive_losses": self.consecutive_losses,
                "max_drawdown_pct": 0.0,
                "portfolio_pnl": 0.0
            }
        }

        try:
            # 초기 포트폴리오 가치 설정
            if self.initial_portfolio_value == 0:
                self.initial_portfolio_value = current_balance
                self.max_portfolio_value = current_balance

            # 1. 일일 손실률 계산
            daily_loss_pct = daily_pnl / self.initial_portfolio_value if self.initial_portfolio_value > 0 else 0
            result["risk_status"]["daily_loss_pct"] = daily_loss_pct

            # 2. 최대 드로우다운 계산
            current_portfolio_value = current_balance
            for pos in open_positions:
                if pos.current_price:
                    current_portfolio_value += pos.current_price * pos.quantity

            self.max_portfolio_value = max(self.max_portfolio_value, current_portfolio_value)
            max_drawdown = (current_portfolio_value - self.max_portfolio_value) / self.max_portfolio_value
            result["risk_status"]["max_drawdown_pct"] = max_drawdown

            # ============================================
            # 리스크 체크 1: 일일 손실 한도 (부스터: 무제한)
            # ============================================
            max_daily_loss = CRYPTO_TRADING_RULES.get("max_daily_loss")
            if max_daily_loss is not None and daily_loss_pct <= max_daily_loss:
                result["approved"] = False
                result["reason"] = f"❌ 일일 손실 한도 도달 ({daily_loss_pct:.2%} <= {max_daily_loss:.2%})"
                logger.warning(result["reason"])
                return result

            # ============================================
            # 리스크 체크 2: 최대 드로우다운 (부스터: 무제한)
            # ============================================
            max_drawdown_limit = CRYPTO_TRADING_RULES.get("max_drawdown")
            if max_drawdown_limit is not None and max_drawdown <= max_drawdown_limit:
                result["approved"] = False
                result["reason"] = f"❌ 최대 드로우다운 도달 ({max_drawdown:.2%} <= {max_drawdown_limit:.2%})"
                logger.warning(result["reason"])
                return result

            # ============================================
            # 리스크 체크 3: 연속 손실 3회
            # ============================================
            if self.consecutive_losses >= CRYPTO_TRADING_RULES["consecutive_loss_threshold"]:
                result["approved"] = False
                result["reason"] = f"⏸️  연속 손실 {self.consecutive_losses}회 - 대기 중"
                logger.warning(result["reason"])
                return result

            # ============================================
            # 신호가 없으면 HOLD
            # ============================================
            if not signal:
                result["approved"] = False
                result["reason"] = "📊 신호 없음 - HOLD"
                return result

            # ============================================
            # 신뢰도 체크 (50% 이상 - 부스터 모드)
            # ============================================
            confidence = signal.get("confidence", 50)  # 백분율 (0-100)
            min_confidence_pct = int(CRYPTO_TRADING_RULES["min_signal_confidence"] * 100)  # 0.50 → 50
            if confidence < min_confidence_pct:
                result["approved"] = False
                result["reason"] = f"⚠️  신뢰도 낮음 ({confidence}% < {min_confidence_pct}%)"
                return result

            # ============================================
            # 포지션 사이징: Kelly Criterion 적용
            # ============================================
            # 거래 이력에서 승률 계산
            total_trades = len(self.trade_history)
            if total_trades >= 10:
                winning_trades = sum(1 for t in self.trade_history if t.get("pnl", 0) > 0)
                win_rate = winning_trades / total_trades

                # 평균 수익/손실 계산
                wins = [t.get("pnl", 0) for t in self.trade_history if t.get("pnl", 0) > 0]
                losses = [abs(t.get("pnl", 0)) for t in self.trade_history if t.get("pnl", 0) < 0]

                avg_win = sum(wins) / len(wins) if wins else 0
                avg_loss = sum(losses) / len(losses) if losses else 0

                # Kelly Criterion 계산
                kelly_size = self._calculate_kelly_criterion(win_rate, avg_win, avg_loss)
            else:
                # 초기 거래: 보수적으로 5% 포지션
                kelly_size = 0.05

            # ============================================
            # 최종 포지션 사이징 (안전장치)
            # ============================================
            # 가용 자금과 기존 포지션을 고려
            total_open_value = sum(pos.current_price * pos.quantity for pos in open_positions if pos.current_price)
            available_cash = max(0, current_balance - total_open_value)

            # 포지션 비중: Kelly 크기 × 사용 가능 현금 비율
            max_position_size = min(kelly_size, 0.3)  # 최대 30%
            position_size = available_cash * max_position_size / current_balance if current_balance > 0 else 0.05

            # ============================================
            # 최종 승인
            # ============================================
            result["approved"] = True
            result["adjusted_position_size"] = position_size
            result["reason"] = f"✅ 승인 (신뢰도 {confidence:.0%}, Kelly {position_size:.2%})"

            logger.info(
                f"✅ 리스크 승인: 신뢰도 {confidence:.0%}, "
                f"Kelly {position_size:.2%}, "
                f"일일손실 {daily_loss_pct:.2%}, "
                f"드로우다운 {max_drawdown:.2%}"
            )

            return result

        except Exception as e:
            logger.error(f"❌ 리스크 체크 오류: {e}")
            result["approved"] = False
            result["reason"] = f"❌ 리스크 체크 오류: {e}"
            return result

    async def _analyze_markets(self) -> List[Dict]:
        """마켓 분석 및 신호 생성 (Claude AI + 기술적 지표)"""
        signals = []

        for market in self.markets:
            try:
                # 1. 실시간 시세 조회
                ticker = await self.upbit.get_ticker(market)
                if not ticker:
                    logger.warning(f"⏳ {market}: 시세 조회 실패")
                    continue

                current_price = float(ticker.get('trade_price', 0))
                logger.debug(f"📊 {market}: ₩{current_price:,.0f}")

                # 2. 캔들 데이터 조회 (분봉 60개 + 시간봉 24개)
                ohlc_min = await self.upbit.get_ohlc(market, interval="minutes/1", count=60)
                ohlc_hour = await self.upbit.get_candles_hourly(market, count=24)

                # 3. Claude AI 분석 (기술적 지표 포함)
                analysis = self.analyzer.analyze_crypto(
                    market,
                    ticker,
                    ohlc_min or ohlc_hour or []
                )

                signal = {
                    "market": market,
                    "current_price": current_price,
                    "recommendation": analysis.get("recommendation", "HOLD"),
                    "confidence": int(analysis.get("confidence", 0.5) * 100),
                    "entry_price": analysis.get("entry_price", current_price),
                    "stop_loss_price": analysis.get("stop_loss_price", current_price * 0.95),
                    "take_profit_price": analysis.get("take_profit_price", current_price * 1.10),
                    "signal_strength": analysis.get("signal_strength", "중립"),
                    "reasoning": analysis.get("reasoning", "")
                }

                # 부스터 모드: 신뢰도 50% 이상 BUY/SELL 신호 거래 (공격적 거래)
                if signal["recommendation"] == "BUY" and signal["confidence"] >= 50:
                    signals.append(signal)
                    logger.info(
                        f"🟢 {market}: BUY ⭐ (신뢰도 {signal['confidence']}%, "
                        f"{signal['signal_strength']}, ₩{current_price:,.0f})"
                    )
                    if signal.get("reasoning"):
                        logger.info(f"   📌 {signal['reasoning']}")
                elif signal["recommendation"] == "SELL" and signal["confidence"] >= 50:
                    signals.append(signal)
                    logger.warning(
                        f"🔴 {market}: SELL ⭐ (신뢰도 {signal['confidence']}%, "
                        f"{signal['signal_strength']})"
                    )
                    if signal.get("reasoning"):
                        logger.warning(f"   📌 {signal['reasoning']}")
                else:
                    logger.debug(
                        f"⏸️  {market}: HOLD (신뢰도 {signal['confidence']}%, "
                        f"{signal['signal_strength']})"
                    )

            except Exception as e:
                logger.error(f"❌ {market} 분석 오류: {e}")
                import traceback
                traceback.print_exc()

        return signals

    async def _execute_buy_order(
        self,
        signal: Dict,
        available_cash: float
    ) -> bool:
        """
        매수 주문 실행 (리스크 체크 포함)

        프로세스:
        1. 리스크 체크 (일일 손실, 드로우다운, 연속 손실)
        2. 포지션 사이징 (Kelly Criterion)
        3. 신뢰도 필터링 (70% 이상)
        4. 실주문 실행
        5. 거래 기록 저장
        """
        market = signal["market"]
        current_price = signal["current_price"]
        entry_price = signal["entry_price"]

        # ============================================
        # 1. 리스크 체크
        # ============================================
        open_positions = self.position_manager.get_open_positions()
        risk_result = self._check_risk_limits(
            signal=signal,
            current_balance=available_cash,
            open_positions=open_positions,
            daily_pnl=self.daily_pnl
        )

        if not risk_result["approved"]:
            logger.warning(f"⛔ {market} 리스크 거부: {risk_result['reason']}")
            return False

        # ============================================
        # 2. 포지션 사이징 (Kelly Criterion 적용)
        # ============================================
        kelly_size = risk_result["adjusted_position_size"]

        # 유연한 주문 금액 계산
        # 1. Kelly 기반 계산
        order_amount = available_cash * kelly_size

        # 2. 최소 주문 금액 (₩5,000 이상)
        if order_amount < 5000:
            order_amount = min(available_cash * 0.8, available_cash - 1000)  # 현금의 80% 또는 1,000원 남김

        # 3. 현금 부족 체크
        if order_amount > available_cash:
            # 현금의 50% 사용
            order_amount = available_cash * 0.5
            logger.warning(f"⚠️  {market}: 현금 부족하여 50% 사용 (현금: ₩{available_cash:,.0f}, 주문액: ₩{order_amount:,.0f})")

        if order_amount < 5000:
            logger.warning(f"⚠️  {market}: 주문 금액이 최소값(₩5,000) 미만 (현금: ₩{available_cash:,.0f})")
            return False

        logger.info(f"💰 {market} 주문 금액: ₩{order_amount:,.0f} (Kelly {kelly_size:.2%})")

        # 수량 계산
        volume = order_amount / entry_price

        try:
            # 🔴 실거래: 업비트 계좌에 실제 주문 생성
            logger.warning("=" * 60)
            logger.warning(f"🔴 실거래 주문 실행 (업비트 실제 계좌에 반영됨)")
            logger.warning(f"   마켓: {market}")
            logger.warning(f"   방향: BUY (매수)")
            logger.warning(f"   금액: ₩{order_amount:,.0f}")
            logger.warning(f"   수량: {volume}")
            logger.warning(f"   가격: ₩{entry_price:,.0f}")
            logger.warning("=" * 60)

            order = await self.upbit.place_order(
                market=market,
                side="BUY",
                volume=volume,
                price=entry_price,
                ord_type="MARKET"
            )

            if order:
                # 포지션 저장
                position = Position(
                    symbol=market,
                    entry_price=entry_price,
                    quantity=volume,
                    entry_time=datetime.now(),
                    stop_loss_price=signal["stop_loss_price"],
                    take_profit_price=signal["take_profit_price"],
                    status=PositionStatus.OPEN
                )
                self.position_manager.add_position(position)

                # 실거래 확인 로그
                logger.warning("=" * 60)
                logger.warning(f"✅ 실거래 주문 성공!")
                logger.warning(f"   주문 UUID: {order.get('uuid', 'N/A')}")
                logger.warning(f"   상태: {order.get('state', 'N/A')}")
                logger.warning(f"   업비트 계좌에 반영됨")
                logger.warning("=" * 60)

                # ============================================
                # 성과평가 (수수료·슬리피지 반영)
                # ============================================
                performance = self._evaluate_trade_performance(order, position)

                # 거래 기록 저장 (DB에 저장)
                self.trade_record_manager.save_trade_record(performance)

                # 일일 손익 업데이트
                self.daily_pnl += performance.get("profit_loss", 0)
                if performance.get("profit_loss", 0) < 0:
                    self.consecutive_losses += 1
                else:
                    self.consecutive_losses = 0

                # 거래 기록 저장 (Kelly Criterion 성능 평가용)
                trade_record = {
                    "timestamp": datetime.now().isoformat(),
                    "market": market,
                    "side": "BUY",
                    "entry_price": entry_price,
                    "actual_entry": performance.get("actual_entry", entry_price),
                    "quantity": volume,
                    "amount": order_amount,
                    "confidence": signal.get('confidence', 0),
                    "pnl": performance.get("profit_loss", 0.0),
                    "pnl_pct": performance.get("profit_loss_pct", 0.0),
                    "fees": performance.get("fees", 0.0),
                    "slippage": performance.get("slippage", 0.0),
                    "status": "OPEN",
                    "order_uuid": order.get('uuid', ''),
                    "kelly_size": kelly_size
                }
                self.trade_history.append(trade_record)

                # 대시보드로 거래 데이터 전송
                trade_data = {
                    "market": market,
                    "side": "BUY",
                    "volume": volume,
                    "price": entry_price,
                    "actual_entry": performance.get("actual_entry", entry_price),
                    "amount": order_amount,
                    "order_uuid": order.get('uuid', ''),
                    "status": order.get('state', 'submitted'),
                    "confidence": signal.get('confidence', 0),
                    "kelly_size": kelly_size,
                    "pnl": performance.get("profit_loss", 0.0),
                    "fees": performance.get("fees", 0.0),
                    "slippage": performance.get("slippage", 0.0)
                }
                self.dashboard.send_trade_order(trade_data)

                # 진행 중인 주문 추적
                self.active_orders[order.get('uuid', '')] = {
                    "market": market,
                    "side": "BUY",
                    "entry_time": datetime.now(),
                    "position": position,
                    "performance": performance
                }

                logger.info(
                    f"📊 거래 기록 저장: {market} 매수 (Kelly {kelly_size:.2%}, "
                    f"신뢰도 {signal.get('confidence', 0):.0%}, "
                    f"손익: ₩{performance.get('profit_loss', 0):,.0f})"
                )
                return True
            else:
                logger.error(f"❌ {market} 매수 주문 실패")
                return False

        except Exception as e:
            logger.error(f"❌ {market} 주문 실행 오류: {e}")
            return False

    async def _monitor_positions(self) -> None:
        """보유 포지션 모니터링 (손절/익절 + 시간제한) - 팀원3: 손절/익절 자동 매도 통합"""
        try:
            positions = self.position_manager.get_open_positions()
            if not positions:
                return

            logger.info(f"🔍 포지션 모니터링: {len(positions)}개")

            max_holding_time = CRYPTO_TRADING_RULES.get("max_holding_time", 300)  # 5분(300초)

            for position in positions:
                try:
                    # 포지션 필드 안전성 확인
                    symbol = getattr(position, 'symbol', None) or getattr(position, 'market', None)
                    if not symbol:
                        logger.warning(f"⚠️  포지션 심볼 없음: {position}")
                        continue

                    # 📊 시간 기반 손절: 최대 보유 시간 초과 체크
                    entry_time = getattr(position, 'entry_time', None)
                    if entry_time:
                        holding_time = (datetime.now() - entry_time).total_seconds()
                        if holding_time > max_holding_time:
                            logger.warning(f"⏰ 시간제한 손절 발동: {symbol} (보유시간: {holding_time:.0f}초)")
                            if self.trading_enabled:
                                # 실시간 시세 조회 후 매도
                                ticker = await self.upbit.get_ticker(symbol)
                                if ticker:
                                    current_price = float(ticker.get('trade_price', 0))
                                    result = await self.upbit.place_order(
                                        market=symbol,
                                        side="sell",
                                        volume=position.quantity,
                                        price=current_price
                                    )
                                    if result and result.get("uuid"):
                                        position.close_position(current_price, PositionStatus.STOPPED)
                                        logger.warning(f"✅ 시간제한 매도 완료: UUID={result['uuid']}")
                                        self.daily_pnl += position.pnl
                                        self.trade_history.append({
                                            "symbol": symbol,
                                            "type": "TIME_LIMIT_STOP",
                                            "pnl": position.pnl,
                                            "holding_time": holding_time,
                                            "timestamp": datetime.now().isoformat()
                                        })
                                continue

                    # 실시간 시세 조회
                    ticker = await self.upbit.get_ticker(symbol)
                    if not ticker:
                        logger.debug(f"⚠️  {symbol} 시세 조회 실패")
                        continue

                    current_price = float(ticker.get('trade_price', 0))
                    entry_price = getattr(position, 'entry_price', 0)
                    if entry_price == 0:
                        continue

                    profit_loss_pct = ((current_price - entry_price) / entry_price) * 100

                    # ============================================
                    # 팀원3: monitor_position_for_exit() 사용
                    # ============================================
                    if self.trading_enabled:
                        exit_result = await self.position_manager.monitor_position_for_exit(
                            position,
                            current_price,
                            self.upbit
                        )

                        if exit_result == "STOPPED":
                            logger.warning(f"✅ 손절 완료: {symbol}")
                            self.daily_pnl -= abs(position.pnl)
                            self.consecutive_losses += 1
                            self.trade_history.append({
                                "symbol": symbol,
                                "type": "STOP_LOSS",
                                "pnl": position.pnl,
                                "timestamp": datetime.now().isoformat()
                            })
                            continue

                        elif exit_result == "PROFITED":
                            logger.warning(f"✅ 익절 완료: {symbol}")
                            self.daily_pnl += position.pnl
                            self.consecutive_losses = 0
                            self.trade_history.append({
                                "symbol": symbol,
                                "type": "TAKE_PROFIT",
                                "pnl": position.pnl,
                                "timestamp": datetime.now().isoformat()
                            })
                            continue

                    # ============================================
                    # 일반 모니터링 (아직 포지션이 열려있을 경우)
                    # ============================================
                    if profit_loss_pct >= 0:
                        logger.info(
                            f"📈 {symbol}: +{profit_loss_pct:.2f}% "
                            f"(현재가 ₩{current_price:,.0f})"
                        )
                    else:
                        logger.info(
                            f"📉 {symbol}: {profit_loss_pct:.2f}% "
                            f"(현재가 ₩{current_price:,.0f})"
                        )

                except Exception as e:
                    symbol = getattr(position, 'symbol', getattr(position, 'market', 'unknown'))
                    logger.error(f"❌ {symbol} 모니터링 오류: {e}")
                    import traceback
                    traceback.print_exc()

        except Exception as e:
            logger.error(f"❌ 포지션 모니터링 전체 오류: {e}")
            import traceback
            traceback.print_exc()

    async def _execute_sell_order(self, position: Position) -> bool:
        """
        매도 주문 실행 (손익 기록 포함)

        프로세스:
        1. 포지션 정보 확인
        2. 실시간 시세 조회
        3. 손익 계산
        4. 매도 주문 실행
        5. 거래 기록 업데이트 (손익, 연속 손실)
        """
        # 안전한 필드 접근
        market = getattr(position, 'symbol', None) or getattr(position, 'market', None)
        if not market:
            logger.error("❌ 매도 주문 실패: 마켓 정보 없음")
            return False

        quantity = getattr(position, 'quantity', 0)
        if quantity <= 0:
            logger.error("❌ 매도 주문 실패: 수량 정보 없음")
            return False

        entry_price = getattr(position, 'entry_price', 0)
        if entry_price <= 0:
            logger.error("❌ 매도 주문 실패: 진입가 정보 없음")
            return False

        try:
            # 시세 조회 (시장가 주문용)
            ticker = await self.upbit.get_ticker(market)
            if not ticker:
                logger.error(f"❌ {market}: 매도 시세 조회 실패")
                return False

            current_price = float(ticker.get('trade_price', 0))

            # 손익 계산
            pnl = (current_price - entry_price) * quantity
            pnl_pct = ((current_price - entry_price) / entry_price) * 100

            # 🔴 실거래: 업비트 계좌에 실제 주문 생성
            logger.warning("=" * 60)
            logger.warning(f"🔴 실거래 주문 실행 (업비트 실제 계좌에 반영됨)")
            logger.warning(f"   마켓: {market}")
            logger.warning(f"   방향: SELL (매도)")
            logger.warning(f"   수량: {quantity}")
            logger.warning(f"   가격: ₩{current_price:,.0f}")
            logger.warning(f"   예상액: ₩{current_price * quantity:,.0f}")
            logger.warning("=" * 60)

            order = await self.upbit.place_order(
                market=market,
                side="SELL",
                volume=quantity,
                price=current_price,
                ord_type="MARKET"
            )

            if order:
                position.status = PositionStatus.CLOSED
                position.exit_time = datetime.now()
                position.exit_price = current_price

                # ============================================
                # 성과평가 (수수료·슬리피지 반영)
                # ============================================
                performance = self._evaluate_trade_performance(order, position)

                # 거래 기록 저장 (DB에 저장)
                self.trade_record_manager.save_trade_record(performance)

                # ============================================
                # 거래 기록 업데이트 (손익 저장)
                # ============================================
                # trade_history에서 해당 거래를 찾아 손익 업데이트
                for trade in reversed(self.trade_history):
                    if (trade.get("market") == market and
                        trade.get("side") == "BUY" and
                        trade.get("status") == "OPEN"):
                        trade["pnl"] = performance.get("profit_loss", pnl)
                        trade["pnl_pct"] = performance.get("profit_loss_pct", pnl_pct)
                        trade["status"] = "CLOSED"
                        trade["exit_price"] = current_price
                        trade["exit_time"] = datetime.now().isoformat()
                        trade["fees"] = performance.get("fees", 0.0)
                        trade["slippage"] = performance.get("slippage", 0.0)
                        break

                # ============================================
                # 연속 손실 추적
                # ============================================
                performance_pnl = performance.get("profit_loss", pnl)
                self.daily_pnl += performance_pnl
                if performance_pnl < 0:
                    self.consecutive_losses += 1
                else:
                    self.consecutive_losses = 0  # 수익이면 연속 손실 리셋

                # ============================================
                # 실거래 확인 로그
                # ============================================
                logger.warning("=" * 60)
                logger.warning(f"✅ 실거래 주문 성공!")
                logger.warning(f"   주문 UUID: {order.get('uuid', 'N/A')}")
                logger.warning(f"   상태: {order.get('state', 'N/A')}")
                logger.warning(f"   손익: ₩{performance.get('profit_loss', pnl):,.0f} "
                             f"({performance.get('profit_loss_pct', pnl_pct):+.2f}%)")
                logger.warning(f"   수수료: ₩{performance.get('fees', 0):,.0f}")
                logger.warning(f"   슬리피지: ₩{performance.get('slippage', 0):,.0f}")
                logger.warning(f"   연속손실: {self.consecutive_losses}")
                logger.warning(f"   일일손익: ₩{self.daily_pnl:,.0f}")
                logger.warning(f"   업비트 계좌에 반영됨")
                logger.warning("=" * 60)

                # 대시보드로 거래 데이터 전송
                trade_data = {
                    "market": market,
                    "side": "SELL",
                    "volume": quantity,
                    "price": current_price,
                    "amount": current_price * quantity,
                    "order_uuid": order.get('uuid', ''),
                    "status": order.get('state', 'submitted'),
                    "pnl": performance.get("profit_loss", pnl),
                    "pnl_pct": performance.get("profit_loss_pct", pnl_pct),
                    "fees": performance.get("fees", 0.0),
                    "slippage": performance.get("slippage", 0.0),
                    "consecutive_losses": self.consecutive_losses,
                    "daily_pnl": self.daily_pnl
                }
                self.dashboard.send_trade_order(trade_data)

                return True
            else:
                logger.error(f"❌ {market} 매도 주문 실패")
                return False

        except Exception as e:
            logger.error(f"❌ {market} 매도 주문 오류: {e}")
            return False

    def _evaluate_trade_performance(
        self,
        order: Dict,
        position: Optional[Position] = None
    ) -> Dict:
        """
        거래별 성과 평가 (수수료·슬리피지 반영)

        Args:
            order: 주문 정보 (uuid, market, side, price, volume, state, created_at)
            position: Position 객체 (optional, 마감 후 성과 평가 시)

        Returns:
            {
                "order_id": str,           # 주문 UUID
                "market": str,             # 마켓 (KRW-BTC 등)
                "side": str,               # BUY 또는 SELL
                "entry_price": float,      # 예상 진입가
                "actual_entry": float,     # 실제 체결가
                "exit_price": float,       # 실제 출현가 (매도 시)
                "quantity": float,         # 거래량
                "slippage": float,         # 슬리피지 (₩ 단위)
                "slippage_pct": float,     # 슬리피지율 (%)
                "fees": float,             # 수수료 (₩ 단위)
                "fees_pct": float,         # 수수료율 (%)
                "profit_loss": float,      # 손익 (₩ 단위, 수수료·슬리피지 반영)
                "profit_loss_pct": float,  # 손익률 (%)
                "holding_time": int,       # 보유시간 (초)
                "status": str,             # "success" | "failed" | "partial"
                "timestamp": str           # ISO 8601 타임스탬프
            }
        """
        try:
            order_id = order.get("uuid", "unknown")
            market = order.get("market", "")
            side = order.get("side", "BUY").upper()
            entry_price = float(order.get("price", 0))
            volume = float(order.get("volume", 0))
            order_state = order.get("state", "unknown")
            created_at_str = order.get("created_at", "")

            # 시간 계산
            try:
                created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
            except:
                created_at = datetime.now()

            now = datetime.now()
            holding_time = int((now - created_at).total_seconds())

            # 실제 체결가 (position이 있으면 사용, 없으면 entry_price 사용)
            if position:
                actual_entry = position.current_price or entry_price
                exit_price = position.exit_price or actual_entry
            else:
                actual_entry = entry_price
                exit_price = entry_price

            # 슬리피지 계산 (진입가와 실제 체결가의 차이)
            slippage = abs(actual_entry - entry_price)
            slippage_pct = (slippage / entry_price * 100) if entry_price > 0 else 0.0

            # 수수료 (업비트: 0.1% maker/taker)
            transaction_amount = volume * actual_entry
            fees = transaction_amount * 0.001  # 0.1%
            fees_pct = 0.1

            # 손익 계산 (Buy: 체결가 - 진입가, Sell: 진입가 - 체결가)
            if side == "BUY":
                gross_pnl = (exit_price - actual_entry) * volume
            else:  # SELL
                gross_pnl = (actual_entry - exit_price) * volume

            # 수수료와 슬리피지를 반영한 실질 손익
            profit_loss = gross_pnl - fees - slippage * volume
            profit_loss_pct = (profit_loss / transaction_amount * 100) if transaction_amount > 0 else 0.0

            # 거래 상태
            if order_state == "done":
                status = "success"
            elif order_state in ("cancel", "cancelled"):
                status = "failed"
            else:
                status = "partial"

            result = {
                "order_id": order_id,
                "market": market,
                "side": side,
                "entry_price": entry_price,
                "actual_entry": actual_entry,
                "exit_price": exit_price,
                "quantity": volume,
                "slippage": slippage,
                "slippage_pct": round(slippage_pct, 4),
                "fees": round(fees, 2),
                "fees_pct": fees_pct,
                "profit_loss": round(profit_loss, 2),
                "profit_loss_pct": round(profit_loss_pct, 4),
                "holding_time": holding_time,
                "status": status,
                "timestamp": datetime.now().isoformat()
            }

            logger.info(
                f"📊 거래 성과 평가: {market} {side} | "
                f"손익: ₩{result['profit_loss']:,.0f} ({result['profit_loss_pct']:.2f}%) | "
                f"보유시간: {holding_time}초"
            )

            return result

        except Exception as e:
            logger.error(f"❌ 거래 성과 평가 오류: {e}")
            import traceback
            traceback.print_exc()

            return {
                "order_id": order.get("uuid", "unknown"),
                "market": order.get("market", ""),
                "side": order.get("side", "BUY").upper(),
                "status": "failed",
                "error": str(e)
            }

    async def _send_daily_statistics(self) -> None:
        """일일 거래 통계 계산 및 대시보드 전송"""
        try:
            # 오늘 거래 통계 계산
            statistics = self.trade_record_manager.calculate_daily_statistics()

            if not statistics or statistics.get("total_trades", 0) == 0:
                logger.info("ℹ️  오늘 거래 기록 없음")
                return

            # 대시보드로 통계 전송
            dashboard_data = {
                "timestamp": datetime.now().isoformat(),
                "date": statistics.get("date"),
                "total_trades": statistics.get("total_trades", 0),
                "winning_trades": statistics.get("winning_trades", 0),
                "losing_trades": statistics.get("losing_trades", 0),
                "win_rate": statistics.get("win_rate", 0.0),
                "total_profit_loss": statistics.get("total_profit_loss", 0.0),
                "total_profit_loss_pct": statistics.get("total_profit_loss_pct", 0.0),
                "average_pnl": statistics.get("average_pnl", 0.0),
                "average_pnl_pct": statistics.get("average_pnl_pct", 0.0),
                "max_gain": statistics.get("max_gain", 0.0),
                "max_loss": statistics.get("max_loss", 0.0),
                "max_gain_pct": statistics.get("max_gain_pct", 0.0),
                "max_loss_pct": statistics.get("max_loss_pct", 0.0),
                "average_holding_time": statistics.get("average_holding_time", 0),
                "total_fees": statistics.get("total_fees", 0.0),
                "total_slippage": statistics.get("total_slippage", 0.0),
                "by_market": statistics.get("by_market", {})
            }

            # 일일 통계 로그 출력
            logger.info("=" * 70)
            logger.info(f"📊 일일 거래 통계 ({statistics.get('date')})")
            logger.info(f"   총 거래수: {statistics.get('total_trades', 0)}회")
            logger.info(f"   승리/패배: {statistics.get('winning_trades', 0)}회 / "
                       f"{statistics.get('losing_trades', 0)}회")
            logger.info(f"   승률: {statistics.get('win_rate', 0.0):.1f}%")
            logger.info(f"   총 손익: ₩{statistics.get('total_profit_loss', 0):,.0f} "
                       f"({statistics.get('total_profit_loss_pct', 0.0):+.2f}%)")
            logger.info(f"   평균 수익: ₩{statistics.get('average_pnl', 0):,.0f} "
                       f"({statistics.get('average_pnl_pct', 0.0):+.2f}%)")
            logger.info(f"   최대 수익/손실: ₩{statistics.get('max_gain', 0):,.0f} / "
                       f"₩{statistics.get('max_loss', 0):,.0f}")
            logger.info(f"   총 수수료: ₩{statistics.get('total_fees', 0):,.0f}")
            logger.info(f"   총 슬리피지: ₩{statistics.get('total_slippage', 0):,.0f}")
            logger.info(f"   평균 보유시간: {statistics.get('average_holding_time', 0)}초")

            # 종목별 통계
            if statistics.get("by_market"):
                logger.info("   종목별 성과:")
                for market, market_stats in statistics.get("by_market", {}).items():
                    logger.info(
                        f"     - {market}: {market_stats.get('trades', 0)}회 | "
                        f"승률 {market_stats.get('win_rate', 0.0):.1f}% | "
                        f"손익 ₩{market_stats.get('pnl', 0):,.0f}"
                    )

            logger.info("=" * 70)

            # API로 전송 시도 (선택사항)
            try:
                response = self.dashboard.client.post(
                    f"{self.dashboard.dashboard_url}/api/crypto/statistics",
                    json=dashboard_data,
                    headers={"Content-Type": "application/json"}
                )
                if response.status_code in (200, 201):
                    logger.info("✅ 일일 통계 대시보드 전송 완료")
                else:
                    logger.warning(f"⚠️  일일 통계 전송 실패 ({response.status_code})")
            except Exception as e:
                logger.warning(f"⚠️  일일 통계 API 전송 오류: {e}")

        except Exception as e:
            logger.error(f"❌ 일일 통계 계산 오류: {e}")
            import traceback
            traceback.print_exc()

    def get_daily_statistics_summary(self) -> Dict:
        """일일 통계 요약 (메모리 기반)"""
        try:
            statistics = self.trade_record_manager.calculate_daily_statistics()
            return statistics
        except Exception as e:
            logger.error(f"❌ 통계 요약 오류: {e}")
            return {}

    def _save_current_signals(self, signals: List[Dict]) -> None:
        """현재 분석 중인 신호를 파일로 저장 (대시보드/에이전트용)"""
        try:
            import json
            signals_data = {
                "timestamp": datetime.now().isoformat(),
                "total_signals": len(signals),
                "buy_signals": [s for s in signals if s.get("recommendation") == "BUY"],
                "sell_signals": [s for s in signals if s.get("recommendation") == "SELL"],
                "all_signals": signals
            }
            with open("/tmp/current_signals.json", "w") as f:
                json.dump(signals_data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.debug(f"⚠️  신호 저장 오류: {e}")


async def main():
    """메인 진입점"""
    strategy = UpbitTradingStrategy()
    await strategy.run(once=False)  # once=True이면 한 번만 실행


if __name__ == "__main__":
    asyncio.run(main())
