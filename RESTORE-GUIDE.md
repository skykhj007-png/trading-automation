# 포맷 후 복구 가이드

## 1. 필요한 프로그램 설치

```powershell
# Git 설치
winget install Git.Git

# Node.js 설치
winget install OpenJS.NodeJS.LTS

# VS Code 설치 (선택)
winget install Microsoft.VisualStudioCode
```

## 2. 프로젝트 클론

```powershell
cd C:\Users\kim
git clone https://github.com/papanoyang/trading-automation.git
cd trading-automation
```

## 3. Cloudflare Wrangler 설치 및 로그인

```powershell
npm install -g wrangler
wrangler login
```

## 4. Cloudflare 환경변수 재설정

Cloudflare Dashboard에서 설정하거나:

```powershell
# BOT_TOKEN 설정 (아래 값을 실제 토큰으로 교체)
wrangler secret put BOT_TOKEN
# 프롬프트가 뜨면 텔레그램 봇 토큰 입력
```

## 5. 현재 설정값 (민감하지 않은 정보)

```
ADMIN_ID: 752036014
FREE_CHANNEL: @V38_Signal
PREMIUM_GROUP_1: -1003318469200
PREMIUM_GROUP_2: -1003672890861
WORKER_URL: https://v39-bot.myblog-tools.workers.dev
FINNHUB_API_KEY: ctaborhr01qhup62c7tgctaborhr01qhup62c7u0 (무료)
```

## 6. 민감한 정보 (별도 보관 필요)

아래 정보는 GitHub에 올라가지 않으므로 별도로 안전하게 보관하세요:

- **BOT_TOKEN**: 텔레그램 @BotFather에서 발급받은 토큰
  - 현재 사용 중인 봇: @v39_signal_bot
  - 토큰 분실 시: @BotFather에서 /revoke로 재발급

- **Google Apps Script URL** (선택):
  - 트레이딩 로그: https://script.google.com/macros/s/AKfycbxNZUjF4mSL7VioSAE3ZVfnP1m1BXbDwY5qmjSgZfKO91GiOJWKnFrNR0Dsq0iOTv69/exec
  - 포지션 기록: https://script.google.com/macros/s/AKfycbwKxvNYuMuZRXai7sIWOiyJKgxg7R3J45G3fWhJfJD7tBbWvsydreETG1m6lBePpbQ5/exec

## 7. Worker 배포

```powershell
cd C:\Users\kim\trading-automation
npx wrangler deploy cloudflare-worker.js
```

## 8. 웹훅 설정

텔레그램 봇에 웹훅 연결:
```
https://v39-bot.myblog-tools.workers.dev/setup
```

브라우저에서 위 URL 접속하면 자동 설정됨

## 9. Claude Code 설정 복원

프로젝트 폴더에서:
```powershell
claude
```

Claude Code가 자동으로 `.claude/settings.local.json` 읽음

---

## 백업 체크리스트

포맷 전 확인:
- [ ] BOT_TOKEN 메모 완료
- [ ] GitHub 푸시 완료
- [ ] Cloudflare 계정 정보 확인

복구 후 확인:
- [ ] git clone 성공
- [ ] wrangler login 성공
- [ ] BOT_TOKEN 환경변수 설정
- [ ] Worker 배포 성공
- [ ] 웹훅 설정 성공
- [ ] 봇 테스트 (/start 명령)
