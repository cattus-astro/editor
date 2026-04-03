import { AfterViewInit, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { CanvasService } from '../../core/canvas.service';
import { isHTMLElement } from '../../core/dom-util';
import { Position } from '../../core/types';
import { TextComposer } from '../text-composer/text-composer.component';

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
    const { left, top } = target.getBoundingClientRect();

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

  private isInPage(x: number, y: number): boolean {
    const pageElement = this.page();

    if (!pageElement) {
      return false;
    }

    const { left, top, width, height } = pageElement.nativeElement.getBoundingClientRect();

    return x >= left && x <= left + width && y >= top && y <= top + height;
  }
}
