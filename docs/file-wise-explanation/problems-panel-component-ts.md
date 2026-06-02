# `problems-panel.component.ts` Explained

File location:

`src/app/problems-panel/problems-panel.component.ts`

This component displays validation results at the bottom of the BPMN workspace. It receives a list of problems from the parent and emits an event when the user clicks a problem.

It does not validate XML itself. Validation lives in `WorkflowValidationService`.

Spring Boot comparison:

This is like a read-only view component for validation messages. It receives data from a controller/service and raises a UI event when the user selects one.

## Imports

```ts
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { WorkflowProblem } from '../models/workflow-problem.model';
```

- `CommonModule` allows `*ngFor` and `*ngIf` in the template.
- `Component` registers the class as an Angular component.
- `Input` receives data from the parent.
- `Output` sends events to the parent.
- `EventEmitter` creates Angular events.
- `WorkflowProblem` defines the shape of each validation problem.

## Component Metadata

```ts
@Component({
  selector: 'app-problems-panel',
  standalone: true,
  imports: [CommonModule],
  template: `...`,
  styleUrl: './problems-panel.component.scss'
})
```

### `selector`

The workspace uses this component as:

```html
<app-problems-panel
  [problems]="problems"
  (problemSelected)="focusProblem($event)">
</app-problems-panel>
```

### `standalone: true`

The component is self-contained and imported directly by the workspace.

### `imports: [CommonModule]`

This is needed because the template uses:

```html
*ngFor
*ngIf
```

### `template`

The template loops over problems and creates one clickable row per problem:

```html
<button
  *ngFor="let problem of problems"
  type="button"
  class="problem"
  [class.error]="problem.severity === 'error'"
  [class.warning]="problem.severity === 'warning'"
  (click)="problemSelected.emit(problem)"
>
```

Important pieces:

- `*ngFor`: repeats the button for every problem.
- `[class.error]`: adds CSS class when severity is error.
- `[class.warning]`: adds CSS class when severity is warning.
- `(click)`: emits the selected problem to the parent.

```html
<code *ngIf="problem.elementId">{{ problem.elementId }}</code>
```

This shows the BPMN element id only when the problem has one.

```html
<p *ngIf="!problems.length">No validation problems...</p>
```

This shows an empty state when validation returns no problems.

## Input

```ts
@Input({ required: true }) problems: WorkflowProblem[] = [];
```

The parent passes validation problems into the component.

Spring Boot comparison:

This is similar to passing a list of validation errors into a server-rendered view model.

## Output

```ts
@Output() problemSelected = new EventEmitter<WorkflowProblem>();
```

This creates an event that sends the clicked problem back to the parent.

The parent handles it:

```ts
focusProblem(problem: WorkflowProblem): void {
  this.bpmnAdapter.focusElement(problem.elementId);
}
```

## Flow

```text
User clicks Validate
  -> workspace calls WorkflowValidationService
  -> problems are stored in WorkflowStateService
  -> workspace receives problems
  -> passes problems to ProblemsPanelComponent
  -> user clicks a problem
  -> ProblemsPanelComponent emits problemSelected
  -> workspace asks BPMN adapter to focus the BPMN element
```

## Why This File Matters

It gives the POC a clear validation feedback area while keeping validation logic out of the UI component.

