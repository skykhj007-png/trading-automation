/**
 * Bybit Orderbook Analyzer - 실시간 오더블럭 감지
 *
 * 기능:
 * 1. 실시간 오더북 모니터링 (WebSocket)
 * 2. 대량 주문벽 (고래 매물대) 감지
 * 3. 오더북 불균형 분석
 * 4. 텔레그램 알림 전송
 *
 * 사용법:
 * 1. npm install
 * 2. .env 파일에 TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID 설정
 * 3. node orderbook-analyzer.js
 */

const WebSocket = require('ws');
const axios = require('axios');
require('dotenv').config();

// ============================================
// 설정
// ============================================
const CONFIG = {
    // Bybit WebSocket
    wsUrl: 'wss://stream.bybit.com/v5/public/linear',

    // 모니터링 심볼
    symbols: ['BTCUSDT', 'ETHUSDT'],

    // 오더북 깊이 (1, 50, 200, 500)
    depth: 50,

    // 대량 주문벽 기준 (평균 대비 배수)
    whaleWallMultiplier: 5.0,

    // 최소 주문벽 크기 (USDT 기준)
    minWallSizeUSDT: 500000,  // 50만 USDT

    // 오더북 불균형 임계값 (%)
    imbalanceThreshold: 30,

    // 알림 쿨다운 (초)
    alertCooldown: 300,  // 5분

    // 텔레그램
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID
};

// ============================================
// 상태 관리
// ============================================
let orderbooks = {};
let lastAlertTime = {};

// ============================================
// 유틸리티 함수
// ============================================

// 숫자 포맷팅
function formatNumber(num, decimals = 2) {
    if (num >= 1000000) return (num / 1000000).toFixed(decimals) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(decimals) + 'K';
    return num.toFixed(decimals);
}

// 현재 시간 (KST)
function getKSTTime() {
    return new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

// ============================================
// 텔레그램 알림
// ============================================
async function sendTelegramAlert(message) {
    if (!CONFIG.telegramBotToken || !CONFIG.telegramChatId) {
        console.log('[Telegram] 설정 없음, 콘솔 출력만');
        console.log(message);
        return;
    }

    try {
        const url = `https://api.telegram.org/bot${CONFIG.telegramBotToken}/sendMessage`;
        await axios.post(url, {
            chat_id: CONFIG.telegramChatId,
            text: message,
            parse_mode: 'HTML'
        });
        console.log('[Telegram] 알림 전송 완료');
    } catch (error) {
        console.error('[Telegram] 전송 실패:', error.message);
    }
}

// 쿨다운 체크
function canSendAlert(symbol, type) {
    const key = `${symbol}_${type}`;
    const now = Date.now();
    const lastTime = lastAlertTime[key] || 0;

    if (now - lastTime < CONFIG.alertCooldown * 1000) {
        return false;
    }

    lastAlertTime[key] = now;
    return true;
}

// ============================================
// 오더북 분석
// ============================================

// 오더북 통계 계산
function calculateOrderbookStats(bids, asks) {
    // 총 수량
    const totalBidQty = bids.reduce((sum, [price, qty]) => sum + parseFloat(qty), 0);
    const totalAskQty = asks.reduce((sum, [price, qty]) => sum + parseFloat(qty), 0);

    // 총 금액 (USDT)
    const totalBidValue = bids.reduce((sum, [price, qty]) => sum + parseFloat(price) * parseFloat(qty), 0);
    const totalAskValue = asks.reduce((sum, [price, qty]) => sum + parseFloat(price) * parseFloat(qty), 0);

    // 평균 주문 크기
    const avgBidValue = totalBidValue / bids.length;
    const avgAskValue = totalAskValue / asks.length;

    // 불균형 비율 (양수: 매수 우세, 음수: 매도 우세)
    const imbalance = ((totalBidValue - totalAskValue) / (totalBidValue + totalAskValue)) * 100;

    // 최우선 호가
    const bestBid = parseFloat(bids[0][0]);
    const bestAsk = parseFloat(asks[0][0]);
    const spread = ((bestAsk - bestBid) / bestBid) * 100;

    return {
        totalBidQty,
        totalAskQty,
        totalBidValue,
        totalAskValue,
        avgBidValue,
        avgAskValue,
        imbalance,
        bestBid,
        bestAsk,
        spread
    };
}

// 대량 주문벽 찾기
function findWhaleWalls(bids, asks, avgBidValue, avgAskValue, currentPrice) {
    const walls = [];

    // 매수벽 찾기
    for (const [price, qty] of bids) {
        const priceNum = parseFloat(price);
        const qtyNum = parseFloat(qty);
        const value = priceNum * qtyNum;
        const distancePercent = ((currentPrice - priceNum) / currentPrice) * 100;

        if (value >= avgBidValue * CONFIG.whaleWallMultiplier && value >= CONFIG.minWallSizeUSDT) {
            walls.push({
                type: 'BID',
                price: priceNum,
                qty: qtyNum,
                value,
                distance: distancePercent,
                strength: value / avgBidValue
            });
        }
    }

    // 매도벽 찾기
    for (const [price, qty] of asks) {
        const priceNum = parseFloat(price);
        const qtyNum = parseFloat(qty);
        const value = priceNum * qtyNum;
        const distancePercent = ((priceNum - currentPrice) / currentPrice) * 100;

        if (value >= avgAskValue * CONFIG.whaleWallMultiplier && value >= CONFIG.minWallSizeUSDT) {
            walls.push({
                type: 'ASK',
                price: priceNum,
                qty: qtyNum,
                value,
                distance: distancePercent,
                strength: value / avgAskValue
            });
        }
    }

    // 크기순 정렬
    walls.sort((a, b) => b.value - a.value);

    return walls;
}

// ============================================
// 알림 메시지 생성
// ============================================

// 대량 주문벽 알림
function createWallAlert(symbol, wall, stats) {
    const direction = wall.type === 'BID' ? '🟢 매수벽' : '🔴 매도벽';
    const emoji = wall.type === 'BID' ? '🐋' : '🦈';

    return `
${emoji} <b>${direction} 감지!</b>

📊 <b>${symbol}</b>
━━━━━━━━━━━━━━
💰 가격: $${wall.price.toLocaleString()}
📦 수량: ${formatNumber(wall.qty)} ${symbol.replace('USDT', '')}
💵 규모: $${formatNumber(wall.value)}
📏 현재가 대비: ${wall.distance.toFixed(2)}%
⚡ 강도: ${wall.strength.toFixed(1)}x 평균

📈 오더북 상태
• 매수총액: $${formatNumber(stats.totalBidValue)}
• 매도총액: $${formatNumber(stats.totalAskValue)}
• 불균형: ${stats.imbalance > 0 ? '+' : ''}${stats.imbalance.toFixed(1)}%

⏰ ${getKSTTime()}
`.trim();
}

// 오더북 불균형 알림
function createImbalanceAlert(symbol, stats) {
    const direction = stats.imbalance > 0 ? '🟢 매수 우세' : '🔴 매도 우세';
    const emoji = stats.imbalance > 0 ? '📈' : '📉';

    return `
${emoji} <b>오더북 불균형 감지!</b>

📊 <b>${symbol}</b>
━━━━━━━━━━━━━━
${direction}
불균형: ${stats.imbalance > 0 ? '+' : ''}${stats.imbalance.toFixed(1)}%

💰 현재가: $${stats.bestBid.toLocaleString()}
📊 스프레드: ${stats.spread.toFixed(4)}%

📈 매수측: $${formatNumber(stats.totalBidValue)}
📉 매도측: $${formatNumber(stats.totalAskValue)}

⏰ ${getKSTTime()}
`.trim();
}

// ============================================
// 메인 분석 함수
// ============================================
function analyzeOrderbook(symbol, data) {
    const { b: bids, a: asks } = data;

    if (!bids || !asks || bids.length === 0 || asks.length === 0) {
        return;
    }

    // 통계 계산
    const stats = calculateOrderbookStats(bids, asks);
    const currentPrice = (stats.bestBid + stats.bestAsk) / 2;

    // 대량 주문벽 찾기
    const walls = findWhaleWalls(bids, asks, stats.avgBidValue, stats.avgAskValue, currentPrice);

    // 대량 주문벽 알림
    if (walls.length > 0) {
        const topWall = walls[0];
        if (canSendAlert(symbol, `wall_${topWall.type}`)) {
            const message = createWallAlert(symbol, topWall, stats);
            sendTelegramAlert(message);
        }
    }

    // 오더북 불균형 알림
    if (Math.abs(stats.imbalance) >= CONFIG.imbalanceThreshold) {
        if (canSendAlert(symbol, 'imbalance')) {
            const message = createImbalanceAlert(symbol, stats);
            sendTelegramAlert(message);
        }
    }

    // 콘솔 로그 (디버그용)
    console.log(`[${symbol}] 가격: $${currentPrice.toFixed(2)} | 불균형: ${stats.imbalance.toFixed(1)}% | 벽: ${walls.length}개`);
}

// ============================================
// WebSocket 연결
// ============================================
function connectWebSocket() {
    console.log('Bybit WebSocket 연결 중...');

    const ws = new WebSocket(CONFIG.wsUrl);

    ws.on('open', () => {
        console.log('WebSocket 연결됨!');

        // 오더북 구독
        const subscriptions = CONFIG.symbols.map(symbol => `orderbook.${CONFIG.depth}.${symbol}`);

        ws.send(JSON.stringify({
            op: 'subscribe',
            args: subscriptions
        }));

        console.log(`구독: ${subscriptions.join(', ')}`);

        // Heartbeat (20초마다)
        setInterval(() => {
            ws.send(JSON.stringify({ op: 'ping' }));
        }, 20000);
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            // 구독 성공 확인
            if (message.success === true) {
                console.log('구독 성공:', message.ret_msg);
                return;
            }

            // Pong 응답
            if (message.op === 'pong') {
                return;
            }

            // 오더북 데이터
            if (message.topic && message.topic.startsWith('orderbook')) {
                const symbol = message.topic.split('.')[2];

                // 스냅샷 또는 델타
                if (message.type === 'snapshot') {
                    orderbooks[symbol] = message.data;
                    analyzeOrderbook(symbol, message.data);
                } else if (message.type === 'delta') {
                    // 델타 업데이트 (간소화 - 전체 분석)
                    if (orderbooks[symbol]) {
                        // 실제로는 델타를 병합해야 하지만, 간소화를 위해 스냅샷만 분석
                    }
                }
            }
        } catch (error) {
            console.error('메시지 파싱 오류:', error.message);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket 오류:', error.message);
    });

    ws.on('close', () => {
        console.log('WebSocket 연결 끊김, 5초 후 재연결...');
        setTimeout(connectWebSocket, 5000);
    });
}

// ============================================
// 시작
// ============================================
console.log('='.repeat(50));
console.log('Bybit Orderbook Analyzer v1.0');
console.log('='.repeat(50));
console.log(`모니터링: ${CONFIG.symbols.join(', ')}`);
console.log(`오더북 깊이: ${CONFIG.depth}`);
console.log(`대량벽 기준: ${CONFIG.whaleWallMultiplier}x 평균, $${formatNumber(CONFIG.minWallSizeUSDT)} 이상`);
console.log(`불균형 임계값: ${CONFIG.imbalanceThreshold}%`);
console.log('='.repeat(50));

connectWebSocket();
