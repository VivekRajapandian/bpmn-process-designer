# `workflow-state.service.ts` Explained

File:

```text
src/app/services/workflow-state.service.ts
```

`WorkflowStateService` is the in-memory source of truth for the active workflow, the workflow list, and validation problems.

## Responsibilities

- Store the active `Workflow`.
- Store validation `WorkflowProblem[]`.
- Expose RxJS streams so components react to changes.
- Keep the left workflow list updated with built-in samples and local workflows.
- Update BPMN XML after canvas edits.
- Save workflows through `WorkflowStorageService`.
- Rename workflows.

## Startup

Constructor flow:

```text
SampleWorkflowsService.getSamples()
  -> WorkflowStorageService.hydrate(samples)
  -> WorkflowStorageService.load()
  -> initialize workflowSubject
```

`hydrate(...)` returns built-in samples plus saved custom workflows.

## Workflow List

The service field is still named `samples`, but it now contains all workflows shown in the left panel:

- saved custom created/imported workflows
- hydrated built-in sample workflows

`upsertWorkflow(...)` updates an existing workflow in the list or inserts a new workflow at the top.

## `setWorkflow(workflow, dirty)`

Sets the active workflow and updates the left workflow list.

Used by:

- startup load
- selecting a workflow
- creating a workflow
- importing a workflow

## `setXml(xml, dirty)`

Updates `workflow.bpmnXml` after BPMN canvas edits. It also updates `updatedAt`, status, and the left workflow list.

This method does not write to `localStorage`; Save does that.

## `renameWorkflow(name)`

Updates local workflow metadata:

```text
name
updatedAt
```

It persists immediately through `WorkflowStorageService.save(...)`, updates the workflow list, emits the renamed workflow, and returns it.

Renaming does not edit BPMN XML.

## `markSaved(xml)`

Creates a clean saved workflow object with the latest `bpmnXml`, persists it to `localStorage`, updates the list, emits the clean workflow, and returns it.

## `resolveWorkflow(workflow)`

When the user selects a workflow from the left panel, this checks localStorage for a saved version first. If found, it returns the saved workflow as clean. Otherwise it returns the provided workflow.

## Problem State

`setProblems(problems)` emits validation problems. If any problem has severity `error`, the active workflow status becomes `Invalid`.

## Flow Summary

Canvas edit:

```text
bpmn-js changed
  -> workspace captures XML
  -> setXml(xml, true)
  -> UI shows dirty state
```

Rename:

```text
workspace rename dialog
  -> renameWorkflow(name)
  -> localStorage save
  -> header and explorer update
```

Save:

```text
workspace Save
  -> markSaved(xml)
  -> localStorage save
  -> UI shows clean state
```
