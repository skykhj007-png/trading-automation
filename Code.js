/**
 * Trading Automation with Google Apps Script
 * 거래소 API를 활용한 자동 거래 시스템
 */

// ============================================
// 설정 (Configuration)
// ============================================

const CONFIG = {
  // 거래소 API 설정
  EXCHANGE: {
    NAME: 'upbit', // 'upbit', 'binance', etc.
    API_KEY: '', // TradingView 설정 후 입력 예정
    SECRET_KEY: '', // TradingView 설정 후 입력 예정
    BASE_URL: 'https://api.upbit.com/v1'
  },

  // ========================================
  // 선물 거래 설정 - 통합 전략
  // ========================================
  TRADING: {
    MARKET: 'KRW-BTC', // 거래할 마켓

    // 레버리지 및 포지션 관리
    LEVERAGE: 5, // 레버리지 배수 (1~20)
    RISK_PERCENT: 20.0, // 계좌 대비 투입 비율 (%)
    ORDER_AMOUNT: 10000, // 주문 금액 (KRW)

    // 손익 설정 (클로드21 기준)
    TP1_PERCENT: 0.8,  // 1차 익절 (50% 물량)
    TP2_PERCENT: 1.5,  // 2차 익절 (나머지 50%)
    STOP_LOSS_PERCENT: 0.3, // 손절

    // 불장단타왕 설정 (스윙용)
    SWING_TP_PERCENT: 7,    // 스윙 익절 목표
    SWING_SL_PERCENT: -1,   // 스윙 손절

    // 이동평균선 설정 (불장단타왕)
    MA_PERIODS: [7, 15, 50, 100, 200, 400],
    VWAP_PERIOD: 100, // VWAP 기준선

    // 핵심 기준선
    KEY_MA: {
      SHORT: 50,   // 50선
      VWAP: 100,   // VWAP 100선 (가장 중요)
      LONG: 200    // 200선
    },

    // 신호 강도 임계값
    MIN_SIGNAL_STRENGTH: 12, // 최소 신호 강도 (높을수록 보수적)
    STRICT_MODE: true,       // 엄격 모드 (두 전략 모두 일치 필요)
  },

  // 알림 설정
  NOTIFICATION: {
    ENABLED: true,
    EMAIL: '', // 알림 받을 이메일
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_CHAT_ID: ''
  },

  // 로그 설정
  LOGGING: {
    SHEET_NAME: 'TradingLog',
    ENABLED: true
  }
};

// ============================================
// API 요청 (API Requests)
// ============================================

/**
 * Upbit API 요청
 */
function upbitApiRequest(endpoint, method = 'GET', params = {}) {
  const url = CONFIG.EXCHANGE.BASE_URL + endpoint;

  // JWT 토큰 생성
  const token = generateUpbitToken(params);

  const options = {
    method: method,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };

  if (method === 'GET' && Object.keys(params).length > 0) {
    const queryString = Object.keys(params)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
      .join('&');
    url += '?' + queryString;
  } else if (method === 'POST') {
    options.payload = JSON.stringify(params);
  }

  try {
    const response = UrlFetchApp.fetch(url, options);
    return JSON.parse(response.getContentText());
  } catch (error) {
    logError('API 요청 실패: ' + error.toString());
    return null;
  }
}

/**
 * Upbit JWT 토큰 생성
 */
function generateUpbitToken(params) {
  // JWT 토큰 생성 로직
  // 실제 구현 시 crypto 라이브러리 필요
  const payload = {
    access_key: CONFIG.EXCHANGE.API_KEY,
    nonce: Utilities.getUuid()
  };

  // 간단한 버전 - 실제로는 HMAC SHA512 서명 필요
  return Utilities.base64Encode(JSON.stringify(payload));
}

// ============================================
// 시장 데이터 (Market Data)
// ============================================

/**
 * 현재 시세 조회
 */
function getCurrentPrice(market) {
  const endpoint = '/ticker';
  const params = { markets: market };
  const data = upbitApiRequest(endpoint, 'GET', params);

  if (data && data.length > 0) {
    return {
      price: data[0].trade_price,
      change: data[0].signed_change_rate * 100,
      volume: data[0].acc_trade_volume_24h
    };
  }
  return null;
}

/**
 * 계좌 잔고 조회
 */
function getBalance() {
  const endpoint = '/accounts';
  return upbitApiRequest(endpoint, 'GET');
}

/**
 * 미체결 주문 조회
 */
function getOpenOrders(market) {
  const endpoint = '/orders/open';
  const params = { market: market };
  return upbitApiRequest(endpoint, 'GET', params);
}

// ============================================
// 거래 실행 (Trading Execution)
// ============================================

/**
 * 매수 주문
 */
function buyOrder(market, price, volume) {
  const endpoint = '/orders';
  const params = {
    market: market,
    side: 'bid',
    ord_type: 'limit',
    price: price,
    volume: volume
  };

  const result = upbitApiRequest(endpoint, 'POST', params);

  if (result) {
    logTrade('BUY', market, price, volume, result);
    sendNotification('매수 주문 체결', `${market} ${volume}개 @ ${price}원`);
  }

  return result;
}

/**
 * 매도 주문
 */
function sellOrder(market, price, volume) {
  const endpoint = '/orders';
  const params = {
    market: market,
    side: 'ask',
    ord_type: 'limit',
    price: price,
    volume: volume
  };

  const result = upbitApiRequest(endpoint, 'POST', params);

  if (result) {
    logTrade('SELL', market, price, volume, result);
    sendNotification('매도 주문 체결', `${market} ${volume}개 @ ${price}원`);
  }

  return result;
}

/**
 * 시장가 매수
 */
function marketBuy(market, amount) {
  const endpoint = '/orders';
  const params = {
    market: market,
    side: 'bid',
    ord_type: 'price',
    price: amount
  };

  return upbitApiRequest(endpoint, 'POST', params);
}

/**
 * 시장가 매도
 */
function marketSell(market, volume) {
  const endpoint = '/orders';
  const params = {
    market: market,
    side: 'ask',
    ord_type: 'market',
    volume: volume
  };

  return upbitApiRequest(endpoint, 'POST', params);
}

// ============================================
// 자동 거래 전략 (Trading Strategy)
// ============================================

/**
 * 불장단타왕 전략 - VWAP 100 기반 매매
 * 핵심: VWAP 100선을 기준으로 한 1:7 손익비 매매
 */
function bulJangStrategy() {
  const market = CONFIG.TRADING.MARKET;

  // 충분한 캔들 데이터 조회 (최근 400개 - 400선까지 계산)
  const candles = getCandles(market, 400);

  if (!candles || candles.length < 400) {
    Logger.log('캔들 데이터 부족');
    return;
  }

  const currentPrice = candles[0].trade_price;
  const previousPrice = candles[1].trade_price;

  // 다중 이동평균 계산
  const mas = calculateMultipleMA(candles);
  const vwap100 = mas.VWAP100;
  const ma50 = mas.MA50;
  const ma200 = mas.MA200;

  // POC 계산
  const poc = calculatePOC(candles.slice(0, 100));

  Logger.log(`=== 불장단타왕 전략 분석 ===`);
  Logger.log(`현재가: ${currentPrice.toLocaleString()}`);
  Logger.log(`VWAP 100: ${vwap100 ? vwap100.toLocaleString() : 'N/A'}`);
  Logger.log(`MA 50: ${ma50 ? ma50.toLocaleString() : 'N/A'}`);
  Logger.log(`MA 200: ${ma200 ? ma200.toLocaleString() : 'N/A'}`);
  Logger.log(`POC: ${poc ? poc.price.toLocaleString() : 'N/A'}`);

  if (!vwap100) return;

  // 현재 보유 여부 확인
  const balance = getBalance();
  const hasPosition = balance && balance.some(asset => asset.currency === market.split('-')[1]);

  // === 매수 조건 ===
  // 1. VWAP 100선에 캔들이 닿을 때
  // 2. 하락 추세에서 터닝 포인트 (이평선이 완만해지고 캔들이 반등)
  const touchingVWAP = Math.abs(currentPrice - vwap100) / vwap100 < 0.005; // 0.5% 이내
  const turningPoint = detectTurningPoint(candles, mas);

  if (!hasPosition && touchingVWAP && turningPoint.isTurning) {
    Logger.log('🔵 매수 신호: VWAP 100 터치 + 터닝 포인트');
    Logger.log(`터닝 점수: ${turningPoint.score}`);

    // 매수 실행
    const buyAmount = CONFIG.TRADING.ORDER_AMOUNT;
    marketBuy(market, buyAmount);

    sendNotification('매수 신호', `${market} VWAP 100 기반 매수\n현재가: ${currentPrice.toLocaleString()}\nVWAP 100: ${vwap100.toLocaleString()}`);
    return;
  }

  // === 매도 조건 ===
  if (hasPosition) {
    const asset = balance.find(a => a.currency === market.split('-')[1]);
    const avgBuyPrice = parseFloat(asset.avg_buy_price);
    const profitPercent = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;

    Logger.log(`보유 중 - 평단: ${avgBuyPrice.toLocaleString()}, 수익률: ${profitPercent.toFixed(2)}%`);

    // 1. 익절: +7% 달성
    if (profitPercent >= CONFIG.TRADING.TAKE_PROFIT_PERCENT) {
      Logger.log('🟢 익절 실행: +7% 달성');
      marketSell(market, asset.balance);
      sendNotification('익절 체결', `${market} +${profitPercent.toFixed(2)}%`);
      return;
    }

    // 2. 손절: VWAP 100선이 깨졌을 때 (-1%)
    const breakingVWAP = currentPrice < vwap100 && previousPrice >= vwap100;
    if (breakingVWAP || profitPercent <= CONFIG.TRADING.STOP_LOSS_PERCENT) {
      Logger.log('🔴 손절 실행: VWAP 100 하향 돌파 또는 -1% 달성');
      marketSell(market, asset.balance);
      sendNotification('손절 체결', `${market} ${profitPercent.toFixed(2)}%`);
      return;
    }

    // 3. 마지막 탈출 기회: 반등 후 VWAP 100에 막힐 때 (저항)
    const resistanceAtVWAP = currentPrice <= vwap100 && previousPrice > vwap100 && profitPercent < 0;
    if (resistanceAtVWAP) {
      Logger.log('🟡 탈출 매도: VWAP 100 저항 구간');
      marketSell(market, asset.balance);
      sendNotification('탈출 매도', `${market} VWAP 저항 구간에서 손절`);
      return;
    }
  }

  // === 하락 추세 숏 포지션 신호 (참고용) ===
  // 200선에 닿을 때마다 숏 포지션
  if (ma200 && Math.abs(currentPrice - ma200) / ma200 < 0.005) {
    Logger.log('⚠️ 숏 신호: 200선 터치 (하락 추세)');
  }
}

/**
 * 터닝 포인트 감지
 * 하락 추세에서 반등 시점 포착
 */
function detectTurningPoint(candles, mas) {
  const vwap100 = mas.VWAP100;
  const ma50 = mas.MA50;

  let score = 0;
  let isTurning = false;

  // 1. 이평선이 완만해지는지 확인 (기울기 감소)
  const vwap100Slope = calculateSlope(candles, 100, 10);
  const ma50Slope = calculateSlope(candles, 50, 10);

  if (Math.abs(vwap100Slope) < 0.001) score += 3; // 완만
  if (Math.abs(ma50Slope) < 0.001) score += 2;

  // 2. 캔들이 하락 추세에서 반등하는지 확인
  const recentCandles = candles.slice(0, 5);
  let upCount = 0;
  for (let i = 0; i < recentCandles.length - 1; i++) {
    if (recentCandles[i].trade_price > recentCandles[i + 1].trade_price) {
      upCount++;
    }
  }
  if (upCount >= 3) score += 3; // 최근 5개 중 3개 이상 상승

  // 3. 캔들이 VWAP 100을 뚫고 올라가는지
  const currentPrice = candles[0].trade_price;
  const previousPrice = candles[1].trade_price;
  if (currentPrice > vwap100 && previousPrice <= vwap100) {
    score += 5; // 골든 크로스
  }

  // 4. 정배열 확인 (MA7 > MA15 > MA50)
  const ma7 = mas.MA7;
  const ma15 = mas.MA15;
  if (ma7 && ma15 && ma50 && ma7 > ma15 && ma15 > ma50) {
    score += 4;
  }

  isTurning = score >= 8;

  return { isTurning, score };
}

/**
 * 이동평균선 기울기 계산
 * 완만해지는지 확인하기 위함
 */
function calculateSlope(candles, maPeriod, lookback = 10) {
  const prices = [];
  for (let i = 0; i < lookback; i++) {
    const ma = calculateMA(candles.slice(i), maPeriod);
    if (ma) prices.push(ma);
  }

  if (prices.length < 2) return 0;

  // 선형 회귀 기울기 계산
  const n = prices.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += prices[i];
    sumXY += i * prices[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return slope;
}

/**
 * 평균 회귀 분석
 * 캔들과 이평선의 이격도 계산
 */
function analyzeMeanReversion(currentPrice, ma) {
  if (!ma) return null;

  const deviation = ((currentPrice - ma) / ma) * 100;

  let signal = 'NEUTRAL';
  if (deviation > 10) signal = 'OVERBOUGHT'; // 과매수
  if (deviation < -10) signal = 'OVERSOLD'; // 과매도

  return {
    deviation: deviation.toFixed(2),
    signal: signal
  };
}

// ============================================
// 클로드21 멀티 타임프레임 전략
// ============================================

/**
 * EMA (지수 이동평균) 계산
 */
function calculateEMA(candles, period) {
  if (!candles || candles.length < period) return null;

  const k = 2 / (period + 1);
  let ema = candles[candles.length - 1].trade_price; // 첫 SMA로 시작

  // 최신 캔들부터 역순으로 계산
  for (let i = candles.length - 2; i >= 0; i--) {
    ema = candles[i].trade_price * k + ema * (1 - k);
  }

  return ema;
}

/**
 * RSI (상대강도지수) 계산
 */
function calculateRSI(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  // 첫 period 동안의 평균 gain/loss 계산
  for (let i = 1; i <= period; i++) {
    const change = candles[i - 1].trade_price - candles[i].trade_price;
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return rsi;
}

/**
 * MACD 계산
 */
function calculateMACD(candles, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!candles || candles.length < slowPeriod + signalPeriod) return null;

  const fastEMA = calculateEMA(candles, fastPeriod);
  const slowEMA = calculateEMA(candles, slowPeriod);

  if (!fastEMA || !slowEMA) return null;

  const macdLine = fastEMA - slowEMA;

  // 시그널 라인은 MACD의 EMA
  // 간단한 구현을 위해 생략하고 기본값 사용
  const signalLine = macdLine * 0.9; // 근사값

  const histogram = macdLine - signalLine;

  return {
    macdLine: macdLine,
    signalLine: signalLine,
    histogram: histogram
  };
}

/**
 * VWMA (거래량 가중 이동평균) 계산
 */
function calculateVWMA(candles, period = 20) {
  if (!candles || candles.length < period) return null;

  const relevantCandles = candles.slice(0, period);
  let volumePriceSum = 0;
  let volumeSum = 0;

  relevantCandles.forEach(candle => {
    volumePriceSum += candle.trade_price * candle.candle_acc_trade_volume;
    volumeSum += candle.candle_acc_trade_volume;
  });

  return volumeSum > 0 ? volumePriceSum / volumeSum : null;
}

/**
 * 클로드21 멀티 타임프레임 신호 분석
 */
function claude21MultiTFSignal(mtfCandles) {
  const candles_15m = mtfCandles['15m'];
  const candles_5m = mtfCandles['5m'];
  const candles_3m = mtfCandles['3m'];
  const candles_1m = mtfCandles['1m'];

  if (!candles_15m || !candles_5m || !candles_3m || !candles_1m) {
    return { signal: 'NONE', strength: 0, details: {} };
  }

  // === 15분봉: 주요 트렌드 방향 ===
  const ema20_15m = calculateEMA(candles_15m, 20);
  const ema50_15m = calculateEMA(candles_15m, 50);
  const rsi_15m = calculateRSI(candles_15m, 14);

  const trend_15m_bullish = ema20_15m > ema50_15m && rsi_15m > 45 && rsi_15m < 70;
  const trend_15m_bearish = ema20_15m < ema50_15m && rsi_15m > 30 && rsi_15m < 55;

  // === 5분봉: 중간 트렌드 확인 ===
  const ema20_5m = calculateEMA(candles_5m, 20);
  const ema50_5m = calculateEMA(candles_5m, 50);
  const macd_5m = calculateMACD(candles_5m);
  const rsi_5m = calculateRSI(candles_5m, 14);

  const macd_5m_prev = calculateMACD(candles_5m.slice(1));

  const trend_5m_bullish = ema20_5m > ema50_5m &&
                           macd_5m && macd_5m_prev &&
                           macd_5m.macdLine > macd_5m_prev.macdLine &&
                           rsi_5m > 40;

  const trend_5m_bearish = ema20_5m < ema50_5m &&
                           macd_5m && macd_5m_prev &&
                           macd_5m.macdLine < macd_5m_prev.macdLine &&
                           rsi_5m < 60;

  // === 3분봉: 진입 신호 (EMA 크로스오버) ===
  const ema20_3m = calculateEMA(candles_3m, 20);
  const ema50_3m = calculateEMA(candles_3m, 50);
  const ema20_3m_prev = calculateEMA(candles_3m.slice(1), 20);
  const ema50_3m_prev = calculateEMA(candles_3m.slice(1), 50);
  const macd_3m = calculateMACD(candles_3m);

  const signal_3m_long = ema20_3m > ema50_3m &&
                         ema20_3m_prev <= ema50_3m_prev &&
                         macd_3m && macd_3m.macdLine > macd_3m.signalLine;

  const signal_3m_short = ema20_3m < ema50_3m &&
                          ema20_3m_prev >= ema50_3m_prev &&
                          macd_3m && macd_3m.macdLine < macd_3m.signalLine;

  // === 1분봉: 현재 차트 보조 지표 ===
  const rsi_1m = calculateRSI(candles_1m, 14);
  const vwma_1m = calculateVWMA(candles_1m, 20);
  const currentPrice = candles_1m[0].trade_price;

  // === 신호 조합 ===
  let signal = 'NONE';
  let strength = 0;

  // LONG 신호
  const longSignal_basic = signal_3m_long &&
                           rsi_1m > 35 && rsi_1m < 65 &&
                           currentPrice > vwma_1m;

  if (longSignal_basic) {
    strength += 3;
    if (trend_15m_bullish) strength += 3;
    if (trend_5m_bullish) strength += 2;

    if (strength >= 6) { // 엄격 모드: 8, 완화 모드: 5
      signal = 'LONG';
    }
  }

  // SHORT 신호
  const shortSignal_basic = signal_3m_short &&
                            rsi_1m > 35 && rsi_1m < 65 &&
                            currentPrice < vwma_1m;

  if (shortSignal_basic) {
    strength += 3;
    if (trend_15m_bearish) strength += 3;
    if (trend_5m_bearish) strength += 2;

    if (strength >= 6) {
      signal = 'SHORT';
    }
  }

  return {
    signal: signal,
    strength: strength,
    details: {
      trend_15m: trend_15m_bullish ? 'BULL' : trend_15m_bearish ? 'BEAR' : 'NEUTRAL',
      trend_5m: trend_5m_bullish ? 'BULL' : trend_5m_bearish ? 'BEAR' : 'NEUTRAL',
      signal_3m: signal_3m_long ? 'LONG' : signal_3m_short ? 'SHORT' : 'NONE',
      rsi_1m: rsi_1m,
      currentPrice: currentPrice
    }
  };
}

/**
 * 캔들 데이터 조회 (다양한 타임프레임 지원)
 * @param {string} market - 마켓 코드 (예: 'KRW-BTC')
 * @param {number} count - 캔들 개수
 * @param {string} timeframe - 타임프레임 ('1', '3', '5', '15', '60', '240', 'day')
 */
function getCandles(market, count = 20, timeframe = '60') {
  let endpoint;

  if (timeframe === 'day') {
    endpoint = '/candles/days';
  } else {
    endpoint = `/candles/minutes/${timeframe}`;
  }

  const params = {
    market: market,
    count: count
  };

  return upbitApiRequest(endpoint, 'GET', params);
}

/**
 * 멀티 타임프레임 캔들 데이터 조회
 */
function getMultiTimeframeCandles(market) {
  return {
    '1m': getCandles(market, 100, '1'),    // 1분봉
    '3m': getCandles(market, 100, '3'),    // 3분봉
    '5m': getCandles(market, 100, '5'),    // 5분봉
    '15m': getCandles(market, 100, '15'),  // 15분봉
    '60m': getCandles(market, 400, '60')   // 1시간봉 (불장단타왕용)
  };
}

/**
 * 이동평균 계산 (SMA)
 */
function calculateMA(candles, period) {
  if (!candles || candles.length < period) return null;
  const prices = candles.slice(0, period).map(c => c.trade_price);
  return prices.reduce((a, b) => a + b, 0) / period;
}

/**
 * VWAP (거래량 가중 이동평균) 계산
 * 불장단타왕 전략의 핵심 지표
 */
function calculateVWAP(candles, period = 100) {
  if (!candles || candles.length < period) return null;

  const relevantCandles = candles.slice(0, period);
  let totalVolumePrice = 0;
  let totalVolume = 0;

  relevantCandles.forEach(candle => {
    const typicalPrice = (candle.high_price + candle.low_price + candle.trade_price) / 3;
    const volume = candle.candle_acc_trade_volume;
    totalVolumePrice += typicalPrice * volume;
    totalVolume += volume;
  });

  return totalVolume > 0 ? totalVolumePrice / totalVolume : null;
}

/**
 * 다중 이동평균선 계산
 */
function calculateMultipleMA(candles) {
  const result = {};

  CONFIG.TRADING.MA_PERIODS.forEach(period => {
    result[`MA${period}`] = calculateMA(candles, period);
  });

  // VWAP 100 추가 (가장 중요)
  result.VWAP100 = calculateVWAP(candles, CONFIG.TRADING.VWAP_PERIOD);

  return result;
}

/**
 * 볼륨 프로파일 POC (Point of Control) 계산
 * 가장 많은 거래량이 발생한 가격대
 */
function calculatePOC(candles, priceStep = 1000) {
  if (!candles || candles.length === 0) return null;

  const volumeProfile = {};

  candles.forEach(candle => {
    const priceLevel = Math.floor(candle.trade_price / priceStep) * priceStep;
    if (!volumeProfile[priceLevel]) {
      volumeProfile[priceLevel] = 0;
    }
    volumeProfile[priceLevel] += candle.candle_acc_trade_volume;
  });

  // 최대 거래량이 발생한 가격대 찾기
  let maxVolume = 0;
  let pocPrice = 0;

  Object.keys(volumeProfile).forEach(price => {
    if (volumeProfile[price] > maxVolume) {
      maxVolume = volumeProfile[price];
      pocPrice = parseFloat(price);
    }
  });

  return { price: pocPrice, volume: maxVolume };
}

// ============================================
// 손익 관리 (Risk Management)
// ============================================

/**
 * 손절/익절 체크
 */
function checkStopLossAndTakeProfit() {
  const balance = getBalance();

  if (!balance) return;

  balance.forEach(asset => {
    if (asset.currency === 'KRW') return;

    const market = `KRW-${asset.currency}`;
    const currentPrice = getCurrentPrice(market);

    if (!currentPrice) return;

    const avgBuyPrice = parseFloat(asset.avg_buy_price);
    const changePercent = ((currentPrice.price - avgBuyPrice) / avgBuyPrice) * 100;

    // 손절
    if (changePercent <= CONFIG.TRADING.STOP_LOSS_PERCENT) {
      Logger.log(`손절 실행: ${market} (${changePercent.toFixed(2)}%)`);
      marketSell(market, asset.balance);
    }

    // 익절
    if (changePercent >= CONFIG.TRADING.TAKE_PROFIT_PERCENT) {
      Logger.log(`익절 실행: ${market} (${changePercent.toFixed(2)}%)`);
      marketSell(market, asset.balance);
    }
  });
}

// ============================================
// 로깅 및 알림 (Logging & Notification)
// ============================================

/**
 * 거래 로그 기록
 */
function logTrade(type, market, price, volume, result) {
  if (!CONFIG.LOGGING.ENABLED) return;

  const sheet = getOrCreateSheet(CONFIG.LOGGING.SHEET_NAME);

  sheet.appendRow([
    new Date(),
    type,
    market,
    price,
    volume,
    price * volume,
    JSON.stringify(result)
  ]);
}

/**
 * 에러 로그
 */
function logError(message) {
  Logger.log('ERROR: ' + message);

  const sheet = getOrCreateSheet('ErrorLog');
  sheet.appendRow([new Date(), message]);
}

/**
 * 시트 가져오기 또는 생성
 */
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);

    if (sheetName === CONFIG.LOGGING.SHEET_NAME) {
      sheet.appendRow(['시간', '유형', '마켓', '가격', '수량', '금액', '결과']);
    } else if (sheetName === 'ErrorLog') {
      sheet.appendRow(['시간', '에러 메시지']);
    }
  }

  return sheet;
}

/**
 * 알림 전송
 */
function sendNotification(title, message) {
  if (!CONFIG.NOTIFICATION.ENABLED) return;

  // 이메일 알림
  if (CONFIG.NOTIFICATION.EMAIL) {
    MailApp.sendEmail({
      to: CONFIG.NOTIFICATION.EMAIL,
      subject: `[Trading Bot] ${title}`,
      body: message
    });
  }

  // 텔레그램 알림
  if (CONFIG.NOTIFICATION.TELEGRAM_BOT_TOKEN) {
    sendTelegramMessage(message);
  }
}

/**
 * 텔레그램 메시지 전송
 */
function sendTelegramMessage(message) {
  const url = `https://api.telegram.org/bot${CONFIG.NOTIFICATION.TELEGRAM_BOT_TOKEN}/sendMessage`;

  const payload = {
    chat_id: CONFIG.NOTIFICATION.TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'HTML'
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  };

  UrlFetchApp.fetch(url, options);
}

// ============================================
// 트리거 설정 (Triggers)
// ============================================

/**
 * 자동 실행 트리거 설정
 * Webhook 기반 자동매매용
 */
function setupTriggers() {
  // 기존 트리거 삭제
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));

  // ⚠️ Webhook 모드에서는 신호 체크 트리거 불필요
  // TradingView에서 Webhook으로 신호를 보내므로
  // 여기서는 포지션 모니터링만 실행

  // 1분마다 포지션 모니터링 (TP/SL 체크)
  ScriptApp.newTrigger('monitorWebhookPosition')
    .timeBased()
    .everyMinutes(1)
    .create();

  Logger.log('✅ Webhook 트리거 설정 완료');
  Logger.log('- 포지션 모니터링: 1분마다');
}

/**
 * 수동 신호 체크 트리거 설정 (Webhook 없이 사용 시)
 */
function setupManualTriggers() {
  // 기존 트리거 삭제
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));

  // 1분마다 시세 체크 및 신호 생성
  ScriptApp.newTrigger('checkPriceAndExecute')
    .timeBased()
    .everyMinutes(1)
    .create();

  // 5분마다 손익 체크
  ScriptApp.newTrigger('checkStopLossAndTakeProfit')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('✅ 수동 트리거 설정 완료');
  Logger.log('- 신호 체크: 1분마다');
  Logger.log('- 손익 체크: 5분마다');
}

/**
 * 선물 거래 통합 전략
 * 불장단타왕 + 클로드21 멀티TF를 결합하여 승률 극대화
 */
function integratedStrategy() {
  const market = CONFIG.TRADING.MARKET;

  Logger.log('='.repeat(60));
  Logger.log('🎯 선물 트레이딩 통합 전략 분석');
  Logger.log('='.repeat(60));

  // === 1. 멀티 타임프레임 캔들 데이터 수집 ===
  const mtfCandles = getMultiTimeframeCandles(market);

  // === 2. 통합 신호 스코어링 시스템 ===
  const signalAnalysis = analyzeIntegratedSignal(mtfCandles, market);

  if (!signalAnalysis) {
    Logger.log('❌ 데이터 부족');
    return;
  }

  // === 3. 신호 출력 ===
  printSignalAnalysis(signalAnalysis);

  // === 4. 매매 실행 판단 ===
  const balance = getBalance();
  const hasPosition = balance && balance.some(asset => asset.currency === market.split('-')[1]);

  // 진입 조건: 신호 강도가 임계값 이상
  if (!hasPosition && signalAnalysis.totalScore >= CONFIG.TRADING.MIN_SIGNAL_STRENGTH) {

    if (signalAnalysis.finalSignal === 'LONG') {
      executeLongEntry(market, signalAnalysis);
    } else if (signalAnalysis.finalSignal === 'SHORT') {
      executeShortEntry(market, signalAnalysis);
    }

  } else if (hasPosition) {
    // 포지션 관리
    managePosition(market, balance, signalAnalysis);
  } else {
    Logger.log(`\n⏸️ 대기: 신호 강도 부족 (${signalAnalysis.totalScore}/${CONFIG.TRADING.MIN_SIGNAL_STRENGTH})`);
  }

  Logger.log('\n' + '='.repeat(60));
}

/**
 * 통합 신호 분석 - 승률 최적화
 */
function analyzeIntegratedSignal(mtfCandles, market) {
  const candles_60m = mtfCandles['60m'];
  const candles_1m = mtfCandles['1m'];

  if (!candles_60m || candles_60m.length < 400 || !candles_1m) {
    return null;
  }

  const currentPrice = candles_60m[0].trade_price;
  const previousPrice = candles_60m[1].trade_price;

  // === 불장단타왕 분석 ===
  const mas = calculateMultipleMA(candles_60m);
  const vwap100 = mas.VWAP100;
  const ma50 = mas.MA50;
  const ma200 = mas.MA200;
  const ma7 = mas.MA7;
  const ma15 = mas.MA15;
  const poc = calculatePOC(candles_60m.slice(0, 100));

  // 불장단타왕 점수 계산 (최대 10점)
  let bulJangScore = 0;
  let bulJangDetails = {};

  // 1. VWAP 100 터치 (3점)
  const touchingVWAP = vwap100 && Math.abs(currentPrice - vwap100) / vwap100 < 0.01;
  if (touchingVWAP) bulJangScore += 3;
  bulJangDetails.vwapTouch = touchingVWAP;

  // 2. 터닝 포인트 (5점)
  const turningPoint = detectTurningPoint(candles_60m, mas);
  if (turningPoint.isTurning) bulJangScore += 5;
  bulJangDetails.turningPoint = turningPoint;

  // 3. 정배열 확인 (2점)
  const isUptrend = ma7 && ma15 && ma50 && ma7 > ma15 && ma15 > ma50;
  if (isUptrend) bulJangScore += 2;
  bulJangDetails.isUptrend = isUptrend;

  // === 클로드21 멀티TF 분석 ===
  const claude21_result = claude21MultiTFSignal(mtfCandles);

  // === 추가 필터링 조건 (승률 향상) ===
  let filterScore = 0;
  let filterDetails = {};

  // 1. 평균 회귀 체크 (과매수/과매도 회피)
  const meanReversion = analyzeMeanReversion(currentPrice, vwap100);
  if (meanReversion && meanReversion.signal === 'NEUTRAL') {
    filterScore += 2;
    filterDetails.meanReversionOK = true;
  } else {
    filterDetails.meanReversionOK = false;
  }

  // 2. POC 지지 확인 (2점)
  const nearPOC = poc && Math.abs(currentPrice - poc.price) / poc.price < 0.02;
  if (nearPOC) {
    filterScore += 2;
    filterDetails.nearPOC = true;
  }

  // 3. 200선 위치 확인 (상승 추세)
  const above200MA = ma200 && currentPrice > ma200;
  if (above200MA) {
    filterScore += 2;
    filterDetails.above200MA = true;
  }

  // === 최종 신호 결정 ===
  let finalSignal = 'NONE';
  let totalScore = bulJangScore + claude21_result.strength + filterScore;

  // LONG 신호: 불장단타왕 + 클로드21 모두 동의
  if (bulJangScore >= 5 && claude21_result.signal === 'LONG') {
    finalSignal = 'LONG';
  }
  // SHORT 신호: 클로드21 SHORT + 불장단타왕 역배열
  else if (claude21_result.signal === 'SHORT' && !isUptrend && currentPrice < ma200) {
    finalSignal = 'SHORT';
    // SHORT는 보수적으로 (선물 트레이딩에서 롱이 더 안전)
    totalScore = totalScore * 0.8;
  }

  return {
    currentPrice: currentPrice,
    previousPrice: previousPrice,
    finalSignal: finalSignal,
    totalScore: totalScore,

    // 세부 점수
    bulJangScore: bulJangScore,
    claude21Score: claude21_result.strength,
    filterScore: filterScore,

    // 세부 분석
    bulJangDetails: bulJangDetails,
    claude21Details: claude21_result.details,
    filterDetails: filterDetails,

    // 기술적 지표
    vwap100: vwap100,
    ma50: ma50,
    ma200: ma200,
    poc: poc,
    meanReversion: meanReversion
  };
}

/**
 * 신호 분석 결과 출력
 */
function printSignalAnalysis(analysis) {
  Logger.log(`\n💰 현재가: ${analysis.currentPrice.toLocaleString()}`);
  Logger.log('─'.repeat(60));

  // 불장단타왕 분석
  Logger.log(`\n📊 불장단타왕 전략 (점수: ${analysis.bulJangScore}/10)`);
  Logger.log(`  VWAP 100: ${analysis.vwap100 ? analysis.vwap100.toLocaleString() : 'N/A'} ${analysis.bulJangDetails.vwapTouch ? '✅ 터치' : '❌'}`);
  Logger.log(`  터닝포인트: ${analysis.bulJangDetails.turningPoint.isTurning ? '✅' : '❌'} (${analysis.bulJangDetails.turningPoint.score}점)`);
  Logger.log(`  정배열: ${analysis.bulJangDetails.isUptrend ? '✅' : '❌'}`);
  Logger.log(`  MA 50: ${analysis.ma50 ? analysis.ma50.toLocaleString() : 'N/A'}`);
  Logger.log(`  MA 200: ${analysis.ma200 ? analysis.ma200.toLocaleString() : 'N/A'}`);
  Logger.log(`  POC: ${analysis.poc ? analysis.poc.price.toLocaleString() : 'N/A'}`);

  // 클로드21 분석
  Logger.log(`\n🎯 클로드21 멀티TF (점수: ${analysis.claude21Score}/8)`);
  Logger.log(`  15분봉: ${analysis.claude21Details.trend_15m}`);
  Logger.log(`  5분봉: ${analysis.claude21Details.trend_5m}`);
  Logger.log(`  3분봉 신호: ${analysis.claude21Details.signal_3m}`);
  Logger.log(`  1분봉 RSI: ${analysis.claude21Details.rsi_1m ? analysis.claude21Details.rsi_1m.toFixed(2) : 'N/A'}`);

  // 필터 분석
  Logger.log(`\n🔍 추가 필터 (점수: ${analysis.filterScore}/6)`);
  Logger.log(`  평균회귀: ${analysis.filterDetails.meanReversionOK ? '✅ 정상' : '❌ 과매수/과매도'}`);
  Logger.log(`  POC 근처: ${analysis.filterDetails.nearPOC ? '✅' : '❌'}`);
  Logger.log(`  200선 위: ${analysis.filterDetails.above200MA ? '✅' : '❌'}`);

  // 최종 판단
  Logger.log(`\n${'='.repeat(60)}`);
  Logger.log(`🎯 최종 신호: ${analysis.finalSignal}`);
  Logger.log(`📊 종합 점수: ${analysis.totalScore.toFixed(1)}/${CONFIG.TRADING.MIN_SIGNAL_STRENGTH} (${analysis.totalScore >= CONFIG.TRADING.MIN_SIGNAL_STRENGTH ? '✅ 진입 가능' : '❌ 대기'})`);
  Logger.log(`${'='.repeat(60)}`);
}

/**
 * LONG 진입 실행
 */
function executeLongEntry(market, analysis) {
  Logger.log(`\n🚀 LONG 진입 실행`);

  const buyAmount = CONFIG.TRADING.ORDER_AMOUNT;
  const result = marketBuy(market, buyAmount);

  if (result) {
    const message = `🔥 통합 전략 LONG 진입\n\n` +
                    `마켓: ${market}\n` +
                    `진입가: ${analysis.currentPrice.toLocaleString()}\n` +
                    `레버리지: ${CONFIG.TRADING.LEVERAGE}x\n\n` +
                    `📊 신호 강도: ${analysis.totalScore.toFixed(1)}점\n` +
                    `  - 불장단타왕: ${analysis.bulJangScore}/10\n` +
                    `  - 클로드21: ${analysis.claude21Score}/8\n` +
                    `  - 필터: ${analysis.filterScore}/6\n\n` +
                    `🎯 목표:\n` +
                    `  TP1: +${CONFIG.TRADING.TP1_PERCENT}% (50%)\n` +
                    `  TP2: +${CONFIG.TRADING.TP2_PERCENT}% (50%)\n` +
                    `  SL: -${CONFIG.TRADING.STOP_LOSS_PERCENT}%`;

    sendNotification('🚀 LONG 진입', message);
  }
}

/**
 * SHORT 진입 실행
 */
function executeShortEntry(market, analysis) {
  Logger.log(`\n🔻 SHORT 진입 실행`);

  const sellAmount = CONFIG.TRADING.ORDER_AMOUNT;
  // SHORT는 업비트에서 지원하지 않으므로 알림만
  Logger.log('⚠️ SHORT는 선물거래소에서만 가능');

  const message = `⚠️ 통합 전략 SHORT 신호\n\n` +
                  `마켓: ${market}\n` +
                  `진입가: ${analysis.currentPrice.toLocaleString()}\n` +
                  `신호 강도: ${analysis.totalScore.toFixed(1)}점\n\n` +
                  `TradingView에서 수동 진입 권장`;

  sendNotification('🔻 SHORT 신호', message);
}

/**
 * 포지션 관리 - 분할 익절
 */
function managePosition(market, balance, analysis) {
  const asset = balance.find(a => a.currency === market.split('-')[1]);
  if (!asset) return;

  const avgBuyPrice = parseFloat(asset.avg_buy_price);
  const currentPrice = analysis.currentPrice;
  const profitPercent = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;

  Logger.log(`\n📈 포지션 관리`);
  Logger.log(`평단가: ${avgBuyPrice.toLocaleString()}`);
  Logger.log(`현재가: ${currentPrice.toLocaleString()}`);
  Logger.log(`수익률: ${profitPercent.toFixed(2)}%`);

  // 1차 익절: TP1 도달 (50% 매도)
  if (profitPercent >= CONFIG.TRADING.TP1_PERCENT) {
    Logger.log(`🟢 TP1 달성! (+${CONFIG.TRADING.TP1_PERCENT}%)`);
    const sellAmount = parseFloat(asset.balance) * 0.5;
    marketSell(market, sellAmount);
    sendNotification('✅ TP1 달성', `${market} +${profitPercent.toFixed(2)}%\n50% 익절 완료`);
    return;
  }

  // 2차 익절: TP2 도달 (나머지 전량 매도)
  if (profitPercent >= CONFIG.TRADING.TP2_PERCENT) {
    Logger.log(`🟢🟢 TP2 달성! (+${CONFIG.TRADING.TP2_PERCENT}%)`);
    marketSell(market, asset.balance);
    sendNotification('✅✅ TP2 달성', `${market} +${profitPercent.toFixed(2)}%\n전량 익절 완료`);
    return;
  }

  // 손절: VWAP 100 하향 돌파
  const breakingVWAP = analysis.vwap100 &&
                       currentPrice < analysis.vwap100 &&
                       analysis.previousPrice >= analysis.vwap100;

  if (breakingVWAP || profitPercent <= -CONFIG.TRADING.STOP_LOSS_PERCENT) {
    Logger.log(`🔴 손절 실행 (-${CONFIG.TRADING.STOP_LOSS_PERCENT}% 또는 VWAP 이탈)`);
    marketSell(market, asset.balance);
    sendNotification('🔴 손절', `${market} ${profitPercent.toFixed(2)}%\nVWAP 100 하향 돌파`);
    return;
  }

  Logger.log(`⏸️ 포지션 유지 중...`);
}

/**
 * 메인 실행 함수 (기존 호환성 유지)
 */
function checkPriceAndExecute() {
  try {
    integratedStrategy();
  } catch (error) {
    logError('통합 전략 실행 오류: ' + error.toString());
    Logger.log(error.stack);
  }
}

// ============================================
// 유틸리티 (Utilities)
// ============================================

/**
 * 포트폴리오 현황 조회
 */
function getPortfolioStatus() {
  const balance = getBalance();

  if (!balance) return;

  let totalKRW = 0;
  const portfolio = [];

  balance.forEach(asset => {
    if (asset.currency === 'KRW') {
      totalKRW = parseFloat(asset.balance);
    } else {
      const market = `KRW-${asset.currency}`;
      const currentPrice = getCurrentPrice(market);

      if (currentPrice) {
        const value = currentPrice.price * parseFloat(asset.balance);
        const profit = ((currentPrice.price - parseFloat(asset.avg_buy_price)) / parseFloat(asset.avg_buy_price)) * 100;

        portfolio.push({
          currency: asset.currency,
          balance: asset.balance,
          avgBuyPrice: asset.avg_buy_price,
          currentPrice: currentPrice.price,
          value: value,
          profit: profit
        });

        totalKRW += value;
      }
    }
  });

  Logger.log(`총 자산: ${totalKRW.toLocaleString()}원`);
  Logger.log(portfolio);

  return { totalKRW, portfolio };
}

/**
 * 테스트 함수 - 통합 전략
 */
function test() {
  Logger.log('=== 통합 전략 Trading Bot Test ===\n');

  const market = CONFIG.TRADING.MARKET;

  // 현재가 조회 테스트
  Logger.log('1. 현재가 조회');
  const price = getCurrentPrice(market);
  Logger.log('현재가:', price);
  Logger.log('');

  // 잔고 조회 테스트
  Logger.log('2. 잔고 조회');
  const balance = getBalance();
  Logger.log('잔고:', balance);
  Logger.log('');

  // 포트폴리오 현황
  Logger.log('3. 포트폴리오 현황');
  getPortfolioStatus();
  Logger.log('');

  // 멀티 타임프레임 캔들 조회 테스트
  Logger.log('4. 멀티 타임프레임 데이터 조회');
  const mtfCandles = getMultiTimeframeCandles(market);
  Logger.log('1분봉:', mtfCandles['1m'] ? mtfCandles['1m'].length + '개' : '없음');
  Logger.log('3분봉:', mtfCandles['3m'] ? mtfCandles['3m'].length + '개' : '없음');
  Logger.log('5분봉:', mtfCandles['5m'] ? mtfCandles['5m'].length + '개' : '없음');
  Logger.log('15분봉:', mtfCandles['15m'] ? mtfCandles['15m'].length + '개' : '없음');
  Logger.log('60분봉:', mtfCandles['60m'] ? mtfCandles['60m'].length + '개' : '없음');
  Logger.log('');

  // 통합 전략 테스트 실행
  Logger.log('5. 통합 전략 실행 테스트');
  integratedStrategy();
}
