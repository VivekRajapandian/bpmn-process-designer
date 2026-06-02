# Toolbar Action Flow

This document explains how the top toolbar works, which components/services are involved, and what code runs for each toolbar action.

## Components And Services Involved

- `ToolbarComponent`  
  Custom Angular component that renders the toolbar buttons and emits events when the user clicks them.

- `BpmnWorkspaceComponent`  
  Parent Angular component that receives toolbar events and decides what each action should do.

- `BpmnModelerAdapterService`  
  Wrapper around `bpmn-js`; performs modeler actions like import XML, save XML, undo, redo, and zoom.

- `WorkflowStateService`  
  Keeps current workflow state, dirty/clean status, saved workflow data, and validation problems.

- `WorkflowStorageService`  
  Saves workflows to browser `localStorage` when the Save action is triggered.

- `WorkflowValidationService`  
  Runs lightweight local validation when Validate or Save is triggered.

- `SampleWorkflowsService`  
  Creates a blank BPMN workflow when the New action is triggered.

Token simulation is not a toolbar action. It is provided inside the BPMN canvas by `bpmn-js-token-simulation`.

## Toolbar Component

File:

```text
src/app/toolbar/toolbar.component.ts
```

The toolbar receives the current workflow status:

```ts
@Input({ required: true }) status = WorkflowStatus.Clean;
```

The status is shown in the toolbar:

```html
<span [class.dirty]="status === workflowStatus.Dirty" [class.invalid]="status === workflowStatus.Invalid">
  {{ status }}
</span>
```

The toolbar does not directly call `bpmn-js`, storage, validation, or workflow services.

Instead, it emits events:

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

This keeps the toolbar simple and reusable.

Play Mode controls are intentionally absent from this list. The simulation plugin owns its own canvas UI for toggling, playing, pausing, and resetting token simulation.

## Workspace Toolbar Wiring

File:

```text
src/app/bpmn-workspace/bpmn-workspace.component.html
```

The workspace listens to toolbar events:

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
  (zoomOut)="zoomOut()"
/>
```

Small diagram:

```text
User clicks toolbar button
        |
        v
ToolbarComponent emits Angular event
        |
        v
BpmnWorkspaceComponent receives event
        |
        v
Workspace calls adapter/state/storage/validation service
```

## New Diagram Flow

Toolbar button:

```html
<button type="button" (click)="newDiagram.emit()">New</button>
```

Workspace handler:

```ts
async newDiagram(): Promise<void> {
  if (!this.canDiscardChanges()) {
    return;
  }

  await this.loadWorkflow(this.sampleWorkflows.createBlankWorkflow(), true);
}
```

Important steps:

1. User clicks New.
2. Toolbar emits `newDiagram`.
3. Workspace calls `newDiagram()`.
4. Workspace checks unsaved changes with `canDiscardChanges()`.
5. `SampleWorkflowsService` creates a blank BPMN XML workflow.
6. Workspace loads that workflow into `bpmn-js`.
7. New diagram is marked dirty.

Flow:

```text
New button
  -> newDiagram.emit()
  -> BpmnWorkspaceComponent.newDiagram()
  -> canDiscardChanges()
  -> sampleWorkflows.createBlankWorkflow()
  -> loadWorkflow(blankWorkflow, true)
  -> bpmnAdapter.importXml(workflow.xml)
```

## Import Flow

Toolbar file input:

```html
<input type="file" accept=".bpmn,.xml,text/xml" (change)="onImport($event)" />
```

Toolbar handler:

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

Workspace handler:

```ts
async importDiagram(file: File): Promise<void> {
  if (!this.canDiscardChanges()) {
    return;
  }

  const xml = await file.text();
  const workflow: Workflow = {
    id: `import-${Date.now()}`,
    name: file.name.replace(/\.(bpmn|xml)$/i, '') || 'Imported BPMN',
    description: 'Imported from a local BPMN/XML file.',
    xml,
    updatedAt: new Date().toISOString(),
    status: WorkflowStatus.Dirty
  };

  await this.loadWorkflow(workflow, true);
}
```

Flow:

```text
Import file selected
  -> onImport($event)
  -> importDiagram.emit(file)
  -> BpmnWorkspaceComponent.importDiagram(file)
  -> file.text()
  -> create Workflow object
  -> loadWorkflow(importedWorkflow, true)
  -> bpmnAdapter.importXml(xml)
```

## Export Flow

Toolbar button:

```html
<button type="button" (click)="exportDiagram.emit()">Export</button>
```

Workspace handler:

```ts
async exportDiagram(): Promise<void> {
  const xml = await this.bpmnAdapter.saveXml();
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${this.slugify(this.workflow.name)}.bpmn`;
  anchor.click();
  URL.revokeObjectURL(url);
}
```

Important detail:

```ts
const xml = await this.bpmnAdapter.saveXml();
```

This asks `bpmn-js` for the latest BPMN XML before downloading the file.

Flow:

```text
Export button
  -> exportDiagram.emit()
  -> BpmnWorkspaceComponent.exportDiagram()
  -> bpmnAdapter.saveXml()
  -> bpmn-js modeler.saveXML()
  -> create Blob
  -> download .bpmn file
```

## Save Flow

Toolbar button:

```html
<button type="button" class="primary" (click)="save.emit()">Save</button>
```

Workspace handler:

```ts
async saveLocally(): Promise<void> {
  const xml = await this.bpmnAdapter.saveXml();
  const saved = this.workflowState.markSaved(xml);
  this.samples = this.workflowState.samples;
  this.workflowState.setProblems(this.workflowValidation.validate(xml));
  this.saveMessage = `Saved locally at ${new Date(saved.updatedAt).toLocaleTimeString()}`;
}
```

State service:

```ts
const saved = {
  ...this.workflow,
  xml,
  updatedAt: new Date().toISOString(),
  status: WorkflowStatus.Clean
};
```

Storage service:

```ts
localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
localStorage.setItem(WORKFLOW_KEY, JSON.stringify(workflow));
```

Flow:

```text
Save button
  -> save.emit()
  -> BpmnWorkspaceComponent.saveLocally()
  -> bpmnAdapter.saveXml()
  -> workflowState.markSaved(xml)
  -> workflowStorage.save(workflow)
  -> localStorage updated
  -> workflow status becomes clean
  -> saved message shown
```

## Validate Flow

Toolbar button:

```html
<button type="button" (click)="validate.emit()">Validate</button>
```

Workspace handler:

```ts
validate(): void {
  this.workflowState.setProblems(this.workflowValidation.validate(this.workflow.xml));
  this.saveMessage = '';
}
```

Validation service checks:

- invalid XML
- missing process name
- missing task name
- exclusive gateway outgoing flows without condition/default
- basic Zeebe task definition rules for job-worker task types

Flow:

```text
Validate button
  -> validate.emit()
  -> BpmnWorkspaceComponent.validate()
  -> workflowValidation.validate(workflow.xml)
  -> workflowState.setProblems(problems)
  -> ProblemsPanelComponent displays results
```

## Undo Flow

Toolbar button:

```html
<button type="button" title="Undo" (click)="undo.emit()">Undo</button>
```

Workspace handler:

```ts
undo(): void {
  this.bpmnAdapter.undo();
}
```

Adapter:

```ts
undo(): void {
  this.commandStack().undo();
}
```

Flow:

```text
Undo button
  -> undo.emit()
  -> BpmnWorkspaceComponent.undo()
  -> bpmnAdapter.undo()
  -> bpmn-js commandStack.undo()
  -> commandStack.changed fires
  -> workspace captures updated XML
  -> workflow becomes dirty
```

## Redo Flow

Toolbar button:

```html
<button type="button" title="Redo" (click)="redo.emit()">Redo</button>
```

Workspace handler:

```ts
redo(): void {
  this.bpmnAdapter.redo();
}
```

Adapter:

```ts
redo(): void {
  this.commandStack().redo();
}
```

Flow:

```text
Redo button
  -> redo.emit()
  -> BpmnWorkspaceComponent.redo()
  -> bpmnAdapter.redo()
  -> bpmn-js commandStack.redo()
  -> commandStack.changed fires
  -> workspace captures updated XML
  -> workflow becomes dirty
```

## Zoom In Flow

Toolbar button:

```html
<button type="button" title="Zoom in" (click)="zoomIn.emit()">+</button>
```

Workspace handler:

```ts
zoomIn(): void {
  this.bpmnAdapter.zoomIn();
}
```

Adapter:

```ts
zoomIn(): void {
  this.setZoom(this.zoomLevel + 0.15);
}
```

Zoom helper:

```ts
private setZoom(level: number): void {
  this.ensureModeler();
  this.zoomLevel = Math.min(2.4, Math.max(0.3, level));
  this.modeler.get('canvas').zoom(this.zoomLevel);
}
```

Flow:

```text
Zoom in button
  -> zoomIn.emit()
  -> BpmnWorkspaceComponent.zoomIn()
  -> bpmnAdapter.zoomIn()
  -> setZoom(current + 0.15)
  -> bpmn-js canvas.zoom(level)
```

## Zoom Out Flow

Toolbar button:

```html
<button type="button" title="Zoom out" (click)="zoomOut.emit()">-</button>
```

Workspace handler:

```ts
zoomOut(): void {
  this.bpmnAdapter.zoomOut();
}
```

Adapter:

```ts
zoomOut(): void {
  this.setZoom(this.zoomLevel - 0.15);
}
```

Flow:

```text
Zoom out button
  -> zoomOut.emit()
  -> BpmnWorkspaceComponent.zoomOut()
  -> bpmnAdapter.zoomOut()
  -> setZoom(current - 0.15)
  -> bpmn-js canvas.zoom(level)
```

## Status Display Flow

The toolbar receives this input:

```html
[status]="workflow.status"
```

The status can be:

```text
clean
dirty
invalid
```

Where status changes:

- `WorkflowStatus.Dirty` when diagram XML changes after editing.
- `WorkflowStatus.Clean` when user saves locally.
- `WorkflowStatus.Invalid` when validation finds an error.

Flow:

```text
WorkflowStateService updates workflow.status
        |
        v
BpmnWorkspaceComponent receives workflow$
        |
        v
workspace.workflow.status changes
        |
        v
ToolbarComponent receives [status]
        |
        v
toolbar status badge updates
```

## Important Lines Triggered In Order

### New

```html
(click)="newDiagram.emit()"
```

```html
(newDiagram)="newDiagram()"
```

```ts
await this.loadWorkflow(this.sampleWorkflows.createBlankWorkflow(), true);
```

```ts
await this.bpmnAdapter.importXml(workflow.xml);
```

### Import

```html
(change)="onImport($event)"
```

```ts
this.importDiagram.emit(file);
```

```html
(importDiagram)="importDiagram($event)"
```

```ts
const xml = await file.text();
```

```ts
await this.loadWorkflow(workflow, true);
```

### Export

```html
(click)="exportDiagram.emit()"
```

```html
(exportDiagram)="exportDiagram()"
```

```ts
const xml = await this.bpmnAdapter.saveXml();
```

```ts
anchor.download = `${this.slugify(this.workflow.name)}.bpmn`;
```

### Save

```html
(click)="save.emit()"
```

```html
(save)="saveLocally()"
```

```ts
const xml = await this.bpmnAdapter.saveXml();
```

```ts
const saved = this.workflowState.markSaved(xml);
```

```ts
localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
```

### Validate

```html
(click)="validate.emit()"
```

```html
(validate)="validate()"
```

```ts
this.workflowValidation.validate(this.workflow.xml)
```

```ts
this.workflowState.setProblems(...)
```

### Undo / Redo

```html
(click)="undo.emit()"
```

```ts
this.bpmnAdapter.undo();
```

```ts
this.commandStack().undo();
```

```html
(click)="redo.emit()"
```

```ts
this.bpmnAdapter.redo();
```

```ts
this.commandStack().redo();
```

### Zoom

```html
(click)="zoomIn.emit()"
```

```ts
this.bpmnAdapter.zoomIn();
```

```ts
this.modeler.get('canvas').zoom(this.zoomLevel);
```

```html
(click)="zoomOut.emit()"
```

```ts
this.bpmnAdapter.zoomOut();
```

```ts
this.modeler.get('canvas').zoom(this.zoomLevel);
```

## Key Design Point

The toolbar is intentionally presentation-focused.

It does not know how BPMN works. It only emits Angular events.

The workspace decides what those events mean, and the adapter/service layer performs the actual BPMN, state, validation, and storage work.

```text
Toolbar = UI events
Workspace = orchestration
Adapter = bpmn-js integration
State/Storage/Validation services = app behavior
```
