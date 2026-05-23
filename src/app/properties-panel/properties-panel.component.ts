import { Component, ElementRef, ViewChild } from '@angular/core';

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  template: `
    <header>
      <h2>Inspector</h2>
      <span>Select an element to edit its details</span>
    </header>
    <div #panel class="properties-host"></div>
  `,
  styleUrl: './properties-panel.component.scss'
})
export class PropertiesPanelComponent {
  @ViewChild('panel', { static: true })
  private readonly panelRef!: ElementRef<HTMLElement>;

  get element(): HTMLElement {
    return this.panelRef.nativeElement;
  }
}
