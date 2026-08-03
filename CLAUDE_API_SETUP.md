# Claude API 설정 가이드

**작성일**: 2026-08-03  
**수정 사항**: 모든 모델명 설정 통합

---

## 🎯 주요 변경사항

### 이전 (문제)
```python
# 각 파일마다 하드코딩
research_agent.py:       model="claude-3-5-sonnet-20241022"
analysis_agent.py:       model="claude-3-5-sonnet-20241022"
strategy_agent.py:       model="claude-3-5-sonnet-20241022"
watchlist_manager.py:    model="claude-3-5-sonnet-20241022"
api_cost_manager.py:     model="claude-3-5-sonnet-20241022"
claude_analyzer.py:      model="claude-opus-5"

❌ 문제: 모델 변경 시 모든 파일 수정 필요
❌ 문제: 404 오류 발생 (모델 없음)
```

### 이후 (해결)
```python
# config.py에 중앙 집중식 관리
CLAUDE_MODEL = "claude-opus-5"  # 환경 변수로 관리

# 모든 에이전트에서 사용
self.model = settings.claude_model

✅ 장점: 한 곳에서 모델 변경
✅ 장점: 환경 변수로 동적 설정
✅ 장점: 모든 팀이 동일한 모델 사용
```

---

## 🔧 설정 방법

### 방법 1: 환경 변수 설정 (권장)

**터미널에서 직접 설정:**
```bash
export CLAUDE_MODEL="claude-opus-5"
python main.py
```

**또는 .env 파일에 추가:**
```ini
# .env
CLAUDE_API_KEY=sk-ant-api03-...
CLAUDE_MODEL=claude-opus-5
```

### 방법 2: Python 코드에서 설정

```python
import os
os.environ["CLAUDE_MODEL"] = "claude-opus-5"

# 또는 직접 시스템 시작
orchestrator = ImprovedAIOrchestrator()
```

---

## 📊 사용 가능한 모델들

### Anthropic 최신 모델
```
✅ claude-opus-5        (최고 성능, 비용 높음)
✅ claude-sonnet-5      (균형잡힘, 일반적 추천)
✅ claude-haiku-4.5     (빠름, 비용 저렴)
```

### 추천 설정
```
한국주식 (KIS)    → claude-sonnet-5 (균형)
미국주식 (Toss)   → claude-sonnet-5 (균형)
암호화폐 (Upbit)  → claude-opus-5   (고성능)
```

---

## ✅ 검증

모델 설정이 제대로 적용되었는지 확인:

```bash
# 1. 설정 확인
python -c "from config import settings; print(f'Model: {settings.claude_model}')"

# 2. 시스템 테스트
python orchestrator_improved.py

# 3. 로그 확인
# "✅ API 호출 성공" 메시지 확인
# 404 오류가 발생하지 않아야 함
```

---

## 🚀 배포 전 확인사항

### 체크리스트
- [ ] CLAUDE_API_KEY 확인 및 설정
- [ ] CLAUDE_MODEL 설정 (기본: claude-opus-5)
- [ ] 모든 환경 변수 로드됨 (config.py)
- [ ] 시스템 시작 시 모델명 정상 로드 확인
- [ ] API 테스트 실행 (404 오류 없음)

### 배포 명령어
```bash
# 1. 환경 변수 확인
source .env

# 2. 설정 검증
python -c "from config import settings; print(f'✅ Model: {settings.claude_model}')"

# 3. 시스템 시작
python main.py
```

---

## 📝 변경된 파일

### Core 수정 파일
1. **config.py**
   ```python
   claude_model: str = os.getenv("CLAUDE_MODEL", "claude-opus-5")
   ```

2. **research_agent.py** → `self.model = settings.claude_model`
3. **analysis_agent.py** → `self.model = settings.claude_model`
4. **strategy_agent.py** → `self.model = settings.claude_model`
5. **watchlist_manager.py** → `self.model = settings.claude_model`
6. **api_cost_manager.py** → `model=settings.claude_model`
7. **claude_analyzer.py** → `self.model = settings.claude_model`

---

## 🔍 문제 해결

### 404 Not Found 오류
```
오류: "model not found"

해결 1: API 키 확인
$ echo $CLAUDE_API_KEY

해결 2: 모델명 확인
$ python -c "from config import settings; print(settings.claude_model)"

해결 3: 최신 모델 사용
$ export CLAUDE_MODEL="claude-opus-5"
```

### API 요청 실패
```
오류: "API request failed"

해결 1: 네트워크 연결 확인
해결 2: API 키 만료 확인 (재발급 필요)
해결 3: 요청 형식 확인 (messages, model, max_tokens)
```

---

## 💡 팁

### 1. 모델 동적 변경
```bash
# 실시간으로 모델 변경
export CLAUDE_MODEL="claude-sonnet-5"
python main.py

# 다시 기본값으로
export CLAUDE_MODEL="claude-opus-5"
python main.py
```

### 2. 성능 최적화
```
높은 비용, 최고 성능:
  → claude-opus-5

중간 비용, 좋은 성능:
  → claude-sonnet-5 ← 일반 권장

낮은 비용, 빠른 응답:
  → claude-haiku-4.5
```

### 3. 팀별 모델 설정
```python
# 추후 확장: 팀별로 다른 모델 사용
team_models = {
    "research": "claude-opus-5",        # 고성능
    "analysis": "claude-sonnet-5",      # 균형
    "strategy": "claude-sonnet-5",      # 균형
    "execution": "claude-haiku-4.5"     # 빠름
}
```

---

**최종 상태**: ✅ 모든 모델 설정 통합 완료  
**다음 단계**: 환경 변수 설정 후 시스템 시작

