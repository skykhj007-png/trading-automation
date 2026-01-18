# Pine Script v5 구문 규칙 (오류 방지 가이드)

---

## ✅ 필수 체크리스트

작성 전/후 반드시 확인:

### 1. 함수 정의
- ❌ `bool myFunction(int x) => x > 0`
- ✅ `myFunction(int x) => x > 0`
- **규칙: 반환 타입 명시 금지**

### 2. 변수 중복 정의
- ❌ 같은 변수를 여러 곳에서 정의
```pinescript
atrPeriod = input.int(14, ...)  // 87번 줄
atrPeriod = 14                   // 671번 줄 - 오류!
```
- ✅ input으로 정의된 변수는 재정의 금지

### 3. 변수 이름 충돌
- ❌ 같은 이름을 다른 용도로 사용
```pinescript
atrValue = ta.atr(14)      // Smart Trail용
atrValue = ta.atr(atrPeriod)  // V40 필터용 - 충돌!
```
- ✅ 용도별로 다른 이름 사용
```pinescript
atrValueForTrail = ta.atr(14)       // Smart Trail용
atrValue = ta.atr(atrPeriod)        // V40 필터용
```

### 4. 배열 선언
- ✅ `var box[] boxes = array.new_box(0)`
- ✅ `var float[] prices = array.new_float(20, 0.0)`
- **규칙: var 타입[] 변수명 = array.new_타입()**

### 5. if/else 구조
- ❌ 중복된 코드 블록
```pinescript
if condition
    // 코드
else
    // 코드

// 이전 else 블록 계속 - 오류!
if otherCondition
    // 중복 코드
```
- ✅ else 블록 완료 후 새로운 if 시작

### 6. 변수 선언 타입
- ✅ `var float x = 0.0`
- ✅ `float y = ta.atr(14)`
- ✅ `bool condition = close > open`
- **규칙: var는 상태 유지, 일반 선언은 매 바마다 계산**

---

## 🔍 작성 후 필수 검증

### 1. 중복 정의 검사
```bash
grep -n "^변수명 =" 파일명
```
- 같은 변수가 여러 줄에 나오면 오류

### 2. 함수 정의 검사
```bash
grep -n "bool.*(" 파일명 | grep "=>"
```
- 결과가 있으면 오류 (함수 정의에 bool 제거)

### 3. 배열 문법 검사
```bash
grep -n "var.*\[\]" 파일명
```
- `var type[] name = array.new_type()` 형식 확인

---

## 🚨 자주 발생하는 오류

### 오류 1: 함수 반환 타입
```pinescript
// ❌ 오류
bool isGreen(float price) => price > 0

// ✅ 정답
isGreen(float price) => price > 0
```

### 오류 2: input 변수 재정의
```pinescript
// ❌ 오류
length = input.int(14, title="Length")
length = 20  // 재정의 불가!

// ✅ 정답
length = input.int(14, title="Length")
// length는 더 이상 정의하지 않음
```

### 오류 3: 변수 스코프
```pinescript
// ❌ 오류
if condition
    float x = 10
// x는 if 블록 밖에서 사용 불가

// ✅ 정답
float x = na
if condition
    x := 10
// x는 if 블록 밖에서 사용 가능
```

### 오류 4: := vs =
```pinescript
var float total = 0.0

// ❌ 오류
total = total + 1  // 새로운 변수 생성

// ✅ 정답
total := total + 1  // 기존 변수 업데이트
```

### 오류 5: 문자열 대체
```bash
# ❌ 전체 대체 위험
sed -i 's/atrValue/atrValueNew/g' file.pine

# 특정 변수만 선택적으로 변경
```

---

## 📋 Pine Script v5 타입 시스템

### 기본 타입
```pinescript
int x = 10
float y = 10.5
bool z = true
string s = "text"
color c = color.red
```

### 특수 타입
```pinescript
line l = line.new(...)
label lb = label.new(...)
box b = box.new(...)
table t = table.new(...)
```

### 배열
```pinescript
var int[] intArray = array.new_int(10, 0)
var float[] floatArray = array.new_float(0)
var box[] boxes = array.new_box(0)
```

---

## 🎯 V40 작성 시 적용한 규칙

### 1. 변수 분리
```pinescript
// Smart Trail용
float atrValueForTrail = ta.atr(atrPeriod)

// V40 필터용
float atrValue = ta.atr(atrPeriod)
```

### 2. 함수 정의
```pinescript
// ✅ 타입 없이 정의
strongCloseAbove(float level) => close > level and close > open
strongCloseBelow(float level) => close < level and close < open
```

### 3. 중복 제거
```pinescript
// ❌ 중복된 BOS 코드 제거
// else 블록 완료 후 "이전 else 블록 계속" 주석과 함께 나온 코드 삭제
```

### 4. input 변수 재사용
```pinescript
// ✅ input 정의
atrPeriod = input.int(14, title="ATR 기간", ...)

// ✅ 다른 곳에서 사용만
float atr = ta.atr(atrPeriod)  // 재정의 없이 사용
```

---

## 🔧 디버깅 명령어

### 중복 정의 찾기
```bash
# 변수명 중복 체크
grep -n "^atrPeriod\s*=" 파일명

# 함수 정의 오류 체크
grep -n "bool.*(" 파일명 | grep "=>"
```

### 변수 사용 추적
```bash
# 특정 변수 사용 위치 확인
grep -n "atrValue" 파일명
```

### 배열 문법 체크
```bash
# 배열 선언 확인
grep -n "var.*\[\].*=" 파일명
```

---

## 💡 베스트 프랙티스

### 1. 명명 규칙
```pinescript
// 용도별 접미사 사용
atrValueForTrail    // Smart Trail용
atrValueForFilter   // 필터용
atrValueForStop     // 손절용
```

### 2. 주석 활용
```pinescript
// V40: 새로운 기능
// atrPeriod는 V40 설정에서 정의됨
// 재정의 금지!
```

### 3. 코드 블록 명확히
```pinescript
// ============================================
// V40 필터 시스템
// ============================================

// 1. 동적 파라미터
float atrValue = ta.atr(atrPeriod)

// 2. 쿨다운 시스템
var int lastSignalBar = 0
```

---

## 🎓 학습 포인트

### Pine Script는 JavaScript가 아님
- `const`, `let`, `var`의 개념이 다름
- `var`는 상태 유지 변수 (Pine Script 전용)
- 함수 정의에 타입 명시 불가

### 재할당 규칙
```pinescript
x = 10      // 새 변수 (매 바마다)
x := 10     // 기존 var 변수 업데이트
```

### 스코프 규칙
```pinescript
// 전역
float global = 10

if condition
    // 로컬 (if 블록 내부)
    float local = 20
    global := 30  // 전역 업데이트
```

---

## 📝 작성 전 체크리스트

- [ ] 함수 정의에 반환 타입 없는가?
- [ ] input 변수 재정의하지 않았는가?
- [ ] 같은 변수명 중복 사용 안 했는가?
- [ ] var 변수 업데이트 시 `:=` 사용했는가?
- [ ] 배열 선언 문법 `var type[]` 맞는가?
- [ ] if/else 블록 중복 없는가?

---

## 🔄 앞으로 적용할 원칙

1. **작성 전**: 변수명 충돌 검사
2. **작성 중**: 주석으로 용도 명시
3. **작성 후**: grep으로 중복 정의 검사
4. **커밋 전**: 전체 구문 재검토

---

*이 규칙을 따르면 Pine Script 오류 0%*
*V40 개발 경험을 토대로 작성*
