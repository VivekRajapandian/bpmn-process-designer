# Validation And Problems Panel Flow

This document explains how local validation works and how validation problems appear in the bottom Problems panel.

## Components And Services Involved

- `WorkflowValidationService`  
  Custom lightweight validator that checks BPMN XML text.

- `ProblemsPanelComponent`  
  Custom Angular component that displays validation results.

- `BpmnWorkspaceComponent`  
  Runs validation, stores problems in state, and focuses BPMN elements when a problem is clicked.

- `WorkflowStateService`  
  Stores the current list of problems and marks workflow status invalid if an error exists.

- `BpmnModelerAdapterService`  
  Focuses/selects the BPMN element associated with a problem.

## What Validation Checks

File:

```text
src/app/services/workflow-validation.service.ts
```

The validator checks:

- invalid XML
- missing process name
- task without name
- basic Zeebe `taskDefinition` requirements for job-worker task types
- exclusive gateway outgoing flows that need a condition or default flow

This is not full Camunda 8 validation. It is a lightweight local MVP validator.

## Validate Button Flow

Toolbar emits:

```html
<button type="button" (click)="validate.emit()">Validate</button>
```

Workspace receives:

```html
<app-toolbar
  ...
  (validate)="validate()"
/>
```

Workspace handler:

```ts
validate(): void {
  this.workflowState.setProblems(this.workflowValidation.validate(this.workflow.xml));
  this.saveMessage = '';
}
```

## Save Also Runs Validation

When saving, the app validates the exact XML that was saved:

```ts
async saveLocally(): Promise<void> {
  const xml = await this.bpmnAdapter.saveXml();
  const saved = this.workflowState.markSaved(xml);
  this.samples = this.workflowState.samples;
  this.workflowState.setProblems(this.workflowValidation.validate(xml));
  this.saveMessage = `Saved locally at ${new Date(saved.updatedAt).toLocaleTimeString()}`;
}
```

## Invalid XML Check

The validator parses XML:

```ts
const parser = new DOMParser();
const document = parser.parseFromString(xml, 'application/xml');
const parserError = document.querySelector('parsererror');
```

If parsing fails:

```ts
return [
  {
    id: 'invalid-xml',
    message: parserError.textContent?.trim() || 'The BPMN XML is invalid.',
    severity: 'error'
  }
];
```

## Missing Process Name Check

```ts
const process = this.firstByLocalName(document, 'process');

if (!process?.getAttribute('name')?.trim()) {
  problems.push({
    id: 'missing-process-name',
    message: 'Process is missing a name.',
    severity: 'warning',
    elementId: process?.getAttribute('id') || undefined
  });
}
```

## Missing Task Name Check

```ts
if (!task.getAttribute('name')?.trim()) {
  problems.push({
    id: `task-without-name-${id}`,
    message: `${this.humanize(task.localName)} "${id}" is missing a name.`,
    severity: 'warning',
    elementId: id
  });
}
```

## Problem State

File:

```text
src/app/services/workflow-state.service.ts
```

Problems are stored here:

```ts
private readonly problemsSubject = new BehaviorSubject<WorkflowProblem[]>([]);
readonly problems$ = this.problemsSubject.asObservable();
```

Set problems:

```ts
setProblems(problems: WorkflowProblem[]): void {
  this.problemsSubject.next(problems);

  if (problems.some((problem) => problem.severity === 'error')) {
    this.workflowSubject.next({
      ...this.workflow,
      status: WorkflowStatus.Invalid
    });
  }
}
```

If any problem has severity `error`, workflow status becomes `invalid`.

## Problems Panel UI

File:

```text
src/app/problems-panel/problems-panel.component.ts
```

Input:

```ts
@Input({ required: true }) problems: WorkflowProblem[] = [];
```

Output:

```ts
@Output() problemSelected = new EventEmitter<WorkflowProblem>();
```

Template:

```html
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
```

Workspace renders it:

```html
<app-problems-panel
  [problems]="problems"
  (problemSelected)="focusProblem($event)"
/>
```

## Clicking A Problem

Workspace handler:

```ts
focusProblem(problem: WorkflowProblem): void {
  this.bpmnAdapter.focusElement(problem.elementId);
}
```

Adapter:

```ts
focusElement(elementId?: string): void {
  if (!elementId || !this.modeler) {
    return;
  }

  const registry = this.modeler.get('elementRegistry');
  const selection = this.modeler.get('selection');
  const canvas = this.modeler.get('canvas');
  const element = registry.get(elementId);

  if (!element) {
    return;
  }

  selection.select(element);
  canvas.scrollToElement(element);
}
```

This uses `bpmn-js` services to select and scroll to the related BPMN element.

## Small Diagram

```text
User clicks Validate or Save
        |
        v
BpmnWorkspaceComponent runs workflowValidation.validate(xml)
        |
        v
WorkflowValidationService returns WorkflowProblem[]
        |
        v
WorkflowStateService.setProblems()
        |
        v
BpmnWorkspaceComponent receives problems$
        |
        v
ProblemsPanelComponent displays problems
        |
        v
User clicks problem
        |
        v
BpmnModelerAdapterService.focusElement(elementId)
        |
        v
bpmn-js selects/scrolls to BPMN element
```

## Important Lines Triggered In Order

### Validate

```html
(validate)="validate()"
```

```ts
this.workflowValidation.validate(this.workflow.xml)
```

```ts
this.workflowState.setProblems(...)
```

```ts
this.problemsSubject.next(problems);
```

```html
<app-problems-panel [problems]="problems" />
```

### Problem Click

```html
(click)="problemSelected.emit(problem)"
```

```html
(problemSelected)="focusProblem($event)"
```

```ts
this.bpmnAdapter.focusElement(problem.elementId);
```

```ts
selection.select(element);
canvas.scrollToElement(element);
```

## Key Design Point

Validation is custom Angular logic. Element focusing uses `bpmn-js`.

```text
Validation rules = custom MVP logic
Problems display = Angular
Element select/scroll = bpmn-js services
```
