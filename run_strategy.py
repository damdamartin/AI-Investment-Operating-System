#!/usr/bin/env python3
"""
PyQQQ 자동매매 시스템 실행
Usage:
  python run_strategy.py          # 실시간 모니터링 (무한 루프)
  python run_strategy.py --once   # 한 번만 실행
"""
import asyncio
import sys
sys.path.insert(0, '/Users/mac/Documents/Codex/AI-Investment-Operating-System')

from src.pyqqq.strategy import main


if __name__ == "__main__":
    asyncio.run(main())
