/**
 * 구글 시트 자동 거래일지 기록
 * TP1/TP2/손절 자동 추적 + 수익률 계산
 * 시작 잔고: $100
 */

// ============================================
// 설정
// ============================================

const SHEET_CONFIG = {
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID',  // 여기에 시트 ID 입력!
  SHEET_NAME: '자동화일지',
  STARTING_BALANCE: 100,  // 시작 잔고 $100
  CURRENCY: 'USD'
};

/**
 * 시트 ID 찾는 방법:
 * 1. 구글 시트 열기
 * 2. URL 확인: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
 * 3. "SPREADSHEET_ID" 부분을 복사해서 위에 붙여넣기
 */

// ============================================
// 시트 초기화
// ============================================

/**
 * 거래일지 시트 생성 및 헤더 설정
 */
function setupTradingLogSheet() {
  const ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);

  // 시트가 없으면 생성
  let sheet = ss.getSheetByName(SHEET_CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_CONFIG.SHEET_NAME);
  }

  // 헤더 설정
  const headers = [
    '날짜',
    '시간',
    '마켓',
    '신호',
    '진입가',
    '청산가',
    '청산유형',
    '수량',
    '진입금액($)',
    '청산금액($)',
    '손익($)',
    '수익률(%)',
    '누적잔고($)',
    '신호강도',
    '거래량비율',
    '스마트머니',
    '시장상태',
    '비고'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // 헤더 스타일
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4A90E2')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // 열 너비 조정
  sheet.setColumnWidth(1, 100);  // 날짜
  sheet.setColumnWidth(2, 80);   // 시간
  sheet.setColumnWidth(3, 100);  // 마켓
  sheet.setColumnWidth(4, 80);   // 신호
  sheet.setColumnWidth(5, 100);  // 진입가
  sheet.setColumnWidth(6, 100);  // 청산가
  sheet.setColumnWidth(7, 100);  // 청산유형
  sheet.setColumnWidth(8, 90);   // 수량
  sheet.setColumnWidth(9, 100);  // 진입금액
  sheet.setColumnWidth(10, 100); // 청산금액
  sheet.setColumnWidth(11, 90);  // 손익
  sheet.setColumnWidth(12, 90);  // 수익률
  sheet.setColumnWidth(13, 110); // 누적잔고
  sheet.setColumnWidth(14, 80);  // 신호강도
  sheet.setColumnWidth(15, 100); // 거래량비율
  sheet.setColumnWidth(16, 100); // 스마트머니
  sheet.setColumnWidth(17, 100); // 시장상태
  sheet.setColumnWidth(18, 200); // 비고

  // 시작 잔고 기록
  const startRow = [
    '시작',
    new Date().toLocaleTimeString('ko-KR'),
    '-',
    '-',
    '-',
    '-',
    '초기잔고',
    '-',
    '-',
    '-',
    '-',
    '-',
    SHEET_CONFIG.STARTING_BALANCE,
    '-',
    '-',
    '-',
    '-',
    '시작 잔고: $' + SHEET_CONFIG.STARTING_BALANCE
  ];

  sheet.appendRow(startRow);
  sheet.getRange(2, 13).setBackground('#D5F5E3').setFontWeight('bold');

  Logger.log('✅ 거래일지 시트 설정 완료');
}

// ============================================
// 진입 기록
// ============================================

/**
 * 포지션 진입 기록
 */
function logTradeEntry(webhookData, executionPrice, quantity, entryAmount) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_CONFIG.SHEET_NAME);

    if (!sheet) {
      Logger.log('⚠️ 시트를 찾을 수 없음. setupTradingLogSheet()를 먼저 실행하세요.');
      return;
    }

    const now = new Date();
    const market = CONFIG.TRADING.MARKET;

    // 현재 누적 잔고 가져오기
    const currentBalance = getCurrentBalance(sheet);

    // 진입 정보 저장 (나중에 청산 시 업데이트)
    const props = PropertiesService.getScriptProperties();
    const entryData = {
      entryRow: sheet.getLastRow() + 1,
      entryTime: now.toISOString(),
      entryPrice: executionPrice,
      quantity: quantity,
      entryAmount: entryAmount,
      balanceBeforeTrade: currentBalance,
      tp1Price: parseFloat(webhookData.tp1),
      tp2Price: parseFloat(webhookData.tp2),
      slPrice: parseFloat(webhookData.sl),
      signalStrength: webhookData.signal_strength || 'N/A',
      volumeRatio: webhookData.volume_ratio || 'N/A',
      smartMoney: webhookData.smart_money || 'NONE',
      marketPhase: webhookData.market_phase || 'NEUTRAL'
    };

    props.setProperty('CURRENT_TRADE', JSON.stringify(entryData));

    // 시트에 진입 기록
    const row = [
      Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd'),
      Utilities.formatDate(now, 'Asia/Seoul', 'HH:mm:ss'),
      market,
      webhookData.signal,
      executionPrice,
      '-',  // 청산가 (나중에 업데이트)
      '-',  // 청산유형 (나중에 업데이트)
      quantity,
      entryAmount.toFixed(2),
      '-',  // 청산금액 (나중에 업데이트)
      '-',  // 손익 (나중에 업데이트)
      '-',  // 수익률 (나중에 업데이트)
      currentBalance,
      entryData.signalStrength,
      entryData.volumeRatio,
      entryData.smartMoney,
      entryData.marketPhase,
      `진입완료 | TP1:${webhookData.tp1} TP2:${webhookData.tp2} SL:${webhookData.sl}`
    ];

    sheet.appendRow(row);

    // 진입 행 스타일
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 1, 1, row.length).setBackground('#FFF9C4');

    Logger.log('✅ 진입 기록 완료: Row ' + lastRow);

  } catch (error) {
    Logger.log('❌ 진입 기록 실패: ' + error.toString());
  }
}

// ============================================
// 청산 기록
// ============================================

/**
 * 포지션 청산 기록 (TP1/TP2/손절)
 */
function logTradeExit(exitType, exitPrice, exitQuantity) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_CONFIG.SHEET_NAME);

    if (!sheet) {
      Logger.log('⚠️ 시트를 찾을 수 없음');
      return;
    }

    // 진입 데이터 가져오기
    const props = PropertiesService.getScriptProperties();
    const entryDataStr = props.getProperty('CURRENT_TRADE');

    if (!entryDataStr) {
      Logger.log('⚠️ 진입 데이터를 찾을 수 없음');
      return;
    }

    const entryData = JSON.parse(entryDataStr);
    const entryRow = entryData.entryRow;

    // 청산 금액 계산
    const exitAmount = exitPrice * exitQuantity;
    const profit = exitAmount - (entryData.entryPrice * exitQuantity);
    const profitPercent = (profit / (entryData.entryPrice * exitQuantity)) * 100;

    // 청산 유형 결정
    let exitTypeText = '';
    let exitColor = '';
    let exitEmoji = '';

    switch(exitType) {
      case 'TP1':
        exitTypeText = '1차 익절';
        exitColor = '#A9DFBF';
        exitEmoji = '✅';
        break;
      case 'TP2':
        exitTypeText = '2차 익절';
        exitColor = '#58D68D';
        exitEmoji = '✅✅';
        break;
      case 'STOP_LOSS':
        if (entryData.tp1Hit) {
          exitTypeText = '중간 손절';
          exitEmoji = '⚠️';
        } else {
          exitTypeText = '손절';
          exitEmoji = '🔴';
        }
        exitColor = '#F5B7B1';
        break;
      case 'PARTIAL_LOSS':
        exitTypeText = '부분 손절';
        exitColor = '#FADBD8';
        exitEmoji = '⚠️';
        break;
      default:
        exitTypeText = '청산';
        exitColor = '#D5D8DC';
        exitEmoji = '⚪';
    }

    // 새 누적 잔고 계산
    const currentBalance = entryData.balanceBeforeTrade;
    const percentOfBalance = (entryData.entryAmount / currentBalance);
    const newBalance = currentBalance + (profit / percentOfBalance);

    // 기존 진입 행 업데이트
    sheet.getRange(entryRow, 6).setValue(exitPrice);  // 청산가
    sheet.getRange(entryRow, 7).setValue(exitEmoji + ' ' + exitTypeText);  // 청산유형
    sheet.getRange(entryRow, 10).setValue(exitAmount.toFixed(2));  // 청산금액
    sheet.getRange(entryRow, 11).setValue(profit.toFixed(2));  // 손익
    sheet.getRange(entryRow, 12).setValue(profitPercent.toFixed(2) + '%');  // 수익률
    sheet.getRange(entryRow, 13).setValue(newBalance.toFixed(2));  // 누적잔고

    // 비고 업데이트
    const remark = `${exitEmoji} ${exitTypeText} 완료`;
    sheet.getRange(entryRow, 18).setValue(remark);

    // 청산 행 스타일
    sheet.getRange(entryRow, 1, 1, 18).setBackground(exitColor);

    // 손익 색상
    if (profit > 0) {
      sheet.getRange(entryRow, 11).setFontColor('#27AE60').setFontWeight('bold');
      sheet.getRange(entryRow, 12).setFontColor('#27AE60').setFontWeight('bold');
    } else {
      sheet.getRange(entryRow, 11).setFontColor('#E74C3C').setFontWeight('bold');
      sheet.getRange(entryRow, 12).setFontColor('#E74C3C').setFontWeight('bold');
    }

    // 누적잔고 강조
    sheet.getRange(entryRow, 13).setFontWeight('bold').setBackground('#E8F8F5');

    Logger.log(`✅ 청산 기록 완료: ${exitTypeText} | 손익: $${profit.toFixed(2)} (${profitPercent.toFixed(2)}%)`);

    // TP1인 경우 진입 데이터 유지 (TP2나 손절 대기)
    if (exitType === 'TP1') {
      entryData.tp1Hit = true;
      entryData.quantity = entryData.quantity - exitQuantity;  // 남은 수량
      props.setProperty('CURRENT_TRADE', JSON.stringify(entryData));
    } else {
      // TP2 또는 완전 청산 시 데이터 삭제
      props.deleteProperty('CURRENT_TRADE');
    }

  } catch (error) {
    Logger.log('❌ 청산 기록 실패: ' + error.toString());
  }
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 현재 누적 잔고 가져오기
 */
function getCurrentBalance(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return SHEET_CONFIG.STARTING_BALANCE;
  }

  // 마지막 행의 누적잔고 열(13번째) 확인
  const lastBalance = sheet.getRange(lastRow, 13).getValue();

  if (lastBalance && !isNaN(lastBalance)) {
    return parseFloat(lastBalance);
  }

  return SHEET_CONFIG.STARTING_BALANCE;
}

/**
 * 거래 통계 조회
 */
function getTradingStats() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_CONFIG.SHEET_NAME);

    if (!sheet) {
      return null;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 2) {
      return {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalProfit: 0,
        currentBalance: SHEET_CONFIG.STARTING_BALANCE,
        returnPercent: 0
      };
    }

    // 데이터 가져오기 (헤더 제외)
    const data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();

    let totalTrades = 0;
    let wins = 0;
    let losses = 0;
    let totalProfit = 0;
    let currentBalance = SHEET_CONFIG.STARTING_BALANCE;

    data.forEach(row => {
      const profit = row[10];  // 손익 열
      const balance = row[12];  // 누적잔고 열

      if (profit && profit !== '-' && !isNaN(profit)) {
        totalTrades++;
        const profitNum = parseFloat(profit);
        totalProfit += profitNum;

        if (profitNum > 0) {
          wins++;
        } else if (profitNum < 0) {
          losses++;
        }
      }

      if (balance && balance !== '-' && !isNaN(balance)) {
        currentBalance = parseFloat(balance);
      }
    });

    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const returnPercent = ((currentBalance - SHEET_CONFIG.STARTING_BALANCE) / SHEET_CONFIG.STARTING_BALANCE) * 100;

    const stats = {
      totalTrades: totalTrades,
      wins: wins,
      losses: losses,
      winRate: winRate.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      currentBalance: currentBalance.toFixed(2),
      returnPercent: returnPercent.toFixed(2)
    };

    Logger.log('📊 거래 통계:');
    Logger.log(JSON.stringify(stats, null, 2));

    return stats;

  } catch (error) {
    Logger.log('❌ 통계 조회 실패: ' + error.toString());
    return null;
  }
}

/**
 * 통계 요약 시트에 추가
 */
function addStatsToSheet() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    let statsSheet = ss.getSheetByName('통계');

    if (!statsSheet) {
      statsSheet = ss.insertSheet('통계');
    }

    const stats = getTradingStats();
    if (!stats) return;

    // 통계 표시
    statsSheet.clear();
    statsSheet.getRange('A1').setValue('📊 거래 통계').setFontSize(16).setFontWeight('bold');

    const statsData = [
      ['', ''],
      ['시작 잔고', '$' + SHEET_CONFIG.STARTING_BALANCE],
      ['현재 잔고', '$' + stats.currentBalance],
      ['총 수익/손실', '$' + stats.totalProfit],
      ['수익률', stats.returnPercent + '%'],
      ['', ''],
      ['총 거래 횟수', stats.totalTrades],
      ['승리', stats.wins],
      ['패배', stats.losses],
      ['승률', stats.winRate + '%']
    ];

    statsSheet.getRange(2, 1, statsData.length, 2).setValues(statsData);

    // 스타일
    statsSheet.getRange('B2:B5').setFontWeight('bold').setFontSize(12);
    statsSheet.getRange('B3').setBackground('#D5F5E3');  // 현재 잔고

    if (parseFloat(stats.totalProfit) > 0) {
      statsSheet.getRange('B4').setFontColor('#27AE60').setBackground('#D5F5E3');
      statsSheet.getRange('B5').setFontColor('#27AE60').setBackground('#D5F5E3');
    } else {
      statsSheet.getRange('B4').setFontColor('#E74C3C').setBackground('#FADBD8');
      statsSheet.getRange('B5').setFontColor('#E74C3C').setBackground('#FADBD8');
    }

    statsSheet.setColumnWidth(1, 150);
    statsSheet.setColumnWidth(2, 150);

    Logger.log('✅ 통계 시트 업데이트 완료');

  } catch (error) {
    Logger.log('❌ 통계 시트 업데이트 실패: ' + error.toString());
  }
}

// ============================================
// 테스트 함수
// ============================================

/**
 * 시트 설정 테스트
 */
function testSheetSetup() {
  setupTradingLogSheet();
}

/**
 * 거래 기록 테스트
 */
function testTradeLogging() {
  const testWebhookData = {
    signal: 'LONG',
    entry: '95000',
    tp1: '95760',
    tp2: '96425',
    sl: '94715',
    signal_strength: '9',
    volume_ratio: '2.5',
    smart_money: 'WHALE',
    market_phase: 'ACCUMULATION'
  };

  // 진입 기록
  logTradeEntry(testWebhookData, 95000, 0.001, 95);

  Logger.log('5초 후 TP1 청산 시뮬레이션...');
  Utilities.sleep(5000);

  // TP1 청산 기록
  logTradeExit('TP1', 95760, 0.0005);

  Logger.log('5초 후 TP2 청산 시뮬레이션...');
  Utilities.sleep(5000);

  // TP2 청산 기록
  logTradeExit('TP2', 96425, 0.0005);

  // 통계 업데이트
  addStatsToSheet();
}

/**
 * 통계 조회 테스트
 */
function testGetStats() {
  getTradingStats();
  addStatsToSheet();
}
