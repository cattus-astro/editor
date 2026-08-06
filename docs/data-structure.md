# 트리 기반 캔버스 에디터 설계 노트

ProseMirror/Slate 류의 document tree를 캔버스 렌더링과 결합한 에디터를 새로 만들 때의 데이터 구조 설계와 클릭 hit-test 알고리즘.

## 목차

1. [데이터 구조 설계](#1-데이터-구조-설계)
2. [children vs layout.rows 의 차이](#2-children-vs-layoutrows-의-차이)
3. [마우스 클릭 → 커서 위치 계산](#3-마우스-클릭--커서-위치-계산)
4. [layout 측정 전략 (measureText)](#4-layout-측정-전략-measuretext)
5. [입력 → 렌더 흐름 (dirty / lazy 재계산)](#5-입력--렌더-흐름-dirty--lazy-재계산)
6. [페이지 경계 처리: 블록은 분할하지 않는다](#6-페이지-경계-처리-블록은-분할하지-않는다)
7. [구조의 복잡도 평가](#7-구조의-복잡도-평가)

---

## 1. 데이터 구조 설계

### 핵심 원칙

> **Row는 글로벌하게 두지 않고, leaf block 노드의 `layout` 속성에 둔다. Inline은 character-per-node 금지 — 반드시 string run으로. Row는 inline 데이터를 복사하지 말고 `RowFragment`로 ref만 가져라. Page는 저장하지 말고 매 render마다 per-block layout을 walk해서 재구성한다. 편집 시 dirty 전파는 "가장 가까운 leaf block의 layout = null"로 끝낸다.**

### 트리 모양

```
Document
 ├─ blocks: Block[]
     ├─ Paragraph { children: Inline[], layout: BlockLayout | null }
     ├─ Heading   { children: Inline[], layout: BlockLayout | null }
     ├─ Table     { rows: TableRow[] }
     │    └─ TableRow { cells: TableCell[] }
     │           └─ TableCell { blocks: Block[] }   ← 재귀: 셀 내부도 mini-document
     ├─ List      { items: ListItem[] }
     │    └─ ListItem { blocks: Block[] }            ← 재귀
     ├─ ImageBlock { src, width, height }
     └─ PageBreak
```

Inline 레벨:

```
Inline = TextRun | InlineImage | Hyperlink | Latex | LineBreak

TextRun { text: string, style: Style }   ← string run, 1글자 1노드 X
```

### 자료구조 정의 (TS)

```ts
// === 논리 트리 ===
type Block = Paragraph | Heading | Table | List | ImageBlock | PageBreak;
type Inline = TextRun | InlineImage | Latex | LineBreak;

interface Paragraph {
  kind: 'paragraph';
  id: string; // stable nodeId (협업/undo 안전)
  children: Inline[];
  layout: BlockLayout | null; // ★ null = dirty, 다음 render에 재계산
}

interface TextRun {
  // ★ 글자 1개 1노드 X. string run.
  kind: 'text';
  id: string;
  text: string; // "Hello world" — 같은 스타일 이어지는 동안 한 노드
  style: Style; // font, size, bold, italic, color, ...
}

// === 물리 캐시 (block 단위) ===
interface BlockLayout {
  rows: Row[]; // block 좌상단 기준 상대 좌표
  totalHeight: number;
  innerWidthSnapshot: number; // 폭 바뀌면 무효화 키
}

interface Row {
  fragments: RowFragment[]; // 이 줄에 들어간 inline 조각들
  width: number;
  height: number;
  ascent: number;
  offsetY: number; // block top 기준
}

interface RowFragment {
  inlineRef: Inline; // 원본 inline 노드 포인터 (데이터 복사 X)
  startOffset: number; // TextRun이면 글자 offset, 아니면 0
  endOffset: number;
  measuredWidth: number;
  advances?: number[]; // hit-test용 글자별 x-advance 캐시
}

// === 페이지 인덱스 (매 render마다 가볍게 재빌드) ===
interface Page {
  entries: PageEntry[];
  height: number;
}

interface PageEntry {
  block: Block;
  blockTop: number; // 페이지 내 y 좌표
  layout: BlockLayout;
  rowRange: [start: number, end: number]; // 이 페이지에 그릴 row 인덱스 범위 (inclusive)
  // 같은 block이 페이지 경계에 걸치면 두 페이지 entries에 각각 등장하고
  // rowRange만 다르게 가짐 (블록 노드 자체는 분할하지 않음)
}
```

### 핵심 두 가지

1. **TextRun은 string run** — 1글자 1노드 절대 금지. 같은 스타일이면 한 string으로 묶어두기. 100글자 입력해도 트리 노드는 안 늘고 string concat만.
2. **Row는 데이터 복사가 아니라 fragment ref** — `RowFragment`가 "어느 TextRun의 어느 구간"을 가리킴. inline이 바뀌면 그 ref 가진 row 무효화.

### "run"의 의미

`run`은 활자 인쇄 / 텍스트 레이아웃 분야의 표준 용어. **"같은 속성이 끊김 없이 연달아 이어지는 구간"**을 가리킴.

영어 일상 용법: "a long run of bad luck" (불운이 쭉 이어지는 기간), "a run of victories" (연승) — 모두 "동일한 무언가가 끊김 없이 이어짐"이란 뜻.

텍스트 레이아웃에서 **TextRun = "같은 스타일 속성이 끊기지 않고 이어지는 글자들의 묶음"**.

비슷한 개념들:


| 용어             | 의미                          |
| -------------- | --------------------------- |
| **Style run**  | 같은 스타일이 이어지는 구간 (= TextRun) |
| **Glyph run**  | 같은 폰트로 shape된 글리프들의 연속      |
| **Bidi run**   | 같은 텍스트 방향(LTR/RTL)이 이어지는 구간 |
| **Script run** | 같은 문자 체계(라틴/한자/아랍)가 이어지는 구간 |


리치텍스트 에디터 데이터 모델 수준에선 보통 **style run만 신경 쓰면 충분**. ProseMirror는 "Text node + Marks", Slate는 "Text node + properties"로 부름. 본질은 같음.

### 라인 분할 알고리즘 (문단 단위)

```
layoutParagraph(p, availableWidth):
  rows = []
  curRow = newRow()
  x = 0
  for inline in p.children:
    if inline is TextRun:
      // 글자/단어 단위 측정, word-wrap 발생 시 줄 분할
      walk text, push fragments into curRow
      when wrap: rows.push(curRow); curRow = newRow()
    else if inline is InlineImage / Latex:
      atom 측정 후 width 초과면 wrap, fragment로 추가
    else if inline is LineBreak:
      rows.push(curRow); curRow = newRow()
  rows.push(curRow)
  return BlockLayout { rows, totalHeight: sum(r.height) }
```

문단 경계에서 row가 끊긴다는 게 자연스럽게 보장됨 — **row가 어차피 한 문단을 벗어날 일이 없으니까** 글로벌 row 관리가 필요 없어짐.

### 페이지 구성

```
buildPages():
  pages = [Page()]
  y = 0
  walkBlocksInOrder(doc): block =>
    if block.layout == null || widthChanged:
      block.layout = layoutBlock(block, innerWidth)
    for row in block.layout.rows:
      if y + row.height > pageHeight:
        pages.push(Page()); y = 0
      pages.last.entries.push({ block, blockTop: y, layout: block.layout })
      y += row.height
```

페이지는 **저장 안 하고 매번 재구성**. 측정 안 하고 캐시된 row 높이만 합산하니까 사실상 공짜.

### 위치 모델 (커서/선택)

평탄판의 `index: number` 대신 **nodeId + offset** (또는 path + offset):

```ts
type Position = { nodeId: string; offset: number };
type Range = { anchor: Position; focus: Position };
```

**path 말고 nodeId 기반을 강력 추천** — path는 형제 삽입에 약해서 협업/undo 들어가는 순간 다 갈아엎게 됨. 새로 짜는 거니까 처음부터 stable id 박아두는 게 후회 안 함.

### 편집 연산

**글자 'a' 입력 at `{ nodeId: textRunId, offset: 5 }`:**

1. nodeId로 TextRun 찾음
2. `run.text = run.text.slice(0,5) + 'a' + run.text.slice(5)` (string splice)
3. 부모 문단 `paragraph.layout = null` (그 문단만 dirty)
4. render → 그 문단만 re-layout

**Enter (문단 분리):**

1. TextRun 분할 → 두 run
2. offset 이후 inline들을 새 Paragraph로 이동
3. 부모 children에 새 Paragraph 삽입
4. 두 문단 다 layout = null

**Backspace (문단 머지):**

1. 이전 block의 마지막 inline에 현재 block 내용 append
2. 현재 block 부모에서 제거
3. 이전 block layout = null

string run 덕분에 **연속 입력은 같은 노드 내 string concat**으로 처리됨. 트리 노드 수 안 늘어남.

### Dirty 전파 규칙

```
편집 위치 → 가장 가까운 leaf block 찾음 → 그 block.layout = null
이 block 이후 페이지 위치는 자동으로 다시 계산됨 (페이지는 매번 재구성)
형제/부모 block은 건드리지 않음
폭 변경 (resize/zoom) → 트리 walk하며 모든 layout = null
```

### 함정들

**1. inline 단위가 row 경계를 넘는 케이스**

TextRun "Hello world"가 너무 길어서 두 row로 잘리면, 같은 inline이 두 RowFragment로 나뉨. fragment의 startOffset/endOffset이 핵심. inline 자체를 자르지 말 것 — 그러면 트리가 layout 따라 변형됨(피해야 할 안티패턴).

**2. surround image (텍스트 회피하는 이미지)**

이게 인접 문단까지 침범할 수 있음. 해결책: 각 문단이 "내가 의존하는 floating image 목록"을 들고, 이미지 이동 시 영향받는 문단들 같이 dirty.

**3. 페이지 경계가 문단을 자를 때**

한 문단의 row가 두 페이지에 걸치는 케이스. 위 `buildPages()` 구조면 자동으로 처리됨 — page entries에 row 단위로 들어가니까. 단, "문단 첫 row는 페이지 끝에 혼자 두지 말라(widow/orphan)" 같은 규칙은 별도 패스 필요.

**4. 협업 편집 / undo**

path 기반은 다른 사람이 앞쪽에 삽입하면 path가 무효화됨. nodeId 기반(`{nodeId, offset}`)이 안전.

**5. 측정 캐시 일관성**

`RowFragment.advances`가 글자별 x좌표 가지고 있는데, font/size 바뀌면 무효. style 변경도 layout = null 트리거에 포함시켜야 함.

---

## 2. children vs layout.rows 의 차이


|          | `children: Inline[]`     | `layout.rows: Row[]`              |
| -------- | ------------------------ | --------------------------------- |
| 무엇       | **논리** — 스타일별로 나뉜 문자/요소들 | **물리** — 화면상 줄 단위 레이아웃            |
| 분할 기준    | 스타일 변화 (볼드 시작/끝, 색 바뀜 등) | 사용 가능한 폭 (word-wrap)              |
| 폭이 바뀌면   | **안 바뀜**                 | 다시 계산됨                            |
| 스타일이 바뀌면 | 분할/병합됨                   | 다시 계산됨                            |
| 데이터 보유   | string, 이미지 src 등 실제 콘텐츠 | inline에 대한 ref + 측정값 (글자 안 들고 있음) |


즉:

- `children` = "이 문단에 무엇이 들어 있나" (스타일 단위로 묶인 콘텐츠)
- `layout.rows` = "그게 화면에 어떻게 펼쳐졌나" (시각적 줄 단위 슬라이스)

물리 모델은 논리 모델의 **파생물(derived)**. 폭이나 콘텐츠가 바뀌면 layout만 무효화하고 다시 만듦. children은 그대로.

### 케이스 1: 1200자 / 1개 스타일 / 12줄

```
Paragraph {
  children: [
    TextRun { text: "...1200자...", style: { font: 'Arial', size: 14 } }
    // ★ Inline은 이거 하나뿐
  ],
  layout: {
    rows: [
      Row { fragments: [{ inlineRef: ↑TextRun, start:    0, end:  100 }] },  // 1행
      Row { fragments: [{ inlineRef: ↑TextRun, start:  100, end:  200 }] },  // 2행
      Row { fragments: [{ inlineRef: ↑TextRun, start:  200, end:  300 }] },  // 3행
      ...
      Row { fragments: [{ inlineRef: ↑TextRun, start: 1100, end: 1200 }] },  // 12행
    ]
    // ★ Row는 12개, 모든 RowFragment의 inlineRef는 같은 TextRun
  }
}
```

12개 RowFragment가 **동일한 TextRun을 가리키며**, `start`/`end`로 각자 어느 구간을 표시할지를 지정. TextRun.text는 한 string 그대로 유지됨 (절대 12개로 잘리지 않음).

### 케이스 2: 짧은 줄에 스타일 여러 개

```
"Hello [bold]world[/bold] foo"

children: [
  TextRun { text: "Hello ",  style: { bold: false } },
  TextRun { text: "world",   style: { bold: true  } },
  TextRun { text: " foo",    style: { bold: false } },
]
// children 3개

layout.rows: [
  Row { fragments: [
    { inlineRef: child[0], start: 0, end: 6 },
    { inlineRef: child[1], start: 0, end: 5 },
    { inlineRef: child[2], start: 0, end: 4 },
  ] }
  // row는 1개, fragment는 3개 (스타일 경계마다 잘림)
]
```

한 줄 안에서도 **스타일이 바뀌면 fragment가 갈림**. 스타일이 바뀌어도 fragment가 갈리고, 줄이 wrap돼도 fragment가 갈림. 즉 fragment = "한 줄 안에서 한 inline의 한 연속 구간".

### 케이스 3: 일반적 케이스 — 둘 다 발생

```
긴 문장 + 중간에 굵은 글씨 + word-wrap으로 3줄

children: [
  TextRun { text: "The quick brown fox ",       style: { bold: false } },  // [0]
  TextRun { text: "jumps over the lazy",        style: { bold: true  } },  // [1]
  TextRun { text: " dog and runs away today",   style: { bold: false } },  // [2]
]

layout.rows: [
  Row {  // 1줄
    fragments: [
      { inlineRef: child[0], start: 0, end: 20 },  // "The quick brown fox "
      { inlineRef: child[1], start: 0, end:  6 },  // "jumps "
    ]
  },
  Row {  // 2줄 — child[1]이 두 줄에 걸침
    fragments: [
      { inlineRef: child[1], start: 6, end: 19 },  // "over the lazy"
      { inlineRef: child[2], start: 0, end:  9 },  // " dog and "
    ]
  },
  Row {  // 3줄
    fragments: [
      { inlineRef: child[2], start: 9, end: 24 },  // "runs away today"
    ]
  },
]
```

같은 inline이 여러 row에 나뉠 수 있고 (`child[1]`이 1·2줄에 걸침), 같은 row에 여러 inline이 들어갈 수 있음. **fragment는 (inline × row)의 교집합 단위**.

---

## 3. 마우스 클릭 → 커서 위치 계산

트리 모델에서 hit-test가 평탄 모델보다 살짝 더 단계가 많은데, 각 단계마다 무슨 정보를 쓰는지 정리.

### 클릭 좌표 → 커서 위치 계산 파이프라인

```
입력: (clickX, clickY)  ← 화면(or 캔버스) 절대 좌표

  ┌──────────────────────────────────────────────┐
  │ STEP 1. 어느 페이지인가?                      │
  │ 사용 정보: pages[].height, pageGap            │
  │ 출력: page                                    │
  └──────────────────────────────────────────────┘
                     ↓
  ┌──────────────────────────────────────────────┐
  │ STEP 2. 페이지 안 어느 block(문단)인가?       │
  │ 사용 정보: page.entries[].blockTop,           │
  │            block.layout.totalHeight          │
  │ 출력: block, 그 block 내 상대 y               │
  └──────────────────────────────────────────────┘
                     ↓
  ┌──────────────────────────────────────────────┐
  │ STEP 3. block 안 어느 row인가?                │
  │ 사용 정보: row.offsetY, row.height           │
  │ 출력: row, 그 row 내 상대 x                   │
  └──────────────────────────────────────────────┘
                     ↓
  ┌──────────────────────────────────────────────┐
  │ STEP 4. row 안 어느 fragment인가?            │
  │ 사용 정보: fragment.measuredWidth (누적)     │
  │ 출력: fragment, 그 fragment 내 상대 x        │
  └──────────────────────────────────────────────┘
                     ↓
  ┌──────────────────────────────────────────────┐
  │ STEP 5. fragment 안 어느 글자인가?            │
  │ 사용 정보: fragment.advances[] (글자별 폭)    │
  │            fragment.startOffset              │
  │            fragment.inlineRef (TextRun)      │
  │ 출력: 글자 offset (TextRun 내 인덱스)         │
  └──────────────────────────────────────────────┘
                     ↓
  ┌──────────────────────────────────────────────┐
  │ STEP 6. 트리에서 nodeId/path 역추적          │
  │ 사용 정보: inlineRef → 부모 포인터 / id      │
  │ 출력: Position { nodeId, offset } 또는       │
  │       { path: [blockIdx, inlineIdx], offset }│
  └──────────────────────────────────────────────┘
```

### 단계별 필요한 정보 (자료구조 매핑)

```ts
Document
 ├─ pages: Page[]                  // ← STEP 1 (페이지 결정)
 │   └─ entries: { block, blockTop, layout } []  // ← STEP 2 (block 결정)
 │
 └─ Block (Paragraph)
     ├─ children: Inline[]                       // ← STEP 6 (트리 위치)
     └─ layout: BlockLayout
         └─ rows: Row[]                          // ← STEP 3 (row 결정)
             └─ fragments: RowFragment[]         // ← STEP 4 (fragment 결정)
                 ├─ inlineRef: Inline
                 ├─ startOffset, endOffset
                 ├─ measuredWidth
                 └─ advances?: number[]          // ← STEP 5 (글자 결정)
```

### 각 단계가 하는 일

#### STEP 1 — 페이지 결정

```ts
let cumulativeY = 0;
for (const page of pages) {
  if (clickY < cumulativeY + page.height) {
    pageY = clickY - cumulativeY; // 페이지 안에서의 y
    break;
  }
  cumulativeY += page.height + pageGap;
}
```

필요한 정보: **페이지별 누적 y**.

#### STEP 2 — Block 결정

```ts
for (const entry of page.entries) {
  const blockBottom = entry.blockTop + entry.layout.totalHeight;
  if (pageY < blockBottom) {
    block = entry.block;
    blockY = pageY - entry.blockTop; // block 안에서의 y
    break;
  }
}
```

필요한 정보: **block의 top + block.layout.totalHeight**.

여기서 페이지 인덱스가 도움됨 — 트리를 walk하지 않고 페이지 entries 배열 안에서 binary search로 끝남.

#### STEP 3 — Row 결정

```ts
const rows = block.layout.rows;
for (const row of rows) {
  if (blockY < row.offsetY + row.height) {
    rowX = clickX - block.left; // row 안 상대 x
    break;
  }
}
```

필요한 정보: **row.offsetY, row.height** (block 좌상단 기준 상대값).

#### STEP 4 — Fragment 결정

```ts
let cumulativeX = 0;
for (const frag of row.fragments) {
  if (rowX < cumulativeX + frag.measuredWidth) {
    fragX = rowX - cumulativeX; // fragment 안 상대 x
    break;
  }
  cumulativeX += frag.measuredWidth;
}
```

필요한 정보: **fragment.measuredWidth**.

여기까지 오면 클릭이 어떤 inline 노드 위에 떨어졌는지 확정.

#### STEP 5 — 글자 offset 결정

```ts
// fragment.advances = [글자0의 폭, 글자1의 폭, ...]
let cumulativeAdvance = 0;
let charOffset = 0;
for (let i = 0; i < frag.advances.length; i++) {
  const advance = frag.advances[i];
  if (fragX < cumulativeAdvance + advance / 2) {
    // 글자 왼쪽 절반 클릭 → 그 글자 앞에 커서
    charOffset = i;
    break;
  }
  if (fragX < cumulativeAdvance + advance) {
    // 글자 오른쪽 절반 클릭 → 그 글자 뒤에 커서
    charOffset = i + 1;
    break;
  }
  cumulativeAdvance += advance;
}

// 최종 inline 내 offset
const offsetInInline = frag.startOffset + charOffset;
```

필요한 정보: **fragment.advances[] (글자별 x-advance 캐시)**, `fragment.startOffset`.

원본 canvas-editor가 클릭 시 좌/우 절반으로 갈라 글자 앞/뒤를 결정하는 그 로직 — 트리 버전에선 fragment의 `advances` 배열에서 똑같이 함.

이미지/라텍스/체크박스 같은 atomic inline은 advances가 없고, 좌/우 절반만 보고 inline 앞/뒤로 결정.

#### STEP 6 — 트리 위치로 변환

```ts
// 옵션 A: nodeId 기반 (강력 추천)
return {
  nodeId: frag.inlineRef.id,
  offset: offsetInInline,
};

// 옵션 B: path 기반
const path = resolvePath(frag.inlineRef); // 부모 포인터 따라 위로
return { path, offset: offsetInInline };
```

필요한 정보: **inline → 트리 위치 역변환 수단** (각 노드에 stable id 박아두거나, parent 포인터 갖고 있어야 함).

### 평탄 모델과 비교

canvas-editor 평탄 모델은 step 1~5가 **하나의 positionList 평면 순회**로 끝남:

```ts
for (const pos of positionList) {
  if (pos.coordinate.leftTop[0] <= x <= rightBottom[0] && ...) {
    return pos.index  // 끝
  }
}
```

1차원 인덱스 하나 나오면 끝이라 단순. 트리 모델은 단계가 많아 보이지만 **각 단계가 binary search 가능한 sorted array** (페이지/엔트리/row/fragment 모두 위→아래 또는 좌→우 순)라 실제 비용은 `O(log n)` 수준.

### 엣지 케이스 처리에 필요한 추가 정보

원본 canvas-editor에서 처리한 케이스들이 트리 모델에서도 동일하게 필요:

**(1) 줄 끝 빈 공간 클릭**

- row 안 마지막 fragment의 endX보다 x가 더 큼
- 처리: row 마지막 글자 뒤(end of row)로 커서. → `charOffset = lastFrag.endOffset - lastFrag.startOffset`

**(2) 문단 사이 빈 공간 클릭** (block 사이)

- pageY가 어느 block의 top~bottom 어디에도 안 들어감 (block 사이 margin)
- 처리: 더 가까운 block 선택 후 그 block의 첫/마지막 글자

**(3) 페이지 위/아래 마진 클릭**

- 처리: 페이지 첫 block의 첫 글자 또는 마지막 block의 마지막 글자

**(4) 빈 문단 클릭**

- block.layout.rows에 row 1개 있고 fragments는 비어 있음 (또는 placeholder)
- 처리: 그 문단의 시작 위치(`offset: 0`)

**(5) 표 셀 클릭**

- block이 Table이면 셀 내부 좌표로 변환 후 STEP 2부터 재귀 (셀 자체가 mini-document)

이런 처리에 필요한 보조 정보:

- block.left/right 마진 (마진 영역 클릭 판별)
- 빈 row의 placeholder 높이
- 표의 cell 경계 좌표

### 정리: hit-test에 필요한 캐시 정보 한눈에


| 단계    | 필요 정보                            | 어디 저장?                |
| ----- | -------------------------------- | --------------------- |
| 페이지   | 페이지별 누적 y                        | `pages[]` 인덱스         |
| 블록    | block top, totalHeight           | `page.entries[]`      |
| 행     | row.offsetY, row.height          | `block.layout.rows[]` |
| 프래그먼트 | fragment.measuredWidth           | `row.fragments[]`     |
| 글자    | fragment.advances[], startOffset | `RowFragment`         |
| 트리 위치 | inline.id 또는 parent ptr          | inline 노드 자체          |


**핵심: hit-test는 결국 layout 캐시를 위→아래로 4번 binary search한 다음, 마지막에 트리 노드 역참조 한 번 하는 구조.** layout 캐시가 잘 돼있으면 (특히 fragment.advances 배열) hit-test는 빠르고 단순해짐. 평탄 모델의 positionList 같은 거대한 평면 배열을 별도로 들고 있을 필요가 없음. 각 row/fragment가 자기 안에 필요한 측정값을 갖고 있으니까.

이 구조의 장점은 **편집해서 한 문단의 layout만 다시 만들어도 hit-test 정보가 자동으로 갱신된다**는 점. 평탄 모델처럼 글로벌 positionList를 다시 만들 필요 없음.

---

## 4. layout 측정 전략 (measureText)

word-wrap 위치를 정확히 잡으려면 결국 글자 단위 폭이 필요. 단순 버전은 한 글자씩 `ctx.measureText` 호출:

```ts
for (const char of textRun.text) {
  const w = ctx.measureText(char).width;
  if (curRow.width + w > availableWidth) wrap();
  curRow.width += w;
  advances.push(w);
}
```

1000자 문단이면 measureText 1000번. 가벼워서 일반 문서엔 문제 없음.

### 실전 최적화 1 — 청크 측정 + 분할

여러 글자를 한 번에 측정해서 전체 폭 얻고, 줄바꿈 후보(공백 등)에서만 다시 측정.

```ts
const segments = splitByWordBoundary(textRun.text) // ["Hello", " ", "world"]
for (const seg of segments) {
  const w = ctx.measureText(seg).width
  if (curRow.width + w > availableWidth) {
    // 폭 초과 시에만 글자별 advance 측정해서 정확한 wrap 위치 찾기
    ...
  }
}
```

캔버스 측정 호출 횟수가 글자수 → 단어수로 줄어듦.

### 실전 최적화 2 — 글자 폭 캐시 (font key 기준)

같은 폰트/사이즈에서 'a'의 폭은 항상 같음. 자주 나오는 글자는 메모이제이션:

```ts
const widthCache = new Map<string /*fontKey*/, Map<string /*char*/, number>>();
```

ASCII 영역은 100자 안 됨. 한글도 자주 쓰는 음절 위주라 캐시 hit률 높음.

### 실전 최적화 3 — 폰트 metrics 활용

`measureText`는 ascent/descent까지 포함해 무거운 편. 폭만 필요하면 더 가벼운 호출 쓰거나, 한 줄 단위로 한 번에 측정하고 advances는 "줄 폭에서 비례 배분"으로 근사 (정확도-속도 트레이드오프).

### 결론

**일단은 글자별 measureText로 시작**. 측정해서 느리면 그때 청크/캐시 도입. 1만 자 문서라도 layout이 dirty 문단만 다시 도는 구조면 (한 문단 200~500자), 매 키 입력마다 200번 measureText는 1ms 안에 끝남. 조기 최적화 안 해도 됨.

---

## 5. 입력 → 렌더 흐름 (dirty / lazy 재계산)

### 가장 단순한 즉시(eager) 모델

```
입력 'a'
 ↓
TextRun.text 수정 (string splice)
 ↓
부모 Paragraph.layout = layoutParagraph(...)   ← 즉시 재계산
 ↓
buildPages()                                    ← 페이지 재구성
 ↓
canvas redraw
```

동기적이고 추적이 쉬워. 작은 문서면 충분.

### 권장 — lazy + dirty flag

```
입력 'a'
 ↓
TextRun.text 수정
 ↓
Paragraph.layout = null         ← ★ 계산 안 함, dirty 표시만
 ↓
requestRender() (rAF에 등록)
 ↓
... 다음 frame ...
 ↓
render():
  buildPages():                  ← 페이지 walk 중
    for each block:
      if (block.layout == null) block.layout = layoutBlock(...)  ← lazy 재계산
      ...
  canvas redraw
```

장점:

- **연속 입력 (특히 IME 조합)** 시 한 frame 안에 여러 번 입력돼도 layout은 frame 끝에 한 번만 계산
- 화면 밖 페이지 block은 **layout 재계산을 미루거나 건너뛸 수도 있음** (가상 스크롤)
- 입력 처리 콜백이 동기 layout 계산에 안 막힘 → 입력 반응성 좋음

### Dirty 전파 규칙 (정리)

```
편집 위치 → 가장 가까운 leaf block 찾음 → block.layout = null
형제/부모 block은 안 건드림
폭 변경 (resize/zoom) → 트리 walk하며 모든 layout = null
스타일(font/size/letter-spacing) 변경 → 영향받은 inline의 부모 block layout = null
```

### 더 정밀한 관리 (선택사항)

상태를 두 단계 dirty로 분리:

```ts
class Paragraph {
  contentDirty: boolean; // children이 바뀜 → layout 무효
  layoutValid: boolean; // layout이 현재 폭에 맞게 계산됨
  // contentDirty=true 면 layoutValid=false
  // 폭만 바뀌면 contentDirty=false 지만 layoutValid=false 가능
}
```

처음엔 `layout: BlockLayout | null` 한 필드로 시작해도 충분. 가상 스크롤 같은 고급 기능 들어가면 그때 분리.

### 표준 패턴 정리

```
[Edit phase] (사용자 입력 시)
  1. 트리 수정 (TextRun.text splice / Paragraph 분리 등)
  2. 영향받는 block.layout = null
  3. requestRender() (rAF 큐에 한 번만 등록)

[Render phase] (다음 frame)
  1. buildPages() 시작
  2. 각 block 순회하며 layout이 null이면 layoutBlock() 호출
  3. 페이지 entries 만들고 그리기
  4. 커서 위치 갱신
  5. 이벤트 발행 (contentChange 등)
```

원본 canvas-editor의 `render({ isCompute: true })` 흐름과 본질적으로 같음.

---

## 6. 페이지 경계 처리: 블록은 분할하지 않는다

긴 문단이 한 페이지에 안 들어가서 다음 페이지로 넘어갈 때, **블록 노드 자체를 둘로 쪼개고 싶은 유혹**이 생김. 그러면 안 됨.

### 잘못된 접근 (안티패턴)

```
긴 Paragraph → "문단 1-1"과 "문단 1-2"로 노드 자체를 쪼갬
```

문제:

- 사용자는 한 문단으로 인식하는데 트리에 두 노드 → 모델/UX 불일치
- 문단 가운데서 글자 추가/삭제할 때 두 노드 사이 경계 관리 지옥
- 셀렉션이 "1-1 끝 ~ 1-2 시작"을 자연스럽게 못 표현
- 페이지 폭 변하면 분할 위치도 바뀌어서 노드가 막 변형됨
- 협업/undo에서 분할 자체가 history에 들어가서 꼬임

### 올바른 접근 — 논리는 단일 block, 물리만 페이지 분할

```
[논리 트리]
Paragraph P3 {
  children: [TextRun (1200자)],
  layout: BlockLayout {
    rows: [Row 0, Row 1, ..., Row 11]   // 12줄
    totalHeight: 240
  }
}
   ↑ 노드 하나 그대로

[물리 페이지 인덱스]
Page 1.entries = [
  ...,
  {
    block: P3,                  ← 같은 노드 ref
    blockTop: 700,
    layout: P3.layout,
    rowRange: [0, 7]            ← 이 페이지엔 row 0~7만 표시
  }
]
Page 2.entries = [
  {
    block: P3,                  ← 같은 노드 ref (재등장)
    blockTop: 0,
    layout: P3.layout,
    rowRange: [8, 11]           ← 이 페이지엔 row 8~11 표시
  },
  ...
]
```

`PageEntry.rowRange: [start, end]` 가 **"이 페이지에는 이 block의 어느 row부터 어느 row까지 그릴지"** 를 명시. 노드는 안 건드림.

### `buildPages` 알고리즘

```ts
function buildPages(doc) {
  const pages = [new Page()];
  let y = 0;
  let pageStartY = 0;

  for (const block of walkLeafBlocks(doc)) {
    if (!block.layout) block.layout = layoutBlock(block);

    let rowStart = 0;
    for (let r = 0; r < block.layout.rows.length; r++) {
      const row = block.layout.rows[r];

      if (y + row.height > pageHeight) {
        // 현재 페이지에 지금까지의 row 범위 push
        pages.last.entries.push({
          block,
          blockTop: pageStartY,
          layout: block.layout,
          rowRange: [rowStart, r - 1],
        });
        // 새 페이지로
        pages.push(new Page());
        y = 0;
        rowStart = r; // 이 페이지는 row r 부터 시작
        pageStartY = 0;
      }
      y += row.height;
    }
    // block 끝 — 마지막 페이지에 남은 range push
    pages.last.entries.push({
      block,
      blockTop: pageStartY,
      layout: block.layout,
      rowRange: [rowStart, block.layout.rows.length - 1],
    });
  }
  return pages;
}
```

**같은 block을 두 entries에 push**하기만 하면 끝. 노드는 그대로.

### 모든 연산이 자연스럽게 따라옴


| 연산           | 처리                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| **렌더링**      | entries 순회, 각 entry의 rowRange만 그리기                                                                    |
| **hit-test** | clickY가 떨어진 페이지의 entry 찾고, rowRange[0]~rowRange[1] 안에서만 row 검색. 결과 nodeId/offset은 자동으로 원본의 위치         |
| **선택 영역**    | range = `{anchor: {nodeId, offset:50}, focus: {nodeId, offset:800}}` — 페이지 경계 신경 안 씀. 렌더링만 페이지 분기로 그림 |
| **편집**       | block.children에 splice. block.layout = null. 다음 buildPages가 row를 다시 페이지에 분배                           |
| **드래그 셀렉션**  | 페이지 경계 무시. 시작점과 끝점만 알면 됨                                                                              |


### 사용자 인식과 일치

사용자가 "한 문단으로 인식한다"는 건 곧 **편집 단위가 한 덩어리**라는 뜻. 트리에 한 노드로 두면:

- Cmd+A로 선택해도 한 문단 통째로 선택됨 (노드 단위)
- 들여쓰기 / 정렬 변경하면 페이지 경계와 무관하게 전체 적용됨
- 복사 → 붙여넣기 시 자연스럽게 한 문단이 붙음

만약 노드를 분할했다면 위 동작들 다 별도 코드로 "두 노드를 하나로 취급"하는 처리가 필요. **분할 안 하는 게 압도적으로 깔끔**.

### 추가 - 페이지 경계 미세 처리 (확장)

이 구조면 다음 출판/인쇄 룰도 깔끔하게 추가 가능:

- **Widow/Orphan 방지** — "문단 첫 row만 페이지 끝에 두지 말기": rowRange 분할 위치를 후보 중에서 고르기
- **페이지 강제 break** — block 직전에 새 페이지 시작
- **Keep with next** — 두 block을 같은 페이지에 묶기 (둘 다 안 들어가면 통째로 다음 페이지로)

이런 정책들이 **노드를 안 건드리고 페이지 분할 단계에서만 결정**되는 게 핵심. 정책 변경이 노드 구조에 영향 0.

### 정리

> **블록은 절대 분할하지 마라. PageEntry가 "한 페이지에 표시되는 block의 row 슬라이스"를 표현하는 개념이고, 한 block이 N개 페이지에 걸치면 N개 entry로 등장한다. 트리는 논리, 페이지는 물리. 이 분리가 사용자 인식("한 문단")과 모델("한 노드")을 일치시킨다.**

이게 워드/구글 docs 같은 워드프로세서들이 페이지 경계를 자유롭게 넘나드는 비결. 노드 분할 안 하고 페이지 슬라이스만 함.

---

## 7. 구조의 복잡도 평가

### 트리라고 부르지만 실제로는 얕은 계층

대부분의 노드가 1단계 자식밖에 안 가짐:

- Paragraph → Inline[] (leaf)
- Heading → Inline[] (leaf)

깊이 2~3 짜리 얕은 트리. 일반 문서의 99%는 이 깊이에서 끝남. **순수한 의미의 "트리 자료구조"**라기보단 **"계층적 그룹화"**에 가까움.

진짜 트리 구조(임의 깊이의 재귀)가 등장하는 건:

- **표 안 셀**: TableCell.blocks에 또 Block[]이 들어감 → 그 안에 또 표 가능
- **리스트 중첩**: ListItem.blocks에 또 List 가능
- **인용/콜아웃 중첩**

이런 케이스에서만 깊이가 5~6까지 가고, 그때 트리 본연의 재귀가 빛을 발함.

### "트리"라고 부르는 진짜 의미

자료구조의 깊이가 아니라 **연산 모델의 재귀성**:

- block 안에 block이 들어갈 수 있다 (재귀적 컨테이너)
- 같은 함수 (`layoutBlock`, `renderBlock`)가 깊이에 무관하게 동작
- 편집 연산이 노드 단위(split/merge/move)로 정의됨 → 깊이 무관

**일반 문단만 다룰 때는 사실상 "List of Paragraphs"처럼 동작**하지만, 표/리스트가 들어오는 순간 자연스럽게 재귀가 작동. 이 균일성이 트리 모델의 핵심 가치.

### 복잡도 축별 평가


| 축             | 평가         | 코멘트                                             |
| ------------- | ---------- | ----------------------------------------------- |
| **자료구조**      | ★★☆☆☆ (낮음) | 인터페이스 6~8개. 핵심은 Block/Inline/Row/RowFragment 4개 |
| **편집 알고리즘**   | ★★★☆☆ (중)  | split/merge/insert/delete 정의. nodeId 기반이면 단순    |
| **레이아웃 알고리즘** | ★★★★☆ (높음) | 캔버스 에디터의 본질적 복잡도. 평탄 모델이든 트리든 비슷                |
| **물리/논리 분리**  | ★★★☆☆ (중)  | 익숙해지면 직관적. 처음엔 헷갈림                              |


전체적으로 캔버스 리치텍스트 에디터의 본질적 복잡도 안에서 합리적인 추상화. 평탄 모델 대비:

- 자료구조는 약간 늘어남 (Page/PageEntry 추가)
- 편집은 트리 walk 한 단계 추가
- 레이아웃은 거의 동일
- **dirty 관리는 훨씬 단순** (block 단위 invalidation)

### 점진적 시작 추천

처음부터 모든 노드 타입 정의하지 말고, 최소 세트로 시작:

**Phase 1 — 최소 시작 세트:**

- Document, Paragraph, TextRun
- BlockLayout, Row, RowFragment
- Page, PageEntry

이 6개로 일반 텍스트 에디터는 충분히 만들어짐.

**Phase 2 — 필요해질 때 추가:**

- Heading, List, Image, Table 등을 Block에 추가
- 기존 코드는 거의 안 건드리고 Block union 타입에 케이스만 추가

트리 모델의 진짜 장점이 이 확장성. 컨테이너 노드는 진짜 필요할 때 추가하면 복잡도 부담 없이 시작 가능.