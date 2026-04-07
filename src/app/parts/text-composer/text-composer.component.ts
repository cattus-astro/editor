import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { isNil } from 'lodash-es';
import { UpdateTextEvent } from './text-composer.types';

@Component({
  selector: 'app-text-composer',
  templateUrl: './text-composer.component.html',
  styleUrl: './text-composer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextComposer {
  // TODO: text.md 참조하기
  readonly fontFamily = input<string>('sans-serif');
  readonly fontSize = input<number>(16);
  readonly fontWeight = input<string>('normal');
  readonly fontStyle = input<string>('normal');
  readonly color = input<string>('#000000');
  readonly textAlign = input<CanvasTextAlign>('left');
  readonly textDecoration = input<'none' | 'underline' | 'line-through'>('none');
  readonly backgroundColor = input<string | null>(null);

  updateText = output<UpdateTextEvent>();

  // TODO: 어디서 관리해야하는 정보일 지 고민...
  readonly position = input.required<{ x: number; y: number }>();

  private readonly editable = viewChild<ElementRef<HTMLDivElement>>('contenteditable');

  focus(): void {
    this.editable()?.nativeElement.focus();
  }

  protected dimensions = computed(() => {
    return `matrix(1, 0, 0, 1, ${this.position().x}, ${this.position().y})`;
  });

  protected onCompositionStart(event: CompositionEvent): void {
    this.updateText.emit({ text: event.data, eventType: 'compositionstart' });
  }

  protected onCompositionUpdate(event: CompositionEvent): void {
    this.updateText.emit({ text: event.data, eventType: 'compositionupdate' });
  }

  protected onInput(event: Event): void {
    if (!(event instanceof InputEvent)) {
      return;
    }

    if (event.isComposing) {
      return;
    }

    this.updateText.emit({ text: event.data ?? '', eventType: 'input' });
    this.flushComposer(true);
  }

  protected onCompositionEnd(event: CompositionEvent): void {
    this.updateText.emit({ text: event.data, eventType: 'compositionend' });

    this.flushComposer(true);
  }

  private flushComposer(focus = false): void {
    const editable = this.editable()?.nativeElement;

    if (isNil(editable)) {
      return;
    }

    editable.innerHTML = '';

    if (focus) {
      editable.focus();
    }
  }
}
