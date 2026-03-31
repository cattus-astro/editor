import { AfterViewInit, Component, ElementRef, inject, viewChild } from '@angular/core';
import { CanvasService } from '../../core/canvas.service';

@Component({
  selector: 'app-page',
  imports: [],
  templateUrl: './page.component.html',
  styleUrl: './page.component.css',
})
export class Page implements AfterViewInit {
  private readonly page = viewChild<ElementRef<HTMLCanvasElement>>('page');
  private readonly canvasService = inject(CanvasService);

  ngAfterViewInit(): void {
    const pageElement = this.page();

    if (pageElement) {
      this.canvasService.initCanvas(pageElement.nativeElement);
    }

    this.test();
  }

  private test(): void {
    const ctx = this.page()?.nativeElement.getContext('2d');

    if (!ctx) {
      return;
    }

    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 100, 100);
  }
}
