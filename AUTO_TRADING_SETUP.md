# 🤖 v24 자동매매 + 구글 시트 거래일지 완벽 가이드

시작 잔고: $100
자동 TP1/TP2/손절 추적
실시간 수익률 계산

---

## 📋 목차

1. [구글 시트 준비](#1-구글-시트-준비)
2. [Apps Script 설정](#2-apps-script-설정)
3. [TradingView 알람 설정](#3-tradingview-알람-설정)
4. [자동매매 테스트](#4-자동매매-테스트)
5. [거래일지 확인](#5-거래일지-확인)
6. [문제 해결](#6-문제-해결)

---

## 1. 구글 시트 준비

### 1-1. 새 시트 만들기

```
1. Google Sheets 접속: https://sheets.google.com

2. "+ 새로 만들기" 클릭

3. 시트 이름: "v24 자동매매 일지"

4. URL에서 SPREADSHEET_ID 복사:
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit

   예: 1AbC2DeF3GhI4JkL5MnO6PqR7StU8VwX9YzA
```

### 1-2. 시트 ID 저장

```
SPREADSHEET_ID를 메모장에 복사해두기!
나중에 Apps Script에 붙여넣을 것임
```

---

## 2. Apps Script 설정

### 2-1. Apps Script 열기

```
1. https://script.google.com 접속

2. 기존 "Trading Automation" 프로젝트 열기
   (없으면 새로 만들기)

3. 왼쪽 "파일" 목록 확인:
   - Code.gs (기존)
   - WebhookHandler.gs (기존)
   - TradingLogger.gs (🆕 새로 추가!)
```

### 2-2. TradingLogger.gs 추가

```
1. Apps Script 에디터에서 "+" 버튼 클릭

2. "Script" 선택

3. 이름: TradingLogger

4. 파일 내용:
   C:\Users\kim\trading-automation\TradingLogger.gs 전체 복사

5. 붙여넣기 후 Ctrl+S 저장
```

### 2-3. 시트 ID 설정

`TradingLogger.gs` 파일에서 **3번째 줄** 수정:

```javascript
const SHEET_CONFIG = {
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID',  // ← 여기에 시트 ID 붙여넣기!
  SHEET_NAME: '자동화일지',
  STARTING_BALANCE: 100,  // 시작 잔고 $100
  CURRENCY: 'USD'
};
```

**예시:**
```javascript
const SHEET_CONFIG = {
  SPREADSHEET_ID: '1AbC2DeF3GhI4JkL5MnO6PqR7StU8VwX9YzA',  // ✅ 내 시트 ID
  SHEET_NAME: '자동화일지',
  STARTING_BALANCE: 100,
  CURRENCY: 'USD'
};
```

### 2-4. WebhookHandler.gs 업데이트

기존 `WebhookHandler.gs` 파일을 업데이트된 버전으로 교체:

```
C:\Users\kim\trading-automation\WebhookHandler.gs
내용 전체를 복사해서 Apps Script의 WebhookHandler 파일에 붙여넣기
```

### 2-5. 시트 초기화 실행

```
1. Apps Script 에디터에서 함수 선택:
   [setupTradingLogSheet] 선택

2. "실행" 버튼 클릭 (▶)

3. 권한 승인:
   - "권한 검토" 클릭
   - Google 계정 선택
   - "고급" → "안전하지 않은 페이지로 이동"
   - "허용" 클릭

4. 로그 확인 (Ctrl+Enter):
   ✅ 거래일지 시트 설정 완료
```

### 2-6. 구글 시트 확인

```
1. 구글 시트로 돌아가기

2. 하단에 "자동화일지" 시트 탭 생성 확인

3. 헤더 확인:
   날짜 | 시간 | 마켓 | 신호 | 진입가 | 청산가 | 청산유형 | ...

4. 2번째 행:
   시작 | ... | 초기잔고 | ... | $100

✅ 성공!
```

---

## 3. TradingView 알람 설정

### 3-1. 웹 앱 배포 (처음만)

이미 배포했다면 건너뛰기!

```
1. Apps Script에서 "배포" → "새 배포"

2. 설정:
   - 배포 유형: 웹 앱
   - 실행 계정: 나
   - 액세스 권한: 모든 사용자

3. 배포 → 웹 앱 URL 복사
   https://script.google.com/macros/s/ABCD1234.../exec
```

### 3-2. TradingView 알람 생성

```
1. TradingView 차트에서 v24 인디케이터 적용

2. 오른쪽 상단 알람 아이콘 (⏰) 클릭
   또는 Alt + A

3. "+ 알람 만들기" 클릭

4. 조건 설정:
   ┌─────────────────────────────────┐
   │ Condition:                      │
   │  [클로드24 멀티TF...]           │
   │  [alert() function calls only]│ ← 필수!
   │                                 │
   │ Options:                        │
   │  Frequency: [Once Per Bar Close]│ ← 필수!
   │  Expiration: [Open-ended]       │
   │                                 │
   │ Alert actions:                  │
   │  ☑ Notify on App               │
   │  ☑ Show popup                  │
   │  ☑ Webhook URL                 │
   │                                 │
   │ Webhook URL:                    │
   │  [여기에 웹 앱 URL 붙여넣기]     │
   │                                 │
   │ Alert name:                     │
   │  v24 자동매매                   │
   │                                 │
   │ Message:                        │
   │  [비워두기]                     │
   └─────────────────────────────────┘

5. "만들기" 클릭
```

---

## 4. 자동매매 테스트

### 4-1. 소액 테스트 (권장)

실제 돈을 사용하기 전에 소액으로 테스트!

```javascript
// Code.gs 또는 Config 파일에서:
ORDER_AMOUNT: 5000  // 5,000원으로 테스트
```

### 4-2. 테스트 실행

**방법 1: 실제 신호 대기**
```
1. TradingView 1분 또는 3분 차트 켜놓기

2. v24 신호 발생 대기

3. 신호 발생 시:
   - 📱 폰으로 알림
   - 🤖 자동 매수 실행
   - 📊 구글 시트에 기록

4. TP1/TP2/SL 자동 추적 시작
```

**방법 2: Apps Script 수동 테스트**
```
1. Apps Script 에디터에서 함수 선택:
   [testTradeLogging]

2. 실행 (▶)

3. 로그 확인:
   ✅ 진입 기록 완료: Row X
   ✅ 청산 기록 완료: TP1 | 손익: $X

4. 구글 시트 확인:
   - 진입 기록 (노란색 배경)
   - TP1 청산 (연한 녹색)
   - TP2 청산 (진한 녹색)
```

---

## 5. 거래일지 확인

### 5-1. 자동화일지 시트

```
┌──────────────────────────────────────────────────────────────┐
│ 날짜       시간     마켓     신호  진입가   청산가  청산유형    │
├──────────────────────────────────────────────────────────────┤
│ 2024-11-21 15:30:00 KRW-BTC LONG 95000   95760  ✅ 1차 익절 │
│ 수량: 0.001 | 진입$: 95 | 청산$: 95.76 | 손익: +$0.76     │
│ 수익률: +0.8% | 누적잔고: $100.76                           │
│ 신호강도: 9 | 거래량비율: 2.5x | 스마트머니: WHALE         │
├──────────────────────────────────────────────────────────────┤
│ (같은 거래) 15:35:00         95000   96425  ✅✅ 2차 익절  │
│ 수량: 0.0005 | 청산$: 48.21 | 손익: +$0.71                │
│ 수익률: +1.5% | 누적잔고: $101.47                           │
└──────────────────────────────────────────────────────────────┘
```

### 5-2. 청산 유형

| 표시 | 의미 | 색상 |
|------|------|------|
| ✅ 1차 익절 | TP1 달성 (50%) | 연한 녹색 |
| ✅✅ 2차 익절 | TP2 달성 (50%) | 진한 녹색 |
| 🔴 손절 | TP1 도달 전 손절 | 빨강 |
| ⚠️ 중간 손절 | TP1 후 SL 도달 | 연한 빨강 |

### 5-3. 통계 시트

자동 생성되는 "통계" 시트:

```
📊 거래 통계

시작 잔고     $100
현재 잔고     $115.30
총 수익/손실  $15.30
수익률        +15.30%

총 거래 횟수   10
승리          8
패배          2
승률          80.00%
```

---

## 6. 문제 해결

### ❌ 시트에 기록이 안 돼요

**체크리스트:**
```
1. SPREADSHEET_ID가 올바른가?
   - TradingLogger.gs 3번째 줄 확인

2. setupTradingLogSheet() 실행했나?
   - Apps Script에서 실행 필요

3. 시트 이름이 "자동화일지"인가?
   - 정확히 일치해야 함

4. 권한 승인했나?
   - Google Sheets API 접근 허용 필요
```

**해결:**
```javascript
// Apps Script에서 실행:
setupTradingLogSheet()

// 로그 확인:
// ✅ 거래일지 시트 설정 완료
```

---

### ❌ 자동매매가 실행 안 돼요

**체크리스트:**
```
1. TradingView 알람 설정했나?
   - Webhook URL 입력했는지 확인

2. Webhook URL이 올바른가?
   - 끝에 /exec 있는지 확인

3. 알람 조건이 "alert() function calls only"인가?
   - 다른 조건은 작동 안 함

4. Frequency가 "Once Per Bar Close"인가?
   - "All"이면 알람 폭탄!

5. Upbit API 키가 설정되어 있나?
   - Code.gs에서 CONFIG 확인
```

**테스트:**
```
1. 브라우저에서 Webhook URL 열기
   → {"status":"ok",...} 나오면 정상

2. Apps Script에서 testWebhook() 실행
   → 로그 확인

3. Apps Script "실행" 탭에서 최근 실행 확인
   → 오류 메시지 확인
```

---

### ❌ TP/SL 자동 청산이 안 돼요

**체크리스트:**
```
1. setupTriggers() 실행했나?
   - Apps Script에서 실행 필요

2. 트리거 확인:
   - Apps Script → 트리거 (⏰)
   - monitorWebhookPosition 1분마다 실행 확인

3. 포지션이 저장되어 있나?
   - checkSavedPosition() 실행
   - PropertiesService에 POSITION 있는지 확인
```

**강제 모니터링:**
```javascript
// Apps Script에서 수동 실행:
monitorWebhookPosition()

// 포지션 확인:
checkSavedPosition()
```

---

### ❌ 잔고 계산이 이상해요

**원인:**
```
- 시작 잔고가 $100이 아닌 경우
- 중간에 시트를 수정한 경우
- 수동으로 거래를 추가한 경우
```

**해결:**
```
1. 통계 새로고침:
   getTradingStats() 실행
   addStatsToSheet() 실행

2. 시트 초기화 (처음부터):
   - "자동화일지" 시트 삭제
   - setupTradingLogSheet() 재실행
```

---

## 💡 실전 팁

### 1. 알림 설정

```
중요 알림:
☑ 매수 체결
☑ TP1 달성
☑ TP2 달성
☑ 손절 실행

→ 텔레그램/이메일 연동 추가 가능
```

### 2. 수익 목표

```
$100 → $200 (100% 수익)
예상 기간:
- 승률 80%, 수익률 1.5% 평균
- 약 50거래 필요
- 1일 5거래 = 10일

$100 → $500 (400% 수익)
예상 기간:
- 약 150거래 필요
- 1일 5거래 = 30일
```

### 3. 리스크 관리

```
초기 설정 (보수적):
- ORDER_AMOUNT: 5,000원
- 레버리지: 5배
- 손절: 0.3%
→ 최대 손실: 약 75원

공격적 설정:
- ORDER_AMOUNT: 50,000원
- 레버리지: 10배
- 손절: 0.3%
→ 최대 손실: 약 1,500원
```

### 4. 백업

```
정기적 백업:
1. 구글 시트 복사본 만들기
2. Apps Script 코드 다운로드 (clasp pull)
3. 거래 기록 CSV 내보내기
```

---

## 🚀 다음 단계

### 완료 체크리스트:
- [ ] 구글 시트 생성 및 ID 복사
- [ ] TradingLogger.gs 추가 및 시트 ID 설정
- [ ] setupTradingLogSheet() 실행
- [ ] setupTriggers() 실행
- [ ] TradingView 알람 생성 (Webhook 포함)
- [ ] 소액 테스트 거래
- [ ] 실전 자동매매 시작!

### 실전 운영:
```
매일 확인:
1. 구글 시트 "자동화일지" 확인
2. 누적 잔고 확인
3. 승률 확인

매주 확인:
1. "통계" 시트 확인
2. 목표 달성 여부 확인
3. 전략 조정 필요 여부 판단
```

---

## 📞 지원

문제 발생 시:
1. Apps Script 실행 로그 확인
2. 구글 시트 마지막 기록 확인
3. TradingView 알람 내역 확인
4. Upbit 거래 내역과 비교

---

**중요:** 실제 자금 투입 전 반드시 소액으로 테스트하세요!

**목표:** $100 → $1,000 (10배) 달성! 🚀
