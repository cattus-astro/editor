export interface Position {
  x: number;
  y: number;
  base: 'page' | 'viewport';
}

export type Block = Paragraph;
export type Inline = TextRun;
// export type Block = Paragraph | Heading | Table;
// export type Inline = TextRun | InlineImage | LineBreak;

// ─── 논리 구조 ──────────────────────────────────────────────────────

export interface Document {
  blocks: Block[];
}

export interface Paragraph {
  kind: 'paragraph';
  id: number;
  children: Inline[];
  layout: BlockLayout | null; // null = dirty, 다음 렌더 시 재계산
}

export interface TextRun {
  id: number;
  kind: 'textrun';
  text: string;
  style: TextStyle;
}

export interface TextStyle {
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
export interface LineBreak {
  id: number;
  kind: 'linebreak';
}

// ─── 물리 레이아웃 (블록 단위 캐시) ────────────────────────────────

export interface BlockLayout {
  rows: Row[];
  height: number; // rows 높이 합 (전체 블록 높이)
}

export interface Row {
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

export interface RowFragment {
  inlineRef: Inline;
  startOffset: number; // TextRun 내 시작 글자 인덱스
  endOffset: number; // TextRun 내 끝 글자 인덱스 (exclusive)
  width: number;
  left: number; // row 내 x 시작 (hit-test 캐시)
  advances?: number[]; // 글자별 x-advance (character hit-test 캐시)
}

// ─── 물리 페이지 (Document에 저장하지 않고 렌더 시 파생) ────────────

export interface Page {
  entries: PageEntry[];
  height: number; // 이 페이지의 물리 높이 (고정값, 예: A4 = 1123px)
}

export interface PageEntry {
  block: Block;
  rowRange: [start: number, end: number]; // inclusive
  top: number; // 페이지 내 블록 y 시작 (캐시)
  height: number; // rowRange 해당 rows 높이 합 (캐시)
}
