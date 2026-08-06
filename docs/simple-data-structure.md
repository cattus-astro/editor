# 심플 에디터 데이터 구조

## Document vs Page 역할

**Document** — 무엇이, 어떤 순서로 있는가. 편집(쓰기)의 대상.  
**Page** — 현재 조건(폭, 폰트, 여백)에서 어떻게 화면에 펼쳐지는가. 렌더링(읽기)의 대상.

이 둘의 관계는 항상 단방향이다.

```
Document.blocks ──파생──→ Page[]
       ↑
  편집만 여기
  (타이핑, Enter, Backspace 등)

표현 조건(창 폭, 폰트 크기)이 바뀌어도:
  Document는 그대로 → Page만 다시 계산
```

|           | Document                  | Page                      |
| --------- | ------------------------- | ------------------------- |
| 역할      | 콘텐츠 원본               | 화면 표현                 |
| 변경 시점 | 사용자가 내용을 편집할 때 | 폭·폰트 변경 또는 편집 후 |
| 사용처    | 편집, 저장, 내보내기      | 렌더링, Hit-test          |

---

## 계층 구조

```
Document
  └─ blocks: Block[]              ← 논리 원본 (편집의 기본 단위)

Page[] (Document.blocks로부터 파생)
  └─ entries: PageEntry[]
       ├─ block: Block            ← 논리 블록 참조 (노드 복사 X)
       ├─ rowRange: [start, end]  ← 이 페이지에 표시할 row 범위
       ├─ top: number             ← 페이지 내 y 시작 (캐시)
       └─ height: number          ← rowRange 해당 rows 높이 합 (캐시)

Block (Paragraph)
  └─ layout: BlockLayout
       └─ rows: Row[]
            ├─ offsetY: number    ← block top 기준 y (캐시)
            └─ fragments: RowFragment[]
                 └─ inlineRef     ← Inline 노드 참조 (데이터 복사 X)
                    startOffset   ← TextRun 내 시작 글자 인덱스
                    endOffset     ← TextRun 내 끝 글자 인덱스 (exclusive)
                    advances?     ← 글자별 x-advance (캐시)
```

---

## 타입 정의

```ts
type Block = Paragraph | Heading | Table;
type Inline = TextRun | InlineImage | LineBreak;

// ─── 논리 구조 ──────────────────────────────────────────────────────

interface Document {
  blocks: Block[];
}

interface Paragraph {
  kind: 'paragraph';
  id: number;
  children: Inline[];
  layout: BlockLayout | null; // null = dirty, 다음 렌더 시 재계산
}

interface TextRun {
  id: number;
  kind: 'textrun';
  text: string;
  style: TextStyle;
}

interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  textDecoration: 'none' | 'underline' | 'line-through';
  backgroundColor: string;
}

// Enter = 새 Paragraph 생성. LineBreak = 같은 Paragraph 안에서 강제 줄바꿈 (Shift+Enter).
// 레이아웃이 LineBreak를 만나면 현재 row를 닫고 새 row를 시작한다.
interface LineBreak {
  id: number;
  kind: 'linebreak';
}

// ─── 물리 레이아웃 (블록 단위 캐시) ────────────────────────────────

interface BlockLayout {
  rows: Row[];
  height: number; // rows 높이 합 (전체 블록 높이)
}

interface Row {
  fragments: RowFragment[];
  width: number;
  height: number;
  offsetY: number; // block top 기준 상대 y (hit-test 캐시)
  // 이 row 내 모든 fragment의 ascent 최댓값.
  // ascent = baseline 위로 올라간 거리. canvas API: ctx.measureText(text).actualBoundingBoxAscent
  //
  // 텍스트 렌더링: ctx.textBaseline = 'alphabetic' 기준으로 모든 텍스트를 같은 y에 그림.
  //   fillText(text, x, row.offsetY + row.ascent)  ← 모든 텍스트 fragment 동일
  //
  // 이미지 렌더링: drawImage는 y가 상단 기준이므로 별도 계산 필요.
  //   drawImage(img, x, row.offsetY + (row.ascent - image.height))
  //
  //  row.ascent = 22 (28px 폰트 기준)
  //  ┌──────────────────────────────┐
  //  │     │               ↑ 22px  │
  //  │Hello│  BIG TEXT     ↓       │  14px ascent=11, 28px ascent=22
  //  │─────│───────────────── baseline  (y = row.offsetY + 22)
  //  │     │  (g, y 같은 descender)│
  //  └──────────────────────────────┘
  //
  // 폰트 크기가 단일 종류라면 생략 가능.
  ascent: number;
}

interface RowFragment {
  inlineRef: Inline;
  startOffset: number; // TextRun 내 시작 글자 인덱스
  endOffset: number; // TextRun 내 끝 글자 인덱스 (exclusive)
  width: number;
  left: number; // row 내 x 시작 (hit-test 캐시)
  advances?: number[]; // 글자별 x-advance (character hit-test 캐시)
}

// ─── 물리 페이지 (Document에 저장하지 않고 렌더 시 파생) ────────────

interface Page {
  entries: PageEntry[];
  height: number; // 이 페이지의 물리 높이 (고정값, 예: A4 = 1123px)
}

interface PageEntry {
  block: Block;
  rowRange: [start: number, end: number]; // inclusive
  top: number; // 페이지 내 블록 y 시작 (캐시)
  height: number; // rowRange 해당 rows 높이 합 (캐시)
}
```

---

## 핵심 개념: children vs layout.rows

`children`은 **논리** — 스타일 경계로 나뉜 콘텐츠 원본.  
`layout.rows`는 **물리** — 화면 폭에 맞게 word-wrap된 줄 단위 슬라이스.

폭이 바뀌면 `layout`만 재계산하고 `children`은 그대로 유지된다.

### TextRun 하나가 두 줄에 걸칠 때

```
Paragraph {
  children: [TextRun { text: "Hello World", id: 1 }]
  layout: {
    rows: [
      Row { offsetY: 0,  height: 22,
            fragments: [{ inlineRef: TextRun#1, startOffset: 0, endOffset: 6,  width: 80, left: 0 }] },
      Row { offsetY: 22, height: 22,
            fragments: [{ inlineRef: TextRun#1, startOffset: 6, endOffset: 11, width: 60, left: 0 }] },
    ]
  }
}
// TextRun 노드는 하나. fragment가 각 줄의 구간(startOffset~endOffset)을 가리킴.
```

### 한 줄에 여러 스타일이 섞일 때

```
"Hello bold World"

Paragraph {
  children: [
    TextRun { id:1, text: "Hello " },          // 보통
    TextRun { id:2, text: "bold",  bold:true }, // 굵게
    TextRun { id:3, text: " World" },           // 보통
  ]
  layout: {
    rows: [
      Row { offsetY: 0, height: 22, fragments: [
        { inlineRef: TextRun#1, startOffset:0, endOffset:6, width:52, left:0  },
        { inlineRef: TextRun#2, startOffset:0, endOffset:4, width:38, left:52 },
        { inlineRef: TextRun#3, startOffset:0, endOffset:6, width:48, left:90 },
      ]}
    ]
  }
}
```

---

## 페이지 경계 처리

블록 노드는 절대 분할하지 않는다.  
한 블록이 두 페이지에 걸치면, 두 PageEntry가 같은 블록 노드를 참조하고 `rowRange`만 다르게 가진다.

```
Paragraph P: 12 rows, 각 22px → 총 264px
페이지 높이: 200px

Page 1:
  PageEntry { block: P, rowRange: [0, 8],  top: 0, height: 198 }
                                                    // row 0~8 = 198px

Page 2:
  PageEntry { block: P, rowRange: [9, 11], top: 0, height: 66  }
             // ↑ 같은 P 노드 참조               // row 9~11 = 66px
```

편집으로 P의 내용이 바뀌면 `P.layout = null`로 dirty 처리하고, 페이지를 다시 구성하면 row 분배가 자동으로 갱신된다.

---

## Hit-test 흐름

페이지마다 별도 캔버스를 사용하므로, 어느 페이지인지는 이벤트가 발생한 캔버스로 결정된다.  
hit-test는 해당 캔버스의 `Page` 하나를 대상으로만 실행한다.

**입력:** `(page, clickX, clickY)` — 이벤트 발생한 페이지, 캔버스 내 좌표  
**출력:** `{ inlineId: number, offset: number }` — 어느 Inline의 몇 번째 글자 앞인지

```
 (clickX, clickY)  ← 이벤트 발생한 캔버스 기준 좌표
       │
       ▼
 ┌─────────────────────────────────────────────────────┐
 │ Step 1. 어느 블록(PageEntry)?                        │
 │ 사용: entry.top, entry.height                        │
 └──────────────────────────┬──────────────────────────┘
                            │ blockY = clickY - entry.top
                            ▼
 ┌─────────────────────────────────────────────────────┐
 │ Step 2. 어느 Row?                                    │
 │ 사용: row.offsetY, row.height (이진 탐색 가능)        │
 └──────────────────────────┬──────────────────────────┘
                            │ rowX = clickX - BLOCK_LEFT
                            ▼
 ┌─────────────────────────────────────────────────────┐
 │ Step 3. 어느 Fragment?                               │
 │ 사용: frag.left, frag.width                          │
 └──────────────────────────┬──────────────────────────┘
                            │ fragX = rowX - frag.left
                            ▼
 ┌─────────────────────────────────────────────────────┐
 │ Step 4. 어느 글자?                                   │
 │ 사용: frag.advances, frag.startOffset                │
 └──────────────────────────┬──────────────────────────┘
                            │ charOffset
                            ▼
              { inlineId, offset: startOffset + charOffset }
```

### 각 단계 코드

```ts
function hitTest(
  page: Page,
  clickX: number,
  clickY: number,
  blockLeftMargin: number,
): { inlineId: number; offset: number } | null {

  // ── Step 1: 블록(PageEntry) ───────────────────────────────────────
  let targetEntry: PageEntry | null = null;
  let blockY = -1;
  for (const entry of page.entries) {
    if (clickY >= entry.top && clickY < entry.top + entry.height) {
      targetEntry = entry;
      blockY = clickY - entry.top;
      break;
    }
  }
  if (!targetEntry || !targetEntry.block.layout) return null;

  // ── Step 2: Row (offsetY로 이진 탐색) ────────────────────────────
  const { rows } = targetEntry.block.layout;
  const [rStart, rEnd] = targetEntry.rowRange;
  let targetRow: Row | null = null;
  let lo = rStart, hi = rEnd;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const row = rows[mid];
    if (blockY < row.offsetY)                    hi = mid - 1;
    else if (blockY >= row.offsetY + row.height) lo = mid + 1;
    else { targetRow = row; break; }
  }
  if (!targetRow) return null;
  const rowX = clickX - blockLeftMargin;

  // ── Step 3: Fragment ─────────────────────────────────────────────
  let targetFrag: RowFragment | null = null;
  for (const frag of targetRow.fragments) {
    if (rowX >= frag.left && rowX < frag.left + frag.width) {
      targetFrag = frag;
      break;
    }
  }
  // 줄 끝 빈 공간 클릭 → 마지막 fragment로
  if (!targetFrag) targetFrag = targetRow.fragments.at(-1) ?? null;
  if (!targetFrag) return null;
  const fragX = rowX - targetFrag.left;

  // ── Step 4: 글자 offset ──────────────────────────────────────────
  let charOffset = 0;
  if (targetFrag.advances) {
    let cum = 0;
    const count = targetFrag.endOffset - targetFrag.startOffset;
    for (let i = 0; i < count; i++) {
      const adv = targetFrag.advances[i];
      if (fragX < cum + adv / 2) { charOffset = i;     break; }
      if (fragX < cum + adv)     { charOffset = i + 1; break; }
      cum += adv;
      if (i === count - 1) charOffset = count; // 마지막 글자 뒤
    }
  }

  // ── Step 5: 커서 위치 반환 ───────────────────────────────────────
  return {
    inlineId: (targetFrag.inlineRef as TextRun).id,
    offset: targetFrag.startOffset + charOffset,
  };
}
```

### 캐시 필드 요약

| 단계              | 사용 캐시                   | 없으면                        |
| ----------------- | --------------------------- | ----------------------------- |
| Step 1 (블록)     | `entry.top`, `entry.height` | rowRange의 rows 높이 합산     |
| Step 2 (row)      | `row.offsetY`               | 앞 rows 높이 누적 계산 (선형) |
| Step 3 (fragment) | `frag.left`                 | 앞 fragments width 누적 계산  |
| Step 4 (글자)     | `frag.advances`             | 근사값만 가능                 |

캐시 필드는 layout 계산 시 함께 채워진다. `layout = null`로 dirty 처리되면 해당 블록의 캐시 전체가 무효화된다.
