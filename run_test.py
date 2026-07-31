#!/usr/bin/env python3
"""
PyQQQ 시스템 테스트
"""
import asyncio
import sys
sys.path.insert(0, '/Users/mac/Documents/Codex/AI-Investment-Operating-System')

from src.pyqqq.test_strategy import main


if __name__ == "__main__":
    asyncio.run(main())
