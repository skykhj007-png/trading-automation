# 📚 버전 관리 시스템 가이드

## 🎯 현재 버전: v22

### 최신 파일
현재 사용 중인 파일은 **TradingView에서 직접 관리**됩니다.

---

## 📦 버전 관리 구조

```
trading-automation/
│
├── 📁 versions/                     # 모든 버전 보관
│   ├── TradingView-Claude21-MultiTF.pine
│   └── (향후 v22, v23... 추가 예정)
│
├── 📄 VERSION_HISTORY.md            # 버전 변경 이력
├── 📄 UPDATE_GUIDE.md               # 업데이트 방법 가이드
└── 📄 README_VERSION.md             # 이 파일
```

---

## 🔢 버전 번호 규칙

### 버전 증가 기준:
```
v21 → v22: Stochastic RSI 추가
v22 → v23: Volume Delta 추가 (예정)
v23 → v24: ADX 추가 (예정)
```

### 명명 규칙:
```
클로드[버전번호] [주요기능]

예:
- 클로드21 멀티TF
- 클로드22 멀티TF + StochRSI
- 클로드23 멀티TF + StochRSI + VolumeDelta
```

---

## 🚀 새 버전 사용 방법

### 1. TradingView에서 코드 복사
현재 사용 중인 Pine Script 코드를 **전체 선택 → 복사**

### 2. 로컬에 버전 백업 (선택)
```
versions/TradingView-Claude[번호]-[기능].pine
```
파일명으로 저장

### 3. TradingView에서 새 버전 적용
1. Pine Editor 열기
2. 새 코드 붙여넣기
3. Save
4. Add to Chart

---

## 📊 버전별 주요 특징

| 버전 | 파일명 패턴 | 주요 기능 | 상태 |
|------|------------|---------|------|
| v21 | Claude21-MultiTF.pine | 멀티TF, 불장단타왕 | ✅ 완료 |
| v22 | Claude22-MultiTF-StochRSI.pine | + Stochastic RSI | ✅ 현재 |
| v23 | Claude23-...-VolumeDelta.pine | + Volume Delta | 📅 예정 |
| v24 | Claude24-...-ADX.pine | + ADX | 📅 예정 |

---

## 🔄 버전 업그레이드 절차

### 준비물:
- [ ] 새 기능이 추가된 Pine Script 코드
- [ ] 변경사항 정리

### 단계:
1. **VERSION_HISTORY.md 업데이트**
   - 새 버전 번호
   - 날짜
   - 변경사항

2. **TradingView에 적용**
   - Pine Editor에서 코드 수정
   - 지표 이름 변경 (클로드[번호])
   - JSON에 `version` 필드 업데이트

3. **테스트**
   - 신호 발생 확인
   - Webhook JSON 확인
   - Apps Script 연동 확인

4. **백업 (선택)**
   - 로컬 versions/ 폴더에 저장

---

## 📝 Webhook JSON 버전 표기

모든 버전은 동일한 Webhook 구조를 유지하되,
`version` 필드로 구분합니다:

```json
{
  "version": "22",    // ← 버전 번호
  "signal": "LONG",
  "entry": "95000000",
  ...
}
```

Apps Script는 `version` 필드를 참고하지만
버전에 관계없이 모든 신호를 처리합니다.

---

## ⏪ 이전 버전으로 롤백

### 방법 1: TradingView에서 (권장)
1. Pine Editor 히스토리 기능 사용
2. 이전 버전 복원

### 방법 2: 로컬 백업 사용
1. `versions/` 폴더에서 파일 찾기
2. 내용 복사
3. Pine Editor에 붙여넣기

---

## 💡 버전 관리 팁

### ✅ DO (권장)
- 각 버전별로 명확한 변경사항 기록
- 새 기능 추가 시 버전 번호 증가
- TradingView에서 지표 이름에 버전 표기
- Webhook JSON에 version 필드 포함

### ❌ DON'T (비권장)
- 버전 번호 없이 파일명 짓기
- 큰 변경사항을 같은 버전 번호로 유지
- VERSION_HISTORY.md 업데이트 안 하기

---

## 🎓 버전 선택 가이드

### 어떤 버전을 사용해야 할까?

**v21 (기본 멀티TF)**
- TradingView 초보자
- 많은 거래 기회 원함
- 단순한 전략 선호

**v22 (+ StochRSI) ← 현재**
- 승률 중시
- 과매수/과매도 회피
- 중급 이상 트레이더

**v23+ (향후)**
- 최고 성과 목표
- 복잡한 지표 활용 가능
- 전문 트레이더

---

## 📞 문의 및 지원

버전 관리 관련 질문:
1. VERSION_HISTORY.md 확인
2. UPDATE_GUIDE.md 참고
3. 이 파일(README_VERSION.md) 재확인

---

**마지막 업데이트:** 2024-11-21
**관리 파일:**
- VERSION_HISTORY.md (버전 이력)
- UPDATE_GUIDE.md (업데이트 방법)
- README_VERSION.md (이 파일)
