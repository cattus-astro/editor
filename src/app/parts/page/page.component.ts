import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isNil } from 'lodash-es';
import { CanvasService } from '../../core/canvas.service';
import { isHTMLElement } from '../../core/dom-util';
import { Position } from '../../core/types';
import { TextComposer } from '../text-composer/text-composer.component';
import { UpdateTextEvent } from '../text-composer/text-composer.types';

@Component({
  selector: 'app-page',
  imports: [TextComposer],
  templateUrl: './page.component.html',
  styleUrl: './page.component.css',
})
export class Page implements AfterViewInit {
  readonly cursorPosition = signal<Position>({ x: 0, y: 0, base: 'page' }); // it based on page element

  protected composerPosition = computed(() =>
    this.converPosition({ ...this.cursorPosition(), base: 'viewport' }),
  );

  private readonly page = viewChild<ElementRef<HTMLCanvasElement>>('page');
  private readonly textComposer = viewChild<TextComposer>(TextComposer);

  private readonly canvasService = inject(CanvasService);

  ngAfterViewInit(): void {
    const pageElement = this.page();

    if (pageElement) {
      this.canvasService.initCanvas(pageElement.nativeElement);
      this.initTextStyle();
    }
  }

  protected onClickPage(e: MouseEvent): void {
    const target = e.target;

    if (!isHTMLElement(target)) {
      return;
    }

    const { clientX, clientY } = e;

    if (!this.isInPage({ x: clientX, y: clientY, base: 'viewport' })) {
      return;
    }

    const pageElement = this.page()?.nativeElement;

    if (!pageElement) {
      return;
    }

    this.cursorPosition.set(this.converPosition({ x: clientX, y: clientY, base: 'page' }));
    this.textComposer()?.focus();
  }

  protected onTextUpdate({ text, eventType }: UpdateTextEvent): void {
    if (eventType === 'compositionupdate') {
      console.log(text);
    } else if (eventType === 'input') {
      this.drawText(text);
    }
  }

  // TODO(cattus-cur): 함수위치 서비스로 이동
  private initTextStyle(): void {
    const ctx = this.page()?.nativeElement.getContext('2d');

    if (isNil(ctx)) {
      return;
    }

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
  }

  // TODO(cattus-cur): 함수명 변경등의 방법으로 base 가 항상 'viewport' 임을 알 수 있도록 하기.
  private isInPage({ x, y, base }: Position): boolean {
    const pageElement = this.page();

    if (!pageElement) {
      return false;
    }

    const { left, top, width, height } = pageElement.nativeElement.getBoundingClientRect();

    return base === 'viewport'
      ? x >= left && x <= left + width && y >= top && y <= top + height
      : x >= 0 && x <= width && y >= 0 && y <= height;
  }

  // TODO(cattus-cur): 이거 진짜 로직 옮겨야할 거 같은데, 어디가 좋을 지 미정임
  private drawText(text: string): void {
    const ctx = this.page()?.nativeElement.getContext('2d');

    if (isNil(ctx)) {
      return;
    }

    const { x, y } = this.cursorPosition();

    // TODO(cattus-cur): 어디서 이 기본값을 관리해야할까?
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    const {
      width: textWidth,
      fontBoundingBoxAscent,
      fontBoundingBoxDescent,
    } = ctx.measureText(text);
    const textHeight = fontBoundingBoxAscent + fontBoundingBoxDescent;

    let drawX = x;
    let drawY = y;
    const needToMoveToNextLine = !this.isInPage({ x: drawX + textWidth, y: drawY, base: 'page' });

    if (needToMoveToNextLine) {
      drawX = 0;
      drawY += textHeight;
    }

    ctx.fillText(text, drawX, drawY);

    this.cursorPosition.update((prev) => ({ ...prev, x: drawX + textWidth, y: drawY }));
  }

  private converPosition({ x, y, base }: Position & { base: 'page' | 'viewport' }): Position {
    const pageElement = this.page()?.nativeElement;

    if (!pageElement) {
      throw new Error('Page element not found');
    }

    // TODO(cattus-cur): 스크롤 위치도 고민해야함
    const { left, top } = pageElement.getBoundingClientRect();

    // TODO(cattus-cur): 스크롤도 고려해야함!
    return base === 'page' ? { x: x - left, y: y - top, base } : { x: x + left, y: y + top, base };
  }
}
