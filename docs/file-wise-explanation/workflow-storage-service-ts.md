# `workflow-storage.service.ts` Explained

File:

```text
src/app/services/workflow-storage.service.ts
```

`WorkflowStorageService` is the browser persistence layer. It stores workflow JSON in `localStorage`; it does not use a backend or write files to disk.

## Storage Keys

```ts
const WORKFLOW_KEY = 'bpmn-process-designer.current-workflow';
const WORKFLOWS_KEY = 'bpmn-process-designer.saved-workflows';
```

- `WORKFLOW_KEY` remembers the last active workflow.
- `WORKFLOWS_KEY` stores all locally saved workflows by id.

## `load()`

Reads the current workflow from `WORKFLOW_KEY`.

The stored JSON is normalized before being returned. If the JSON is corrupt, the bad key is removed and `null` is returned.

## `save(workflow)`

Writes the workflow to both storage locations:

```text
saved-workflows map
current-workflow
```

This lets the app restore the last active workflow and still list saved workflows in the left panel.

## `loadWorkflow(id)`

Looks up one workflow from the saved workflow map.

Used when selecting workflows from the explorer.

## `hydrate(workflows)`

Merges built-in sample workflows with saved local workflows.

Output order:

```text
custom saved workflows, newest updated first
built-in samples, overlaid with any saved versions
```

This is why newly created/imported workflows appear in the left panel after refresh.

## Normalization

`normalizeWorkflow(...)` protects the app from older localStorage records and partially missing data.

It:

- defaults missing `engineType` to Camunda 8
- migrates older `xml` values to `bpmnXml`
- fills missing timestamps
- fills missing description/status

This lets older browser data continue to open after the workflow model changed.

## Limitations

This is MVP persistence:

- data is per browser origin
- data is not shared between users or devices
- clearing browser storage deletes workflows
- Export should be used when a real `.bpmn` file is needed
