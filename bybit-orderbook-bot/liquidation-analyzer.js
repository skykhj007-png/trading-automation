/**
 * Bybit Liquidation Level Analyzer - 청산 매물대 분석
 *
 * 기능:
 * 1. 오픈 인터레스트(OI) 변화 모니터링
 * 2. 펀딩비 기반 롱/숏 비율 분석
 * 3. 레버리지별 청산 가격대 계산
 * 4. 대량 청산 발생 감지
 * 5. TradingView용 데이터 출력 (Webhook/파일)
 * 6. 텔레그램 알림
 *
 * 사용법:
 * 1. npm install
 * 2. .env 파일에 TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID 설정
 * 3. node liquidation-analyzer.js
 */

const WebSocket = require('ws');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

// ============================================
// 설정
// ============================================
const CONFIG = {
    // Bybit REST API
    restUrl: 'https://api.bybit.com',

    // Bybit WebSocket
    wsUrl: 'wss://stream.bybit.com/v5/public/linear',

    // 모니터링 심볼
    symbols: ['BTCUSDT', 'ETHUSDT'],

    // 청산 레벨 계산 설정
    leverageLevels: [5, 10, 25, 50, 100, 125],  // 분석할 레버리지

    // 대량 청산 감지 기준
    largeLiquidationUSDT: 1000000,  // 100만 USDT 이상

    // OI 급변 감지 (%)
    oiChangeThreshold: 2.0,  // 2% 이상 변화

    // 펀딩비 극단값 (%)
    fundingRateExtreme: 0.05,  // 0.05% 이상이면 청산 위험

    // 데이터 저장 경로 (TradingView용)
    outputPath: './liquidation-levels.json',

    // 업데이트 주기 (ms)
    updateInterval: 30000,  // 30초

    // 알림 쿨다운 (초)
    alertCooldown: 300,  // 5분

    // 텔레그램
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID
};

// ============================================
// 상태 저장
// ============================================
let marketData = {};
let lastAlerts = {};
let liquidationLevels = {};

// ============================================
// Bybit REST API 함수
// ============================================

// 현재가 조회
async function getTicker(symbol) {
    try {
        const response = await axios.get(`${CONFIG.restUrl}/v5/market/tickers`, {
            params: { category: 'linear', symbol }
        });
        return response.data.result.list[0];
    } catch (error) {
        console.error(`[ERROR] getTicker ${symbol}:`, error.message);
        return null;
    }
}

// 오픈 인터레스트 조회
async function getOpenInterest(symbol) {
    try {
        const response = await axios.get(`${CONFIG.restUrl}/v5/market/open-interest`, {
            params: { category: 'linear', symbol, intervalTime: '5min', limit: 50 }
        });
        return response.data.result.list;
    } catch (error) {
        console.error(`[ERROR] getOpenInterest ${symbol}:`, error.message);
        return [];
    }
}

// 펀딩비 조회
async function getFundingRate(symbol) {
    try {
        const response = await axios.get(`${CONFIG.restUrl}/v5/market/funding/history`, {
            params: { category: 'linear', symbol, limit: 10 }
        });
        return response.data.result.list;
    } catch (error) {
        console.error(`[ERROR] getFundingRate ${symbol}:`, error.message);
        return [];
    }
}

// 롱숏 비율 조회
async function getLongShortRatio(symbol) {
    try {
        const response = await axios.get(`${CONFIG.restUrl}/v5/market/account-ratio`, {
            params: { category: 'linear', symbol, period: '1h', limit: 24 }
        });
        return response.data.result.list;
    } catch (error) {
        console.error(`[ERROR] getLongShortRatio ${symbol}:`, error.message);
        return [];
    }
}

// ============================================
// 청산 레벨 계산
// ============================================

/**
 * 레버리지별 청산 가격 계산
 *
 * 롱 청산가 = 진입가 * (1 - 1/레버리지 + 유지마진율)
 * 숏 청산가 = 진입가 * (1 + 1/레버리지 - 유지마진율)
 *
 * 유지마진율은 약 0.5%로 가정
 */
function calculateLiquidationPrices(currentPrice, leverages) {
    const maintenanceMarginRate = 0.005;  // 0.5%
    const levels = { long: [], short: [] };

    for (const lev of leverages) {
        // 롱 청산가 (가격 하락 시)
        const longLiqPrice = currentPrice * (1 - 1/lev + maintenanceMarginRate);
        const longLiqPercent = ((currentPrice - longLiqPrice) / currentPrice * 100).toFixed(2);

        // 숏 청산가 (가격 상승 시)
        const shortLiqPrice = currentPrice * (1 + 1/lev - maintenanceMarginRate);
        const shortLiqPercent = ((shortLiqPrice - currentPrice) / currentPrice * 100).toFixed(2);

        levels.long.push({
            leverage: lev,
            price: Math.round(longLiqPrice * 100) / 100,
            percentFromCurrent: longLiqPercent,
            direction: 'DOWN'
        });

        levels.short.push({
            leverage: lev,
            price: Math.round(shortLiqPrice * 100) / 100,
            percentFromCurrent: shortLiqPercent,
            direction: 'UP'
        });
    }

    return levels;
}

/**
 * 청산 클러스터 추정
 * OI 분포 + 펀딩비 기반으로 어느 방향에 청산 물량이 많은지 추정
 */
function estimateLiquidationClusters(symbol, data) {
    const { currentPrice, fundingRate, longShortRatio, oiChange } = data;

    // 펀딩비가 양수면 롱이 많음 → 하락 시 대량 청산 예상
    // 펀딩비가 음수면 숏이 많음 → 상승 시 대량 청산 예상

    const clusters = {
        highRisk: [],   // 청산 위험 높은 구간
        mediumRisk: [], // 중간 위험
        lowRisk: []     // 낮은 위험
    };

    const levels = calculateLiquidationPrices(currentPrice, CONFIG.leverageLevels);

    // 펀딩비 기반 위험도 계산
    const fundingBias = parseFloat(fundingRate) || 0;
    const lsRatio = parseFloat(longShortRatio) || 1;

    // 롱 포지션 청산 위험 (가격 하락 시)
    if (fundingBias > 0 || lsRatio > 1.2) {
        // 롱이 많은 상황 → 하락 시 청산 위험
        levels.long.forEach(level => {
            const riskScore = calculateRiskScore(level.leverage, fundingBias, lsRatio, 'long');

            if (riskScore >= 70) {
                clusters.highRisk.push({ ...level, type: 'LONG_LIQ', riskScore });
            } else if (riskScore >= 40) {
                clusters.mediumRisk.push({ ...level, type: 'LONG_LIQ', riskScore });
            } else {
                clusters.lowRisk.push({ ...level, type: 'LONG_LIQ', riskScore });
            }
        });
    }

    // 숏 포지션 청산 위험 (가격 상승 시)
    if (fundingBias < 0 || lsRatio < 0.8) {
        // 숏이 많은 상황 → 상승 시 청산 위험
        levels.short.forEach(level => {
            const riskScore = calculateRiskScore(level.leverage, fundingBias, lsRatio, 'short');

            if (riskScore >= 70) {
                clusters.highRisk.push({ ...level, type: 'SHORT_LIQ', riskScore });
            } else if (riskScore >= 40) {
                clusters.mediumRisk.push({ ...level, type: 'SHORT_LIQ', riskScore });
            } else {
                clusters.lowRisk.push({ ...level, type: 'SHORT_LIQ', riskScore });
            }
        });
    }

    return clusters;
}

/**
 * 위험도 점수 계산 (0-100)
 */
function calculateRiskScore(leverage, fundingRate, lsRatio, positionType) {
    let score = 0;

    // 고레버리지일수록 위험
    if (leverage >= 100) score += 30;
    else if (leverage >= 50) score += 25;
    else if (leverage >= 25) score += 20;
    else if (leverage >= 10) score += 15;
    else score += 10;

    // 펀딩비 기반 점수
    const absRate = Math.abs(fundingRate);
    if (absRate >= 0.1) score += 30;
    else if (absRate >= 0.05) score += 20;
    else if (absRate >= 0.01) score += 10;

    // 롱숏 비율 기반 점수
    if (positionType === 'long' && lsRatio > 1.5) score += 30;
    else if (positionType === 'long' && lsRatio > 1.2) score += 20;
    else if (positionType === 'short' && lsRatio < 0.67) score += 30;
    else if (positionType === 'short' && lsRatio < 0.83) score += 20;

    return Math.min(score, 100);
}

// ============================================
// 메인 분석 함수
// ============================================

async function analyzeSymbol(symbol) {
    console.log(`\n[${new Date().toLocaleTimeString()}] ${symbol} 분석 중...`);

    // 데이터 수집
    const ticker = await getTicker(symbol);
    const oiHistory = await getOpenInterest(symbol);
    const fundingHistory = await getFundingRate(symbol);
    const lsRatioHistory = await getLongShortRatio(symbol);

    if (!ticker) {
        console.error(`[ERROR] ${symbol} 티커 데이터 없음`);
        return null;
    }

    const currentPrice = parseFloat(ticker.lastPrice);
    const fundingRate = fundingHistory[0]?.fundingRate || '0';
    const longShortRatio = lsRatioHistory[0]?.buyRatio || '0.5';

    // OI 변화 계산
    let oiChange = 0;
    if (oiHistory.length >= 2) {
        const latestOI = parseFloat(oiHistory[0].openInterest);
        const prevOI = parseFloat(oiHistory[1].openInterest);
        oiChange = ((latestOI - prevOI) / prevOI * 100);
    }

    // 데이터 저장
    marketData[symbol] = {
        currentPrice,
        fundingRate: parseFloat(fundingRate) * 100,  // 퍼센트로 변환
        longShortRatio: parseFloat(longShortRatio),
        oiChange,
        timestamp: Date.now()
    };

    // 청산 클러스터 추정
    const clusters = estimateLiquidationClusters(symbol, marketData[symbol]);

    // 청산 레벨 저장
    liquidationLevels[symbol] = {
        currentPrice,
        levels: calculateLiquidationPrices(currentPrice, CONFIG.leverageLevels),
        clusters,
        fundingRate: marketData[symbol].fundingRate,
        longShortRatio: marketData[symbol].longShortRatio,
        oiChange,
        timestamp: Date.now()
    };

    // 결과 출력
    printAnalysis(symbol);

    // 알림 체크
    checkAlerts(symbol);

    return liquidationLevels[symbol];
}

// ============================================
// 출력 함수
// ============================================

function printAnalysis(symbol) {
    const data = liquidationLevels[symbol];
    if (!data) return;

    console.log('\n' + '='.repeat(60));
    console.log(`📊 ${symbol} 청산 매물대 분석`);
    console.log('='.repeat(60));

    console.log(`\n💰 현재가: $${data.currentPrice.toLocaleString()}`);
    console.log(`📈 펀딩비: ${data.fundingRate.toFixed(4)}%`);
    console.log(`⚖️ 롱/숏 비율: ${(data.longShortRatio * 100).toFixed(1)}% Long`);
    console.log(`📊 OI 변화: ${data.oiChange >= 0 ? '+' : ''}${data.oiChange.toFixed(2)}%`);

    // 롱 청산 레벨 (가격 하락 시)
    console.log('\n🔴 롱 청산 레벨 (가격 하락 시):');
    console.log('-'.repeat(50));
    data.levels.long.forEach(level => {
        const marker = level.leverage >= 50 ? '⚠️' : '  ';
        console.log(`${marker} ${level.leverage}x: $${level.price.toLocaleString()} (-${level.percentFromCurrent}%)`);
    });

    // 숏 청산 레벨 (가격 상승 시)
    console.log('\n🟢 숏 청산 레벨 (가격 상승 시):');
    console.log('-'.repeat(50));
    data.levels.short.forEach(level => {
        const marker = level.leverage >= 50 ? '⚠️' : '  ';
        console.log(`${marker} ${level.leverage}x: $${level.price.toLocaleString()} (+${level.percentFromCurrent}%)`);
    });

    // 위험 클러스터
    if (data.clusters.highRisk.length > 0) {
        console.log('\n🚨 고위험 청산 구간:');
        data.clusters.highRisk.forEach(c => {
            console.log(`   ${c.type}: $${c.price.toLocaleString()} (${c.leverage}x, 위험도: ${c.riskScore})`);
        });
    }
}

// ============================================
// TradingView용 데이터 저장
// ============================================

function saveTradingViewData() {
    const tvData = {
        timestamp: new Date().toISOString(),
        symbols: {}
    };

    for (const symbol of CONFIG.symbols) {
        const data = liquidationLevels[symbol];
        if (!data) continue;

        // TradingView에서 사용할 수 있는 형식으로 변환
        tvData.symbols[symbol] = {
            currentPrice: data.currentPrice,
            fundingRate: data.fundingRate,
            longShortRatio: data.longShortRatio,

            // 주요 청산 레벨 (Pine Script에서 수평선으로 표시)
            longLiquidationLevels: data.levels.long.map(l => ({
                price: l.price,
                leverage: l.leverage,
                label: `Long ${l.leverage}x Liq`
            })),

            shortLiquidationLevels: data.levels.short.map(l => ({
                price: l.price,
                leverage: l.leverage,
                label: `Short ${l.leverage}x Liq`
            })),

            // 고위험 구간
            highRiskZones: data.clusters.highRisk.map(c => ({
                price: c.price,
                type: c.type,
                leverage: c.leverage,
                riskScore: c.riskScore
            }))
        };
    }

    // JSON 파일로 저장
    fs.writeFileSync(CONFIG.outputPath, JSON.stringify(tvData, null, 2));
    console.log(`\n💾 TradingView 데이터 저장: ${CONFIG.outputPath}`);

    return tvData;
}

// ============================================
// 알림 함수
// ============================================

function checkAlerts(symbol) {
    const data = liquidationLevels[symbol];
    if (!data) return;

    const now = Date.now();
    const alertKey = `${symbol}_liq`;

    // 쿨다운 체크
    if (lastAlerts[alertKey] && (now - lastAlerts[alertKey]) < CONFIG.alertCooldown * 1000) {
        return;
    }

    // 고위험 청산 구간 알림
    if (data.clusters.highRisk.length > 0) {
        const message = formatAlertMessage(symbol, data);
        sendTelegramAlert(message);
        lastAlerts[alertKey] = now;
    }

    // 펀딩비 극단값 알림
    if (Math.abs(data.fundingRate) >= CONFIG.fundingRateExtreme) {
        const direction = data.fundingRate > 0 ? '롱 과열' : '숏 과열';
        const riskDirection = data.fundingRate > 0 ? '하락' : '상승';

        const message = `⚠️ ${symbol} 펀딩비 경고\n\n` +
            `펀딩비: ${data.fundingRate.toFixed(4)}% (${direction})\n` +
            `현재가: $${data.currentPrice.toLocaleString()}\n\n` +
            `📌 ${riskDirection} 시 대량 청산 가능성`;

        sendTelegramAlert(message);
        lastAlerts[`${symbol}_funding`] = now;
    }
}

function formatAlertMessage(symbol, data) {
    let message = `🚨 ${symbol} 청산 매물대 경고\n\n`;
    message += `💰 현재가: $${data.currentPrice.toLocaleString()}\n`;
    message += `📈 펀딩비: ${data.fundingRate.toFixed(4)}%\n`;
    message += `⚖️ 롱비율: ${(data.longShortRatio * 100).toFixed(1)}%\n\n`;

    message += `🎯 고위험 청산 구간:\n`;
    data.clusters.highRisk.slice(0, 3).forEach(c => {
        const emoji = c.type === 'LONG_LIQ' ? '🔴' : '🟢';
        message += `${emoji} ${c.leverage}x: $${c.price.toLocaleString()}\n`;
    });

    message += `\n📌 이 구간 근처에서 대량 청산 발생 가능`;

    return message;
}

async function sendTelegramAlert(message) {
    if (!CONFIG.telegramBotToken || !CONFIG.telegramChatId) {
        console.log('\n📱 텔레그램 알림 (설정 안됨):');
        console.log(message);
        return;
    }

    try {
        await axios.post(`https://api.telegram.org/bot${CONFIG.telegramBotToken}/sendMessage`, {
            chat_id: CONFIG.telegramChatId,
            text: message,
            parse_mode: 'HTML'
        });
        console.log('\n✅ 텔레그램 알림 전송됨');
    } catch (error) {
        console.error('[ERROR] 텔레그램 전송 실패:', error.message);
    }
}

// ============================================
// WebSocket으로 실시간 체결 감지 (대량 청산 감지용)
// ============================================

function startTradeWebSocket() {
    const ws = new WebSocket(CONFIG.wsUrl);

    ws.on('open', () => {
        console.log('\n🔌 WebSocket 연결됨 (체결 모니터링)');

        // 체결 데이터 구독
        const subscribeMsg = {
            op: 'subscribe',
            args: CONFIG.symbols.map(s => `publicTrade.${s}`)
        };
        ws.send(JSON.stringify(subscribeMsg));
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            if (msg.topic && msg.topic.startsWith('publicTrade.')) {
                const symbol = msg.topic.replace('publicTrade.', '');
                analyzeTrades(symbol, msg.data);
            }
        } catch (error) {
            // 파싱 에러 무시
        }
    });

    ws.on('close', () => {
        console.log('🔌 WebSocket 연결 종료, 3초 후 재연결...');
        setTimeout(startTradeWebSocket, 3000);
    });

    ws.on('error', (error) => {
        console.error('[ERROR] WebSocket:', error.message);
    });
}

// 대량 체결 분석 (청산으로 인한 시장가 주문 감지)
let recentTrades = {};

function analyzeTrades(symbol, trades) {
    if (!recentTrades[symbol]) {
        recentTrades[symbol] = [];
    }

    const now = Date.now();

    for (const trade of trades) {
        const size = parseFloat(trade.v) * parseFloat(trade.p);  // USDT 규모

        recentTrades[symbol].push({
            time: now,
            size,
            side: trade.S,  // Buy/Sell
            price: parseFloat(trade.p)
        });
    }

    // 최근 10초 데이터만 유지
    recentTrades[symbol] = recentTrades[symbol].filter(t => now - t.time < 10000);

    // 10초 내 총 체결량 계산
    const totalVolume = recentTrades[symbol].reduce((sum, t) => sum + t.size, 0);
    const buyVolume = recentTrades[symbol].filter(t => t.side === 'Buy').reduce((sum, t) => sum + t.size, 0);
    const sellVolume = recentTrades[symbol].filter(t => t.side === 'Sell').reduce((sum, t) => sum + t.size, 0);

    // 대량 청산 감지 (10초 내 100만 USDT 이상 한방향 체결)
    if (sellVolume >= CONFIG.largeLiquidationUSDT && sellVolume > buyVolume * 2) {
        const alertKey = `${symbol}_liq_detected`;
        if (!lastAlerts[alertKey] || (now - lastAlerts[alertKey]) > 60000) {
            console.log(`\n🔥 ${symbol} 대량 롱 청산 감지! 매도 체결: $${(sellVolume/1000000).toFixed(2)}M`);
            sendTelegramAlert(`🔥 ${symbol} 대량 롱 청산 감지!\n\n` +
                `매도 체결: $${(sellVolume/1000000).toFixed(2)}M\n` +
                `현재가: $${recentTrades[symbol][recentTrades[symbol].length-1]?.price.toLocaleString()}`);
            lastAlerts[alertKey] = now;
        }
    }

    if (buyVolume >= CONFIG.largeLiquidationUSDT && buyVolume > sellVolume * 2) {
        const alertKey = `${symbol}_liq_detected`;
        if (!lastAlerts[alertKey] || (now - lastAlerts[alertKey]) > 60000) {
            console.log(`\n🚀 ${symbol} 대량 숏 청산 감지! 매수 체결: $${(buyVolume/1000000).toFixed(2)}M`);
            sendTelegramAlert(`🚀 ${symbol} 대량 숏 청산 감지!\n\n` +
                `매수 체결: $${(buyVolume/1000000).toFixed(2)}M\n` +
                `현재가: $${recentTrades[symbol][recentTrades[symbol].length-1]?.price.toLocaleString()}`);
            lastAlerts[alertKey] = now;
        }
    }
}

// ============================================
// 메인 실행
// ============================================

async function main() {
    console.log('🚀 Bybit 청산 매물대 분석기 시작');
    console.log(`📊 모니터링 심볼: ${CONFIG.symbols.join(', ')}`);
    console.log(`⏰ 업데이트 주기: ${CONFIG.updateInterval/1000}초`);
    console.log('='.repeat(60));

    // 초기 분석
    for (const symbol of CONFIG.symbols) {
        await analyzeSymbol(symbol);
    }

    // TradingView용 데이터 저장
    saveTradingViewData();

    // WebSocket 시작 (대량 체결 감지)
    startTradeWebSocket();

    // 주기적 업데이트
    setInterval(async () => {
        for (const symbol of CONFIG.symbols) {
            await analyzeSymbol(symbol);
        }
        saveTradingViewData();
    }, CONFIG.updateInterval);
}

main().catch(console.error);
