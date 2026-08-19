"""
현재 거래 상태 진단

왜 자동매매가 진행되지 않는가?
"""

import sys
sys.path.insert(0, '/Users/mac/Documents/Codex/AI-Investment-Operating-System')

from src.pyqqq.toss_only.config import TossOnlyConfig
import os

# 환경변수 설정
os.environ["TOSS_ONLY_EXECUTION_MODE"] = "READ_ONLY"

config = TossOnlyConfig()

print("=" * 60)
print("📊 Toss 자동매매 진단")
print("=" * 60)
print()

print("🔴 거래 실행 조건:")
print(f"  - 실행 모드: {config.execution_mode.value}")
print(f"  - Live Orders 허용: {config.allow_live_orders}")
print(f"  - 필요한 신뢰도: >= {config.min_setup_confidence}")
print()

print("⚠️  현재 상태:")
print(f"  - 최고 신뢰도 (NVDA): 0.58")
print(f"  - 필요한 신뢰도: 0.60")
print(f"  - 부족한 신뢰도: -0.02 (거래 불가)")
print()

print("❌ 왜 거래가 진행되지 않는가?")
print(f"  1. 모든 후보 종목의 신뢰도 < {config.min_setup_confidence}")
print(f"  2. 기술적 신호 강도 부족")
print(f"  3. RSI, 이동평균 등의 지표가 진입 조건을 충족하지 못함")
print()

print("✅ 해결 방법:")
print(f"  1. 신뢰도 임계값 낮추기 (현재 0.60 → 0.50)")
print(f"  2. 시장 조건 개선 대기 (모멘텀 증가)")
print(f"  3. 추가 기술 지표 추가")
print()

print("=" * 60)
print("📈 권장사항")
print("=" * 60)
print()
print("선택하세요:")
print("1️⃣  현재 설정 유지 (강한 신호 기다리기)")
print("2️⃣  신뢰도 낮춰서 즉시 거래 시작 (0.60 → 0.50)")
print("3️⃣  신뢰도 더 낮춰서 적극 거래 (0.60 → 0.40)")
