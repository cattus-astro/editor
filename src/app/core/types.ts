//  TODO: 불필요하면 삭제
// export interface TextStyle {
//   fontFamily: string;
//   fontSize: number;
//   fontWeight: string;
//   fontStyle: string;
//   color: string;
//   textAlign: CanvasTextAlign;
//   textDecoration: 'none' | 'underline' | 'line-through';
//   backgroundColor: string | null;
// }

export interface Position<T extends 'viewport' | 'element' = 'viewport' | 'element'> {
  x: number;
  y: number;
  relativeTo: T;
}

export type ElementPosition = Position<'element'>;
export type ViewportPosition = Position<'viewport'>;
