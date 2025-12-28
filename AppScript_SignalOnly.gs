/**
 * Trading Signal Logger - 신호 기록 전용
 * TradingView 알람 → Webhook → 구글 시트 기록
 *
 * ⚠️ 실제 매매 없음 (API 연동 X)
 * 📊 신호만 구글 시트에 기록
 * 🔔 알림으로 신호 수신
 *
 * === 사용법 ===
 * 1. 이 코드를 Google Apps Script에 복사
 * 2. SHEET_CONFIG.SPREADSHEET_ID에 구글 시트 ID 입력
 * 3. 웹 앱으로 배포 (배포 → 새 배포 → 웹 앱)
 * 4. TradingView 알람에 Webhook URL 설정
 */

// ============================================
// 설정 (Configuration)
// ============================================

const SIGNAL_ONLY_CONFIG = {
  // 거래 설정 (참고용)
  TRADING: {
    MARKET: 'KRW-BTC',
    MIN_SIGNAL_STRENGTH: 12  // 최소 신호 강도
  },

  // 알림 설정
  NOTIFICATION: {
    ENABLED: true,
    EMAIL: '',  // 알림 받을 이메일 (선택)
    TELEGRAM_BOT_TOKEN: '',  // 텔레그램 봇 토큰 (선택)
    TELEGRAM_CHAT_ID: ''     // 텔레그램 채팅 ID (선택)
  }
};

// 구글 시트 설정
const SHEET_CONFIG = {
  SPREADSHEET_ID: '1dlntPV_LY_1RrCCpmkW3zw5dpcA_dMhVDkjd90QcI7E',
  SHEET_NAME: '신호기록'
};

/**
 * 시트 ID 찾는 방법:
 * 1. 구글 시트 열기
 * 2. URL 확인: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
 * 3. "SPREADSHEET_ID" 부분을 복사해서 위에 붙여넣기
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
      Logger.log('❌ 필수 데이터 누락');
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '필수 데이터 누락 (signal, entry 필요)'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 신호 처리 (기록만)
    const result = processSignal(data);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      result: result
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('❌ Webhook 처리 오류: ' + error.toString());

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
    message: 'Trading Signal Logger is running',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// 신호 처리
// ============================================

/**
 * 신호 처리 및 기록
 */
function processSignal(data) {
  const entryPrice = parseFloat(data.entry);
  const tp1Price = parseFloat(data.tp1) || 0;
  const tp2Price = parseFloat(data.tp2) || 0;
  const slPrice = parseFloat(data.sl) || 0;
  const totalScore = parseFloat(data.totalScore) || 0;

  Logger.log(`\n🎯 신호 처리: ${data.signal}`);
  Logger.log(`진입가: ${entryPrice}`);
  Logger.log(`TP1: ${tp1Price}, TP2: ${tp2Price}, SL: ${slPrice}`);
  Logger.log(`신호 강도: ${totalScore}`);

  // 신호 강도 검증 (선택적)
  if (totalScore > 0 && totalScore < SIGNAL_ONLY_CONFIG.TRADING.MIN_SIGNAL_STRENGTH) {
    Logger.log(`⚠️ 신호 강도 부족: ${totalScore}/${SIGNAL_ONLY_CONFIG.TRADING.MIN_SIGNAL_STRENGTH}`);

    // 약한 신호도 기록은 하되, 비고에 표시
    data.remark = '⚠️ 신호 강도 부족';
  }

  // 구글 시트에 기록
  logSignalToSheet(data, entryPrice, tp1Price, tp2Price, slPrice);

  // 알림 전송
  sendSignalNotification(data, entryPrice, tp1Price, tp2Price, slPrice);

  return {
    action: 'signal_recorded',
    signal: data.signal,
    entryPrice: entryPrice,
    tp1: tp1Price,
    tp2: tp2Price,
    sl: slPrice
  };
}

// ============================================
// 구글 시트 기록
// ============================================

/**
 * 구글 시트에 신호 기록
 */
function logSignalToSheet(data, entryPrice, tp1Price, tp2Price, slPrice) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_CONFIG.SHEET_NAME);

    // 시트가 없으면 생성
    if (!sheet) {
      sheet = createSignalSheet(ss);
    }

    const now = new Date();

    // 퍼센트 계산
    const tp1Percent = entryPrice > 0 ? ((tp1Price - entryPrice) / entryPrice * 100).toFixed(2) : 'N/A';
    const tp2Percent = entryPrice > 0 ? ((tp2Price - entryPrice) / entryPrice * 100).toFixed(2) : 'N/A';
    const slPercent = entryPrice > 0 ? ((slPrice - entryPrice) / entryPrice * 100).toFixed(2) : 'N/A';

    // 데이터 행 생성
    const row = [
      Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd'),  // 날짜
      Utilities.formatDate(now, 'Asia/Seoul', 'HH:mm:ss'),    // 시간
      data.market || SIGNAL_ONLY_CONFIG.TRADING.MARKET,                    // 마켓
      data.signal,                                             // 신호 (LONG/SHORT)
      entryPrice,                                              // 진입가
      tp1Price || '-',                                         // TP1
      tp2Price || '-',                                         // TP2
      slPrice || '-',                                          // SL
      tp1Percent !== 'N/A' ? tp1Percent + '%' : '-',          // TP1(%)
      tp2Percent !== 'N/A' ? tp2Percent + '%' : '-',          // TP2(%)
      slPercent !== 'N/A' ? slPercent + '%' : '-',            // SL(%)
      data.totalScore || '-',                                  // 신호강도
      data.volume_ratio || '-',                                // 거래량비율
      data.smart_money || '-',                                 // 스마트머니
      data.market_phase || '-',                                // 시장상태
      data.remark || '수동 매매 대기'                          // 비고
    ];

    sheet.appendRow(row);

    // 스타일 적용
    const lastRow = sheet.getLastRow();

    if (data.signal === 'LONG') {
      sheet.getRange(lastRow, 1, 1, row.length).setBackground('#E8F5E9');  // 연한 초록
      sheet.getRange(lastRow, 4).setFontColor('#2E7D32').setFontWeight('bold');  // LONG 텍스트
    } else if (data.signal === 'SHORT') {
      sheet.getRange(lastRow, 1, 1, row.length).setBackground('#FFEBEE');  // 연한 빨강
      sheet.getRange(lastRow, 4).setFontColor('#C62828').setFontWeight('bold');  // SHORT 텍스트
    }

    // 가격 열 포맷
    sheet.getRange(lastRow, 5, 1, 4).setNumberFormat('#,##0');

    Logger.log('✅ 구글 시트에 신호 기록 완료: Row ' + lastRow);

  } catch (error) {
    Logger.log('❌ 시트 기록 실패: ' + error.toString());
    throw error;
  }
}

/**
 * 신호 기록 시트 생성
 */
function createSignalSheet(ss) {
  const sheet = ss.insertSheet(SHEET_CONFIG.SHEET_NAME);

  // 헤더 설정
  const headers = [
    '날짜', '시간', '마켓', '신호', '진입가',
    'TP1', 'TP2', 'SL',
    'TP1(%)', 'TP2(%)', 'SL(%)',
    '신호강도', '거래량비율', '스마트머니', '시장상태', '비고'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // 헤더 스타일
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4A90E2')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // 열 너비 조정
  sheet.setColumnWidth(1, 100);   // 날짜
  sheet.setColumnWidth(2, 80);    // 시간
  sheet.setColumnWidth(3, 100);   // 마켓
  sheet.setColumnWidth(4, 70);    // 신호
  sheet.setColumnWidth(5, 120);   // 진입가
  sheet.setColumnWidth(6, 120);   // TP1
  sheet.setColumnWidth(7, 120);   // TP2
  sheet.setColumnWidth(8, 120);   // SL
  sheet.setColumnWidth(9, 80);    // TP1(%)
  sheet.setColumnWidth(10, 80);   // TP2(%)
  sheet.setColumnWidth(11, 80);   // SL(%)
  sheet.setColumnWidth(12, 80);   // 신호강도
  sheet.setColumnWidth(13, 90);   // 거래량비율
  sheet.setColumnWidth(14, 100);  // 스마트머니
  sheet.setColumnWidth(15, 100);  // 시장상태
  sheet.setColumnWidth(16, 150);  // 비고

  // 행 고정
  sheet.setFrozenRows(1);

  Logger.log('✅ 신호기록 시트 생성 완료');

  return sheet;
}

// ============================================
// 알림 전송
// ============================================

/**
 * 신호 알림 전송
 */
function sendSignalNotification(data, entryPrice, tp1Price, tp2Price, slPrice) {
  if (!SIGNAL_ONLY_CONFIG.NOTIFICATION.ENABLED) return;

  const signal = data.signal;
  const emoji = signal === 'LONG' ? '🚀' : '🔻';

  // 퍼센트 계산
  const tp1Pct = ((tp1Price - entryPrice) / entryPrice * 100).toFixed(2);
  const tp2Pct = ((tp2Price - entryPrice) / entryPrice * 100).toFixed(2);
  const slPct = ((slPrice - entryPrice) / entryPrice * 100).toFixed(2);

  const message = `${emoji} ${signal} 신호 발생!\n\n` +
                  `마켓: ${data.market || SIGNAL_ONLY_CONFIG.TRADING.MARKET}\n` +
                  `진입가: ${entryPrice.toLocaleString()}\n\n` +
                  `🎯 목표가:\n` +
                  `  TP1: ${tp1Price.toLocaleString()} (${tp1Pct}%)\n` +
                  `  TP2: ${tp2Price.toLocaleString()} (${tp2Pct}%)\n` +
                  `  SL: ${slPrice.toLocaleString()} (${slPct}%)\n\n` +
                  `📊 신호강도: ${data.totalScore || 'N/A'}\n` +
                  `📈 스마트머니: ${data.smart_money || 'N/A'}\n` +
                  `📍 시장상태: ${data.market_phase || 'N/A'}\n\n` +
                  `⚠️ 구글 시트에 기록됨\n` +
                  `⚠️ 수동으로 진입하세요!`;

  // 이메일 알림
  if (SIGNAL_ONLY_CONFIG.NOTIFICATION.EMAIL) {
    try {
      MailApp.sendEmail({
        to: SIGNAL_ONLY_CONFIG.NOTIFICATION.EMAIL,
        subject: `[Trading Signal] ${emoji} ${signal} - ${data.market || SIGNAL_ONLY_CONFIG.TRADING.MARKET}`,
        body: message
      });
      Logger.log('✅ 이메일 알림 전송 완료');
    } catch (error) {
      Logger.log('❌ 이메일 전송 실패: ' + error.toString());
    }
  }

  // 텔레그램 알림
  if (SIGNAL_ONLY_CONFIG.NOTIFICATION.TELEGRAM_BOT_TOKEN && SIGNAL_ONLY_CONFIG.NOTIFICATION.TELEGRAM_CHAT_ID) {
    try {
      sendTelegramMessage(message);
      Logger.log('✅ 텔레그램 알림 전송 완료');
    } catch (error) {
      Logger.log('❌ 텔레그램 전송 실패: ' + error.toString());
    }
  }
}

/**
 * 텔레그램 메시지 전송
 */
function sendTelegramMessage(message) {
  const url = `https://api.telegram.org/bot${SIGNAL_ONLY_CONFIG.NOTIFICATION.TELEGRAM_BOT_TOKEN}/sendMessage`;

  const payload = {
    chat_id: SIGNAL_ONLY_CONFIG.NOTIFICATION.TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'HTML'
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  Logger.log('텔레그램 응답: ' + response.getContentText());
}

// ============================================
// 테스트 함수
// ============================================

/**
 * 시트 설정 테스트 - 먼저 실행!
 */
function testSetupSheet() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_CONFIG.SHEET_NAME);

    if (!sheet) {
      sheet = createSignalSheet(ss);
      Logger.log('✅ 신호기록 시트가 생성되었습니다!');
    } else {
      Logger.log('✅ 신호기록 시트가 이미 존재합니다.');
    }

    Logger.log('시트 URL: ' + ss.getUrl());

  } catch (error) {
    Logger.log('❌ 오류: ' + error.toString());
    Logger.log('⚠️ SHEET_CONFIG.SPREADSHEET_ID를 확인하세요!');
  }
}

/**
 * 신호 기록 테스트
 */
function testSignalLogging() {
  const testData = {
    signal: 'LONG',
    entry: '95000000',
    tp1: '95760000',    // +0.8%
    tp2: '96425000',    // +1.5%
    sl: '94715000',     // -0.3%
    totalScore: '15',
    volume_ratio: '2.5',
    smart_money: 'WHALE',
    market_phase: 'ACCUMULATION'
  };

  Logger.log('=== 신호 기록 테스트 ===');
  Logger.log('테스트 데이터:');
  Logger.log(JSON.stringify(testData, null, 2));

  const result = processSignal(testData);

  Logger.log('\n결과:');
  Logger.log(JSON.stringify(result, null, 2));
}

/**
 * SHORT 신호 테스트
 */
function testShortSignal() {
  const testData = {
    signal: 'SHORT',
    entry: '95000000',
    tp1: '94240000',    // -0.8%
    tp2: '93575000',    // -1.5%
    sl: '95285000',     // +0.3%
    totalScore: '14',
    volume_ratio: '1.8',
    smart_money: 'BEAR',
    market_phase: 'DISTRIBUTION'
  };

  Logger.log('=== SHORT 신호 테스트 ===');
  const result = processSignal(testData);
  Logger.log('결과:', JSON.stringify(result, null, 2));
}

/**
 * Webhook URL 확인
 */
function getWebhookUrl() {
  Logger.log('=== Webhook URL 확인 ===');
  Logger.log('1. 배포 → 새 배포 클릭');
  Logger.log('2. 유형: 웹 앱 선택');
  Logger.log('3. 액세스 권한: 모든 사용자');
  Logger.log('4. 배포 후 URL을 TradingView에 입력');
  Logger.log('\n⚠️ 배포할 때마다 새 URL이 생성됩니다!');
}
