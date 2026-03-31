import { Component } from '@angular/core';
import { NavigationWidget } from '../../parts/navigation-widget/navigation-widget.component';
import { Page } from '../../parts/page/page.component';
import { Header } from '../../parts/header/header.component';
import { HorizontalRuler } from '../../parts/horizontal-ruler/horizontal-ruler.component';
import { Menubar } from '../../parts/menubar/menubar.component';
import { VerticalRuler } from '../../parts/vertical-ruler/vertical-ruler.component';
import { Toolbar } from '../../parts/toolbar/toolbar.component';

@Component({
  selector: 'app-editor',
  imports: [NavigationWidget, Page, Header, VerticalRuler],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.css',
})
export class Editor {}
