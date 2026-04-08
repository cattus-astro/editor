## 캔버스 텍스트 스타일 속성 정리

| 스타일 | CSS 속성 | Canvas API | 비고 |
|---|---|---|---|
| **폰트 패밀리** | `font-family` | `ctx.font` | |
| **글자 크기** | `font-size` | `ctx.font` | |
| **굵기** | `font-weight` | `ctx.font` | |
| **이탤릭** | `font-style` | `ctx.font` | |
| **색상** | `color` | `ctx.fillStyle` | |
| **밑줄 / 취소선** | `text-decoration` | `ctx.fillRect()`로 직접 그리기 | |
| **배경색 (하이라이트)** | `background-color` | `ctx.fillRect()`로 글자 뒤에 그리기 | |
| **텍스트 정렬** | `text-align` | `ctx.textAlign` | |
| 자간 (글자 간격) | `letter-spacing` | `ctx.letterSpacing` | 최신 브라우저만 지원 (Chrome 99+, Safari 17.4+). 미지원 시 글자를 한 자씩 그리며 직접 계산 |
| 행간 (줄 높이) | `line-height` | 직접 계산 필요 | |
| 세로 정렬 기준 | `vertical-align` | `ctx.textBaseline` | |
| 윗첨자 / 아래첨자 | `vertical-align` | y좌표 조정 + 글자 크기 축소 | |
| 글자 윤곽선 | `-webkit-text-stroke` | `ctx.strokeStyle` + `ctx.strokeText()` | |
| 그림자 | `text-shadow` | `ctx.shadowColor/Blur/OffsetX/OffsetY` | |
| 투명도 | `opacity` | `ctx.globalAlpha` | |
| 단어 간격 | `word-spacing` | `ctx.wordSpacing` | 최신 브라우저만 지원 (Chrome 99+, Safari 17.4+) |
| 텍스트 방향 | `direction` | `ctx.direction` | |
| 커닝 (폰트 내장 자간) | `font-kerning` | `ctx.fontKerning` | 최신 브라우저만 지원. 한글은 거의 영향 없음 |

---

## ctx.measureText() 반환값 (TextMetrics) 정리

`ctx.measureText(text)`는 `TextMetrics` 객체를 반환한다. 모든 값의 단위는 CSS px.

### 너비 관련

| 프로퍼티 | 설명 |
|---|---|
| `width` | advance width. 다음 글자 시작점까지의 거리. 글리프 실제 크기와 다를 수 있음 |
| `actualBoundingBoxLeft` | 정렬점 → 글리프 잉크 왼쪽 끝까지 거리 |
| `actualBoundingBoxRight` | 정렬점 → 글리프 잉크 오른쪽 끝까지 거리 |

- 실제 잉크 폭 = `actualBoundingBoxLeft + actualBoundingBoxRight`
- 이탤릭 등에서 `width`와 다를 수 있음 (글리프가 advance width 밖으로 삐져나옴)

### 높이 관련 — baseline 위쪽 (양수 = 위)

| 프로퍼티 | 설명 |
|---|---|
| `actualBoundingBoxAscent` | baseline → 실제 글리프 최상단 |
| `fontBoundingBoxAscent` | baseline → 폰트 메트릭 기준 최상단 (글리프 무관, 폰트 고정값) |
| `alphabeticBaseline` | 정렬 baseline → alphabetic baseline 거리 (보통 0) |
| `hangingBaseline` | 정렬 baseline → hanging baseline (데바나가리 등) |
| `ideographicBaseline` | 정렬 baseline → ideographic baseline (CJK 하단 정렬선) |

### 높이 관련 — baseline 아래쪽 (양수 = 아래)

| 프로퍼티 | 설명 |
|---|---|
| `actualBoundingBoxDescent` | baseline → 실제 글리프 최하단 (g, p 등 descender) |
| `fontBoundingBoxDescent` | baseline → 폰트 메트릭 기준 최하단 (폰트 고정값) |

### `actual~` vs `fontBoundingBox~`

- **`actual~`**: 주어진 텍스트의 실제 글리프가 차지하는 영역. 텍스트마다 달라짐
- **`fontBoundingBox~`**: 폰트 자체가 정의한 최대 영역. 어떤 텍스트든 동일

### 용도별 사용 가이드

| 용도 | 사용할 값 |
|---|---|
| 글자 배치 (x 좌표 누적) | `width` |
| 줄 높이 (균일한 높이) | `fontBoundingBoxAscent + fontBoundingBoxDescent` |
| 커서 위치 → 글자 인덱스 변환 | `width` 누적값으로 이진 탐색 |
| 선택 영역 하이라이트 (에디터 스타일) | `width` + `fontBoundingBox~` (균일한 블록) |
| 글리프에 딱 맞는 배경/히트 테스트 | `actualBoundingBox~` |
| 텍스트 잘림(overflow) 감지 | `actualBoundingBoxRight` |

---

## 텍스트 좌표 기준점 설정

`fillText(text, x, y)`의 (x, y)가 글자의 어느 부분을 가리키는지 설정하는 속성:

### textBaseline — y 기준점

| 값 | 설명 |
|---|---|
| `'alphabetic'` | **(기본값)** 라틴 문자 baseline. y가 글자 하단 기준 |
| `'top'` | em square 상단. y가 글자 상단 기준 |
| `'hanging'` | hanging baseline (데바나가리 등) |
| `'middle'` | em square 중앙 |
| `'ideographic'` | ideographic baseline (CJK 하단) |
| `'bottom'` | em square 하단 |

### textAlign — x 기준점

| 값 | 설명 |
|---|---|
| `'left'` | **(기본값에 가까움, 실제 기본값은 `'start'`)** x가 텍스트 왼쪽 시작점 |
| `'right'` | x가 텍스트 오른쪽 끝 |
| `'center'` | x가 텍스트 중앙 |
| `'start'` | **(기본값)** 텍스트 방향(direction)에 따라 시작점 (LTR이면 left) |
| `'end'` | 텍스트 방향에 따라 끝점 |

### 좌측 상단을 기준점으로 만들기

```typescript
ctx.textBaseline = 'top';
ctx.textAlign = 'left';
ctx.fillText('Hello', 100, 50); // (100, 50)이 글자의 좌측 상단
```

---

1. 사용자가 페이지내부 어느 곳을 클릭했을 때, 커서를 어느곳에 위치 시킬지에 대한 고민
