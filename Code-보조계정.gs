/**
 * Trading Signal Logger + 가상매매 시뮬레이션
 * V27 Universal - 선물/현물코인/주식 지원
 * 중복 신호 방지 기능 포함
 */

// ============================================
// ★★★ 처음 설정 시 이 함수 하나만 실행! ★★★
// ============================================

/**
 * 🚀 원클릭 전체 설정
 * - 시트 생성
 * - 트리거 설정
 * - API 연결 테스트
 *
 * ★ 처음 1회만 실행하면 모든 설정 완료! ★
 */
function 원클릭_전체설정() {
  Logger.log('========================================');
  Logger.log('🚀 클로드25 자동매매 원클릭 설정 시작');
  Logger.log('========================================');

  // 1. 시트 생성
  Logger.log('');
  Logger.log('📊 1단계: 시트 생성 중...');
  try {
    initSimulation();
    Logger.log('✅ 시트 생성 완료!');
  } catch (e) {
    Logger.log('⚠️ 시트 생성 오류 (이미 존재할 수 있음): ' + e.toString());
  }

  // 2. 기존 트리거 삭제
  Logger.log('');
  Logger.log('⏰ 2단계: 기존 트리거 정리 중...');
  var triggers = ScriptApp.getProjectTriggers();
  var deletedCount = 0;
  for (var i = 0; i < triggers.length; i++) {
    var funcName = triggers[i].getHandlerFunction();
    if (funcName === 'syncBitgetPositions' ||
        funcName === 'checkClosedPositions' ||
        funcName === 'syncBalanceFromBitget') {
      ScriptApp.deleteTrigger(triggers[i]);
      deletedCount++;
    }
  }
  Logger.log('✅ 기존 트리거 ' + deletedCount + '개 삭제');

  // 3. 새 트리거 생성
  Logger.log('');
  Logger.log('⏰ 3단계: 새 트리거 생성 중...');

  // syncBitgetPositions - 1분마다
  ScriptApp.newTrigger('syncBitgetPositions')
    .timeBased()
    .everyMinutes(1)
    .create();
  Logger.log('  ✅ syncBitgetPositions (1분마다)');

  // checkClosedPositions - 1분마다
  ScriptApp.newTrigger('checkClosedPositions')
    .timeBased()
    .everyMinutes(1)
    .create();
  Logger.log('  ✅ checkClosedPositions (1분마다)');

  // syncBalanceFromBitget - 5분마다
  ScriptApp.newTrigger('syncBalanceFromBitget')
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log('  ✅ syncBalanceFromBitget (5분마다)');

  // 4. Bitget API 테스트
  Logger.log('');
  Logger.log('🔗 4단계: Bitget API 연결 테스트...');
  try {
    var balance = getBitgetFuturesBalance();
    if (balance !== null) {
      Logger.log('✅ Bitget 연결 성공! 잔고: $' + balance.toFixed(2));
    } else {
      Logger.log('⚠️ Bitget 잔고 조회 실패 - API 키 확인 필요');
    }
  } catch (e) {
    Logger.log('❌ Bitget API 오류: ' + e.toString());
  }

  // 5. 완료
  Logger.log('');
  Logger.log('========================================');
  Logger.log('🎉 설정 완료!');
  Logger.log('========================================');
  Logger.log('');
  Logger.log('📌 다음 단계:');
  Logger.log('  1. 통계 시트 B10 셀에 시작 자본 입력');
  Logger.log('  2. TradingView 알림에 웹훅 URL 설정');
  Logger.log('  3. 배포 → 새 배포 실행');
  Logger.log('');
  Logger.log('📊 스프레드시트: ' + SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID).getUrl());
}

/**
 * 트리거 상태 확인
 */
function 트리거_상태확인() {
  var triggers = ScriptApp.getProjectTriggers();
  Logger.log('========================================');
  Logger.log('⏰ 현재 트리거 목록 (' + triggers.length + '개)');
  Logger.log('========================================');

  if (triggers.length === 0) {
    Logger.log('❌ 설정된 트리거가 없습니다!');
    Logger.log('→ "원클릭_전체설정" 함수를 실행하세요.');
    return;
  }

  for (var i = 0; i < triggers.length; i++) {
    var trigger = triggers[i];
    Logger.log((i+1) + '. ' + trigger.getHandlerFunction() + ' - ' + trigger.getEventType());
  }
}

// ============================================
// 설정
// ============================================

var CONFIG = {
  VERSION: '27',
  TRADING: {
    MARKET: 'BTC-USDT',
    MIN_SIGNAL_STRENGTH: 14
  },
  NOTIFICATION: {
    ENABLED: true,
    EMAIL: '',
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_CHAT_ID: ''
  }
};

// ============================================
// Bitget API 설정
// ============================================
var BITGET_CONFIG = {
  API_KEY: 'bg_e3799f8c2c2599651938eb78caeaa3d4',
  SECRET_KEY: '3d09bdfdfa48c93f6a8ed26fdeac72140256de8e975d4993efaa4961f921e400',
  PASSPHRASE: 'ajdcjddl12',
  BASE_URL: 'https://api.bitget.com'
};

var SHEET_CONFIG = {
  SPREADSHEET_ID: '1L6wn9fSLa-sThsYLViSOmbh6Em7jbnXXvfvCcvFMH80',
  SIGNAL_SHEET: '신호기록',
  TRADE_SHEET: 'V25 자동매매일지',
  STATS_SHEET: '통계'
};

// 모드별 TP/SL 기본값 (V26: 손절폭 확대)
var MODE_SETTINGS = {
  '선물': { tp1: 1.0, tp2: 2.0, sl: 0.5, shortEnabled: true },
  '현물코인': { tp1: 1.5, tp2: 3.0, sl: 1.0, shortEnabled: false },
  '주식': { tp1: 2.0, tp2: 4.0, sl: 1.5, shortEnabled: false }
};

var VIRTUAL_TRADING = {
  STARTING_BALANCE: 100,  // 보조계정 시작 자본 (통계 시트 B10에서 자동으로 가져옴)
  POSITION_SIZE: 100
};

// 지원하는 마켓 목록 (Binance 심볼)
var SUPPORTED_MARKETS = {
  'BTC-USDT': 'BTCUSDT',
  'BTCUSDT': 'BTCUSDT',
  'ETH-USDT': 'ETHUSDT',
  'ETHUSDT': 'ETHUSDT',
  'XRP-USDT': 'XRPUSDT',
  'XRPUSDT': 'XRPUSDT',
  'SOL-USDT': 'SOLUSDT',
  'SOLUSDT': 'SOLUSDT',
  'DOGE-USDT': 'DOGEUSDT',
  'DOGEUSDT': 'DOGEUSDT'
};

// ============================================
// Webhook 엔드포인트
// ============================================

function doPost(e) {
  try {
    var rawContent = e.postData.contents;
    Logger.log('Webhook 수신: ' + new Date());
    Logger.log('Raw 데이터: ' + rawContent.substring(0, 200));

    // JSON 부분 추출 (알림 메시지에 JSON이 포함된 경우)
    var jsonContent = rawContent;
    var jsonStart = rawContent.indexOf('{');
    var jsonEnd = rawContent.lastIndexOf('}');

    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      jsonContent = rawContent.substring(jsonStart, jsonEnd + 1);
    }

    var data = JSON.parse(jsonContent);

    if (!data.signal || !data.entry) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '필수 데이터 누락'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var result = processSignal(data);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      result: result
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('오류: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'V25 Universal Trading Bot - 선물/현물/주식 지원',
    version: CONFIG.VERSION,
    market: CONFIG.TRADING.MARKET,
    modes: ['선물', '현물코인', '주식']
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// 신호 처리 (마켓별 분리 - 중복 방지 포함)
// ============================================

/**
 * 마켓 심볼 정규화 (TradingView → 표준 형식)
 * Pine Script에서 syminfo.basecurrency + "-USDT" 형태로 전송
 * 예: "BTC-USDT", "ETH-USDT" 그대로 사용
 */
function detectMarket(data) {
  var market = data.market || '';

  // 이미 표준 형식이면 그대로 반환 (BTC-USDT, ETH-USDT 등)
  if (market && SUPPORTED_MARKETS[market]) {
    Logger.log('📍 마켓 감지 (직접): ' + market);
    return market;
  }

  // 이전 버전 호환: BTCUSDT.P, ETHUSDT 등 형식 처리
  if (market) {
    // .P (선물) 제거
    market = market.replace('.P', '').replace('.p', '');

    // BTCUSDT → BTC-USDT 변환
    if (market.indexOf('BTC') >= 0) {
      Logger.log('📍 마켓 감지 (변환): BTC-USDT from ' + data.market);
      return 'BTC-USDT';
    }
    if (market.indexOf('ETH') >= 0) {
      Logger.log('📍 마켓 감지 (변환): ETH-USDT from ' + data.market);
      return 'ETH-USDT';
    }
    if (market.indexOf('SOL') >= 0) {
      Logger.log('📍 마켓 감지 (변환): SOL-USDT from ' + data.market);
      return 'SOL-USDT';
    }
    if (market.indexOf('XRP') >= 0) {
      Logger.log('📍 마켓 감지 (변환): XRP-USDT from ' + data.market);
      return 'XRP-USDT';
    }
    if (market.indexOf('DOGE') >= 0) {
      Logger.log('📍 마켓 감지 (변환): DOGE-USDT from ' + data.market);
      return 'DOGE-USDT';
    }
  }

  // 마켓 정보 없으면 가격으로 추정 (fallback - 이전 버전 호환)
  var entryPrice = parseFloat(data.entry);
  var detected = 'BTC-USDT';

  if (entryPrice > 50000) {
    detected = 'BTC-USDT';
  } else if (entryPrice > 1000) {
    detected = 'ETH-USDT';
  } else if (entryPrice > 100) {
    detected = 'SOL-USDT';
  } else if (entryPrice > 1) {
    detected = 'XRP-USDT';
  } else {
    detected = 'DOGE-USDT';
  }

  Logger.log('⚠️ 마켓 감지 (가격 추정): ' + detected + ' from $' + entryPrice);
  return detected;
}

function processSignal(data) {
  var entryPrice = parseFloat(data.entry);
  var tradeMode = data.mode || '선물'; // 기본값: 선물
  var version = data.version || '27';

  // 마켓 감지 (BTC, ETH 등)
  var market = detectMarket(data);
  data.market = market;  // 데이터에 마켓 추가

  Logger.log('📊 신호 수신: ' + market + ' ' + data.signal + ' @ $' + entryPrice.toFixed(2));

  // EXIT 신호 처리 (현물/주식에서 고래 매도 감지)
  if (data.signal === 'EXIT') {
    var existingPosition = getPositionByMarket(market);
    if (existingPosition && existingPosition.status === 'OPEN') {
      Logger.log('EXIT 신호 수신 - ' + market + ' 포지션 청산 경고');
      logSignalToSheet(data, entryPrice, 0, 0, 0, '⚠️ EXIT 경고');
      return { action: 'exit_warning', market: market, reason: data.reason || 'WHALE_SELLING' };
    }
    return { action: 'no_position', market: market, reason: 'EXIT 신호지만 열린 포지션 없음' };
  }

  // 모드별 SHORT 제한 체크
  var modeSettings = MODE_SETTINGS[tradeMode] || MODE_SETTINGS['선물'];
  if (data.signal === 'SHORT' && !modeSettings.shortEnabled) {
    Logger.log(tradeMode + ' 모드에서 SHORT 신호 무시');
    logSignalToSheet(data, entryPrice, 0, 0, 0, '[' + tradeMode + '] SHORT 비활성');
    return { action: 'skipped', market: market, reason: tradeMode + '에서 SHORT 비활성' };
  }

  // 마켓별 중복 신호 체크
  var existingPosition = getPositionByMarket(market);
  if (existingPosition && existingPosition.status === 'OPEN') {
    Logger.log('[' + market + '] 이미 열린 포지션 있음 - 신호 무시');
    Logger.log('기존: ' + existingPosition.signal + ' @ $' + existingPosition.entryPrice.toFixed(2));
    Logger.log('새로운: ' + data.signal + ' @ $' + entryPrice.toFixed(2));

    logSignalToSheet(data, entryPrice, 0, 0, 0, '[' + market + ' 중복] 무시됨');

    return { action: 'skipped', market: market, reason: market + ' 이미 포지션 보유중' };
  }

  // ★ Bitget에서 레버리지 조회 후 TP/SL 자동 계산 ★
  var bitgetSymbol = market.replace('-', '');
  var tpslData = calculateTPSLWithBitgetLeverage(market, entryPrice, data.signal);

  var tp1Price = tpslData.tp1Price;
  var tp2Price = tpslData.tp2Price;
  var slPrice = tpslData.slPrice;
  var leverage = tpslData.leverage;

  // 데이터에 Bitget 레버리지 추가
  data.leverage = leverage.toString();
  data.tp1_pct = tpslData.tp1Pct.toFixed(2);
  data.tp2_pct = tpslData.tp2Pct.toFixed(2);
  data.sl_pct = tpslData.slPct.toFixed(2);

  Logger.log('🔗 Bitget 레버리지 적용: ' + leverage + 'x');

  // 신호 기록
  var status = '대기중 [' + market + ' ' + tradeMode + ' ' + leverage + 'x]';
  logSignalToSheet(data, entryPrice, tp1Price, tp2Price, slPrice, status);

  // 마켓별 포지션 저장
  savePositionByMarket(market, data, entryPrice, tp1Price, tp2Price, slPrice, tradeMode);

  // ★ 텔레그램 신호 알림 ★
  var signalEmoji = data.signal === 'LONG' ? '🟢' : '🔴';
  var signalTitle = signalEmoji + ' ' + data.signal + ' 신호 - ' + market;
  var signalMessage = '━━━━━━━━━━━━━━━\n' +
    '📍 마켓: ' + market + '\n' +
    '📊 방향: ' + data.signal + '\n' +
    '💰 진입가: $' + entryPrice.toFixed(2) + '\n' +
    '🎯 TP1: $' + tp1Price.toFixed(2) + ' (+' + (parseFloat(data.tp1_pct) || 1.0).toFixed(2) + '%)\n' +
    '🎯 TP2: $' + tp2Price.toFixed(2) + ' (+' + (parseFloat(data.tp2_pct) || 2.0).toFixed(2) + '%)\n' +
    '🛑 SL: $' + slPrice.toFixed(2) + ' (-' + (parseFloat(data.sl_pct) || 0.5).toFixed(2) + '%)\n' +
    '━━━━━━━━━━━━━━━\n' +
    '⚡ 레버리지: ' + leverage + 'x\n' +
    '📈 점수: ' + (data.totalScore || '-') + '/28\n' +
    (data.smart_money === 'WHALE' ? '🐋 고래 감지!' : data.smart_money === 'INSTITUTION' ? '🐳 기관 감지!' : '');

  sendAutoNotification(signalTitle, signalMessage);

  // ★ Bitget 자동매매 실행 ★
  var autoTradeResult = null;
  if (AUTO_TRADE_CONFIG.ENABLED && tradeMode === '선물') {
    Logger.log('');
    Logger.log('🤖 자동매매 모드 활성화 - Bitget 주문 실행 시작');
    autoTradeResult = executeAutoTrade(market, data.signal, entryPrice, tp1Price, slPrice, leverage);

    if (autoTradeResult) {
      Logger.log('✅ Bitget 자동매매 성공!');
      // 시트에 자동매매 상태 업데이트
      updateSignalStatus(market, '🤖 자동매매 진입 완료');
    } else {
      Logger.log('⚠️ Bitget 자동매매 실패 또는 비활성화');
    }
  } else if (!AUTO_TRADE_CONFIG.ENABLED) {
    Logger.log('⏸️ 자동매매 비활성화 상태 - 시뮬레이션만 진행');
  }

  return {
    action: 'signal_recorded',
    signal: data.signal,
    market: market,
    mode: tradeMode,
    leverage: leverage,
    version: version,
    autoTrade: autoTradeResult ? 'success' : 'disabled'
  };
}

// ============================================
// 포지션 관리 (마켓별 분리)
// ============================================

/**
 * 마켓별 포지션 저장
 */
function savePositionByMarket(market, data, entryPrice, tp1Price, tp2Price, slPrice, tradeMode) {
  var props = PropertiesService.getScriptProperties();

  var position = {
    market: market,
    signal: data.signal,
    leverage: parseInt(data.leverage) || 10,  // 레버리지 (숫자로 저장)
    entryPrice: entryPrice,
    tp1Price: tp1Price,
    tp2Price: tp2Price,
    slPrice: slPrice,
    tp1Pct: parseFloat(data.tp1_pct) || 1.0,   // TP/SL % 저장 (숫자로)
    tp2Pct: parseFloat(data.tp2_pct) || 2.0,
    slPct: parseFloat(data.sl_pct) || 0.5,
    entryTime: new Date().toISOString(),
    tp1Hit: false,
    status: 'OPEN',
    mode: tradeMode || '선물',
    version: data.version || '27',
    smartMoney: data.smart_money || 'NONE',
    volumeRatio: parseFloat(data.volume_ratio) || 0
  };

  var key = 'POSITION_' + market.replace('-', '_');
  props.setProperty(key, JSON.stringify(position));
  Logger.log('📌 [' + market + '] 포지션 저장: ' + data.signal + ' ' + position.leverage + 'x @ $' + entryPrice.toFixed(2));
}

/**
 * 마켓별 포지션 조회
 */
function getPositionByMarket(market) {
  var props = PropertiesService.getScriptProperties();
  var key = 'POSITION_' + market.replace('-', '_');
  var posData = props.getProperty(key);
  return posData ? JSON.parse(posData) : null;
}

/**
 * 마켓별 포지션 삭제
 */
function clearPositionByMarket(market) {
  var props = PropertiesService.getScriptProperties();
  var key = 'POSITION_' + market.replace('-', '_');
  props.deleteProperty(key);
  Logger.log('🗑️ [' + market + '] 포지션 삭제됨');
}

/**
 * 모든 열린 포지션 조회
 */
function getAllOpenPositions() {
  var props = PropertiesService.getScriptProperties();
  var allProps = props.getProperties();
  var positions = [];

  for (var key in allProps) {
    if (key.startsWith('POSITION_')) {
      try {
        var pos = JSON.parse(allProps[key]);
        if (pos.status === 'OPEN') {
          positions.push(pos);
        }
      } catch (e) {
        // 파싱 실패 무시
      }
    }
  }

  return positions;
}

/**
 * 모든 포지션 삭제
 */
function clearAllPositions() {
  var props = PropertiesService.getScriptProperties();
  var allProps = props.getProperties();

  for (var key in allProps) {
    if (key.startsWith('POSITION_')) {
      props.deleteProperty(key);
      Logger.log('삭제: ' + key);
    }
  }

  // 기존 단일 포지션도 삭제
  props.deleteProperty('CURRENT_POSITION');

  Logger.log('🗑️ 모든 포지션 삭제 완료');
}

/**
 * ★ 시트 데이터 정리 - 잘못된 레코드 삭제용 ★
 * 전체 행을 검색하여 87305, 88163 진입가의 손절 기록 삭제
 *
 * 삭제 대상: 손절 기록
 * 보존 대상: 익절 기록
 */
function cleanupTradeSheet() {
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_CONFIG.TRADE_SHEET);

  if (!sheet) {
    Logger.log('시트를 찾을 수 없습니다');
    return;
  }

  var data = sheet.getDataRange().getValues();
  var rowsToDelete = [];
  var keptRows = 0;

  Logger.log('=== 시트 정리 시작 ===');
  Logger.log('총 행 수: ' + data.length);

  // 삭제할 행 번호 수집 (뒤에서부터)
  for (var i = data.length - 1; i >= 0; i--) {
    var row = data[i];
    var rowStr = JSON.stringify(row);

    // 87305 또는 88163 포함 여부 체크
    var has87305 = rowStr.indexOf('87305') >= 0;
    var has88163 = rowStr.indexOf('88163') >= 0;

    if (has87305 || has88163) {
      // 손절 포함 여부 체크
      if (rowStr.indexOf('손절') >= 0) {
        rowsToDelete.push(i + 1);  // 1-based row number
        Logger.log('❌ 삭제: 행 ' + (i+1));
      } else if (rowStr.indexOf('익절') >= 0) {
        keptRows++;
        Logger.log('✅ 보존: 행 ' + (i+1));
      }
    }
  }

  Logger.log('');
  Logger.log('=== 정리 결과 ===');
  Logger.log('삭제할 행: ' + rowsToDelete.length + '개');
  Logger.log('보존할 행: ' + keptRows + '개');

  // 삭제 실행 (뒤에서부터 - 이미 역순으로 수집됨)
  for (var i = 0; i < rowsToDelete.length; i++) {
    sheet.deleteRow(rowsToDelete[i]);
  }

  Logger.log('✅ 정리 완료! ' + rowsToDelete.length + '개 가짜 손절 기록 삭제됨');
}

/**
 * ★ 자동매매일지 시트 복구 ★
 * 헤더와 통계 영역 다시 생성
 */
function rebuildTradeSheet() {
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_CONFIG.TRADE_SHEET);

  if (!sheet) {
    Logger.log('시트가 없어서 새로 생성합니다');
    sheet = ss.insertSheet(SHEET_CONFIG.TRADE_SHEET);
  }

  // 시트 초기화
  sheet.clear();

  // 제목
  sheet.getRange(1, 1, 1, 12).merge();
  sheet.getRange(1, 1).setValue('💰 V27 Universal 자동매매 - 선물/현물/주식');
  sheet.getRange(1, 1).setBackground('#1A237E').setFontColor('#FFFFFF')
    .setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(1, 35);

  // 통계 영역 (2~3행)
  sheet.getRange(2, 1).setValue('📊 현재 잔고:');
  sheet.getRange(2, 2).setValue('$100.00');
  sheet.getRange(2, 2).setFontWeight('bold').setFontSize(12).setFontColor('#1565C0');

  sheet.getRange(2, 3).setValue('📈 총 수익률:');
  sheet.getRange(2, 4).setValue('0.00%');
  sheet.getRange(2, 4).setFontWeight('bold').setFontSize(12);

  sheet.getRange(2, 5).setValue('🎯 승률:');
  sheet.getRange(2, 6).setValue('0%');
  sheet.getRange(2, 6).setFontWeight('bold').setFontSize(12);

  sheet.getRange(2, 7).setValue('📝 총 거래:');
  sheet.getRange(2, 8).setValue('0');
  sheet.getRange(2, 8).setFontWeight('bold');

  sheet.getRange(2, 9).setValue('✅ 승:');
  sheet.getRange(2, 10).setValue('0');
  sheet.getRange(2, 10).setFontColor('#2E7D32').setFontWeight('bold');

  sheet.getRange(3, 9).setValue('❌ 패:');
  sheet.getRange(3, 10).setValue('0');
  sheet.getRange(3, 10).setFontColor('#C62828').setFontWeight('bold');

  sheet.getRange(2, 1, 2, 12).setBackground('#E3F2FD');

  // 헤더 (4행)
  var headers = [
    '날짜', '시간', '마켓', '신호', '진입가', '청산가',
    '청산유형', '수익률', '손익($)', '잔고($)', '누적수익률', '메모'
  ];

  sheet.getRange(4, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(4, 1, 1, headers.length)
    .setBackground('#4A90E2')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // 열 너비 조정
  sheet.setColumnWidth(1, 100);  // 날짜
  sheet.setColumnWidth(2, 80);   // 시간
  sheet.setColumnWidth(3, 90);   // 마켓
  sheet.setColumnWidth(4, 70);   // 신호
  sheet.setColumnWidth(5, 100);  // 진입가
  sheet.setColumnWidth(6, 100);  // 청산가
  sheet.setColumnWidth(7, 120);  // 청산유형
  sheet.setColumnWidth(8, 80);   // 수익률
  sheet.setColumnWidth(9, 90);   // 손익($)
  sheet.setColumnWidth(10, 100); // 잔고($)
  sheet.setColumnWidth(11, 100); // 누적수익률
  sheet.setColumnWidth(12, 100); // 메모

  // 실제 거래 기록
  var realTrades = [
    ['2025-12-18', '18:46:58', 'BTC-USDT', 'LONG', '$87,305.00', '-', '🔵 진입', '-', '-', '-', '-', '0.2944 BTC 진입'],
    ['2025-12-18', '19:32:05', 'BTC-USDT', 'LONG', '$87,305.00', '$87,398.90', '✅ 1차익절', '+0.11%', '+$2.57', '$102.57', '+2.57%', '25% 익절 (0.0736 BTC)'],
    ['2025-12-18', '22:30:35', 'BTC-USDT', 'LONG', '$87,305.00', '$88,170.90', '✅ 2차익절', '+0.99%', '+$5.19', '$107.76', '+7.76%', '50% 익절 (0.1472 BTC)'],
    ['2025-12-19', '20:16:21', 'BTC-USDT', 'LONG', '$88,290.10', '-', '🔵 추매', '-', '-', '-', '-', '0.5 BTC 추매 → 평단 $88,163.70']
  ];

  sheet.getRange(5, 1, realTrades.length, realTrades[0].length).setValues(realTrades);

  // 행 색상
  sheet.getRange(5, 1, 1, 12).setBackground('#E3F2FD');  // 진입 - 파란색
  sheet.getRange(6, 1, 1, 12).setBackground('#E8F5E9');  // 1차익절 - 연녹색
  sheet.getRange(7, 1, 1, 12).setBackground('#C8E6C9');  // 2차익절 - 녹색
  sheet.getRange(8, 1, 1, 12).setBackground('#E3F2FD');  // 추매 - 파란색

  // 통계 업데이트
  sheet.getRange(2, 2).setValue('$107.76');
  sheet.getRange(2, 4).setValue('+7.76%');
  sheet.getRange(2, 6).setValue('100%');
  sheet.getRange(2, 8).setValue('2');  // 청산 거래만 카운트
  sheet.getRange(2, 10).setValue('2');
  sheet.getRange(3, 10).setValue('0');

  Logger.log('✅ 시트 복구 완료!');
  Logger.log('- 실제 거래 2건 추가됨');
  Logger.log('- 현재 잔고: $107.76');
}

/**
 * ★ 실제 거래만 남기고 가짜 기록 삭제 ★
 * Bitget 실제 청산:
 * - 12-18 19:32 → $87,398.9 (0.0736 BTC) - 25% 익절
 * - 12-18 22:30 → $88,170.9 (0.1472 BTC) - 50% 익절
 */
function keepOnlyRealTrades() {
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_CONFIG.TRADE_SHEET);

  if (!sheet) {
    Logger.log('시트를 찾을 수 없습니다');
    return;
  }

  var data = sheet.getDataRange().getValues();
  var rowsToDelete = [];

  // 실제 청산 가격 (Bitget 기록 기준)
  var realExitPrices = ['87398', '88170'];  // 반올림해서 비교

  Logger.log('=== 실제 거래만 남기기 ===');
  Logger.log('총 행 수: ' + data.length);

  for (var i = data.length - 1; i >= 1; i--) {  // 헤더 제외
    var row = data[i];
    var rowStr = JSON.stringify(row);

    // 87305 또는 88163 진입가가 있는 행
    var has87305 = rowStr.indexOf('87305') >= 0;
    var has88163 = rowStr.indexOf('88163') >= 0;

    if (has87305 || has88163) {
      // 실제 청산 가격인지 확인
      var isRealTrade = false;
      for (var j = 0; j < realExitPrices.length; j++) {
        if (rowStr.indexOf(realExitPrices[j]) >= 0) {
          isRealTrade = true;
          break;
        }
      }

      if (isRealTrade) {
        Logger.log('✅ 보존 (실제 거래): 행 ' + (i+1));
      } else {
        rowsToDelete.push(i + 1);
        Logger.log('❌ 삭제 (가짜): 행 ' + (i+1));
      }
    }
  }

  Logger.log('');
  Logger.log('삭제할 행: ' + rowsToDelete.length + '개');
  Logger.log('보존할 행: 2개 (실제 거래)');

  // 삭제 실행
  for (var i = 0; i < rowsToDelete.length; i++) {
    sheet.deleteRow(rowsToDelete[i]);
  }

  Logger.log('✅ 정리 완료!');
}

/**
 * ★ 기존 #ERROR! 셀 수정 ★
 * H열(손익$)의 수식 파싱 오류 수정
 */
function fixErrorCells() {
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_CONFIG.TRADE_SHEET);

  if (!sheet) {
    Logger.log('시트를 찾을 수 없습니다');
    return;
  }

  var lastRow = sheet.getLastRow();
  var fixedCount = 0;

  Logger.log('=== #ERROR! 셀 수정 시작 ===');
  Logger.log('총 행 수: ' + lastRow);

  for (var row = 2; row <= lastRow; row++) {
    // I열 (9번째): 손익($)
    var cell = sheet.getRange(row, 9);
    var value = cell.getValue();
    var displayValue = cell.getDisplayValue();

    // #ERROR! 또는 수식 오류인 경우
    if (displayValue === '#ERROR!' || displayValue.indexOf('ERROR') >= 0) {
      // 해당 행의 수익률을 기반으로 계산
      var profitPctCell = sheet.getRange(row, 8).getValue();
      var balanceCell = sheet.getRange(row, 10).getValue();

      // 수익률에서 숫자 추출
      var profitPctStr = String(profitPctCell).replace('%', '').replace('+', '');
      var profitPct = parseFloat(profitPctStr) || 0;

      // 잔고에서 숫자 추출
      var balanceStr = String(balanceCell).replace('$', '').replace(',', '');
      var balance = parseFloat(balanceStr) || 2750;

      // 수익금 계산 (간단히 잔고의 수익률%)
      var profitAmount = balance * (profitPct / 100);
      var profitText = (profitAmount >= 0 ? '+$' : '-$') + Math.abs(profitAmount).toFixed(2);

      // 텍스트로 설정
      cell.setValue(profitText);
      cell.setNumberFormat('@');

      fixedCount++;
      Logger.log('수정: 행 ' + row + ' → ' + profitText);
    }
  }

  Logger.log('');
  Logger.log('=== 수정 완료 ===');
  Logger.log('수정된 셀: ' + fixedCount + '개');
}

/**
 * 시트 구조 확인 (디버깅용)
 */
function checkSheetStructure() {
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_CONFIG.TRADE_SHEET);

  if (!sheet) {
    Logger.log('시트를 찾을 수 없습니다');
    return;
  }

  Logger.log('=== 시트 구조 확인 ===');
  Logger.log('시트 이름: ' + sheet.getName());
  Logger.log('총 행: ' + sheet.getLastRow());
  Logger.log('총 열: ' + sheet.getLastColumn());

  // 헤더 행 찾기 (진입가가 있는 행)
  for (var row = 1; row <= 10; row++) {
    var rowData = sheet.getRange(row, 1, 1, 12).getValues()[0];
    Logger.log('행 ' + row + ': ' + JSON.stringify(rowData));
  }

  // 데이터가 시작되는 행 찾기
  Logger.log('');
  Logger.log('=== 손절 키워드 검색 ===');
  var data = sheet.getDataRange().getValues();
  var foundCount = 0;
  for (var i = 0; i < data.length && foundCount < 5; i++) {
    var rowStr = JSON.stringify(data[i]);
    if (rowStr.indexOf('손절') >= 0 || rowStr.indexOf('87305') >= 0 || rowStr.indexOf('88163') >= 0) {
      Logger.log('행 ' + (i+1) + ': ' + rowStr.substring(0, 200));
      foundCount++;
    }
  }
}

/**
 * 정리 미리보기 (실제 삭제 안함) - 전체 행 검색
 */
function previewCleanup() {
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_CONFIG.TRADE_SHEET);

  if (!sheet) {
    Logger.log('시트를 찾을 수 없습니다');
    return;
  }

  var data = sheet.getDataRange().getValues();
  var deleteCount = 0;
  var keepCount = 0;
  var rowsToDelete = [];

  Logger.log('=== 정리 미리보기 ===');
  Logger.log('총 행 수: ' + data.length);

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var rowStr = JSON.stringify(row);

    // 87305 또는 88163 포함 여부 체크
    var has87305 = rowStr.indexOf('87305') >= 0;
    var has88163 = rowStr.indexOf('88163') >= 0;

    if (has87305 || has88163) {
      // 손절 포함 여부 체크
      if (rowStr.indexOf('손절') >= 0) {
        deleteCount++;
        rowsToDelete.push(i + 1);  // 1-based row number
        if (deleteCount <= 10) {
          Logger.log('❌ [삭제] 행 ' + (i+1) + ': ' + rowStr.substring(0, 150));
        }
      } else if (rowStr.indexOf('익절') >= 0) {
        keepCount++;
        Logger.log('✅ [보존] 행 ' + (i+1) + ': ' + rowStr.substring(0, 150));
      }
    }
  }

  Logger.log('');
  Logger.log('=== 요약 ===');
  Logger.log('삭제 예정: ' + deleteCount + '개');
  Logger.log('보존 (익절): ' + keepCount + '개');
  Logger.log('');
  if (deleteCount > 0) {
    Logger.log('실제 삭제하려면 cleanupTradeSheet() 실행');
  }
}

/**
 * 현재 저장된 포지션 상태 확인 (디버깅용)
 */
function debugPositions() {
  var props = PropertiesService.getScriptProperties();
  var allProps = props.getProperties();

  Logger.log('=== 저장된 포지션 ===');

  var count = 0;
  for (var key in allProps) {
    if (key.startsWith('POSITION_')) {
      var pos = JSON.parse(allProps[key]);
      Logger.log(key + ':');
      Logger.log('  마켓: ' + pos.market);
      Logger.log('  신호: ' + pos.signal);
      Logger.log('  진입가: $' + pos.entryPrice);
      Logger.log('  레버리지: ' + pos.leverage + 'x');
      Logger.log('  TP1: $' + pos.tp1Price + ' (도달: ' + (pos.tp1Hit ? 'Y' : 'N') + ')');
      Logger.log('  SL: $' + pos.slPrice);
      Logger.log('  상태: ' + pos.status);
      count++;
    }
  }

  Logger.log('총 ' + count + '개 포지션');
}

// 하위 호환성을 위한 기존 함수 (단일 포지션)
function savePosition(data, entryPrice, tp1Price, tp2Price, slPrice, tradeMode) {
  var market = detectMarket(data);
  savePositionByMarket(market, data, entryPrice, tp1Price, tp2Price, slPrice, tradeMode);
}

function getPosition() {
  // 기존 단일 포지션 확인
  var props = PropertiesService.getScriptProperties();
  var posData = props.getProperty('CURRENT_POSITION');
  if (posData) {
    return JSON.parse(posData);
  }

  // 열린 포지션 중 첫 번째 반환
  var positions = getAllOpenPositions();
  return positions.length > 0 ? positions[0] : null;
}

function clearPosition() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('CURRENT_POSITION');
  Logger.log('포지션 삭제됨');
}

// ============================================
// 청산 기록 함수들
// ============================================

function recordTP1() {
  var position = getPosition();
  if (!position) {
    Logger.log('열린 포지션이 없습니다');
    return;
  }

  var profitPercent = ((position.tp1Price - position.entryPrice) / position.entryPrice) * 100;

  logTradeResult(position, 'TP1', position.tp1Price, profitPercent / 2);

  position.tp1Hit = true;
  var props = PropertiesService.getScriptProperties();
  props.setProperty('CURRENT_POSITION', JSON.stringify(position));

  Logger.log('TP1 기록 완료: +' + (profitPercent / 2).toFixed(2) + '%');
}

function recordTP2() {
  var position = getPosition();
  if (!position) {
    Logger.log('열린 포지션이 없습니다');
    return;
  }

  var profitPercent = ((position.tp2Price - position.entryPrice) / position.entryPrice) * 100;

  var actualProfit = position.tp1Hit ? profitPercent / 2 : profitPercent;
  logTradeResult(position, 'TP2', position.tp2Price, actualProfit);

  clearPosition();
  Logger.log('TP2 기록 완료: +' + actualProfit.toFixed(2) + '%');
}

function recordSL() {
  var position = getPosition();
  if (!position) {
    Logger.log('열린 포지션이 없습니다');
    return;
  }

  var lossPercent = ((position.slPrice - position.entryPrice) / position.entryPrice) * 100;

  var actualLoss = position.tp1Hit ? lossPercent / 2 : lossPercent;
  var exitType = position.tp1Hit ? 'TP1 후 SL' : 'SL';

  logTradeResult(position, exitType, position.slPrice, actualLoss);

  clearPosition();
  Logger.log('손절 기록 완료: ' + actualLoss.toFixed(2) + '%');
}

function recordBE() {
  var position = getPosition();
  if (!position) {
    Logger.log('열린 포지션이 없습니다');
    return;
  }

  var exitType = position.tp1Hit ? 'TP1 후 BE' : 'BE';
  logTradeResult(position, exitType, position.entryPrice, 0);

  clearPosition();
  Logger.log('본절 기록 완료');
}

// ============================================
// 가상매매 시트 기록
// ============================================

function logTradeResult(position, exitType, exitPrice, profitPercent) {
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_CONFIG.TRADE_SHEET);

  if (!sheet) {
    sheet = createTradeSheet(ss);
  }

  var currentBalance = getCurrentBalance(sheet);
  var profitAmount = currentBalance * (profitPercent / 100);
  var newBalance = currentBalance + profitAmount;
  var totalReturnPercent = ((newBalance - VIRTUAL_TRADING.STARTING_BALANCE) / VIRTUAL_TRADING.STARTING_BALANCE * 100);

  var now = new Date();

  var emoji = '';
  var bgColor = '#FFFFFF';
  var isWin = false;

  if (exitType === 'TP1') {
    emoji = '✅ 1차익절';
    bgColor = '#E8F5E9';
    isWin = true;
  } else if (exitType === 'TP2') {
    emoji = '✅✅ 2차익절';
    bgColor = '#C8E6C9';
    isWin = true;
  } else if (exitType === 'SL') {
    emoji = '❌ 손절';
    bgColor = '#FFEBEE';
    isWin = false;
  } else if (exitType === 'TP1 후 SL') {
    emoji = '⚠️ 1차익절→손절';
    bgColor = '#FFF3E0';
    isWin = true; // TP1 달성했으므로 승
  } else if (exitType === 'TP1 후 BE') {
    emoji = '➡️ 1차익절→본절';
    bgColor = '#F5F5F5';
    isWin = true;
  } else if (exitType === 'BE') {
    emoji = '➡️ 본절';
    bgColor = '#F5F5F5';
    isWin = false; // 본절은 패 처리 안함
  }

  // 마켓 정보 (position에서 가져옴)
  var market = position.market || 'BTC-USDT';

  var row = [
    Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd'),
    Utilities.formatDate(now, 'Asia/Seoul', 'HH:mm:ss'),
    market,  // 마켓 열 추가
    position.signal,
    '$' + position.entryPrice.toFixed(2),
    '$' + exitPrice.toFixed(2),
    emoji,
    profitPercent.toFixed(2) + '%',
    (profitAmount >= 0 ? '+$' : '-$') + Math.abs(profitAmount).toFixed(2),
    '$' + newBalance.toFixed(2),
    (totalReturnPercent >= 0 ? '+' : '') + totalReturnPercent.toFixed(2) + '%',
    ''
  ];

  sheet.appendRow(row);

  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 1, 1, row.length).setBackground(bgColor);

  if (profitPercent > 0) {
    sheet.getRange(lastRow, 8).setFontColor('#2E7D32').setFontWeight('bold');  // 수익률
    sheet.getRange(lastRow, 9).setFontColor('#2E7D32').setFontWeight('bold');  // 손익
  } else if (profitPercent < 0) {
    sheet.getRange(lastRow, 8).setFontColor('#C62828').setFontWeight('bold');
    sheet.getRange(lastRow, 9).setFontColor('#C62828').setFontWeight('bold');
  }

  // 누적수익률 색상
  if (totalReturnPercent > 0) {
    sheet.getRange(lastRow, 11).setFontColor('#2E7D32').setFontWeight('bold');  // 누적수익률
  } else if (totalReturnPercent < 0) {
    sheet.getRange(lastRow, 11).setFontColor('#C62828').setFontWeight('bold');
  }

  sheet.getRange(lastRow, 10).setFontWeight('bold').setBackground('#E3F2FD');  // 잔고($) 열

  // 통계 업데이트
  updateStatistics(sheet, newBalance, totalReturnPercent, isWin, exitType);

  Logger.log('거래 기록: ' + emoji + ' | 잔고: $' + newBalance.toFixed(2) + ' | 누적: ' + totalReturnPercent.toFixed(2) + '%');
}

/**
 * 통계 업데이트 (V24 자동매매일지 + 통계 시트)
 */
function updateStatistics(sheet, newBalance, totalReturnPercent, isWin, exitType) {
  // === V24 자동매매일지 시트 통계 ===
  // 현재 잔고
  sheet.getRange(2, 2).setValue('$' + newBalance.toFixed(2));
  if (newBalance > VIRTUAL_TRADING.STARTING_BALANCE) {
    sheet.getRange(2, 2).setFontColor('#2E7D32');
  } else if (newBalance < VIRTUAL_TRADING.STARTING_BALANCE) {
    sheet.getRange(2, 2).setFontColor('#C62828');
  }

  // 총 수익률
  sheet.getRange(2, 4).setValue((totalReturnPercent >= 0 ? '+' : '') + totalReturnPercent.toFixed(2) + '%');
  if (totalReturnPercent > 0) {
    sheet.getRange(2, 4).setFontColor('#2E7D32');
  } else if (totalReturnPercent < 0) {
    sheet.getRange(2, 4).setFontColor('#C62828');
  }

  // 거래 횟수 및 승패 계산
  var wins = parseInt(sheet.getRange(2, 10).getValue()) || 0;
  var losses = parseInt(sheet.getRange(3, 10).getValue()) || 0;

  if (exitType !== 'BE') { // 본절은 승패에 포함 안함
    if (isWin) {
      wins++;
      sheet.getRange(2, 10).setValue(wins);
    } else {
      losses++;
      sheet.getRange(3, 10).setValue(losses);
    }
  }

  var totalTrades = wins + losses;
  sheet.getRange(2, 8).setValue(totalTrades);

  // 승률
  var winRate = totalTrades > 0 ? (wins / totalTrades * 100) : 0;
  sheet.getRange(2, 6).setValue(winRate.toFixed(1) + '%');
  if (winRate >= 60) {
    sheet.getRange(2, 6).setFontColor('#2E7D32');
  } else if (winRate < 50) {
    sheet.getRange(2, 6).setFontColor('#C62828');
  } else {
    sheet.getRange(2, 6).setFontColor('#FF9800');
  }

  // === 통계 시트 업데이트 ===
  updateStatsSheet(newBalance, totalReturnPercent, wins, losses, winRate);
}

/**
 * 통계 시트에 요약 업데이트
 */
function updateStatsSheet(balance, returnPercent, wins, losses, winRate) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    var statsSheet = ss.getSheetByName(SHEET_CONFIG.STATS_SHEET);

    if (!statsSheet) {
      statsSheet = createStatsSheet(ss);
    }

    var now = new Date();
    var updateTime = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');

    // 통계 시트 업데이트
    statsSheet.getRange('B2').setValue('$' + balance.toFixed(2));
    statsSheet.getRange('B3').setValue((returnPercent >= 0 ? '+' : '') + returnPercent.toFixed(2) + '%');
    statsSheet.getRange('B4').setValue(winRate.toFixed(1) + '%');
    statsSheet.getRange('B5').setValue(wins + losses);
    statsSheet.getRange('B6').setValue(wins);
    statsSheet.getRange('B7').setValue(losses);
    statsSheet.getRange('B8').setValue(updateTime);

    // 색상 적용
    if (balance > VIRTUAL_TRADING.STARTING_BALANCE) {
      statsSheet.getRange('B2').setFontColor('#2E7D32').setFontWeight('bold');
    } else if (balance < VIRTUAL_TRADING.STARTING_BALANCE) {
      statsSheet.getRange('B2').setFontColor('#C62828').setFontWeight('bold');
    }

    if (returnPercent > 0) {
      statsSheet.getRange('B3').setFontColor('#2E7D32').setFontWeight('bold');
    } else if (returnPercent < 0) {
      statsSheet.getRange('B3').setFontColor('#C62828').setFontWeight('bold');
    }

    if (winRate >= 60) {
      statsSheet.getRange('B4').setFontColor('#2E7D32').setFontWeight('bold');
    } else if (winRate < 50) {
      statsSheet.getRange('B4').setFontColor('#C62828').setFontWeight('bold');
    }

  } catch (error) {
    Logger.log('통계 시트 업데이트 실패: ' + error.toString());
  }
}

/**
 * ★ Bitget 실제 잔고로 모든 시트 동기화 ★
 * 트리거로 5분마다 자동 실행
 */
function syncBalanceFromBitget() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    var tradeSheet = ss.getSheetByName(SHEET_CONFIG.TRADE_SHEET);
    var statsSheet = ss.getSheetByName(SHEET_CONFIG.STATS_SHEET);

    // Bitget 실제 잔고 가져오기
    var bitgetBalance = getBitgetFuturesBalance();
    if (!bitgetBalance || bitgetBalance <= 0) {
      Logger.log('Bitget 잔고 조회 실패');
      return;
    }

    // ★ 통계 시트에서 시작 자본 가져오기 ★
    var startingBalance = getStartingBalanceFromStatsSheet(statsSheet);
    if (!startingBalance || startingBalance <= 0) {
      startingBalance = VIRTUAL_TRADING.STARTING_BALANCE; // 폴백
    }
    var totalReturnPercent = ((bitgetBalance - startingBalance) / startingBalance * 100);

    // 자동매매일지 시트 업데이트
    if (tradeSheet) {
      tradeSheet.getRange(2, 2).setValue('$' + bitgetBalance.toFixed(2));
      if (bitgetBalance > startingBalance) {
        tradeSheet.getRange(2, 2).setFontColor('#2E7D32');
      } else if (bitgetBalance < startingBalance) {
        tradeSheet.getRange(2, 2).setFontColor('#C62828');
      }

      tradeSheet.getRange(2, 4).setValue((totalReturnPercent >= 0 ? '+' : '') + totalReturnPercent.toFixed(2) + '%');
      if (totalReturnPercent > 0) {
        tradeSheet.getRange(2, 4).setFontColor('#2E7D32');
      } else if (totalReturnPercent < 0) {
        tradeSheet.getRange(2, 4).setFontColor('#C62828');
      }
    }

    // 통계 시트 업데이트
    if (statsSheet) {
      statsSheet.getRange('B2').setValue('$' + bitgetBalance.toFixed(2));
      statsSheet.getRange('B3').setValue((totalReturnPercent >= 0 ? '+' : '') + totalReturnPercent.toFixed(2) + '%');

      if (bitgetBalance > startingBalance) {
        statsSheet.getRange('B2').setFontColor('#2E7D32').setFontWeight('bold');
      } else if (bitgetBalance < startingBalance) {
        statsSheet.getRange('B2').setFontColor('#C62828').setFontWeight('bold');
      }

      if (totalReturnPercent > 0) {
        statsSheet.getRange('B3').setFontColor('#2E7D32').setFontWeight('bold');
      } else if (totalReturnPercent < 0) {
        statsSheet.getRange('B3').setFontColor('#C62828').setFontWeight('bold');
      }

      // 마지막 업데이트 시간
      var now = new Date();
      var updateTime = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
      statsSheet.getRange('B8').setValue(updateTime);
    }

    Logger.log('✅ 잔고 동기화 완료: $' + bitgetBalance.toFixed(2) + ' (시작: $' + startingBalance.toFixed(2) + ', 수익률: ' + totalReturnPercent.toFixed(2) + '%)');

  } catch (error) {
    Logger.log('잔고 동기화 실패: ' + error.toString());
  }
}

/**
 * 통계 시트에서 시작 자본 가져오기
 * B9 셀에 시작 자본이 있다고 가정 (예: $2750.63 또는 2750.63)
 */
function getStartingBalanceFromStatsSheet(statsSheet) {
  try {
    if (!statsSheet) {
      var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
      statsSheet = ss.getSheetByName(SHEET_CONFIG.STATS_SHEET);
    }

    if (!statsSheet) return null;

    // B10 셀에서 시작 자본 읽기 (💵 시작 자본 행)
    var startingBalanceValue = statsSheet.getRange('B10').getValue();

    if (!startingBalanceValue) return null;

    // 숫자만 추출 ($, 콤마 제거)
    var numStr = startingBalanceValue.toString().replace(/[$,]/g, '');
    var startingBalance = parseFloat(numStr);

    return isNaN(startingBalance) ? null : startingBalance;
  } catch (error) {
    Logger.log('시작 자본 조회 오류: ' + error.toString());
    return null;
  }
}

/**
 * Bitget 선물 계정 잔고 조회
 */
function getBitgetFuturesBalance() {
  try {
    var timestamp = Date.now().toString();
    var method = 'GET';
    var requestPath = '/api/v2/mix/account/accounts?productType=USDT-FUTURES';

    var signature = createBitgetSignature(timestamp, method, requestPath, '');

    var options = {
      method: method,
      headers: {
        'ACCESS-KEY': BITGET_CONFIG.API_KEY,
        'ACCESS-SIGN': signature,
        'ACCESS-TIMESTAMP': timestamp,
        'ACCESS-PASSPHRASE': BITGET_CONFIG.PASSPHRASE,
        'Content-Type': 'application/json',
        'locale': 'en-US'
      },
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(BITGET_CONFIG.BASE_URL + requestPath, options);
    var result = JSON.parse(response.getContentText());

    if (result.code === '00000' && result.data && result.data.length > 0) {
      var account = result.data[0];
      var available = parseFloat(account.available || account.crossedMaxAvailable || 0);
      var unrealizedPL = parseFloat(account.unrealizedPL || 0);
      var totalBalance = available + unrealizedPL;
      return totalBalance;
    }

    return null;
  } catch (error) {
    Logger.log('Bitget 잔고 조회 오류: ' + error.toString());
    return null;
  }
}

/**
 * 통계 시트 생성
 */
function createStatsSheet(ss) {
  var sheet = ss.insertSheet(SHEET_CONFIG.STATS_SHEET);

  // 제목
  sheet.getRange('A1:C1').merge();
  sheet.getRange('A1').setValue('📊 V25 Universal 가상매매 통계');
  sheet.getRange('A1').setBackground('#1A237E').setFontColor('#FFFFFF')
    .setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(1, 40);

  // 통계 항목
  var stats = [
    ['💰 현재 잔고', '$100.00'],
    ['📈 총 수익률', '0.00%'],
    ['🎯 승률', '0%'],
    ['📝 총 거래 수', '0'],
    ['✅ 승리', '0'],
    ['❌ 패배', '0'],
    ['🕐 마지막 업데이트', '-'],
    ['', ''],
    ['💵 시작 자본', '$100.00']  // ★ 사용자가 직접 수정 ★
  ];

  sheet.getRange(2, 1, stats.length, 2).setValues(stats);

  // 스타일
  sheet.getRange('A2:A8').setBackground('#E3F2FD').setFontWeight('bold');
  sheet.getRange('B2:B8').setFontSize(14).setHorizontalAlignment('center');

  // 시작 자본 스타일 (수정 가능하도록 강조)
  sheet.getRange('A10').setBackground('#FFF3E0').setFontWeight('bold');
  sheet.getRange('B10').setFontSize(14).setHorizontalAlignment('center').setBackground('#FFF3E0').setFontColor('#E65100');

  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 150);

  // 초기 잔고 강조
  sheet.getRange('B2').setFontSize(18).setFontWeight('bold').setFontColor('#1565C0');

  // 구분선
  sheet.getRange('A9:B9').merge();
  sheet.getRange('A9').setValue('');
  sheet.getRange('A9').setBackground('#BDBDBD');
  sheet.setRowHeight(9, 5);

  // 추가 정보
  sheet.getRange('A10').setValue('💡 시작 자본');
  sheet.getRange('B10').setValue('$100.00');
  sheet.getRange('A11').setValue('📅 시작일');
  sheet.getRange('B11').setValue(Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'));

  sheet.getRange('A10:A11').setBackground('#FFF3E0');

  return sheet;
}

function createTradeSheet(ss) {
  var sheet = ss.insertSheet(SHEET_CONFIG.TRADE_SHEET);

  // 제목
  sheet.getRange(1, 1, 1, 11).merge();
  sheet.getRange(1, 1).setValue('💰 V25 Universal 자동매매 ($100 시작) - 선물/현물/주식');
  sheet.getRange(1, 1).setBackground('#1A237E').setFontColor('#FFFFFF')
    .setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(1, 35);

  // 통계 영역 (2~4행)
  sheet.getRange(2, 1).setValue('📊 현재 잔고:');
  sheet.getRange(2, 2).setValue('$100.00');
  sheet.getRange(2, 2).setFontWeight('bold').setFontSize(12).setFontColor('#1565C0');

  sheet.getRange(2, 3).setValue('📈 총 수익률:');
  sheet.getRange(2, 4).setValue('0.00%');
  sheet.getRange(2, 4).setFontWeight('bold').setFontSize(12);

  sheet.getRange(2, 5).setValue('🎯 승률:');
  sheet.getRange(2, 6).setValue('0%');
  sheet.getRange(2, 6).setFontWeight('bold').setFontSize(12);

  sheet.getRange(2, 7).setValue('📝 총 거래:');
  sheet.getRange(2, 8).setValue('0');
  sheet.getRange(2, 8).setFontWeight('bold');

  sheet.getRange(2, 9).setValue('✅ 승:');
  sheet.getRange(2, 10).setValue('0');
  sheet.getRange(2, 10).setFontColor('#2E7D32').setFontWeight('bold');

  sheet.getRange(3, 9).setValue('❌ 패:');
  sheet.getRange(3, 10).setValue('0');
  sheet.getRange(3, 10).setFontColor('#C62828').setFontWeight('bold');

  sheet.getRange(2, 1, 2, 11).setBackground('#E3F2FD');

  // 헤더 (마켓 열 추가)
  var headers = [
    '날짜', '시간', '마켓', '신호', '진입가', '청산가',
    '청산유형', '수익률', '손익($)', '잔고($)', '누적수익률', '메모'
  ];

  sheet.getRange(4, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(4, 1, 1, headers.length)
    .setBackground('#4A90E2')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sheet.setColumnWidth(1, 100);  // 날짜
  sheet.setColumnWidth(2, 80);   // 시간
  sheet.setColumnWidth(3, 90);   // 마켓
  sheet.setColumnWidth(4, 70);   // 신호
  sheet.setColumnWidth(5, 100);  // 진입가
  sheet.setColumnWidth(6, 100);  // 청산가
  sheet.setColumnWidth(7, 120);  // 청산유형
  sheet.setColumnWidth(8, 80);   // 수익률
  sheet.setColumnWidth(9, 90);   // 손익($)
  sheet.setColumnWidth(10, 100); // 잔고($)
  sheet.setColumnWidth(11, 100); // 누적수익률
  sheet.setColumnWidth(12, 150); // 메모

  sheet.setFrozenRows(4);

  // 초기 잔고 행
  sheet.appendRow([
    '시작', '-', '-', '-', '-', '-', '[초기잔고]', '-', '-',
    '$' + VIRTUAL_TRADING.STARTING_BALANCE.toFixed(2), '0.00%', '시뮬레이션 시작'
  ]);
  sheet.getRange(5, 10).setFontWeight('bold').setBackground('#E3F2FD');  // 잔고($) 열

  return sheet;
}

function getCurrentBalance(sheet) {
  // ★ 실제 Bitget 잔고 사용 ★
  var bitgetBalance = getBitgetTotalBalance();
  if (bitgetBalance !== null && bitgetBalance > 0) {
    return bitgetBalance;
  }

  // Bitget 조회 실패시 시트에서 마지막 잔고 사용
  var lastRow = sheet.getLastRow();

  if (lastRow <= 5) { // 헤더 4행 + 초기잔고 1행
    return VIRTUAL_TRADING.STARTING_BALANCE;
  }

  var balanceStr = sheet.getRange(lastRow, 10).getValue();
  // "$100.00" 형식에서 숫자만 추출
  var balance = parseFloat(String(balanceStr).replace(/[^0-9.-]/g, ''));
  return balance || VIRTUAL_TRADING.STARTING_BALANCE;
}

/**
 * Bitget 선물 계정 총 잔고 조회 (USDT)
 */
function getBitgetTotalBalance() {
  var endpoint = '/api/v2/mix/account/accounts?productType=USDT-FUTURES';

  try {
    var result = callBitgetAPI('GET', endpoint, null);

    if (result.code === '00000' && result.data && result.data.length > 0) {
      var usdtAccount = result.data.find(function(acc) {
        return acc.marginCoin === 'USDT';
      });

      if (usdtAccount) {
        var totalBalance = parseFloat(usdtAccount.usdtEquity || usdtAccount.accountEquity || 0);
        Logger.log('💰 Bitget 총 자산: $' + totalBalance.toFixed(2));
        return totalBalance;
      }
    }
    return null;
  } catch (error) {
    Logger.log('Bitget 잔고 조회 실패: ' + error.toString());
    return null;
  }
}

/**
 * Bitget에서 실현 손익 조회 (최근 거래)
 */
function getRealizedPnLFromBitget(position) {
  // 포지션 청산 직후이므로 실현 손익은 계산으로 대체
  // (Bitget 거래 내역 API 호출은 복잡하므로 수익률 기반 계산 사용)
  return null;
}

/**
 * 시트에서 시작 잔고 가져오기 (첫 거래 기준)
 */
function getStartingBalanceFromSheet(sheet) {
  // 통계 시트에서 시작 잔고 가져오기 (우선)
  try {
    var statsSheet = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID).getSheetByName(SHEET_CONFIG.STATS_SHEET);
    if (statsSheet) {
      var startBalance = statsSheet.getRange('B10').getValue(); // 시작잔고 셀 (A10: 시작자본, B10: 값)
      if (startBalance && parseFloat(String(startBalance).replace(/[^0-9.-]/g, '')) > 0) {
        return parseFloat(String(startBalance).replace(/[^0-9.-]/g, ''));
      }
    }
  } catch (e) {
    Logger.log('통계 시트 조회 실패: ' + e.toString());
  }

  // sheet가 null이 아니면 시트에서 확인
  if (sheet) {
    var lastRow = sheet.getLastRow();
    if (lastRow <= 5) {
      // 거래 없으면 현재 Bitget 잔고를 시작 잔고로
      var bitgetBalance = getBitgetTotalBalance();
      return bitgetBalance || VIRTUAL_TRADING.STARTING_BALANCE;
    }
  }

  return VIRTUAL_TRADING.STARTING_BALANCE;
}

/**
 * 시작일만 설정 (시작 자본은 사용자가 직접 B10에 입력)
 */
function setStartingDate() {
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  var statsSheet = ss.getSheetByName(SHEET_CONFIG.STATS_SHEET);

  if (!statsSheet) {
    Logger.log('❌ 통계 시트를 찾을 수 없습니다');
    return;
  }

  // B11 셀에 시작일 저장
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  statsSheet.getRange('B11').setValue(today);

  Logger.log('✅ 시작일 설정: ' + today);
  Logger.log('💡 시작 자본은 B10 셀에 직접 입력하세요');
}

/**
 * 시작 잔고 설정 (통계 시트에 저장) - 필요시 사용
 */
function setStartingBalance(balance) {
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  var statsSheet = ss.getSheetByName(SHEET_CONFIG.STATS_SHEET);

  if (!statsSheet) {
    Logger.log('❌ 통계 시트를 찾을 수 없습니다');
    return;
  }

  statsSheet.getRange('B10').setValue('$' + balance.toFixed(2));
  Logger.log('✅ 시작 잔고 설정: $' + balance.toFixed(2));
}

/**
 * 현재 Bitget 잔고를 시작 잔고로 설정
 */
function setCurrentBalanceAsStarting() {
  var balance = getBitgetTotalBalance();
  if (balance !== null && balance > 0) {
    setStartingBalance(balance);
    Logger.log('✅ 현재 Bitget 잔고 $' + balance.toFixed(2) + '를 시작 잔고로 설정');
  } else {
    Logger.log('❌ Bitget 잔고 조회 실패');
  }
}

/**
 * Bitget 잔고 테스트
 */
function testBitgetBalance() {
  Logger.log('=== Bitget 잔고 테스트 ===');
  var balance = getBitgetTotalBalance();
  if (balance !== null) {
    Logger.log('✅ 현재 잔고: $' + balance.toFixed(2));
  } else {
    Logger.log('❌ 잔고 조회 실패');
  }
}

/**
 * 통계 시트 잔고 실시간 업데이트 (1분마다)
 */
function updateStatsBalance() {
  var balance = getBitgetTotalBalance();
  if (balance === null) return;

  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  var statsSheet = ss.getSheetByName(SHEET_CONFIG.STATS_SHEET);

  if (!statsSheet) return;

  // B2: 현재 잔고 업데이트
  statsSheet.getRange('B2').setValue('$' + balance.toFixed(2));

  // B10: 시작 자본 (사용자가 수동 입력한 값 읽기)
  var startBalanceRaw = statsSheet.getRange('B10').getValue();
  var startBalance = parseFloat(String(startBalanceRaw).replace(/[^0-9.-]/g, '')) || 0;

  // B3: 총 수익률 계산 (사용자가 입력한 시작 자본 대비)
  if (startBalance > 0) {
    var depositWithdraw = getTotalDepositWithdraw();
    var netProfit = balance - startBalance - depositWithdraw.net;
    var profitPercent = (netProfit / startBalance * 100);
    statsSheet.getRange('B3').setValue((profitPercent >= 0 ? '+' : '') + profitPercent.toFixed(2) + '%');
  }

  // B8: 마지막 업데이트 시간
  var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'HH:mm:ss');
  statsSheet.getRange('B8').setValue(now);
}

/**
 * 전체 시스템 시작 (모든 트리거 포함)
 */
function startFullSystemWithBalance() {
  // 기존 트리거 모두 삭제
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });

  // 가격 체크 트리거 (1분)
  ScriptApp.newTrigger('checkPriceAndAutoClose')
    .timeBased()
    .everyMinutes(1)
    .create();

  // Bitget 동기화 트리거 (1분)
  ScriptApp.newTrigger('syncBitgetPositions')
    .timeBased()
    .everyMinutes(1)
    .create();

  // 잔고 업데이트 트리거 (1분)
  ScriptApp.newTrigger('updateStatsBalance')
    .timeBased()
    .everyMinutes(1)
    .create();

  // Watchdog (15분)
  ScriptApp.newTrigger('watchdogCheck')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('✅ 전체 시스템 시작됨');
  Logger.log('  - 가격 체크: 1분마다');
  Logger.log('  - Bitget 동기화: 1분마다');
  Logger.log('  - 잔고 업데이트: 1분마다');
  Logger.log('  - Watchdog: 15분마다');
}

// ============================================
// 💰 입출금 자동 감지 및 수익률 보정
// ============================================

/**
 * 입출금 내역 조회 (Bitget API)
 */
function getBitgetDepositWithdrawHistory() {
  // 최근 7일 입출금 내역
  var endTime = Date.now();
  var startTime = endTime - (7 * 24 * 60 * 60 * 1000);

  var deposits = [];
  var withdrawals = [];

  // 입금 내역
  try {
    var depositEndpoint = '/api/v2/spot/wallet/deposit-records?startTime=' + startTime + '&endTime=' + endTime + '&limit=50';
    var depositResult = callBitgetAPI('GET', depositEndpoint, null);
    if (depositResult.code === '00000' && depositResult.data) {
      deposits = depositResult.data;
    }
  } catch (e) {
    Logger.log('입금 내역 조회 실패: ' + e.toString());
  }

  // 출금 내역
  try {
    var withdrawEndpoint = '/api/v2/spot/wallet/withdrawal-records?startTime=' + startTime + '&endTime=' + endTime + '&limit=50';
    var withdrawResult = callBitgetAPI('GET', withdrawEndpoint, null);
    if (withdrawResult.code === '00000' && withdrawResult.data) {
      withdrawals = withdrawResult.data;
    }
  } catch (e) {
    Logger.log('출금 내역 조회 실패: ' + e.toString());
  }

  return { deposits: deposits, withdrawals: withdrawals };
}

/**
 * 누적 입출금 금액 계산
 */
function getTotalDepositWithdraw() {
  var props = PropertiesService.getScriptProperties();
  var totalDeposit = parseFloat(props.getProperty('TOTAL_DEPOSIT') || '0');
  var totalWithdraw = parseFloat(props.getProperty('TOTAL_WITHDRAW') || '0');

  return {
    deposit: totalDeposit,
    withdraw: totalWithdraw,
    net: totalDeposit - totalWithdraw
  };
}

/**
 * 입출금 기록 (수동 입력)
 */
function recordDeposit(amount) {
  var props = PropertiesService.getScriptProperties();
  var currentDeposit = parseFloat(props.getProperty('TOTAL_DEPOSIT') || '0');
  props.setProperty('TOTAL_DEPOSIT', (currentDeposit + amount).toString());

  // 입출금 로그 시트에 기록
  logDepositWithdraw('입금', amount);

  Logger.log('✅ 입금 기록: +$' + amount.toFixed(2));
  Logger.log('📊 총 입금액: $' + (currentDeposit + amount).toFixed(2));
}

function recordWithdraw(amount) {
  var props = PropertiesService.getScriptProperties();
  var currentWithdraw = parseFloat(props.getProperty('TOTAL_WITHDRAW') || '0');
  props.setProperty('TOTAL_WITHDRAW', (currentWithdraw + amount).toString());

  // 입출금 로그 시트에 기록
  logDepositWithdraw('출금', amount);

  Logger.log('✅ 출금 기록: -$' + amount.toFixed(2));
  Logger.log('📊 총 출금액: $' + (currentWithdraw + amount).toFixed(2));
}

/**
 * 입출금 시트에 기록
 */
function logDepositWithdraw(type, amount) {
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName('입출금내역');

  if (!sheet) {
    sheet = ss.insertSheet('입출금내역');
    sheet.getRange('A1:D1').setValues([['날짜', '시간', '유형', '금액']]);
    sheet.getRange('A1:D1').setBackground('#4A90E2').setFontColor('#FFFFFF').setFontWeight('bold');
  }

  var now = new Date();
  var amountText = (type === '입금' ? '+' : '-') + '$' + amount.toFixed(2);
  sheet.appendRow([
    Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd'),
    Utilities.formatDate(now, 'Asia/Seoul', 'HH:mm:ss'),
    type,
    amountText
  ]);
  // 금액 셀을 텍스트로 강제 설정 (수식 파싱 방지)
  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 4).setNumberFormat('@');
}

/**
 * 실제 수익률 계산 (입출금 보정)
 * 수익률 = (현재잔고 - 시작잔고 - 순입금) / 시작잔고 × 100
 */
function getRealProfitPercent() {
  var currentBalance = getBitgetTotalBalance() || 0;
  var startingBalance = getStartingBalanceFromSheet(null) || VIRTUAL_TRADING.STARTING_BALANCE;
  var depositWithdraw = getTotalDepositWithdraw();

  // 순수익 = 현재잔고 - 시작잔고 - 순입금(입금-출금)
  var netProfit = currentBalance - startingBalance - depositWithdraw.net;
  var profitPercent = startingBalance > 0 ? (netProfit / startingBalance * 100) : 0;

  Logger.log('=== 실제 수익률 계산 ===');
  Logger.log('시작 잔고: $' + startingBalance.toFixed(2));
  Logger.log('현재 잔고: $' + currentBalance.toFixed(2));
  Logger.log('총 입금: $' + depositWithdraw.deposit.toFixed(2));
  Logger.log('총 출금: $' + depositWithdraw.withdraw.toFixed(2));
  Logger.log('순 입금: $' + depositWithdraw.net.toFixed(2));
  Logger.log('순 수익: $' + netProfit.toFixed(2));
  Logger.log('실제 수익률: ' + profitPercent.toFixed(2) + '%');

  return {
    startingBalance: startingBalance,
    currentBalance: currentBalance,
    totalDeposit: depositWithdraw.deposit,
    totalWithdraw: depositWithdraw.withdraw,
    netDeposit: depositWithdraw.net,
    netProfit: netProfit,
    profitPercent: profitPercent
  };
}

/**
 * 입출금 초기화 (새로 시작할 때)
 */
function resetDepositWithdraw() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('TOTAL_DEPOSIT', '0');
  props.setProperty('TOTAL_WITHDRAW', '0');
  Logger.log('✅ 입출금 기록 초기화됨');
}

/**
 * 잔고 변화 자동 감지 (1분마다 실행)
 */
function detectBalanceChange() {
  var props = PropertiesService.getScriptProperties();
  var lastBalance = parseFloat(props.getProperty('LAST_KNOWN_BALANCE') || '0');
  var currentBalance = getBitgetTotalBalance();

  if (currentBalance === null) return;

  // 열린 포지션 확인
  var positions = getBitgetPositions();
  var hasOpenPosition = positions.length > 0;

  // 잔고 변화 감지 (포지션 없을 때만)
  if (!hasOpenPosition && lastBalance > 0) {
    var balanceChange = currentBalance - lastBalance;

    // 변화가 $1 이상이면 입출금으로 판단
    if (Math.abs(balanceChange) >= 1) {
      if (balanceChange > 0) {
        Logger.log('💵 입금 감지: +$' + balanceChange.toFixed(2));
        recordDeposit(balanceChange);
      } else {
        Logger.log('💸 출금 감지: -$' + Math.abs(balanceChange).toFixed(2));
        recordWithdraw(Math.abs(balanceChange));
      }
    }
  }

  // 현재 잔고 저장
  props.setProperty('LAST_KNOWN_BALANCE', currentBalance.toString());
}

// ============================================
// 신호 기록 시트
// ============================================

function logSignalToSheet(data, entryPrice, tp1Price, tp2Price, slPrice, status) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_CONFIG.SIGNAL_SHEET);

    if (!sheet) {
      sheet = createSignalSheet(ss);
    } else {
      // 기존 시트에 레버리지 열이 없으면 추가
      ensureLeverageColumn(sheet);
    }

    var now = new Date();
    var tp1Percent = ((tp1Price - entryPrice) / entryPrice * 100).toFixed(2);
    var tp2Percent = ((tp2Price - entryPrice) / entryPrice * 100).toFixed(2);
    var slPercent = ((slPrice - entryPrice) / entryPrice * 100).toFixed(2);

    var row = [
      Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd'),
      Utilities.formatDate(now, 'Asia/Seoul', 'HH:mm:ss'),
      data.market || CONFIG.TRADING.MARKET,
      data.signal,
      (data.leverage || 10) + 'x',  // 레버리지
      '$' + entryPrice.toFixed(2),
      '$' + tp1Price.toFixed(2),
      '$' + tp2Price.toFixed(2),
      '$' + slPrice.toFixed(2),
      tp1Percent + '%',
      tp2Percent + '%',
      slPercent + '%',
      data.totalScore || '-',
      status || '대기중'
    ];

    sheet.appendRow(row);

    var lastRow = sheet.getLastRow();

    if (status && status.indexOf('중복') > -1) {
      sheet.getRange(lastRow, 1, 1, row.length).setBackground('#E0E0E0');
      sheet.getRange(lastRow, 14).setFontColor('#757575');  // 상태 열 (14번째)
    } else if (data.signal === 'LONG') {
      sheet.getRange(lastRow, 1, 1, row.length).setBackground('#E8F5E9');
    } else {
      sheet.getRange(lastRow, 1, 1, row.length).setBackground('#FFEBEE');
    }

  } catch (error) {
    Logger.log('시트 기록 실패: ' + error.toString());
  }
}

/**
 * 신호기록 시트의 상태 업데이트
 */
function updateSignalStatus(market, newStatus) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_CONFIG.SIGNAL_SHEET);

    if (!sheet) return;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    // 최근 10개 행에서 해당 마켓 찾기
    var searchRows = Math.min(10, lastRow - 1);
    var range = sheet.getRange(lastRow - searchRows + 1, 1, searchRows, 14);
    var values = range.getValues();

    for (var i = values.length - 1; i >= 0; i--) {
      var rowMarket = values[i][2]; // 마켓 열
      if (rowMarket === market) {
        var actualRow = lastRow - searchRows + 1 + i;
        sheet.getRange(actualRow, 14).setValue(newStatus); // 상태 열 업데이트
        Logger.log('[' + market + '] 상태 업데이트: ' + newStatus);
        return;
      }
    }
  } catch (error) {
    Logger.log('상태 업데이트 실패: ' + error.toString());
  }
}

/**
 * 기존 시트에 레버리지 열 추가 (없으면)
 */
function ensureLeverageColumn(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // 레버리지 열이 이미 있는지 확인
  var hasLeverage = headers.indexOf('레버리지') >= 0;

  if (!hasLeverage) {
    // E열(5번째)에 레버리지 열 삽입 (신호 다음)
    sheet.insertColumnAfter(4);
    sheet.getRange(1, 5).setValue('레버리지');
    sheet.getRange(1, 5).setBackground('#4A90E2').setFontColor('#FFFFFF').setFontWeight('bold');

    Logger.log('📊 신호기록 시트에 레버리지 열 추가됨');
  }
}

function createSignalSheet(ss) {
  var sheet = ss.insertSheet(SHEET_CONFIG.SIGNAL_SHEET);

  var headers = [
    '날짜', '시간', '마켓', '신호', '레버리지', '진입가',
    'TP1', 'TP2', 'SL',
    'TP1(%)', 'TP2(%)', 'SL(%)',
    '신호강도', '상태'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4A90E2')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sheet.setFrozenRows(1);

  return sheet;
}

// ============================================
// 테스트 및 확인 함수
// ============================================

function testSetupSheet() {
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);

  var signalSheet = ss.getSheetByName(SHEET_CONFIG.SIGNAL_SHEET);
  if (!signalSheet) {
    createSignalSheet(ss);
    Logger.log('신호기록 시트 생성');
  }

  var tradeSheet = ss.getSheetByName(SHEET_CONFIG.TRADE_SHEET);
  if (!tradeSheet) {
    createTradeSheet(ss);
    Logger.log('V24 자동매매일지 시트 생성');
  }

  var statsSheet = ss.getSheetByName(SHEET_CONFIG.STATS_SHEET);
  if (!statsSheet) {
    createStatsSheet(ss);
    Logger.log('통계 시트 생성');
  }

  Logger.log('✅ 시트 설정 완료');
  Logger.log('시트 URL: ' + ss.getUrl());
}

/**
 * 시뮬레이션 리셋 (처음부터 다시 시작)
 */
function resetSimulation() {
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);

  // 기존 시트 삭제 (try-catch로 오류 방지)
  try {
    var tradeSheet = ss.getSheetByName(SHEET_CONFIG.TRADE_SHEET);
    if (tradeSheet) {
      ss.deleteSheet(tradeSheet);
      Logger.log('V25 자동매매일지 시트 삭제');
    }
  } catch (e) {
    Logger.log('V25 자동매매일지 시트 삭제 실패: ' + e.toString());
  }

  // 이전 V24 시트도 삭제 시도
  try {
    var oldSheet = ss.getSheetByName('V24 자동매매일지');
    if (oldSheet) {
      ss.deleteSheet(oldSheet);
      Logger.log('V24 자동매매일지 시트 삭제');
    }
  } catch (e) {
    // 무시
  }

  try {
    var statsSheet = ss.getSheetByName(SHEET_CONFIG.STATS_SHEET);
    if (statsSheet) {
      ss.deleteSheet(statsSheet);
      Logger.log('통계 시트 삭제');
    }
  } catch (e) {
    Logger.log('통계 시트 삭제 실패: ' + e.toString());
  }

  // 포지션 초기화
  clearPosition();

  // 잠시 대기 후 새로 생성
  Utilities.sleep(500);

  // 새로 생성
  createTradeSheet(ss);
  Logger.log('V25 자동매매일지 시트 생성 완료');

  createStatsSheet(ss);
  Logger.log('통계 시트 생성 완료');

  Logger.log('');
  Logger.log('🔄 V25 시뮬레이션 리셋 완료!');
  Logger.log('💰 시작 잔고: $' + VIRTUAL_TRADING.STARTING_BALANCE);
  Logger.log('📊 지원 모드: 선물, 현물코인, 주식');
  Logger.log('📊 시트 URL: ' + ss.getUrl());
}

/**
 * 시뮬레이션 초기 설정 (시트가 없으면 생성)
 */
function initSimulation() {
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);

  var tradeSheet = ss.getSheetByName(SHEET_CONFIG.TRADE_SHEET);
  if (!tradeSheet) {
    createTradeSheet(ss);
    Logger.log('V25 자동매매일지 시트 생성');
  } else {
    Logger.log('V25 자동매매일지 시트 이미 존재');
  }

  var statsSheet = ss.getSheetByName(SHEET_CONFIG.STATS_SHEET);
  if (!statsSheet) {
    createStatsSheet(ss);
    Logger.log('통계 시트 생성');
  } else {
    Logger.log('통계 시트 이미 존재');
  }

  // 포지션 초기화
  clearPosition();

  Logger.log('');
  Logger.log('✅ V25 Universal 시뮬레이션 초기 설정 완료!');
  Logger.log('💰 시작 잔고: $' + VIRTUAL_TRADING.STARTING_BALANCE);
  Logger.log('📊 지원 모드: 선물, 현물코인, 주식');
  Logger.log('📊 시트 URL: ' + ss.getUrl());
}

/**
 * 현재 모드 설정 확인
 */
function showModeSettings() {
  Logger.log('=== V25 모드별 TP/SL 설정 ===');
  for (var mode in MODE_SETTINGS) {
    var s = MODE_SETTINGS[mode];
    Logger.log(mode + ': TP1=' + s.tp1 + '%, TP2=' + s.tp2 + '%, SL=' + s.sl + '%, SHORT=' + (s.shortEnabled ? '활성' : '비활성'));
  }
}

function testSignalLogging() {
  var testData = {
    version: '25',
    mode: '선물',
    signal: 'LONG',
    entry: '97500',
    tp1: '98280',
    tp2: '98962',
    sl: '97207',
    totalScore: '18',
    smart_money: 'WHALE',
    volume_ratio: '2.5'
  };

  processSignal(testData);
  Logger.log('테스트 신호 기록 완료 (선물 모드)');
}

function testSpotSignal() {
  var testData = {
    version: '25',
    mode: '현물코인',
    signal: 'LONG',
    entry: '97500',
    tp1: '98962',
    tp2: '100425',
    sl: '96525',
    totalScore: '16',
    smart_money: 'INSTITUTION',
    volume_ratio: '3.2'
  };

  processSignal(testData);
  Logger.log('테스트 신호 기록 완료 (현물코인 모드)');
}

function testShortBlocked() {
  var testData = {
    version: '25',
    mode: '현물코인',
    signal: 'SHORT',
    entry: '97500',
    tp1: '96037',
    tp2: '94575',
    sl: '98475',
    totalScore: '14'
  };

  var result = processSignal(testData);
  Logger.log('현물코인 SHORT 테스트: ' + JSON.stringify(result));
}

function testExitSignal() {
  var testData = {
    version: '25',
    mode: '현물코인',
    signal: 'EXIT',
    current_price: '97000',
    reason: 'WHALE_SELLING',
    volume_ratio: '2.8',
    sell_pressure: '75'
  };

  var result = processSignal(testData);
  Logger.log('EXIT 신호 테스트: ' + JSON.stringify(result));
}

function testDuplicateSignal() {
  var testData = {
    signal: 'LONG',
    entry: '96000000',
    tp1: '96800000',
    tp2: '97500000',
    sl: '95500000',
    totalScore: '14'
  };

  Logger.log('=== 중복 신호 테스트 ===');
  var result = processSignal(testData);
  Logger.log('결과: ' + JSON.stringify(result));
}

function checkPosition() {
  var positions = getAllOpenPositions();

  if (positions.length === 0) {
    Logger.log('열린 포지션 없음');
    return;
  }

  Logger.log('=== 열린 포지션 목록 (' + positions.length + '개) ===');

  for (var i = 0; i < positions.length; i++) {
    var position = positions[i];
    Logger.log('');
    Logger.log('📊 [' + (position.market || 'UNKNOWN') + ']');
    Logger.log('  버전: V' + (position.version || '26'));
    Logger.log('  모드: ' + (position.mode || '선물'));
    Logger.log('  레버리지: ' + (position.leverage || 10) + 'x');
    Logger.log('  신호: ' + position.signal);
    Logger.log('  진입가: $' + position.entryPrice.toFixed(2));
    Logger.log('  TP1: $' + position.tp1Price.toFixed(2) + ' (' + (position.tp1Pct || '1.0') + '%)');
    Logger.log('  TP2: $' + position.tp2Price.toFixed(2) + ' (' + (position.tp2Pct || '2.0') + '%)');
    Logger.log('  SL: $' + position.slPrice.toFixed(2) + ' (' + (position.slPct || '0.5') + '%)');
    Logger.log('  TP1 달성: ' + position.tp1Hit);
    Logger.log('  상태: ' + position.status);
    Logger.log('  고래: ' + (position.smartMoney || 'NONE'));
  }
}

function checkBalance() {
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_CONFIG.TRADE_SHEET);

  if (sheet) {
    var balance = getCurrentBalance(sheet);
    Logger.log('현재 잔고: $' + balance.toFixed(2));
  } else {
    Logger.log('가상매매 시트 없음. testSetupSheet 먼저 실행');
  }
}

function forceClosePosition() {
  clearAllPositions();
  Logger.log('모든 포지션 강제 삭제 완료');
}

// ============================================
// 🔄 자동 가격 모니터링 & 청산 (마켓별)
// ============================================

/**
 * 마켓별 현재 가격 조회 (Binance API)
 */
function getPriceByMarket(market) {
  try {
    var symbol = SUPPORTED_MARKETS[market] || 'BTCUSDT';
    var url = 'https://api.binance.com/api/v3/ticker/price?symbol=' + symbol;
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    if (responseCode !== 200) {
      Logger.log('[' + market + '] API 응답 코드: ' + responseCode);
      Logger.log('[' + market + '] API 응답: ' + responseText);

      // Binance 실패시 CoinGecko 백업 시도
      return getPriceFromCoinGecko(market);
    }

    var data = JSON.parse(responseText);
    return parseFloat(data.price);
  } catch (error) {
    Logger.log('[' + market + '] 가격 조회 실패: ' + error.toString());
    // Binance 실패시 CoinGecko 백업 시도
    return getPriceFromCoinGecko(market);
  }
}

/**
 * CoinGecko API 백업 (Binance 실패시)
 */
function getPriceFromCoinGecko(market) {
  try {
    var coinIds = {
      'BTC-USDT': 'bitcoin',
      'ETH-USDT': 'ethereum',
      'SOL-USDT': 'solana',
      'XRP-USDT': 'ripple',
      'DOGE-USDT': 'dogecoin'
    };

    var coinId = coinIds[market] || 'bitcoin';
    var url = 'https://api.coingecko.com/api/v3/simple/price?ids=' + coinId + '&vs_currencies=usd';
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(response.getContentText());
    var price = data[coinId] ? data[coinId].usd : null;

    if (price) {
      Logger.log('[' + market + '] CoinGecko 가격: $' + price);
    }
    return price;
  } catch (error) {
    Logger.log('[' + market + '] CoinGecko도 실패: ' + error.toString());
    return null;
  }
}

/**
 * 기존 호환성을 위한 BTC 가격 조회
 */
function getCurrentPrice() {
  return getPriceByMarket('BTC-USDT');
}

/**
 * 🎯 자동 가격 체크 및 청산 (1분마다 트리거로 실행) - 모든 마켓
 * ★ V28: Bitget 실거래 중에는 시뮬레이션 청산 안함 ★
 * Bitget 동기화에서 실제 청산을 감지함
 */
function checkPriceAndAutoClose() {
  var positions = getAllOpenPositions();

  if (positions.length === 0) {
    return; // 열린 포지션 없음
  }

  // ★ Bitget 실거래 중이면 시뮬레이션 청산 스킵 ★
  // 실제 청산은 syncBitgetPositions() → checkClosedPositions()에서 처리
  if (AUTO_TRADE_CONFIG.ENABLED) {
    Logger.log('=== Bitget 실거래 모드 - 가격 모니터링만 ===');
    for (var i = 0; i < positions.length; i++) {
      var position = positions[i];
      var market = position.market || 'BTC-USDT';
      var currentPrice = getPriceByMarket(market);
      if (currentPrice) {
        var pnl = position.signal === 'LONG' ?
          ((currentPrice - position.entryPrice) / position.entryPrice * 100) * (position.leverage || 10) :
          ((position.entryPrice - currentPrice) / position.entryPrice * 100) * (position.leverage || 10);
        Logger.log('[' + market + '] 현재가: $' + currentPrice.toFixed(2) + ' | PnL: ' + pnl.toFixed(2) + '%');
      }
    }
    return; // 실제 청산 처리 안함
  }

  // 시뮬레이션 모드일 때만 가격 기반 청산
  Logger.log('=== 시뮬레이션 가격 체크 (' + positions.length + '개 포지션) ===');

  for (var i = 0; i < positions.length; i++) {
    var position = positions[i];
    checkSinglePosition(position);
  }
}

/**
 * 단일 포지션 체크
 */
function checkSinglePosition(position) {
  var market = position.market || 'BTC-USDT';
  var currentPrice = getPriceByMarket(market);

  if (!currentPrice) {
    Logger.log('[' + market + '] 가격 조회 실패 - 스킵');
    return;
  }

  var signal = position.signal;
  var entryPrice = position.entryPrice;
  var tp1Price = position.tp1Price;
  var tp2Price = position.tp2Price;
  var slPrice = position.slPrice;
  var tp1Hit = position.tp1Hit || false;

  Logger.log('[' + market + '] 현재가: $' + currentPrice.toFixed(2) + ' | ' + signal + ' @ $' + entryPrice.toFixed(2));

  // LONG 포지션 체크
  if (signal === 'LONG') {
    // TP2 도달 체크 (TP1 이후)
    if (tp1Hit && currentPrice >= tp2Price) {
      Logger.log('✅✅ [' + market + '] TP2 도달! 전량 익절');
      autoRecordCloseByMarket(position, 'TP2', currentPrice);
      return;
    }

    // TP1 도달 체크
    if (!tp1Hit && currentPrice >= tp1Price) {
      Logger.log('✅ [' + market + '] TP1 도달! 50% 익절');
      autoRecordTP1ByMarket(position, currentPrice);
      return;
    }

    // SL 도달 체크
    if (currentPrice <= slPrice) {
      if (tp1Hit) {
        Logger.log('⚠️ [' + market + '] TP1 후 SL 도달');
        autoRecordCloseByMarket(position, 'TP1 후 SL', currentPrice);
      } else {
        Logger.log('❌ [' + market + '] SL 도달! 손절');
        autoRecordCloseByMarket(position, 'SL', currentPrice);
      }
      return;
    }
  }

  // SHORT 포지션 체크
  if (signal === 'SHORT') {
    // TP2 도달 체크 (TP1 이후)
    if (tp1Hit && currentPrice <= tp2Price) {
      Logger.log('✅✅ [' + market + '] TP2 도달! 전량 익절');
      autoRecordCloseByMarket(position, 'TP2', currentPrice);
      return;
    }

    // TP1 도달 체크
    if (!tp1Hit && currentPrice <= tp1Price) {
      Logger.log('✅ [' + market + '] TP1 도달! 50% 익절');
      autoRecordTP1ByMarket(position, currentPrice);
      return;
    }

    // SL 도달 체크
    if (currentPrice >= slPrice) {
      if (tp1Hit) {
        Logger.log('⚠️ [' + market + '] TP1 후 SL 도달');
        autoRecordCloseByMarket(position, 'TP1 후 SL', currentPrice);
      } else {
        Logger.log('❌ [' + market + '] SL 도달! 손절');
        autoRecordCloseByMarket(position, 'SL', currentPrice);
      }
      return;
    }
  }
}

/**
 * TP1 자동 기록 - 마켓별 (50% 청산, 포지션 유지)
 */
function autoRecordTP1ByMarket(position, currentPrice) {
  var market = position.market || 'BTC-USDT';
  var leverage = position.leverage || 10;

  // 가격 변동률 계산
  var priceChangePercent;
  if (position.signal === 'LONG') {
    priceChangePercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
  } else {
    priceChangePercent = ((position.entryPrice - currentPrice) / position.entryPrice) * 100;
  }

  // 레버리지 적용된 실제 수익률
  var profitPercent = priceChangePercent * leverage;

  // 50% 청산이므로 수익도 절반
  var halfProfit = profitPercent / 2;

  // 거래 기록
  logAutoTradeResult(position, 'TP1', currentPrice, halfProfit);

  // TP1 달성 플래그 업데이트
  position.tp1Hit = true;
  position.tp1HitPrice = currentPrice;
  position.tp1HitTime = new Date().toISOString();

  // 마켓별 포지션 업데이트
  var props = PropertiesService.getScriptProperties();
  var key = 'POSITION_' + market.replace('-', '_');
  props.setProperty(key, JSON.stringify(position));

  // 알림 전송
  sendAutoNotification('✅ [' + market + '] TP1 도달',
    market + ' ' + position.signal + ' 포지션 TP1 도달!\n\n' +
    '진입가: $' + position.entryPrice.toFixed(2) + '\n' +
    'TP1 청산가: $' + currentPrice.toFixed(2) + '\n' +
    '수익률: +' + halfProfit.toFixed(2) + '% (50%)\n\n' +
    '남은 50%는 TP2 또는 SL 대기 중'
  );

  Logger.log('[' + market + '] TP1 기록 완료: +' + halfProfit.toFixed(2) + '%');
}

/**
 * 자동 청산 기록 - 마켓별 (포지션 종료)
 */
function autoRecordCloseByMarket(position, exitType, currentPrice) {
  var market = position.market || 'BTC-USDT';
  var leverage = position.leverage || 10;

  // 가격 변동률 계산
  var priceChangePercent;
  if (position.signal === 'LONG') {
    priceChangePercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
  } else {
    priceChangePercent = ((position.entryPrice - currentPrice) / position.entryPrice) * 100;
  }

  // 레버리지 적용된 실제 수익률
  var profitPercent = priceChangePercent * leverage;

  // TP1 이후라면 남은 50%에 대한 수익/손실
  var actualProfit = profitPercent;
  if (position.tp1Hit) {
    actualProfit = profitPercent / 2; // 남은 50%에 대해서만
  }

  // 거래 기록
  logAutoTradeResult(position, exitType, currentPrice, actualProfit);

  // 알림 전송
  var emoji = exitType.indexOf('TP') >= 0 ? '✅' : '❌';
  var resultText = actualProfit >= 0 ? '+' + actualProfit.toFixed(2) : actualProfit.toFixed(2);

  sendAutoNotification(emoji + ' [' + market + '] ' + exitType,
    market + ' ' + position.signal + ' 포지션 청산!\n\n' +
    '진입가: $' + position.entryPrice.toFixed(2) + '\n' +
    '청산가: $' + currentPrice.toFixed(2) + '\n' +
    '청산유형: ' + exitType + '\n' +
    '수익률: ' + resultText + '%\n' +
    (position.tp1Hit ? '(TP1 달성 후 청산)' : '')
  );

  // 마켓별 포지션 삭제
  clearPositionByMarket(market);

  Logger.log('[' + market + '] ' + exitType + ' 기록 완료: ' + resultText + '%');
}

// 하위 호환성을 위한 기존 함수
function autoRecordTP1(position, currentPrice) {
  autoRecordTP1ByMarket(position, currentPrice);
}

function autoRecordClose(position, exitType, currentPrice) {
  autoRecordCloseByMarket(position, exitType, currentPrice);
}

/**
 * 자동 거래 결과 기록 (시트에 기록)
 */
function logAutoTradeResult(position, exitType, exitPrice, profitPercent) {
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_CONFIG.TRADE_SHEET);

  if (!sheet) {
    sheet = createTradeSheet(ss);
  }

  // ★ 실제 Bitget 잔고 사용 ★
  var currentBalance = getCurrentBalance(sheet);

  // 실제 수익금 계산 (Bitget 미실현 손익 기준)
  var realizedPnL = getRealizedPnLFromBitget(position);
  var profitAmount = realizedPnL !== null ? realizedPnL : (currentBalance * (profitPercent / 100));

  var newBalance = currentBalance; // Bitget 잔고는 이미 청산 후 잔고
  var startingBalance = getStartingBalanceFromSheet(sheet);
  var totalReturnPercent = startingBalance > 0 ? ((newBalance - startingBalance) / startingBalance * 100) : 0;

  var now = new Date();

  // 청산 유형별 이모지 및 색상
  var emoji = '';
  var bgColor = '#FFFFFF';
  var isWin = false;

  if (exitType === 'TP1') {
    emoji = '✅ 1차익절';
    bgColor = '#E8F5E9';
    isWin = true;
  } else if (exitType === 'TP2') {
    emoji = '✅✅ 2차익절';
    bgColor = '#C8E6C9';
    isWin = true;
  } else if (exitType === 'SL') {
    emoji = '❌ 손절';
    bgColor = '#FFEBEE';
    isWin = false;
  } else if (exitType === 'TP1 후 SL') {
    emoji = '⚠️ 1차익절→손절';
    bgColor = '#FFF3E0';
    isWin = true; // TP1 달성했으므로 승
  } else if (exitType === 'TP1 후 BE') {
    emoji = '➡️ 1차익절→본절';
    bgColor = '#F5F5F5';
    isWin = true;
  } else if (exitType === 'BE') {
    emoji = '➡️ 본절';
    bgColor = '#F5F5F5';
    isWin = false;
  }

  // 진입 시간 계산
  var entryTime = position.entryTime ? new Date(position.entryTime) : now;
  var holdingMinutes = Math.round((now - entryTime) / 1000 / 60);

  // 마켓 정보
  var market = position.market || 'BTC-USDT';

  // 수식 파싱 방지용 텍스트 변수 (+ 또는 - 로 시작하면 수식으로 인식됨)
  var profitPercentText = (profitPercent >= 0 ? '+' : '') + profitPercent.toFixed(2) + '%';
  var profitAmountText = (profitAmount >= 0 ? '+$' : '-$') + Math.abs(profitAmount).toFixed(2);
  var totalReturnText = (totalReturnPercent >= 0 ? '+' : '') + totalReturnPercent.toFixed(2) + '%';

  var row = [
    Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd'),
    Utilities.formatDate(now, 'Asia/Seoul', 'HH:mm:ss'),
    market,
    position.signal,
    '$' + position.entryPrice.toFixed(2),
    '$' + exitPrice.toFixed(2),
    emoji,
    profitPercentText,
    profitAmountText,
    '$' + newBalance.toFixed(2),
    totalReturnText,
    holdingMinutes + '분 보유'
  ];

  sheet.appendRow(row);

  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 1, 1, row.length).setBackground(bgColor);

  // ★ 수식 파싱 오류 방지 - 텍스트 형식 강제 ★
  sheet.getRange(lastRow, 8).setNumberFormat('@');  // H열: 수익률%
  sheet.getRange(lastRow, 9).setNumberFormat('@');  // I열: 수익금
  sheet.getRange(lastRow, 11).setNumberFormat('@'); // K열: 총수익률%

  // 수익률 색상 (열 번호 +1 마켓 추가됨)
  if (profitPercent > 0) {
    sheet.getRange(lastRow, 8).setFontColor('#2E7D32').setFontWeight('bold');
    sheet.getRange(lastRow, 9).setFontColor('#2E7D32').setFontWeight('bold');
  } else if (profitPercent < 0) {
    sheet.getRange(lastRow, 8).setFontColor('#C62828').setFontWeight('bold');
    sheet.getRange(lastRow, 9).setFontColor('#C62828').setFontWeight('bold');
  }

  // 누적수익률 색상 (열 번호 +1 마켓 추가됨)
  if (totalReturnPercent > 0) {
    sheet.getRange(lastRow, 11).setFontColor('#2E7D32').setFontWeight('bold');
  } else if (totalReturnPercent < 0) {
    sheet.getRange(lastRow, 11).setFontColor('#C62828').setFontWeight('bold');
  }

  sheet.getRange(lastRow, 10).setFontWeight('bold').setBackground('#E3F2FD');

  // 통계 업데이트
  updateStatistics(sheet, newBalance, totalReturnPercent, isWin, exitType);

  Logger.log('[' + market + '] 자동 거래 기록: ' + emoji + ' | 잔고: $' + newBalance.toFixed(2) + ' | 누적: ' + totalReturnPercent.toFixed(2) + '%');
}

/**
 * 자동 알림 전송
 */
function sendAutoNotification(title, message) {
  Logger.log('📱 알림: ' + title);
  Logger.log(message);

  // 텔레그램 알림 (TELEGRAM_CONFIG 또는 CONFIG 사용)
  var botToken = TELEGRAM_CONFIG.BOT_TOKEN || CONFIG.NOTIFICATION.TELEGRAM_BOT_TOKEN;
  var chatId = TELEGRAM_CONFIG.CHAT_ID || CONFIG.NOTIFICATION.TELEGRAM_CHAT_ID;

  if (botToken && chatId) {
    try {
      var telegramUrl = 'https://api.telegram.org/bot' + botToken + '/sendMessage';
      var htmlMessage = '<b>' + title + '</b>\n\n' + message.replace(/\n/g, '\n');

      UrlFetchApp.fetch(telegramUrl, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          chat_id: chatId,
          text: htmlMessage,
          parse_mode: 'HTML'
        })
      });
      Logger.log('✅ 텔레그램 전송 성공');
    } catch (e) {
      Logger.log('❌ 텔레그램 전송 실패: ' + e.toString());
    }
  }

  // 이메일 알림 (설정되어 있으면)
  if (CONFIG.NOTIFICATION.EMAIL) {
    try {
      MailApp.sendEmail(CONFIG.NOTIFICATION.EMAIL, '[V27] ' + title, message);
      Logger.log('✅ 이메일 전송 성공');
    } catch (e) {
      Logger.log('❌ 이메일 전송 실패: ' + e.toString());
    }
  }
}

// ============================================
// 🕐 트리거 설정 (1분마다 자동 체크)
// ============================================

/**
 * 자동 모니터링 시작 (트리거 설정)
 */
function startAutoMonitoring() {
  // 기존 트리거 삭제
  stopAutoMonitoring();

  // 1분마다 체크하는 트리거 생성
  ScriptApp.newTrigger('checkPriceAndAutoClose')
    .timeBased()
    .everyMinutes(1)
    .create();

  Logger.log('✅ 자동 모니터링 시작됨 (1분마다 가격 체크)');
  Logger.log('현재 포지션 상태:');
  checkPosition();
}

/**
 * 자동 모니터링 중지 (트리거 삭제)
 */
function stopAutoMonitoring() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkPriceAndAutoClose') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('트리거 삭제: checkPriceAndAutoClose');
    }
  }
  Logger.log('✅ 자동 모니터링 중지됨');
}

/**
 * 현재 트리거 상태 확인
 */
function checkTriggerStatus() {
  var triggers = ScriptApp.getProjectTriggers();
  var found = false;

  Logger.log('=== 트리거 상태 ===');
  for (var i = 0; i < triggers.length; i++) {
    Logger.log('- ' + triggers[i].getHandlerFunction() + ' (' + triggers[i].getEventType() + ')');
    if (triggers[i].getHandlerFunction() === 'checkPriceAndAutoClose') {
      found = true;
    }
  }

  if (found) {
    Logger.log('✅ 자동 모니터링 활성화 중');
  } else {
    Logger.log('⚠️ 자동 모니터링 비활성화');
    Logger.log('startAutoMonitoring() 실행하여 활성화하세요');
  }
}

/**
 * 현재 가격 테스트
 */
function testGetPrice() {
  var price = getCurrentPrice();
  if (price) {
    Logger.log('현재 BTC 가격: $' + price.toFixed(2));
  } else {
    Logger.log('가격 조회 실패');
  }
}

/**
 * 가격 체크 수동 테스트
 */
function testPriceCheck() {
  Logger.log('=== 수동 가격 체크 테스트 ===');
  checkPriceAndAutoClose();
}

// ============================================
// 🛡️ 트리거 자동 복구 시스템 (15분마다)
// ============================================

/**
 * 트리거 상태 체크 및 자동 복구 (15분마다 실행)
 */
function watchdogCheck() {
  var triggers = ScriptApp.getProjectTriggers();
  var priceCheckFound = false;
  var watchdogFound = false;

  for (var i = 0; i < triggers.length; i++) {
    var funcName = triggers[i].getHandlerFunction();
    if (funcName === 'checkPriceAndAutoClose') {
      priceCheckFound = true;
    }
    if (funcName === 'watchdogCheck') {
      watchdogFound = true;
    }
  }

  var now = new Date();
  var timeStr = Utilities.formatDate(now, 'Asia/Seoul', 'HH:mm:ss');

  if (!priceCheckFound) {
    // 가격 체크 트리거가 없으면 자동 복구
    Logger.log('⚠️ [' + timeStr + '] 가격 모니터링 트리거 없음 - 자동 복구 시작');

    ScriptApp.newTrigger('checkPriceAndAutoClose')
      .timeBased()
      .everyMinutes(1)
      .create();

    Logger.log('✅ [' + timeStr + '] 가격 모니터링 트리거 복구 완료!');

    // 복구 알림
    sendAutoNotification('🔧 트리거 자동 복구',
      '가격 모니터링 트리거가 꺼져있어서 자동으로 복구했습니다.\n\n' +
      '시간: ' + timeStr
    );
  } else {
    Logger.log('✅ [' + timeStr + '] 워치독 체크 - 정상 작동 중');
  }
}

/**
 * 워치독 시스템 시작 (15분마다 트리거 체크)
 */
function startWatchdog() {
  // 기존 워치독 트리거 삭제
  stopWatchdog();

  // 15분마다 체크하는 워치독 트리거 생성
  ScriptApp.newTrigger('watchdogCheck')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('🛡️ 워치독 시스템 시작됨 (15분마다 트리거 상태 체크)');
}

/**
 * 워치독 시스템 중지
 */
function stopWatchdog() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'watchdogCheck') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('트리거 삭제: watchdogCheck');
    }
  }
  Logger.log('🛡️ 워치독 시스템 중지됨');
}

/**
 * 전체 시스템 시작 (모니터링 + 워치독)
 */
function startFullSystem() {
  Logger.log('=== 전체 시스템 시작 ===');

  // 1. 기존 트리거 모두 정리
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var funcName = triggers[i].getHandlerFunction();
    if (funcName === 'checkPriceAndAutoClose' ||
        funcName === 'watchdogCheck' ||
        funcName === 'checkStopLossAndTakeProfit' ||
        funcName === 'checkPriceAndExecute') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  Logger.log('기존 트리거 정리 완료');

  // 2. 가격 모니터링 시작 (1분마다)
  ScriptApp.newTrigger('checkPriceAndAutoClose')
    .timeBased()
    .everyMinutes(1)
    .create();
  Logger.log('✅ 가격 모니터링 시작 (1분마다)');

  // 3. 워치독 시작 (15분마다)
  ScriptApp.newTrigger('watchdogCheck')
    .timeBased()
    .everyMinutes(15)
    .create();
  Logger.log('🛡️ 워치독 시작 (15분마다 트리거 체크)');

  // 4. 현재 상태 출력
  Logger.log('');
  Logger.log('=== 시스템 상태 ===');
  checkPosition();

  Logger.log('');
  Logger.log('🚀 전체 시스템 시작 완료!');
  Logger.log('- 가격 체크: 1분마다');
  Logger.log('- 트리거 감시: 15분마다');
  Logger.log('- 트리거 꺼지면 자동 복구됨');
}

/**
 * 전체 시스템 중지
 */
function stopFullSystem() {
  stopAutoMonitoring();
  stopWatchdog();
  Logger.log('🛑 전체 시스템 중지됨');
}

// ============================================
// 🔗 Bitget API 연동
// ============================================

/**
 * Bitget API 서명 생성 (HMAC SHA256)
 */
function createBitgetSignature(timestamp, method, requestPath, body) {
  var message = timestamp + method + requestPath + (body || '');
  var signature = Utilities.computeHmacSha256Signature(message, BITGET_CONFIG.SECRET_KEY);
  return Utilities.base64Encode(signature);
}

/**
 * Bitget API 호출
 */
function callBitgetAPI(method, endpoint, body) {
  var timestamp = Date.now().toString();
  var requestPath = endpoint;
  var bodyStr = body ? JSON.stringify(body) : '';

  var signature = createBitgetSignature(timestamp, method, requestPath, bodyStr);

  var headers = {
    'ACCESS-KEY': BITGET_CONFIG.API_KEY,
    'ACCESS-SIGN': signature,
    'ACCESS-TIMESTAMP': timestamp,
    'ACCESS-PASSPHRASE': BITGET_CONFIG.PASSPHRASE,
    'Content-Type': 'application/json',
    'locale': 'en-US'
  };

  var options = {
    method: method.toLowerCase(),
    headers: headers,
    muteHttpExceptions: true
  };

  if (body && method !== 'GET') {
    options.payload = bodyStr;
  }

  var url = BITGET_CONFIG.BASE_URL + endpoint;
  var response = UrlFetchApp.fetch(url, options);

  return JSON.parse(response.getContentText());
}

/**
 * Bitget에서 현재 레버리지 조회 (USDT-M 선물)
 */
function getBitgetLeverage(symbol) {
  symbol = symbol || 'BTCUSDT';
  var endpoint = '/api/v2/mix/account/account?symbol=' + symbol + '&productType=USDT-FUTURES&marginCoin=USDT';

  try {
    var result = callBitgetAPI('GET', endpoint, null);

    if (result.code === '00000' && result.data) {
      var leverage = parseInt(result.data.crossMarginLeverage || result.data.fixedLongLeverage || 10);
      Logger.log('📊 Bitget ' + symbol + ' 레버리지: ' + leverage + 'x');
      return leverage;
    } else {
      Logger.log('Bitget API 오류: ' + JSON.stringify(result));
      return null;
    }
  } catch (error) {
    Logger.log('Bitget 레버리지 조회 실패: ' + error.toString());
    return null;
  }
}

/**
 * Bitget 계정 정보 조회
 */
function getBitgetAccountInfo() {
  var endpoint = '/api/v2/mix/account/accounts?productType=USDT-FUTURES';

  try {
    var result = callBitgetAPI('GET', endpoint, null);

    if (result.code === '00000' && result.data) {
      Logger.log('=== Bitget 계정 정보 ===');
      result.data.forEach(function(account) {
        Logger.log('마진코인: ' + account.marginCoin);
        Logger.log('사용가능: ' + account.available);
        Logger.log('총자산: ' + account.usdtEquity);
        Logger.log('미실현손익: ' + account.unrealizedPL);
        Logger.log('---');
      });
      return result.data;
    } else {
      Logger.log('Bitget API 오류: ' + JSON.stringify(result));
      return null;
    }
  } catch (error) {
    Logger.log('Bitget 계정 조회 실패: ' + error.toString());
    return null;
  }
}

/**
 * Bitget 레버리지 테스트
 */
function testBitgetLeverage() {
  Logger.log('=== Bitget 레버리지 테스트 ===');

  var btcLeverage = getBitgetLeverage('BTCUSDT');
  var ethLeverage = getBitgetLeverage('ETHUSDT');

  Logger.log('');
  Logger.log('BTC 레버리지: ' + (btcLeverage || '조회실패') + 'x');
  Logger.log('ETH 레버리지: ' + (ethLeverage || '조회실패') + 'x');
}

/**
 * Bitget 연결 테스트
 */
function testBitgetConnection() {
  Logger.log('=== Bitget API 연결 테스트 ===');
  Logger.log('API Key: ' + BITGET_CONFIG.API_KEY.substring(0, 10) + '...');

  var accountInfo = getBitgetAccountInfo();

  if (accountInfo) {
    Logger.log('✅ Bitget 연결 성공!');
  } else {
    Logger.log('❌ Bitget 연결 실패');
  }
}

/**
 * 레버리지 기반 TP/SL 계산 (Bitget에서 조회)
 */
function calculateTPSLWithBitgetLeverage(market, entryPrice, signal) {
  // Bitget 심볼 변환
  var bitgetSymbol = market.replace('-', '');

  // Bitget에서 레버리지 조회
  var leverage = getBitgetLeverage(bitgetSymbol);

  if (!leverage) {
    leverage = 10; // 기본값
    Logger.log('⚠️ 레버리지 조회 실패, 기본값 사용: ' + leverage + 'x');
  }

  // 5배 기준으로 TP/SL 계산
  var multiplier = 5.0 / leverage;

  var baseTP1 = 1.0;  // 5배 기준 1%
  var baseTP2 = 2.0;  // 5배 기준 2%
  var baseSL = 0.5;   // 5배 기준 0.5%

  var tp1Pct = Math.max(0.1, baseTP1 * multiplier);
  var tp2Pct = Math.max(0.2, baseTP2 * multiplier);
  var slPct = Math.max(0.05, baseSL * multiplier);

  var tp1Price, tp2Price, slPrice;

  if (signal === 'LONG') {
    tp1Price = entryPrice * (1 + tp1Pct / 100);
    tp2Price = entryPrice * (1 + tp2Pct / 100);
    slPrice = entryPrice * (1 - slPct / 100);
  } else {
    tp1Price = entryPrice * (1 - tp1Pct / 100);
    tp2Price = entryPrice * (1 - tp2Pct / 100);
    slPrice = entryPrice * (1 + slPct / 100);
  }

  Logger.log('📊 레버리지 ' + leverage + 'x 기준 TP/SL:');
  Logger.log('  TP1: ' + tp1Pct.toFixed(2) + '% ($' + tp1Price.toFixed(2) + ')');
  Logger.log('  TP2: ' + tp2Pct.toFixed(2) + '% ($' + tp2Price.toFixed(2) + ')');
  Logger.log('  SL: ' + slPct.toFixed(2) + '% ($' + slPrice.toFixed(2) + ')');

  return {
    leverage: leverage,
    tp1Pct: tp1Pct,
    tp2Pct: tp2Pct,
    slPct: slPct,
    tp1Price: tp1Price,
    tp2Price: tp2Price,
    slPrice: slPrice
  };
}

/**
 * 레버리지를 직접 전달받아 TP/SL 계산 (API 재조회 없음)
 */
function calculateTPSLByLeverage(entryPrice, signal, leverage) {
  // 5배 기준으로 TP/SL 계산
  var multiplier = 5.0 / leverage;

  var baseTP1 = 1.0;  // 5배 기준 1%
  var baseTP2 = 2.0;  // 5배 기준 2%
  var baseSL = 0.5;   // 5배 기준 0.5%

  var tp1Pct = Math.max(0.03, baseTP1 * multiplier);  // 최소 0.03%
  var tp2Pct = Math.max(0.06, baseTP2 * multiplier);  // 최소 0.06%
  var slPct = Math.max(0.02, baseSL * multiplier);    // 최소 0.02%

  var tp1Price, tp2Price, slPrice;

  if (signal === 'LONG') {
    tp1Price = entryPrice * (1 + tp1Pct / 100);
    tp2Price = entryPrice * (1 + tp2Pct / 100);
    slPrice = entryPrice * (1 - slPct / 100);
  } else {
    tp1Price = entryPrice * (1 - tp1Pct / 100);
    tp2Price = entryPrice * (1 - tp2Pct / 100);
    slPrice = entryPrice * (1 + slPct / 100);
  }

  Logger.log('📊 레버리지 ' + leverage + 'x 기준 TP/SL:');
  Logger.log('  TP1: ' + tp1Pct.toFixed(2) + '% ($' + tp1Price.toFixed(2) + ')');
  Logger.log('  TP2: ' + tp2Pct.toFixed(2) + '% ($' + tp2Price.toFixed(2) + ')');
  Logger.log('  SL: ' + slPct.toFixed(2) + '% ($' + slPrice.toFixed(2) + ')');

  return {
    leverage: leverage,
    tp1Pct: tp1Pct,
    tp2Pct: tp2Pct,
    slPct: slPct,
    tp1Price: tp1Price,
    tp2Price: tp2Price,
    slPrice: slPrice
  };
}

// ============================================
// 🚀 Bitget 자동매매 기능
// ============================================

// 자동매매 ON/OFF 설정
var AUTO_TRADE_CONFIG = {
  ENABLED: true,           // ★ Bitget 실거래 모드 - 시뮬레이션 청산 안함 ★
  USE_PERCENTAGE: true,    // true: 잔고의 %로 주문, false: 고정 USDT
  ORDER_PERCENTAGE: 10,    // 잔고의 10% 사용
  FIXED_USDT: 10,          // 고정 금액 사용시 10 USDT
  MIN_ORDER_USDT: 5        // 최소 주문 금액
};

/**
 * Bitget 마켓 주문 (시장가)
 */
function placeBitgetMarketOrder(symbol, side, size, leverage) {
  var endpoint = '/api/v2/mix/order/place-order';

  var body = {
    symbol: symbol,
    productType: 'USDT-FUTURES',
    marginMode: 'crossed',
    marginCoin: 'USDT',
    size: size.toString(),
    side: side,           // 'buy' 또는 'sell'
    tradeSide: side === 'buy' ? 'open' : 'open',  // 'open' = 신규, 'close' = 청산
    orderType: 'market',
    force: 'gtc'
  };

  try {
    var result = callBitgetAPI('POST', endpoint, body);

    if (result.code === '00000') {
      Logger.log('✅ Bitget 주문 성공: ' + symbol + ' ' + side.toUpperCase() + ' ' + size);
      Logger.log('주문 ID: ' + result.data.orderId);
      return result.data;
    } else {
      Logger.log('❌ Bitget 주문 실패: ' + JSON.stringify(result));
      return null;
    }
  } catch (error) {
    Logger.log('❌ Bitget 주문 에러: ' + error.toString());
    return null;
  }
}

/**
 * Bitget TP/SL 설정 (TPSL 주문)
 */
function placeBitgetTPSL(symbol, holdSide, tpPrice, slPrice, size) {
  var endpoint = '/api/v2/mix/order/place-tpsl-order';

  var body = {
    symbol: symbol,
    productType: 'USDT-FUTURES',
    marginMode: 'crossed',
    marginCoin: 'USDT',
    planType: 'pos_profit',  // 포지션 전체 TP/SL
    triggerPrice: tpPrice.toString(),
    triggerType: 'mark_price',
    holdSide: holdSide      // 'long' 또는 'short'
  };

  try {
    // TP 설정
    body.planType = 'pos_profit';
    body.triggerPrice = tpPrice.toString();
    var tpResult = callBitgetAPI('POST', endpoint, body);

    if (tpResult.code === '00000') {
      Logger.log('✅ TP 설정 완료: $' + tpPrice);
    } else {
      Logger.log('⚠️ TP 설정 실패: ' + JSON.stringify(tpResult));
    }

    // SL 설정
    body.planType = 'pos_loss';
    body.triggerPrice = slPrice.toString();
    var slResult = callBitgetAPI('POST', endpoint, body);

    if (slResult.code === '00000') {
      Logger.log('✅ SL 설정 완료: $' + slPrice);
    } else {
      Logger.log('⚠️ SL 설정 실패: ' + JSON.stringify(slResult));
    }

    return { tp: tpResult, sl: slResult };
  } catch (error) {
    Logger.log('❌ TP/SL 설정 에러: ' + error.toString());
    return null;
  }
}

/**
 * Bitget 사용 가능 잔고 조회
 */
function getBitgetAvailableBalance() {
  var endpoint = '/api/v2/mix/account/accounts?productType=USDT-FUTURES';

  try {
    var result = callBitgetAPI('GET', endpoint, null);

    if (result.code === '00000' && result.data) {
      for (var i = 0; i < result.data.length; i++) {
        if (result.data[i].marginCoin === 'USDT') {
          var available = parseFloat(result.data[i].available);
          Logger.log('💰 Bitget 사용가능 잔고: $' + available.toFixed(2));
          return available;
        }
      }
    }
    return 0;
  } catch (error) {
    Logger.log('잔고 조회 실패: ' + error.toString());
    return 0;
  }
}

/**
 * 주문 수량 계산
 */
function calculateOrderSize(symbol, entryPrice, leverage) {
  var availableBalance = getBitgetAvailableBalance();

  if (availableBalance < AUTO_TRADE_CONFIG.MIN_ORDER_USDT) {
    Logger.log('⚠️ 잔고 부족: $' + availableBalance.toFixed(2));
    return 0;
  }

  var orderUsdt;
  if (AUTO_TRADE_CONFIG.USE_PERCENTAGE) {
    orderUsdt = availableBalance * (AUTO_TRADE_CONFIG.ORDER_PERCENTAGE / 100);
  } else {
    orderUsdt = AUTO_TRADE_CONFIG.FIXED_USDT;
  }

  // 최소 주문 금액 체크
  orderUsdt = Math.max(orderUsdt, AUTO_TRADE_CONFIG.MIN_ORDER_USDT);
  orderUsdt = Math.min(orderUsdt, availableBalance);

  // 레버리지 적용한 포지션 크기 계산
  var positionValue = orderUsdt * leverage;
  var size = positionValue / entryPrice;

  // 소수점 조정 (BTC는 0.001 단위)
  if (symbol.indexOf('BTC') >= 0) {
    size = Math.floor(size * 1000) / 1000;
  } else if (symbol.indexOf('ETH') >= 0) {
    size = Math.floor(size * 100) / 100;
  } else {
    size = Math.floor(size * 10) / 10;
  }

  Logger.log('📊 주문 계산:');
  Logger.log('  사용 금액: $' + orderUsdt.toFixed(2));
  Logger.log('  레버리지: ' + leverage + 'x');
  Logger.log('  포지션 가치: $' + positionValue.toFixed(2));
  Logger.log('  주문 수량: ' + size);

  return size;
}

/**
 * 🚀 자동매매 실행 (신호 수신 시 호출)
 */
function executeAutoTrade(market, signal, entryPrice, tp1Price, slPrice, leverage) {
  if (!AUTO_TRADE_CONFIG.ENABLED) {
    Logger.log('⏸️ 자동매매 비활성화 상태');
    return null;
  }

  var symbol = market.replace('-', '');

  Logger.log('');
  Logger.log('🚀 ===== 자동매매 실행 =====');
  Logger.log('마켓: ' + symbol);
  Logger.log('신호: ' + signal);
  Logger.log('진입가: $' + entryPrice);
  Logger.log('TP1: $' + tp1Price);
  Logger.log('SL: $' + slPrice);
  Logger.log('레버리지: ' + leverage + 'x');

  // 주문 수량 계산
  var size = calculateOrderSize(symbol, entryPrice, leverage);

  if (size <= 0) {
    Logger.log('❌ 주문 수량 계산 실패 또는 잔고 부족');
    return null;
  }

  // 주문 방향 결정
  var side = signal === 'LONG' ? 'buy' : 'sell';
  var holdSide = signal === 'LONG' ? 'long' : 'short';

  // 시장가 주문 실행
  var orderResult = placeBitgetMarketOrder(symbol, side, size, leverage);

  if (orderResult) {
    Logger.log('✅ 포지션 진입 성공!');

    // TP/SL 설정 (약간 딜레이 후)
    Utilities.sleep(1000);
    var tpslResult = placeBitgetTPSL(symbol, holdSide, tp1Price, slPrice, size);

    Logger.log('🚀 ===== 자동매매 완료 =====');
    Logger.log('');

    return {
      order: orderResult,
      tpsl: tpslResult,
      size: size
    };
  } else {
    Logger.log('❌ 포지션 진입 실패');
    return null;
  }
}

/**
 * Bitget 현재 포지션 조회
 */
function getBitgetPositions() {
  var endpoint = '/api/v2/mix/position/all-position?productType=USDT-FUTURES&marginCoin=USDT';

  try {
    var result = callBitgetAPI('GET', endpoint, null);

    if (result.code === '00000' && result.data) {
      Logger.log('=== Bitget 포지션 ===');

      if (result.data.length === 0) {
        Logger.log('열린 포지션 없음');
        return [];
      }

      result.data.forEach(function(pos) {
        if (parseFloat(pos.total) > 0) {
          Logger.log('');
          Logger.log('📊 ' + pos.symbol);
          Logger.log('  방향: ' + pos.holdSide.toUpperCase());
          Logger.log('  수량: ' + pos.total);
          Logger.log('  진입가: $' + pos.openPriceAvg);
          Logger.log('  미실현 PnL: $' + pos.unrealizedPL);
          Logger.log('  레버리지: ' + pos.leverage + 'x');
        }
      });

      return result.data.filter(function(pos) {
        return parseFloat(pos.total) > 0;
      });
    }
    return [];
  } catch (error) {
    Logger.log('포지션 조회 실패: ' + error.toString());
    return [];
  }
}

/**
 * Bitget 포지션 청산 (시장가)
 */
function closeBitgetPosition(symbol, holdSide, size) {
  var endpoint = '/api/v2/mix/order/place-order';

  var side = holdSide === 'long' ? 'sell' : 'buy';

  var body = {
    symbol: symbol,
    productType: 'USDT-FUTURES',
    marginMode: 'crossed',
    marginCoin: 'USDT',
    size: size.toString(),
    side: side,
    tradeSide: 'close',  // 청산
    orderType: 'market',
    force: 'gtc'
  };

  try {
    var result = callBitgetAPI('POST', endpoint, body);

    if (result.code === '00000') {
      Logger.log('✅ 포지션 청산 성공: ' + symbol);
      return result.data;
    } else {
      Logger.log('❌ 포지션 청산 실패: ' + JSON.stringify(result));
      return null;
    }
  } catch (error) {
    Logger.log('❌ 청산 에러: ' + error.toString());
    return null;
  }
}

/**
 * 모든 포지션 청산
 */
function closeAllBitgetPositions() {
  var positions = getBitgetPositions();

  if (positions.length === 0) {
    Logger.log('청산할 포지션 없음');
    return;
  }

  positions.forEach(function(pos) {
    if (parseFloat(pos.total) > 0) {
      closeBitgetPosition(pos.symbol, pos.holdSide, pos.total);
    }
  });

  Logger.log('✅ 모든 포지션 청산 완료');
}

/**
 * 자동매매 테스트 (실제 주문 X, 로그만)
 */
function testAutoTradeCalculation() {
  Logger.log('=== 자동매매 계산 테스트 ===');
  Logger.log('');

  var market = 'BTC-USDT';
  var signal = 'LONG';
  var entryPrice = 86000;

  // Bitget에서 레버리지 조회
  var leverage = getBitgetLeverage('BTCUSDT') || 10;

  // TP/SL 계산
  var tpslData = calculateTPSLWithBitgetLeverage(market, entryPrice, signal);

  // 주문 수량 계산
  var size = calculateOrderSize('BTCUSDT', entryPrice, leverage);

  Logger.log('');
  Logger.log('=== 테스트 결과 ===');
  Logger.log('자동매매 활성화: ' + AUTO_TRADE_CONFIG.ENABLED);
  Logger.log('마켓: ' + market);
  Logger.log('신호: ' + signal);
  Logger.log('진입가: $' + entryPrice);
  Logger.log('레버리지: ' + leverage + 'x');
  Logger.log('TP1: $' + tpslData.tp1Price.toFixed(2) + ' (' + tpslData.tp1Pct.toFixed(2) + '%)');
  Logger.log('SL: $' + tpslData.slPrice.toFixed(2) + ' (' + tpslData.slPct.toFixed(2) + '%)');
  Logger.log('주문 수량: ' + size + ' BTC');
  Logger.log('');
  Logger.log('⚠️ 이것은 테스트입니다. 실제 주문이 실행되지 않았습니다.');
}

/**
 * 자동매매 ON/OFF
 */
function enableAutoTrade() {
  AUTO_TRADE_CONFIG.ENABLED = true;
  Logger.log('✅ 자동매매 활성화됨');
  Logger.log('⚠️ 주의: 실제 돈이 사용됩니다!');
}

function disableAutoTrade() {
  AUTO_TRADE_CONFIG.ENABLED = false;
  Logger.log('⏸️ 자동매매 비활성화됨');
}

// ============================================
// 🔄 Bitget 포지션 동기화 (수동 진입 포지션 감지)
// ============================================

/**
 * Bitget 포지션을 시트와 동기화
 * - 수동으로 진입한 포지션도 시트에 기록
 * - 1분마다 자동 실행 (트리거)
 */
function syncBitgetPositions() {
  Logger.log('=== Bitget 포지션 동기화 ===');

  // 입출금 자동 감지
  detectBalanceChange();

  var bitgetPositions = getBitgetPositions();

  // ★ 포지션 0개여도 청산 감지는 실행해야 함 ★
  if (bitgetPositions.length === 0) {
    Logger.log('Bitget에 열린 포지션 없음');
    // 청산된 포지션 체크 (빈 배열 전달)
    checkClosedPositions([]);
    return;
  }

  var props = PropertiesService.getScriptProperties();

  bitgetPositions.forEach(function(pos) {
    if (parseFloat(pos.total) <= 0) return;

    var symbol = pos.symbol; // BTCUSDT
    var market = symbol.replace('USDT', '') + '-USDT'; // BTC-USDT
    var key = 'POSITION_' + market.replace('-', '_');

    // 이미 시트에 기록된 포지션인지 확인
    var existingPosition = props.getProperty(key);

    if (!existingPosition) {
      // 새로운 포지션 발견! 시트에 기록
      Logger.log('🆕 새 포지션 발견: ' + market);

      var signal = pos.holdSide === 'long' ? 'LONG' : 'SHORT';
      var entryPrice = parseFloat(pos.openPriceAvg);
      var leverage = parseInt(pos.leverage) || 10;  // 포지션에서 직접 레버리지 가져옴

      Logger.log('📊 포지션 레버리지: ' + leverage + 'x');

      // TP/SL 계산 (포지션의 실제 레버리지 사용)
      var tpslData = calculateTPSLByLeverage(entryPrice, signal, leverage);

      // 데이터 구성
      var data = {
        version: 'MANUAL',
        market: market,
        mode: '선물',
        signal: signal,
        leverage: leverage.toString(),
        entry: entryPrice.toString(),
        totalScore: '-',
        smart_money: 'MANUAL'
      };

      // 신호기록 시트에 추가
      var status = '🔄 수동진입 [' + market + ' ' + leverage + 'x]';
      logSignalToSheet(data, entryPrice, tpslData.tp1Price, tpslData.tp2Price, tpslData.slPrice, status);

      // 포지션 저장 (가격 모니터링용)
      savePositionByMarket(market, data, entryPrice, tpslData.tp1Price, tpslData.tp2Price, tpslData.slPrice, '선물');

      Logger.log('✅ 수동 포지션 동기화 완료: ' + market + ' ' + signal + ' @ $' + entryPrice.toFixed(2));
    }
  });

  // 시트에는 있지만 Bitget에 없는 포지션 체크 (청산됨)
  checkClosedPositions(bitgetPositions);
}

/**
 * 청산된 포지션 감지 및 기록
 */
function checkClosedPositions(bitgetPositions) {
  // 트리거에서 직접 호출 시 Bitget에서 포지션 가져오기
  if (!bitgetPositions || !Array.isArray(bitgetPositions)) {
    bitgetPositions = getBitgetPositions();
  }

  // 배열이 아니면 빈 배열로 설정
  if (!Array.isArray(bitgetPositions)) {
    bitgetPositions = [];
  }

  var props = PropertiesService.getScriptProperties();
  var allProps = props.getProperties();

  var bitgetMarkets = bitgetPositions.map(function(pos) {
    return pos.symbol.replace('USDT', '') + '-USDT';
  });

  Object.keys(allProps).forEach(function(key) {
    if (key.startsWith('POSITION_')) {
      var position = JSON.parse(allProps[key]);

      if (position.status === 'OPEN') {
        var market = position.market;

        // Bitget에 해당 포지션이 없으면 청산된 것
        if (bitgetMarkets.indexOf(market) === -1) {
          Logger.log('🔴 포지션 청산 감지: ' + market);

          // 현재 가격 조회
          var currentPrice = getPriceByMarket(market);
          if (currentPrice) {
            // 레버리지 가져오기 (저장된 값 사용, 기본 10x)
            var leverage = position.leverage || 10;

            // 수익/손실 계산 (레버리지 적용)
            var priceChangePercent;
            if (position.signal === 'LONG') {
              priceChangePercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
            } else {
              priceChangePercent = ((position.entryPrice - currentPrice) / position.entryPrice) * 100;
            }

            // 레버리지 적용된 실제 수익률
            var profitPercent = priceChangePercent * leverage;

            // 결과 유형 판정
            var exitType = profitPercent >= 0 ? '수동익절' : '수동손절';

            // 매매일지에 기록
            logAutoTradeResult(position, exitType, currentPrice, profitPercent);

            Logger.log('📝 청산 기록: ' + exitType + ' (' + profitPercent.toFixed(2) + '%) [' + leverage + 'x 레버리지]');
          }

          // 포지션 삭제
          props.deleteProperty(key);
        }
      }
    }
  });
}

/**
 * 수동으로 Bitget 포지션 동기화 실행
 */
function manualSyncBitgetPositions() {
  Logger.log('🔄 수동 동기화 시작...');
  syncBitgetPositions();
  Logger.log('✅ 동기화 완료!');
}

/**
 * Bitget 동기화 트리거 시작 (1분마다)
 */
function startBitgetSync() {
  // 기존 동기화 트리거 삭제
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'syncBitgetPositions') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 새 트리거 생성 (1분마다)
  ScriptApp.newTrigger('syncBitgetPositions')
    .timeBased()
    .everyMinutes(1)
    .create();

  Logger.log('✅ Bitget 동기화 트리거 시작됨 (1분마다)');
}

/**
 * Bitget 동기화 트리거 중지
 */
function stopBitgetSync() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'syncBitgetPositions') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('⏹️ Bitget 동기화 트리거 삭제됨');
    }
  });
}

// ============================================
// 📱 텔레그램 봇 명령어 시스템
// ============================================

/**
 * 텔레그램 봇 설정
 * 1. @BotFather에서 봇 생성 → 토큰 받기
 * 2. 봇과 대화 시작 후 @userinfobot으로 Chat ID 확인
 * 3. 아래 값 입력
 */
var TELEGRAM_CONFIG = {
  BOT_TOKEN: '',  // 여기에 봇 토큰 입력
  CHAT_ID: ''     // 여기에 Chat ID 입력
};

/**
 * 텔레그램 웹훅 처리 (봇 명령어)
 * 배포 URL을 텔레그램 웹훅으로 등록하면 명령어 수신
 */
function processTelegramCommand(update) {
  if (!update.message || !update.message.text) return;

  var chatId = update.message.chat.id;
  var text = update.message.text.toLowerCase().trim();
  var response = '';

  // 명령어 처리
  if (text === '/start' || text === '/help' || text === '/도움') {
    response = getTelegramHelpMessage();
  }
  else if (text === '/status' || text === '/상태') {
    response = getTelegramStatusMessage();
  }
  else if (text === '/position' || text === '/포지션') {
    response = getTelegramPositionMessage();
  }
  else if (text === '/market' || text === '/시장') {
    response = getTelegramMarketMessage();
  }
  else if (text === '/balance' || text === '/잔고') {
    response = getTelegramBalanceMessage();
  }
  else if (text === '/stats' || text === '/통계') {
    response = getTelegramStatsMessage();
  }
  else if (text === '/price' || text === '/가격') {
    response = getTelegramPriceMessage();
  }
  else {
    response = '❓ 알 수 없는 명령어입니다.\n/도움 을 입력하세요.';
  }

  // 응답 전송
  sendTelegramMessage(chatId, response);
}

/**
 * 도움말 메시지
 */
function getTelegramHelpMessage() {
  return '🤖 <b>클로드27 트레이딩 봇</b>\n\n' +
    '📋 <b>명령어 목록:</b>\n\n' +
    '/상태 - 전체 시스템 상태\n' +
    '/포지션 - 현재 포지션 정보\n' +
    '/시장 - 시장 분석 (상승/하락)\n' +
    '/잔고 - Bitget 잔고 확인\n' +
    '/통계 - 승률 및 수익률\n' +
    '/가격 - 현재 BTC 가격\n' +
    '/도움 - 이 메시지';
}

/**
 * 전체 상태 메시지
 */
function getTelegramStatusMessage() {
  var balance = getBitgetTotalBalance() || 0;
  var positions = getAllOpenPositions();
  var bitgetPositions = getBitgetPositions();

  var msg = '📊 <b>시스템 상태</b>\n';
  msg += '━━━━━━━━━━━━━━━\n\n';

  // 잔고
  msg += '💰 <b>잔고:</b> $' + balance.toFixed(2) + '\n\n';

  // 포지션 수
  msg += '📈 <b>포지션:</b>\n';
  msg += '  • 추적중: ' + positions.length + '개\n';
  msg += '  • Bitget: ' + bitgetPositions.length + '개\n\n';

  // 자동매매 상태
  msg += '🤖 <b>자동매매:</b> ' + (AUTO_TRADE_CONFIG.ENABLED ? '✅ 활성' : '⏸️ 비활성') + '\n';

  // 트리거 상태
  var triggers = ScriptApp.getProjectTriggers();
  msg += '⏰ <b>트리거:</b> ' + triggers.length + '개 실행중\n';

  return msg;
}

/**
 * 포지션 상세 메시지
 */
function getTelegramPositionMessage() {
  var positions = getAllOpenPositions();

  if (positions.length === 0) {
    return '📭 <b>열린 포지션 없음</b>\n\n현재 진입한 포지션이 없습니다.';
  }

  var msg = '📈 <b>현재 포지션</b>\n';
  msg += '━━━━━━━━━━━━━━━\n\n';

  for (var i = 0; i < positions.length; i++) {
    var pos = positions[i];
    var currentPrice = getPriceByMarket(pos.market) || 0;
    var pnlPercent = 0;

    if (pos.signal === 'LONG') {
      pnlPercent = ((currentPrice - pos.entryPrice) / pos.entryPrice * 100) * (pos.leverage || 10);
    } else {
      pnlPercent = ((pos.entryPrice - currentPrice) / pos.entryPrice * 100) * (pos.leverage || 10);
    }

    var pnlEmoji = pnlPercent >= 0 ? '🟢' : '🔴';

    msg += '🎯 <b>' + pos.market + '</b>\n';
    msg += '  방향: ' + (pos.signal === 'LONG' ? '🟢 롱' : '🔴 숏') + '\n';
    msg += '  레버리지: ' + (pos.leverage || 10) + 'x\n';
    msg += '  진입가: $' + pos.entryPrice.toFixed(2) + '\n';
    msg += '  현재가: $' + currentPrice.toFixed(2) + '\n';
    msg += '  손익: ' + pnlEmoji + ' ' + (pnlPercent >= 0 ? '+' : '') + pnlPercent.toFixed(2) + '%\n';
    msg += '  TP1: $' + pos.tp1Price.toFixed(2) + (pos.tp1Hit ? ' ✅' : '') + '\n';
    msg += '  SL: $' + pos.slPrice.toFixed(2) + '\n\n';
  }

  return msg;
}

/**
 * 시장 분석 메시지
 */
function getTelegramMarketMessage() {
  var btcPrice = getPriceByMarket('BTC-USDT') || 0;

  // 간단한 추세 분석 (가격 기반)
  var msg = '📊 <b>시장 분석</b>\n';
  msg += '━━━━━━━━━━━━━━━\n\n';

  msg += '💰 <b>BTC 현재가:</b> $' + btcPrice.toFixed(2) + '\n\n';

  // 최근 신호 기록에서 추세 파악
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  var signalSheet = ss.getSheetByName(SHEET_CONFIG.SIGNAL_SHEET);

  if (signalSheet) {
    var lastRow = signalSheet.getLastRow();
    if (lastRow > 1) {
      var lastSignal = signalSheet.getRange(lastRow, 4).getValue(); // 신호 열
      var lastScore = signalSheet.getRange(lastRow, 13).getValue(); // 점수 열

      msg += '📡 <b>최근 신호:</b>\n';
      msg += '  • 방향: ' + (lastSignal === 'LONG' ? '🟢 롱' : lastSignal === 'SHORT' ? '🔴 숏' : '⚪ ' + lastSignal) + '\n';
      msg += '  • 점수: ' + lastScore + '/28\n\n';
    }
  }

  // 포지션 기반 추세 판단
  var positions = getAllOpenPositions();
  var longCount = 0;
  var shortCount = 0;

  for (var i = 0; i < positions.length; i++) {
    if (positions[i].signal === 'LONG') longCount++;
    else shortCount++;
  }

  if (longCount > shortCount) {
    msg += '📈 <b>현재 추세:</b> 🟢 상승 분위기\n';
    msg += '  (롱 포지션 ' + longCount + '개 진행중)\n';
  } else if (shortCount > longCount) {
    msg += '📉 <b>현재 추세:</b> 🔴 하락 분위기\n';
    msg += '  (숏 포지션 ' + shortCount + '개 진행중)\n';
  } else {
    msg += '➡️ <b>현재 추세:</b> ⚪ 관망\n';
    msg += '  (진입 대기중)\n';
  }

  return msg;
}

/**
 * 잔고 메시지
 */
function getTelegramBalanceMessage() {
  var balance = getBitgetTotalBalance();

  if (balance === null) {
    return '❌ <b>잔고 조회 실패</b>\n\nBitget API 연결을 확인하세요.';
  }

  // 통계 시트에서 시작 잔고 가져오기
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  var statsSheet = ss.getSheetByName(SHEET_CONFIG.STATS_SHEET);
  var startBalance = 100;

  if (statsSheet) {
    var startBalanceRaw = statsSheet.getRange('B10').getValue();
    startBalance = parseFloat(String(startBalanceRaw).replace(/[^0-9.-]/g, '')) || 100;
  }

  var profitPercent = ((balance - startBalance) / startBalance * 100);

  var msg = '💰 <b>잔고 정보</b>\n';
  msg += '━━━━━━━━━━━━━━━\n\n';
  msg += '📊 <b>현재 잔고:</b> $' + balance.toFixed(2) + '\n';
  msg += '📈 <b>시작 자본:</b> $' + startBalance.toFixed(2) + '\n';
  msg += '💹 <b>총 수익률:</b> ' + (profitPercent >= 0 ? '+' : '') + profitPercent.toFixed(2) + '%\n';

  return msg;
}

/**
 * 통계 메시지
 */
function getTelegramStatsMessage() {
  var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  var statsSheet = ss.getSheetByName(SHEET_CONFIG.STATS_SHEET);

  if (!statsSheet) {
    return '❌ <b>통계 시트 없음</b>';
  }

  var winRate = statsSheet.getRange('B4').getValue() || '0%';
  var totalTrades = statsSheet.getRange('B5').getValue() || 0;
  var wins = statsSheet.getRange('B6').getValue() || 0;
  var losses = statsSheet.getRange('B7').getValue() || 0;

  var msg = '📊 <b>거래 통계</b>\n';
  msg += '━━━━━━━━━━━━━━━\n\n';
  msg += '🎯 <b>승률:</b> ' + winRate + '\n';
  msg += '📝 <b>총 거래:</b> ' + totalTrades + '회\n';
  msg += '✅ <b>승:</b> ' + wins + '회\n';
  msg += '❌ <b>패:</b> ' + losses + '회\n';

  return msg;
}

/**
 * 가격 메시지
 */
function getTelegramPriceMessage() {
  var prices = {};
  var markets = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT'];

  for (var i = 0; i < markets.length; i++) {
    prices[markets[i]] = getPriceByMarket(markets[i]) || 0;
  }

  var msg = '💰 <b>실시간 가격</b>\n';
  msg += '━━━━━━━━━━━━━━━\n\n';
  msg += '₿ <b>BTC:</b> $' + prices['BTC-USDT'].toFixed(2) + '\n';
  msg += 'Ξ <b>ETH:</b> $' + prices['ETH-USDT'].toFixed(2) + '\n';
  msg += '◎ <b>SOL:</b> $' + prices['SOL-USDT'].toFixed(2) + '\n';
  msg += '✕ <b>XRP:</b> $' + prices['XRP-USDT'].toFixed(4) + '\n';

  var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'HH:mm:ss');
  msg += '\n⏰ 업데이트: ' + now;

  return msg;
}

/**
 * 텔레그램 메시지 전송
 */
function sendTelegramMessage(chatId, text) {
  var token = TELEGRAM_CONFIG.BOT_TOKEN || CONFIG.NOTIFICATION.TELEGRAM_BOT_TOKEN;

  if (!token) {
    Logger.log('텔레그램 봇 토큰 없음');
    return;
  }

  var url = 'https://api.telegram.org/bot' + token + '/sendMessage';

  try {
    UrlFetchApp.fetch(url, {
      method: 'post',
      payload: {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      }
    });
  } catch (e) {
    Logger.log('텔레그램 전송 실패: ' + e.toString());
  }
}

/**
 * 텔레그램 웹훅 설정
 * 이 함수를 한 번 실행하면 텔레그램에서 명령어 수신 가능
 */
function setupTelegramWebhook() {
  var token = TELEGRAM_CONFIG.BOT_TOKEN || CONFIG.NOTIFICATION.TELEGRAM_BOT_TOKEN;

  if (!token) {
    Logger.log('❌ 텔레그램 봇 토큰을 먼저 설정하세요');
    return;
  }

  // 현재 웹앱 URL 가져오기
  var webAppUrl = ScriptApp.getService().getUrl();

  if (!webAppUrl) {
    Logger.log('❌ 먼저 웹앱으로 배포하세요');
    return;
  }

  var url = 'https://api.telegram.org/bot' + token + '/setWebhook?url=' + webAppUrl;

  try {
    var response = UrlFetchApp.fetch(url);
    Logger.log('✅ 텔레그램 웹훅 설정 완료: ' + response.getContentText());
  } catch (e) {
    Logger.log('❌ 웹훅 설정 실패: ' + e.toString());
  }
}

/**
 * 텔레그램 웹훅 해제
 */
function removeTelegramWebhook() {
  var token = TELEGRAM_CONFIG.BOT_TOKEN || CONFIG.NOTIFICATION.TELEGRAM_BOT_TOKEN;

  if (!token) return;

  var url = 'https://api.telegram.org/bot' + token + '/deleteWebhook';

  try {
    var response = UrlFetchApp.fetch(url);
    Logger.log('✅ 텔레그램 웹훅 해제: ' + response.getContentText());
  } catch (e) {
    Logger.log('❌ 웹훅 해제 실패: ' + e.toString());
  }
}

/**
 * 텔레그램으로 수동 알림 전송 테스트
 */
function testTelegramNotification() {
  var chatId = TELEGRAM_CONFIG.CHAT_ID || CONFIG.NOTIFICATION.TELEGRAM_CHAT_ID;

  if (!chatId) {
    Logger.log('❌ Chat ID를 설정하세요');
    return;
  }

  sendTelegramMessage(chatId, '🤖 <b>테스트 알림</b>\n\n클로드27 트레이딩 봇이 정상 작동중입니다!\n\n/도움 을 입력해보세요.');
  Logger.log('✅ 테스트 메시지 전송됨');
}

// ============================================
// 🔍 보조계정 자동매매 문제 진단
// ============================================

/**
 * 🔍 보조계정 자동매매 전체 진단
 *
 * 트레이딩뷰 알람이 가는데 자동매매가 안 될 때 실행하세요!
 *
 * 체크 항목:
 * 1. 스프레드시트 연결
 * 2. Bitget API 연결
 * 3. 트리거 설정 상태
 * 4. 웹훅 URL 확인
 * 5. 최근 신호 수신 여부
 */
function 보조계정_자동매매_진단() {
  Logger.log('');
  Logger.log('╔════════════════════════════════════════╗');
  Logger.log('║  🔍 보조계정 자동매매 시스템 진단      ║');
  Logger.log('╚════════════════════════════════════════╝');
  Logger.log('');

  var allOk = true;
  var issues = [];

  // ==========================================
  // 1. 스프레드시트 연결 체크
  // ==========================================
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('1️⃣  스프레드시트 연결 테스트');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  try {
    var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    var sheetName = ss.getName();
    var sheetUrl = ss.getUrl();

    Logger.log('✅ 스프레드시트 연결 성공!');
    Logger.log('   이름: ' + sheetName);
    Logger.log('   URL: ' + sheetUrl);

    // 필요한 시트 확인
    var requiredSheets = [
      SHEET_CONFIG.SIGNAL_SHEET,
      SHEET_CONFIG.TRADE_SHEET,
      SHEET_CONFIG.STATS_SHEET
    ];

    var missingSheets = [];
    requiredSheets.forEach(function(sheetName) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        missingSheets.push(sheetName);
      }
    });

    if (missingSheets.length > 0) {
      Logger.log('⚠️  필요한 시트 누락: ' + missingSheets.join(', '));
      Logger.log('   → 해결: initSimulation() 함수 실행');
      allOk = false;
      issues.push('시트 누락 - initSimulation() 실행 필요');
    } else {
      Logger.log('✅ 모든 필수 시트 존재');
    }

  } catch (e) {
    Logger.log('❌ 스프레드시트 연결 실패!');
    Logger.log('   오류: ' + e.toString());
    Logger.log('   → SPREADSHEET_ID 확인: ' + SHEET_CONFIG.SPREADSHEET_ID);
    allOk = false;
    issues.push('스프레드시트 연결 실패 - ID 확인 필요');
  }

  Logger.log('');

  // ==========================================
  // 2. Bitget API 연결 체크
  // ==========================================
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('2️⃣  Bitget API 연결 테스트');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  try {
    Logger.log('   API Key: ' + BITGET_CONFIG.API_KEY.substring(0, 10) + '...');

    var balance = getBitgetFuturesBalance();

    if (balance !== null && balance !== undefined) {
      Logger.log('✅ Bitget API 연결 성공!');
      Logger.log('   선물 잔고: $' + balance.toFixed(2));
    } else {
      Logger.log('⚠️  Bitget API 응답 이상');
      Logger.log('   → API 키/시크릿/패스프레이즈 확인');
      allOk = false;
      issues.push('Bitget API 오류 - 키 확인 필요');
    }
  } catch (e) {
    Logger.log('❌ Bitget API 연결 실패!');
    Logger.log('   오류: ' + e.toString());
    Logger.log('   → API 키 재확인 필요');
    allOk = false;
    issues.push('Bitget API 연결 실패');
  }

  Logger.log('');

  // ==========================================
  // 3. 트리거 상태 체크
  // ==========================================
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('3️⃣  트리거 상태 확인');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  var triggers = ScriptApp.getProjectTriggers();
  Logger.log('   총 트리거 수: ' + triggers.length);

  var requiredTriggers = {
    'syncBitgetPositions': false,
    'checkClosedPositions': false
  };

  triggers.forEach(function(trigger) {
    var funcName = trigger.getHandlerFunction();
    Logger.log('   - ' + funcName);

    if (requiredTriggers.hasOwnProperty(funcName)) {
      requiredTriggers[funcName] = true;
    }
  });

  var missingTriggers = [];
  for (var funcName in requiredTriggers) {
    if (!requiredTriggers[funcName]) {
      missingTriggers.push(funcName);
    }
  }

  if (missingTriggers.length > 0) {
    Logger.log('❌ 필수 트리거 누락!');
    Logger.log('   누락: ' + missingTriggers.join(', '));
    Logger.log('   → 해결: 원클릭_전체설정() 함수 실행');
    allOk = false;
    issues.push('트리거 누락 - 원클릭_전체설정() 실행');
  } else {
    Logger.log('✅ 필수 트리거 모두 설정됨');
  }

  Logger.log('');

  // ==========================================
  // 4. 웹훅 URL 확인
  // ==========================================
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('4️⃣  웹훅 URL 확인');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    var webAppUrl = ScriptApp.getService().getUrl();

    if (webAppUrl) {
      Logger.log('✅ 웹 앱 배포 확인됨');
      Logger.log('   URL: ' + webAppUrl);
      Logger.log('');
      Logger.log('   ⚠️  TradingView 알림에 이 URL 설정했는지 확인!');
    } else {
      Logger.log('❌ 웹 앱 미배포!');
      Logger.log('   → 배포 → 새 배포 실행 필요');
      allOk = false;
      issues.push('웹 앱 미배포 - 배포 필요');
    }
  } catch (e) {
    Logger.log('⚠️  웹 앱 URL 확인 불가');
    Logger.log('   오류: ' + e.toString());
  }

  Logger.log('');

  // ==========================================
  // 5. 최근 신호 수신 확인
  // ==========================================
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('5️⃣  최근 신호 수신 확인');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    var signalSheet = ss.getSheetByName(SHEET_CONFIG.SIGNAL_SHEET);

    if (signalSheet) {
      var lastRow = signalSheet.getLastRow();

      if (lastRow > 1) {
        var lastSignal = signalSheet.getRange(lastRow, 1, 1, 8).getValues()[0];
        var timestamp = lastSignal[0];
        var market = lastSignal[1];
        var signal = lastSignal[2];

        Logger.log('✅ 신호 기록 발견');
        Logger.log('   마지막 신호: ' + timestamp);
        Logger.log('   마켓: ' + market + ' | 신호: ' + signal);

        // 최근 1시간 이내 신호 확인
        var now = new Date();
        var signalTime = new Date(timestamp);
        var diffMinutes = (now - signalTime) / 1000 / 60;

        if (diffMinutes < 60) {
          Logger.log('   ✅ 최근 ' + Math.floor(diffMinutes) + '분 전 신호');
        } else {
          Logger.log('   ⚠️  마지막 신호가 ' + Math.floor(diffMinutes / 60) + '시간 전');
          Logger.log('   → 새 신호 대기 중일 수 있음');
        }
      } else {
        Logger.log('⚠️  신호 기록 없음');
        Logger.log('   → TradingView 알림이 웹훅 URL로 전송되고 있는지 확인');
        allOk = false;
        issues.push('신호 수신 없음 - 웹훅 URL 확인');
      }
    }
  } catch (e) {
    Logger.log('⚠️  신호 기록 확인 실패: ' + e.toString());
  }

  Logger.log('');

  // ==========================================
  // 6. 현재 포지션 확인
  // ==========================================
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('6️⃣  현재 포지션 확인');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  checkPosition();

  Logger.log('');

  // ==========================================
  // 최종 결과
  // ==========================================
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('📋 진단 결과 요약');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (allOk && issues.length === 0) {
    Logger.log('');
    Logger.log('🎉 모든 시스템 정상!');
    Logger.log('');
    Logger.log('자동매매가 작동하지 않는다면:');
    Logger.log('1. TradingView 알림에 웹훅 URL 확인');
    Logger.log('2. TradingView에서 신호 발생했는지 확인');
    Logger.log('3. Apps Script 실행 로그에서 "Webhook 수신" 메시지 확인');
  } else {
    Logger.log('');
    Logger.log('⚠️  발견된 문제: ' + issues.length + '개');
    Logger.log('');

    issues.forEach(function(issue, index) {
      Logger.log((index + 1) + '. ' + issue);
    });

    Logger.log('');
    Logger.log('📌 해결 방법:');
    Logger.log('');

    if (issues.some(function(i) { return i.includes('시트 누락'); })) {
      Logger.log('▶ initSimulation() 실행');
    }

    if (issues.some(function(i) { return i.includes('트리거'); })) {
      Logger.log('▶ 원클릭_전체설정() 실행');
    }

    if (issues.some(function(i) { return i.includes('Bitget'); })) {
      Logger.log('▶ BITGET_CONFIG의 API 키/시크릿/패스프레이즈 확인');
    }

    if (issues.some(function(i) { return i.includes('배포'); })) {
      Logger.log('▶ 배포 → 새 배포 → 웹 앱 (액세스: 모든 사용자)');
    }

    if (issues.some(function(i) { return i.includes('신호'); })) {
      Logger.log('▶ TradingView 알림 편집 → 웹훅 URL 재확인');
    }
  }

  Logger.log('');
  Logger.log('╔════════════════════════════════════════╗');
  Logger.log('║           진단 완료                    ║');
  Logger.log('╚════════════════════════════════════════╝');
  Logger.log('');
}
