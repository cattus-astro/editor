import { AfterViewInit, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
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
  // TODO: 어떻게 계산할 지 고민
  readonly position = signal<Position>({ x: 0, y: 0 });

  private readonly page = viewChild<ElementRef<HTMLCanvasElement>>('page');
  private readonly textComposer = viewChild<TextComposer>(TextComposer);

  private readonly canvasService = inject(CanvasService);

  ngAfterViewInit(): void {
    const pageElement = this.page();

    if (pageElement) {
      this.canvasService.initCanvas(pageElement.nativeElement);
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

    this.position.set({ x: clientX, y: clientY });
    this.textComposer()?.focus();
  }

  protected onTextUpdate({ text, eventType }: UpdateTextEvent): void {
    if (eventType === 'compositionupdate') {
      console.log(text);
    } else if (eventType === 'input') {
      console.log(text);
    }
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

    // TODO: 여기서 좌표가... 캔버스 기준으로 되어야하고, 캔버스 기준으로 계산된 좌표가 matrix에 대응되려면
    //  어떻게 계산해야하는지 고민해야함
    // matrix 는 position:fixed 이므로 뷰포트 기준으로 좌표가 계산됨..
    // 캔버스 내의 좌표는 캔버스 기준으로 계산됨..
    // 둘의 오차가 계산되어야 한글자 입력될때 정확히 그 위치에 글자를 그리고 한칸 뒤로 밀 수 있음
    //
    // ctx.measureText(text).width 로 글자의 너비를 계산하고, 그 너비만큼 좌표를 이동시키면 됨...
  }
}
