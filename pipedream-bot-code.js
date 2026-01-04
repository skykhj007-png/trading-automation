export default defineComponent({
    async run({ steps, $ }) {
      const message = steps.trigger.event.message;

      // ============================================
      // 설정
      // ============================================

      // 환경변수에서 가져옴 (Pipedream Settings → Environment Variables에서 설정)
      const BOT_TOKEN = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN";
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "YOUR_OPENAI_API_KEY";

      const PREMIUM_GROUP_ID = -1003318469200;
      const PREMIUM_GROUP_ID_2 = -1003672890861;
      const ADMIN_ID = 752036014;

      // 무료 시그널 채널 (@V38_Signal)
      const FREE_CHANNEL_ID = "@V38_Signal";  // public 채널은 username으로 발송 가능!

      const chatId = message?.chat?.id;

      // ============================================
      // 새 멤버 자동 환영 메시지
      // ============================================

      const newMember = message?.new_chat_member || message?.new_chat_members?.[0];

      if (newMember && !newMember.is_bot) {
        const isPremiumGroup = (chatId === PREMIUM_GROUP_ID || chatId === PREMIUM_GROUP_ID_2);

        let welcomeText;

        if (isPremiumGroup) {
          // 프리미엄 방 환영 메시지
          welcomeText = `👋 안녕하세요, ${newMember.first_name}님!

🎉 프리미엄 멤버가 되신 것을 환영합니다!

━━━━━━━━━━━━━━━━

📚 프리미엄 전용 명령어

📊 AI 차트 분석
/a5m - 5분봉 분석
/a15m - 15분봉 분석
/a1h - 1시간봉 분석
/a4h - 4시간봉 분석
/a1d - 일봉 분석

💡 /a15m ETH → ETH 분석
🪙 모든 코인 지원!

━━━━━━━━━━━━━━━━

📖 지표 가이드
/가이드 - 핵심 가이드
/알림 - 알림 설정 방법
/체크리스트 - 진입 조건
/청산 - 청산 가이드
/등급 - 등급 설명
/smc - SMC/구조 설명
/설정 - 권장 설정

━━━━━━━━━━━━━━━━

/도움말 - 전체 명령어 보기

⚠️ 참고용이며 투자권유가 아닙니다`;
        } else {
          // 일반 방 환영 메시지
          welcomeText = `👋 환영합니다, ${newMember.first_name}님!

🤖 MTF Confluence Pro

⚠️ 본 서비스는 참고용이며 투자권유가 아닙니다.

【무료 이용 방법】
비트겟 가입만 하면 모두 무료!

✅ 텔레그램 실시간 AI 분석&대화방 입장
✅ TradingView 지표 (평생)

━━━━━━━━━━━━━━━━

📌 무료 이용 조건:

1️⃣ 비트겟 가입 (레퍼럴)
👉 https://partner.bitget.com/bg/AZ6Z8S

2️⃣ 아래 정보 전송:
   • 비트겟 UID
   • TradingView 아이디

3️⃣ 24시간 내 권한 부여!

💡 유지 조건: 월 $100 거래량

━━━━━━━━━━━━━━━━

💰 비트겟 미가입 시 (유료):

• 월 구독: ₩50,000
• 평생 이용: ₩200,000

💳 입금 정보:
USDT (TRC20)
TPpgMe6JxtudoEdDegkyKUaBUyAWRKti12

━━━━━━━━━━━━━━━━

❓ 문의: @pointting`;
        }

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: welcomeText
          })
        });

        return { sent: true, type: "welcome", user: newMember.first_name, isPremium: isPremiumGroup };
      }

      // ============================================
      // 메시지 처리
      // ============================================

      const text = message?.text || "";
      const parts = text.split(' ');
      const command = parts[0].toLowerCase();
      const coinInput = parts[1] ? parts[1].toUpperCase() : 'BTC';

      const isPremium = (chatId === PREMIUM_GROUP_ID ||
                         chatId === PREMIUM_GROUP_ID_2 ||
                         chatId === ADMIN_ID);

      let responseText = "";

      // ============================================
      // 모든 채팅 - /start /가입 /info
      // ============================================

      if (command === '/start' || command === '/가입' || command === '/info') {
        responseText = `🤖 V39 Trading System

⚠️ 본 서비스는 참고용이며 투자권유가 아닙니다.

【무료 이용 방법】
비트겟 가입만 하면 모두 무료!

✅ 텔레그램 실시간 AI 분석&대화방 입장
✅ TradingView V39 지표 (평생)

━━━━━━━━━━━━━━━━

📌 무료 이용 조건:

1️⃣ 비트겟 가입 (레퍼럴)
👉 https://partner.bitget.com/bg/AZ6Z8S

2️⃣ 아래 정보 전송:
   • 비트겟 UID
   • TradingView 아이디

3️⃣ 24시간 내 권한 부여!

💡 유지 조건: 월 $100 거래량

━━━━━━━━━━━━━━━━

💰 비트겟 미가입 시 (유료):

• 월 구독: ₩50,000
• 평생 이용: ₩200,000

💳 입금 정보:
USDT (TRC20)
TPpgMe6JxtudoEdDegkyKUaBUyAWRKti12

※ 전송수수료 포함하여 입금
※ 입금 후 @pointting 으로 문의

━━━━━━━━━━━━━━━━

📍 이용 방법:
1. 비트겟 가입 또는 USDT 입금
2. UID / TradingView ID 전송
3. 권한 부여 확인
4. AI 분석방 & 지표 이용!

❓ 문의사항은 메시지 보내주세요!`;
      }

      // ============================================
      // 프리미엄 아닌 경우 - 안내
      // ============================================

      else if (!isPremium) {
        if (command.startsWith('/') && command !== '/start') {
          responseText = `🔒 프리미엄 전용 기능입니다.

━━━━━━━━━━━━━━━━

무료로 이용하려면:
👉 /start 입력 후 가입 안내 확인

━━━━━━━━━━━━━━━━

💬 문의: @pointting`;
        }
      }

      // ============================================
      // 프리미엄 - /analyze /분석
      // ============================================

      else if (command === '/analyze' || command === '/분석') {
        responseText = `📊 AI 차트 분석

━━━━━━━━━━━━━━━━

📈 타임프레임 선택

/a5m - 5분봉
/a15m - 15분봉
/a1h - 1시간봉
/a4h - 4시간봉
/a1d - 일봉

━━━━━━━━━━━━━━━━

💡 사용법

/a15m → BTC 15분봉
/a15m ETH → ETH 15분봉
/a1h SOL → SOL 1시간봉

━━━━━━━━━━━━━━━━

🪙 모든 코인 지원!`;
      }

      // ============================================
      // 프리미엄 - AI 차트 분석 (모든 코인)
      // ============================================

      else if (['/a5m', '/a15m', '/a1h', '/a4h', '/a1d'].includes(command)) {

        const tfMap = {
          '/a5m': { tf: '5분봉', days: '1' },
          '/a15m': { tf: '15분봉', days: '1' },
          '/a1h': { tf: '1시간봉', days: '7' },
          '/a4h': { tf: '4시간봉', days: '14' },
          '/a1d': { tf: '일봉', days: '30' }
        };

        const selected = tfMap[command];
        const coin = coinInput.replace('USDT', '').replace('USD', '');

        try {
          // 1. 코인 검색 (자동)
          const searchUrl = `https://api.coingecko.com/api/v3/search?query=${coin}`;
          const searchRes = await fetch(searchUrl);
          const searchData = await searchRes.json();

          if (!searchData.coins || searchData.coins.length === 0) {
            responseText = `❌ "${coin}" 코인을 찾을 수 없습니다.

💡 정확한 심볼을 입력해주세요.
예: /a15m BTC, /a1h ETH`;
          } else {
            const coinId = searchData.coins[0].id;
            const coinName = searchData.coins[0].name;
            const coinSymbol = searchData.coins[0].symbol.toUpperCase();

            // 2. 가격 데이터 가져오기
            const cgUrl = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${selected.days}`;
            const response = await fetch(cgUrl);
            const data = await response.json();

            if (!data.prices || data.prices.length === 0) {
              responseText = `❌ 데이터를 가져올 수 없습니다.

잠시 후 다시 시도해주세요.`;
            } else {
              const prices = data.prices.map(p => p[1]);
              const currentPrice = prices[prices.length - 1];
              const openPrice = prices[0];

              // EMA 계산
              const ema9 = prices.slice(-9).reduce((a, b) => a + b, 0) / Math.min(9, prices.length);
              const ema21 = prices.slice(-21).reduce((a, b) => a + b, 0) / Math.min(21, prices.length);
              const trend = ema9 > ema21 ? "상승" : "하락";
              const changePercent = ((currentPrice - openPrice) / openPrice * 100).toFixed(2);

              // RSI 계산
              let gains = 0, losses = 0;
              const recentPrices = prices.slice(-15);
              for (let i = 1; i < recentPrices.length; i++) {
                const change = recentPrices[i] - recentPrices[i - 1];
                if (change > 0) gains += change;
                else losses -= change;
              }
              const rs = gains / Math.max(losses, 0.0001);
              const rsi = 100 - (100 / (1 + rs));

              // 지지/저항
              const high = Math.max(...prices.slice(-50));
              const low = Math.min(...prices.slice(-50));
              const position = ((currentPrice - low) / (high - low) * 100).toFixed(0);

              // 가격 포맷
              const formatPrice = (price) => {
                if (price < 0.00000001) return price.toFixed(12);
                if (price < 0.0001) return price.toFixed(8);
                if (price < 0.01) return price.toFixed(6);
                if (price < 1) return price.toFixed(4);
                if (price < 100) return price.toFixed(3);
                return price.toFixed(2);
              };

              const prompt = `V39 MTF Confluence Pro 기준 암호화폐 분석:

코인: ${coinSymbol} (${coinName})
타임프레임: ${selected.tf}
현재가: ${formatPrice(currentPrice)}
변동률: ${changePercent}%
EMA9: ${formatPrice(ema9)} / EMA21: ${formatPrice(ema21)}
추세: ${trend}
RSI: ${rsi.toFixed(1)}
고가: ${formatPrice(high)} / 저가: ${formatPrice(low)}
가격위치: ${position}%

다음 형식으로 분석 (투자권유 아님 명시):

📊 ${coinSymbol} ${selected.tf} 분석
━━━━━━━━━━━━━━━━
💰 현재가: $xxx (${changePercent > 0 ? '+' : ''}xx%)
📈 추세: 상승/하락 (EMA정렬 여부)
📊 RSI: xx (과매수/과매도/중립)
📍 지지: $xxx | 저항: $xxx
📍 위치: xx% (지지근처/중간/저항근처)
🎯 V38 관점: 진입조건 충족 여부, 권장 행동
⚠️ [참고용-투자권유아님]`;

              const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                  model: 'gpt-4o-mini',
                  messages: [{ role: 'user', content: prompt }],
                  max_tokens: 500,
                  temperature: 0.7
                })
              });

              const gptData = await gptResponse.json();

              if (gptData.choices && gptData.choices[0]) {
                responseText = gptData.choices[0].message.content;
              } else {
                responseText = `📊 ${coinSymbol} ${selected.tf} 분석

━━━━━━━━━━━━━━━━

💰 현재가: ${formatPrice(currentPrice)} (${changePercent}%)
📈 추세: ${trend}
📊 RSI: ${rsi.toFixed(1)}
📍 위치: ${position}%

${ema9 > ema21 ? '🟢 상승 추세' : '🔴 하락 추세'}

⚠️ [참고용-투자권유아님]`;
              }
            }
          }
        } catch (error) {
          responseText = `❌ 오류 발생

잠시 후 다시 시도해주세요.
예: /a15m BTC`;
        }
      }

      // ============================================
      // 프리미엄 - /guide /가이드 /설명서
      // ============================================

      else if (command === '/guide' || command === '/가이드' || command === '/설명서') {
        responseText = `📚 V39 MTF Confluence Pro

━━━━━━━━━━━━━━━━

⚠️ 본 지표는 참고용이며
   투자권유가 아닙니다!

━━━━━━━━━━━━━━━━

🎯 핵심 시그널 (이것만 보세요!)

🚀 SUPER LONG = 무조건 진입!
⭐ STRONG LONG = 강력 추천
💀 SUPER SHORT = 무조건 숏!
⚠️ STRONG SHORT = 강력 숏
🐋 WHALE BUY/SELL = 고래 활동

━━━━━━━━━━━━━━━━

✅ 진입 조건

• 2TF 이상 상승 + 1H UP
• 거래량 급증 + 매수압력 48%+
• Smart Trail 라임색
• 위치 30% 이하 (DISC)

━━━━━━━━━━━━━━━━

🚫 진입 금지

• 1H 또는 4H DOWN
• 위치 50% 이상
• Smart Trail 빨간색

━━━━━━━━━━━━━━━━

📍 미니패널 방향

▲ LONG (라임) = 롱 유리
  → Trail↑ + 1H↑ + 15점+

▼ SHORT (빨강) = 숏 유리
  → Trail↓ + 1H↓ + 위치70%+

— WAIT (회색) = 대기!

━━━━━━━━━━━━━━━━

🐋 고래 감지

• 거래량 3배+ & 가격변동 0.5%+
• BUY = 파란 라벨
• SELL = 보라 라벨

━━━━━━━━━━━━━━━━

🔔 알림: /알림
🎯 권장: 🚀⭐ 시그널만 거래!

❓ 문의: @pointting`;
      }

      // ============================================
      // 프리미엄 - /alert /알림 (새 명령어)
      // ============================================

      else if (command === '/alert' || command === '/알림') {
        responseText = `🔔 V39 알림 설정 가이드

━━━━━━━━━━━━━━━━

📌 알림 생성 방법

1️⃣ 차트에서 알림 아이콘 (종) 클릭
   또는 단축키: Alt + A

2️⃣ 조건 설정:
   • 첫 번째: V39 MTF Confluence Pro
   • 두 번째: "모든 alert() 함수 호출"

━━━━━━━━━━━━━━━━

⚠️ 중요!

"돌파", "보다큼", "보다작은" 등
선택하면 안됩니다!

반드시 👇
"모든 alert() 함수 호출" 선택!

━━━━━━━━━━━━━━━━

⏰ 만료 설정

• 권장: 무기한 (Open-ended)
• 또는: 원하는 기간 선택

━━━━━━━━━━━━━━━━

📊 권장 타임프레임

• 데이트레이딩: 15분봉
• 스윙: 1시간봉

━━━━━━━━━━━━━━━━

❓ 문의: @pointting`;
      }

      // ============================================
      // 프리미엄 - /checklist /체크리스트
      // ============================================

      else if (command === '/checklist' || command === '/체크리스트') {
        responseText = `✅ LONG 진입 체크리스트

━━━━━━━━━━━━━━━━

□ 시그널: STRONG 이상?
□ 1H 추세: UP?
□ 4H 추세: UP?
□ 위치: 20% 이하?
□ Smart Trail: 라임색?
□ 등급: B+ (16점) 이상?

━━━━━━━━━━━━━━━━

📌 6개 중 5개 이상 → 진입 OK

━━━━━━━━━━━━━━━━

🚫 절대 금지

• 1H/4H DOWN일 때 진입
• 위치 80% 이상 추격
• EXIT 시그널 무시

━━━━━━━━━━━━━━━━

⚠️ 시그널 ≠ 100% 수익 보장
   모든 결정은 본인 책임!`;
      }

      // ============================================
      // 프리미엄 - /exit /청산
      // ============================================

      else if (command === '/exit' || command === '/청산') {
        responseText = `🚨 청산 가이드

━━━━━━━━━━━━━━━━

⚡ 즉시 청산

• EXIT LONG (빨간 X)
• Smart Trail 빨간색 전환
• 점수 15점 미만 하락

━━━━━━━━━━━━━━━━

⚠️ 주의 (부분 청산)

• Trail Warning (주황 원)
• 1H 추세 DOWN 전환

━━━━━━━━━━━━━━━━

💡 EXIT = 즉시 청산!
"조금 더" = 큰 손실

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;
      }

      // ============================================
      // 프리미엄 - /grade /등급
      // ============================================

      else if (command === '/grade' || command === '/등급') {
        responseText = `📊 V39 등급 시스템

━━━━━━━━━━━━━━━━

🏆 S등급 (22점+) → 적극 진입!
⭐ A+등급 (22점+) → 매우 강력
🅰️ A등급 (19점+) → 강력
✅ B+등급 (16점+) → 좋음
🔵 B등급 (15점+) → 진입 가능
⚪ C등급 (15점 미만) → 대기

━━━━━━━━━━━━━━━━

💡 권장: B+ 이상만 거래

📊 점수 구성 (30점)
• 추세: 8점
• 모멘텀: 8점
• 거래량: 6점
• 구조: 8점

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;
      }

      // ============================================
      // 프리미엄 - /smc
      // ============================================

      else if (command === '/smc') {
        responseText = `🧠 V39 SMC (Smart Money)

━━━━━━━━━━━━━━━━

🎯 핵심 시그널

🚀 SUPER LONG = 무조건 진입!
⭐ STRONG LONG = 강력 추천
💀 SUPER SHORT = 무조건 숏!
⚠️ STRONG SHORT = 강력 숏

━━━━━━━━━━━━━━━━

🐋 고래 감지

• 거래량 3배 이상
• 가격변동 0.5% 이상
• 🐋BUY = 고래 매수 (파랑)
• 🐋SELL = 고래 매도 (보라)

━━━━━━━━━━━━━━━━

📈 Smart Trail

• 라임색 = LONG 유리
• 빨간색 = SHORT 유리

🎯 Zone
• DISC = 매수 적합 (하단)
• PREM = 매도 적합 (상단)

━━━━━━━━━━━━━━━━

📊 시장 구조 (설정에서 ON)

• HH/HL = 상승 구조
• LH/LL = 하락 구조
• BOS+/- = 구조 돌파
• CHoCH = 추세 전환

━━━━━━━━━━━━━━━━

📦 박스 표시 (설정에서 ON)

• 초록 박스: 매수 OB
• 빨강 박스: 매도 OB
• 청록 점선: 상승 FVG
• 적갈색 점선: 하락 FVG

※ 깔끔한 차트를 위해
  기본값 OFF로 설정됨

━━━━━━━━━━━━━━━━

⚠️ 참고용 - 투자권유 아님`;
      }

      // ============================================
      // 프리미엄 - /settings /설정
      // ============================================

      else if (command === '/settings' || command === '/설정') {
        responseText = `⚙️ V39 권장 설정

━━━━━━━━━━━━━━━━

📊 타임프레임: 15분 / 1시간
🔔 시그널: STRONG 이상
📱 화면: 최소화

━━━━━━━━━━━━━━━━

📈 거래량 설정
• 급증: 1.5x
• 폭증: 2.5x

━━━━━━━━━━━━━━━━

💡 팁: LONG만 거래 권장

🔔 알림 설정: /알림

⚠️ 참고용 - 투자권유 아님`;
      }

      // ============================================
      // 프리미엄 - /help /도움말
      // ============================================

      else if (command === '/help' || command === '/도움말') {
        let helpText = `🤖 V39 Premium 명령어

━━━━━━━━━━━━━━━━

📊 AI 차트 분석

/a5m - 5분봉
/a15m - 15분봉
/a1h - 1시간봉
/a4h - 4시간봉
/a1d - 일봉

💡 /a15m ETH → ETH 분석
🪙 모든 코인 지원!

━━━━━━━━━━━━━━━━

📚 V39 지표 가이드

/가이드 - 핵심 가이드
/알림 - 알림 설정 방법 ⭐
/체크리스트 - 진입 조건
/청산 - 청산 가이드
/등급 - 등급 설명
/smc - SMC/구조 설명 ⭐
/설정 - 권장 설정

━━━━━━━━━━━━━━━━

📢 무료 시그널: @V38_Signal

💬 문의: @pointting`;

        // 관리자인 경우 관리자 명령어 추가
        if (chatId === ADMIN_ID) {
          helpText += `

━━━━━━━━━━━━━━━━

🔐 관리자 명령어

/4h - 무료채널 4시간 분석
/premium4h - 프리미엄 4시간 분석
/sendhelp - 프리미엄 도움말 발송
/broadcast [메시지] - 무료채널 발송`;
        }

        responseText = helpText;
      }

      // ============================================
      // 관리자 - /4h (4시간봉 분석 발송 - 무료채널)
      // ============================================

      else if ((command === '/4h' || command === '/4시간') && chatId === ADMIN_ID) {
        // BTC 실시간 데이터 가져오기
        try {
          const cgUrl = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7`;
          const response = await fetch(cgUrl);
          const data = await response.json();

          const prices = data.prices.map(p => p[1]);
          const currentPrice = prices[prices.length - 1];
          const price24hAgo = prices[Math.max(0, prices.length - 6)]; // 약 24시간 전
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

          const now = new Date();
          const kstHours = (now.getUTCHours() + 9) % 24;
          const timeStr = `${kstHours.toString().padStart(2, '0')}:00`;

          const analysis4h = `📊 BTC 4시간봉 분석 (${timeStr} KST)

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

📌 주요 가격대

• 저항: $${high.toFixed(0)}
• 지지: $${low.toFixed(0)}

━━━━━━━━━━━━━━━━

🚀 = SUPER LONG 대기
⭐ = STRONG LONG 대기
🐋 = 고래 활동 모니터링

⚠️ 참고용 - 투자권유 아님

📢 @V38_Signal
🤖 @V30_Signal_bot`;

          // 무료 채널에 발송
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: FREE_CHANNEL_ID,
              text: analysis4h
            })
          });

          responseText = `✅ 4시간 분석이 무료 채널에 발송되었습니다!`;
        } catch (error) {
          responseText = `❌ 분석 생성 실패. 다시 시도해주세요.`;
        }
      }

      // ============================================
      // 관리자 - /premium4h (프리미엄 4시간 분석)
      // ============================================

      else if ((command === '/premium4h' || command === '/프리미엄분석') && chatId === ADMIN_ID) {
        try {
          const cgUrl = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7`;
          const response = await fetch(cgUrl);
          const data = await response.json();

          const prices = data.prices.map(p => p[1]);
          const currentPrice = prices[prices.length - 1];
          const price24hAgo = prices[Math.max(0, prices.length - 6)];
          const changePercent = ((currentPrice - price24hAgo) / price24hAgo * 100).toFixed(2);

          const ema9 = prices.slice(-9).reduce((a, b) => a + b, 0) / 9;
          const ema21 = prices.slice(-21).reduce((a, b) => a + b, 0) / 21;
          const ema50 = prices.slice(-50).reduce((a, b) => a + b, 0) / 50;
          const trend = ema9 > ema21 ? "상승" : "하락";

          let gains = 0, losses = 0;
          const recentPrices = prices.slice(-15);
          for (let i = 1; i < recentPrices.length; i++) {
            const change = recentPrices[i] - recentPrices[i - 1];
            if (change > 0) gains += change;
            else losses -= change;
          }
          const rs = gains / Math.max(losses, 0.0001);
          const rsi = (100 - (100 / (1 + rs))).toFixed(1);

          const high = Math.max(...prices.slice(-50));
          const low = Math.min(...prices.slice(-50));
          const position = ((currentPrice - low) / (high - low) * 100).toFixed(0);

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

          // 프리미엄 그룹들에 발송
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: PREMIUM_GROUP_ID,
              text: premiumAnalysis
            })
          });

          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: PREMIUM_GROUP_ID_2,
              text: premiumAnalysis
            })
          });

          responseText = `✅ 프리미엄 4시간 분석이 발송되었습니다!`;
        } catch (error) {
          responseText = `❌ 분석 생성 실패. 다시 시도해주세요.`;
        }
      }

      // ============================================
      // 관리자 - /sendhelp (프리미엄 도움말 발송)
      // ============================================

      else if ((command === '/sendhelp' || command === '/도움말발송') && chatId === ADMIN_ID) {
        const helpDoc = `📚 V39 MTF Confluence Pro 사용법

━━━━━━━━━━━━━━━━

🎯 핵심 시그널

🚀 SUPER LONG - 최고 확신!
⭐ STRONG LONG - 강력 추천
💀 SUPER SHORT - 숏 확신
⚠️ STRONG SHORT - 숏 추천
🐋 WHALE - 고래 매수/매도

━━━━━━━━━━━━━━━━

✅ LONG 진입 조건

1. 시그널: 🚀 또는 ⭐
2. 미니패널: ▲ LONG (라임)
3. 1H/4H: 둘 다 UP
4. 위치: 30% 이하 (DISC)
5. Smart Trail: 라임색
6. 등급: B+ (16점) 이상

📌 6개 중 5개 이상 → 진입!

━━━━━━━━━━━━━━━━

🚫 진입 금지 상황

• 미니패널: — WAIT
• 1H 또는 4H: DOWN
• 위치: 70% 이상
• Smart Trail: 빨간색
• 등급: C

━━━━━━━━━━━━━━━━

🚨 청산 타이밍

• EXIT LONG (❌) → 즉시 청산!
• Trail Warning (⚠️) → 부분 청산
• Smart Trail 빨강 전환 → 청산 준비

━━━━━━━━━━━━━━━━

📊 등급 시스템

🏆 S등급 (22+) - 적극 진입
⭐ A등급 (19+) - 강력
✅ B+등급 (16+) - 좋음
🔵 B등급 (15+) - 가능
⚪ C등급 (-15) - 대기

━━━━━━━━━━━━━━━━

📱 미니패널 해석

▲ LONG (라임)
→ Trail↑ + 1H↑ + 15점+

▼ SHORT (빨강)
→ Trail↓ + 1H↓ + 위치70%+

— WAIT (회색)
→ 조건 미충족, 대기!

━━━━━━━━━━━━━━━━

🐋 고래 감지

• 거래량 3배 이상
• 가격변동 0.5% 이상
• BUY = 매수 (파란 라벨)
• SELL = 매도 (보라 라벨)

━━━━━━━━━━━━━━━━

📊 AI 분석 명령어

/a5m - 5분봉 분석
/a15m - 15분봉 분석
/a1h - 1시간봉 분석
/a4h - 4시간봉 분석
/a1d - 일봉 분석

💡 /a15m ETH → ETH 분석

━━━━━━━━━━━━━━━━

⚠️ 주의사항

• 시그널 ≠ 100% 수익 보장
• 모든 투자 결정은 본인 책임
• LONG만 권장 (SHORT 승률 낮음)
• EXIT 시그널 시 즉시 청산

━━━━━━━━━━━━━━━━

❓ 문의: @pointting`;

        // 프리미엄 그룹들에 발송
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: PREMIUM_GROUP_ID,
            text: helpDoc
          })
        });

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: PREMIUM_GROUP_ID_2,
            text: helpDoc
          })
        });

        responseText = `✅ 도움말이 프리미엄 그룹에 발송되었습니다!`;
      }

      // ============================================
      // 관리자 - /broadcast (무료채널 발송)
      // ============================================

      else if (command === '/broadcast' && chatId === ADMIN_ID) {
        const broadcastMsg = text.replace('/broadcast', '').trim();
        if (broadcastMsg) {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: FREE_CHANNEL_ID,
              text: broadcastMsg
            })
          });
          responseText = `✅ 무료 채널에 발송 완료!`;
        } else {
          responseText = `❌ 사용법: /broadcast [메시지]`;
        }
      }

      // ============================================
      // 응답 전송
      // ============================================

      if (responseText) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: responseText
          })
        });

        return { sent: true, command: text, isPremium: isPremium };
      }

      return { sent: false, reason: "No matching command" };
    }
  });
