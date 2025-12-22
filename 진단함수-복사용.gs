// ============================================
// 🔍 보조계정 자동매매 문제 진단
// ============================================
// 이 코드를 보조계정 Code.gs 파일 맨 끝에 붙여넣으세요!
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
