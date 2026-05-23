import { Component, ElementRef, ViewChild } from '@angular/core';

@Component({
  selector: 'app-bpmn-canvas',
  standalone: true,
  template: '<div #canvas class="bpmn-canvas"></div>',
  styleUrl: './bpmn-canvas.component.scss'
})
export class BpmnCanvasComponent {
  @ViewChild('canvas', { static: true })
  private readonly canvasRef!: ElementRef<HTMLElement>;

  get element(): HTMLElement {
    return this.canvasRef.nativeElement;
  }
}
