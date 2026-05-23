import { Component, EventEmitter, Input, Output } from '@angular/core';
import { WorkflowStatus } from '../models/workflow-status.enum';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  template: `
    <header class="toolbar">
      <div class="brand">
        <strong>BPMN Process Designer</strong>
        <span [class.dirty]="status === workflowStatus.Dirty" [class.invalid]="status === workflowStatus.Invalid">
          {{ status }}
        </span>
      </div>

      <nav aria-label="BPMN actions">
        <button type="button" (click)="newDiagram.emit()">New</button>
        <label>
          Import
          <input type="file" accept=".bpmn,.xml,text/xml" (change)="onImport($event)" />
        </label>
        <button type="button" (click)="exportDiagram.emit()">Export</button>
        <button type="button" class="primary" (click)="save.emit()">Save</button>
        <button type="button" (click)="validate.emit()">Validate</button>
        <span class="divider"></span>
        <button type="button" title="Undo" (click)="undo.emit()">Undo</button>
        <button type="button" title="Redo" (click)="redo.emit()">Redo</button>
        <button type="button" title="Zoom in" (click)="zoomIn.emit()">+</button>
        <button type="button" title="Zoom out" (click)="zoomOut.emit()">-</button>
      </nav>
    </header>
  `,
  styleUrl: './toolbar.component.scss'
})
export class ToolbarComponent {
  @Input({ required: true }) status = WorkflowStatus.Clean;

  @Output() newDiagram = new EventEmitter<void>();
  @Output() importDiagram = new EventEmitter<File>();
  @Output() exportDiagram = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() validate = new EventEmitter<void>();
  @Output() undo = new EventEmitter<void>();
  @Output() redo = new EventEmitter<void>();
  @Output() zoomIn = new EventEmitter<void>();
  @Output() zoomOut = new EventEmitter<void>();

  readonly workflowStatus = WorkflowStatus;

  onImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      this.importDiagram.emit(file);
      input.value = '';
    }
  }
}
