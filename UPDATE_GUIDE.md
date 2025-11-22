# 🔄 버전 업데이트 가이드

## 📋 빠른 업데이트 절차

### 1. 새 버전 만들기

```bash
# 현재 버전 확인
현재: v22 (TradingView-Claude22-MultiTF-StochRSI.pine)

# 다음 버전
새로운: v23 (예정)
```

### 2. 파일 생성 체크리스트

**새 기능 추가 시:**
- [ ] Pine Script 파일 작성
- [ ] 파일명에 버전 번호 포함
- [ ] 코드 상단에 버전 정보 추가
- [ ] VERSION_HISTORY.md 업데이트
- [ ] Webhook JSON에 버전 필드 추가

---

## 📝 Pine Script 버전 표기 템플릿

```pine
//@version=5
indicator("클로드[버전번호] [기능설명]", overlay=true, max_labels_count=100)

// ======================== 버전 정보 ========================
// 버전: v[번호]
// 업데이트: YYYY-MM-DD
// 변경사항: [주요 변경 내용]
// 이전 버전: v[이전번호]
// ========================================================
```

**예시:**
```pine
//@version=5
indicator("클로드23 멀티TF + StochRSI + VolumeDelta", overlay=true)

// ======================== 버전 정보 ========================
// 버전: v23
// 업데이트: 2024-11-22
// 변경사항: Volume Delta 매수/매도 압력 분석 추가
// 이전 버전: v22
// ========================================================
```

---

## 🏷️ 파일 명명 규칙

```
형식: TradingView-Claude[버전번호]-[주요기능].pine

예시:
v21: TradingView-Claude21-MultiTF.pine
v22: TradingView-Claude22-MultiTF-StochRSI.pine
v23: TradingView-Claude23-MultiTF-StochRSI-VolumeDelta.pine
v24: TradingView-Claude24-Full.pine
```

---

## 📂 파일 구조 관리

```
trading-automation/
├── versions/                           # 모든 버전 보관
│   ├── TradingView-Claude21-MultiTF.pine
│   ├── TradingView-Claude22-MultiTF-StochRSI.pine
│   └── TradingView-Claude23-...pine (새 버전)
│
├── TradingView-Latest.pine             # 최신 버전 (심볼릭 링크)
│
├── VERSION_HISTORY.md                  # 버전 히스토리
└── UPDATE_GUIDE.md                     # 이 파일
```

---

## ✅ 업데이트 체크리스트

### Phase 1: 코드 작성
- [ ] 새 기능 구현
- [ ] 기존 기능과 통합
- [ ] 버전 정보 주석 추가
- [ ] indicator 이름에 버전 표기

### Phase 2: JSON Webhook 수정
- [ ] `version` 필드 업데이트
- [ ] 새 데이터 필드 추가 (필요시)
- [ ] Apps Script 호환성 확인

### Phase 3: 문서화
- [ ] VERSION_HISTORY.md 업데이트
  - 버전 번호
  - 날짜
  - 변경사항
  - 파일명
- [ ] 테이블에 성과 예상치 추가

### Phase 4: 파일 관리
- [ ] versions/ 폴더에 저장
- [ ] 파일명 규칙 준수
- [ ] Git 커밋 (선택)

### Phase 5: 테스트
- [ ] TradingView에서 로드 테스트
- [ ] 신호 발생 확인
- [ ] Webhook JSON 확인
- [ ] Apps Script 연동 테스트

---

## 🎯 버전 번호 증가 기준

### 메이저 업데이트 (+10)
```
v20 → v30
- 전체 구조 변경
- 완전히 새로운 전략 추가
- 대규모 리팩토링
```

### 마이너 업데이트 (+1)
```
v22 → v23
- 새로운 지표 추가 ✅
- 기존 로직 개선
- 신호 조건 추가
```

### 패치 업데이트 (+0.1) - 사용 안 함
```
Pine Script는 소수점 버전 사용 안 함
대신 v22a, v22b 같은 서브버전 사용 가능
```

---

## 📊 Webhook JSON 버전 관리

### 기본 구조 (모든 버전 공통)
```json
{
  "version": "22",           // 🆕 버전 정보
  "signal": "LONG",
  "entry": "95000000",
  "tp1": "...",
  "tp2": "...",
  "sl": "..."
}
```

### v22 추가 필드
```json
{
  "version": "22",
  ...기본 구조...
  "stochRSI_k": "25.3",      // 🆕 v22
  "stochRSI_signal": "GOLDEN_CROSS"
}
```

### v23 예상 추가 필드
```json
{
  "version": "23",
  ...v22 구조...
  "volumeDelta": "1250000",   // 🆕 v23
  "buyPressure": "65"
}
```

---

## 🔄 롤백 절차

### 이전 버전으로 되돌리기

**1단계: 버전 확인**
```
VERSION_HISTORY.md에서 원하는 버전 찾기
```

**2단계: 파일 찾기**
```
versions/TradingView-Claude[번호]-....pine
```

**3단계: TradingView 적용**
```
1. 파일 열기
2. 전체 복사
3. Pine Editor에 붙여넣기
4. Save → Add to Chart
```

**4단계: Webhook 설정 확인**
```
이전 버전도 동일한 Apps Script와 호환됨
별도 설정 변경 불필요
```

---

## 🎨 버전별 시각적 구분

### 차트 색상 변경 (선택)

**v21: 파란색 테마**
```pine
bgcolor=color.new(color.blue, 90)
```

**v22: 보라색 테마**
```pine
bgcolor=color.new(color.purple, 90)
```

**v23: 주황색 테마**
```pine
bgcolor=color.new(color.orange, 90)
```

---

## 📝 VERSION_HISTORY.md 업데이트 템플릿

```markdown
## 📌 현재 버전: 클로드[번호]

### 🆕 v[번호] - [기능 이름] (YYYY-MM-DD)

**파일명:** `TradingView-Claude[번호]-[기능].pine`

**추가 기능:**
- ✅ [기능 1]
- ✅ [기능 2]
- ✅ [기능 3]

**JSON Webhook 데이터:**
```json
{
  "version": "[번호]",
  "새필드": "값"
}
```

**변경사항:**
- [변경 1]
- [변경 2]

**성과 예상:**
- 승률: XX%
- 신호 빈도: [많음/보통/적음]

---
```

---

## 🚀 빠른 명령어

### 새 버전 생성
```bash
# 1. 이전 버전 백업
cp TradingView-Latest.pine versions/TradingView-Claude22-....pine

# 2. 새 버전 작성
# (Pine Editor에서 작성)

# 3. 파일 저장
# TradingView-Claude23-....pine
```

### 버전 확인
```bash
cd trading-automation
ls -la versions/
cat VERSION_HISTORY.md
```

---

## 💡 팁

### 1. 항상 이전 버전 백업
```
새 버전 작성 전 versions/에 백업 필수!
```

### 2. 점진적 업데이트
```
한 번에 여러 기능 추가하지 말고
하나씩 테스트하며 버전 증가
```

### 3. 문서화 우선
```
코드 먼저 쓰지 말고
VERSION_HISTORY.md 먼저 작성
→ 무엇을 만들지 명확해짐
```

### 4. 호환성 유지
```
Webhook JSON 구조 큰 변경 피하기
새 필드 추가는 OK
기존 필드 삭제는 NO
```

---

## 📞 도움말

업데이트 중 문제 발생 시:
1. VERSION_HISTORY.md 확인
2. 이전 버전으로 롤백
3. 변경사항 점진적으로 적용

---

**마지막 업데이트:** 2024-11-21
**현재 버전:** v22
**다음 예정 버전:** v23 (Volume Delta)
