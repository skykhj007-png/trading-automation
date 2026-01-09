// ============================================
// 패턴 분석 + 4시간 시황 분석 모듈
// ============================================
// 다른 프로젝트에서 사용 가능한 독립 모듈
//
// 사용법:
// 1. 설정값 수정 (BOT_TOKEN, CHANNEL_ID 등)
// 2. 텔레그램 봇 연동 시 sendMessage 함수 사용
// 3. Cloudflare Workers에서 scheduled() 함수로 cron 실행
// ============================================

// ============================================
// 설정 (다른 프로젝트에 맞게 수정)
// ============================================
const CONFIG = {
  BOT_TOKEN: "YOUR_BOT_TOKEN",         // 텔레그램 봇 토큰
  FREE_CHANNEL_ID: "@YOUR_CHANNEL",    // 무료 채널 ID
  ADMIN_ID: 123456789,                 // 관리자 Chat ID
};

// ============================================
// 텔레그램 메시지 발송
// ============================================
async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });
}

// ============================================
// [기능1] 4시간 시황 분석 (Cron용)
// ============================================

// 스케줄 작업 실행 함수 (API 호출 없이 빠르게)
async function runScheduledAnalysis() {
  const now = new Date();
  const kstHours = (now.getUTCHours() + 9) % 24;
  const timeStr = `${kstHours.toString().padStart(2, '0')}:00`;

  try {
    await sendSimpleAnalysis(timeStr);
    await sendMessage(CONFIG.ADMIN_ID, `✅ Cron 완료! (${timeStr} KST)`);
  } catch (error) {
    await sendMessage(CONFIG.ADMIN_ID, `❌ Cron 실패: ${error.message}`);
  }
}

// 간단한 4시간 분석 메시지 (API 없이 - 안정적)
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

📢 ${CONFIG.FREE_CHANNEL_ID}`;

  await sendMessage(CONFIG.FREE_CHANNEL_ID, analysis);
}

// 타임아웃 fetch 헬퍼
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

// 4시간 분석 (CoinGecko API 버전 - 불안정할 수 있음)
async function send4HourAnalysisWithAPI() {
  const maxRetries = 2;
  let lastError = null;
  let btcData = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const simpleUrl = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true`;

      const response = await fetchWithTimeout(simpleUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Trading-Bot/1.0'
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

🎯 관점

${changePercent > 0 ? '✅ 상승 추세' : '⚠️ 하락 추세'}
${position < 30 ? '✅ 매수 적합 구간' : position > 70 ? '⚠️ 매도 적합 구간' : '• 중립 구간'}
${rsi < 30 ? '✅ 과매도 반등 기대' : rsi > 70 ? '⚠️ 과매수 조정 주의' : '• RSI 중립'}

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;

  } else {
    success = false;
    analysis = `📊 BTC 4시간봉 리포트 (${timeStr} KST)

━━━━━━━━━━━━━━━━

⏰ 정기 분석 시간입니다!

📈 현재 시장 상황을 확인해보세요.

━━━━━━━━━━━━━━━━

🎯 체크리스트

□ TradingView 지표 확인
□ Smart Trail 색상 확인
□ 1H/4H 추세 방향 확인
□ 위치(DISC/PREM) 확인

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;
  }

  await sendMessage(CONFIG.FREE_CHANNEL_ID, analysis);
  return { success, error: lastError };
}


// ============================================
// [기능2] 패턴 분석
// ============================================

// OKX 캔들 데이터 가져오기
async function getOKXCandles(symbol = 'BTC-USDT', interval = '4H', limit = 200) {
  try {
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
    totalRange: (totalRange / current.close) * 100
  };
}

// 유사도 점수 계산 (0~100)
function calculateSimilarity(features1, features2) {
  const weights = {
    volRatio: 25,
    position: 20,
    priceChange: 15,
    bodyRatio: 10,
    upCount: 15,
    upperWickRatio: 7.5,
    lowerWickRatio: 7.5
  };

  let totalScore = 0;

  const volDiff = Math.abs(features1.volRatio - features2.volRatio);
  const volScore = Math.max(0, 100 - volDiff * 30);
  totalScore += volScore * (weights.volRatio / 100);

  const posDiff = Math.abs(features1.position - features2.position);
  const posScore = Math.max(0, 100 - posDiff);
  totalScore += posScore * (weights.position / 100);

  const priceDiff = Math.abs(features1.priceChange - features2.priceChange);
  const priceScore = Math.max(0, 100 - priceDiff * 20);
  totalScore += priceScore * (weights.priceChange / 100);

  const bodyDiff = Math.abs(features1.bodyRatio - features2.bodyRatio);
  const bodyScore = Math.max(0, 100 - bodyDiff * 100);
  totalScore += bodyScore * (weights.bodyRatio / 100);

  const trendDiff = Math.abs(features1.upCount - features2.upCount);
  const trendScore = Math.max(0, 100 - trendDiff * 20);
  totalScore += trendScore * (weights.upCount / 100);

  const upperDiff = Math.abs(features1.upperWickRatio - features2.upperWickRatio);
  const lowerDiff = Math.abs(features1.lowerWickRatio - features2.lowerWickRatio);
  totalScore += Math.max(0, 100 - upperDiff * 100) * (weights.upperWickRatio / 100);
  totalScore += Math.max(0, 100 - lowerDiff * 100) * (weights.lowerWickRatio / 100);

  return totalScore;
}

// 유사 패턴 찾기 및 이후 움직임 분석
function findSimilarPatterns(candles, currentFeatures, minSimilarity = 60) {
  const results = [];

  for (let i = 25; i < candles.length - 25; i++) {
    const pastFeatures = extractPatternFeatures(candles, i);
    if (!pastFeatures) continue;

    const similarity = calculateSimilarity(currentFeatures, pastFeatures);

    if (similarity >= minSimilarity) {
      const price0 = candles[i].close;

      const after5 = i + 5 < candles.length ? candles[i + 5].close : null;
      const after10 = i + 10 < candles.length ? candles[i + 10].close : null;
      const after20 = i + 20 < candles.length ? candles[i + 20].close : null;

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

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, 15);
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
    upProb5: validCount5 > 0 ? Math.round((upCount5 / validCount5) * 100) : 0,
    avgChange5: validCount5 > 0 ? (totalChange5 / validCount5).toFixed(2) : 0,
    upProb10: validCount10 > 0 ? Math.round((upCount10 / validCount10) * 100) : 0,
    avgChange10: validCount10 > 0 ? (totalChange10 / validCount10).toFixed(2) : 0,
    avgMaxUp: (totalMaxUp / patterns.length).toFixed(2),
    avgMaxDown: (totalMaxDown / patterns.length).toFixed(2)
  };
}

// /패턴 명령어 처리 (메인 함수)
async function handlePatternCommand(coinInput = 'BTC') {
  const symbol = coinInput.toUpperCase() + '-USDT';

  try {
    const candles = await getOKXCandles(symbol, '4H', 100);

    if (candles && candles.error) {
      return `❌ ${coinInput} 캔들 오류: ${candles.error}`;
    }

    if (!candles || !Array.isArray(candles) || candles.length < 50) {
      return `❌ ${coinInput} 캔들 데이터 부족 (${candles?.length || 0}개)`;
    }

    const currentIndex = candles.length - 1;
    const currentFeatures = extractPatternFeatures(candles, currentIndex);

    if (!currentFeatures) {
      return `❌ 패턴 분석에 필요한 데이터가 부족합니다.`;
    }

    const similarPatterns = findSimilarPatterns(candles, currentFeatures, 55);
    const stats = calculatePatternStats(similarPatterns);

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
// Cloudflare Workers용 Export (선택사항)
// ============================================
// Cloudflare Workers에서 사용하려면 아래 주석 해제

/*
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 4시간 분석 수동 테스트
    if (url.pathname === '/test4h') {
      ctx.waitUntil(runScheduledAnalysis());
      return new Response('4시간 분석 발송 완료!');
    }

    // 패턴 분석 테스트
    if (url.pathname === '/pattern') {
      const coin = url.searchParams.get('coin') || 'BTC';
      const result = await handlePatternCommand(coin);
      return new Response(result);
    }

    return new Response('Trading Analysis Module');
  },

  // 스케줄 트리거 (4시간마다)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduledAnalysis());
  }
};
*/


// ============================================
// Node.js / 다른 환경용 Export
// ============================================
// module.exports = {
//   CONFIG,
//   sendMessage,
//   runScheduledAnalysis,
//   sendSimpleAnalysis,
//   send4HourAnalysisWithAPI,
//   handlePatternCommand,
//   getOKXCandles,
//   calculateRSI,
//   calculateSMA,
//   extractPatternFeatures,
//   findSimilarPatterns,
//   calculatePatternStats
// };
