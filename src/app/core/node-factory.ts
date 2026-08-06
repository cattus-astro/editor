import { Paragraph, TextRun, TextStyle } from './types';

// TODO: 임시
let _id = 0;

function getId(): number {
  return _id++;
}

export function createParagraph(): Paragraph {
  return {
    id: getId(),
    kind: 'paragraph',
    children: [],
    layout: { rows: [], height: 0 },
  };
}

export function createTextRun(text: string, style: Partial<TextStyle>): TextRun {
  return {
    id: getId(),
    kind: 'textrun',
    text,
    style: createTextStyle(style),
  };
}

function createTextStyle(options: Partial<TextStyle>): TextStyle {
  const DEFAULT_STYLE: TextStyle = {
    fontFamily: 'Arial',
    fontSize: 12,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: 'black',
    textAlign: 'left',
    textDecoration: 'none',
    backgroundColor: '',
  };

  return {
    ...DEFAULT_STYLE,
    ...options,
  };
}
