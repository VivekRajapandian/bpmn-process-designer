# Workflow Explorer Flow

This document explains how the left workflow explorer works and how selecting a sample workflow loads BPMN XML into the canvas.

## Components And Services Involved

- `WorkflowExplorerComponent`  
  Displays local workflows and emits the selected workflow.

- `BpmnWorkspaceComponent`  
  Receives the selected workflow and loads it into the BPMN modeler.

- `WorkflowStateService`  
  Provides the sample workflows and resolves saved versions from localStorage.

- `WorkflowStorageService`  
  Hydrates samples with saved XML if a workflow was previously saved.

- `SampleWorkflowsService`  
  Provides the built-in sample BPMN XML definitions.

- `BpmnModelerAdapterService`  
  Imports selected workflow XML into `bpmn-js`.

## Workflow Explorer Component

File:

```text
src/app/workflow-explorer/workflow-explorer.component.ts
```

Inputs:

```ts
@Input({ required: true }) workflows: Workflow[] = [];
@Input({ required: true }) activeWorkflowId = '';
```

Output:

```ts
@Output() workflowSelected = new EventEmitter<Workflow>();
```

Template:

```html
<button
  *ngFor="let workflow of workflows"
  type="button"
  [class.active]="workflow.id === activeWorkflowId"
  (click)="workflowSelected.emit(workflow)"
>
  <strong>{{ workflow.name }}</strong>
  <span>{{ workflow.description }}</span>
</button>
```

The explorer does not load BPMN itself. It only emits the selected workflow to the parent workspace.

## Workspace Wiring

File:

```text
src/app/bpmn-workspace/bpmn-workspace.component.html
```

```html
<app-workflow-explorer
  [workflows]="samples"
  [activeWorkflowId]="workflow.id"
  (workflowSelected)="selectWorkflow($event)"
/>
```

The workspace passes:

- `samples` as the list of workflows
- `workflow.id` as the currently active workflow
- `selectWorkflow($event)` as the handler

## Selecting A Workflow

File:

```text
src/app/bpmn-workspace/bpmn-workspace.component.ts
```

```ts
async selectWorkflow(workflow: Workflow): Promise<void> {
  if (workflow.id === this.workflow.id || !this.canDiscardChanges()) {
    return;
  }

  await this.loadWorkflow(this.workflowState.resolveWorkflow(workflow), false);
}
```

Important steps:

1. If the clicked workflow is already active, do nothing.
2. If there are unsaved changes, ask for confirmation.
3. Resolve saved XML for that workflow if it exists.
4. Load the workflow into `bpmn-js`.

## Saved Workflow Resolution

File:

```text
src/app/services/workflow-state.service.ts
```

```ts
resolveWorkflow(workflow: Workflow): Workflow {
  const savedWorkflow = this.workflowStorage.loadWorkflow(workflow.id);

  return savedWorkflow
    ? { ...savedWorkflow, status: WorkflowStatus.Clean }
    : workflow;
}
```

This prevents the app from reverting to the original sample XML after a user saves changes and switches away.

## Loading The Workflow Into The Canvas

File:

```text
src/app/bpmn-workspace/bpmn-workspace.component.ts
```

```ts
private async loadWorkflow(workflow: Workflow, dirty: boolean): Promise<void> {
  try {
    this.isImporting = true;
    this.workflowState.setWorkflow(workflow, dirty);
    await this.bpmnAdapter.importXml(workflow.xml);
    this.workflowState.setProblems(this.workflowValidation.validate(workflow.xml));
  } catch (error) {
    ...
  } finally {
    this.isImporting = false;
  }
}
```

The adapter imports the BPMN XML:

```ts
await this.bpmnAdapter.importXml(workflow.xml);
```

Adapter:

```ts
async importXml(xml: string): Promise<void> {
  this.ensureModeler();
  await this.modeler.importXML(xml);
  this.zoomFit();
}
```

## Small Diagram

```text
User clicks workflow in explorer
        |
        v
WorkflowExplorerComponent emits workflowSelected
        |
        v
BpmnWorkspaceComponent.selectWorkflow()
        |
        v
WorkflowStateService.resolveWorkflow()
        |
        v
BpmnWorkspaceComponent.loadWorkflow()
        |
        v
BpmnModelerAdapterService.importXml()
        |
        v
bpmn-js renders selected BPMN XML
```

## Important Lines Triggered In Order

1. Explorer click:

```html
(click)="workflowSelected.emit(workflow)"
```

2. Workspace receives:

```html
(workflowSelected)="selectWorkflow($event)"
```

3. Workspace checks current workflow and dirty state:

```ts
if (workflow.id === this.workflow.id || !this.canDiscardChanges()) {
  return;
}
```

4. Workspace resolves saved version:

```ts
this.workflowState.resolveWorkflow(workflow)
```

5. Workspace loads workflow:

```ts
await this.loadWorkflow(..., false);
```

6. State updates:

```ts
this.workflowState.setWorkflow(workflow, dirty);
```

7. BPMN XML imports into modeler:

```ts
await this.bpmnAdapter.importXml(workflow.xml);
```

8. Validation runs:

```ts
this.workflowState.setProblems(this.workflowValidation.validate(workflow.xml));
```

## Key Design Point

The explorer does not know anything about `bpmn-js`. It only emits Angular events.

The workspace and adapter handle the BPMN-specific behavior.

```text
Explorer = local workflow selection UI
Workspace = orchestration
State/storage = saved workflow resolution
Adapter = bpmn-js XML import
```
