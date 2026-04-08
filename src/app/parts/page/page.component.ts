import { AfterViewInit, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { isNil } from 'lodash-es';
import { CanvasService } from '../../core/canvas.service';
import { isHTMLElement } from '../../core/dom-util';
import { ElementPosition, Position, ViewportPosition } from '../../core/types';
import { TextComposer } from '../text-composer/text-composer.component';
import { UpdateTextEvent } from '../text-composer/text-composer.types';

@Component({
  selector: 'app-page',
  imports: [TextComposer],
  templateUrl: './page.component.html',
  styleUrl: './page.component.css',
})
export class Page implements AfterViewInit {
  // TODO: 어떻게 계산할 지 고민
  readonly position = signal<ViewportPosition>({ x: 0, y: 0, relativeTo: 'viewport' });

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

    if (!this.isInPage(clientX, clientY)) {
      return;
    }

    const pageElement = this.page()?.nativeElement;

    if (!pageElement) {
      return;
    }

    this.position.set({ x: clientX, y: clientY, relativeTo: 'viewport' });
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

  private isInPage(x: number, y: number): boolean {
    const pageElement = this.page();

    if (!pageElement) {
      return false;
    }

    const { left, top, width, height } = pageElement.nativeElement.getBoundingClientRect();

    return x >= left && x <= left + width && y >= top && y <= top + height;
  }

  // TODO(cattus-cur): 이거 진짜 로직 옮겨야할 거 같은데, 어디가 좋을 지 미정임
  private drawText(text: string): void {
    const ctx = this.page()?.nativeElement.getContext('2d');

    if (isNil(ctx)) {
      return;
    }

    const { x, y } = this.position();
    const { x: canvasX, y: canvasY } = this.getCanvasPosition(this.position());

    // TODO(cattus-cur): 어디서 이 기본값을 관리해야할까?
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(text, canvasX, canvasY);

    const { width } = ctx.measureText(text);

    const newX = x + width;
    const newY = y;

    this.position.update((prev) => ({ ...prev, x: newX, y: newY }));
  }

  // TODO(cattus-cur): 함수명 수정 & 위치 변경
  private getCanvasPosition({ x, y, relativeTo }: ViewportPosition): ElementPosition {
    const pageElement = this.page()?.nativeElement;

    if (!pageElement) {
      throw new Error('Page element not found');
    }

    // TODO(cattus-cur): 스크롤 위치도 고민해야함
    const { left, top } = pageElement.getBoundingClientRect();

    return { x: x - left, y: y - top, relativeTo: 'element' };
  }
}
