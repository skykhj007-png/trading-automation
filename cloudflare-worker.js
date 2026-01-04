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

// 환경변수에서 가져옴 (Cloudflare Workers Settings → Variables에서 설정)
// BOT_TOKEN: 텔레그램 봇 토큰
// OPENAI_API_KEY: OpenAI API 키
const BOT_TOKEN = typeof env !== 'undefined' ? env.BOT_TOKEN : "YOUR_BOT_TOKEN";
const OPENAI_API_KEY = typeof env !== 'undefined' ? env.OPENAI_API_KEY : "YOUR_OPENAI_API_KEY";

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

    // TradingView 웹훅 수신 (무료 채널용)
    if (url.pathname === '/tradingview' && request.method === 'POST') {
      const text = await request.text();
      ctx.waitUntil(handleTradingViewAlert(text));
      return new Response('OK');
    }

    return new Response('V39 Trading Bot is running!');
  },

  // ============================================
  // 스케줄 트리거 (4시간마다 자동 분석)
  // ============================================
  async scheduled(event, env, ctx) {
    console.log("Cron started at:", new Date().toISOString());
    try {
      // 시작 알림 (디버깅용)
      await sendMessage(ADMIN_ID, `🕐 Cron 시작: ${new Date().toISOString()}`);

      await send4HourAnalysis();

      // 완료 알림 (디버깅용)
      await sendMessage(ADMIN_ID, `✅ Cron 완료!`);
    } catch (error) {
      console.error("Scheduled error:", error);
      await sendMessage(ADMIN_ID, `⚠️ Cron 실행 에러: ${error.message}`);
    }
  }
};

// ============================================
// 4시간 자동 분석 (무료 채널만) - 재시도 로직 포함
// ============================================
async function send4HourAnalysis() {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const cgUrl = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7`;
      const response = await fetch(cgUrl, {
        headers: { 'Accept': 'application/json' },
        cf: { cacheTtl: 60 }
      });

      if (!response.ok) {
        throw new Error(`API 응답 오류: ${response.status}`);
      }

      const data = await response.json();

      if (!data.prices || data.prices.length === 0) {
        throw new Error('가격 데이터 없음');
      }

    const prices = data.prices.map(p => p[1]);
    const currentPrice = prices[prices.length - 1];
    const price24hAgo = prices[Math.max(0, prices.length - 6)];
    const changePercent = ((currentPrice - price24hAgo) / price24hAgo * 100).toFixed(2);

    const ema9 = prices.slice(-9).reduce((a, b) => a + b, 0) / 9;
    const ema21 = prices.slice(-21).reduce((a, b) => a + b, 0) / 21;
    const ema50 = prices.slice(-50).reduce((a, b) => a + b, 0) / 50;
    const trend = ema9 > ema21 ? "상승" : "하락";
    const emaStrength = ema9 > ema21 && ema21 > ema50 ? "강한 상승" : ema9 < ema21 && ema21 < ema50 ? "강한 하락" : "혼조";

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

    const analysis = `📊 BTC 4시간봉 분석 (${timeStr} KST)

━━━━━━━━━━━━━━━━

💰 현재가: $${currentPrice.toFixed(0)} (${changePercent > 0 ? '+' : ''}${changePercent}%)

📈 추세: ${trend} (${emaStrength})
📊 RSI: ${rsi} ${rsi > 70 ? '⚠️과매수' : rsi < 30 ? '✅과매도' : '중립'}
📍 위치: ${position}% ${position < 30 ? '(DISC✅)' : position > 70 ? '(PREM⚠️)' : '(중간)'}

━━━━━━━━━━━━━━━━

🎯 V39 관점

${ema9 > ema21 ? '✅ EMA 상승 정렬' : '⚠️ EMA 하락 정렬'}
${position < 30 ? '✅ 매수 적합 구간' : position > 70 ? '⚠️ 매도 적합 구간' : '• 중립 구간'}
${rsi < 30 ? '✅ 과매도 반등 기대' : rsi > 70 ? '⚠️ 과매수 조정 주의' : '• RSI 중립'}

━━━━━━━━━━━━━━━━

🚀 = SUPER LONG
⭐ = STRONG LONG
🐋 = 고래 활동

⚠️ 참고용 - 투자권유 아님

📢 @V38_Signal
🤖 @V30_Signal_bot`;

      // 무료 채널에만 발송
      await sendMessage(FREE_CHANNEL_ID, analysis);

      return { success: true, attempt };

    } catch (error) {
      console.log(`4시간 분석 시도 ${attempt}/${maxRetries} 실패: ${error.message}`);

      if (attempt === maxRetries) {
        // 마지막 시도도 실패하면 관리자에게 알림
        await sendMessage(ADMIN_ID, `⚠️ 4시간 자동 분석 실패\n\n오류: ${error.message}\n\n수동 테스트: /test4h`);
        return { success: false, error: error.message };
      }

      // 다음 시도 전 2초 대기
      await new Promise(r => setTimeout(r, 2000));
    }
  }
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

⚠️ 참고용 - 투자권유 아님`;
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

⚠️ 주의사항

• 시그널 ≠ 100% 수익 보장
• 모든 투자 결정은 본인 책임
• LONG만 권장 (SHORT 승률 낮음)
• EXIT 시그널 시 즉시 청산

━━━━━━━━━━━━━━━━

❓ 문의: @pointting`;

  await sendMessage(PREMIUM_GROUP_ID, helpDoc);
  await sendMessage(PREMIUM_GROUP_ID_2, helpDoc);
}

// ============================================
// TradingView 알람 처리 (무료 채널 - 새우~돌고래)
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
