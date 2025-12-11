# V25 트레이딩 시스템 현재 상태

## 최종 업데이트: 2025-12-10

---

## 완료된 작업

### 1. TradingView 전략 (Pine Script)
- **파일**: `TradingView-Claude25-Universal.pine`
- **기능**: 선물/현물코인/주식 모드 지원
- **신호**: LONG/SHORT/EXIT
- **점수**: 28점 만점 (불장단타왕 10 + 클로드21 8 + 필터 6 + 고래 4)

### 2. 구글 앱스크립트 (Google Apps Script)
- **파일**: `Code.gs`
- **시트 ID**: `1dlntPV_LY_1RrCCpmkW3zw5dpcA_dMhVDkjd90QcI7E`

#### 주요 기능:
- Webhook으로 TradingView 신호 수신
- 가상매매 $100 시뮬레이션
- **자동 가격 모니터링** (1분마다 Binance API로 체크)
- TP1/TP2/SL 자동 감지 및 기록
- 승률/수익률 자동 계산

#### 청산 유형:
| 상황 | 기록 | 승패 |
|------|------|------|
| TP1 도달 | ✅ 1차익절 | 승 |
| TP1 → TP2 | ✅✅ 2차익절 | 승 |
| TP1 → SL | ⚠️ 1차익절→손절 | 승 |
| 바로 SL | ❌ 손절 | 패 |

### 3. 구글시트 구조
- **신호기록**: 모든 신호 기록
- **V25 자동매매일지**: 청산 결과, 잔고, 수익률
- **통계**: 승률, 총수익률, 승/패 카운트

---

## 앱스크립트 주요 함수

```javascript
// 자동 모니터링 시작 (필수!)
startAutoMonitoring()

// 자동 모니터링 중지
stopAutoMonitoring()

// 트리거 상태 확인
checkTriggerStatus()

// 현재 포지션 확인
checkPosition()

// 포지션 강제 삭제
forceClosePosition()

// 현재 BTC 가격 확인
testGetPrice()

// 시뮬레이션 리셋 ($100 새로 시작)
resetSimulation()
```

---

## 모드별 TP/SL 설정

| 모드 | TP1 | TP2 | SL | SHORT |
|------|-----|-----|-----|-------|
| 선물 | 0.8% | 1.5% | 0.3% | O |
| 현물코인 | 1.5% | 3.0% | 1.0% | X |
| 주식 | 2.0% | 4.0% | 1.5% | X |

---

## 다음 작업 예정

### Bitget 자동매매 연동 (나중에)
1. Bitget API 키 발급
2. API 연동 코드 추가
3. 실제 주문 실행 기능
4. 소액 테스트 후 운용

---

## 파일 목록

```
C:\Users\skykh\trading-automation\
├── TradingView-Claude25-Universal.pine  (최신 전략)
├── Code.gs                               (구글 앱스크립트)
├── README-V25-상태.md                    (이 파일)
└── versions/
    ├── TradingView-Claude21-MultiTF.pine
    ├── TradingView-Claude22-MultiTF-StochRSI.pine
    ├── TradingView-Claude23-MultiTF-StochRSI-BB.pine
    └── TradingView-Claude24-MultiTF-StochRSI-BB-SmartMoney.pine
```

---

## 이어서 작업할 때

1. 이 파일 불러오기: `TradingView-Claude25-Universal.pine` 또는 `Code.gs`
2. 구글시트 확인: https://docs.google.com/spreadsheets/d/1dlntPV_LY_1RrCCpmkW3zw5dpcA_dMhVDkjd90QcI7E
3. 앱스크립트: https://script.google.com (해당 프로젝트 열기)
