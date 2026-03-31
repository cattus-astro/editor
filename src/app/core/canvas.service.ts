import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CanvasService {
  initCanvas(canvas: HTMLCanvasElement): void {
    const { width, height } = canvas.getBoundingClientRect();

    const dpr = window.devicePixelRatio;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }
}
