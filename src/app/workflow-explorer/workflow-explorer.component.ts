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

      <div
        *ngFor="let workflow of workflows"
        class="workflow-row"
        [class.active]="workflow.id === activeWorkflowId"
      >
        <button
          type="button"
          class="workflow-select"
          (click)="workflowSelected.emit(workflow)"
        >
          <strong>{{ workflow.name }}</strong>
          <span>{{ workflow.description }}</span>
        </button>
        <button
          *ngIf="deletableWorkflowIds.includes(workflow.id)"
          type="button"
          class="delete-button"
          title="Delete local workflow"
          aria-label="Delete local workflow"
          (click)="workflowDeleted.emit(workflow)"
        >
          Delete
        </button>
      </div>
    </aside>
  `,
  styleUrl: './workflow-explorer.component.scss'
})
export class WorkflowExplorerComponent {
  @Input({ required: true }) workflows: Workflow[] = [];
  @Input({ required: true }) activeWorkflowId = '';
  @Input() deletableWorkflowIds: string[] = [];
  @Output() workflowSelected = new EventEmitter<Workflow>();
  @Output() workflowDeleted = new EventEmitter<Workflow>();
}
