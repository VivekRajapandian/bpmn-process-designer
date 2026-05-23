import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { WorkflowProblem } from '../models/workflow-problem.model';

@Component({
  selector: 'app-problems-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section>
      <header>
        <h2>Problems</h2>
        <span>{{ problems.length }} found</span>
      </header>

      <button
        *ngFor="let problem of problems"
        type="button"
        class="problem"
        [class.error]="problem.severity === 'error'"
        [class.warning]="problem.severity === 'warning'"
        (click)="problemSelected.emit(problem)"
      >
        <strong>{{ problem.severity }}</strong>
        <span>{{ problem.message }}</span>
        <code *ngIf="problem.elementId">{{ problem.elementId }}</code>
      </button>

      <p *ngIf="!problems.length">No validation problems. The current XML passes the MVP checks.</p>
    </section>
  `,
  styleUrl: './problems-panel.component.scss'
})
export class ProblemsPanelComponent {
  @Input({ required: true }) problems: WorkflowProblem[] = [];
  @Output() problemSelected = new EventEmitter<WorkflowProblem>();
}
