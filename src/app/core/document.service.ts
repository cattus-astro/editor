import { Injectable } from '@angular/core';
import { Block } from './types';

@Injectable({
  providedIn: 'root',
})
export class DocumentService {
  blocks: Block[] = [];
  // blocks = signal<Block[]>([]);
}
