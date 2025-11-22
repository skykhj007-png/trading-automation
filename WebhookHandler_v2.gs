/**
 * TradingView Webhook 핸들러 v2 - 중복/반대 신호 처리
 * TradingView 알람 → Webhook → 알림 + 구글 시트 기록
 *
 * ⚠️ 실제 매매는 수동으로 진행
 * 📊 신호만 구글 시트에 기록
 * 🔔 알림으로 신호 수신
 * 🆕 중복 신호 필터링
 * 🆕 반대 신호 처리
 */

// ============================================
// 설정
// ============================================

const SIGNAL_CONFIG = {
  DUPLICATE_WINDOW: 30,  // 중복 신호 무시 시간 (분)
  ALLOW_REVERSE: true,   // 반대 신호 시 기존 포지션 청산 허용
  MIN_SIGNAL_INTERVAL: 5 // 최소 신호 간격 (분)
};

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
    message: 'TradingView Webhook Handler v2 (Signal Only Mode)',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// 중복/반대 신호 체크
// ============================================

/**
 * 마지막 신호와 비교하여 중복/반대 여부 확인
 */
function checkSignalConflict(newSignal) {
  const props = PropertiesService.getScriptProperties();
  const lastSignalStr = props.getProperty('LAST_SIGNAL');

  if (!lastSignalStr) {
    return { isDuplicate: false, isReverse: false };
  }

  const lastSignal = JSON.parse(lastSignalStr);
  const now = new Date();
  const lastTime = new Date(lastSignal.signalTime);
  const minutesAgo = (now - lastTime) / 1000 / 60;

  // 중복 신호 체크
  const isDuplicate =
    lastSignal.signal === newSignal.signal &&
    minutesAgo < SIGNAL_CONFIG.DUPLICATE_WINDOW;

  // 반대 신호 체크
  const isReverse =
    lastSignal.signal !== newSignal.signal &&
    minutesAgo < SIGNAL_CONFIG.DUPLICATE_WINDOW;

  return {
    isDuplicate: isDuplicate,
    isReverse: isReverse,
    lastSignal: lastSignal,
    minutesAgo: minutesAgo
  };
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

  // 🆕 중복/반대 신호 체크
  const conflict = checkSignalConflict(data);

  // 중복 신호 처리
  if (conflict.isDuplicate) {
    Logger.log(`⚠️ 중복 신호 감지: ${conflict.minutesAgo.toFixed(1)}분 전에 동일 신호`);

    const message = `⚠️ 중복 신호 무시\n\n` +
                    `신호: ${data.signal}\n` +
                    `진입가: ${parseFloat(data.entry).toLocaleString()}\n\n` +
                    `${conflict.minutesAgo.toFixed(0)}분 전에 동일한 신호가 있었습니다.\n` +
                    `이전 신호: ${conflict.lastSignal.entryPrice.toLocaleString()}\n\n` +
                    `중복 무시됨`;

    sendNotification('⚠️ 중복 신호', message);

    return { action: 'duplicate', reason: '중복 신호 무시' };
  }

  // 반대 신호 처리
  if (conflict.isReverse) {
    Logger.log(`⚠️ 반대 신호 감지: ${conflict.lastSignal.signal} → ${data.signal}`);

    if (SIGNAL_CONFIG.ALLOW_REVERSE) {
      const message = `🔄 반대 신호 발생!\n\n` +
                      `기존: ${conflict.lastSignal.signal} @ ${conflict.lastSignal.entryPrice.toLocaleString()}\n` +
                      `새신호: ${data.signal} @ ${parseFloat(data.entry).toLocaleString()}\n\n` +
                      `⚠️ 기존 ${conflict.lastSignal.signal} 포지션을 수동 청산하고\n` +
                      `새로운 ${data.signal} 신호를 확인하세요!\n\n` +
                      `시간차: ${conflict.minutesAgo.toFixed(0)}분`;

      sendNotification('🔄 반대 신호', message);

      // 반대 신호도 기록 (사용자가 판단)
      if (data.signal === 'LONG') {
        return recordLongSignal(data, true);  // 반대 신호 플래그
      } else {
        return recordShortSignal(data, true);
      }
    } else {
      const message = `⚠️ 반대 신호 무시\n\n` +
                      `기존: ${conflict.lastSignal.signal}\n` +
                      `새신호: ${data.signal}\n\n` +
                      `반대 신호 처리가 비활성화되어 있습니다.\n` +
                      `설정에서 ALLOW_REVERSE를 true로 변경하세요.`;

      sendNotification('⚠️ 반대 신호 무시', message);

      return { action: 'reverse_disabled', reason: '반대 신호 처리 비활성화' };
    }
  }

  // 정상 신호 처리
  if (data.signal === 'LONG') {
    return recordLongSignal(data, false);
  }

  if (data.signal === 'SHORT') {
    return recordShortSignal(data, false);
  }

  return { action: 'no_action', reason: '처리할 신호 없음' };
}

/**
 * LONG 신호 기록 (매매 없이 알림 + 기록만)
 */
function recordLongSignal(data, isReverse = false) {
  const market = CONFIG.TRADING.MARKET;
  const entryPrice = parseFloat(data.entry);
  const tp1Price = parseFloat(data.tp1);
  const tp2Price = parseFloat(data.tp2);
  const slPrice = parseFloat(data.sl);

  Logger.log('\n📊 LONG 신호 기록' + (isReverse ? ' (반대 신호)' : ''));

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
    totalScore: data.totalScore || 0,
    isReverse: isReverse
  }));

  // 📱 알림 전송
  const reverseWarning = isReverse ? '\n\n🔄 반대 신호! 기존 SHORT 청산 필요!' : '';

  const message = `🚀 LONG 신호 발생!${reverseWarning}\n\n` +
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
  logSignalToSheet(data, entryPrice, isReverse);

  Logger.log('✅ LONG 신호 기록 완료');

  return {
    action: 'long_signal_recorded',
    market: market,
    entryPrice: entryPrice,
    tp1: tp1Price,
    tp2: tp2Price,
    sl: slPrice,
    mode: 'signal_only',
    isReverse: isReverse
  };
}

/**
 * SHORT 신호 기록 (매매 없이 알림 + 기록만)
 */
function recordShortSignal(data, isReverse = false) {
  const market = CONFIG.TRADING.MARKET;
  const entryPrice = parseFloat(data.entry);
  const tp1Price = parseFloat(data.tp1);
  const tp2Price = parseFloat(data.tp2);
  const slPrice = parseFloat(data.sl);

  Logger.log('\n📊 SHORT 신호 기록' + (isReverse ? ' (반대 신호)' : ''));

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
    totalScore: data.totalScore || 0,
    isReverse: isReverse
  }));

  // 📱 알림 전송
  const reverseWarning = isReverse ? '\n\n🔄 반대 신호! 기존 LONG 청산 필요!' : '';

  const message = `🔻 SHORT 신호 발생!${reverseWarning}\n\n` +
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
  logSignalToSheet(data, entryPrice, isReverse);

  Logger.log('✅ SHORT 신호 기록 완료');

  return {
    action: 'short_signal_recorded',
    market: market,
    entryPrice: entryPrice,
    tp1: tp1Price,
    tp2: tp2Price,
    sl: slPrice,
    mode: 'signal_only',
    isReverse: isReverse
  };
}

// ============================================
// 구글 시트 신호 기록
// ============================================

/**
 * 구글 시트에 신호만 기록 (진입 없음)
 */
function logSignalToSheet(data, entryPrice, isReverse = false) {
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

    // 비고 텍스트
    let remarkText = '수동 매매 대기';
    if (isReverse) {
      remarkText = '🔄 반대 신호 - 기존 포지션 청산 필요!';
    }

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
      remarkText
    ];

    sheet.appendRow(row);

    // 스타일 적용
    const lastRow = sheet.getLastRow();
    if (isReverse) {
      // 반대 신호는 노란색 배경
      sheet.getRange(lastRow, 1, 1, row.length).setBackground('#FFF9C4');
    } else if (data.signal === 'LONG') {
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
// 관리 함수
// ============================================

/**
 * 마지막 신호 확인
 */
function checkLastSignal() {
  const props = PropertiesService.getScriptProperties();
  const lastSignal = props.getProperty('LAST_SIGNAL');

  if (lastSignal) {
    const signal = JSON.parse(lastSignal);
    const now = new Date();
    const signalTime = new Date(signal.signalTime);
    const minutesAgo = (now - signalTime) / 1000 / 60;

    Logger.log('마지막 신호:');
    Logger.log(`신호: ${signal.signal}`);
    Logger.log(`진입가: ${signal.entryPrice}`);
    Logger.log(`시간: ${minutesAgo.toFixed(0)}분 전`);
    Logger.log(`반대신호: ${signal.isReverse ? 'Yes' : 'No'}`);
    Logger.log(JSON.stringify(signal, null, 2));
  } else {
    Logger.log('저장된 신호 없음');
  }
}

/**
 * 마지막 신호 삭제 (초기화)
 */
function clearLastSignal() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('LAST_SIGNAL');
  Logger.log('✅ 마지막 신호 삭제 완료');
}

// ============================================
// 테스트 함수
// ============================================

/**
 * 중복 신호 테스트
 */
function testDuplicateSignal() {
  Logger.log('=== 중복 신호 테스트 ===\n');

  // 첫 번째 LONG 신호
  const signal1 = {
    signal: 'LONG',
    entry: '95000000',
    totalScore: '15.5',
    signal_strength: '9',
    volume_ratio: '2.5',
    smart_money: 'WHALE',
    market_phase: 'ACCUMULATION',
    tp1: '95760000',
    tp2: '96425000',
    sl: '94715000'
  };

  Logger.log('1차 LONG 신호 전송...');
  processWebhookSignal(signal1);

  Logger.log('\n5초 후 동일한 LONG 신호 전송...');
  Utilities.sleep(5000);

  const signal2 = {
    signal: 'LONG',
    entry: '95100000',  // 가격만 약간 다름
    totalScore: '16.0',
    signal_strength: '9',
    volume_ratio: '2.8',
    smart_money: 'WHALE',
    market_phase: 'ACCUMULATION',
    tp1: '95860000',
    tp2: '96525000',
    sl: '94800000'
  };

  processWebhookSignal(signal2);  // 중복으로 무시될 것
}

/**
 * 반대 신호 테스트
 */
function testReverseSignal() {
  Logger.log('=== 반대 신호 테스트 ===\n');

  // LONG 신호
  const longSignal = {
    signal: 'LONG',
    entry: '95000000',
    totalScore: '15.5',
    signal_strength: '9',
    volume_ratio: '2.5',
    smart_money: 'WHALE',
    market_phase: 'ACCUMULATION',
    tp1: '95760000',
    tp2: '96425000',
    sl: '94715000'
  };

  Logger.log('LONG 신호 전송...');
  processWebhookSignal(longSignal);

  Logger.log('\n5초 후 반대 SHORT 신호 전송...');
  Utilities.sleep(5000);

  const shortSignal = {
    signal: 'SHORT',
    entry: '95500000',
    totalScore: '16.0',
    signal_strength: '9',
    volume_ratio: '3.0',
    smart_money: 'INSTITUTION',
    market_phase: 'DISTRIBUTION',
    tp1: '94736000',
    tp2: '94067500',
    sl: '95786500'
  };

  processWebhookSignal(shortSignal);  // 반대 신호 경고
}

/**
 * 🆕 수동 Webhook 테스트 (실제 Webhook 시뮬레이션)
 */
function testWebhook() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 수동 Webhook 테스트 시작');
  Logger.log('='.repeat(60));

  // 실제 TradingView에서 보낼 것과 동일한 데이터
  const testData = {
    version: '24',
    date: '2024-11-22',
    time: '15:30',
    signal: 'LONG',
    entry: '95000000',
    tp1: '95760000',
    tp2: '96425000',
    sl: '94715000',
    trend15m: 'BULL',
    trend5m: 'BULL',
    stochRSI_k: '25.3',
    stochRSI_signal: 'GOLDEN_CROSS',
    bb_width: '1.25',
    bb_squeeze: 'false',
    scalping_rsi: '28.5',
    bb_signal: 'BB_REVERSAL',
    volume_ratio: '2.5',
    smart_money: 'WHALE',
    buy_pressure: '72.5',
    market_phase: 'ACCUMULATION',
    totalScore: '15.5',
    signal_strength: '9'
  };

  Logger.log('\n📨 테스트 데이터:');
  Logger.log(JSON.stringify(testData, null, 2));

  Logger.log('\n🔄 신호 처리 중...\n');

  // 신호 처리
  const result = processWebhookSignal(testData);

  Logger.log('\n' + '='.repeat(60));
  Logger.log('✅ 처리 결과:');
  Logger.log(JSON.stringify(result, null, 2));
  Logger.log('='.repeat(60));

  Logger.log('\n📊 구글 시트 "신호기록" 탭을 확인하세요!');
  Logger.log('🔔 알림 설정이 되어있다면 알림도 확인하세요!');
}

/**
 * 🆕 SHORT 신호 수동 테스트
 */
function testWebhookShort() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 SHORT 신호 수동 테스트');
  Logger.log('='.repeat(60));

  const testData = {
    version: '24',
    date: '2024-11-22',
    time: '16:45',
    signal: 'SHORT',
    entry: '96000000',
    tp1: '95232000',
    tp2: '94560000',
    sl: '96288000',
    trend15m: 'BEAR',
    trend5m: 'BEAR',
    stochRSI_k: '85.7',
    stochRSI_signal: 'DEATH_CROSS',
    bb_width: '1.35',
    bb_squeeze: 'false',
    scalping_rsi: '72.0',
    bb_signal: 'BB_REVERSAL',
    volume_ratio: '3.0',
    smart_money: 'INSTITUTION',
    sell_pressure: '75.0',
    market_phase: 'DISTRIBUTION',
    totalScore: '16.0',
    signal_strength: '9'
  };

  Logger.log('\n📨 SHORT 테스트 데이터:');
  Logger.log(JSON.stringify(testData, null, 2));

  Logger.log('\n🔄 신호 처리 중...\n');

  const result = processWebhookSignal(testData);

  Logger.log('\n' + '='.repeat(60));
  Logger.log('✅ 처리 결과:');
  Logger.log(JSON.stringify(result, null, 2));
  Logger.log('='.repeat(60));

  Logger.log('\n📊 구글 시트 "신호기록" 탭을 확인하세요!');
}

/**
 * 🆕 약한 신호 테스트 (필터링)
 */
function testWeakSignal() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 약한 신호 테스트 (필터링)');
  Logger.log('='.repeat(60));

  const testData = {
    version: '24',
    date: '2024-11-22',
    time: '17:00',
    signal: 'LONG',
    entry: '95000000',
    tp1: '95760000',
    tp2: '96425000',
    sl: '94715000',
    volume_ratio: '1.5',
    smart_money: 'NONE',
    totalScore: '10.0',  // 낮은 점수
    signal_strength: '5'
  };

  Logger.log('\n📨 약한 신호 데이터 (점수: 10.0):');
  Logger.log(JSON.stringify(testData, null, 2));

  Logger.log('\n🔄 신호 처리 중...\n');

  const result = processWebhookSignal(testData);

  Logger.log('\n' + '='.repeat(60));
  Logger.log('✅ 처리 결과:');
  Logger.log(JSON.stringify(result, null, 2));
  Logger.log('='.repeat(60));

  Logger.log('\n⚠️ 신호 강도 부족으로 무시되어야 합니다.');
  Logger.log('📊 구글 시트에 기록되지 않아야 합니다.');
}

/**
 * 🆕 전체 시나리오 테스트 (순차 실행)
 */
function testAllScenarios() {
  Logger.log('\n\n');
  Logger.log('🎯 전체 시나리오 테스트 시작');
  Logger.log('='.repeat(60));

  // 1. 약한 신호 (무시)
  Logger.log('\n【1/5】 약한 신호 테스트...');
  testWeakSignal();

  Utilities.sleep(3000);

  // 2. LONG 신호 (정상)
  Logger.log('\n\n【2/5】 정상 LONG 신호 테스트...');
  testWebhook();

  Utilities.sleep(3000);

  // 3. 중복 LONG 신호 (무시)
  Logger.log('\n\n【3/5】 중복 LONG 신호 테스트...');
  const duplicateLong = {
    signal: 'LONG',
    entry: '95100000',
    totalScore: '15.0',
    signal_strength: '8',
    volume_ratio: '2.3',
    smart_money: 'WHALE',
    market_phase: 'ACCUMULATION',
    tp1: '95860000',
    tp2: '96525000',
    sl: '94800000'
  };
  processWebhookSignal(duplicateLong);

  Utilities.sleep(3000);

  // 4. 반대 SHORT 신호 (경고)
  Logger.log('\n\n【4/5】 반대 SHORT 신호 테스트...');
  testWebhookShort();

  Utilities.sleep(3000);

  // 5. 마지막 신호 확인
  Logger.log('\n\n【5/5】 마지막 신호 확인...');
  checkLastSignal();

  Logger.log('\n\n');
  Logger.log('='.repeat(60));
  Logger.log('✅ 전체 테스트 완료!');
  Logger.log('='.repeat(60));
  Logger.log('\n📊 구글 시트 "신호기록" 탭을 확인하세요!');
  Logger.log('예상 기록 수: 2개 (LONG 1개, SHORT 1개)');
  Logger.log('- 약한 신호: 기록 안 됨');
  Logger.log('- 중복 신호: 기록 안 됨');
  Logger.log('- 반대 신호: 노란색으로 기록됨');
}
