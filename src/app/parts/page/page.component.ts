import { AfterViewInit, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { CanvasService } from '../../core/canvas.service';
import { TextComposer } from '../text-composer/text-composer.component';
import { Position } from '../../core/types';

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
  private readonly canvasService = inject(CanvasService);

  ngAfterViewInit(): void {
    const pageElement = this.page();

    if (pageElement) {
      this.canvasService.initCanvas(pageElement.nativeElement);
    }
  }
}
