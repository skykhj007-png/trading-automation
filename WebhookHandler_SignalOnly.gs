/**
 * TradingView Webhook 핸들러 - 신호 기록 전용
 * TradingView 알람 → Webhook → 알림 + 구글 시트 기록
 *
 * ⚠️ 실제 매매는 수동으로 진행
 * 📊 신호만 구글 시트에 기록
 * 🔔 알림으로 신호 수신
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

    // 신호 처리 (기록 전용)
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
    message: 'TradingView Webhook Handler (Signal Only Mode)',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// Webhook 신호 처리 (기록 전용)
// ============================================

/**
 * TradingView 신호 처리 - 알림 + 기록만
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

    // 알림은 보내되 기록은 안 함
    const message = `⚠️ 신호 강도 부족\n\n` +
                    `신호: ${data.signal}\n` +
                    `진입가: ${parseFloat(data.entry).toLocaleString()}\n` +
                    `점수: ${totalScore}/${CONFIG.TRADING.MIN_SIGNAL_STRENGTH}\n\n` +
                    `최소 강도 미달로 무시됨`;

    sendNotification('⚠️ 약한 신호', message);

    return { action: 'skipped', reason: '신호 강도 부족' };
  }

  // LONG 신호 처리
  if (data.signal === 'LONG') {
    return recordLongSignal(data);
  }

  // SHORT 신호 처리
  if (data.signal === 'SHORT') {
    return recordShortSignal(data);
  }

  return { action: 'no_action', reason: '처리할 신호 없음' };
}

/**
 * LONG 신호 기록 (매매 없이 알림 + 기록만)
 */
function recordLongSignal(data) {
  const market = CONFIG.TRADING.MARKET;
  const entryPrice = parseFloat(data.entry);
  const tp1Price = parseFloat(data.tp1);
  const tp2Price = parseFloat(data.tp2);
  const slPrice = parseFloat(data.sl);

  Logger.log('\n📊 LONG 신호 기록');

  // 신호 정보를 PropertiesService에 저장 (참고용)
  const props = PropertiesService.getScriptProperties();
  props.setProperty('LAST_SIGNAL', JSON.stringify({
    signal: 'LONG',
    market: market,
    entryPrice: entryPrice,
    tp1Price: tp1Price,
    tp2Price: tp2Price,
    slPrice: slPrice,
    signalTime: new Date().toISOString(),
    signalStrength: data.signal_strength || 'N/A',
    volumeRatio: data.volume_ratio || 'N/A',
    smartMoney: data.smart_money || 'NONE',
    marketPhase: data.market_phase || 'NEUTRAL',
    totalScore: data.totalScore || 0
  }));

  // 📱 알림 전송
  const message = `🚀 LONG 신호 발생!\n\n` +
                  `마켓: ${market}\n` +
                  `진입가: ${entryPrice.toLocaleString()}\n\n` +
                  `📊 신호 강도: ${data.totalScore}점\n` +
                  `📈 스마트머니: ${data.smart_money || 'N/A'}\n` +
                  `📊 거래량비율: ${data.volume_ratio || 'N/A'}배\n` +
                  `📍 시장상태: ${data.market_phase || 'N/A'}\n\n` +
                  `🎯 목표가:\n` +
                  `  TP1: ${tp1Price.toLocaleString()} (+${((tp1Price - entryPrice) / entryPrice * 100).toFixed(2)}%)\n` +
                  `  TP2: ${tp2Price.toLocaleString()} (+${((tp2Price - entryPrice) / entryPrice * 100).toFixed(2)}%)\n` +
                  `  SL: ${slPrice.toLocaleString()} (${((slPrice - entryPrice) / entryPrice * 100).toFixed(2)}%)\n\n` +
                  `⚠️ 수동 매매 모드: 직접 진입하세요!`;

  sendNotification('🚀 LONG 신호', message);

  // 📊 구글 시트에 신호 기록
  logSignalToSheet(data, entryPrice);

  Logger.log('✅ LONG 신호 기록 완료');

  return {
    action: 'long_signal_recorded',
    market: market,
    entryPrice: entryPrice,
    tp1: tp1Price,
    tp2: tp2Price,
    sl: slPrice,
    mode: 'signal_only'
  };
}

/**
 * SHORT 신호 기록 (매매 없이 알림 + 기록만)
 */
function recordShortSignal(data) {
  const market = CONFIG.TRADING.MARKET;
  const entryPrice = parseFloat(data.entry);
  const tp1Price = parseFloat(data.tp1);
  const tp2Price = parseFloat(data.tp2);
  const slPrice = parseFloat(data.sl);

  Logger.log('\n📊 SHORT 신호 기록');

  // 신호 정보 저장
  const props = PropertiesService.getScriptProperties();
  props.setProperty('LAST_SIGNAL', JSON.stringify({
    signal: 'SHORT',
    market: market,
    entryPrice: entryPrice,
    tp1Price: tp1Price,
    tp2Price: tp2Price,
    slPrice: slPrice,
    signalTime: new Date().toISOString(),
    signalStrength: data.signal_strength || 'N/A',
    volumeRatio: data.volume_ratio || 'N/A',
    smartMoney: data.smart_money || 'NONE',
    marketPhase: data.market_phase || 'NEUTRAL',
    totalScore: data.totalScore || 0
  }));

  // 📱 알림 전송
  const message = `🔻 SHORT 신호 발생!\n\n` +
                  `마켓: ${market}\n` +
                  `진입가: ${entryPrice.toLocaleString()}\n\n` +
                  `📊 신호 강도: ${data.totalScore}점\n` +
                  `📉 스마트머니: ${data.smart_money || 'N/A'}\n` +
                  `📊 거래량비율: ${data.volume_ratio || 'N/A'}배\n` +
                  `📍 시장상태: ${data.market_phase || 'N/A'}\n\n` +
                  `🎯 목표가:\n` +
                  `  TP1: ${tp1Price.toLocaleString()} (${((tp1Price - entryPrice) / entryPrice * 100).toFixed(2)}%)\n` +
                  `  TP2: ${tp2Price.toLocaleString()} (${((tp2Price - entryPrice) / entryPrice * 100).toFixed(2)}%)\n` +
                  `  SL: ${slPrice.toLocaleString()} (+${((slPrice - entryPrice) / entryPrice * 100).toFixed(2)}%)\n\n` +
                  `⚠️ 수동 매매 모드: 직접 진입하세요!`;

  sendNotification('🔻 SHORT 신호', message);

  // 📊 구글 시트에 신호 기록
  logSignalToSheet(data, entryPrice);

  Logger.log('✅ SHORT 신호 기록 완료');

  return {
    action: 'short_signal_recorded',
    market: market,
    entryPrice: entryPrice,
    tp1: tp1Price,
    tp2: tp2Price,
    sl: slPrice,
    mode: 'signal_only'
  };
}

// ============================================
// 구글 시트 신호 기록
// ============================================

/**
 * 구글 시트에 신호만 기록 (진입 없음)
 */
function logSignalToSheet(data, entryPrice) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('신호기록');

    // 신호기록 시트가 없으면 생성
    if (!sheet) {
      sheet = ss.insertSheet('신호기록');

      // 헤더 설정
      const headers = [
        '날짜', '시간', '마켓', '신호', '진입가',
        'TP1', 'TP2', 'SL',
        'TP1(%)', 'TP2(%)', 'SL(%)',
        '신호강도', '거래량비율', '스마트머니', '시장상태', '비고'
      ];

      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#4A90E2')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold')
        .setHorizontalAlignment('center');
    }

    const now = new Date();
    const tp1Price = parseFloat(data.tp1);
    const tp2Price = parseFloat(data.tp2);
    const slPrice = parseFloat(data.sl);

    const tp1Percent = ((tp1Price - entryPrice) / entryPrice * 100).toFixed(2);
    const tp2Percent = ((tp2Price - entryPrice) / entryPrice * 100).toFixed(2);
    const slPercent = ((slPrice - entryPrice) / entryPrice * 100).toFixed(2);

    // 신호 기록
    const row = [
      Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd'),
      Utilities.formatDate(now, 'Asia/Seoul', 'HH:mm:ss'),
      CONFIG.TRADING.MARKET,
      data.signal,
      entryPrice,
      tp1Price,
      tp2Price,
      slPrice,
      tp1Percent + '%',
      tp2Percent + '%',
      slPercent + '%',
      data.signal_strength || 'N/A',
      data.volume_ratio || 'N/A',
      data.smart_money || 'NONE',
      data.market_phase || 'NEUTRAL',
      '수동 매매 대기'
    ];

    sheet.appendRow(row);

    // 스타일 적용
    const lastRow = sheet.getLastRow();
    if (data.signal === 'LONG') {
      sheet.getRange(lastRow, 1, 1, row.length).setBackground('#E8F5E9');
    } else {
      sheet.getRange(lastRow, 1, 1, row.length).setBackground('#FFEBEE');
    }

    Logger.log('✅ 구글 시트에 신호 기록 완료: Row ' + lastRow);

  } catch (error) {
    Logger.log('❌ 신호 기록 실패: ' + error.toString());
  }
}

// ============================================
// 테스트 함수
// ============================================

/**
 * Webhook 테스트 (신호 기록 전용)
 */
function testWebhookSignalOnly() {
  const testData = {
    signal: 'LONG',
    entry: '95000000',
    totalScore: '15.5',
    signal_strength: '9',
    volume_ratio: '2.5',
    smart_money: 'WHALE',
    market_phase: 'ACCUMULATION',
    tp1: '95760000',  // +0.8%
    tp2: '96425000',  // +1.5%
    sl: '94715000'    // -0.3%
  };

  Logger.log('=== Webhook 신호 기록 테스트 ===');
  Logger.log('테스트 데이터:');
  Logger.log(JSON.stringify(testData, null, 2));

  const result = processWebhookSignal(testData);

  Logger.log('\n결과:');
  Logger.log(JSON.stringify(result, null, 2));
}

/**
 * 마지막 신호 확인
 */
function checkLastSignal() {
  const props = PropertiesService.getScriptProperties();
  const lastSignal = props.getProperty('LAST_SIGNAL');

  if (lastSignal) {
    Logger.log('마지막 신호:');
    Logger.log(JSON.stringify(JSON.parse(lastSignal), null, 2));
  } else {
    Logger.log('저장된 신호 없음');
  }
}
