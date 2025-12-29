# V30 텔레그램 판매 시스템 설정

## 채널 정보

| 항목 | 값 |
|------|-----|
| 무료 채널 | https://t.me/V30_Trading |
| 유료 채널 | V30 Premium 🔒 (비공개) |
| 채널 ID | -1003672890861 |
| 관리자 | @pointting |

## Pipedream Workflows

### 1. 시그널 자동 전송
- **Webhook URL**: `https://eoybgq22a09g1el.m.pipedream.net`
- **용도**: TradingView Alert → 텔레그램 채널
- **설정**: HTTP Trigger → Telegram Send Message

### 2. 자동응답 봇
- **트리거**: Telegram Bot Command
- **명령어**:
  - `/start` - 메뉴 안내
  - `/free` - Bitget 레퍼럴 무료 이용 안내
  - `/price` - 가격/조건 안내
  - `/contact` - 1:1 문의 안내

## TradingView 알림 설정

1. 차트에서 V30 지표 적용
2. 알림 생성 (Alert)
3. 조건: `매매지표 V30 최적화` → `alert() function calls only`
4. Webhook URL: `https://eoybgq22a09g1el.m.pipedream.net`
5. Message: 비워두기 (Pine Script에서 자동 생성)

## 비즈니스 모델

### 무료 이용 (레퍼럴)
```
1. Bitget 레퍼럴 가입: https://partner.bitget.com/bg/AZ6Z8S
2. UID + TradingView 사용자명 전송
3. 지표 권한 부여
4. 유지 조건: Bitget 거래 활동 (주기적 확인)
```

### 유료 이용
```
- 월간: 29,000원
- 평생: 99,000원
```

## 구글 시트 관리

- **URL**: https://docs.google.com/spreadsheets/d/1Y5trEoTHiRXaSY4twQLnrAn8Dcgpghrk6ubGeWvVz24/
- **컬럼**: Bitget UID | TradingView ID | 텔레그램 | 가입일 | 월거래량($) | 상태 | 비고
- **상태 수식** (F2): `=IF(E2="","",IF(E2>=300,"✅ 활성",IF(E2>=100,"⚠️ 경고","❌ 회수")))`

## 봇 메시지 내용

### /start
```
👋 V30 시그널 봇입니다!

📌 메뉴 선택:
/free - 무료 지표 받기
/price - 이용 조건
/contact - 1:1 문의
```

### /free
```
🎁 V30 지표 무료 이용 방법

1️⃣ 아래 링크로 Bitget 가입
👉 https://partner.bitget.com/bg/AZ6Z8S

2️⃣ @pointting 으로 전송
   - Bitget UID
   - 트레이딩뷰 사용자명

3️⃣ 확인 후 지표 권한 부여 (1영업일)

━━━━━━━━━━━━━━━━

📌 유지 조건
• Bitget에서 거래 활동 필요
• 미활동 시 권한 회수될 수 있음
```

### /price
```
💰 V30 이용 조건

✅ 무료 이용
Bitget 레퍼럴 가입 시 무료
👉 https://partner.bitget.com/bg/AZ6Z8S

💳 유료 이용
• 월간: 29,000원
• 평생: 99,000원

📩 결제 문의: @pointting
```

### /contact
```
📩 1:1 문의

@pointting 으로 메시지 보내주세요!

문의 가능 시간: 10:00 ~ 22:00
```

## 무료 채널 홍보 문구

```
📊 비트코인 매매 시그널 무료 채널

✅ 3개월 백테스트 승률 64%
✅ 롱/숏 시그널 + TP/SL 자동 계산
✅ MTF 5개 타임프레임 분석

무료 채널: t.me/V30_Trading

※ 투자 조언 아닌 기술적 분석 도구입니다
```

## 미완료 작업

- [ ] AI 주기적 리포트 (Pipedream Schedule + ChatGPT)
- [ ] TradingView 마켓 등록
- [ ] 크몽 개발 대행 서비스 등록

## 민감 정보 (별도 보관)

⚠️ 아래 정보는 GitHub에 올리지 마세요:
- 텔레그램 봇 토큰
- OpenAI API 키
- 결제 계좌 정보
