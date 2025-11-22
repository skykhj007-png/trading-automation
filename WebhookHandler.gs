/**
 * TradingView Webhook 핸들러
 * TradingView 알람 → Webhook → 자동 매매 실행
 */

// ============================================
// Webhook 엔드포인트
// ============================================

/**
 * POST 요청 처리 (TradingView Webhook)
 */
function doPost(e) {
  try {
    // 요청 데이터 파싱
    const data = JSON.parse(e.postData.contents);

    Logger.log('='.repeat(60));
    Logger.log('📨 Webhook 수신: ' + new Date());
    Logger.log(JSON.stringify(data, null, 2));

    // 신호 검증
    if (!data.signal || !data.entry) {
      logError('잘못된 Webhook 데이터: ' + JSON.stringify(data));
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '필수 데이터 누락'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 신호 처리
    const result = processWebhookSignal(data);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      result: result
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    logError('Webhook 처리 오류: ' + error.toString());
    Logger.log(error.stack);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GET 요청 처리 (테스트용)
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'TradingView Webhook Handler is running',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// Webhook 신호 처리
// ============================================

/**
 * TradingView 신호 처리 및 매매 실행
 */
function processWebhookSignal(data) {
  const market = CONFIG.TRADING.MARKET;

  Logger.log(`\n🎯 신호 처리 시작: ${data.signal}`);
  Logger.log(`진입가: ${data.entry}`);
  Logger.log(`종합 점수: ${data.totalScore || 'N/A'}`);

  // 신호 강도 검증
  const totalScore = parseFloat(data.totalScore) || 0;
  if (totalScore < CONFIG.TRADING.MIN_SIGNAL_STRENGTH) {
    Logger.log(`⚠️ 신호 강도 부족: ${totalScore}/${CONFIG.TRADING.MIN_SIGNAL_STRENGTH}`);
    sendNotification('신호 강도 부족',
      `${data.signal} 신호가 왔지만 강도가 부족합니다.\n` +
      `점수: ${totalScore}/${CONFIG.TRADING.MIN_SIGNAL_STRENGTH}`);
    return { action: 'skipped', reason: '신호 강도 부족' };
  }

  // 현재 포지션 확인
  const balance = getBalance();
  const hasPosition = balance && balance.some(asset =>
    asset.currency === market.split('-')[1]
  );

  // LONG 신호 처리
  if (data.signal === 'LONG' && !hasPosition) {
    return executeLongFromWebhook(data);
  }

  // SHORT 신호 처리 (업비트는 숏 불가)
  if (data.signal === 'SHORT') {
    Logger.log('⚠️ SHORT 신호 - 업비트는 숏 거래 미지원');
    sendNotification('SHORT 신호 감지',
      `진입가: ${data.entry}\n` +
      `점수: ${totalScore}\n\n` +
      `업비트는 숏 거래를 지원하지 않습니다.\n` +
      `선물 거래소에서 수동 진입하세요.`);
    return { action: 'short_signal', reason: '업비트 숏 미지원' };
  }

  // 이미 포지션 보유 중
  if (hasPosition) {
    Logger.log('⚠️ 이미 포지션 보유 중');
    return { action: 'skipped', reason: '포지션 보유 중' };
  }

  return { action: 'no_action', reason: '처리할 신호 없음' };
}

/**
 * Webhook LONG 신호로 매수 실행
 */
function executeLongFromWebhook(data) {
  const market = CONFIG.TRADING.MARKET;

  Logger.log('\n💰 LONG 매수 실행');

  // 매수 금액 계산
  const orderAmount = CONFIG.TRADING.ORDER_AMOUNT;

  // 시장가 매수
  const result = marketBuy(market, orderAmount);

  if (result) {
    // TP/SL 가격 저장 (나중에 사용)
    const entryPrice = parseFloat(data.entry);
    const tp1Price = parseFloat(data.tp1);
    const tp2Price = parseFloat(data.tp2);
    const slPrice = parseFloat(data.sl);

    // PropertiesService에 저장 (포지션 추적용)
    const props = PropertiesService.getScriptProperties();
    props.setProperty('POSITION', JSON.stringify({
      market: market,
      entryPrice: entryPrice,
      tp1Price: tp1Price,
      tp2Price: tp2Price,
      slPrice: slPrice,
      entryTime: new Date().toISOString(),
      bulJangScore: data.bulJangScore || 0,
      claude21Score: data.claude21Score || 0,
      filterScore: data.filterScore || 0,
      totalScore: data.totalScore || 0,
      tp1Hit: false,
      tp2Hit: false
    }));

    // 알림 전송
    const message = `🚀 Webhook LONG 매수 완료\n\n` +
                    `마켓: ${market}\n` +
                    `진입가: ${entryPrice.toLocaleString()}\n` +
                    `주문금액: ${orderAmount.toLocaleString()}원\n\n` +
                    `📊 신호 강도: ${data.totalScore}점\n` +
                    `  - 불장단타왕: ${data.bulJangScore}/10\n` +
                    `  - 클로드21: ${data.claude21Score}/8\n` +
                    `  - 필터: ${data.filterScore}/6\n\n` +
                    `🎯 목표:\n` +
                    `  TP1: ${tp1Price.toLocaleString()} (50%)\n` +
                    `  TP2: ${tp2Price.toLocaleString()} (50%)\n` +
                    `  SL: ${slPrice.toLocaleString()}`;

    sendNotification('🚀 매수 체결', message);

    // 거래 로그 (기존)
    logTrade('WEBHOOK_BUY', market, entryPrice, orderAmount / entryPrice, result);

    // 🆕 구글 시트 진입 기록
    logTradeEntry(data, entryPrice, orderAmount / entryPrice, orderAmount);

    return {
      action: 'long_executed',
      market: market,
      entryPrice: entryPrice,
      orderAmount: orderAmount,
      tp1: tp1Price,
      tp2: tp2Price,
      sl: slPrice
    };
  } else {
    logError('매수 실행 실패');
    sendNotification('❌ 매수 실패', `${market} 매수 주문 실패`);
    return { action: 'failed', reason: '매수 실패' };
  }
}

// ============================================
// 포지션 모니터링 (주기적 실행)
// ============================================

/**
 * 저장된 포지션 TP/SL 모니터링
 */
function monitorWebhookPosition() {
  const props = PropertiesService.getScriptProperties();
  const positionData = props.getProperty('POSITION');

  if (!positionData) {
    Logger.log('모니터링할 포지션 없음');
    return;
  }

  const position = JSON.parse(positionData);
  const market = position.market;

  Logger.log('='.repeat(60));
  Logger.log('📊 포지션 모니터링');
  Logger.log('='.repeat(60));

  // 현재 가격 조회
  const priceData = getCurrentPrice(market);
  if (!priceData) {
    logError('가격 조회 실패');
    return;
  }

  const currentPrice = priceData.price;
  const profitPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

  Logger.log(`진입가: ${position.entryPrice.toLocaleString()}`);
  Logger.log(`현재가: ${currentPrice.toLocaleString()}`);
  Logger.log(`수익률: ${profitPercent.toFixed(2)}%`);
  Logger.log(`TP1: ${position.tp1Price.toLocaleString()} ${position.tp1Hit ? '✅' : ''}`);
  Logger.log(`TP2: ${position.tp2Price.toLocaleString()} ${position.tp2Hit ? '✅' : ''}`);
  Logger.log(`SL: ${position.slPrice.toLocaleString()}`);

  // 잔고 조회
  const balance = getBalance();
  const asset = balance && balance.find(a => a.currency === market.split('-')[1]);

  if (!asset || parseFloat(asset.balance) === 0) {
    Logger.log('⚠️ 포지션이 이미 청산됨');
    props.deleteProperty('POSITION');
    return;
  }

  const holdingAmount = parseFloat(asset.balance);

  // TP1 도달 (50% 매도)
  if (!position.tp1Hit && currentPrice >= position.tp1Price) {
    Logger.log('🟢 TP1 도달!');

    const sellAmount = holdingAmount * 0.5;
    const result = marketSell(market, sellAmount);

    if (result) {
      position.tp1Hit = true;
      props.setProperty('POSITION', JSON.stringify(position));

      sendNotification('✅ TP1 달성',
        `${market}\n` +
        `진입: ${position.entryPrice.toLocaleString()}\n` +
        `현재: ${currentPrice.toLocaleString()}\n` +
        `수익: +${profitPercent.toFixed(2)}%\n\n` +
        `50% 익절 완료`);

      logTrade('TP1', market, currentPrice, sellAmount, result);

      // 🆕 구글 시트 TP1 기록
      logTradeExit('TP1', currentPrice, sellAmount);
    }
    return;
  }

  // TP2 도달 (나머지 전량 매도)
  if (!position.tp2Hit && currentPrice >= position.tp2Price) {
    Logger.log('🟢🟢 TP2 도달!');

    const result = marketSell(market, holdingAmount);

    if (result) {
      sendNotification('✅✅ TP2 달성',
        `${market}\n` +
        `진입: ${position.entryPrice.toLocaleString()}\n` +
        `현재: ${currentPrice.toLocaleString()}\n` +
        `수익: +${profitPercent.toFixed(2)}%\n\n` +
        `전량 익절 완료!`);

      logTrade('TP2', market, currentPrice, holdingAmount, result);

      // 🆕 구글 시트 TP2 기록
      logTradeExit('TP2', currentPrice, holdingAmount);

      // 🆕 통계 업데이트
      addStatsToSheet();

      // 포지션 정리
      props.deleteProperty('POSITION');
    }
    return;
  }

  // SL 도달 (전량 손절)
  if (currentPrice <= position.slPrice) {
    Logger.log('🔴 SL 도달');

    const result = marketSell(market, holdingAmount);

    if (result) {
      sendNotification('🔴 손절 실행',
        `${market}\n` +
        `진입: ${position.entryPrice.toLocaleString()}\n` +
        `현재: ${currentPrice.toLocaleString()}\n` +
        `손실: ${profitPercent.toFixed(2)}%\n\n` +
        `손절가 도달로 전량 청산`);

      logTrade('STOP_LOSS', market, currentPrice, holdingAmount, result);

      // 🆕 구글 시트 손절 기록
      logTradeExit('STOP_LOSS', currentPrice, holdingAmount);

      // 🆕 통계 업데이트
      addStatsToSheet();

      // 포지션 정리
      props.deleteProperty('POSITION');
    }
    return;
  }

  Logger.log('⏸️ 포지션 유지 중...');
}

// ============================================
// 테스트 함수
// ============================================

/**
 * Webhook 테스트
 */
function testWebhook() {
  const testData = {
    signal: 'LONG',
    entry: '95000000',
    totalScore: '15.5',
    bulJangScore: '8',
    claude21Score: '5',
    filterScore: '4',
    tp1: '95760000',  // +0.8%
    tp2: '96425000',  // +1.5%
    sl: '94715000'    // -0.3%
  };

  Logger.log('=== Webhook 테스트 ===');
  Logger.log('테스트 데이터:');
  Logger.log(JSON.stringify(testData, null, 2));

  const result = processWebhookSignal(testData);

  Logger.log('\n결과:');
  Logger.log(JSON.stringify(result, null, 2));
}

/**
 * 포지션 모니터링 테스트
 */
function testPositionMonitoring() {
  Logger.log('=== 포지션 모니터링 테스트 ===');
  monitorWebhookPosition();
}

/**
 * 저장된 포지션 확인
 */
function checkSavedPosition() {
  const props = PropertiesService.getScriptProperties();
  const positionData = props.getProperty('POSITION');

  if (positionData) {
    Logger.log('저장된 포지션:');
    Logger.log(JSON.stringify(JSON.parse(positionData), null, 2));
  } else {
    Logger.log('저장된 포지션 없음');
  }
}

/**
 * 포지션 강제 삭제
 */
function clearPosition() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('POSITION');
  Logger.log('포지션 데이터 삭제 완료');
}
