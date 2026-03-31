import { Component } from '@angular/core';
import { Menubar } from '../menubar/menubar.component';
import { Toolbar } from '../toolbar/toolbar.component';
import { HorizontalRuler } from '../horizontal-ruler/horizontal-ruler.component';

@Component({
  selector: 'app-header',
  imports: [Menubar, Toolbar, HorizontalRuler],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class Header {}
