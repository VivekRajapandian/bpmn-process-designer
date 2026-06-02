# Engine And Workflow Management

This document captures the current Camunda 7 / Camunda 8 workflow behavior in the Angular BPMN designer.

## Workflow Metadata

Each workflow is represented by:

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

`name` is local app metadata and can be renamed from the workspace header. Renaming does not rewrite BPMN process ids, element ids, or XML names.

`engineType` is selected at creation or import time and is locked afterward.

## Engine Types

```ts
export enum EngineType {
  CAMUNDA_7 = 'CAMUNDA_7',
  CAMUNDA_8 = 'CAMUNDA_8'
}
```

The UI displays these values as `Camunda 7` and `Camunda 8`.

## Creation Flow

When the user clicks New:

1. The workspace checks whether unsaved changes can be discarded.
2. A dialog asks for workflow name and target engine.
3. Camunda 8 is selected by default.
4. `SampleWorkflowsService.createBlankWorkflow(engineType)` creates engine-specific starter BPMN XML.
5. The workflow is loaded into the modeler and shown in the left workflow list.

## Import Flow

When the user imports `.bpmn` or `.xml`:

1. The file text is read in the browser.
2. A dialog asks for local workflow name and target engine.
3. The app stores the selected engine with the imported XML.
4. The app does not auto-detect the engine and does not convert the BPMN.

## Rename Flow

The Rename button in the workspace header opens a name-only dialog. On submit:

1. `WorkflowStateService.renameWorkflow(name)` updates local workflow metadata.
2. `WorkflowStorageService.save(workflow)` persists the metadata.
3. The header and left workflow list update.

## Engine-Specific Modeler Configuration

`BpmnModelerAdapterService` owns the `bpmn-js` modeler instance. It recreates the modeler when the active workflow engine changes.

Camunda 7 uses:

- `CamundaPlatformPropertiesProviderModule`
- `camunda-bpmn-moddle`
- `camunda-bpmn-js-behaviors/lib/camunda-platform`

Camunda 8 uses:

- `ZeebePropertiesProviderModule`
- `zeebe-bpmn-moddle`
- `camunda-bpmn-js-behaviors/lib/camunda-cloud`

Both modeler stacks also include `bpmn-js-token-simulation` for client-side token simulation.

Token simulation itself is independent of the selected Camunda engine target. The experimental runtime bridge is separate: when the workspace is in Play mode and token simulation is enabled, the app can deploy the current BPMN to a configured local Camunda 8 runtime, start a process instance, complete user tasks, complete service-task jobs, detect message events, and correlate direct message-event traces with a temporary hardcoded correlation key. There is no Camunda 7 runtime bridge.

The Camunda 7 and Camunda 8 moddle descriptors are not loaded together because both define some overlapping properties, including `modelerTemplate`. Loading both into the same modeler causes moddle descriptor conflicts.

## Persistence

Workflows are stored in `localStorage` under:

```text
bpmn-process-designer.current-workflow
bpmn-process-designer.saved-workflows
```

The current workflow key remembers the last active workflow. The saved workflows key stores the full local workflow map.

Older saved records that used `xml` are normalized to `bpmnXml` and default to Camunda 8 on read.

## Validation

Validation is lightweight and local.

Shared checks:

- invalid XML
- missing process name
- unnamed tasks
- exclusive gateway outgoing flows without conditions/default flow

Camunda 8-only check:

- executable job-capable tasks must have exactly one `zeebe:taskDefinition`

Camunda 7 workflows do not run the Zeebe task definition rule.

## Explicit Non-Goals

This release does not include:

- conversion between Camunda 7 and Camunda 8
- changing engine type after creation/import
- production-grade Camunda deployment
- a backend gateway
- Camunda 7 runtime execution from Play Mode
- forms, variables, production job workers, incidents, or Operate overlays
- configurable message correlation keys
- migration tooling

Conversion is intentionally out of scope because Camunda 7 and Camunda 8 differ in namespaces, execution semantics, expression languages, extension properties, and BPMN coverage.
