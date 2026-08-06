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
import { Position } from '../../core/types';
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

  // TODO:
  readonly position = input.required<Position>();

  private readonly editable = viewChild<ElementRef<HTMLDivElement>>('contenteditable');

  focus(): void {
    this.editable()?.nativeElement.focus();
  }

  // TODO: 스크롤 host에 (wheel) 바인딩만 추가
  // 이게 뭐냐면, 텍스트컴포저위에 커서를 둔 채로 스크롤을 하게 되면 페이지가 스크롤되지 않는 이슈를 위한것.
  // protected onWheel(event: WheelEvent): void {
  //   // contenteditable이 자체 스크롤 가능하면 그쪽 우선
  //   // 여기선 그런 케이스 없으니 그냥 부모로 넘김
  //   event.preventDefault();
  //   const scroller = this.findScrollableAncestor(); // closest('.content-area') 한 줄
  //   scroller?.scrollBy({ left: event.deltaX, top: event.deltaY });
  // }

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
