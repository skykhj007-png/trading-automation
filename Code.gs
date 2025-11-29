/**
 * Trading Signal Logger + 가상매매 시뮬레이션
 * $100 시작 - 익절/손절 기록 - 잔고 추적
 * 중복 신호 방지 기능 포함
 */

// ============================================
// 설정
// ============================================

var CONFIG = {
  TRADING: {
    MARKET: 'KRW-BTC',
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
  TRADE_SHEET: '가상매매'
};

var VIRTUAL_TRADING = {
  STARTING_BALANCE: 100,
  POSITION_SIZE: 100
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
    message: 'Trading Signal Logger is running'
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// 신호 처리 (중복 방지 포함)
// ============================================

function processSignal(data) {
  var entryPrice = parseFloat(data.entry);
  var tp1Price = parseFloat(data.tp1) || 0;
  var tp2Price = parseFloat(data.tp2) || 0;
  var slPrice = parseFloat(data.sl) || 0;

  // 중복 신호 체크
  var existingPosition = getPosition();
  if (existingPosition && existingPosition.status === 'OPEN') {
    Logger.log('이미 열린 포지션 있음 - 신호 무시');
    Logger.log('기존: ' + existingPosition.signal + ' @ ' + Math.floor(existingPosition.entryPrice / 1000));
    Logger.log('새로운: ' + data.signal + ' @ ' + Math.floor(entryPrice / 1000));

    logSignalToSheet(data, entryPrice, tp1Price, tp2Price, slPrice, '[중복] 무시됨');

    return { action: 'skipped', reason: '이미 포지션 보유중' };
  }

  // 신호 기록
  logSignalToSheet(data, entryPrice, tp1Price, tp2Price, slPrice, '대기중');

  // 포지션 저장
  savePosition(data, entryPrice, tp1Price, tp2Price, slPrice);

  return { action: 'signal_recorded', signal: data.signal };
}

// ============================================
// 포지션 관리
// ============================================

function savePosition(data, entryPrice, tp1Price, tp2Price, slPrice) {
  var props = PropertiesService.getScriptProperties();

  var position = {
    signal: data.signal,
    entryPrice: entryPrice,
    tp1Price: tp1Price,
    tp2Price: tp2Price,
    slPrice: slPrice,
    entryTime: new Date().toISOString(),
    tp1Hit: false,
    status: 'OPEN'
  };

  props.setProperty('CURRENT_POSITION', JSON.stringify(position));
  Logger.log('포지션 저장: ' + data.signal + ' @ ' + Math.floor(entryPrice / 1000));
}

function getPosition() {
  var props = PropertiesService.getScriptProperties();
  var posData = props.getProperty('CURRENT_POSITION');
  return posData ? JSON.parse(posData) : null;
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

  var now = new Date();

  var emoji = '';
  var bgColor = '#FFFFFF';

  if (exitType === 'TP1') {
    emoji = '[1차익절]';
    bgColor = '#E8F5E9';
  } else if (exitType === 'TP2') {
    emoji = '[2차익절]';
    bgColor = '#C8E6C9';
  } else if (exitType === 'SL') {
    emoji = '[손절]';
    bgColor = '#FFEBEE';
  } else if (exitType === 'TP1 후 SL') {
    emoji = '[1차익절 후 손절]';
    bgColor = '#FFF3E0';
  } else if (exitType === 'TP1 후 BE') {
    emoji = '[1차익절 후 본절]';
    bgColor = '#F5F5F5';
  } else if (exitType === 'BE') {
    emoji = '[본절]';
    bgColor = '#F5F5F5';
  }

  var row = [
    Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd'),
    Utilities.formatDate(now, 'Asia/Seoul', 'HH:mm:ss'),
    position.signal,
    Math.floor(position.entryPrice / 1000),
    Math.floor(exitPrice / 1000),
    emoji,
    profitPercent.toFixed(2) + '%',
    profitAmount.toFixed(2),
    newBalance.toFixed(2)
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

  sheet.getRange(lastRow, 9).setFontWeight('bold').setBackground('#E3F2FD');

  Logger.log('거래 기록: ' + emoji + ' | 잔고: $' + newBalance.toFixed(2));
}

function createTradeSheet(ss) {
  var sheet = ss.insertSheet(SHEET_CONFIG.TRADE_SHEET);

  var headers = [
    '날짜', '시간', '신호', '진입가', '청산가',
    '청산유형', '수익률', '손익($)', '잔고($)'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.getRange(1, 1, 1, headers.length)
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

  sheet.setFrozenRows(1);

  sheet.appendRow([
    '시작', '-', '-', '-', '-', '[초기잔고]', '-', '-',
    VIRTUAL_TRADING.STARTING_BALANCE.toFixed(2)
  ]);
  sheet.getRange(2, 9).setFontWeight('bold').setBackground('#E3F2FD');

  return sheet;
}

function getCurrentBalance(sheet) {
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return VIRTUAL_TRADING.STARTING_BALANCE;
  }

  var balance = sheet.getRange(lastRow, 9).getValue();
  return parseFloat(balance) || VIRTUAL_TRADING.STARTING_BALANCE;
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
      Math.floor(entryPrice / 1000),
      Math.floor(tp1Price / 1000),
      Math.floor(tp2Price / 1000),
      Math.floor(slPrice / 1000),
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
    Logger.log('가상매매 시트 생성');
  }

  Logger.log('시트 설정 완료');
  Logger.log('시트 URL: ' + ss.getUrl());
}

function testSignalLogging() {
  var testData = {
    signal: 'LONG',
    entry: '95000000',
    tp1: '95760000',
    tp2: '96425000',
    sl: '94715000',
    totalScore: '15'
  };

  processSignal(testData);
  Logger.log('테스트 신호 기록 완료');
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
  var position = getPosition();
  if (position) {
    Logger.log('현재 포지션:');
    Logger.log('  신호: ' + position.signal);
    Logger.log('  진입가: ' + Math.floor(position.entryPrice / 1000));
    Logger.log('  TP1: ' + Math.floor(position.tp1Price / 1000));
    Logger.log('  TP2: ' + Math.floor(position.tp2Price / 1000));
    Logger.log('  SL: ' + Math.floor(position.slPrice / 1000));
    Logger.log('  TP1 달성: ' + position.tp1Hit);
    Logger.log('  상태: ' + position.status);
  } else {
    Logger.log('열린 포지션 없음');
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
  clearPosition();
  Logger.log('포지션 강제 삭제 완료');
}
