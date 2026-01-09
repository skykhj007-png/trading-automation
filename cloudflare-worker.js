    // ============================================
// Cloudflare Workers - V39 텔레그램 봇
// ============================================
//
// 설정 방법:
// 1. https://dash.cloudflare.com 접속
// 2. Workers & Pages → Create Worker
// 3. 이 코드 붙여넣기 → Deploy
// 4. 웹훅 설정 (아래 URL로 브라우저 접속):
//    https://YOUR_WORKER.workers.dev/setWebhook
//
// ============================================

// 텔레그램 봇 토큰 (하드코딩)
const BOT_TOKEN = "8581875115:AAFVCZKj6YNd6BAhoSl1jzh0WsIEKUF1Nbo";
const OPENAI_API_KEY = "YOUR_OPENAI_API_KEY"; // Settings → Variables에서 설정
const FINNHUB_API_KEY = "ctaborhr01qhup62c7tgctaborhr01qhup62c7u0"; // Finnhub 무료 API 키 (https://finnhub.io)

const PREMIUM_GROUP_ID = -1003318469200;
const PREMIUM_GROUP_ID_2 = -1003672890861;
const ADMIN_ID = 752036014;
const FREE_CHANNEL_ID = "@V38_Signal";

export default {
  // ============================================
  // HTTP 요청 처리 (텔레그램 웹훅)
  // ============================================
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 웹훅 설정 엔드포인트
    if (url.pathname === '/setWebhook') {
      const webhookUrl = `${url.origin}/webhook`;
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
      const result = await response.json();
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 웹훅 삭제 엔드포인트
    if (url.pathname === '/deleteWebhook') {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
      const result = await response.json();
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 텔레그램 웹훅 처리
    if (url.pathname === '/webhook' && request.method === 'POST') {
      const update = await request.json();
      ctx.waitUntil(handleUpdate(update));
      return new Response('OK');
    }

    // 4시간 분석 수동 테스트
    if (url.pathname === '/test4h') {
      ctx.waitUntil(send4HourAnalysis());
      return new Response('4시간 분석이 무료 채널에 발송되었습니다!');
    }

    // 경제 캘린더 수동 테스트
    if (url.pathname === '/calendar') {
      ctx.waitUntil(sendEconomicCalendar());
      return new Response('경제 캘린더가 발송되었습니다!');
    }

    // 경제 캘린더 (프리미엄 전용)
    if (url.pathname === '/calendar-premium') {
      ctx.waitUntil(sendEconomicCalendarPremium());
      return new Response('프리미엄 경제 캘린더가 발송되었습니다!');
    }

    // 주간 경제 캘린더 테스트
    if (url.pathname === '/calendar-weekly') {
      ctx.waitUntil(sendWeeklyEconomicCalendar());
      return new Response('주간 경제 캘린더가 프리미엄방에 발송되었습니다!');
    }

    // 월간 경제 캘린더 테스트
    if (url.pathname === '/calendar-monthly') {
      ctx.waitUntil(sendMonthlyEconomicCalendar());
      return new Response('월간 경제 캘린더가 프리미엄방에 발송되었습니다!');
    }

    // 프리미엄 도움말 발송
    if (url.pathname === '/sendhelp') {
      ctx.waitUntil(sendPremiumHelp());
      return new Response('프리미엄 도움말이 발송되었습니다!');
    }

    // TradingView 웹훅 수신 (무료 채널용)
    if (url.pathname === '/tradingview' && request.method === 'POST') {
      const text = await request.text();
      ctx.waitUntil(handleTradingViewAlert(text));
      return new Response('OK');
    }

    return new Response('V39 Trading Bot is running!');
  },

  // ============================================
  // 스케줄 트리거 (cron별 분기 처리)
  // ============================================
  async scheduled(event, env, ctx) {
    const cron = event.cron;

    // 매월 1일 (월간 경제 캘린더)
    if (cron === '0 0 1 * *') {
      ctx.waitUntil(sendMonthlyEconomicCalendar());
    }
    // 매주 월요일 (주간 경제 캘린더)
    else if (cron === '0 0 * * 1') {
      ctx.waitUntil(sendWeeklyEconomicCalendar());
    }
    // 4시간마다 (무료방 시황)
    else {
      ctx.waitUntil(runScheduledAnalysis());
    }
  }
};

// 스케줄 작업 실행 함수 (API 호출 없이 빠르게)
async function runScheduledAnalysis() {
  const now = new Date();
  const kstHours = (now.getUTCHours() + 9) % 24;
  const timeStr = `${kstHours.toString().padStart(2, '0')}:00`;

  try {
    // 무료 채널에 고정 메시지 발송 (API 호출 없이)
    await sendSimpleAnalysis(timeStr);
    await sendMessage(ADMIN_ID, `✅ Cron 완료! (${timeStr} KST)`);
  } catch (error) {
    await sendMessage(ADMIN_ID, `❌ Cron 실패: ${error.message}`);
  }
}

// 간단한 4시간 분석 (API 없이)
async function sendSimpleAnalysis(timeStr) {
  const analysis = `📊 BTC 4시간봉 체크 (${timeStr} KST)

━━━━━━━━━━━━━━━━

⏰ 정기 분석 시간입니다!

🎯 V39 체크리스트

□ Smart Trail 색상 (라임=상승)
□ 1H/4H 추세 방향
□ 위치 (20% 이하 = 매수적합)
□ 거래량 급증 여부
□ Delta (▲BUY = 매수세)

━━━━━━━━━━━━━━━━

🚀 SUPER = 최고 신뢰도
⭐ STRONG = 높은 신뢰도
🐋 고래 = 대량 거래 감지

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님

📢 @V38_Signal
🤖 @V30_Signal_bot`;

  await sendMessage(FREE_CHANNEL_ID, analysis);
}

// 폴백 분석 (API 실패 시)
async function sendFallbackAnalysis() {
  const now = new Date();
  const kstHours = (now.getUTCHours() + 9) % 24;
  const timeStr = `${kstHours.toString().padStart(2, '0')}:00`;

  const fallbackMsg = `📊 BTC 4시간봉 리포트 (${timeStr} KST)

━━━━━━━━━━━━━━━━

⏰ 정기 분석 시간입니다!

📈 TradingView에서 V39 지표 확인하세요.

━━━━━━━━━━━━━━━━

🎯 체크리스트

□ Smart Trail 색상 확인
□ 1H/4H 추세 방향 확인
□ 위치(DISC/PREM) 확인
□ 거래량 급증 여부

━━━━━━━━━━━━━━━━

🚀 = SUPER LONG
⭐ = STRONG LONG

⚠️ 참고용 - 투자권유 아님

📢 @V38_Signal
🤖 @V30_Signal_bot`;

  await sendMessage(FREE_CHANNEL_ID, fallbackMsg);
}

// ============================================
// 타임아웃 fetch 헬퍼
// ============================================
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`T/O ${timeoutMs}ms`);
    }
    throw error;
  }
}

// ============================================
// 4시간 자동 분석 (무료 채널만) - 재시도 + 타임아웃 버전
// ============================================
async function send4HourAnalysis() {
  const maxRetries = 2;
  let lastError = null;
  let btcData = null;

  // 2회 재시도 (빠르게)
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const simpleUrl = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true`;

      const response = await fetchWithTimeout(simpleUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'V39-Trading-Bot/1.0'
        }
      }, 8000); // 8초 타임아웃

      if (!response.ok) {
        throw new Error(`API ${response.status}`);
      }

      const data = await response.json();

      if (!data.bitcoin || !data.bitcoin.usd) {
        throw new Error('데이터없음');
      }

      btcData = data.bitcoin;
      break; // 성공 시 루프 종료

    } catch (error) {
      lastError = error.message;
      if (attempt < maxRetries) {
        // 재시도 전 2초 대기
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  const now = new Date();
  const kstHours = (now.getUTCHours() + 9) % 24;
  const timeStr = `${kstHours.toString().padStart(2, '0')}:00`;

  let analysis;
  let success = true;

  if (btcData) {
    // API 성공 - 실제 데이터로 분석
    const currentPrice = Math.round(btcData.usd);
    const changePercent = btcData.usd_24h_change?.toFixed(2) || "0.00";

    // 변동률 기반 추정
    const trend = changePercent > 0 ? "상승" : "하락";
    const trendStrength = Math.abs(parseFloat(changePercent)) > 3 ? "강한 " : "";

    // RSI 추정 (24시간 변동 기반)
    let rsi = 50 + (parseFloat(changePercent) * 2.5);
    rsi = Math.max(20, Math.min(80, rsi)).toFixed(0);

    // 위치 추정 (변동률 기반)
    let position = 50 + (parseFloat(changePercent) * 5);
    position = Math.max(10, Math.min(90, position)).toFixed(0);

    analysis = `📊 BTC 4시간봉 분석 (${timeStr} KST)

━━━━━━━━━━━━━━━━

💰 현재가: $${currentPrice.toLocaleString()} (${changePercent > 0 ? '+' : ''}${changePercent}%)

📈 추세: ${trendStrength}${trend}
📊 RSI: ${rsi} ${rsi > 70 ? '⚠️과매수' : rsi < 30 ? '✅과매도' : '중립'}
📍 위치: ${position}% ${position < 30 ? '(DISC✅)' : position > 70 ? '(PREM⚠️)' : '(중간)'}

━━━━━━━━━━━━━━━━

🎯 V39 관점

${changePercent > 0 ? '✅ 상승 추세' : '⚠️ 하락 추세'}
${position < 30 ? '✅ 매수 적합 구간' : position > 70 ? '⚠️ 매도 적합 구간' : '• 중립 구간'}
${rsi < 30 ? '✅ 과매도 반등 기대' : rsi > 70 ? '⚠️ 과매수 조정 주의' : '• RSI 중립'}

━━━━━━━━━━━━━━━━

🚀 = SUPER LONG
⭐ = STRONG LONG
🐋 = 고래 활동

⚠️ 참고용 - 투자권유 아님

📢 @V38_Signal
🤖 @V30_Signal_bot`;

  } else {
    // API 실패 - 기본 메시지 발송 (채널은 유지)
    success = false;
    analysis = `📊 BTC 4시간봉 리포트 (${timeStr} KST)

━━━━━━━━━━━━━━━━

⏰ 정기 분석 시간입니다!

📈 현재 시장 상황을 확인해보세요.

━━━━━━━━━━━━━━━━

🎯 체크리스트

□ TradingView V39 지표 확인
□ Smart Trail 색상 확인
□ 1H/4H 추세 방향 확인
□ 위치(DISC/PREM) 확인

━━━━━━━━━━━━━━━━

🚀 = SUPER LONG
⭐ = STRONG LONG
🐋 = 고래 활동

⚠️ 참고용 - 투자권유 아님

📢 @V38_Signal
🤖 @V30_Signal_bot`;
  }

  // 무료 채널에 발송 (성공/실패 모두)
  try {
    await sendMessage(FREE_CHANNEL_ID, analysis);
  } catch (sendError) {
    return { success: false, error: `발송실패: ${sendError.message}` };
  }

  return { success, error: lastError };
}

// ============================================
// 텔레그램 업데이트 처리
// ============================================
async function handleUpdate(update) {
  const message = update.message;
  if (!message) return;

  const chatId = message.chat?.id;
  const text = message.text || "";

  // 새 멤버 환영
  const newMember = message.new_chat_member || message.new_chat_members?.[0];
  if (newMember && !newMember.is_bot) {
    await handleWelcome(chatId, newMember);
    return;
  }

  // 명령어 처리
  if (text.startsWith('/')) {
    await handleCommand(chatId, text);
  }
}

// ============================================
// 환영 메시지
// ============================================
async function handleWelcome(chatId, newMember) {
  const isPremium = (chatId === PREMIUM_GROUP_ID || chatId === PREMIUM_GROUP_ID_2);

  let welcomeText;

  if (isPremium) {
    welcomeText = `👋 안녕하세요, ${newMember.first_name}님!

🎉 프리미엄 멤버가 되신 것을 환영합니다!

━━━━━━━━━━━━━━━━

📚 프리미엄 전용 명령어

📊 AI 차트 분석
/a1m - 1분봉 분석
/a5m - 5분봉 분석
/a15m - 15분봉 분석
/a30m - 30분봉 분석
/a1h - 1시간봉 분석
/a4h - 4시간봉 분석
/a1d - 일봉 분석

💡 /a15m ETH → ETH 분석
🪙 모든 코인 지원!

━━━━━━━━━━━━━━━━

📖 지표 가이드
/가이드 - 핵심 가이드
/알림 - 알림 설정 방법
/체크리스트 - 진입 조건
/청산 - 청산 가이드
/등급 - 등급 설명
/고래 - 고래 등급 설명 ⭐
/심리 - 심리적 구간 설명 ⭐
/smc - SMC/구조 설명
/설정 - 권장 설정

━━━━━━━━━━━━━━━━

/도움말 - 전체 명령어 보기

⚠️ 참고용이며 투자권유가 아닙니다`;
  } else {
    welcomeText = `👋 환영합니다, ${newMember.first_name}님!

🤖 MTF Confluence Pro

⚠️ 본 서비스는 참고용이며 투자권유가 아닙니다.

【무료 이용 방법】
비트겟 가입만 하면 모두 무료!

✅ 텔레그램 실시간 AI 분석&대화방 입장
✅ TradingView 지표 (평생)

━━━━━━━━━━━━━━━━

📌 무료 이용 조건:

1️⃣ 비트겟 가입 (레퍼럴)
👉 https://partner.bitget.com/bg/AZ6Z8S

2️⃣ 아래 정보 전송:
   • 비트겟 UID
   • TradingView 아이디

3️⃣ 24시간 내 권한 부여!

💡 유지 조건: 월 $100 거래량

━━━━━━━━━━━━━━━━

💰 비트겟 미가입 시 (유료):

• 월 구독: ₩50,000
• 평생 이용: ₩200,000

💳 입금 정보:
USDT (TRC20)
TPpgMe6JxtudoEdDegkyKUaBUyAWRKti12

━━━━━━━━━━━━━━━━

❓ 문의: @pointting`;
  }

  await sendMessage(chatId, welcomeText);
}

// ============================================
// 명령어 처리
// ============================================
async function handleCommand(chatId, text) {
  const parts = text.split(' ');
  const command = parts[0].toLowerCase();
  const coinInput = parts[1] ? parts[1].toUpperCase() : 'BTC';

  const isPremium = (chatId === PREMIUM_GROUP_ID || chatId === PREMIUM_GROUP_ID_2 || chatId === ADMIN_ID);

  let responseText = "";

  // /start /가입 /info
  if (command === '/start' || command === '/가입' || command === '/info') {
    responseText = `🤖 V39 Trading System

⚠️ 본 서비스는 참고용이며 투자권유가 아닙니다.

【무료 이용 방법】
비트겟 가입만 하면 모두 무료!

✅ 텔레그램 실시간 AI 분석&대화방 입장
✅ TradingView V39 지표 (평생)

━━━━━━━━━━━━━━━━

📌 무료 이용 조건:

1️⃣ 비트겟 가입 (레퍼럴)
👉 https://partner.bitget.com/bg/AZ6Z8S

2️⃣ 아래 정보 전송:
   • 비트겟 UID
   • TradingView 아이디

3️⃣ 24시간 내 권한 부여!

💡 유지 조건: 월 $100 거래량

━━━━━━━━━━━━━━━━

💰 비트겟 미가입 시 (유료):

• 월 구독: ₩50,000
• 평생 이용: ₩200,000

💳 입금 정보:
USDT (TRC20)
TPpgMe6JxtudoEdDegkyKUaBUyAWRKti12

━━━━━━━━━━━━━━━━

❓ 문의: @pointting`;
  }

  // 프리미엄 아닌 경우
  else if (!isPremium) {
    if (command.startsWith('/') && command !== '/start') {
      responseText = `🔒 프리미엄 전용 기능입니다.

━━━━━━━━━━━━━━━━

무료로 이용하려면:
👉 /start 입력 후 가입 안내 확인

━━━━━━━━━━━━━━━━

💬 문의: @pointting`;
    }
  }

  // AI 분석
  else if (['/a1m', '/a5m', '/a15m', '/a30m', '/a1h', '/a4h', '/a1d'].includes(command)) {
    responseText = await handleAIAnalysis(command, coinInput);
  }

  // /가이드
  else if (command === '/guide' || command === '/가이드' || command === '/설명서') {
    responseText = `📚 V39 MTF Confluence Pro

━━━━━━━━━━━━━━━━

⚠️ 본 지표는 참고용이며
   투자권유가 아닙니다!

━━━━━━━━━━━━━━━━

🎯 핵심 시그널 (이것만 보세요!)

🚀 SUPER LONG = 무조건 진입!
⭐ STRONG LONG = 강력 추천
💀 SUPER SHORT = 무조건 숏!
⚠️ STRONG SHORT = 강력 숏
🐋 WHALE BUY/SELL = 고래 활동

━━━━━━━━━━━━━━━━

✅ 진입 조건

• 2TF 이상 상승 + 1H UP
• 거래량 급증 + 매수압력 48%+
• Smart Trail 라임색
• 위치 30% 이하 (DISC)

━━━━━━━━━━━━━━━━

🚫 진입 금지

• 1H 또는 4H DOWN
• 위치 50% 이상
• Smart Trail 빨간색

━━━━━━━━━━━━━━━━

📍 미니패널 방향

▲ LONG (라임) = 롱 유리
  → Trail↑ + 1H↑ + 15점+

▼ SHORT (빨강) = 숏 유리
  → Trail↓ + 1H↓ + 위치70%+

— WAIT (회색) = 대기!

━━━━━━━━━━━━━━━━

🐋 고래 감지

• 거래량 3배+ & 가격변동 0.5%+
• BUY = 파란 라벨
• SELL = 보라 라벨

━━━━━━━━━━━━━━━━

🧠 심리적 구간 (NEW!)

• 📍라운드넘버 = 심리적 지지/저항
• ⚡POC = 거래량 집중점 (강력!)
• 🔺고점/🔻저점 = 스윙 레벨
• 😱공포/🤑탐욕 = 매수/매도 타이밍

→ 상세: /심리

━━━━━━━━━━━━━━━━

🔔 알림: /알림
🎯 권장: 🚀⭐ 시그널만 거래!

❓ 문의: @pointting`;
  }

  // /알림
  else if (command === '/alert' || command === '/알림') {
    responseText = `🔔 V39 알림 설정 가이드

━━━━━━━━━━━━━━━━

📌 알림 생성 방법

1️⃣ 차트에서 알림 아이콘 (종) 클릭
   또는 단축키: Alt + A

2️⃣ 조건 설정:
   • 첫 번째: V39 MTF Confluence Pro
   • 두 번째: "모든 alert() 함수 호출"

━━━━━━━━━━━━━━━━

⚠️ 중요!

"돌파", "보다큼", "보다작은" 등
선택하면 안됩니다!

반드시 👇
"모든 alert() 함수 호출" 선택!

━━━━━━━━━━━━━━━━

⏰ 만료 설정

• 권장: 무기한 (Open-ended)
• 또는: 원하는 기간 선택

━━━━━━━━━━━━━━━━

📊 권장 타임프레임

• 데이트레이딩: 15분봉
• 스윙: 1시간봉

━━━━━━━━━━━━━━━━

❓ 문의: @pointting`;
  }

  // /체크리스트
  else if (command === '/checklist' || command === '/체크리스트') {
    responseText = `✅ LONG 진입 체크리스트

━━━━━━━━━━━━━━━━

□ 시그널: STRONG 이상?
□ 1H 추세: UP?
□ 4H 추세: UP?
□ 위치: 20% 이하?
□ Smart Trail: 라임색?
□ 등급: B+ (16점) 이상?

━━━━━━━━━━━━━━━━

📌 6개 중 5개 이상 → 진입 OK

━━━━━━━━━━━━━━━━

🚫 절대 금지

• 1H/4H DOWN일 때 진입
• 위치 80% 이상 추격
• EXIT 시그널 무시

━━━━━━━━━━━━━━━━

⚠️ 시그널 ≠ 100% 수익 보장
   모든 결정은 본인 책임!`;
  }

  // /청산
  else if (command === '/exit' || command === '/청산') {
    responseText = `🚨 청산 가이드

━━━━━━━━━━━━━━━━

⚡ 즉시 청산

• EXIT LONG (빨간 X)
• Smart Trail 빨간색 전환
• 점수 15점 미만 하락

━━━━━━━━━━━━━━━━

⚠️ 주의 (부분 청산)

• Trail Warning (주황 원)
• 1H 추세 DOWN 전환

━━━━━━━━━━━━━━━━

💡 EXIT = 즉시 청산!
"조금 더" = 큰 손실

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;
  }

  // /등급
  else if (command === '/grade' || command === '/등급') {
    responseText = `📊 V39 등급 시스템

━━━━━━━━━━━━━━━━

🏆 S등급 (22점+) → 적극 진입!
⭐ A+등급 (22점+) → 매우 강력
🅰️ A등급 (19점+) → 강력
✅ B+등급 (16점+) → 좋음
🔵 B등급 (15점+) → 진입 가능
⚪ C등급 (15점 미만) → 대기

━━━━━━━━━━━━━━━━

💡 권장: B+ 이상만 거래

📊 점수 구성 (30점)
• 추세: 8점
• 모멘텀: 8점
• 거래량: 6점
• 구조: 8점

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;
  }

  // /고래
  else if (command === '/whale' || command === '/고래') {
    responseText = `🐋 V39 거래량 등급 시스템

━━━━━━━━━━━━━━━━

📊 해양생물 등급 분류

🐋 WHALE (고래)
• 거래량: 10배 이상
• 프리미엄 전용 🔒

🦈 SHARK (상어)
• 거래량: 7~10배
• 프리미엄 전용 🔒

🐬 DOLPHIN (돌고래)
• 거래량: 5~7배
• 무료방 알림: ✅

🐟 FISH (물고기)
• 거래량: 3~5배
• 무료방 알림: ✅

🦀 CRAB (게)
• 거래량: 2~3배
• 무료방 알림: ✅

🦐 SHRIMP (새우)
• 거래량: 1.5~2배
• 무료방 알림: ✅

━━━━━━━━━━━━━━━━

🎯 무료방 알림 조건

• 새우~돌고래 등급만
• 상어/고래 = 프리미엄 전용

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;
  }

  // /심리
  else if (command === '/심리' || command === '/psych' || command === '/psychology') {
    responseText = `🧠 V39 심리적 매매 구간

━━━━━━━━━━━━━━━━

📍 라운드 넘버

• $90,000 / $95,000 / $100,000...
• 많은 트레이더가 주문 넣는 가격
• 파란 점선으로 표시
• 지지/저항으로 자주 작용

━━━━━━━━━━━━━━━━

⚡ POC (거래량 집중점)

• 가장 거래 많았던 가격대
• 노란 굵은 선 + 박스
• 강력한 지지/저항!
• 기관/고래 관심 가격

📌 활용법:
• 가격이 POC 위 → 지지선
• 가격이 POC 아래 → 저항선

━━━━━━━━━━━━━━━━

🔺🔻 주요 고점/저점

• 빨간선 = 이전 고점 (저항)
• 초록선 = 이전 저점 (지지)
• 돌파 시 강한 움직임 예상

━━━━━━━━━━━━━━━━

😱🤑 공포/탐욕 지표

• 미니패널 "심리" 행에 표시
• 😱 극단적 공포 = 매수 기회!
• 🤑 극단적 탐욕 = 매도 고려

점수 범위:
• -100 ~ -60: 극단적 공포 🟢
• -60 ~ -30: 공포
• -10 ~ +10: 중립
• +30 ~ +60: 탐욕
• +60 ~ +100: 극단적 탐욕 🔴

━━━━━━━━━━━━━━━━

🎯 매매 활용

✅ 매수 유리:
• 공포 + 라운드 지지 근처
• POC 근처에서 반등
• 저점 지지 확인

⛔ 매수 주의:
• 탐욕 + 라운드 저항 근처
• 고점 저항 확인

━━━━━━━━━━━━━━━━

💡 세부 명령어
/poc /라운드 /고점저점 /공포탐욕

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;
  }

  // /poc - POC 설명만
  else if (command === '/poc') {
    responseText = `⚡ POC (Point of Control)

━━━━━━━━━━━━━━━━

📊 POC란?

• 가장 거래량이 많았던 가격대
• Volume Profile의 핵심 레벨
• 기관/고래가 관심 가지는 가격

━━━━━━━━━━━━━━━━

👀 차트에서 확인

• 노란색 굵은 선 (━)
• 노란색 박스 영역
• 가격 레이블 표시

━━━━━━━━━━━━━━━━

🎯 활용법

현재가 > POC:
→ POC = 지지선
→ 하락 시 반등 기대점

현재가 < POC:
→ POC = 저항선
→ 상승 시 저항 예상점

━━━━━━━━━━━━━━━━

💡 매매 전략

✅ 롱 진입:
• POC 근처에서 지지 확인
• POC 위에서 눌림목 매수

⚠️ 주의:
• POC 이탈 시 손절 고려
• POC 돌파 실패 = 추세 전환 신호

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;
  }

  // /라운드 - 라운드 넘버 설명
  else if (command === '/라운드' || command === '/round') {
    responseText = `📍 라운드 넘버 (Round Number)

━━━━━━━━━━━━━━━━

📊 라운드 넘버란?

• $90,000 / $95,000 / $100,000...
• 심리적으로 중요한 "딱 떨어지는" 가격
• 많은 트레이더가 주문 설정하는 가격

━━━━━━━━━━━━━━━━

👀 차트에서 확인

• 파란 점선 (----)
• 5000단위 표시
• 라벨로 가격 표시

━━━━━━━━━━━━━━━━

🎯 왜 중요한가?

1. 심리적 장벽
   → "10만 달러 돌파!" 뉴스 효과

2. 주문 집중
   → TP/SL이 몰리는 구간

3. 자기실현적 예언
   → 많은 사람이 주목 → 실제로 작용

━━━━━━━━━━━━━━━━

💡 매매 전략

✅ 지지로 활용:
• 라운드 넘버 근처 롱 진입
• 손절은 라운드 아래

⚠️ 저항으로 주의:
• 라운드 근처 도달 시 익절 고려
• 돌파 후 되돌림 매매

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;
  }

  // /고점저점 - 고점/저점 설명
  else if (command === '/고점저점' || command === '/hl' || command === '/highlow') {
    responseText = `🔺🔻 주요 고점/저점

━━━━━━━━━━━━━━━━

📊 고점/저점이란?

• 최근 스윙의 최고가/최저가
• 시장 구조의 핵심 레벨
• 돌파 시 추세 확인

━━━━━━━━━━━━━━━━

👀 차트에서 확인

🔴 빨간선 = 이전 고점 (저항)
🟢 초록선 = 이전 저점 (지지)

━━━━━━━━━━━━━━━━

🎯 시장 구조 해석

📈 상승 구조:
• HH (Higher High) = 더 높은 고점
• HL (Higher Low) = 더 높은 저점
→ 롱 유리

📉 하락 구조:
• LH (Lower High) = 더 낮은 고점
• LL (Lower Low) = 더 낮은 저점
→ 숏 유리

━━━━━━━━━━━━━━━━

💡 매매 전략

✅ 롱 진입:
• 저점(초록선) 지지 확인 후
• HH/HL 구조에서 HL 매수

⚠️ 손절:
• 이전 저점 이탈 시
• 구조 붕괴 = 추세 전환

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;
  }

  // /공포탐욕 - 공포/탐욕 지표 설명
  else if (command === '/공포탐욕' || command === '/fear' || command === '/greed' || command === '/fg') {
    responseText = `😱🤑 공포/탐욕 지표

━━━━━━━━━━━━━━━━

📊 공포/탐욕이란?

• 시장 심리를 수치화한 지표
• 극단적 감정 = 반전 기회
• 미니패널 "심리" 행에 표시

━━━━━━━━━━━━━━━━

📏 점수 범위

-100 ~ -60: 😱 극단적 공포 🟢
-60 ~ -30:  😰 공포
-30 ~ -10:  😐 약간 공포
-10 ~ +10:  😶 중립
+10 ~ +30:  🙂 약간 탐욕
+30 ~ +60:  🤑 탐욕
+60 ~ +100: 🤑 극단적 탐욕 🔴

━━━━━━━━━━━━━━━━

🎯 역발상 매매

😱 극단적 공포 (-60 이하):
• "공포에 매수"
• 다른 사람이 패닉 = 기회
→ 롱 진입 고려

🤑 극단적 탐욕 (+60 이상):
• "탐욕에 매도"
• 과열 상태 = 조정 임박
→ 익절 또는 숏 고려

━━━━━━━━━━━━━━━━

💡 V39 활용

✅ 최적 롱 조건:
• 공포 + DISC 구간
• 공포 + POC 지지
• 공포 + 라운드 넘버 지지

⚠️ 롱 주의 조건:
• 탐욕 + PREM 구간
• 탐욕 + 고점 저항

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;
  }

  // /호가 (오더북 분석)
  else if (command === '/호가' || command === '/orderbook' || command === '/ob') {
    responseText = await handleOrderbookCommand(coinInput);
  }

  // /패턴 (유사 패턴 분석)
  else if (command === '/패턴' || command === '/pattern' || command === '/pt') {
    responseText = await handlePatternCommand(coinInput);
  }

  // /smc
  else if (command === '/smc') {
    responseText = `🧠 V39 SMC (Smart Money)

━━━━━━━━━━━━━━━━

🎯 핵심 시그널

🚀 SUPER LONG = 무조건 진입!
⭐ STRONG LONG = 강력 추천
💀 SUPER SHORT = 무조건 숏!
⚠️ STRONG SHORT = 강력 숏

━━━━━━━━━━━━━━━━

🐋 고래 감지

• 거래량 3배 이상
• 가격변동 0.5% 이상
• 🐋BUY = 고래 매수 (파랑)
• 🐋SELL = 고래 매도 (보라)

━━━━━━━━━━━━━━━━

📈 Smart Trail

• 라임색 = LONG 유리
• 빨간색 = SHORT 유리

🎯 Zone
• DISC = 매수 적합 (하단)
• PREM = 매도 적합 (상단)

━━━━━━━━━━━━━━━━

📊 시장 구조 (설정에서 ON)

• HH/HL = 상승 구조
• LH/LL = 하락 구조
• BOS+/- = 구조 돌파
• CHoCH = 추세 전환

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;
  }

  // /설정
  else if (command === '/settings' || command === '/설정') {
    responseText = `⚙️ V39 권장 설정

━━━━━━━━━━━━━━━━

📊 타임프레임: 15분 / 1시간
🔔 시그널: STRONG 이상
📱 화면: 최소화

━━━━━━━━━━━━━━━━

📈 거래량 설정
• 급증: 1.5x
• 폭증: 2.5x

━━━━━━━━━━━━━━━━

💡 팁: LONG만 거래 권장

🔔 알림 설정: /알림

⚠️ 참고용 - 투자권유 아님`;
  }

  // /경제 - 경제 캘린더
  else if (command === '/경제' || command === '/economy' || command === '/calendar' || command === '/cal') {
    responseText = await handleEconomicCommand();
  }

  // /도움말
  else if (command === '/help' || command === '/도움말') {
    let helpText = `🤖 V39 Premium 명령어

━━━━━━━━━━━━━━━━

📊 AI 차트 분석

/a1m - 1분봉
/a5m - 5분봉
/a15m - 15분봉
/a30m - 30분봉
/a1h - 1시간봉
/a4h - 4시간봉
/a1d - 일봉

💡 /a15m ETH → ETH 분석
🪙 모든 코인 지원!

━━━━━━━━━━━━━━━━

📚 V39 지표 가이드

/가이드 - 핵심 가이드
/알림 - 알림 설정 방법 ⭐
/체크리스트 - 진입 조건
/청산 - 청산 가이드
/등급 - 등급 설명
/고래 - 고래 등급 설명 ⭐
/심리 - 심리적 구간 설명 ⭐
/smc - SMC/구조 설명
/설정 - 권장 설정

📍 세부 설명
/poc - POC 거래량 집중점
/라운드 - 라운드 넘버
/고점저점 - 고점/저점 구조
/공포탐욕 - 공포/탐욕 지표

━━━━━━━━━━━━━━━━

🔥 실시간 분석 (Bitget/OKX)

/호가 BTC - 호가창 매수/매도벽
/패턴 BTC - 유사 패턴 분석 🆕

💡 모든 코인 지원!
예: /패턴 ETH, /호가 SOL

📈 패턴 분석 정보:
• 현재 거래량/위치/추세
• 유사 패턴 상승 확률
• 평균 변화폭 예측

━━━━━━━━━━━━━━━━

📅 경제 캘린더 🆕

/경제 - 이번 주 주요 경제 일정
  • FOMC, CPI, NFP 등
  • 암호화폐 영향 분석
  • 상승/하락 조건 해석

━━━━━━━━━━━━━━━━

📢 무료 시그널: @V38_Signal

💬 문의: @pointting`;

    if (chatId === ADMIN_ID) {
      helpText += `

━━━━━━━━━━━━━━━━

🔐 관리자 명령어

/premium4h - 프리미엄 4시간 분석
/sendhelp - 프리미엄 도움말 발송
/broadcast [메시지] - 무료채널 발송`;
    }

    responseText = helpText;
  }

  // 관리자: /premium4h
  else if ((command === '/premium4h' || command === '/프리미엄분석') && chatId === ADMIN_ID) {
    responseText = await handlePremium4H();
  }

  // 관리자: /sendhelp
  else if ((command === '/sendhelp' || command === '/도움말발송') && chatId === ADMIN_ID) {
    await sendPremiumHelp();
    responseText = `✅ 도움말이 프리미엄 그룹에 발송되었습니다!`;
  }

  // 관리자: /broadcast
  else if (command === '/broadcast' && chatId === ADMIN_ID) {
    const broadcastMsg = text.replace('/broadcast', '').trim();
    if (broadcastMsg) {
      await sendMessage(FREE_CHANNEL_ID, broadcastMsg);
      responseText = `✅ 무료 채널에 발송 완료!`;
    } else {
      responseText = `❌ 사용법: /broadcast [메시지]`;
    }
  }

  if (responseText) {
    await sendMessage(chatId, responseText);
  }
}

// ============================================
// AI 분석 함수 - 재시도 로직 포함
// ============================================
async function handleAIAnalysis(command, coinInput) {
  const tfMap = {
    '/a1m': { tf: '1분봉', days: '1' },
    '/a5m': { tf: '5분봉', days: '1' },
    '/a15m': { tf: '15분봉', days: '1' },
    '/a30m': { tf: '30분봉', days: '1' },
    '/a1h': { tf: '1시간봉', days: '7' },
    '/a4h': { tf: '4시간봉', days: '14' },
    '/a1d': { tf: '일봉', days: '30' }
  };

  const selected = tfMap[command];
  const coin = coinInput.replace('USDT', '').replace('USD', '');
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const searchUrl = `https://api.coingecko.com/api/v3/search?query=${coin}`;
      const searchRes = await fetch(searchUrl, {
        headers: { 'Accept': 'application/json' }
      });

      if (!searchRes.ok) {
        throw new Error(`검색 API 오류: ${searchRes.status}`);
      }

      const searchData = await searchRes.json();

      if (!searchData.coins || searchData.coins.length === 0) {
        return `❌ "${coin}" 코인을 찾을 수 없습니다.

💡 정확한 심볼을 입력해주세요.
예: /a15m BTC, /a1h ETH`;
      }

      const coinId = searchData.coins[0].id;
      const coinName = searchData.coins[0].name;
      const coinSymbol = searchData.coins[0].symbol.toUpperCase();

      const cgUrl = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${selected.days}`;
      const response = await fetch(cgUrl, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`데이터 API 오류: ${response.status}`);
      }

      const data = await response.json();

      if (!data.prices || data.prices.length === 0) {
        throw new Error('가격 데이터 없음');
      }

    const prices = data.prices.map(p => p[1]);
    const currentPrice = prices[prices.length - 1];
    const openPrice = prices[0];

    const ema9 = prices.slice(-9).reduce((a, b) => a + b, 0) / Math.min(9, prices.length);
    const ema21 = prices.slice(-21).reduce((a, b) => a + b, 0) / Math.min(21, prices.length);
    const trend = ema9 > ema21 ? "상승" : "하락";
    const changePercent = ((currentPrice - openPrice) / openPrice * 100).toFixed(2);

    let gains = 0, losses = 0;
    const recentPrices = prices.slice(-15);
    for (let i = 1; i < recentPrices.length; i++) {
      const change = recentPrices[i] - recentPrices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const rs = gains / Math.max(losses, 0.0001);
    const rsi = 100 - (100 / (1 + rs));

    const high = Math.max(...prices.slice(-50));
    const low = Math.min(...prices.slice(-50));
    const position = ((currentPrice - low) / (high - low) * 100).toFixed(0);

    const formatPrice = (price) => {
      if (price < 0.00000001) return price.toFixed(12);
      if (price < 0.0001) return price.toFixed(8);
      if (price < 0.01) return price.toFixed(6);
      if (price < 1) return price.toFixed(4);
      if (price < 100) return price.toFixed(3);
      return price.toFixed(2);
    };

    const prompt = `V39 MTF Confluence Pro 기준 암호화폐 분석:

코인: ${coinSymbol} (${coinName})
타임프레임: ${selected.tf}
현재가: ${formatPrice(currentPrice)}
변동률: ${changePercent}%
EMA9: ${formatPrice(ema9)} / EMA21: ${formatPrice(ema21)}
추세: ${trend}
RSI: ${rsi.toFixed(1)}
고가: ${formatPrice(high)} / 저가: ${formatPrice(low)}
가격위치: ${position}%

다음 형식으로 분석 (투자권유 아님 명시):

📊 ${coinSymbol} ${selected.tf} 분석
━━━━━━━━━━━━━━━━
💰 현재가: $xxx (${changePercent > 0 ? '+' : ''}xx%)
📈 추세: 상승/하락 (EMA정렬 여부)
📊 RSI: xx (과매수/과매도/중립)
📍 지지: $xxx | 저항: $xxx
📍 위치: xx% (지지근처/중간/저항근처)
🎯 V39 관점: 진입조건 충족 여부, 권장 행동
⚠️ [참고용-투자권유아님]`;

    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    const gptData = await gptResponse.json();

      if (gptData.choices && gptData.choices[0]) {
        return gptData.choices[0].message.content;
      } else {
        return `📊 ${coinSymbol} ${selected.tf} 분석

━━━━━━━━━━━━━━━━

💰 현재가: ${formatPrice(currentPrice)} (${changePercent}%)
📈 추세: ${trend}
📊 RSI: ${rsi.toFixed(1)}
📍 위치: ${position}%

${ema9 > ema21 ? '🟢 상승 추세' : '🔴 하락 추세'}

⚠️ [참고용-투자권유아님]`;
      }

    } catch (error) {
      console.log(`AI 분석 시도 ${attempt}/${maxRetries} 실패: ${error.message}`);

      if (attempt === maxRetries) {
        return `❌ 분석 오류 (${error.message})

잠시 후 다시 시도해주세요.
예: /a15m BTC`;
      }

      // 다음 시도 전 1초 대기
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ============================================
// 프리미엄 4시간 분석
// ============================================
async function handlePremium4H() {
  try {
    const cgUrl = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7`;
    const response = await fetch(cgUrl);
    const data = await response.json();

    const prices = data.prices.map(p => p[1]);
    const currentPrice = prices[prices.length - 1];
    const price24hAgo = prices[Math.max(0, prices.length - 6)];
    const changePercent = ((currentPrice - price24hAgo) / price24hAgo * 100).toFixed(2);

    const ema9 = prices.slice(-9).reduce((a, b) => a + b, 0) / 9;
    const ema21 = prices.slice(-21).reduce((a, b) => a + b, 0) / 21;
    const ema50 = prices.slice(-50).reduce((a, b) => a + b, 0) / 50;
    const trend = ema9 > ema21 ? "상승" : "하락";

    let gains = 0, losses = 0;
    const recentPrices = prices.slice(-15);
    for (let i = 1; i < recentPrices.length; i++) {
      const change = recentPrices[i] - recentPrices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const rs = gains / Math.max(losses, 0.0001);
    const rsi = (100 - (100 / (1 + rs))).toFixed(1);

    const high = Math.max(...prices.slice(-50));
    const low = Math.min(...prices.slice(-50));
    const position = ((currentPrice - low) / (high - low) * 100).toFixed(0);

    const now = new Date();
    const kstHours = (now.getUTCHours() + 9) % 24;
    const timeStr = `${kstHours.toString().padStart(2, '0')}:00`;

    let score = 15;
    if (ema9 > ema21) score += 3;
    if (ema21 > ema50) score += 2;
    if (rsi < 40) score += 2;
    if (position < 30) score += 3;

    const grade = score >= 22 ? 'S' : score >= 19 ? 'A' : score >= 16 ? 'B+' : 'B';

    const premiumAnalysis = `🔒 프리미엄 4시간 분석 (${timeStr} KST)

━━━━━━━━━━━━━━━━

💰 BTC: $${currentPrice.toFixed(0)} (${changePercent > 0 ? '+' : ''}${changePercent}%)

━━━━━━━━━━━━━━━━

📊 상세 분석

• 추세: ${trend} ${ema9 > ema21 && ema21 > ema50 ? '(강한 상승)' : ''}
• EMA9: $${ema9.toFixed(0)}
• EMA21: $${ema21.toFixed(0)}
• EMA50: $${ema50.toFixed(0)}

━━━━━━━━━━━━━━━━

📈 지표 현황

• RSI: ${rsi} ${rsi > 70 ? '⚠️' : rsi < 30 ? '✅' : ''}
• 위치: ${position}%
• 등급: ${grade} (${score}점)

━━━━━━━━━━━━━━━━

🎯 V39 매매 관점

${score >= 16 ? '✅ 롱 진입 가능 구간' : '⚠️ 관망 권장'}
${position < 30 ? '✅ DISCOUNT 구간' : position > 70 ? '⚠️ PREMIUM 구간' : '• 중립 구간'}

📌 진입 시 확인사항:
• Smart Trail 라임색?
• 1H/4H 추세 UP?
• 거래량 급증?

━━━━━━━━━━━━━━━━

📍 주요 가격대

• 저항: $${high.toFixed(0)}
• 지지: $${low.toFixed(0)}
• TP1: $${(currentPrice * 1.01).toFixed(0)} (+1%)
• TP2: $${(currentPrice * 1.02).toFixed(0)} (+2%)
• SL: $${(currentPrice * 0.98).toFixed(0)} (-2%)

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;

    await sendMessage(PREMIUM_GROUP_ID, premiumAnalysis);
    await sendMessage(PREMIUM_GROUP_ID_2, premiumAnalysis);

    return `✅ 프리미엄 4시간 분석이 발송되었습니다!`;
  } catch (error) {
    return `❌ 분석 생성 실패. 다시 시도해주세요.`;
  }
}

// ============================================
// 프리미엄 도움말 발송
// ============================================
async function sendPremiumHelp() {
  const helpDoc = `📚 V39 MTF Confluence Pro 사용법

━━━━━━━━━━━━━━━━

🎯 핵심 시그널

🚀 SUPER LONG - 최고 확신!
⭐ STRONG LONG - 강력 추천
💀 SUPER SHORT - 숏 확신
⚠️ STRONG SHORT - 숏 추천
🐋 WHALE - 고래 매수/매도

━━━━━━━━━━━━━━━━

✅ LONG 진입 조건

1. 시그널: 🚀 또는 ⭐
2. 미니패널: ▲ LONG (라임)
3. 1H/4H: 둘 다 UP
4. 위치: 30% 이하 (DISC)
5. Smart Trail: 라임색
6. 등급: B+ (16점) 이상

📌 6개 중 5개 이상 → 진입!

━━━━━━━━━━━━━━━━

🚫 진입 금지 상황

• 미니패널: — WAIT
• 1H 또는 4H: DOWN
• 위치: 70% 이상
• Smart Trail: 빨간색
• 등급: C

━━━━━━━━━━━━━━━━

🚨 청산 타이밍

• EXIT LONG (❌) → 즉시 청산!
• Trail Warning (⚠️) → 부분 청산
• Smart Trail 빨강 전환 → 청산 준비

━━━━━━━━━━━━━━━━

📊 등급 시스템

🏆 S등급 (22+) - 적극 진입
⭐ A등급 (19+) - 강력
✅ B+등급 (16+) - 좋음
🔵 B등급 (15+) - 가능
⚪ C등급 (-15) - 대기

━━━━━━━━━━━━━━━━

📱 미니패널 해석

▲ LONG (라임)
→ Trail↑ + 1H↑ + 15점+

▼ SHORT (빨강)
→ Trail↓ + 1H↓ + 위치70%+

— WAIT (회색)
→ 조건 미충족, 대기!

━━━━━━━━━━━━━━━━

🐋 거래량 등급 시스템

🐋 WHALE (10x+) - 고래 🔒
🦈 SHARK (7-10x) - 상어 🔒
🐬 DOLPHIN (5-7x) - 돌고래 ✅
🐟 FISH (3-5x) - 물고기 ✅
🦀 CRAB (2-3x) - 게 ✅
🦐 SHRIMP (1.5-2x) - 새우 ✅

🔒 = 프리미엄 전용
✅ = 무료방 알림

━━━━━━━━━━━━━━━━

📊 AI 분석 명령어

/a1m - 1분봉 분석
/a5m - 5분봉 분석
/a15m - 15분봉 분석
/a30m - 30분봉 분석
/a1h - 1시간봉 분석
/a4h - 4시간봉 분석
/a1d - 일봉 분석

💡 /a15m ETH → ETH 분석

━━━━━━━━━━━━━━━━

🔥 실시간 분석

/호가 BTC - 호가창 매수/매도벽
/패턴 BTC - 유사 패턴 분석

💡 모든 코인 지원!
예: /패턴 ETH, /호가 SOL

━━━━━━━━━━━━━━━━

📅 경제 캘린더 🆕

/경제 - 이번 주 경제 일정
  • FOMC, CPI, NFP 등
  • 암호화폐 영향 분석
  • 상승/하락 조건 해석

📌 자동 발송:
• 매주 월요일 09시 (주간)
• 매월 1일 09시 (월간)

━━━━━━━━━━━━━━━━

📖 지표 가이드

/가이드 - 핵심 가이드
/알림 - 알림 설정
/체크리스트 - 진입 조건
/청산 - 청산 가이드
/등급 - 등급 설명
/고래 - 고래 등급
/심리 - 심리적 구간
/smc - SMC/구조 설명

━━━━━━━━━━━━━━━━

⚠️ 주의사항

• 시그널 ≠ 100% 수익 보장
• 모든 투자 결정은 본인 책임
• LONG만 권장 (SHORT 승률 낮음)
• EXIT 시그널 시 즉시 청산

━━━━━━━━━━━━━━━━

📢 무료 시그널: @V38_Signal
❓ 문의: @pointting`;

  await sendMessage(PREMIUM_GROUP_ID, helpDoc);
  await sendMessage(PREMIUM_GROUP_ID_2, helpDoc);
}

// ============================================
// TradingView 알람 처리 (무료 채널 - 새우~돌고래)
// + 오더북 분석 결합
// ============================================
async function handleTradingViewAlert(alertText) {
  try {
    // 등급별 필터링 (새우~돌고래만 무료 채널에 전달, 상어/고래 제외)
    const isWhale = alertText.includes('🐋WHALE');
    const isShark = alertText.includes('🦈SHARK');
    const isDolphin = alertText.includes('🐬DOLPHIN');
    const isFish = alertText.includes('🐟FISH');
    const isCrab = alertText.includes('🦀CRAB');
    const isShrimp = alertText.includes('🦐SHRIMP');

    // 새우~돌고래만 (상어, 고래 제외)
    const isFreeTier = isDolphin || isFish || isCrab || isShrimp;
    const isBuy = alertText.includes('매수');
    const isSell = alertText.includes('매도');

    // 시그널 종류 파악
    const isSuperLong = alertText.includes('SUPER LONG') || alertText.includes('🚀');
    const isStrongLong = alertText.includes('STRONG LONG') || alertText.includes('⭐');
    const isPremiumSignal = isSuperLong || isStrongLong || isWhale || isShark;

    // 프리미엄 시그널이면 오더북 분석 추가
    let orderbookInfo = '';
    if (isPremiumSignal && isBuy) {
      // 심볼 추출 (기본 BTC)
      let symbol = 'BTCUSDT';
      const symbolMatch = alertText.match(/([A-Z]{2,10})\/USDT/);
      if (symbolMatch) {
        symbol = symbolMatch[1] + 'USDT';
      }

      const orderbook = await getBitgetOrderbook(symbol, 20);
      if (orderbook) {
        const analysis = analyzeOrderbook(orderbook);
        if (analysis) {
          const imbalanceEmoji = parseFloat(analysis.imbalanceRatio) > 0 ? '📈' : '📉';
          let signalEmoji = '⚪';
          let signalText = '중립';

          if (analysis.entrySignal === 'LONG') {
            signalEmoji = '🟢';
            signalText = '롱 유리';
          } else if (analysis.entrySignal === 'LONG_WEAK') {
            signalEmoji = '🟡';
            signalText = '약한 롱';
          } else if (analysis.entrySignal === 'SHORT') {
            signalEmoji = '🔴';
            signalText = '숏 유리 ⚠️';
          } else if (analysis.entrySignal === 'SHORT_WEAK') {
            signalEmoji = '🟠';
            signalText = '약한 숏';
          }

          orderbookInfo = `
━━━━━━━━━━━━━━━━
📊 실시간 호가창 분석

${imbalanceEmoji} 불균형: ${analysis.imbalanceRatio}%
🔵 매수: ${analysis.totalBidQty} | 🔴 매도: ${analysis.totalAskQty}
🧱 매수벽: ${analysis.bidWalls.length}개 | 매도벽: ${analysis.askWalls.length}개
${signalEmoji} 호가 판단: ${signalText}`;
        }
      }
    }

    if (isFreeTier && (isBuy || isSell)) {
      // 등급에 따른 메시지
      let tierEmoji = '🦐';
      let tierName = '새우';
      if (isDolphin) { tierEmoji = '🐬'; tierName = '돌고래'; }
      else if (isFish) { tierEmoji = '🐟'; tierName = '물고기'; }
      else if (isCrab) { tierEmoji = '🦀'; tierName = '게'; }

      const action = isBuy ? '매수' : '매도';

      const freeChannelMsg = `${tierEmoji} ${tierName} ${action} 감지!

${alertText}

━━━━━━━━━━━━━━━━
📢 @V38_Signal
🤖 @V30_Signal_bot`;

      await sendMessage(FREE_CHANNEL_ID, freeChannelMsg);
    }

    // 프리미엄 시그널은 프리미엄 그룹에 오더북 정보와 함께 발송
    if (isPremiumSignal && (isBuy || isSell)) {
      const premiumMsg = `${alertText}${orderbookInfo}

━━━━━━━━━━━━━━━━
🔒 프리미엄 전용`;

      await sendMessage(PREMIUM_GROUP_ID, premiumMsg);
      await sendMessage(PREMIUM_GROUP_ID_2, premiumMsg);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// 메시지 발송 헬퍼
// ============================================
async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });
}

// ============================================
// 비트겟 오더북 API
// ============================================

async function getBitgetOrderbook(symbol = 'BTCUSDT', limit = 20) {
  try {
    const url = `https://api.bitget.com/api/v2/mix/market/merge-depth?symbol=${symbol}&productType=USDT-FUTURES&limit=${limit}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== '00000') {
      throw new Error(data.msg || '알 수 없는 오류');
    }

    return data.data;
  } catch (error) {
    console.error('오더북 조회 실패:', error);
    return null;
  }
}

// ============================================
// 오더북 분석 함수
// ============================================

function analyzeOrderbook(orderbook) {
  if (!orderbook || !orderbook.asks || !orderbook.bids) {
    return null;
  }

  const asks = orderbook.asks.map(a => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) }));
  const bids = orderbook.bids.map(b => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) }));

  // 총 매수/매도 수량
  const totalBidQty = bids.reduce((sum, b) => sum + b.qty, 0);
  const totalAskQty = asks.reduce((sum, a) => sum + a.qty, 0);

  // 불균형 비율 (양수 = 매수 우세, 음수 = 매도 우세)
  const imbalanceRatio = ((totalBidQty - totalAskQty) / (totalBidQty + totalAskQty) * 100).toFixed(1);

  // 매수벽/매도벽 감지 (평균의 3배 이상)
  const avgBidQty = totalBidQty / bids.length;
  const avgAskQty = totalAskQty / asks.length;

  const bidWalls = bids.filter(b => b.qty >= avgBidQty * 3);
  const askWalls = asks.filter(a => a.qty >= avgAskQty * 3);

  // 현재가 (매수1호가와 매도1호가 중간)
  const bestBid = bids[0]?.price || 0;
  const bestAsk = asks[0]?.price || 0;
  const midPrice = (bestBid + bestAsk) / 2;
  const spread = ((bestAsk - bestBid) / midPrice * 100).toFixed(4);

  // 매수1호가 수량 vs 매도1호가 수량
  const topBidQty = bids[0]?.qty || 0;
  const topAskQty = asks[0]?.qty || 0;
  const topImbalance = topBidQty > topAskQty * 2 ? 'BID' : topAskQty > topBidQty * 2 ? 'ASK' : 'NEUTRAL';

  // 진입 유리 판단
  let entrySignal = 'NEUTRAL';
  let entryReason = '';

  if (parseFloat(imbalanceRatio) > 20 && bidWalls.length > 0 && topImbalance === 'BID') {
    entrySignal = 'LONG';
    entryReason = '매수벽 + 매수 우세';
  } else if (parseFloat(imbalanceRatio) > 10 && topImbalance === 'BID') {
    entrySignal = 'LONG_WEAK';
    entryReason = '약한 매수 우세';
  } else if (parseFloat(imbalanceRatio) < -20 && askWalls.length > 0 && topImbalance === 'ASK') {
    entrySignal = 'SHORT';
    entryReason = '매도벽 + 매도 우세';
  } else if (parseFloat(imbalanceRatio) < -10 && topImbalance === 'ASK') {
    entrySignal = 'SHORT_WEAK';
    entryReason = '약한 매도 우세';
  } else {
    entryReason = '균형 상태';
  }

  return {
    midPrice,
    spread,
    totalBidQty: totalBidQty.toFixed(2),
    totalAskQty: totalAskQty.toFixed(2),
    imbalanceRatio,
    bidWalls: bidWalls.slice(0, 3),  // 상위 3개
    askWalls: askWalls.slice(0, 3),
    topBidQty: topBidQty.toFixed(4),
    topAskQty: topAskQty.toFixed(4),
    topImbalance,
    entrySignal,
    entryReason
  };
}

// ============================================
// /호가 명령어 처리
// ============================================

async function handleOrderbookCommand(coinInput = 'BTC') {
  const coin = coinInput.toUpperCase().replace('USDT', '').replace('USD', '');
  const symbol = coin + 'USDT';

  const orderbook = await getBitgetOrderbook(symbol, 20);

  if (!orderbook) {
    return `❌ ${symbol} 오더북 조회 실패

잠시 후 다시 시도해주세요.`;
  }

  const analysis = analyzeOrderbook(orderbook);

  if (!analysis) {
    return `❌ 오더북 분석 실패`;
  }

  // 진입 신호 이모지
  let signalEmoji = '⚪';
  let signalText = '중립';
  if (analysis.entrySignal === 'LONG') {
    signalEmoji = '🟢';
    signalText = '롱 유리';
  } else if (analysis.entrySignal === 'LONG_WEAK') {
    signalEmoji = '🟡';
    signalText = '약한 롱';
  } else if (analysis.entrySignal === 'SHORT') {
    signalEmoji = '🔴';
    signalText = '숏 유리';
  } else if (analysis.entrySignal === 'SHORT_WEAK') {
    signalEmoji = '🟠';
    signalText = '약한 숏';
  }

  // 매수벽 정보
  let bidWallsText = '없음';
  if (analysis.bidWalls.length > 0) {
    bidWallsText = analysis.bidWalls
      .map(w => `$${w.price.toFixed(1)} (${w.qty.toFixed(2)} BTC)`)
      .join('\n   ');
  }

  // 매도벽 정보
  let askWallsText = '없음';
  if (analysis.askWalls.length > 0) {
    askWallsText = analysis.askWalls
      .map(w => `$${w.price.toFixed(1)} (${w.qty.toFixed(2)} BTC)`)
      .join('\n   ');
  }

  const imbalanceEmoji = parseFloat(analysis.imbalanceRatio) > 0 ? '📈' : '📉';

  return `📊 ${symbol} 호가창 분석

━━━━━━━━━━━━━━━━

💰 현재가: $${analysis.midPrice.toFixed(1)}
📏 스프레드: ${analysis.spread}%

━━━━━━━━━━━━━━━━

📈 매수 총량: ${analysis.totalBidQty} ${coin}
📉 매도 총량: ${analysis.totalAskQty} ${coin}
${imbalanceEmoji} 불균형: ${analysis.imbalanceRatio}%

━━━━━━━━━━━━━━━━

🔵 매수 1호가: ${analysis.topBidQty} ${coin}
🔴 매도 1호가: ${analysis.topAskQty} ${coin}
⚖️ 1호가 우세: ${analysis.topImbalance === 'BID' ? '매수' : analysis.topImbalance === 'ASK' ? '매도' : '균형'}

━━━━━━━━━━━━━━━━

🧱 매수벽 (지지):
   ${bidWallsText}

🧱 매도벽 (저항):
   ${askWallsText}

━━━━━━━━━━━━━━━━

${signalEmoji} 진입 판단: ${signalText}
💡 ${analysis.entryReason}

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;
}

// ============================================
// TradingView + 오더북 결합 분석
// ============================================

async function analyzeWithOrderbook(alertText) {
  // 시그널 종류 파악
  const isSuperLong = alertText.includes('SUPER LONG') || alertText.includes('🚀');
  const isStrongLong = alertText.includes('STRONG LONG') || alertText.includes('⭐');
  const isLong = isSuperLong || isStrongLong || alertText.includes('LONG');

  if (!isLong) {
    return null;  // 롱 시그널 아니면 패스
  }

  // 심볼 추출 (기본 BTC)
  let symbol = 'BTCUSDT';
  const symbolMatch = alertText.match(/([A-Z]{2,10})\/USDT/);
  if (symbolMatch) {
    symbol = symbolMatch[1] + 'USDT';
  }

  // 오더북 분석
  const orderbook = await getBitgetOrderbook(symbol, 20);
  if (!orderbook) {
    return { confirmed: false, reason: '오더북 조회 실패' };
  }

  const analysis = analyzeOrderbook(orderbook);
  if (!analysis) {
    return { confirmed: false, reason: '오더북 분석 실패' };
  }

  // 오더북이 롱에 유리한지 확인
  const isOrderbookBullish = analysis.entrySignal === 'LONG' || analysis.entrySignal === 'LONG_WEAK';
  const isOrderbookBearish = analysis.entrySignal === 'SHORT' || analysis.entrySignal === 'SHORT_WEAK';

  if (isOrderbookBullish) {
    return {
      confirmed: true,
      strength: analysis.entrySignal === 'LONG' ? 'STRONG' : 'WEAK',
      reason: analysis.entryReason,
      imbalance: analysis.imbalanceRatio,
      bidWalls: analysis.bidWalls.length
    };
  } else if (isOrderbookBearish) {
    return {
      confirmed: false,
      reason: `오더북 매도 우세 (${analysis.imbalanceRatio}%)`,
      imbalance: analysis.imbalanceRatio
    };
  } else {
    return {
      confirmed: 'NEUTRAL',
      reason: '오더북 균형 상태',
      imbalance: analysis.imbalanceRatio
    };
  }
}

// ============================================
// 패턴 분석 기능 (Bitget API 기반)
// ============================================

// OKX에서 과거 캔들 데이터 가져오기
async function getOKXCandles(symbol = 'BTC-USDT', interval = '4H', limit = 200) {
  try {
    // OKX API - 현물 캔들
    const url = `https://www.okx.com/api/v5/market/candles?instId=${symbol}&bar=${interval}&limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('OKX candles API error:', response.status);
      return { error: `API응답오류: ${response.status}` };
    }

    const result = await response.json();

    if (result.code !== '0' || !result.data || !Array.isArray(result.data)) {
      return { error: `API데이터오류: ${result.msg || result.code}` };
    }

    if (result.data.length === 0) {
      return { error: '데이터없음' };
    }

    // OKX 데이터 형식: [timestamp, open, high, low, close, vol, volCcy, volCcyQuote, confirm]
    // 최신 데이터가 먼저 오므로 역순으로 정렬
    const candles = [...result.data].reverse().map(c => ({
      timestamp: parseInt(c[0]),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5]),
      quoteVolume: parseFloat(c[7])
    }));

    return candles;
  } catch (error) {
    console.error('getOKXCandles error:', error);
    return { error: `예외발생: ${error.message}` };
  }
}

// RSI 계산
function calculateRSI(candles, period = 14) {
  if (candles.length < period + 1) return null;

  const changes = [];
  for (let i = 1; i < candles.length; i++) {
    changes.push(candles[i].close - candles[i-1].close);
  }

  let gains = 0, losses = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) gains += changes[i];
    else losses -= changes[i];
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // 전체 캔들에 대해 RSI 계산
  const rsiValues = [];
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues.push(100 - (100 / (1 + rs)));
  }

  return rsiValues;
}

// 이동평균 계산
function calculateSMA(values, period) {
  const result = [];
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += values[i - j];
    }
    result.push(sum / period);
  }
  return result;
}

// 거래량 비율 계산
function calculateVolumeRatio(candles, index, period = 20) {
  if (index < period) return 1;

  let sumVol = 0;
  for (let i = index - period; i < index; i++) {
    sumVol += candles[i].volume;
  }
  const avgVol = sumVol / period;

  return candles[index].volume / avgVol;
}

// 현재 상황 특성 추출
function extractPatternFeatures(candles, index) {
  if (index < 20) return null;

  const current = candles[index];
  const prev = candles[index - 1];

  // 가격 변화율
  const priceChange = ((current.close - prev.close) / prev.close) * 100;

  // 거래량 비율
  const volRatio = calculateVolumeRatio(candles, index, 20);

  // 캔들 특성
  const bodySize = Math.abs(current.close - current.open);
  const totalRange = current.high - current.low;
  const bodyRatio = totalRange > 0 ? bodySize / totalRange : 0;
  const isBullish = current.close > current.open;

  // 위꼬리/아래꼬리
  const upperWick = current.high - Math.max(current.open, current.close);
  const lowerWick = Math.min(current.open, current.close) - current.low;
  const upperWickRatio = totalRange > 0 ? upperWick / totalRange : 0;
  const lowerWickRatio = totalRange > 0 ? lowerWick / totalRange : 0;

  // 최근 5봉 추세
  let upCount = 0;
  for (let i = index - 4; i <= index; i++) {
    if (candles[i].close > candles[i].open) upCount++;
  }

  // 20봉 대비 위치
  let high20 = candles[index].high;
  let low20 = candles[index].low;
  for (let i = index - 19; i < index; i++) {
    high20 = Math.max(high20, candles[i].high);
    low20 = Math.min(low20, candles[i].low);
  }
  const position = high20 !== low20 ? ((current.close - low20) / (high20 - low20)) * 100 : 50;

  return {
    priceChange,
    volRatio,
    bodyRatio,
    isBullish,
    upperWickRatio,
    lowerWickRatio,
    upCount,
    position,
    totalRange: (totalRange / current.close) * 100 // 변동성 (%)
  };
}

// 유사도 점수 계산 (0~100)
function calculateSimilarity(features1, features2) {
  // 각 특성별 가중치
  const weights = {
    volRatio: 25,      // 거래량이 가장 중요
    position: 20,      // 가격 위치
    priceChange: 15,   // 가격 변화
    bodyRatio: 10,     // 캔들 형태
    upCount: 15,       // 추세
    upperWickRatio: 7.5,
    lowerWickRatio: 7.5
  };

  let totalScore = 0;

  // 거래량 비율 유사도 (1~3x 범위에서 비교)
  const volDiff = Math.abs(features1.volRatio - features2.volRatio);
  const volScore = Math.max(0, 100 - volDiff * 30);
  totalScore += volScore * (weights.volRatio / 100);

  // 위치 유사도
  const posDiff = Math.abs(features1.position - features2.position);
  const posScore = Math.max(0, 100 - posDiff);
  totalScore += posScore * (weights.position / 100);

  // 가격 변화 유사도
  const priceDiff = Math.abs(features1.priceChange - features2.priceChange);
  const priceScore = Math.max(0, 100 - priceDiff * 20);
  totalScore += priceScore * (weights.priceChange / 100);

  // 캔들 형태 유사도
  const bodyDiff = Math.abs(features1.bodyRatio - features2.bodyRatio);
  const bodyScore = Math.max(0, 100 - bodyDiff * 100);
  totalScore += bodyScore * (weights.bodyRatio / 100);

  // 추세 유사도
  const trendDiff = Math.abs(features1.upCount - features2.upCount);
  const trendScore = Math.max(0, 100 - trendDiff * 20);
  totalScore += trendScore * (weights.upCount / 100);

  // 꼬리 유사도
  const upperDiff = Math.abs(features1.upperWickRatio - features2.upperWickRatio);
  const lowerDiff = Math.abs(features1.lowerWickRatio - features2.lowerWickRatio);
  totalScore += Math.max(0, 100 - upperDiff * 100) * (weights.upperWickRatio / 100);
  totalScore += Math.max(0, 100 - lowerDiff * 100) * (weights.lowerWickRatio / 100);

  return totalScore;
}

// 유사 패턴 찾기 및 이후 움직임 분석
function findSimilarPatterns(candles, currentFeatures, minSimilarity = 60) {
  const results = [];

  // 최근 20봉은 제외하고 검색 (현재 상황과 겹치지 않도록)
  for (let i = 25; i < candles.length - 25; i++) {
    const pastFeatures = extractPatternFeatures(candles, i);
    if (!pastFeatures) continue;

    const similarity = calculateSimilarity(currentFeatures, pastFeatures);

    if (similarity >= minSimilarity) {
      // 이후 5봉, 10봉, 20봉 움직임 분석
      const price0 = candles[i].close;

      const after5 = i + 5 < candles.length ? candles[i + 5].close : null;
      const after10 = i + 10 < candles.length ? candles[i + 10].close : null;
      const after20 = i + 20 < candles.length ? candles[i + 20].close : null;

      // 최대 상승/하락폭 (10봉 이내)
      let maxUp = 0, maxDown = 0;
      for (let j = i + 1; j <= Math.min(i + 10, candles.length - 1); j++) {
        const change = ((candles[j].high - price0) / price0) * 100;
        const changeLow = ((candles[j].low - price0) / price0) * 100;
        maxUp = Math.max(maxUp, change);
        maxDown = Math.min(maxDown, changeLow);
      }

      results.push({
        index: i,
        date: new Date(candles[i].timestamp).toISOString().split('T')[0],
        similarity,
        features: pastFeatures,
        after5Change: after5 ? ((after5 - price0) / price0) * 100 : null,
        after10Change: after10 ? ((after10 - price0) / price0) * 100 : null,
        after20Change: after20 ? ((after20 - price0) / price0) * 100 : null,
        maxUp,
        maxDown
      });
    }
  }

  // 유사도 높은 순으로 정렬
  results.sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, 15); // 상위 15개만
}

// 패턴 분석 통계 계산
function calculatePatternStats(patterns) {
  if (patterns.length === 0) {
    return { count: 0 };
  }

  let upCount5 = 0, downCount5 = 0;
  let upCount10 = 0, downCount10 = 0;
  let totalChange5 = 0, totalChange10 = 0;
  let totalMaxUp = 0, totalMaxDown = 0;
  let validCount5 = 0, validCount10 = 0;

  for (const p of patterns) {
    if (p.after5Change !== null) {
      validCount5++;
      totalChange5 += p.after5Change;
      if (p.after5Change > 0) upCount5++;
      else downCount5++;
    }

    if (p.after10Change !== null) {
      validCount10++;
      totalChange10 += p.after10Change;
      if (p.after10Change > 0) upCount10++;
      else downCount10++;
    }

    totalMaxUp += p.maxUp;
    totalMaxDown += p.maxDown;
  }

  return {
    count: patterns.length,
    // 5봉 후
    upProb5: validCount5 > 0 ? Math.round((upCount5 / validCount5) * 100) : 0,
    avgChange5: validCount5 > 0 ? (totalChange5 / validCount5).toFixed(2) : 0,
    // 10봉 후
    upProb10: validCount10 > 0 ? Math.round((upCount10 / validCount10) * 100) : 0,
    avgChange10: validCount10 > 0 ? (totalChange10 / validCount10).toFixed(2) : 0,
    // 최대 변동폭
    avgMaxUp: (totalMaxUp / patterns.length).toFixed(2),
    avgMaxDown: (totalMaxDown / patterns.length).toFixed(2)
  };
}

// /패턴 명령어 처리
async function handlePatternCommand(coinInput = 'BTC') {
  const symbol = coinInput.toUpperCase() + '-USDT';  // OKX 형식

  try {
    // 4시간봉 데이터 가져오기 (100개 = 약 16일, OKX 제한)
    const candles = await getOKXCandles(symbol, '4H', 100);

    // 에러 체크
    if (candles && candles.error) {
      return `❌ ${coinInput} 캔들 오류: ${candles.error}`;
    }

    if (!candles || !Array.isArray(candles) || candles.length < 50) {
      return `❌ ${coinInput} 캔들 데이터 부족 (${candles?.length || 0}개)`;
    }

    // 현재 상황 특성 추출
    const currentIndex = candles.length - 1;
    const currentFeatures = extractPatternFeatures(candles, currentIndex);

    if (!currentFeatures) {
      return `❌ 패턴 분석에 필요한 데이터가 부족합니다.`;
    }

    // 유사 패턴 찾기
    const similarPatterns = findSimilarPatterns(candles, currentFeatures, 55);

    // 통계 계산
    const stats = calculatePatternStats(similarPatterns);

    // 현재 상황 설명
    const volStatus = currentFeatures.volRatio >= 2 ? '📈급증' :
                      currentFeatures.volRatio >= 1.5 ? '📊증가' :
                      currentFeatures.volRatio >= 1 ? '보통' : '📉감소';

    const posStatus = currentFeatures.position >= 80 ? '🔴고점권' :
                      currentFeatures.position >= 60 ? '🟠상단' :
                      currentFeatures.position >= 40 ? '🟡중간' :
                      currentFeatures.position >= 20 ? '🟢하단' : '🔵저점권';

    const trendStatus = currentFeatures.upCount >= 4 ? '🚀강상승' :
                        currentFeatures.upCount >= 3 ? '📈상승' :
                        currentFeatures.upCount <= 1 ? '📉하락' : '➡️횡보';

    // 예측 방향
    let prediction = '🟡 중립';
    let confidence = '낮음';

    if (stats.count >= 5) {
      if (stats.upProb10 >= 70) {
        prediction = '🟢 상승 우세';
        confidence = stats.upProb10 >= 80 ? '높음' : '중간';
      } else if (stats.upProb10 <= 30) {
        prediction = '🔴 하락 우세';
        confidence = stats.upProb10 <= 20 ? '높음' : '중간';
      }
    }

    // 응답 메시지 생성
    let response = `📊 ${coinInput} 패턴 분석

━━━━━━━━━━━━━━━━
📍 현재 상황
━━━━━━━━━━━━━━━━

• 거래량: ${currentFeatures.volRatio.toFixed(1)}x ${volStatus}
• 위치: ${currentFeatures.position.toFixed(0)}% ${posStatus}
• 추세: ${currentFeatures.upCount}/5 양봉 ${trendStatus}
• 변동성: ${currentFeatures.totalRange.toFixed(2)}%

━━━━━━━━━━━━━━━━
🔍 유사 패턴 분석 (${stats.count}건)
━━━━━━━━━━━━━━━━
`;

    if (stats.count === 0) {
      response += `\n유사한 패턴을 찾지 못했습니다.\n조건을 완화하여 다시 시도해주세요.`;
    } else {
      response += `
📈 5봉(20시간) 후:
├─ 상승 확률: ${stats.upProb5}%
└─ 평균 변화: ${stats.avgChange5 > 0 ? '+' : ''}${stats.avgChange5}%

📈 10봉(40시간) 후:
├─ 상승 확률: ${stats.upProb10}%
└─ 평균 변화: ${stats.avgChange10 > 0 ? '+' : ''}${stats.avgChange10}%

📊 10봉 내 변동폭:
├─ 평균 최대 상승: +${stats.avgMaxUp}%
└─ 평균 최대 하락: ${stats.avgMaxDown}%

━━━━━━━━━━━━━━━━
🎯 예측: ${prediction}
📊 신뢰도: ${confidence} (샘플 ${stats.count}건)
━━━━━━━━━━━━━━━━`;

      // 상위 3개 유사 패턴 표시
      if (similarPatterns.length > 0) {
        response += `\n\n📅 유사 패턴 TOP3:`;
        for (let i = 0; i < Math.min(3, similarPatterns.length); i++) {
          const p = similarPatterns[i];
          response += `\n${i+1}. ${p.date} (${p.similarity.toFixed(0)}%) → ${p.after10Change > 0 ? '+' : ''}${p.after10Change?.toFixed(1) || '?'}%`;
        }
      }
    }

    response += `\n\n⚠️ 참고용 - 과거가 미래를 보장하지 않음`;

    return response;

  } catch (error) {
    console.error('handlePatternCommand error:', error);
    return `❌ 패턴 분석 중 오류가 발생했습니다: ${error.message}`;
  }
}

// ============================================
// 경제 캘린더 기능
// ============================================

// 암호화폐에 중요한 경제 지표 목록
const CRYPTO_IMPORTANT_EVENTS = {
  'Interest Rate Decision': {
    emoji: '🏦',
    importance: '최상',
    goodForCrypto: '동결 또는 인하',
    badForCrypto: '인상',
    explanation: '금리 인상 → 달러 강세 → 암호화폐 하락\n금리 인하 → 유동성 증가 → 암호화폐 상승'
  },
  'CPI': {
    emoji: '📊',
    importance: '상',
    goodForCrypto: '예상보다 낮음',
    badForCrypto: '예상보다 높음',
    explanation: 'CPI↑ → 인플레이션 우려 → 금리 인상 가능성 → 암호화폐 하락\nCPI↓ → 금리 동결/인하 기대 → 암호화폐 상승'
  },
  'Core CPI': {
    emoji: '📊',
    importance: '상',
    goodForCrypto: '예상보다 낮음',
    badForCrypto: '예상보다 높음',
    explanation: '근원 물가(식품/에너지 제외)가 연준의 핵심 지표\n예상보다 낮으면 금리 인하 기대감 상승'
  },
  'Nonfarm Payrolls': {
    emoji: '👷',
    importance: '상',
    goodForCrypto: '예상보다 낮음 (완화적)',
    badForCrypto: '예상보다 높음 (긴축적)',
    explanation: '고용↑ → 경기 과열 → 금리 인상 → 암호화폐 하락\n고용↓ → 경기 둔화 → 금리 인하 기대 → 암호화폐 상승'
  },
  'Unemployment Rate': {
    emoji: '📉',
    importance: '중',
    goodForCrypto: '예상보다 높음 (완화적)',
    badForCrypto: '예상보다 낮음',
    explanation: '실업률↑ → 완화적 정책 기대 → 암호화폐 상승\n실업률↓ → 긴축 지속 → 암호화폐 하락'
  },
  'GDP': {
    emoji: '🏭',
    importance: '중',
    goodForCrypto: '예상 수준 유지',
    badForCrypto: '급격한 변동',
    explanation: 'GDP 예상 부합 → 안정적 시장 → 암호화폐 중립\nGDP 급락 → 경기 침체 우려 → 리스크자산 회피'
  },
  'PCE': {
    emoji: '🛒',
    importance: '상',
    goodForCrypto: '예상보다 낮음',
    badForCrypto: '예상보다 높음',
    explanation: '연준이 가장 중시하는 물가 지표\nPCE↓ → 금리 인하 기대 → 암호화폐 상승'
  },
  'Core PCE': {
    emoji: '🛒',
    importance: '최상',
    goodForCrypto: '예상보다 낮음',
    badForCrypto: '예상보다 높음',
    explanation: '연준의 핵심 인플레이션 지표 (2% 목표)\n목표치 근접 → 금리 인하 가능성 → 암호화폐 상승'
  },
  'Initial Jobless Claims': {
    emoji: '📝',
    importance: '중',
    goodForCrypto: '예상보다 높음',
    badForCrypto: '예상보다 낮음',
    explanation: '주간 실업수당 청구 건수\n청구↑ → 노동시장 냉각 → 완화적 → 암호화폐 상승'
  },
  'PPI': {
    emoji: '🏭',
    importance: '중',
    goodForCrypto: '예상보다 낮음',
    badForCrypto: '예상보다 높음',
    explanation: '생산자물가 → CPI 선행지표\nPPI↓ → CPI↓ 기대 → 암호화폐 상승'
  },
  'Retail Sales': {
    emoji: '🛍️',
    importance: '중',
    goodForCrypto: '예상 수준',
    badForCrypto: '급격한 상승',
    explanation: '소비 급증 → 인플레이션 우려 → 긴축 → 암호화폐 하락\n소비 둔화 → 경기 우려 → 완화적 → 암호화폐 상승'
  },
  'FOMC': {
    emoji: '🎙️',
    importance: '최상',
    goodForCrypto: '비둘기파 발언',
    badForCrypto: '매파적 발언',
    explanation: '연준 회의/의사록/연설\n비둘기파(완화적) → 암호화폐 상승\n매파(긴축적) → 암호화폐 하락'
  },
  'Fed Chair Powell': {
    emoji: '🎤',
    importance: '최상',
    goodForCrypto: '비둘기파 발언',
    badForCrypto: '매파적 발언',
    explanation: '파월 의장 발언은 시장에 큰 영향\n금리 인하 시사 → 암호화폐 급등 가능'
  }
};

// Finnhub에서 경제 캘린더 가져오기
async function getEconomicCalendar() {
  try {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const fromDate = today.toISOString().split('T')[0];
    const toDate = nextWeek.toISOString().split('T')[0];

    const url = `https://finnhub.io/api/v1/calendar/economic?from=${fromDate}&to=${toDate}&token=${FINNHUB_API_KEY}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    const data = await response.json();
    return data.economicCalendar || [];

  } catch (error) {
    console.error('getEconomicCalendar error:', error);
    return [];
  }
}

// 암호화폐 관련 이벤트 필터링
function filterCryptoRelevantEvents(events) {
  const relevant = [];

  for (const event of events) {
    // 미국 이벤트만 (암호화폐에 가장 큰 영향)
    if (event.country !== 'US') continue;

    // 중요 이벤트 매칭
    for (const [keyword, info] of Object.entries(CRYPTO_IMPORTANT_EVENTS)) {
      if (event.event && event.event.includes(keyword)) {
        relevant.push({
          ...event,
          cryptoInfo: info,
          matchedKeyword: keyword
        });
        break;
      }
    }
  }

  // 날짜순 정렬
  relevant.sort((a, b) => new Date(a.time) - new Date(b.time));

  return relevant;
}

// 경제 캘린더 메시지 생성 (무료방용 - 간단)
function formatEconomicCalendarFree(events) {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;

  let msg = `📅 이번 주 경제 캘린더

━━━━━━━━━━━━━━━━

🇺🇸 암호화폐 영향 주요 일정

`;

  if (events.length === 0) {
    msg += `이번 주 주요 이벤트 없음\n`;
  } else {
    // 오늘/내일/이번주로 그룹화
    const today = now.toISOString().split('T')[0];
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (const event of events.slice(0, 8)) {
      const eventDate = event.time ? event.time.split(' ')[0] : '';
      const eventTime = event.time ? event.time.split(' ')[1]?.substring(0, 5) : '';

      // KST 변환 (대략)
      let kstTime = eventTime;
      if (eventTime) {
        const [h, m] = eventTime.split(':').map(Number);
        const kstH = (h + 14) % 24; // EST → KST (+14시간)
        kstTime = `${kstH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      }

      let dateLabel = '';
      if (eventDate === today) dateLabel = '오늘';
      else if (eventDate === tomorrow) dateLabel = '내일';
      else dateLabel = eventDate.substring(5); // MM-DD

      const info = event.cryptoInfo;
      const impEmoji = info.importance === '최상' ? '🔴' : info.importance === '상' ? '🟠' : '🟡';

      msg += `${info.emoji} ${event.matchedKeyword}
├─ ${impEmoji} ${dateLabel} ${kstTime} KST
└─ 암호화폐: ${info.goodForCrypto} = 상승

`;
    }
  }

  msg += `━━━━━━━━━━━━━━━━

💡 발표 시간에 변동성 주의!

⚠️ 참고용 - 투자권유 아님

📢 @V38_Signal`;

  return msg;
}

// 경제 캘린더 메시지 생성 (프리미엄용 - 상세)
function formatEconomicCalendarPremium(events) {
  const now = new Date();

  let msg = `📅 이번 주 경제 캘린더 (상세)

━━━━━━━━━━━━━━━━

🇺🇸 암호화폐 영향 주요 일정

`;

  if (events.length === 0) {
    msg += `이번 주 주요 이벤트 없음\n`;
  } else {
    const today = now.toISOString().split('T')[0];
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (const event of events.slice(0, 10)) {
      const eventDate = event.time ? event.time.split(' ')[0] : '';
      const eventTime = event.time ? event.time.split(' ')[1]?.substring(0, 5) : '';

      // KST 변환
      let kstTime = eventTime;
      if (eventTime) {
        const [h, m] = eventTime.split(':').map(Number);
        const kstH = (h + 14) % 24;
        kstTime = `${kstH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      }

      let dateLabel = '';
      if (eventDate === today) dateLabel = '🔥오늘';
      else if (eventDate === tomorrow) dateLabel = '📌내일';
      else dateLabel = eventDate.substring(5);

      const info = event.cryptoInfo;
      const impEmoji = info.importance === '최상' ? '🔴🔴' : info.importance === '상' ? '🔴' : '🟡';

      msg += `${info.emoji} ${event.matchedKeyword}
├─ ${impEmoji} 중요도: ${info.importance}
├─ 🕐 ${dateLabel} ${kstTime} KST
├─ 📈 예상: ${event.estimate || '미정'}
├─ 📊 이전: ${event.prev || '미정'}
├─ ✅ 상승 조건: ${info.goodForCrypto}
├─ ❌ 하락 조건: ${info.badForCrypto}
└─ 💡 해석:
   ${info.explanation.split('\n').join('\n   ')}

`;
    }
  }

  msg += `━━━━━━━━━━━━━━━━

📊 발표 결과 해석법

✅ 예상 < 실제 → 예상보다 강함
❌ 예상 > 실제 → 예상보다 약함

💡 CPI/PCE: 낮을수록 암호화폐 상승
💡 고용: 약할수록 암호화폐 상승 (역설적)
💡 FOMC: 비둘기파일수록 상승

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;

  return msg;
}

// 경제 캘린더 발송 (무료방)
async function sendEconomicCalendar() {
  try {
    const events = await getEconomicCalendar();
    const relevantEvents = filterCryptoRelevantEvents(events);
    const message = formatEconomicCalendarFree(relevantEvents);

    await sendMessage(FREE_CHANNEL_ID, message);
    await sendMessage(ADMIN_ID, `✅ 경제 캘린더 발송 완료 (${relevantEvents.length}건)`);

    return { success: true, count: relevantEvents.length };
  } catch (error) {
    console.error('sendEconomicCalendar error:', error);
    await sendMessage(ADMIN_ID, `❌ 경제 캘린더 발송 실패: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// 경제 캘린더 발송 (프리미엄방)
async function sendEconomicCalendarPremium() {
  try {
    const events = await getEconomicCalendar();
    const relevantEvents = filterCryptoRelevantEvents(events);
    const message = formatEconomicCalendarPremium(relevantEvents);

    // 프리미엄 그룹 2개에 발송
    await sendMessage(PREMIUM_GROUP_ID, message);
    await sendMessage(PREMIUM_GROUP_ID_2, message);
    await sendMessage(ADMIN_ID, `✅ 프리미엄 경제 캘린더 발송 완료 (${relevantEvents.length}건)`);

    return { success: true, count: relevantEvents.length };
  } catch (error) {
    console.error('sendEconomicCalendarPremium error:', error);
    await sendMessage(ADMIN_ID, `❌ 프리미엄 경제 캘린더 발송 실패: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// /경제 명령어 응답 생성
async function handleEconomicCommand() {
  try {
    const events = await getEconomicCalendar();
    const relevantEvents = filterCryptoRelevantEvents(events);
    return formatEconomicCalendarPremium(relevantEvents);
  } catch (error) {
    return `❌ 경제 캘린더 조회 실패: ${error.message}`;
  }
}

// ============================================
// 월간/주간 경제 캘린더 (프리미엄 전용)
// ============================================

// 한 달치 경제 캘린더 가져오기
async function getMonthlyEconomicCalendar() {
  try {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

    const fromDate = today.toISOString().split('T')[0];
    const toDate = nextMonth.toISOString().split('T')[0];

    const url = `https://finnhub.io/api/v1/calendar/economic?from=${fromDate}&to=${toDate}&token=${FINNHUB_API_KEY}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    const data = await response.json();
    return data.economicCalendar || [];

  } catch (error) {
    console.error('getMonthlyEconomicCalendar error:', error);
    return [];
  }
}

// 월간 경제 캘린더 메시지 생성
function formatMonthlyCalendar(events) {
  const now = new Date();
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const currentMonth = monthNames[now.getMonth()];

  let msg = `📅 ${currentMonth} 경제 캘린더 (월간)

━━━━━━━━━━━━━━━━

🇺🇸 이번 달 주요 일정

`;

  if (events.length === 0) {
    msg += `이번 달 주요 이벤트 없음\n`;
  } else {
    // 주차별로 그룹화
    const weekGroups = {};

    for (const event of events) {
      const eventDate = new Date(event.time);
      const weekNum = Math.ceil(eventDate.getDate() / 7);
      const weekKey = `${weekNum}주차`;

      if (!weekGroups[weekKey]) {
        weekGroups[weekKey] = [];
      }
      weekGroups[weekKey].push(event);
    }

    for (const [week, weekEvents] of Object.entries(weekGroups)) {
      msg += `📌 ${week}\n`;

      for (const event of weekEvents.slice(0, 5)) {
        const eventDate = event.time ? event.time.split(' ')[0] : '';
        const day = eventDate ? eventDate.substring(8, 10) : '';
        const info = event.cryptoInfo;
        const impEmoji = info.importance === '최상' ? '🔴' : info.importance === '상' ? '🟠' : '🟡';

        msg += `  ${impEmoji} ${day}일 ${info.emoji} ${event.matchedKeyword}\n`;
      }
      msg += `\n`;
    }
  }

  msg += `━━━━━━━━━━━━━━━━

🔴 최상 = FOMC, Core PCE, 파월 연설
🟠 상 = CPI, NFP, PCE
🟡 중 = GDP, 실업률, PPI

━━━━━━━━━━━━━━━━

💡 중요 일정 전후 변동성 주의!
📊 매주 월요일 상세 일정 발송

⚠️ 참고용 - 투자권유 아님`;

  return msg;
}

// 주간 경제 캘린더 메시지 생성 (더 상세)
function formatWeeklyCalendarPremium(events) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1); // 월요일
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // 일요일

  const startStr = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
  const endStr = `${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;

  let msg = `📅 이번 주 경제 캘린더 (${startStr}~${endStr})

━━━━━━━━━━━━━━━━

🇺🇸 암호화폐 영향 주요 일정

`;

  if (events.length === 0) {
    msg += `이번 주 주요 이벤트 없음\n`;
  } else {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    for (const event of events.slice(0, 12)) {
      const eventDate = event.time ? new Date(event.time) : null;
      const dayName = eventDate ? dayNames[eventDate.getDay()] : '';
      const dateStr = event.time ? event.time.split(' ')[0].substring(5) : '';
      const timeStr = event.time ? event.time.split(' ')[1]?.substring(0, 5) : '';

      // KST 변환
      let kstTime = timeStr;
      if (timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        const kstH = (h + 14) % 24;
        kstTime = `${kstH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      }

      const info = event.cryptoInfo;
      const impEmoji = info.importance === '최상' ? '🔴🔴' : info.importance === '상' ? '🔴' : '🟡';

      msg += `${info.emoji} ${event.matchedKeyword}
├─ ${impEmoji} 중요도: ${info.importance}
├─ 📆 ${dateStr} (${dayName}) ${kstTime} KST
├─ 📈 예상: ${event.estimate || '미정'} | 이전: ${event.prev || '미정'}
├─ ✅ 상승: ${info.goodForCrypto}
├─ ❌ 하락: ${info.badForCrypto}
└─ 💡 ${info.explanation.split('\n')[0]}

`;
    }
  }

  msg += `━━━━━━━━━━━━━━━━

📊 이번 주 핵심 포인트

`;

  // 최상 중요도 이벤트 강조
  const topEvents = events.filter(e => e.cryptoInfo.importance === '최상');
  if (topEvents.length > 0) {
    msg += `⚠️ 최고 중요 이벤트 ${topEvents.length}건!\n`;
    for (const e of topEvents.slice(0, 3)) {
      msg += `   • ${e.matchedKeyword}\n`;
    }
  } else {
    msg += `✅ 최고 중요 이벤트 없음 (상대적 안정)\n`;
  }

  msg += `
━━━━━━━━━━━━━━━━

💡 발표 30분 전후 포지션 주의
📉 예상치 벗어나면 급변동 가능

⚠️ 참고용 - 투자권유 아님`;

  return msg;
}

// 월간 경제 캘린더 발송 (매월 1일)
async function sendMonthlyEconomicCalendar() {
  try {
    const events = await getMonthlyEconomicCalendar();
    const relevantEvents = filterCryptoRelevantEvents(events);
    const message = formatMonthlyCalendar(relevantEvents);

    // 프리미엄 그룹에 발송
    await sendMessage(PREMIUM_GROUP_ID, message);
    await sendMessage(PREMIUM_GROUP_ID_2, message);
    await sendMessage(ADMIN_ID, `✅ 월간 경제 캘린더 발송 완료 (${relevantEvents.length}건)`);

    return { success: true, count: relevantEvents.length };
  } catch (error) {
    console.error('sendMonthlyEconomicCalendar error:', error);
    await sendMessage(ADMIN_ID, `❌ 월간 경제 캘린더 실패: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// 주간 경제 캘린더 발송 (매주 월요일)
async function sendWeeklyEconomicCalendar() {
  try {
    const events = await getEconomicCalendar(); // 1주일치
    const relevantEvents = filterCryptoRelevantEvents(events);
    const message = formatWeeklyCalendarPremium(relevantEvents);

    // 프리미엄 그룹에 발송
    await sendMessage(PREMIUM_GROUP_ID, message);
    await sendMessage(PREMIUM_GROUP_ID_2, message);
    await sendMessage(ADMIN_ID, `✅ 주간 경제 캘린더 발송 완료 (${relevantEvents.length}건)`);

    return { success: true, count: relevantEvents.length };
  } catch (error) {
    console.error('sendWeeklyEconomicCalendar error:', error);
    await sendMessage(ADMIN_ID, `❌ 주간 경제 캘린더 실패: ${error.message}`);
    return { success: false, error: error.message };
  }
}
