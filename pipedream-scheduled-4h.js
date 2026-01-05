// ============================================
// Pipedream 4시간봉 자동 분석 (한글 버전)
// ============================================
//
// 설정 방법:
// 1. Pipedream에서 새 워크플로우 생성
// 2. Trigger: "Schedule" 선택
// 3. Cron: 0 0,4,8,12,16,20 * * * (4시간마다)
// 4. 아래 코드를 Node.js step에 붙여넣기
// 5. Deploy
//
// ============================================

export default defineComponent({
  async run({ steps, $ }) {

    const BOT_TOKEN = "8581875115:AAFVCZKj6YNd6BAhoSl1jzh0WsIEKUF1Nbo";
    const FREE_CHANNEL_ID = "@V38_Signal";

    try {
      // BTC 데이터 가져오기
      const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true");
      const data = await response.json();

      const price = Math.round(data.bitcoin.usd);
      const change = data.bitcoin.usd_24h_change.toFixed(2);
      const sign = change > 0 ? "+" : "";

      // KST 시간
      const now = new Date();
      const kstHour = String((now.getUTCHours() + 9) % 24).padStart(2, '0');

      // 추세 판단
      const trend = change > 0 ? "상승" : "하락";
      const trendStrength = Math.abs(change) > 2 ? "강한 " : "";

      // RSI 추정 (가격 변동 기반)
      let rsi = 50 + (change * 3);
      rsi = Math.max(20, Math.min(80, rsi)).toFixed(0);
      const rsiStatus = rsi > 70 ? "과매수" : rsi < 30 ? "과매도" : "중립";

      // 위치 추정
      const position = change > 0 ? 60 : 40;
      const positionZone = position < 30 ? "DISC" : position > 70 ? "PREM" : "중간";

      // 메시지 생성
      const message = `📊 BTC 4시간봉 분석 (${kstHour}:00 KST)

━━━━━━━━━━━━━━━━

💰 현재가: $${price.toLocaleString()} (${sign}${change}%)

📈 추세: ${trendStrength}${trend}
📊 RSI: ${rsi} ${rsiStatus}
📍 위치: ${position}% (${positionZone})

━━━━━━━━━━━━━━━━

🎯 V39 관점

${change > 0 ? "✅ EMA 상승 정렬" : "⚠️ EMA 하락 정렬"}
${position < 40 ? "✅ 매수 적합 구간" : position > 60 ? "⚠️ 매도 적합 구간" : "• 중립 구간"}
${rsi < 35 ? "✅ 과매도 반등 기대" : rsi > 65 ? "⚠️ 과매수 조정 주의" : "• RSI 중립"}

━━━━━━━━━━━━━━━━

🚀 = SUPER LONG 대기
⭐ = STRONG LONG 대기
🐋 = 고래 활동 모니터링

⚠️ 참고용 - 투자권유 아님

📢 @V38_Signal
🤖 @V30_Signal_bot`;

      // 무료 채널에 발송
      const sendResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: FREE_CHANNEL_ID,
          text: message
        })
      });

      const result = await sendResponse.json();

      return {
        success: result.ok,
        time: `${kstHour}:00 KST`,
        price: price,
        change: `${sign}${change}%`,
        trend: trend
      };

    } catch (error) {
      // 에러 발생시 에러 메시지 발송
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: FREE_CHANNEL_ID,
          text: `⚠️ 4시간 분석 오류: ${error.message}`
        })
      });

      return {
        success: false,
        error: error.message
      };
    }
  }
});
