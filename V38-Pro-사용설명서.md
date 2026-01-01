# V38 MTF Confluence Pro 사용설명서

## 설치
1. TradingView 접속
2. Pine Editor 열기
3. `매매지표-V38-MTFConfluence.pine` 코드 붙여넣기
4. 저장 후 차트에 추가

---

## 기본 설정

| 설정 | 옵션 | 설명 |
|------|------|------|
| 거래 모드 | 선물/현물/주식 | 현물/주식: SHORT 숨김 |
| 화면 모드 | 전체/최소화/테이블만 | 최소화: Smart Trail + 시그널만 |
| 시그널 표시 | 전체/STRONG 이상/SUPER만 | 시그널 필터링 |

---

## 테이블 읽는 법

| 열 | 의미 |
|----|------|
| 추세 | UP/DN (EMA9 vs EMA21) |
| EMA | UP! = 강한상승(9>21>50), up = 약한상승 |
| MACD | BULL/BEAR |
| Vol | 거래량 배수 (1.5x 이상 = 급증) |

---

## 시그널

| 표시 | 의미 | 신뢰도 |
|------|------|--------|
| 하늘색 다이아몬드 | SUPER LONG | 최고 |
| 노란 큰 삼각형 | STRONG LONG | 높음 |
| 초록 삼각형 | LONG | 중간 |
| 빨간 X | EXIT LONG (청산) | - |
| 주황 원 | Trail Warning | - |
| 분홍 삼각형 | SHORT (선물만) | 낮음 |

---

## SMC 기능

| 표시 | 의미 |
|------|------|
| 초록 박스 | Bullish Order Block (매수 영역) |
| 빨강 박스 | Bearish Order Block (매도 영역) |
| 청록 점선 박스 | Bullish FVG (갭 상승) |
| 적갈색 점선 박스 | Bearish FVG (갭 하락) |
| BOS+ / BOS- | 구조 돌파 (추세 지속) |
| CHoCH+ / CHoCH- | 추세 전환 |
| 라임/빨강 선 | Smart Trail (트레일링 스탑) |
| EQH / EQL | Equal High/Low (유동성 타겟) |

---

## 등급 시스템

| 등급 | 점수 | 의미 |
|------|------|------|
| S | 22+ | 최고 (모든 조건 충족) |
| A+ | 22+ | 매우 강력 |
| A | 19+ | 강력 |
| B+ | 16+ | 좋음 |
| B | 15+ | 진입 가능 |
| C | 15 미만 | 대기 |

---

## LONG 진입 체크리스트

```
[ ] 등급: B+ 이상 (16점+)
[ ] 1H/4H: UP
[ ] 위치: 20% 이하 (지지선 근처)
[ ] Vol: 2개 TF 이상 급증
[ ] Smart Trail: LONG (라임색)
[ ] Zone: DISCOUNT
```

---

## 권장 설정

| 항목 | 권장값 |
|------|--------|
| 타임프레임 | 15분 / 1시간 |
| 거래량 급증 배수 | 1.5x |
| 거래량 폭증 배수 | 2.5x |

---

## 설정 옵션

### 표시 설정
- 지지/저항, HTF 추세, EMA, 볼린저밴드, 다이버전스, 테이블, 라벨

### SMC 설정
- Order Blocks, FVG, BOS/CHoCH, Smart Trail, Liquidity Levels

---

## 청산 시그널

| 시그널 | 조건 | 대응 |
|--------|------|------|
| EXIT LONG (빨간 X) | Smart Trail SHORT 전환 + 점수 15 미만 | 즉시 청산 |
| Trail Warning (주황 원) | Smart Trail SHORT 전환 | 모니터링, 부분 청산 고려 |

---

## 주의사항

1. **LONG만 권장** - SHORT는 승률 낮음
2. **HTF 확인 필수** - 1H/4H 추세 일치 시 승률 상승
3. **거래량 확인** - MTF 거래량 급증 시 신뢰도 상승
4. **지지선 근처** - 위치 20% 이하에서 진입
5. **청산 시그널 주의** - EXIT LONG 발생 시 즉시 대응

---

## 알림 설정

TradingView에서 알림 설정:
1. 차트 우클릭 → "알림 추가"
2. 조건: "V38 MTF Confluence Pro" 선택
3. 알림 종류 선택

### 알림 유형
- **SUPER LONG**: 최고 등급 진입 시그널
- **STRONG LONG**: 강력 진입 시그널
- **LONG**: 일반 진입 시그널
- **EXIT LONG**: 즉시 청산 권장
- **Trail Warning**: 모니터링 필요

---

*V38 Pro - 2025.01*
