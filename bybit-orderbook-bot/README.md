# Bybit Orderbook Analyzer 🐋

실시간 오더북 분석으로 대량 주문벽(오더블럭)과 오더북 불균형을 감지하는 봇

## 🚀 기능

### 1. 대량 주문벽 감지 (Whale Wall Detection)
- 평균 대비 5배 이상 큰 주문 감지
- 50만 USDT 이상 규모만 알림
- 매수벽 (지지선) / 매도벽 (저항선) 구분

### 2. 오더북 불균형 분석 (Order Imbalance)
- 매수/매도 총액 비교
- 30% 이상 불균형 시 알림
- 방향 예측 (매수 우세 → 상승 가능성)

### 3. 텔레그램 실시간 알림
- 대량 주문벽 발견 시 즉시 알림
- 오더북 불균형 감지 시 알림
- 5분 쿨다운 (과도한 알림 방지)

## 📦 설치

```bash
cd bybit-orderbook-bot
npm install
```

## ⚙️ 설정

1. `.env.example`을 `.env`로 복사
```bash
cp .env.example .env
```

2. `.env` 파일 수정
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

## 🎯 실행

```bash
npm start
```

개발 모드 (자동 재시작):
```bash
npm run dev
```

## 📊 알림 예시

### 대량 매수벽 감지
```
🐋 🟢 매수벽 감지!

📊 BTCUSDT
━━━━━━━━━━━━━━
💰 가격: $95,000
📦 수량: 52.3 BTC
💵 규모: $4.97M
📏 현재가 대비: 2.1%
⚡ 강도: 8.3x 평균

📈 오더북 상태
• 매수총액: $45.2M
• 매도총액: $38.1M
• 불균형: +8.5%
```

### 오더북 불균형 감지
```
📈 오더북 불균형 감지!

📊 BTCUSDT
━━━━━━━━━━━━━━
🟢 매수 우세
불균형: +35.2%

💰 현재가: $97,250
📊 스프레드: 0.01%

📈 매수측: $52.3M
📉 매도측: $38.7M
```

## ⚙️ 설정 커스터마이징

`orderbook-analyzer.js`의 `CONFIG` 객체 수정:

```javascript
const CONFIG = {
    // 모니터링 심볼 추가
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],

    // 오더북 깊이 (1, 50, 200, 500)
    depth: 50,

    // 대량 주문벽 기준
    whaleWallMultiplier: 5.0,  // 평균 대비 배수
    minWallSizeUSDT: 500000,   // 최소 규모

    // 오더북 불균형 임계값
    imbalanceThreshold: 30,    // 30% 이상

    // 알림 쿨다운
    alertCooldown: 300         // 5분
};
```

## 🔗 Bybit API

이 봇은 **Public WebSocket API**를 사용합니다:
- API 키 필요 없음
- 실시간 오더북 스트리밍
- 50 레벨 깊이 지원

공식 문서: [Bybit API Orderbook](https://bybit-exchange.github.io/docs/v5/websocket/public/orderbook)

## 📈 활용 전략

### 1. 대량 매수벽 → 지지선
- 현재가 아래 큰 매수벽 = 강력한 지지
- 해당 가격 근처에서 롱 진입 고려

### 2. 대량 매도벽 → 저항선
- 현재가 위 큰 매도벽 = 강력한 저항
- 해당 가격 근처에서 익절 or 숏 진입 고려

### 3. 매수 불균형 → 상승 신호
- 매수 총액 > 매도 총액
- 단기 상승 가능성

### 4. 매도 불균형 → 하락 신호
- 매도 총액 > 매수 총액
- 단기 하락 가능성

## ⚠️ 주의사항

- 오더북 분석은 참고용이며 100% 정확하지 않음
- 대량 주문은 취소될 수 있음 (스푸핑)
- 다른 지표와 함께 사용 권장
- 손절 필수!

## 📝 라이선스

MIT License
