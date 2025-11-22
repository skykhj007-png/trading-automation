# Trading Automation with Google Apps Script

Google Apps Script를 활용한 암호화폐 자동 거래 시스템입니다.

## 주요 기능

- 실시간 시세 모니터링
- 자동 매매 (이동평균 전략)
- 손절/익절 자동 실행
- 포트폴리오 관리
- 이메일 및 텔레그램 알림
- 거래 로그 기록 (Google Sheets)

## 지원 거래소

- Upbit (업비트)
- Binance (개발 예정)
- 기타 거래소 추가 가능

## 설치 방법

### 1. Google Apps Script 프로젝트 생성

1. [Google Apps Script](https://script.google.com) 접속
2. 새 프로젝트 생성
3. `Code.gs` 파일에 코드 복사

### 2. Google Sheets 연동

1. Google Sheets 새 문서 생성
2. Apps Script 편집기에서 `확장 프로그램 > Apps Script` 실행
3. 코드 복사 후 저장

### 3. API 키 설정

`Code.gs` 파일의 `CONFIG` 객체에서 API 정보를 입력하세요:

```javascript
const CONFIG = {
  EXCHANGE: {
    NAME: 'upbit',
    API_KEY: 'YOUR_API_KEY',        // 발급받은 API 키
    SECRET_KEY: 'YOUR_SECRET_KEY',  // 발급받은 Secret 키
    BASE_URL: 'https://api.upbit.com/v1'
  },
  // ...
};
```

### 4. Upbit API 키 발급

1. [Upbit](https://upbit.com) 로그인
2. 마이페이지 > Open API 관리
3. Open API Key 발급
4. 필요한 권한 선택:
   - 자산 조회
   - 주문 조회
   - 주문하기
   - 출금하기 (선택사항)

**주의**: API 키는 절대 외부에 노출하지 마세요!

## 설정 가이드

### 거래 설정

```javascript
TRADING: {
  MARKET: 'KRW-BTC',           // 거래할 마켓
  ORDER_AMOUNT: 10000,         // 주문 금액 (KRW)
  STOP_LOSS_PERCENT: -5,       // 손절 비율 (%)
  TAKE_PROFIT_PERCENT: 10,     // 익절 비율 (%)
}
```

### 알림 설정

#### 이메일 알림

```javascript
NOTIFICATION: {
  ENABLED: true,
  EMAIL: 'your-email@gmail.com',
}
```

#### 텔레그램 알림

1. [@BotFather](https://t.me/botfather)에서 봇 생성
2. 봇 토큰 발급
3. [@userinfobot](https://t.me/userinfobot)에서 Chat ID 확인

```javascript
NOTIFICATION: {
  TELEGRAM_BOT_TOKEN: 'YOUR_BOT_TOKEN',
  TELEGRAM_CHAT_ID: 'YOUR_CHAT_ID'
}
```

## 사용 방법

### 자동 실행 트리거 설정

Apps Script 편집기에서 `setupTriggers()` 함수 실행:

1. 함수 선택: `setupTriggers`
2. 실행 버튼 클릭
3. 권한 승인

설정된 트리거:
- `checkPriceAndExecute`: 1분마다 시세 확인 및 거래 실행
- `checkStopLossAndTakeProfit`: 5분마다 손익 체크

### 수동 실행

#### 테스트 실행

```javascript
test()  // 시세 조회, 잔고 확인 테스트
```

#### 포트폴리오 확인

```javascript
getPortfolioStatus()  // 보유 자산 및 수익률 확인
```

#### 현재 시세 조회

```javascript
getCurrentPrice('KRW-BTC')  // 비트코인 현재가
```

#### 수동 매매

```javascript
// 시장가 매수 (10,000원어치)
marketBuy('KRW-BTC', 10000)

// 시장가 매도 (0.001 BTC)
marketSell('KRW-BTC', 0.001)
```

## 거래 전략

### 이동평균 전략 (기본)

- 단기 이동평균(5일)과 장기 이동평균(20일) 비교
- 골든 크로스: 매수 신호
- 데드 크로스: 매도 신호

### 커스텀 전략 추가

`movingAverageStrategy()` 함수를 수정하거나 새로운 전략 함수를 추가하세요:

```javascript
function myCustomStrategy() {
  // 나만의 거래 전략 구현
  const market = CONFIG.TRADING.MARKET;
  const price = getCurrentPrice(market);

  // 매수 조건
  if (/* 조건 */) {
    marketBuy(market, CONFIG.TRADING.ORDER_AMOUNT);
  }

  // 매도 조건
  if (/* 조건 */) {
    marketSell(market, volume);
  }
}
```

## 로그 확인

### Google Sheets 로그

거래 내역은 자동으로 Google Sheets에 기록됩니다:
- `TradingLog` 시트: 모든 거래 내역
- `ErrorLog` 시트: 에러 로그

### Apps Script 로그

Apps Script 편집기 > 실행 로그에서 확인 가능

## 주의사항

### 보안

- API 키를 절대 공개 저장소에 업로드하지 마세요
- API 키에는 최소 권한만 부여하세요
- 정기적으로 API 키를 재발급하세요

### 리스크 관리

- 소액으로 먼저 테스트하세요
- 손절/익절 비율을 반드시 설정하세요
- 투자 금액은 여유 자금으로만 사용하세요
- 자동 거래는 항상 리스크가 있습니다

### 법적 책임

- 이 코드는 교육 목적으로 제공됩니다
- 실제 거래로 인한 손실에 대해 책임지지 않습니다
- 본인의 판단과 책임 하에 사용하세요

## API 제한

### Upbit API 제한

- 분당 요청 제한: 약 100회
- 초당 요청 제한: 약 10회
- 제한 초과 시 일시적으로 차단될 수 있습니다

### Apps Script 제한

- 일일 실행 시간: 6분 (무료 계정)
- 트리거 제한: 20개
- URL Fetch 호출: 일 20,000회

자세한 내용은 [Apps Script Quotas](https://developers.google.com/apps-script/guides/services/quotas)를 참고하세요.

## 문제 해결

### API 요청 실패

1. API 키가 올바른지 확인
2. API 권한이 충분한지 확인
3. 네트워크 연결 상태 확인
4. Upbit API 상태 확인

### 트리거가 실행되지 않음

1. 트리거 설정 확인 (Apps Script > 트리거)
2. 권한 승인 여부 확인
3. 실행 로그에서 에러 확인

### 알림이 오지 않음

1. 이메일 주소가 올바른지 확인
2. 텔레그램 봇 토큰과 Chat ID 확인
3. `NOTIFICATION.ENABLED`가 `true`인지 확인

## 개발 로드맵

- [ ] Binance API 지원
- [ ] RSI, MACD 등 기술적 지표 추가
- [ ] 백테스팅 기능
- [ ] 웹 대시보드
- [ ] 다중 마켓 동시 거래
- [ ] 머신러닝 기반 예측

## 참고 자료

- [Upbit API 문서](https://docs.upbit.com)
- [Google Apps Script 가이드](https://developers.google.com/apps-script)
- [텔레그램 봇 API](https://core.telegram.org/bots/api)

## 라이선스

MIT License

## 기여

이슈 및 풀 리퀘스트는 언제나 환영합니다!

## 문의

문제가 있거나 질문이 있으시면 이슈를 등록해 주세요.
