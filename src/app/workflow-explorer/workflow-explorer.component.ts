import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Workflow } from '../models/workflow.model';

@Component({
  selector: 'app-workflow-explorer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside>
      <header>
        <h2>Workflows</h2>
        <span>Local workflows</span>
      </header>

      <button
        *ngFor="let workflow of workflows"
        type="button"
        [class.active]="workflow.id === activeWorkflowId"
        (click)="workflowSelected.emit(workflow)"
      >
        <strong>{{ workflow.name }}</strong>
        <span>{{ workflow.description }}</span>
      </button>
    </aside>
  `,
  styleUrl: './workflow-explorer.component.scss'
})
export class WorkflowExplorerComponent {
  @Input({ required: true }) workflows: Workflow[] = [];
  @Input({ required: true }) activeWorkflowId = '';
  @Output() workflowSelected = new EventEmitter<Workflow>();
}
