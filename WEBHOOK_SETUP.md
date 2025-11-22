# 🔗 TradingView Webhook → Apps Script 자동매매 설정 가이드

## 📋 전체 흐름

```
TradingView (Pine Script)
    ↓ 신호 발생
Webhook 전송 (JSON)
    ↓
Google Apps Script (doPost)
    ↓ 신호 검증
Upbit API 매수/매도
    ↓
포지션 모니터링 (1분마다)
    ↓
TP1/TP2/SL 자동 실행
```

---

## 🚀 1단계: Apps Script 웹 앱 배포

### 1-1. Apps Script 에디터 열기

1. https://script.google.com 접속
2. 기존 "Trading Automation" 프로젝트 열기
3. 또는 새 프로젝트 생성

### 1-2. 파일 추가

**현재 필요한 파일:**
```
Trading Automation 프로젝트
├── Code.gs              # 기존 파일 (통합 전략)
└── WebhookHandler.gs    # 🆕 새로 추가!
```

**WebhookHandler.gs 추가 방법:**
1. Apps Script 에디터에서 `+` 버튼 클릭
2. "Script" 선택
3. 이름: `WebhookHandler`
4. `C:\Users\kim\trading-automation\WebhookHandler.gs` 파일 내용 복사
5. 붙여넣기 후 저장 (Ctrl + S)

### 1-3. API 키 설정

`Code.gs` 파일에서 CONFIG 수정:

```javascript
const CONFIG = {
  EXCHANGE: {
    NAME: 'upbit',
    API_KEY: 'YOUR_UPBIT_API_KEY',        // ⬅️ 여기 입력
    SECRET_KEY: 'YOUR_UPBIT_SECRET_KEY',  // ⬅️ 여기 입력
    BASE_URL: 'https://api.upbit.com/v1'
  },
  // ... 나머지 설정
};
```

### 1-4. 웹 앱 배포

1. **배포 → 새 배포** 클릭

2. **설정:**
   ```
   배포 유형: 웹 앱
   설명: TradingView Webhook Handler
   실행 계정: 나 (본인 계정)
   액세스 권한: 모든 사용자
   ```

3. **배포** 클릭

4. **권한 승인**
   - "권한 검토" 클릭
   - Google 계정 선택
   - "고급" → "안전하지 않은 페이지로 이동" 클릭
   - "허용" 클릭

5. **웹 앱 URL 복사**
   ```
   https://script.google.com/macros/s/ABCD1234.../exec
   ```
   ⚠️ 이 URL을 잘 저장하세요! (TradingView에서 사용)

---

## 🎯 2단계: TradingView 알람 설정

### 2-1. Pine Script 알람 메시지 확인

**현재 Pine Script에서 보내는 JSON:**
```json
{
  "signal": "LONG",
  "entry": "95000000",
  "totalScore": "15.5",
  "bulJangScore": "8",
  "claude21Score": "5",
  "filterScore": "4",
  "tp1": "95760000",
  "tp2": "96425000",
  "sl": "94715000"
}
```

✅ 이미 올바른 형식입니다!

### 2-2. TradingView 알람 생성

1. **차트에서 알람 아이콘** 클릭 (시계 모양)
   - 단축키: `Alt + A`

2. **조건 설정:**
   ```
   Condition: 통합 전략 (불장단타왕 + 클로드21)

   Option: "alert() function calls only"
   ```

3. **Webhook URL 설정:**
   ```
   Webhook URL: https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ```
   (1단계에서 복사한 URL 붙여넣기)

4. **Message 설정:**

   **중요!** TradingView는 이미 JSON을 보내므로 메시지 필드는 비워둬도 됩니다.

   Pine Script의 `alert()` 함수에서 이미 JSON을 전송하고 있습니다:
   ```javascript
   alert(jsonData, freq=alert.freq_once_per_bar)
   ```

5. **알람 옵션:**
   ```
   ✅ Once Per Bar Close (매우 중요!)
   ✅ Webhook URL

   선택사항:
   □ Notify on App (앱 알림도 받고 싶으면 체크)
   □ Show popup
   □ Send email
   ```

6. **Create** 클릭

---

## ⚙️ 3단계: Apps Script 트리거 설정

### 3-1. 트리거 실행

Apps Script 에디터에서:

1. 함수 선택: `setupTriggers`
2. **실행** 버튼 클릭
3. 권한 승인 (처음 한 번만)

**설정되는 트리거:**
- `monitorWebhookPosition`: 1분마다 실행
  - TP1/TP2/SL 자동 체크
  - 포지션 모니터링

### 3-2. 트리거 확인

1. 왼쪽 메뉴에서 **트리거** (시계 아이콘) 클릭
2. 다음이 보여야 함:
   ```
   monitorWebhookPosition | 시간 기반 | 1분마다
   ```

---

## 🧪 4단계: 테스트

### 4-1. Webhook 연결 테스트

**방법 1: 브라우저에서 GET 요청**

배포된 URL을 브라우저에서 열기:
```
https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

**예상 응답:**
```json
{
  "status": "ok",
  "message": "TradingView Webhook Handler is running",
  "timestamp": "2024-11-21T..."
}
```

✅ 이렇게 나오면 Webhook이 정상 작동 중!

**방법 2: Apps Script에서 직접 테스트**

1. 함수 선택: `testWebhook`
2. 실행
3. 로그 확인 (Ctrl + Enter)

**예상 로그:**
```
=== Webhook 테스트 ===
테스트 데이터:
{
  "signal": "LONG",
  "entry": "95000000",
  ...
}

결과:
{
  "action": "long_executed",
  "market": "KRW-BTC",
  ...
}
```

### 4-2. TradingView 신호 실제 테스트

**⚠️ 주의: 실제 돈이 사용됩니다!**

테스트 방법:
1. **소액으로 설정** (Code.gs에서):
   ```javascript
   ORDER_AMOUNT: 5000,  // 5천원으로 테스트
   ```

2. **TradingView에서 신호 기다리기**
   - 또는 과거 데이터에서 신호 발생 시점으로 이동

3. **Apps Script 로그 확인:**
   ```
   Apps Script > 실행
   최근 실행 항목 클릭
   로그 확인
   ```

**예상 로그:**
```
📨 Webhook 수신: 2024-11-21 ...
{
  "signal": "LONG",
  "entry": "95000000",
  ...
}

🎯 신호 처리 시작: LONG
진입가: 95000000
종합 점수: 15.5

💰 LONG 매수 실행
✅ 매수 완료
```

4. **업비트에서 확인:**
   - 주문 내역 확인
   - 체결 확인

---

## 📊 5단계: 포지션 모니터링 확인

매수 후 1분마다 자동으로 `monitorWebhookPosition` 실행됨.

### 5-1. 저장된 포지션 확인

Apps Script에서:
```javascript
함수: checkSavedPosition
실행

// 로그:
저장된 포지션:
{
  "market": "KRW-BTC",
  "entryPrice": 95000000,
  "tp1Price": 95760000,
  "tp2Price": 96425000,
  "slPrice": 94715000,
  "tp1Hit": false,
  "tp2Hit": false,
  ...
}
```

### 5-2. 모니터링 로그 확인

**실행 > 내 실행**에서 최근 실행 확인:

```
📊 포지션 모니터링
진입가: 95,000,000
현재가: 95,500,000
수익률: +0.53%
TP1: 95,760,000
TP2: 96,425,000
SL: 94,715,000

⏸️ 포지션 유지 중...
```

### 5-3. TP/SL 자동 실행

**TP1 도달 시:**
```
🟢 TP1 도달!
50% 익절 실행
텔레그램/이메일 알림 발송
```

**TP2 도달 시:**
```
🟢🟢 TP2 도달!
전량 익절 실행
포지션 정리 완료
```

**SL 도달 시:**
```
🔴 SL 도달
전량 손절 실행
포지션 정리 완료
```

---

## 🛠️ 트러블슈팅

### 1. "Webhook이 작동하지 않아요"

**체크리스트:**
- [ ] 웹 앱을 배포했나요?
- [ ] 배포 시 "모든 사용자" 선택했나요?
- [ ] TradingView 알람에 올바른 URL을 입력했나요?
- [ ] "Once Per Bar Close" 체크했나요?
- [ ] Pine Script에서 `alert()` 함수가 있나요?

**테스트:**
```bash
# 브라우저에서 URL 열어보기
https://script.google.com/macros/s/YOUR_ID/exec

# 응답이 나오면 OK
```

### 2. "매수가 실행되지 않아요"

**체크리스트:**
- [ ] Upbit API 키가 올바른가요?
- [ ] API 키 권한에 "주문하기" 포함되어 있나요?
- [ ] `MIN_SIGNAL_STRENGTH` 임계값을 초과했나요?
- [ ] 이미 포지션을 보유 중은 아닌가요?

**로그 확인:**
```
Apps Script > 실행 > 내 실행
최근 로그에서 오류 메시지 확인
```

### 3. "TP/SL이 자동으로 실행되지 않아요"

**체크리스트:**
- [ ] `setupTriggers()` 함수를 실행했나요?
- [ ] 트리거 메뉴에서 `monitorWebhookPosition`이 보이나요?
- [ ] 포지션이 저장되어 있나요? (`checkSavedPosition` 실행)

**강제 모니터링 실행:**
```javascript
함수: monitorWebhookPosition
실행
```

### 4. "포지션이 저장되지 않아요"

**확인:**
```javascript
함수: checkSavedPosition
실행

// 없으면:
함수: testWebhook
실행 (테스트 포지션 생성)
```

**삭제:**
```javascript
함수: clearPosition
실행
```

---

## 🔐 보안 주의사항

### API 키 보안

1. **절대 공유 금지**
   - GitHub에 업로드 금지
   - 스크린샷 공유 시 주의

2. **권한 최소화**
   ```
   Upbit API 권한:
   ✅ 자산 조회
   ✅ 주문 조회
   ✅ 주문하기
   ❌ 출금하기 (불필요)
   ```

3. **IP 화이트리스트** (선택)
   - Upbit에서 허용 IP 설정 가능
   - Apps Script IP는 고정되지 않아 어려움

### Webhook URL 보안

1. **URL 노출 주의**
   - 공개 저장소에 올리지 마세요
   - 누군가 URL을 알면 가짜 신호를 보낼 수 있습니다

2. **신호 검증 추가** (선택사항)
   ```javascript
   // WebhookHandler.gs에 추가
   const SECRET_TOKEN = 'your-secret-key';

   if (data.token !== SECRET_TOKEN) {
     return ContentService.createTextOutput('Unauthorized');
   }
   ```

---

## 📈 운영 팁

### 1. 로그 모니터링

**정기적으로 확인:**
- Apps Script > 실행 > 내 실행
- 오류가 없는지 확인
- TP/SL 실행 내역 확인

### 2. 알림 설정

**중요 이벤트 알림:**
- 매수 체결
- TP1/TP2 달성
- 손절 실행
- 오류 발생

### 3. 백업

**정기적으로 백업:**
```bash
# 로컬에서 코드 다운로드
clasp pull
```

### 4. 성능 모니터링

**Google Sheets에서 거래 기록 확인:**
- TradingLog 시트
- 승률, 평균 손익 계산
- 전략 개선에 활용

---

## 🎯 다음 단계

### 고급 기능 추가 (선택)

1. **동적 포지션 크기**
   ```javascript
   // 신호 강도에 따라 투입 금액 조절
   if (totalScore >= 18) {
     orderAmount = CONFIG.TRADING.ORDER_AMOUNT * 1.5;
   }
   ```

2. **트레일링 스톱**
   ```javascript
   // 최고가 대비 일정 % 하락 시 매도
   ```

3. **다중 코인 지원**
   ```javascript
   // 여러 코인 동시 모니터링
   ```

4. **텔레그램 봇 연동**
   ```javascript
   // 텔레그램으로 명령 전송 가능
   ```

---

## 📞 지원

문제가 발생하면:

1. **로그 먼저 확인**
   - Apps Script > 실행 로그

2. **테스트 함수 실행**
   - `testWebhook()`
   - `testPositionMonitoring()`

3. **포지션 상태 확인**
   - `checkSavedPosition()`

---

**중요:** 실제 자금 투입 전 소액으로 충분히 테스트하세요!
