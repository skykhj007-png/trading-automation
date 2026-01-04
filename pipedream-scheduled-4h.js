// ============================================
// Pipedream 스케줄 워크플로우 - 4시간봉 자동 분석
// ============================================
//
// 설정 방법:
// 1. Pipedream에서 새 워크플로우 생성
// 2. Trigger: "Schedule" 선택
// 3. Cron Expression: 0 */4 * * * (4시간마다)
//    또는 0 0,4,8,12,16,20 * * * (0시, 4시, 8시, 12시, 16시, 20시)
// 4. 아래 코드를 Node.js step에 붙여넣기
// 5. Deploy
//
// ============================================

export default defineComponent({
  async run({ steps, $ }) {

    const BOT_TOKEN = "8581875115:AAFVCZKj6YNd6BAhoSl1jzh0WsIEKUF1Nbo";

    const PREMIUM_GROUP_ID = -1003318469200;
    const PREMIUM_GROUP_ID_2 = -1003672890861;
    const FREE_CHANNEL_ID = "@V38_Signal";

    try {
      // BTC 데이터 가져오기
      const cgUrl = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7`;
      const response = await fetch(cgUrl);
      const data = await response.json();

      const prices = data.prices.map(p => p[1]);
      const currentPrice = prices[prices.length - 1];
      const price24hAgo = prices[Math.max(0, prices.length - 6)];
      const changePercent = ((currentPrice - price24hAgo) / price24hAgo * 100).toFixed(2);

      // EMA 계산
      const ema9 = prices.slice(-9).reduce((a, b) => a + b, 0) / 9;
      const ema21 = prices.slice(-21).reduce((a, b) => a + b, 0) / 21;
      const ema50 = prices.slice(-50).reduce((a, b) => a + b, 0) / 50;
      const trend = ema9 > ema21 ? "상승" : "하락";
      const emaStrength = ema9 > ema21 && ema21 > ema50 ? "강한 상승" : ema9 < ema21 && ema21 < ema50 ? "강한 하락" : "혼조";

      // RSI
      let gains = 0, losses = 0;
      const recentPrices = prices.slice(-15);
      for (let i = 1; i < recentPrices.length; i++) {
        const change = recentPrices[i] - recentPrices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
      }
      const rs = gains / Math.max(losses, 0.0001);
      const rsi = (100 - (100 / (1 + rs))).toFixed(1);

      // 지지/저항
      const high = Math.max(...prices.slice(-50));
      const low = Math.min(...prices.slice(-50));
      const position = ((currentPrice - low) / (high - low) * 100).toFixed(0);

      // 시간 (KST)
      const now = new Date();
      const kstHours = (now.getUTCHours() + 9) % 24;
      const timeStr = `${kstHours.toString().padStart(2, '0')}:00`;

      // 점수 계산
      let score = 15;
      if (ema9 > ema21) score += 3;
      if (ema21 > ema50) score += 2;
      if (rsi < 40) score += 2;
      if (position < 30) score += 3;

      const grade = score >= 22 ? 'S' : score >= 19 ? 'A' : score >= 16 ? 'B+' : 'B';

      // ============================================
      // 무료 채널용 분석 (간단)
      // ============================================

      const freeAnalysis = `📊 BTC 4시간봉 분석 (${timeStr} KST)

━━━━━━━━━━━━━━━━

💰 현재가: $${currentPrice.toFixed(0)} (${changePercent > 0 ? '+' : ''}${changePercent}%)

📈 추세: ${trend} (${emaStrength})
📊 RSI: ${rsi} ${rsi > 70 ? '⚠️과매수' : rsi < 30 ? '✅과매도' : '중립'}
📍 위치: ${position}% ${position < 30 ? '(DISC✅)' : position > 70 ? '(PREM⚠️)' : '(중간)'}

━━━━━━━━━━━━━━━━

🎯 V39 관점

${ema9 > ema21 ? '✅ EMA 상승 정렬' : '⚠️ EMA 하락 정렬'}
${position < 30 ? '✅ 매수 적합 구간' : position > 70 ? '⚠️ 매도 적합 구간' : '• 중립 구간'}
${rsi < 30 ? '✅ 과매도 반등 기대' : rsi > 70 ? '⚠️ 과매수 조정 주의' : '• RSI 중립'}

━━━━━━━━━━━━━━━━

🚀 = SUPER LONG 대기
⭐ = STRONG LONG 대기
🐋 = 고래 활동 모니터링

⚠️ 참고용 - 투자권유 아님

📢 @V38_Signal
🤖 @V30_Signal_bot`;

      // ============================================
      // 프리미엄 채널용 분석 (상세)
      // ============================================

      const premiumAnalysis = `🔒 프리미엄 4시간 분석 (${timeStr} KST)

━━━━━━━━━━━━━━━━

💰 BTC: $${currentPrice.toFixed(0)} (${changePercent > 0 ? '+' : ''}${changePercent}%)

━━━━━━━━━━━━━━━━

📊 상세 분석

• 추세: ${trend} ${ema9 > ema21 && ema21 > ema50 ? '(강한 상승)' : ''}
• EMA9: $${ema9.toFixed(0)}
• EMA21: $${ema21.toFixed(0)}
• EMA50: $${ema50.toFixed(0)}

━━━━━━━━━━━━━━━━

📈 지표 현황

• RSI: ${rsi} ${rsi > 70 ? '⚠️' : rsi < 30 ? '✅' : ''}
• 위치: ${position}%
• 등급: ${grade} (${score}점)

━━━━━━━━━━━━━━━━

🎯 V39 매매 관점

${score >= 16 ? '✅ 롱 진입 가능 구간' : '⚠️ 관망 권장'}
${position < 30 ? '✅ DISCOUNT 구간' : position > 70 ? '⚠️ PREMIUM 구간' : '• 중립 구간'}

📌 진입 시 확인사항:
• Smart Trail 라임색?
• 1H/4H 추세 UP?
• 거래량 급증?

━━━━━━━━━━━━━━━━

📍 주요 가격대

• 저항: $${high.toFixed(0)}
• 지지: $${low.toFixed(0)}
• TP1: $${(currentPrice * 1.01).toFixed(0)} (+1%)
• TP2: $${(currentPrice * 1.02).toFixed(0)} (+2%)
• SL: $${(currentPrice * 0.98).toFixed(0)} (-2%)

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님
모든 결정은 본인 책임입니다`;

      // ============================================
      // 메시지 발송
      // ============================================

      // 무료 채널
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: FREE_CHANNEL_ID,
          text: freeAnalysis
        })
      });

      // 프리미엄 그룹 1
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: PREMIUM_GROUP_ID,
          text: premiumAnalysis
        })
      });

      // 프리미엄 그룹 2
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: PREMIUM_GROUP_ID_2,
          text: premiumAnalysis
        })
      });

      return {
        success: true,
        time: timeStr,
        price: currentPrice.toFixed(0),
        trend: trend,
        grade: grade
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});
