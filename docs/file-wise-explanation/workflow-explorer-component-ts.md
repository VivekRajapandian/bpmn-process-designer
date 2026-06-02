# `workflow-explorer.component.ts` Explained

File:

```text
src/app/workflow-explorer/workflow-explorer.component.ts
```

This component renders the left workflow list. It is intentionally simple: it receives workflows from the workspace and emits the selected workflow when the user clicks one.

## What It Displays

The list can contain:

- locally created workflows
- locally imported workflows
- built-in sample workflows
- saved versions of built-in sample workflows

The header says `Local workflows` because the panel is no longer sample-only.

## Inputs

```ts
@Input({ required: true }) workflows: Workflow[] = [];
@Input({ required: true }) activeWorkflowId = '';
```

`workflows` is the list to render. `activeWorkflowId` marks the current workflow as active.

## Output

```ts
@Output() workflowSelected = new EventEmitter<Workflow>();
```

The component does not load BPMN XML. It emits the selected workflow and lets `BpmnWorkspaceComponent` handle discard confirmation, engine-specific modeler initialization, XML import, and validation.

## Template Flow

```text
WorkflowStateService.samples
  -> BpmnWorkspaceComponent.samples
  -> <app-workflow-explorer [workflows]="samples">
  -> user click
  -> workflowSelected
  -> BpmnWorkspaceComponent.selectWorkflow(...)
```
