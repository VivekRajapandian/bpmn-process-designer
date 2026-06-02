# Local Storage And Restore Flow

This document explains how workflows are saved to browser `localStorage`, restored after reload, and preserved when switching between sample workflows.

## Components And Services Involved

- `WorkflowStorageService`  
  Reads and writes workflow data to browser `localStorage`.

- `WorkflowStateService`  
  Initializes app state from saved storage or sample workflows.

- `SampleWorkflowsService`  
  Provides default sample workflows.

- `BpmnWorkspaceComponent`  
  Saves current modeler XML and loads selected/restored workflows into `bpmn-js`.

- `BpmnModelerAdapterService`  
  Serializes BPMN XML from the modeler and imports restored XML back into the canvas.

## Storage Keys

File:

```text
src/app/services/workflow-storage.service.ts
```

```ts
const WORKFLOW_KEY = 'bpmn-process-designer.current-workflow';
const WORKFLOWS_KEY = 'bpmn-process-designer.saved-workflows';
```

The app stores two things:

- `current-workflow` - the last active workflow
- `saved-workflows` - a map of saved workflows by workflow id

## Save To Local Storage

Workspace gets the latest BPMN XML from `bpmn-js`:

```ts
const xml = await this.bpmnAdapter.saveXml();
```

Then marks it saved:

```ts
const saved = this.workflowState.markSaved(xml);
```

State service:

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

Storage service:

```ts
save(workflow: Workflow): void {
  const workflows = this.loadSavedWorkflows();
  workflows[workflow.id] = workflow;

  localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
  localStorage.setItem(WORKFLOW_KEY, JSON.stringify(workflow));
}
```

## Restore On App Startup

File:

```text
src/app/services/workflow-state.service.ts
```

Constructor:

```ts
this.samples = this.workflowStorage.hydrate(this.sampleWorkflows.getSamples());
const savedWorkflow = this.workflowStorage.load();
this.workflowSubject = new BehaviorSubject<Workflow>(
  savedWorkflow ? { ...savedWorkflow, status: WorkflowStatus.Clean } : this.samples[0]
);
this.workflow$ = this.workflowSubject.asObservable();
```

Startup behavior:

1. Load built-in sample workflows.
2. Hydrate samples with any saved versions from localStorage.
3. Load the last active workflow from localStorage.
4. If no saved workflow exists, use the first sample.
5. Mark restored workflow as `clean`.

Then workspace loads the workflow into the BPMN modeler:

```ts
await this.loadWorkflow(this.workflow, false);
```

Inside `loadWorkflow`:

```ts
this.workflowState.setWorkflow(workflow, dirty);
await this.bpmnAdapter.importXml(workflow.xml);
this.workflowState.setProblems(this.workflowValidation.validate(workflow.xml));
```

## Preserve Saved Workflows When Switching

When a user switches workflows, the app does not blindly load the original sample.

It checks for a saved version first:

```ts
resolveWorkflow(workflow: Workflow): Workflow {
  const savedWorkflow = this.workflowStorage.loadWorkflow(workflow.id);

  return savedWorkflow
    ? { ...savedWorkflow, status: WorkflowStatus.Clean }
    : workflow;
}
```

Workspace uses this during selection:

```ts
await this.loadWorkflow(this.workflowState.resolveWorkflow(workflow), false);
```

This is why saved edits can survive:

- browser refresh
- app restart
- switching to another sample workflow and back

## Hydrating Samples

Storage service:

```ts
hydrate(workflows: Workflow[]): Workflow[] {
  const savedWorkflows = this.loadSavedWorkflows();

  return workflows.map((workflow) => ({
    ...workflow,
    ...savedWorkflows[workflow.id]
  }));
}
```

This overlays saved workflow XML onto the built-in sample list when ids match.

## Handling Bad Stored JSON

Current workflow load:

```ts
try {
  return JSON.parse(raw) as Workflow;
} catch {
  localStorage.removeItem(WORKFLOW_KEY);
  return null;
}
```

Saved workflow map load:

```ts
try {
  return JSON.parse(raw) as Record<string, Workflow>;
} catch {
  localStorage.removeItem(WORKFLOWS_KEY);
  return {};
}
```

If localStorage contains invalid JSON, the app removes the bad key and falls back safely.

## Small Diagram

```text
User clicks Save
        |
        v
bpmn-js saveXML()
        |
        v
WorkflowStateService.markSaved()
        |
        v
WorkflowStorageService.save()
        |
        v
localStorage current-workflow + saved-workflows
```

```text
Browser reload / app restart
        |
        v
WorkflowStateService constructor
        |
        v
WorkflowStorageService.load()
        |
        v
saved workflow or first sample selected
        |
        v
BpmnWorkspaceComponent.loadWorkflow()
        |
        v
bpmn-js importXML()
```

## Important Lines Triggered In Order

### Save

```ts
const xml = await this.bpmnAdapter.saveXml();
```

```ts
const saved = this.workflowState.markSaved(xml);
```

```ts
this.workflowStorage.save(saved);
```

```ts
localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
```

```ts
localStorage.setItem(WORKFLOW_KEY, JSON.stringify(workflow));
```

### Restore

```ts
this.samples = this.workflowStorage.hydrate(this.sampleWorkflows.getSamples());
```

```ts
const savedWorkflow = this.workflowStorage.load();
```

```ts
savedWorkflow ? { ...savedWorkflow, status: WorkflowStatus.Clean } : this.samples[0]
```

```ts
await this.loadWorkflow(this.workflow, false);
```

```ts
await this.bpmnAdapter.importXml(workflow.xml);
```

### Switch Workflow

```html
(workflowSelected)="selectWorkflow($event)"
```

```ts
this.workflowState.resolveWorkflow(workflow)
```

```ts
this.workflowStorage.loadWorkflow(workflow.id)
```

```ts
await this.loadWorkflow(..., false);
```

## What Local Storage Does Not Do

Local storage does not create a `.bpmn` file on disk.

For a disk file, use Export:

```text
Export button -> browser downloads .bpmn file
```

Local storage is browser-specific. Data can be lost if:

- browser site data is cleared
- private/incognito session is closed
- a different browser profile is used
- origin changes from `localhost:4200` to `127.0.0.1:4200`

## Key Design Point

There are three separate states:

```text
bpmn-js internal diagram model
Angular workflow state
browser localStorage
```

Save bridges them:

```text
bpmn-js saveXML()
  -> Angular WorkflowStateService
  -> WorkflowStorageService
  -> localStorage
```
