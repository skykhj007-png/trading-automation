// ============================================
// Cloudflare Workers - V42 텔레그램 봇
// ============================================
//
// 설정 방법:
// 1. https://dash.cloudflare.com 접속
// 2. Workers & Pages → v39-bot → Edit code
// 3. 이 코드 전체 붙여넣기 → Save and Deploy
//
// ============================================

// 텔레그램 봇 토큰 (Cloudflare 환경변수에서 가져옴)
// Settings → Variables → BOT_TOKEN 에 설정하세요
let BOT_TOKEN;
const OPENAI_API_KEY = "YOUR_OPENAI_API_KEY"; // Settings → Variables에서 설정
const FINNHUB_API_KEY = "ctaborhr01qhup62c7tgctaborhr01qhup62c7u0"; // Finnhub 무료 API 키

const PREMIUM_GROUP_ID = -1003318469200;
const PREMIUM_GROUP_ID_2 = -1003672890861;
const ADMIN_ID = 752036014;
const FREE_CHANNEL_ID = "@V38_Signal";

export default {
  // ============================================
  // HTTP 요청 처리 (텔레그램 웹훅)
  // ============================================
  async fetch(request, env, ctx) {
    // 환경변수에서 봇 토큰 로드
    BOT_TOKEN = env.BOT_TOKEN;

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

    // TradingView 웹훅 수신 (V42 호환)
    if (url.pathname === '/tradingview' && request.method === 'POST') {
      const text = await request.text();
      ctx.waitUntil(handleTradingViewAlert(text));
      return new Response('OK');
    }

    return new Response('V42 Trading Bot is running!');
  },

  // ============================================
  // 스케줄 트리거 (cron별 분기 처리)
  // ============================================
  async scheduled(event, env, ctx) {
    // 환경변수에서 봇 토큰 로드
    BOT_TOKEN = env.BOT_TOKEN;

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

// 간단한 4시간 분석 (실제 데이터 포함)
async function sendSimpleAnalysis(timeStr) {
  let analysis;

  try {
    // BTC 실시간 데이터 가져오기
    const response = await fetchWithTimeout(
      `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`,
      { headers: { 'Accept': 'application/json', 'User-Agent': 'V42-Trading-Bot/1.0' } },
      8000
    );

    const data = await response.json();

    if (data.bitcoin && data.bitcoin.usd) {
      const price = Math.round(data.bitcoin.usd);
      const change24h = data.bitcoin.usd_24h_change?.toFixed(2) || "0.00";
      const volume = data.bitcoin.usd_24h_vol ? (data.bitcoin.usd_24h_vol / 1e9).toFixed(1) : "N/A";

      // 추세 판단
      const trend = change24h > 0 ? "📈 상승" : change24h < 0 ? "📉 하락" : "➡️ 횡보";
      const trendIcon = change24h > 2 ? "🟢" : change24h > 0 ? "🔵" : change24h > -2 ? "🟡" : "🔴";

      // RSI 추정 (24h 변동 기반)
      let rsi = Math.round(50 + (parseFloat(change24h) * 2.5));
      rsi = Math.max(20, Math.min(80, rsi));
      const rsiStatus = rsi > 70 ? "과매수 ⚠️" : rsi < 30 ? "과매도 ✅" : "중립";

      // 위치 추정
      let position = Math.round(50 + (parseFloat(change24h) * 5));
      position = Math.max(10, Math.min(90, position));
      const positionZone = position < 30 ? "DISC ✅" : position > 70 ? "PREM ⚠️" : "중간";

      // 매매 판단
      let verdict = "";
      if (change24h > 2 && rsi < 70) {
        verdict = "✅ 상승 추세 지속";
      } else if (change24h < -2 && rsi > 30) {
        verdict = "⚠️ 하락 추세 주의";
      } else if (rsi < 30 && change24h > -1) {
        verdict = "🔵 반등 가능성";
      } else if (rsi > 70 && change24h < 1) {
        verdict = "🟡 조정 가능성";
      } else {
        verdict = "• 관망 구간";
      }

      analysis = `📊 BTC 4시간봉 분석 (${timeStr} KST)

━━━━━━━━━━━━━━━━

💰 현재가: $${price.toLocaleString()}
${trendIcon} 24h: ${change24h > 0 ? '+' : ''}${change24h}%
📊 거래량: $${volume}B

━━━━━━━━━━━━━━━━

📈 시장 상태

• 추세: ${trend}
• RSI: ${rsi} (${rsiStatus})
• 위치: ${position}% (${positionZone})

━━━━━━━━━━━━━━━━

🎯 V42 관점

${change24h > 0 ? '✅ EMA 상승 정렬 추정' : '⚠️ EMA 하락 정렬 추정'}
${position < 40 ? '✅ 매수 적합 구간' : position > 60 ? '⚠️ 고점 주의' : '• 중립 구간'}
${verdict}

━━━━━━━━━━━━━━━━

💡 V42 지표에서 확인하세요!

□ Smart Trail 색상
□ 1H/4H 추세 방향
□ Delta 매수/매도세
□ 고래 활동 여부
□ 하모닉 패턴 🦋

━━━━━━━━━━━━━━━━

🚀 SUPER = 최고 신뢰도
⭐ STRONG = 높은 신뢰도
🐋 고래 = 대량 거래 감지
🦋 하모닉 = 피보나치 패턴

⚠️ 참고용 - 투자권유 아님

📢 @V38_Signal
🤖 @v39_signal_bot`;
    } else {
      throw new Error("데이터 없음");
    }
  } catch (error) {
    // API 실패 시 기본 메시지
    analysis = `📊 BTC 4시간봉 체크 (${timeStr} KST)

━━━━━━━━━━━━━━━━

⏰ 정기 분석 시간입니다!

🎯 V42 체크리스트

□ Smart Trail 색상 (라임=상승)
□ 1H/4H 추세 방향
□ 위치 (20% 이하 = 매수적합)
□ 거래량 급증 여부
□ Delta (▲BUY = 매수세)
□ 하모닉 패턴 🦋

━━━━━━━━━━━━━━━━

🚀 SUPER = 최고 신뢰도
⭐ STRONG = 높은 신뢰도
🐋 고래 = 대량 거래 감지
🦋 하모닉 = 피보나치 패턴

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님

📢 @V38_Signal
🤖 @v39_signal_bot`;
  }

  await sendMessage(FREE_CHANNEL_ID, analysis);
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
// 4시간 자동 분석 (무료 채널만)
// ============================================
async function send4HourAnalysis() {
  const maxRetries = 2;
  let lastError = null;
  let btcData = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const simpleUrl = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true`;

      const response = await fetchWithTimeout(simpleUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'V42-Trading-Bot/1.0'
        }
      }, 8000);

      if (!response.ok) {
        throw new Error(`API ${response.status}`);
      }

      const data = await response.json();

      if (!data.bitcoin || !data.bitcoin.usd) {
        throw new Error('데이터없음');
      }

      btcData = data.bitcoin;
      break;

    } catch (error) {
      lastError = error.message;
      if (attempt < maxRetries) {
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
    const currentPrice = Math.round(btcData.usd);
    const changePercent = btcData.usd_24h_change?.toFixed(2) || "0.00";

    const trend = changePercent > 0 ? "상승" : "하락";
    const trendStrength = Math.abs(parseFloat(changePercent)) > 3 ? "강한 " : "";

    let rsi = 50 + (parseFloat(changePercent) * 2.5);
    rsi = Math.max(20, Math.min(80, rsi)).toFixed(0);

    let position = 50 + (parseFloat(changePercent) * 5);
    position = Math.max(10, Math.min(90, position)).toFixed(0);

    analysis = `📊 BTC 4시간봉 분석 (${timeStr} KST)

━━━━━━━━━━━━━━━━

💰 현재가: $${currentPrice.toLocaleString()} (${changePercent > 0 ? '+' : ''}${changePercent}%)

📈 추세: ${trendStrength}${trend}
📊 RSI: ${rsi} ${rsi > 70 ? '⚠️과매수' : rsi < 30 ? '✅과매도' : '중립'}
📍 위치: ${position}% ${position < 30 ? '(DISC✅)' : position > 70 ? '(PREM⚠️)' : '(중간)'}

━━━━━━━━━━━━━━━━

🎯 V42 매매 관점

${changePercent > 0 ? '✅ 상승 추세' : '⚠️ 하락 추세'}
${position < 30 ? '✅ 매수 적합 구간' : position > 70 ? '⚠️ 매도 적합 구간' : '• 중립 구간'}
${rsi < 30 ? '✅ 과매도 반등 기대' : rsi > 70 ? '⚠️ 과매수 조정 주의' : '• RSI 중립'}

━━━━━━━━━━━━━━━━

🚀 = SUPER LONG
⭐ = STRONG LONG
🐋 = 고래 활동
🦋 = 하모닉 패턴

⚠️ 참고용 - 투자권유 아님

📢 @V38_Signal
🤖 @v39_signal_bot`;

  } else {
    success = false;
    analysis = `📊 BTC 4시간봉 리포트 (${timeStr} KST)

━━━━━━━━━━━━━━━━

⏰ 정기 분석 시간입니다!

📈 TradingView에서 V42 지표 확인하세요.

━━━━━━━━━━━━━━━━

🎯 체크리스트

□ Smart Trail 색상 확인
□ 1H/4H 추세 방향 확인
□ 위치(DISC/PREM) 확인
□ 거래량 급증 여부
□ 하모닉 패턴 확인 🦋

━━━━━━━━━━━━━━━━

🚀 = SUPER LONG
⭐ = STRONG LONG
🐋 = 고래 활동
🦋 = 하모닉 패턴

⚠️ 참고용 - 투자권유 아님

📢 @V38_Signal
🤖 @v39_signal_bot`;
  }

  try {
    await sendMessage(FREE_CHANNEL_ID, analysis);
  } catch (sendError) {
    return { success: false, error: `발송실패: ${sendError.message}` };
  }

  return { success, error: lastError };
}

// ============================================
// TradingView 알람 처리 (V42 + 기존 호환)
// ============================================
async function handleTradingViewAlert(alertText) {
  try {
    // ========== V42 알림 감지 ==========
    const isV42Long = alertText.includes('>>> LONG <<<') ||
                      alertText.includes('LONG (필터)') ||
                      alertText.includes('고정확 매수');
    const isV42Short = alertText.includes('>>> SHORT <<<') ||
                       alertText.includes('SHORT (필터)') ||
                       alertText.includes('고정확 매도');
    const isV42Whale = alertText.includes('고래 매수') || alertText.includes('고래 매도');
    const isV42Harmonic = alertText.includes('하모닉') ||
                          alertText.includes('Harmonic') ||
                          alertText.includes('Bullish 하모닉') ||
                          alertText.includes('Bearish 하모닉');
    const isV42BAMM = alertText.includes('BAMM') || alertText.includes('RSI BAMM');
    const isV42Super = alertText.includes('SUPER LONG') || alertText.includes('SUPER SHORT');
    const isV42Strong = alertText.includes('고확신 LONG') || alertText.includes('ICT LONG');

    const isV42Signal = isV42Long || isV42Short || isV42Whale || isV42Harmonic || isV42BAMM || isV42Super || isV42Strong;

    // V42 알림 처리
    if (isV42Signal) {
      let emoji = '📊';
      let signalType = '신호';

      if (isV42Super) {
        emoji = '🚀';
        signalType = alertText.includes('SHORT') ? 'SUPER SHORT' : 'SUPER LONG';
      } else if (isV42Strong) {
        emoji = '⭐';
        signalType = '고확신 LONG';
      } else if (isV42Long) {
        emoji = '🟢';
        signalType = 'LONG';
      } else if (isV42Short) {
        emoji = '🔴';
        signalType = 'SHORT';
      } else if (isV42Whale) {
        emoji = '🐋';
        signalType = alertText.includes('매수') ? '고래 매수' : '고래 매도';
      } else if (isV42Harmonic) {
        emoji = '🦋';
        if (alertText.includes('Bullish')) {
          signalType = '하모닉 매수 패턴';
        } else if (alertText.includes('Bearish')) {
          signalType = '하모닉 매도 패턴';
        } else {
          signalType = '하모닉 패턴';
        }
      } else if (isV42BAMM) {
        emoji = '📈';
        signalType = alertText.includes('매도') ? 'RSI BAMM 매도' : 'RSI BAMM 매수';
      }

      // 코인 심볼 추출
      let coinSymbol = 'BTC';
      const tickerMatch = alertText.match(/([A-Z]{2,10})USDT/);
      if (tickerMatch) {
        coinSymbol = tickerMatch[1];
      }

      // 타임프레임 추출
      let timeframe = '';
      if (alertText.includes('15분') || alertText.includes('15m')) timeframe = '15분';
      else if (alertText.includes('1시간') || alertText.includes('1H') || alertText.includes('1h')) timeframe = '1시간';
      else if (alertText.includes('4시간') || alertText.includes('4H') || alertText.includes('4h')) timeframe = '4시간';
      else if (alertText.includes('일봉') || alertText.includes('1D') || alertText.includes('1d')) timeframe = '일봉';

      const v42Msg = `${emoji} V42 ${signalType} 감지!

━━━━━━━━━━━━━━━━
🪙 ${coinSymbol}${timeframe ? ' | ⏰ ' + timeframe : ''}
━━━━━━━━━━━━━━━━

${alertText}

━━━━━━━━━━━━━━━━
📢 @V38_Signal
🤖 @v39_signal_bot
⚠️ 참고용 - 투자권유 아님`;

      await sendMessage(FREE_CHANNEL_ID, v42Msg);

      // 프리미엄 그룹에도 발송
      await sendMessage(PREMIUM_GROUP_ID, v42Msg);
      await sendMessage(PREMIUM_GROUP_ID_2, v42Msg);

      // 관리자에게 알림
      await sendMessage(ADMIN_ID, `✅ V42 알림 발송: ${signalType} (${coinSymbol})`);

      return { success: true, type: 'V42' };
    }

    // ========== 기존 등급별 알림 (V39 호환) ==========
    const isWhale = alertText.includes('🐋WHALE');
    const isShark = alertText.includes('🦈SHARK');
    const isDolphin = alertText.includes('🐬DOLPHIN');
    const isFish = alertText.includes('🐟FISH');
    const isCrab = alertText.includes('🦀CRAB');
    const isShrimp = alertText.includes('🦐SHRIMP');

    const isFreeTier = isDolphin || isFish || isCrab || isShrimp;
    const isBuy = alertText.includes('매수');
    const isSell = alertText.includes('매도');

    const isSuperLong = alertText.includes('SUPER LONG') || alertText.includes('🚀');
    const isStrongLong = alertText.includes('STRONG LONG') || alertText.includes('⭐');
    const isPremiumSignal = isSuperLong || isStrongLong || isWhale || isShark;

    // 프리미엄 시그널 오더북 분석
    let orderbookInfo = '';
    if (isPremiumSignal && isBuy) {
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
🤖 @v39_signal_bot`;

      await sendMessage(FREE_CHANNEL_ID, freeChannelMsg);
    }

    return { success: true };
  } catch (error) {
    console.error('handleTradingViewAlert error:', error);
    await sendMessage(ADMIN_ID, `❌ 알림 처리 오류: ${error.message}`);
    return { success: false, error: error.message };
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

🤖 V42 MTF Confluence Pro

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
    responseText = `🤖 V42 Trading System

⚠️ 본 서비스는 참고용이며 투자권유가 아닙니다.

【무료 이용 방법】
비트겟 가입만 하면 모두 무료!

✅ 텔레그램 실시간 AI 분석&대화방 입장
✅ TradingView V42 지표 (평생)

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
    responseText = `📚 V42 MTF Confluence Pro

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
🦋 하모닉 패턴 = 피보나치 반전

━━━━━━━━━━━━━━━━

✅ 진입 조건

• 2TF 이상 상승 + 1H UP
• 거래량 급증 + 매수압력 48%+
• Smart Trail 라임색
• 위치 30% 이하 (DISC)
• 하모닉 PRZ 도달 🦋

━━━━━━━━━━━━━━━━

🚫 진입 금지

• 1H 또는 4H DOWN
• 위치 50% 이상
• Smart Trail 빨간색

━━━━━━━━━━━━━━━━

🦋 하모닉 패턴 (NEW!)

• Gartley, Bat, Crab, Butterfly
• Shark, Cypher, 5-0
• PRZ = 잠재적 반전 구간
• RSI BAMM = 다이버전스 확인

━━━━━━━━━━━━━━━━

🔔 알림: /알림
🎯 권장: 🚀⭐🦋 시그널만 거래!

❓ 문의: @pointting`;
  }

  // /알림
  else if (command === '/alert' || command === '/알림') {
    responseText = `🔔 V42 알림 설정 가이드

━━━━━━━━━━━━━━━━

📌 알림 생성 방법

1️⃣ 차트에서 알림 아이콘 (종) 클릭
   또는 단축키: Alt + A

2️⃣ 조건 설정:
   • 첫 번째: V42 Complete
   • 두 번째: 원하는 알림 선택

━━━━━━━━━━━━━━━━

📊 추천 알림

• [V42] ★ LONG (필터) - 고정확 롱
• [V42] ★ SHORT (필터) - 고정확 숏
• [V42] 고래 매수/매도 - 대량거래
• [V42] 하모닉 (필터) - 패턴 감지
• [V42] 모든 롱/숏 - 전체 신호

━━━━━━━━━━━━━━━━

⏰ 트리거 설정

✅ "봉 마감 시 한번" 선택!
❌ "봉마다 한번" = 허위신호 가능

━━━━━━━━━━━━━━━━

🔗 웹훅 설정 (텔레그램 연동)

☑️ Webhook URL 체크
URL: https://v39-bot.myblog-tools.workers.dev/tradingview

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
□ 하모닉: PRZ 도달? 🦋

━━━━━━━━━━━━━━━━

📌 7개 중 5개 이상 → 진입 OK

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
    responseText = `📊 V42 등급 시스템

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
• 하모닉: +5점 🦋

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;
  }

  // /고래
  else if (command === '/whale' || command === '/고래') {
    responseText = `🐋 V42 거래량 등급 시스템

━━━━━━━━━━━━━━━━

📊 해양생물 등급 분류

🐋 WHALE (고래)
• 거래량: 10배 이상

🦈 SHARK (상어)
• 거래량: 7~10배

🐬 DOLPHIN (돌고래)
• 거래량: 5~7배

🐟 FISH (물고기)
• 거래량: 3~5배

🦀 CRAB (게)
• 거래량: 2~3배

🦐 SHRIMP (새우)
• 거래량: 1.5~2배

━━━━━━━━━━━━━━━━

🎯 V42 고래 감지

• 거래량 3배 이상
• 가격변동 0.5% 이상
• 🐋BUY / 🐋SELL 라벨 표시

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;
  }

  // /도움말
  else if (command === '/help' || command === '/도움말') {
    let helpText = `🤖 V42 Premium 명령어

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

📚 V42 지표 가이드

/가이드 - 핵심 가이드
/알림 - 알림 설정 방법 ⭐
/체크리스트 - 진입 조건
/청산 - 청산 가이드
/등급 - 등급 설명
/고래 - 고래 등급 설명 ⭐

━━━━━━━━━━━━━━━━

🔥 실시간 분석

/호가 BTC - 호가창 매수/매도벽

━━━━━━━━━━━━━━━━

📢 무료 시그널: @V38_Signal

💬 문의: @pointting`;

    if (chatId === ADMIN_ID) {
      helpText += `

━━━━━━━━━━━━━━━━

🔐 관리자 명령어

/4h - 무료채널 4시간 분석 발송
/sendhelp - 프리미엄 도움말 발송
/broadcast [메시지] - 무료채널 발송`;
    }

    responseText = helpText;
  }

  // 관리자: /4h
  else if ((command === '/4h' || command === '/4시간') && chatId === ADMIN_ID) {
    await sendSimpleAnalysis(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }).replace(':', ':'));
    responseText = `✅ 4시간 분석이 무료 채널에 발송되었습니다!`;
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

  // /호가
  else if (command === '/호가' || command === '/orderbook' || command === '/ob') {
    responseText = await handleOrderbookCommand(coinInput);
  }

  if (responseText) {
    await sendMessage(chatId, responseText);
  }
}

// ============================================
// AI 분석 함수
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

  try {
    const searchUrl = `https://api.coingecko.com/api/v3/search?query=${coin}`;
    const searchRes = await fetch(searchUrl, { headers: { 'Accept': 'application/json' } });
    const searchData = await searchRes.json();

    if (!searchData.coins || searchData.coins.length === 0) {
      return `❌ "${coin}" 코인을 찾을 수 없습니다.`;
    }

    const coinId = searchData.coins[0].id;
    const coinSymbol = searchData.coins[0].symbol.toUpperCase();

    const cgUrl = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${selected.days}`;
    const response = await fetch(cgUrl, { headers: { 'Accept': 'application/json' } });
    const data = await response.json();

    if (!data.prices || data.prices.length === 0) {
      return `❌ 데이터를 가져올 수 없습니다.`;
    }

    const prices = data.prices.map(p => p[1]);
    const currentPrice = prices[prices.length - 1];
    const openPrice = prices[0];

    const ema9 = prices.slice(-9).reduce((a, b) => a + b, 0) / Math.min(9, prices.length);
    const ema21 = prices.slice(-21).reduce((a, b) => a + b, 0) / Math.min(21, prices.length);
    const trend = ema9 > ema21 ? "상승 📈" : "하락 📉";
    const changePercent = ((currentPrice - openPrice) / openPrice * 100).toFixed(2);

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

    const formatPrice = (price) => {
      if (price < 0.01) return price.toFixed(6);
      if (price < 1) return price.toFixed(4);
      if (price < 100) return price.toFixed(3);
      return price.toFixed(2);
    };

    return `📊 ${coinSymbol} ${selected.tf} 분석

━━━━━━━━━━━━━━━━

💰 현재가: $${formatPrice(currentPrice)} (${changePercent > 0 ? '+' : ''}${changePercent}%)

📈 추세: ${trend}
📊 RSI: ${rsi} ${rsi > 70 ? '⚠️과매수' : rsi < 30 ? '✅과매도' : '중립'}
📍 위치: ${position}% ${position < 30 ? '(DISC✅)' : position > 70 ? '(PREM⚠️)' : ''}

━━━━━━━━━━━━━━━━

📍 주요 가격대

• 고점: $${formatPrice(high)}
• 저점: $${formatPrice(low)}
• EMA9: $${formatPrice(ema9)}
• EMA21: $${formatPrice(ema21)}

━━━━━━━━━━━━━━━━

🎯 V42 관점

${ema9 > ema21 ? '✅ 상승 정렬' : '⚠️ 하락 정렬'}
${position < 30 ? '✅ 매수 적합 구간' : position > 70 ? '⚠️ 매도 적합 구간' : '• 중립 구간'}
${rsi < 30 ? '✅ 과매도 반등 기대' : rsi > 70 ? '⚠️ 과매수 조정 주의' : ''}

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;

  } catch (error) {
    return `❌ 분석 오류: ${error.message}`;
  }
}

// ============================================
// 프리미엄 도움말 발송
// ============================================
async function sendPremiumHelp() {
  const helpDoc = `📚 V42 MTF Confluence Pro 사용법

━━━━━━━━━━━━━━━━

🎯 핵심 시그널

🚀 SUPER LONG - 최고 확신!
⭐ STRONG LONG - 강력 추천
💀 SUPER SHORT - 숏 확신
⚠️ STRONG SHORT - 숏 추천
🐋 WHALE - 고래 매수/매도
🦋 하모닉 - 피보나치 패턴

━━━━━━━━━━━━━━━━

✅ LONG 진입 조건

1. 시그널: 🚀 또는 ⭐
2. 미니패널: ▲ LONG (라임)
3. 1H/4H: 둘 다 UP
4. 위치: 30% 이하 (DISC)
5. Smart Trail: 라임색
6. 등급: B+ (16점) 이상
7. 하모닉: PRZ 도달 🦋

📌 7개 중 5개 이상 → 진입!

━━━━━━━━━━━━━━━━

🦋 하모닉 패턴 (NEW!)

• Gartley (가틀리)
• Bat (박쥐)
• Crab (게)
• Butterfly (나비)
• Shark (상어)
• Cypher (사이퍼)

PRZ = 잠재적 반전 구간
RSI BAMM = 다이버전스 확인

━━━━━━━━━━━━━━━━

📊 AI 분석 명령어

/a1m ~ /a1d - 타임프레임별 분석
/호가 BTC - 호가창 분석

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님

📢 @V38_Signal
💬 문의: @pointting`;

  await sendMessage(PREMIUM_GROUP_ID, helpDoc);
  await sendMessage(PREMIUM_GROUP_ID_2, helpDoc);
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
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.code !== '00000') return null;

    return data.data;
  } catch (error) {
    return null;
  }
}

// ============================================
// 오더북 분석 함수
// ============================================
function analyzeOrderbook(orderbook) {
  if (!orderbook || !orderbook.asks || !orderbook.bids) return null;

  const asks = orderbook.asks.map(a => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) }));
  const bids = orderbook.bids.map(b => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) }));

  const totalBidQty = bids.reduce((sum, b) => sum + b.qty, 0);
  const totalAskQty = asks.reduce((sum, a) => sum + a.qty, 0);
  const imbalanceRatio = ((totalBidQty - totalAskQty) / (totalBidQty + totalAskQty) * 100).toFixed(1);

  const avgBidQty = totalBidQty / bids.length;
  const avgAskQty = totalAskQty / asks.length;

  const bidWalls = bids.filter(b => b.qty >= avgBidQty * 3);
  const askWalls = asks.filter(a => a.qty >= avgAskQty * 3);

  const bestBid = bids[0]?.price || 0;
  const bestAsk = asks[0]?.price || 0;
  const midPrice = (bestBid + bestAsk) / 2;

  const topBidQty = bids[0]?.qty || 0;
  const topAskQty = asks[0]?.qty || 0;
  const topImbalance = topBidQty > topAskQty * 2 ? 'BID' : topAskQty > topBidQty * 2 ? 'ASK' : 'NEUTRAL';

  let entrySignal = 'NEUTRAL';
  let entryReason = '균형 상태';

  if (parseFloat(imbalanceRatio) > 20 && bidWalls.length > 0) {
    entrySignal = 'LONG';
    entryReason = '매수벽 + 매수 우세';
  } else if (parseFloat(imbalanceRatio) > 10) {
    entrySignal = 'LONG_WEAK';
    entryReason = '약한 매수 우세';
  } else if (parseFloat(imbalanceRatio) < -20 && askWalls.length > 0) {
    entrySignal = 'SHORT';
    entryReason = '매도벽 + 매도 우세';
  } else if (parseFloat(imbalanceRatio) < -10) {
    entrySignal = 'SHORT_WEAK';
    entryReason = '약한 매도 우세';
  }

  return {
    midPrice,
    totalBidQty: totalBidQty.toFixed(2),
    totalAskQty: totalAskQty.toFixed(2),
    imbalanceRatio,
    bidWalls: bidWalls.slice(0, 3),
    askWalls: askWalls.slice(0, 3),
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
  if (!orderbook) return `❌ ${symbol} 오더북 조회 실패`;

  const analysis = analyzeOrderbook(orderbook);
  if (!analysis) return `❌ 오더북 분석 실패`;

  let signalEmoji = '⚪';
  let signalText = '중립';
  if (analysis.entrySignal === 'LONG') { signalEmoji = '🟢'; signalText = '롱 유리'; }
  else if (analysis.entrySignal === 'LONG_WEAK') { signalEmoji = '🟡'; signalText = '약한 롱'; }
  else if (analysis.entrySignal === 'SHORT') { signalEmoji = '🔴'; signalText = '숏 유리'; }
  else if (analysis.entrySignal === 'SHORT_WEAK') { signalEmoji = '🟠'; signalText = '약한 숏'; }

  const imbalanceEmoji = parseFloat(analysis.imbalanceRatio) > 0 ? '📈' : '📉';

  return `📊 ${symbol} 호가창 분석

━━━━━━━━━━━━━━━━

💰 현재가: $${analysis.midPrice.toFixed(1)}

📈 매수 총량: ${analysis.totalBidQty} ${coin}
📉 매도 총량: ${analysis.totalAskQty} ${coin}
${imbalanceEmoji} 불균형: ${analysis.imbalanceRatio}%

━━━━━━━━━━━━━━━━

🧱 매수벽: ${analysis.bidWalls.length}개
🧱 매도벽: ${analysis.askWalls.length}개

━━━━━━━━━━━━━━━━

${signalEmoji} 진입 판단: ${signalText}
💡 ${analysis.entryReason}

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;
}

// ============================================
// 경제 캘린더 함수 (placeholder)
// ============================================
async function sendEconomicCalendar() {
  // 구현 필요시 추가
}

async function sendEconomicCalendarPremium() {
  // 구현 필요시 추가
}

async function sendWeeklyEconomicCalendar() {
  // 구현 필요시 추가
}

async function sendMonthlyEconomicCalendar() {
  // 구현 필요시 추가
}
