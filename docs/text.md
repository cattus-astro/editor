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

1. 사용자가 페이지내부 어느 곳을 클릭했을 때, 커서를 어느곳에 위치 시킬지에 대한 고민
