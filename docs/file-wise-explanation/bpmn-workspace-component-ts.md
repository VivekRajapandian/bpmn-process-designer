# `bpmn-workspace.component.ts` Explained

File:

```text
src/app/bpmn-workspace/bpmn-workspace.component.ts
```

This is the main page coordinator for the BPMN modeler. It receives UI events, calls services, and keeps the toolbar, explorer, canvas, properties panel, XML viewer, and Problems panel in sync.

## Responsibilities

- Initialize the BPMN adapter after Angular creates the canvas and properties panel DOM elements.
- Load the active workflow into the engine-specific modeler.
- Capture BPMN XML after visual edits.
- Run validation with the workflow's locked engine type.
- Handle New, Import, Rename, Save, Export, Validate, Undo, Redo, and Zoom.
- Coordinate Design/Play mode, token simulation toggling, runtime status, and task auto-complete mode.
- Show the workflow details dialog for creation, import, and rename.
- Protect dirty workflows with a browser unload warning and discard confirmation.

## Local Types

```ts
type RightPanel = 'properties' | 'xml';
type WorkspaceMode = 'design' | 'play';

interface WorkflowDetails {
  name: string;
  engineType: EngineType;
}
```

`RightPanel` controls the right panel tab. `WorkspaceMode` controls whether the workspace is editing BPMN or coordinating Play mode runtime behavior. `WorkflowDetails` is the result returned by the modal used for New, Import, and Rename.

## Engine Choice And Naming Dialog

The component stores dialog state in `engineChoice`.

For New and Import, the dialog shows:

- workflow name
- target engine radio buttons

For Rename, it shows:

- workflow name only

This keeps engine type immutable after creation/import while still allowing the local workflow display name to change.

## Creating A New Workflow

Flow:

```text
New button
  -> canDiscardChanges()
  -> editWorkflowDetails(...)
  -> SampleWorkflowsService.createBlankWorkflow(engineType)
  -> override default name with user-provided name
  -> loadWorkflow(workflow, true)
```

Camunda 8 is the default engine selection.

## Importing A Workflow

Flow:

```text
Import button
  -> canDiscardChanges()
  -> read File text
  -> editWorkflowDetails(...) with filename as default name
  -> create Workflow with selected engineType and bpmnXml
  -> loadWorkflow(workflow, true)
```

The app does not auto-detect or convert the BPMN engine.

## Renaming A Workflow

Flow:

```text
Rename button
  -> name-only dialog
  -> WorkflowStateService.renameWorkflow(name)
  -> update local list and save message
```

Renaming changes local workflow metadata. It does not modify BPMN XML ids or process names.

## Loading Workflows

`loadWorkflow(workflow, dirty)` does the shared load work:

```text
set isImporting
  -> workflowState.setWorkflow(workflow, dirty)
  -> bpmnAdapter.initializeForEngine(workflow.engineType)
  -> bpmnAdapter.importXml(workflow.bpmnXml)
  -> workflowValidation.validate(workflow.bpmnXml, workflow.engineType)
```

`isImporting` prevents modeler import events from being treated as user edits.

## Capturing XML

When the BPMN adapter emits `changed$`, the workspace exports the current XML and calls:

```ts
workflowState.setXml(xml, true)
```

This updates `bpmnXml`, marks the workflow dirty, and refreshes the left workflow list.

## Saving Locally

Save flow:

```text
bpmnAdapter.saveXml()
  -> workflowState.markSaved(xml)
  -> workflowValidation.validate(xml, saved.engineType)
  -> show save message
```

Save writes to `localStorage`. Export downloads a `.bpmn` file.

## Play Mode And Runtime Coordination

The workspace owns the app-level mode switch:

```text
Design
Play mode
```

`setWorkspaceMode(mode)` updates local mode state and calls:

```ts
runtimeIntegration.setPlayModeActive(mode === 'play')
```

When entering Play mode, the workspace turns token simulation on if needed. When returning to Design mode, it turns token simulation off and resets local token state.

The workspace observes `tokenSimulation.toggleMode` from the modeler event bus so the Angular UI stays in sync with simulator state.

The Play mode `Auto-complete` checkbox calls:

```ts
runtimeIntegration.setTaskHandlingMode(mode)
```

That lets the runtime bridge choose between manual resume-driven behavior and generic auto-complete behavior for user tasks, service-task jobs, and direct message-event correlation.

The workspace also subscribes to `runtimeIntegration.getStatus()` so it can block the canvas while deployment is in progress.

## Important Boundaries

The workspace does not directly manipulate BPMN internals. It delegates to:

- `BpmnModelerAdapterService` for modeler operations.
- `WorkflowStateService` for workflow state and rename/save.
- `WorkflowValidationService` for validation.
- `SampleWorkflowsService` for starter BPMN XML.
- `PlayRuntimeIntegrationService` for Play mode Camunda 8 runtime orchestration.
