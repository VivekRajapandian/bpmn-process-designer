# Models Explained

Folder:

```text
src/app/models/
```

These files define the small data contracts used by the Angular BPMN designer. They are similar to DTOs and enums in a Spring Boot application.

## `engine-type.enum.ts`

```ts
export enum EngineType {
  CAMUNDA_7 = 'CAMUNDA_7',
  CAMUNDA_8 = 'CAMUNDA_8'
}
```

`EngineType` locks a workflow to either Camunda 7 or Camunda 8. The value is chosen when the workflow is created or imported and is not changed afterward.

The UI renders these as:

```text
Camunda 7
Camunda 8
```

## `workflow.model.ts`

```ts
export interface Workflow {
  id: string;
  name: string;
  engineType: EngineType;
  bpmnXml: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  status: WorkflowStatus;
}
```

Fields:

- `id` is the stable local workflow id.
- `name` is the local display name shown in the header and workflow explorer.
- `engineType` is the locked Camunda target engine.
- `bpmnXml` is the BPMN XML content.
- `createdAt` is the local creation/import timestamp.
- `updatedAt` is the latest local metadata/XML update timestamp.
- `description` is the short text shown in the left explorer.
- `status` is the UI state: clean, dirty, or invalid.

`name` is local metadata. Renaming a workflow does not rewrite BPMN process ids or element ids inside `bpmnXml`.

## `workflow-status.enum.ts`

```ts
export enum WorkflowStatus {
  Clean = 'clean',
  Dirty = 'dirty',
  Invalid = 'invalid'
}
```

Status meanings:

- `Clean`: saved locally and no unsaved edits are pending.
- `Dirty`: the diagram or metadata has unsaved edits.
- `Invalid`: validation found at least one error.

## `workflow-problem.model.ts`

```ts
export type WorkflowProblemSeverity = 'error' | 'warning' | 'info';

export interface WorkflowProblem {
  id: string;
  message: string;
  severity: WorkflowProblemSeverity;
  elementId?: string;
}
```

`WorkflowProblem` drives the bottom Problems panel. If `elementId` is present, clicking the problem can ask the BPMN adapter to focus that BPMN element.

## Why Models Matter

These models keep components and services aligned:

```text
Workflow = local BPMN workflow and metadata
EngineType = Camunda target engine lock
WorkflowStatus = clean/dirty/invalid UI state
WorkflowProblem = validation result
```
