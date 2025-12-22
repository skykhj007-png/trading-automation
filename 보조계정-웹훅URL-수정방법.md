# 보조계정 웹훅 URL 수정 방법

## 🔴 문제
현재 웹훅 URL이 개발 버전(`/dev`)이라 TradingView 신호가 도착하지 않습니다.

**잘못된 URL**:
```
https://script.google.com/macros/s/AKfycbymZPNnPvdf9MirGIOr138iuIpdUrAxhf2lI72I_bU/dev
```

**올바른 URL** (배포 버전 필요):
```
https://script.google.com/macros/s/.../exec
```

---

## ✅ 해결 방법 (3단계)

### 1단계: Apps Script에서 새 배포 생성

1. **Apps Script 에디터** 열기
   - https://script.google.com
   - 보조계정 프로젝트 선택

2. **배포** → **새 배포** 클릭

3. **설정**:
   ```
   유형 선택: ⚙️ 클릭 → "웹 앱" 선택

   설명: 보조계정 배포 - 2025-12-21

   실행 계정: 나

   액세스 권한: 모든 사용자  ← ⚠️ 중요!
   ```

4. **배포** 버튼 클릭

5. **웹 앱 URL 복사**
   ```
   https://script.google.com/macros/s/AKfycb.../exec  ← /exec 확인!
   ```

---

### 2단계: TradingView 알림 수정

1. **TradingView 차트** 열기

2. **알림** (종 아이콘) 클릭

3. **보조계정 알림 찾기**
   - 이름: "클로드25 보조계정" 또는 비슷한 이름

4. **...** (점 3개) → **편집** 클릭

5. **웹훅 URL 수정**
   - 기존 URL 지우기
   - 1단계에서 복사한 **새 URL 붙여넣기**
   - `/exec`로 끝나는지 확인!

6. **저장** 클릭

---

### 3단계: 테스트

#### 3-1. 브라우저 테스트
새 웹 앱 URL을 브라우저에서 열기:
```
https://script.google.com/macros/s/AKfycb.../exec
```

**예상 결과**:
```json
{
  "status": "ok",
  "message": "클로드25 V27 웹훅 서버 작동 중",
  "timestamp": "2025-12-21 ..."
}
```

#### 3-2. TradingView 신호 대기
- 1분봉 차트로 변경
- 신호 발생 대기 (1-5분 이내)

#### 3-3. Apps Script 로그 확인
```
Apps Script → 실행 → 실행 로그
"Webhook 수신" 메시지 있는지 확인
```

---

## 📋 체크리스트

- [ ] Apps Script → 배포 → 새 배포
- [ ] 유형: 웹 앱, 액세스: "모든 사용자"
- [ ] 웹 앱 URL 복사 (반드시 /exec로 끝남)
- [ ] TradingView 알림 편집
- [ ] 새 URL 붙여넣기
- [ ] 저장
- [ ] 브라우저에서 URL 테스트 ({"status":"ok"} 확인)
- [ ] TradingView 신호 대기
- [ ] Apps Script 로그에서 "Webhook 수신" 확인

---

## ⚠️ 주의사항

### 1. 반드시 /exec 버전 사용
```
✅ https://script.google.com/macros/s/.../exec
❌ https://script.google.com/macros/s/.../dev
```

### 2. 액세스 권한
```
✅ 모든 사용자
❌ 나만
```

"나만" 선택하면 외부 웹훅 차단됩니다!

### 3. 메인 vs 보조 계정
- 메인 계정: 메인 웹 앱 URL
- 보조 계정: 보조 웹 앱 URL (지금 만든 것)
- 각각 **다른 URL**입니다!

---

## 🔍 배포 버전 확인 방법

### 배포 관리에서 확인:
```
Apps Script → 배포 → 배포 관리
```

**활성 배포 목록**:
- 버전 1 (2025-12-21) - 웹 앱
- URL: https://script.google.com/.../exec

"테스트 배포"와 "정식 배포"가 다릅니다.
- 테스트: /dev
- 정식: /exec ← 이것 사용!

---

## 🎯 완료 후 확인

### 신호 발생 시 확인할 것:
```
1. 신호기록 시트에 새 행 추가됨
2. Apps Script 로그: "Webhook 수신"
3. 1분 후 Bitget 포지션 생성
4. V25 자동매매일지에 진입 기록
```

---

## 🆘 여전히 안 되면?

### Apps Script 실행 로그 확인:
```
실행 → 실행 로그
최근 실행 내역에서:
- "Webhook 수신" 있음? → 트리거 문제
- "Webhook 수신" 없음? → URL 문제
```

### TradingView 알림 로그:
```
알림 → 로그
웹훅 전송 성공 여부 확인
```

---

## 요약

```
문제: /dev 개발 버전 URL 사용 중
     ↓
해결: /exec 배포 버전 URL 필요
     ↓
방법:
  1. 배포 → 새 배포 (웹 앱)
  2. URL 복사 (/exec 확인)
  3. TradingView 알림에 새 URL 설정
     ↓
완료: 자동매매 작동!
```
