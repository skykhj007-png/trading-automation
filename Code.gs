/**
 * Trading Signal Logger + 가상매매 시뮬레이션
 * V25 Universal - 선물/현물코인/주식 지원
 * $100 시작 - 익절/손절 기록 - 잔고 추적
 * 중복 신호 방지 기능 포함
 */

// ============================================
// 설정
// ============================================

var CONFIG = {
  VERSION: '25',
  TRADING: {
    MARKET: 'BTC-USDT',
    MIN_SIGNAL_STRENGTH: 12
  },
  NOTIFICATION: {
    ENABLED: true,
    EMAIL: '',
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_CHAT_ID: ''
  }
};

var SHEET_CONFIG = {
  SPREADSHEET_ID: '1dlntPV_LY_1RrCCpmkW3zw5dpcA_dMhVDkjd90QcI7E',
  SIGNAL_SHEET: '신호기록',
  TRADE_SHEET: 'V25 자동매매일지',
  STATS_SHEET: '통계'
};

// 모드별 TP/SL 기본값
var MODE_SETTINGS = {
  '선물': { tp1: 0.8, tp2: 1.5, sl: 0.3, shortEnabled: true },
  '현물코인': { tp1: 1.5, tp2: 3.0, sl: 1.0, shortEnabled: false },
  '주식': { tp1: 2.0, tp2: 4.0, sl: 1.5, shortEnabled: false }
};

var VIRTUAL_TRADING = {
  STARTING_BALANCE: 100,
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
    var data = JSON.parse(e.postData.contents);
    Logger.log('Webhook 수신: ' + new Date());

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
 * 마켓 심볼 정규화 (TradingView ticker → 표준 형식)
 */
function detectMarket(data) {
  var market = data.market || '';

  // TradingView ticker 형식 정규화
  // 예: "BTCUSDT.P", "ETHUSDT", "BTCUSDT" → "BTC-USDT", "ETH-USDT"
  if (market) {
    // .P (선물) 제거
    market = market.replace('.P', '').replace('.p', '');

    // BTCUSDT → BTC-USDT 변환
    if (market.indexOf('BTC') >= 0) return 'BTC-USDT';
    if (market.indexOf('ETH') >= 0) return 'ETH-USDT';
    if (market.indexOf('SOL') >= 0) return 'SOL-USDT';
    if (market.indexOf('XRP') >= 0) return 'XRP-USDT';
    if (market.indexOf('DOGE') >= 0) return 'DOGE-USDT';

    // 이미 지원 형식이면 그대로 반환
    if (SUPPORTED_MARKETS[market]) {
      return market;
    }
  }

  // 마켓 정보 없으면 가격으로 추정 (fallback)
  var entryPrice = parseFloat(data.entry);
  if (entryPrice > 50000) {
    return 'BTC-USDT';
  } else if (entryPrice > 1000) {
    return 'ETH-USDT';
  } else if (entryPrice > 100) {
    return 'SOL-USDT';
  } else if (entryPrice > 1) {
    return 'XRP-USDT';
  } else {
    return 'DOGE-USDT';
  }
}

function processSignal(data) {
  var entryPrice = parseFloat(data.entry);
  var tp1Price = parseFloat(data.tp1) || 0;
  var tp2Price = parseFloat(data.tp2) || 0;
  var slPrice = parseFloat(data.sl) || 0;
  var tradeMode = data.mode || '선물'; // 기본값: 선물
  var version = data.version || '25';

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
    logSignalToSheet(data, entryPrice, tp1Price, tp2Price, slPrice, '[' + tradeMode + '] SHORT 비활성');
    return { action: 'skipped', market: market, reason: tradeMode + '에서 SHORT 비활성' };
  }

  // 마켓별 중복 신호 체크
  var existingPosition = getPositionByMarket(market);
  if (existingPosition && existingPosition.status === 'OPEN') {
    Logger.log('[' + market + '] 이미 열린 포지션 있음 - 신호 무시');
    Logger.log('기존: ' + existingPosition.signal + ' @ $' + existingPosition.entryPrice.toFixed(2));
    Logger.log('새로운: ' + data.signal + ' @ $' + entryPrice.toFixed(2));

    logSignalToSheet(data, entryPrice, tp1Price, tp2Price, slPrice, '[' + market + ' 중복] 무시됨');

    return { action: 'skipped', market: market, reason: market + ' 이미 포지션 보유중' };
  }

  // 신호 기록
  var status = '대기중 [' + market + ' ' + tradeMode + ']';
  logSignalToSheet(data, entryPrice, tp1Price, tp2Price, slPrice, status);

  // 마켓별 포지션 저장
  savePositionByMarket(market, data, entryPrice, tp1Price, tp2Price, slPrice, tradeMode);

  return {
    action: 'signal_recorded',
    signal: data.signal,
    market: market,
    mode: tradeMode,
    version: version
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
    entryPrice: entryPrice,
    tp1Price: tp1Price,
    tp2Price: tp2Price,
    slPrice: slPrice,
    entryTime: new Date().toISOString(),
    tp1Hit: false,
    status: 'OPEN',
    mode: tradeMode || '선물',
    version: data.version || '25',
    smartMoney: data.smart_money || 'NONE',
    volumeRatio: data.volume_ratio || '0'
  };

  var key = 'POSITION_' + market.replace('-', '_');
  props.setProperty(key, JSON.stringify(position));
  Logger.log('📌 [' + market + '] 포지션 저장: ' + data.signal + ' @ $' + entryPrice.toFixed(2));
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

  var row = [
    Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd'),
    Utilities.formatDate(now, 'Asia/Seoul', 'HH:mm:ss'),
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
    sheet.getRange(lastRow, 7).setFontColor('#2E7D32').setFontWeight('bold');
    sheet.getRange(lastRow, 8).setFontColor('#2E7D32').setFontWeight('bold');
  } else if (profitPercent < 0) {
    sheet.getRange(lastRow, 7).setFontColor('#C62828').setFontWeight('bold');
    sheet.getRange(lastRow, 8).setFontColor('#C62828').setFontWeight('bold');
  }

  // 누적수익률 색상
  if (totalReturnPercent > 0) {
    sheet.getRange(lastRow, 10).setFontColor('#2E7D32').setFontWeight('bold');
  } else if (totalReturnPercent < 0) {
    sheet.getRange(lastRow, 10).setFontColor('#C62828').setFontWeight('bold');
  }

  sheet.getRange(lastRow, 9).setFontWeight('bold').setBackground('#E3F2FD');

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
    ['🕐 마지막 업데이트', '-']
  ];

  sheet.getRange(2, 1, stats.length, 2).setValues(stats);

  // 스타일
  sheet.getRange('A2:A8').setBackground('#E3F2FD').setFontWeight('bold');
  sheet.getRange('B2:B8').setFontSize(14).setHorizontalAlignment('center');

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

  // 헤더
  var headers = [
    '날짜', '시간', '신호', '진입가', '청산가',
    '청산유형', '수익률', '손익($)', '잔고($)', '누적수익률', '메모'
  ];

  sheet.getRange(4, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(4, 1, 1, headers.length)
    .setBackground('#4A90E2')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 70);
  sheet.setColumnWidth(4, 100);
  sheet.setColumnWidth(5, 100);
  sheet.setColumnWidth(6, 120);
  sheet.setColumnWidth(7, 80);
  sheet.setColumnWidth(8, 80);
  sheet.setColumnWidth(9, 100);
  sheet.setColumnWidth(10, 100);
  sheet.setColumnWidth(11, 150);

  sheet.setFrozenRows(4);

  // 초기 잔고 행
  sheet.appendRow([
    '시작', '-', '-', '-', '-', '[초기잔고]', '-', '-',
    VIRTUAL_TRADING.STARTING_BALANCE.toFixed(2), '0.00%', '시뮬레이션 시작'
  ]);
  sheet.getRange(5, 9).setFontWeight('bold').setBackground('#E3F2FD');

  return sheet;
}

function getCurrentBalance(sheet) {
  var lastRow = sheet.getLastRow();

  if (lastRow <= 5) { // 헤더 4행 + 초기잔고 1행
    return VIRTUAL_TRADING.STARTING_BALANCE;
  }

  var balanceStr = sheet.getRange(lastRow, 9).getValue();
  // "$100.00" 형식에서 숫자만 추출
  var balance = parseFloat(String(balanceStr).replace(/[^0-9.-]/g, ''));
  return balance || VIRTUAL_TRADING.STARTING_BALANCE;
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
      sheet.getRange(lastRow, 13).setFontColor('#757575');
    } else if (data.signal === 'LONG') {
      sheet.getRange(lastRow, 1, 1, row.length).setBackground('#E8F5E9');
    } else {
      sheet.getRange(lastRow, 1, 1, row.length).setBackground('#FFEBEE');
    }

  } catch (error) {
    Logger.log('시트 기록 실패: ' + error.toString());
  }
}

function createSignalSheet(ss) {
  var sheet = ss.insertSheet(SHEET_CONFIG.SIGNAL_SHEET);

  var headers = [
    '날짜', '시간', '마켓', '신호', '진입가',
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
    Logger.log('  버전: V' + (position.version || '25'));
    Logger.log('  모드: ' + (position.mode || '선물'));
    Logger.log('  신호: ' + position.signal);
    Logger.log('  진입가: $' + position.entryPrice.toFixed(2));
    Logger.log('  TP1: $' + position.tp1Price.toFixed(2));
    Logger.log('  TP2: $' + position.tp2Price.toFixed(2));
    Logger.log('  SL: $' + position.slPrice.toFixed(2));
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
    var data = JSON.parse(response.getContentText());
    return parseFloat(data.price);
  } catch (error) {
    Logger.log('[' + market + '] 가격 조회 실패: ' + error.toString());
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
 */
function checkPriceAndAutoClose() {
  var positions = getAllOpenPositions();

  if (positions.length === 0) {
    return; // 열린 포지션 없음
  }

  Logger.log('=== 가격 체크 (' + positions.length + '개 포지션) ===');

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
  var profitPercent;

  if (position.signal === 'LONG') {
    profitPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
  } else {
    profitPercent = ((position.entryPrice - currentPrice) / position.entryPrice) * 100;
  }

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
  var profitPercent;

  if (position.signal === 'LONG') {
    profitPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
  } else {
    profitPercent = ((position.entryPrice - currentPrice) / position.entryPrice) * 100;
  }

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

  var currentBalance = getCurrentBalance(sheet);
  var profitAmount = currentBalance * (profitPercent / 100);
  var newBalance = currentBalance + profitAmount;
  var totalReturnPercent = ((newBalance - VIRTUAL_TRADING.STARTING_BALANCE) / VIRTUAL_TRADING.STARTING_BALANCE * 100);

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

  var row = [
    Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd'),
    Utilities.formatDate(now, 'Asia/Seoul', 'HH:mm:ss'),
    market,
    position.signal,
    '$' + position.entryPrice.toFixed(2),
    '$' + exitPrice.toFixed(2),
    emoji,
    (profitPercent >= 0 ? '+' : '') + profitPercent.toFixed(2) + '%',
    (profitAmount >= 0 ? '+$' : '-$') + Math.abs(profitAmount).toFixed(2),
    '$' + newBalance.toFixed(2),
    (totalReturnPercent >= 0 ? '+' : '') + totalReturnPercent.toFixed(2) + '%',
    holdingMinutes + '분 보유'
  ];

  sheet.appendRow(row);

  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 1, 1, row.length).setBackground(bgColor);

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

  // 텔레그램 알림 (설정되어 있으면)
  if (CONFIG.NOTIFICATION.TELEGRAM_BOT_TOKEN && CONFIG.NOTIFICATION.TELEGRAM_CHAT_ID) {
    try {
      var telegramUrl = 'https://api.telegram.org/bot' + CONFIG.NOTIFICATION.TELEGRAM_BOT_TOKEN + '/sendMessage';
      UrlFetchApp.fetch(telegramUrl, {
        method: 'post',
        payload: {
          chat_id: CONFIG.NOTIFICATION.TELEGRAM_CHAT_ID,
          text: '🤖 V25 자동매매\n\n' + title + '\n\n' + message,
          parse_mode: 'HTML'
        }
      });
    } catch (e) {
      Logger.log('텔레그램 전송 실패: ' + e.toString());
    }
  }

  // 이메일 알림 (설정되어 있으면)
  if (CONFIG.NOTIFICATION.EMAIL) {
    try {
      MailApp.sendEmail(CONFIG.NOTIFICATION.EMAIL, '[V25] ' + title, message);
    } catch (e) {
      Logger.log('이메일 전송 실패: ' + e.toString());
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
