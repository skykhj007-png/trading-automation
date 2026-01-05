# V39 Trading Automation 설정 가이드

## 현재 시스템 구성

### 1. Cloudflare Worker (텔레그램 봇)
- **URL:** `https://v39-bot.myblog-tools.workers.dev`
- **기능:** 텔레그램 명령어 처리, AI 분석, 환영 메시지

### 2. cron-job.org (4시간 자동 알람)
- **URL:** https://cron-job.org
- **설정:** `0 1,5,9,13,17,21 * * *` (KST)
- **실행 시간:** 01:00, 05:00, 09:00, 13:00, 17:00, 21:00
- **호출 URL:** `https://v39-bot.myblog-tools.workers.dev/test4h`

---

## 텔레그램 봇 명령어

### AI 차트 분석 (프리미엄)
```
/a1m - 1분봉 분석
/a5m - 5분봉 분석
/a15m - 15분봉 분석
/a30m - 30분봉 분석
/a1h - 1시간봉 분석
/a4h - 4시간봉 분석
/a1d - 일봉 분석

예: /a15m ETH → ETH 15분봉 분석
```

### 지표 가이드 (프리미엄)
```
/가이드 - 핵심 가이드
/알림 - 알림 설정 방법
/체크리스트 - 진입 조건
/청산 - 청산 가이드
/등급 - 등급 설명
/고래 - 고래 등급 설명
/심리 - 심리적 구간 설명
/smc - SMC/구조 설명
/설정 - 권장 설정
```

### 세부 설명 명령어 (프리미엄)
```
/poc - POC (거래량 집중점) 설명
/라운드 또는 /round - 라운드 넘버 설명
/고점저점 또는 /hl - 고점/저점 구조 설명
/공포탐욕 또는 /fg - 공포/탐욕 지표 설명
```

### 관리자 명령어
```
/premium4h - 프리미엄 4시간 분석 발송
/sendhelp - 프리미엄 도움말 발송
/broadcast [메시지] - 무료채널 발송
```

---

## 주요 설정 정보

### 텔레그램
- **봇 토큰:** `8581875115:AAFVCZKj6YNd6BAhoSl1jzh0WsIEKUF1Nbo`
- **무료 채널:** `@V38_Signal`
- **프리미엄 그룹 1:** `-1003318469200`
- **프리미엄 그룹 2:** `-1003672890861`
- **관리자 ID:** `752036014`

### Cloudflare Worker
- **이름:** `v39-bot`
- **URL:** `https://v39-bot.myblog-tools.workers.dev`

---

## 배포 방법

### Cloudflare Worker 배포
```bash
cd C:\Users\kim\trading-automation
npx wrangler deploy
```

### 수동 테스트
- 4시간 분석: `https://v39-bot.myblog-tools.workers.dev/test4h`
- 웹훅 설정: `https://v39-bot.myblog-tools.workers.dev/setWebhook`
- 웹훅 삭제: `https://v39-bot.myblog-tools.workers.dev/deleteWebhook`

---

## cron-job.org 설정 방법

1. https://cron-job.org 접속 → 로그인
2. CREATE CRONJOB 클릭
3. 설정:
   - **Title:** `V39 4시간 분석`
   - **URL:** `https://v39-bot.myblog-tools.workers.dev/test4h`
   - **Schedule:** Custom 선택
   - **Crontab:** `0 1,5,9,13,17,21 * * *`
4. CREATE/SAVE 클릭

---

## 파일 구조

```
trading-automation/
├── cloudflare-worker.js    # 메인 봇 코드
├── wrangler.toml           # Cloudflare 설정
├── pipedream-scheduled-4h.js # Pipedream용 (백업)
├── SETUP-GUIDE.md          # 이 파일
└── .env.example            # 환경변수 템플릿
```

---

## 문제 해결

### 4시간 알람이 안 올 때
1. cron-job.org에서 cronjob 상태 확인 (Enable job ON?)
2. 수동 테스트: `https://v39-bot.myblog-tools.workers.dev/test4h` 접속
3. 무료 채널에 메시지 오는지 확인

### 봇 명령어가 안 될 때
1. 웹훅 재설정: `/setWebhook` URL 접속
2. Cloudflare Worker 재배포: `npx wrangler deploy`

---

## 업데이트 기록

### 2026-01-06
- 4시간 알람: Cloudflare Cron → cron-job.org로 변경 (안정성)
- 개별 명령어 추가: /poc, /라운드, /고점저점, /공포탐욕
- API 변경: market_chart → simple/price (속도 개선)

---

## 문의
- 텔레그램: @pointting
