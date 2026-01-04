# V39 Trading Bot - 작업 컨텍스트 (이어서 작업용)

## 프로젝트 개요
- TradingView V39 지표 + 텔레그램 봇 + Cloudflare Worker 연동
- 무료 채널(@V38_Signal)과 프리미엄 그룹 운영
- 고래 등급 시스템으로 거래량 기반 알림 분류

---

## 핵심 파일 위치

### 1. Cloudflare Worker 코드
```
C:\Users\skykh\trading-automation\cloudflare-worker.js
```
- 텔레그램 봇 웹훅 처리
- 4시간 자동 분석 발송
- TradingView 웹훅 수신
- AI 분석 명령어 처리

### 2. TradingView Pine Script
```
C:\Users\skykh\trading-automation\매매지표-V39-MTFConfluence.pine
```
- V39 MTF Confluence Pro 지표
- 고래 등급 시스템 포함
- 알림 형식 개선됨

---

## Cloudflare 설정 정보

### Worker URL
- 메인: https://v39-bot.myblog-tools.workers.dev
- 웹훅 설정: /setWebhook
- 수동 테스트: /test4h
- TradingView 웹훅: /tradingview

### Cron Trigger (4시간 자동 분석)
```
0 0,4,8,12,16,20 * * *
```
한국시간: 01:00, 05:00, 09:00, 13:00, 17:00, 21:00

---

## 텔레그램 설정

### 봇 정보
- 봇 이름: @V30_Signal_bot
- BOT_TOKEN: 8581875115:AAFVCZKj6YNd6BAhoSl1jzh0WsIEKUF1Nbo

### 채널/그룹
- 무료 채널: @V38_Signal
- 프리미엄 그룹 ID: -1003318469200
- 프리미엄 그룹 2 ID: -1003672890861
- 관리자 ID: 752036014

---

## 고래 등급 시스템

| 등급 | 이모지 | 거래량 | 무료방 전송 |
|------|--------|--------|-------------|
| WHALE | 🐋 | 10x+ | ❌ 프리미엄 전용 |
| SHARK | 🦈 | 7-10x | ❌ 프리미엄 전용 |
| DOLPHIN | 🐬 | 5-7x | ✅ |
| FISH | 🐟 | 3-5x | ✅ |
| CRAB | 🦀 | 2-3x | ✅ |
| SHRIMP | 🦐 | 1.5-2x | ✅ |

**무료방 규칙**: 새우~돌고래만 전송, 상어/고래는 프리미엄 전용

---

## AI 분석 명령어

| 명령어 | 타임프레임 |
|--------|-----------|
| /a1m | 1분봉 |
| /a5m | 5분봉 |
| /a15m | 15분봉 |
| /a30m | 30분봉 |
| /a1h | 1시간봉 |
| /a4h | 4시간봉 |
| /a1d | 일봉 |

- 재시도 로직: 3회 (1초 간격)
- CoinGecko API + OpenAI GPT-4o-mini 사용

---

## 추가된 봇 명령어

- /고래 또는 /whale - 고래 등급 시스템 설명
- /가이드, /알림, /체크리스트, /청산, /등급, /smc, /설정
- 관리자: /premium4h, /sendhelp, /broadcast

---

## 최근 수정 사항

### Pine Script 변경
1. 알림 형식에 이모지 추가 (🚀, ⭐, 💀, ⚠️ 등)
2. 고래 등급별 라벨 표시 (label.new 사용)
3. 거래량/매수압력 정보 추가
4. 봉 마감 시에만 알림: `freq_once_per_bar_close`

### Cloudflare Worker 변경
1. 재시도 로직 추가 (3회)
2. 실패 시 관리자 알림
3. 고래 등급별 무료방 필터링
4. /고래 명령어 추가

---

## 남은 작업 (TODO)

### 1. TradingView 알림 설정
- [ ] 알림 생성
- [ ] 조건: V39 MTF Confluence Pro → "모든 alert() 함수 호출"
- [ ] Webhook URL: https://v39-bot.myblog-tools.workers.dev/tradingview
- [ ] 만료: 무기한 (Open-ended)
- [ ] 타임프레임: 4시간봉 (무료방용)

### 2. TradingView 지표 업데이트
- [ ] 새 Pine Script 코드 적용
- [ ] 저장 및 차트에 추가

---

## 트러블슈팅

### 알림이 안 올 때
1. Cloudflare 코드 최신 버전 확인
2. 웹훅 재설정: /setWebhook 접속
3. 수동 테스트: /test4h 접속

### 4시간 분석 안 될 때
1. Cron Trigger 확인 (UTC 시간대)
2. CoinGecko API 제한 확인
3. 관리자에게 실패 알림 확인

### 알림이 너무 자주 울릴 때
- `freq_once_per_bar_close` 적용 확인
- 봉 마감 시에만 알림 발생

---

## API 키 (코드에 포함됨)

- OpenAI: sk-proj-TWd8Wb-u9UZY... (cloudflare-worker.js에 있음)
- Telegram Bot Token: 8581875115:AAFV... (cloudflare-worker.js에 있음)

---

마지막 작업: 2026-01-03 오후
다음 작업: TradingView 알림 설정 완료하기
