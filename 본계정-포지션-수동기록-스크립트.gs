// ============================================
// 본계정 - Bitget 포지션 수동 기록 스크립트
// ============================================
// 이 코드를 본계정 Apps Script에 복사해서 실행하세요!
// ============================================

/**
 * 🚨 긴급: 현재 Bitget 포지션을 시트에 즉시 기록
 *
 * 실행 방법:
 * 1. 이 함수 전체 복사
 * 2. 본계정 Apps Script의 Code.gs 맨 끝에 붙여넣기
 * 3. 저장 (Ctrl + S)
 * 4. 함수 선택: 긴급_포지션_기록
 * 5. 실행 버튼 클릭
 */
function 긴급_포지션_기록() {
  Logger.log('');
  Logger.log('╔════════════════════════════════════════╗');
  Logger.log('║  🚨 긴급 포지션 기록 시작              ║');
  Logger.log('╚════════════════════════════════════════╝');
  Logger.log('');

  try {
    // 1. 스프레드시트 열기
    var ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
    var tradeSheet = ss.getSheetByName(SHEET_CONFIG.TRADE_SHEET);

    if (!tradeSheet) {
      Logger.log('❌ V25 자동매매일지 시트가 없습니다!');
      Logger.log('   → initSimulation() 먼저 실행하세요');
      return;
    }

    Logger.log('✅ 시트 연결 성공');
    Logger.log('');

    // 2. Bitget 포지션 조회
    Logger.log('📊 Bitget 포지션 조회 중...');
    var positions = getBitgetPositions();

    if (!positions || positions.length === 0) {
      Logger.log('⚠️  Bitget 포지션이 없습니다');
      return;
    }

    Logger.log('✅ ' + positions.length + '개 포지션 발견');
    Logger.log('');

    // 3. 각 포지션을 시트에 기록
    var recordCount = 0;

    positions.forEach(function(pos, index) {
      Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      Logger.log('포지션 ' + (index + 1) + ':');
      Logger.log('  마켓: ' + pos.symbol);
      Logger.log('  방향: ' + pos.holdSide);
      Logger.log('  수량: ' + pos.total);
      Logger.log('  진입가: $' + parseFloat(pos.openPriceAvg).toFixed(2));
      Logger.log('  레버리지: ' + pos.leverage + 'x');
      Logger.log('  미실현 손익: $' + parseFloat(pos.unrealizedPL || 0).toFixed(2));

      // 시트에 기록
      var now = new Date();
      var market = pos.symbol.replace('USDT', '-USDT');  // BTCUSDT → BTC-USDT
      var side = pos.holdSide;
      var entryPrice = parseFloat(pos.openPriceAvg);
      var leverage = parseFloat(pos.leverage);

      // TP/SL 계산 (레버리지 기반)
      var tpPercent1, tpPercent2, slPercent;

      if (leverage >= 50) {
        // 고레버리지: 작은 목표
        tpPercent1 = 0.3;  // 0.3%
        tpPercent2 = 0.5;  // 0.5%
        slPercent = 0.15;  // 0.15%
      } else if (leverage >= 20) {
        tpPercent1 = 0.5;
        tpPercent2 = 1.0;
        slPercent = 0.3;
      } else {
        tpPercent1 = 0.8;
        tpPercent2 = 1.5;
        slPercent = 0.5;
      }

      var tp1, tp2, sl;

      if (side === 'LONG' || side === 'long') {
        tp1 = entryPrice * (1 + tpPercent1 / 100);
        tp2 = entryPrice * (1 + tpPercent2 / 100);
        sl = entryPrice * (1 - slPercent / 100);
      } else {
        tp1 = entryPrice * (1 - tpPercent1 / 100);
        tp2 = entryPrice * (1 - tpPercent2 / 100);
        sl = entryPrice * (1 + slPercent / 100);
      }

      // 시트 헤더에 맞게 기록: 날짜, 시간, 마켓, 신호, 진입가, 청산가, 청산유형, 수익률, 손익($), 잔고($), 누적수익률, 메모
      var row = [
        Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd'),
        Utilities.formatDate(now, 'Asia/Seoul', 'HH:mm:ss'),
        market,
        side.toUpperCase(),
        '$' + entryPrice.toFixed(2),
        '-',  // 청산가 (아직 미청산)
        '🔵 진입 [' + leverage + 'x]',  // 청산유형
        '-',  // 수익률
        '-',  // 손익
        '-',  // 잔고
        '-',  // 누적수익률
        'TP1: $' + tp1.toFixed(2) + ' | TP2: $' + tp2.toFixed(2) + ' | SL: $' + sl.toFixed(2)
      ];

      tradeSheet.appendRow(row);

      // 진입 행에 파란색 배경
      var lastRow = tradeSheet.getLastRow();
      tradeSheet.getRange(lastRow, 1, 1, row.length).setBackground('#E3F2FD');
      recordCount++;

      Logger.log('  ✅ 시트에 기록 완료!');
      Logger.log('     TP1: $' + tp1.toFixed(2) + ' (+' + tpPercent1 + '%)');
      Logger.log('     TP2: $' + tp2.toFixed(2) + ' (+' + tpPercent2 + '%)');
      Logger.log('     SL: $' + sl.toFixed(2) + ' (-' + slPercent + '%)');
      Logger.log('');
    });

    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log('');
    Logger.log('🎉 완료!');
    Logger.log('   총 ' + recordCount + '개 포지션 기록됨');
    Logger.log('');
    Logger.log('📊 스프레드시트 확인:');
    Logger.log('   ' + ss.getUrl());
    Logger.log('');
    Logger.log('╔════════════════════════════════════════╗');
    Logger.log('║           기록 완료                    ║');
    Logger.log('╚════════════════════════════════════════╝');
    Logger.log('');

  } catch (error) {
    Logger.log('');
    Logger.log('❌ 오류 발생: ' + error.toString());
    Logger.log('');
    Logger.log('해결 방법:');
    Logger.log('1. SHEET_CONFIG.SPREADSHEET_ID 확인');
    Logger.log('2. initSimulation() 실행');
    Logger.log('3. Bitget API 키 확인');
  }
}

/**
 * 내부 포지션 상태 초기화
 * (포지션 기록 전에 실행하면 중복 방지 로직 우회)
 */
function 포지션상태_초기화() {
  Logger.log('🔄 내부 포지션 상태 초기화 중...');

  try {
    // PropertiesService에 저장된 포지션 상태 삭제
    var props = PropertiesService.getScriptProperties();
    var keys = props.getKeys();

    var deletedCount = 0;
    keys.forEach(function(key) {
      if (key.indexOf('POSITION_') === 0 || key.indexOf('BTC-USDT') >= 0 || key.indexOf('ETH-USDT') >= 0) {
        props.deleteProperty(key);
        deletedCount++;
      }
    });

    Logger.log('✅ ' + deletedCount + '개 상태 삭제됨');
    Logger.log('');
    Logger.log('이제 긴급_포지션_기록() 실행하세요!');

  } catch (error) {
    Logger.log('❌ 오류: ' + error.toString());
  }
}
