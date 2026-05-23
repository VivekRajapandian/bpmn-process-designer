import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-xml-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section>
      <header>
        <h2>BPMN XML</h2>
        <span>{{ xml.length | number }} characters</span>
      </header>
      <pre>{{ xml }}</pre>
    </section>
  `,
  styleUrl: './xml-viewer.component.scss'
})
export class XmlViewerComponent {
  @Input({ required: true }) xml = '';
}
