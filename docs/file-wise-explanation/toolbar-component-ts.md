# `toolbar.component.ts` Explained

File location:

`src/app/toolbar/toolbar.component.ts`

This component renders the top toolbar and emits user actions to the parent workspace.

It does not call `bpmn-js`, validation, or localStorage directly. That is intentional. The toolbar is a UI event source. The workspace decides what each action means.

Spring Boot comparison:

Think of this like a thin controller boundary for button clicks. It receives user input and forwards the intent, but it does not contain the business/integration logic.

## Imports

```ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { WorkflowStatus } from '../models/workflow-status.enum';
```

- `Component` registers this class as an Angular component.
- `Input` receives data from the parent.
- `Output` sends events to the parent.
- `EventEmitter` creates events.
- `WorkflowStatus` is the enum used for clean/dirty/invalid status.

## Component Metadata

```ts
@Component({
  selector: 'app-toolbar',
  standalone: true,
  template: `...`,
  styleUrl: './toolbar.component.scss'
})
```

### `selector`

The workspace uses the toolbar as:

```html
<app-toolbar
  [status]="workflow.status"
  (newDiagram)="newDiagram()"
  (importDiagram)="importDiagram($event)"
  (exportDiagram)="exportDiagram()"
  (save)="saveLocally()"
  (validate)="validate()"
  (undo)="undo()"
  (redo)="redo()"
  (zoomIn)="zoomIn()"
  (zoomOut)="zoomOut()">
</app-toolbar>
```

### `standalone: true`

The toolbar can be imported directly into `BpmnWorkspaceComponent`.

### `template`

The template contains:

- app title
- status badge
- New button
- Import file input
- Export button
- Save button
- Validate button
- Undo/Redo buttons
- Zoom buttons
- No Play Mode buttons; token simulation controls are provided inside the BPMN canvas by `bpmn-js-token-simulation`.

Because the HTML is short enough, it is inline in the TypeScript file instead of a separate `.html` file.

### `styleUrl`

The SCSS file controls the toolbar layout, button styles, status colors, and spacing.

## Input

```ts
@Input({ required: true }) status = WorkflowStatus.Clean;
```

The parent passes the current workflow status into the toolbar.

The template uses it here:

```html
<span [class.dirty]="status === workflowStatus.Dirty" [class.invalid]="status === workflowStatus.Invalid">
  {{ status }}
</span>
```

This means:

- show the current status text
- apply dirty styling when status is dirty
- apply invalid styling when status is invalid

Spring Boot comparison:

This is like putting `workflow.status` into a view model so the view can display it.

## Outputs

```ts
@Output() newDiagram = new EventEmitter<void>();
@Output() importDiagram = new EventEmitter<File>();
@Output() exportDiagram = new EventEmitter<void>();
@Output() save = new EventEmitter<void>();
@Output() validate = new EventEmitter<void>();
@Output() undo = new EventEmitter<void>();
@Output() redo = new EventEmitter<void>();
@Output() zoomIn = new EventEmitter<void>();
@Output() zoomOut = new EventEmitter<void>();
```

Each `@Output` creates an event the parent can listen to.

`EventEmitter<void>` means the event carries no data.

`EventEmitter<File>` means the event carries a selected browser file.

Spring Boot comparison:

This is event/callback style. In Spring MVC, a button might submit to an endpoint. In Angular, the child component emits an event to its parent.

## WorkflowStatus Field

```ts
readonly workflowStatus = WorkflowStatus;
```

This makes the enum available inside the HTML template.

Angular templates cannot directly use imported TypeScript values unless they are exposed through the component class.

## Button Events

Example:

```html
<button type="button" (click)="newDiagram.emit()">New</button>
```

When clicked, the toolbar emits `newDiagram`.

The workspace listens and calls:

```ts
newDiagram(): Promise<void>
```

The toolbar does not create the diagram itself.

## Import File Handling

```html
<input type="file" accept=".bpmn,.xml,text/xml" (change)="onImport($event)" />
```

This opens the browser file picker.

The `accept` attribute suggests BPMN/XML files.

```ts
onImport(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (file) {
    this.importDiagram.emit(file);
    input.value = '';
  }
}
```

Line by line:

- `event.target as HTMLInputElement`: tells TypeScript this event came from an input element.
- `input.files?.[0]`: reads the first selected file safely.
- `this.importDiagram.emit(file)`: sends the file to the workspace.
- `input.value = ''`: clears the input so the same file can be selected again later.

## Flow

```text
User clicks toolbar button
  -> ToolbarComponent emits event
  -> BpmnWorkspaceComponent handles event
  -> workspace calls adapter/state/storage/validation service
```

## Why This File Matters

The toolbar is clean because it only owns user interaction. BPMN behavior stays outside this file.

This makes the UI easy to redesign later without changing the BPMN integration.

Play Mode follows the same boundary. The Angular toolbar does not duplicate Play, Pause, Reset, or step controls because token simulation is owned by the `bpmn-js-token-simulation` plugin inside the canvas.
