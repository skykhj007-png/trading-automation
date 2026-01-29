/**
 * 청산 히트맵 데이터 수집기
 *
 * Bybit API + Coinglass 무료 데이터를 조합하여
 * 대형 포지션 집중 구간을 추정합니다.
 *
 * 사용법: node liquidation-heatmap.js
 */

const axios = require('axios');
const fs = require('fs');

// ============================================
// 설정
// ============================================
const CONFIG = {
    symbols: ['BTCUSDT', 'ETHUSDT'],

    // Bybit API
    bybitUrl: 'https://api.bybit.com',

    // 분석 설정
    leverageLevels: [10, 25, 50, 100],

    // 출력 파일
    outputFile: './liquidation-levels-fixed.json'
};

// ============================================
// Bybit API 함수
// ============================================

// 현재가 조회
async function getTicker(symbol) {
    try {
        const response = await axios.get(`${CONFIG.bybitUrl}/v5/market/tickers`, {
            params: { category: 'linear', symbol }
        });
        return response.data.result.list[0];
    } catch (error) {
        console.error(`[ERROR] getTicker:`, error.message);
        return null;
    }
}

// 오픈 인터레스트 조회
async function getOpenInterest(symbol) {
    try {
        const response = await axios.get(`${CONFIG.bybitUrl}/v5/market/open-interest`, {
            params: { category: 'linear', symbol, intervalTime: '1h', limit: 48 }
        });
        return response.data.result.list;
    } catch (error) {
        console.error(`[ERROR] getOpenInterest:`, error.message);
        return [];
    }
}

// 최근 캔들 (고점/저점 분석용)
async function getKlines(symbol, interval = '60', limit = 100) {
    try {
        const response = await axios.get(`${CONFIG.bybitUrl}/v5/market/kline`, {
            params: { category: 'linear', symbol, interval, limit }
        });
        return response.data.result.list;
    } catch (error) {
        console.error(`[ERROR] getKlines:`, error.message);
        return [];
    }
}

// 펀딩비 조회
async function getFundingRate(symbol) {
    try {
        const response = await axios.get(`${CONFIG.bybitUrl}/v5/market/funding/history`, {
            params: { category: 'linear', symbol, limit: 10 }
        });
        return response.data.result.list;
    } catch (error) {
        console.error(`[ERROR] getFundingRate:`, error.message);
        return [];
    }
}

// 롱숏 비율 조회
async function getLongShortRatio(symbol) {
    try {
        const response = await axios.get(`${CONFIG.bybitUrl}/v5/market/account-ratio`, {
            params: { category: 'linear', symbol, period: '1h', limit: 24 }
        });
        return response.data.result.list;
    } catch (error) {
        console.error(`[ERROR] getLongShortRatio:`, error.message);
        return [];
    }
}

// ============================================
// 대형 포지션 집중 구간 추정
// ============================================

/**
 * 주요 가격대 분석
 * - 최근 고점/저점
 * - 라운드 넘버
 * - OI 급증 구간
 */
function findKeyLevels(klines, currentPrice) {
    const levels = [];
    const prices = klines.map(k => ({
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
    }));

    // 최근 고점/저점 찾기
    const highs = prices.map(p => p.high);
    const lows = prices.map(p => p.low);

    const recentHigh = Math.max(...highs.slice(0, 24));  // 24시간 고점
    const recentLow = Math.min(...lows.slice(0, 24));    // 24시간 저점
    const weekHigh = Math.max(...highs);                  // 100시간 고점
    const weekLow = Math.min(...lows);                    // 100시간 저점

    // 주요 레벨 추가
    levels.push({ price: recentHigh, type: '24H_HIGH', importance: 'high' });
    levels.push({ price: recentLow, type: '24H_LOW', importance: 'high' });
    levels.push({ price: weekHigh, type: 'WEEK_HIGH', importance: 'very_high' });
    levels.push({ price: weekLow, type: 'WEEK_LOW', importance: 'very_high' });

    // 라운드 넘버 추가
    const roundBase = currentPrice > 10000 ? 1000 : currentPrice > 1000 ? 100 : 10;
    const roundBelow = Math.floor(currentPrice / roundBase) * roundBase;
    const roundAbove = roundBelow + roundBase;

    levels.push({ price: roundBelow, type: 'ROUND_NUMBER', importance: 'medium' });
    levels.push({ price: roundAbove, type: 'ROUND_NUMBER', importance: 'medium' });

    // 추가 라운드 넘버
    levels.push({ price: roundBelow - roundBase, type: 'ROUND_NUMBER', importance: 'low' });
    levels.push({ price: roundAbove + roundBase, type: 'ROUND_NUMBER', importance: 'low' });

    return levels;
}

/**
 * 청산 레벨 계산 (주요 가격대 기준)
 */
function calculateLiquidationClusters(keyLevels, fundingRate, longShortRatio) {
    const clusters = [];
    const maintenanceMargin = 0.005;  // 0.5%

    // 펀딩비 분석: 양수면 롱 과열, 음수면 숏 과열
    const fundingBias = parseFloat(fundingRate) || 0;
    const lsRatio = parseFloat(longShortRatio) || 0.5;

    // 롱이 많으면 (펀딩비 양수, LS비율 > 0.5) → 하락 시 대량 청산
    // 숏이 많으면 (펀딩비 음수, LS비율 < 0.5) → 상승 시 대량 청산

    const longBias = fundingBias > 0 || lsRatio > 0.55;
    const shortBias = fundingBias < 0 || lsRatio < 0.45;

    for (const level of keyLevels) {
        // 고점 근처 = 숏 포지션 집중 예상
        if (level.type.includes('HIGH')) {
            for (const lev of CONFIG.leverageLevels) {
                const liqPrice = level.price * (1 + 1/lev - maintenanceMargin);
                clusters.push({
                    basePrice: level.price,
                    liqPrice: Math.round(liqPrice * 100) / 100,
                    leverage: lev,
                    positionType: 'SHORT',
                    direction: 'UP',
                    importance: level.importance,
                    reason: `${level.type} 근처 숏 포지션`,
                    riskScore: shortBias ? 80 : 50
                });
            }
        }

        // 저점 근처 = 롱 포지션 집중 예상
        if (level.type.includes('LOW')) {
            for (const lev of CONFIG.leverageLevels) {
                const liqPrice = level.price * (1 - 1/lev + maintenanceMargin);
                clusters.push({
                    basePrice: level.price,
                    liqPrice: Math.round(liqPrice * 100) / 100,
                    leverage: lev,
                    positionType: 'LONG',
                    direction: 'DOWN',
                    importance: level.importance,
                    reason: `${level.type} 근처 롱 포지션`,
                    riskScore: longBias ? 80 : 50
                });
            }
        }

        // 라운드 넘버 = 양방향 포지션
        if (level.type === 'ROUND_NUMBER') {
            // 롱 청산 (라운드 넘버 아래)
            for (const lev of [50, 100]) {
                const liqPrice = level.price * (1 - 1/lev + maintenanceMargin);
                clusters.push({
                    basePrice: level.price,
                    liqPrice: Math.round(liqPrice * 100) / 100,
                    leverage: lev,
                    positionType: 'LONG',
                    direction: 'DOWN',
                    importance: level.importance,
                    reason: `라운드 넘버 $${level.price} 롱`,
                    riskScore: longBias ? 70 : 40
                });
            }
            // 숏 청산 (라운드 넘버 위)
            for (const lev of [50, 100]) {
                const liqPrice = level.price * (1 + 1/lev - maintenanceMargin);
                clusters.push({
                    basePrice: level.price,
                    liqPrice: Math.round(liqPrice * 100) / 100,
                    leverage: lev,
                    positionType: 'SHORT',
                    direction: 'UP',
                    importance: level.importance,
                    reason: `라운드 넘버 $${level.price} 숏`,
                    riskScore: shortBias ? 70 : 40
                });
            }
        }
    }

    // 중복 제거 및 정렬
    const uniqueClusters = clusters.reduce((acc, curr) => {
        const key = `${curr.liqPrice}-${curr.positionType}`;
        if (!acc[key] || acc[key].riskScore < curr.riskScore) {
            acc[key] = curr;
        }
        return acc;
    }, {});

    return Object.values(uniqueClusters).sort((a, b) => b.riskScore - a.riskScore);
}

// ============================================
// 메인 분석
// ============================================

async function analyzeSymbol(symbol) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 ${symbol} 대형 포지션 집중 구간 분석`);
    console.log('='.repeat(60));

    // 데이터 수집
    const ticker = await getTicker(symbol);
    const klines = await getKlines(symbol, '60', 100);
    const fundingHistory = await getFundingRate(symbol);
    const lsRatio = await getLongShortRatio(symbol);

    if (!ticker || klines.length === 0) {
        console.error(`[ERROR] ${symbol} 데이터 없음`);
        return null;
    }

    const currentPrice = parseFloat(ticker.lastPrice);
    const fundingRate = fundingHistory[0]?.fundingRate || '0';
    const longRatio = lsRatio[0]?.buyRatio || '0.5';

    console.log(`\n💰 현재가: $${currentPrice.toLocaleString()}`);
    console.log(`📈 펀딩비: ${(parseFloat(fundingRate) * 100).toFixed(4)}%`);
    console.log(`⚖️ 롱 비율: ${(parseFloat(longRatio) * 100).toFixed(1)}%`);

    // 주요 가격대 분석
    const keyLevels = findKeyLevels(klines, currentPrice);

    console.log(`\n📍 주요 가격대:`);
    keyLevels.forEach(l => {
        const dist = ((l.price - currentPrice) / currentPrice * 100).toFixed(2);
        const dir = l.price > currentPrice ? '↑' : '↓';
        console.log(`   ${l.type}: $${l.price.toLocaleString()} (${dir}${Math.abs(dist)}%)`);
    });

    // 청산 클러스터 계산
    const clusters = calculateLiquidationClusters(keyLevels, fundingRate, longRatio);

    // 현재가 기준 위/아래 분리
    const clustersAbove = clusters.filter(c => c.liqPrice > currentPrice).slice(0, 10);
    const clustersBelow = clusters.filter(c => c.liqPrice < currentPrice).slice(0, 10);

    console.log(`\n🔴 현재가 아래 (롱 청산 구간):`);
    console.log('-'.repeat(50));
    clustersBelow.sort((a, b) => b.liqPrice - a.liqPrice).forEach(c => {
        const dist = ((currentPrice - c.liqPrice) / currentPrice * 100).toFixed(2);
        const marker = c.riskScore >= 70 ? '🔥' : c.riskScore >= 50 ? '⚠️' : '  ';
        console.log(`${marker} $${c.liqPrice.toLocaleString()} (-${dist}%) | ${c.leverage}x ${c.positionType} | ${c.reason}`);
    });

    console.log(`\n🟢 현재가 위 (숏 청산 구간):`);
    console.log('-'.repeat(50));
    clustersAbove.sort((a, b) => a.liqPrice - b.liqPrice).forEach(c => {
        const dist = ((c.liqPrice - currentPrice) / currentPrice * 100).toFixed(2);
        const marker = c.riskScore >= 70 ? '🔥' : c.riskScore >= 50 ? '⚠️' : '  ';
        console.log(`${marker} $${c.liqPrice.toLocaleString()} (+${dist}%) | ${c.leverage}x ${c.positionType} | ${c.reason}`);
    });

    // 가장 위험한 청산 구간
    const topRiskBelow = clustersBelow.filter(c => c.riskScore >= 70).slice(0, 3);
    const topRiskAbove = clustersAbove.filter(c => c.riskScore >= 70).slice(0, 3);

    if (topRiskBelow.length > 0 || topRiskAbove.length > 0) {
        console.log(`\n🚨 고위험 청산 구간 (대량 청산 예상):`);
        [...topRiskBelow, ...topRiskAbove].forEach(c => {
            console.log(`   💀 $${c.liqPrice.toLocaleString()} - ${c.reason}`);
        });
    }

    return {
        symbol,
        currentPrice,
        fundingRate: parseFloat(fundingRate) * 100,
        longRatio: parseFloat(longRatio) * 100,
        keyLevels,
        clustersAbove,
        clustersBelow,
        highRisk: [...topRiskBelow, ...topRiskAbove],
        timestamp: new Date().toISOString()
    };
}

// ============================================
// TradingView용 고정 레벨 출력
// ============================================

function generatePineScriptLevels(results) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 TradingView Pine Script용 고정 레벨`);
    console.log('='.repeat(60));

    for (const data of results) {
        if (!data) continue;

        console.log(`\n// === ${data.symbol} 청산 매물대 (${new Date().toLocaleDateString()}) ===`);

        // 고위험 레벨만 출력
        const topLevels = [...data.clustersBelow, ...data.clustersAbove]
            .filter(c => c.riskScore >= 60)
            .sort((a, b) => a.liqPrice - b.liqPrice);

        topLevels.forEach((c, i) => {
            const varName = c.positionType === 'LONG' ? `longLiqLevel${i+1}` : `shortLiqLevel${i+1}`;
            console.log(`${varName} = ${c.liqPrice}  // ${c.reason} (${c.leverage}x)`);
        });
    }

    // JSON 파일 저장
    const output = {
        generated: new Date().toISOString(),
        data: results
    };

    fs.writeFileSync(CONFIG.outputFile, JSON.stringify(output, null, 2));
    console.log(`\n💾 데이터 저장됨: ${CONFIG.outputFile}`);
}

// ============================================
// 메인 실행
// ============================================

async function main() {
    console.log('🚀 대형 포지션 집중 구간 분석 시작');
    console.log(`📊 분석 심볼: ${CONFIG.symbols.join(', ')}`);

    const results = [];

    for (const symbol of CONFIG.symbols) {
        const result = await analyzeSymbol(symbol);
        results.push(result);

        // API 레이트 리밋 방지
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    generatePineScriptLevels(results);

    console.log('\n✅ 분석 완료!');
}

main().catch(console.error);
