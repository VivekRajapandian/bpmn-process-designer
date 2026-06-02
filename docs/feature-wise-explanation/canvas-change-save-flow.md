# BPMN Canvas Change And Save Flow

This document explains how the BPMN canvas works in this Angular POC, which components/services are involved, and what happens when a user changes the diagram and saves it.

## Components And Services Involved

- `BpmnWorkspaceComponent`  
  Main Angular page controller. It wires the canvas, toolbar, properties panel, workflow state, validation, and storage flow together.

- `BpmnCanvasComponent`  
  Small Angular host component that exposes the real `<div>` where `bpmn-js` renders the BPMN canvas.

- `PropertiesPanelComponent`  
  Small Angular host component that exposes the real `<div>` where `bpmn-js-properties-panel` renders the inspector.

- `ToolbarComponent`  
  Angular toolbar that emits user actions like Save, Import, Export, Undo, Redo, and Zoom.

- `BpmnModelerAdapterService`  
  Angular wrapper around `bpmn-js`. It creates the BPMN modeler, imports/exports XML, listens for modeler changes, and destroys the modeler.

- `WorkflowStateService`  
  Angular/RxJS state service. It keeps the current workflow XML, dirty/clean status, samples, and problems in memory.

- `WorkflowStorageService`  
  Browser storage service. It saves and loads BPMN XML from `localStorage`.

- `WorkflowValidationService`  
  Lightweight local validator used after save/validate.

## How The Canvas Is Created

The canvas starts as a normal Angular template div:

```ts
template: '<div #canvas class="bpmn-canvas"></div>'
```

File:

```text
src/app/bpmn-canvas/bpmn-canvas.component.ts
```

Angular captures that div with `ViewChild`:

```ts
@ViewChild('canvas', { static: true })
private readonly canvasRef!: ElementRef<HTMLElement>;
```

The component exposes the real DOM element:

```ts
get element(): HTMLElement {
  return this.canvasRef.nativeElement;
}
```

The workspace passes that DOM element into the BPMN adapter:

```ts
this.bpmnAdapter.initialize(this.canvas.element, this.propertiesPanel.element);
```

File:

```text
src/app/bpmn-workspace/bpmn-workspace.component.ts
```

The adapter gives that DOM element to `bpmn-js`:

```ts
this.modeler = new Modeler({
  container: canvas,
  propertiesPanel: {
    parent: propertiesPanel
  },
  additionalModules: [
    BpmnPropertiesPanelModule,
    BpmnPropertiesProviderModule,
    ZeebePropertiesProviderModule
  ],
  moddleExtensions: {
    zeebe: zeebeModdle
  }
});
```

File:

```text
src/app/services/bpmn-modeler-adapter.service.ts
```

At this point, `bpmn-js` renders the BPMN diagram inside the Angular canvas div.

## Small Diagram

```text
Angular template div
        |
        v
BpmnCanvasComponent exposes HTMLElement
        |
        v
BpmnWorkspaceComponent passes HTMLElement to adapter
        |
        v
BpmnModelerAdapterService creates new bpmn-js Modeler
        |
        v
bpmn-js renders BPMN canvas, palette, shapes, and connections
```

## What Happens When The User Changes The Canvas

Example user actions:

- Rename a task
- Move a BPMN shape
- Add a task
- Connect two elements
- Change a property in the right inspector

These edits happen inside the `bpmn-js` modeler first.

The adapter listens for modeler changes:

```ts
const eventBus = this.modeler.get('eventBus');
eventBus.on('commandStack.changed', () => {
  this.zone.run(() => this.changed$.next());
});
```

File:

```text
src/app/services/bpmn-modeler-adapter.service.ts
```

`commandStack.changed` is a `bpmn-js` event. It means the diagram command stack changed because the user edited something.

The adapter emits:

```ts
this.changed$.next()
```

`changed$` is an RxJS subject:

```ts
readonly changed$ = new Subject<void>();
```

The workspace subscribes to that event:

```ts
this.subscription.add(
  this.bpmnAdapter.changed$.subscribe(() => {
    void this.captureCurrentXml(true);
  })
);
```

File:

```text
src/app/bpmn-workspace/bpmn-workspace.component.ts
```

Then the workspace captures the latest BPMN XML:

```ts
private async captureCurrentXml(dirty: boolean): Promise<void> {
  if (this.isImporting) {
    return;
  }

  const xml = await this.bpmnAdapter.saveXml();
  this.workflowState.setXml(xml, dirty);
  this.saveMessage = '';
}
```

The adapter asks `bpmn-js` to serialize the current visual diagram:

```ts
async saveXml(): Promise<string> {
  this.ensureModeler();
  const result = await this.modeler.saveXML({ format: true });
  return result.xml;
}
```

Then the workflow state is updated:

```ts
setXml(xml: string, dirty = true): void {
  this.workflowSubject.next({
    ...this.workflow,
    xml,
    updatedAt: new Date().toISOString(),
    status: dirty ? WorkflowStatus.Dirty : WorkflowStatus.Clean
  });
}
```

File:

```text
src/app/services/workflow-state.service.ts
```

At this point:

- The in-memory workflow XML is updated.
- The workflow is marked `dirty`.
- The toolbar status changes to `dirty`.
- The change is not permanently saved yet.

## Change Flow Diagram

```text
User edits BPMN canvas
        |
        v
bpmn-js updates internal BPMN model
        |
        v
bpmn-js emits commandStack.changed
        |
        v
BpmnModelerAdapterService catches event
        |
        v
adapter emits changed$
        |
        v
BpmnWorkspaceComponent calls captureCurrentXml(true)
        |
        v
adapter calls modeler.saveXML()
        |
        v
WorkflowStateService stores updated XML in memory
        |
        v
workflow status becomes dirty
```

## What Happens When The User Clicks Save

The Save button is in the toolbar:

```html
<button type="button" class="primary" (click)="save.emit()">Save</button>
```

File:

```text
src/app/toolbar/toolbar.component.ts
```

The workspace listens to the toolbar save event:

```html
<app-toolbar
  ...
  (save)="saveLocally()"
/>
```

File:

```text
src/app/bpmn-workspace/bpmn-workspace.component.html
```

The workspace runs:

```ts
async saveLocally(): Promise<void> {
  const xml = await this.bpmnAdapter.saveXml();
  const saved = this.workflowState.markSaved(xml);
  this.samples = this.workflowState.samples;
  this.workflowState.setProblems(this.workflowValidation.validate(xml));
  this.saveMessage = `Saved locally at ${new Date(saved.updatedAt).toLocaleTimeString()}`;
}
```

Important detail: Save asks the BPMN adapter for fresh XML again:

```ts
const xml = await this.bpmnAdapter.saveXml();
```

This makes sure localStorage receives the latest diagram state from `bpmn-js`.

Then state marks the workflow as saved:

```ts
markSaved(xml: string): Workflow {
  const saved = {
    ...this.workflow,
    xml,
    updatedAt: new Date().toISOString(),
    status: WorkflowStatus.Clean
  };

  this.workflowStorage.save(saved);
  this.updateSample(saved);
  this.workflowSubject.next(saved);

  return saved;
}
```

File:

```text
src/app/services/workflow-state.service.ts
```

The storage service writes to browser `localStorage`:

```ts
save(workflow: Workflow): void {
  const workflows = this.loadSavedWorkflows();
  workflows[workflow.id] = workflow;

  localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
  localStorage.setItem(WORKFLOW_KEY, JSON.stringify(workflow));
}
```

File:

```text
src/app/services/workflow-storage.service.ts
```

Storage keys:

```ts
const WORKFLOW_KEY = 'bpmn-process-designer.current-workflow';
const WORKFLOWS_KEY = 'bpmn-process-designer.saved-workflows';
```

## Save Flow Diagram

```text
User clicks Save
        |
        v
ToolbarComponent emits save
        |
        v
BpmnWorkspaceComponent.saveLocally()
        |
        v
adapter calls modeler.saveXML()
        |
        v
WorkflowStateService.markSaved(xml)
        |
        v
WorkflowStorageService.save(workflow)
        |
        v
localStorage is updated
        |
        v
workflow status becomes clean
```

## Important Lines Triggered In Order

### On App Startup

1. Workspace initializes adapter:

```ts
this.bpmnAdapter.initialize(this.canvas.element, this.propertiesPanel.element);
```

2. Adapter creates `bpmn-js` modeler:

```ts
this.modeler = new Modeler({ container: canvas, ... });
```

3. Workspace loads current/default workflow:

```ts
await this.loadWorkflow(this.workflow, false);
```

4. Adapter imports BPMN XML:

```ts
await this.modeler.importXML(xml);
```

### On Canvas Change

1. `bpmn-js` fires:

```ts
eventBus.on('commandStack.changed', ...)
```

2. Adapter emits:

```ts
this.changed$.next()
```

3. Workspace receives:

```ts
this.bpmnAdapter.changed$.subscribe(...)
```

4. Workspace captures XML:

```ts
void this.captureCurrentXml(true);
```

5. Adapter serializes XML:

```ts
const result = await this.modeler.saveXML({ format: true });
```

6. Workflow state marks dirty:

```ts
this.workflowState.setXml(xml, true);
```

### On Save

1. Toolbar emits:

```html
(click)="save.emit()"
```

2. Workspace handles:

```html
(save)="saveLocally()"
```

3. Workspace gets latest XML:

```ts
const xml = await this.bpmnAdapter.saveXml();
```

4. Workflow state marks saved:

```ts
const saved = this.workflowState.markSaved(xml);
```

5. Storage writes to localStorage:

```ts
localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
localStorage.setItem(WORKFLOW_KEY, JSON.stringify(workflow));
```

6. UI shows saved message:

```ts
this.saveMessage = `Saved locally at ${new Date(saved.updatedAt).toLocaleTimeString()}`;
```

## Key Difference: Dirty State Vs Saved State

Canvas change:

```text
updates Angular memory only
marks workflow dirty
```

Save button:

```text
writes latest BPMN XML to browser localStorage
marks workflow clean
```

Export button:

```text
downloads latest BPMN XML as a .bpmn file
```

So the app has three separate concepts:

- Current visual BPMN diagram inside `bpmn-js`
- Current XML/state inside Angular memory
- Saved XML inside browser `localStorage`
