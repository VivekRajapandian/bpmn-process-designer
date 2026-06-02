# `sample-workflows.service.ts` Explained

File:

```text
src/app/services/sample-workflows.service.ts
```

This service provides built-in demo workflows and creates blank starter workflows.

## Built-In Samples

`getSamples()` returns:

- Customer Onboarding Workflow
- Invoice Approval Workflow
- Support Ticket Escalation Workflow

The built-in samples are Camunda 8 workflows because their XML includes Zeebe extension metadata.

Each sample includes:

- `id`
- `name`
- `engineType`
- `bpmnXml`
- `createdAt`
- `updatedAt`
- `description`
- `status`

## Blank Workflows

```ts
createBlankWorkflow(engineType: EngineType): Workflow
```

The workspace calls this after the user chooses a target engine in the New dialog.

For Camunda 8, the blank workflow includes:

- Zeebe namespace
- `zeebe:taskDefinition`

For Camunda 7, the blank workflow includes:

- Camunda namespace
- a `bpmn:serviceTask`
- Camunda Platform-compatible task metadata

The engine-specific blank XML helps the properties panel open with the right engine context immediately.

## Why BPMN DI Matters

The XML constants include BPMN diagram interchange elements:

```text
bpmndi:BPMNShape
dc:Bounds
bpmndi:BPMNEdge
di:waypoint
```

These are what make the diagram appear with visible layout positions on the canvas.

## Flow

Startup:

```text
WorkflowStateService
  -> SampleWorkflowsService.getSamples()
  -> WorkflowStorageService.hydrate(samples)
```

New workflow:

```text
New dialog
  -> selected engine
  -> createBlankWorkflow(engineType)
  -> workspace overrides default name with user-entered name
```
