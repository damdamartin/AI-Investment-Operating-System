import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from pydantic import ConfigDict


load_dotenv()


class Settings(BaseSettings):
    model_config = ConfigDict(extra='ignore')

    # Claude API
    claude_api_key: str = os.getenv("CLAUDE_API_KEY", "")

    # Toss Securities API
    toss_client_id: str = os.getenv("TOSS_CLIENT_ID", "")
    toss_client_secret: str = os.getenv("TOSS_CLIENT_SECRET", "")
    toss_api_base_url: str = os.getenv("TOSS_API_BASE_URL", "https://openapi.tossinvest.com")
    toss_account_ref: str = os.getenv("TOSS_ACCOUNT_REF", "1")
    toss_read_only_mode: str = os.getenv("TOSS_READ_ONLY_MODE", "true")

    # Trading Config
    watchlist: str = os.getenv(
        "PIPELINE_WATCHLIST",
        "005930:Samsung Electronics:KR:STOCK,000660:SK Hynix:KR:STOCK"
    )
    buy_threshold: float = float(os.getenv("PIPELINE_BUY_THRESHOLD", "65"))
    sell_threshold: float = float(os.getenv("PIPELINE_SELL_THRESHOLD", "35"))

    # Position Management
    stop_loss_pct: float = float(os.getenv("STOP_LOSS_PCT", "-5"))
    take_profit_pct: float = float(os.getenv("TAKE_PROFIT_PCT", "10"))

    # Risk Management
    max_order_amount: float = float(os.getenv("PIPELINE_RISK_MAX_ORDER_AMOUNT", "1000000"))
    min_cash_after_order: float = float(os.getenv("PIPELINE_MONEY_MIN_CASH_AFTER_ORDER", "500000"))
    max_strategy_allocation: float = float(os.getenv("PIPELINE_MONEY_MAX_STRATEGY_ALLOCATION", "3000000"))

    # Portfolio
    total_equity: float = float(os.getenv("PIPELINE_PORTFOLIO_TOTAL_EQUITY", "10000000"))
    available_cash: float = float(os.getenv("PIPELINE_PORTFOLIO_AVAILABLE_CASH", "10000000"))
    currency: str = os.getenv("PIPELINE_PORTFOLIO_CURRENCY", "KRW")

    # Logging
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    app_env: str = os.getenv("APP_ENV", "development")
    live_trading_enabled: str = os.getenv("LIVE_TRADING_ENABLED", "false")


settings = Settings()
