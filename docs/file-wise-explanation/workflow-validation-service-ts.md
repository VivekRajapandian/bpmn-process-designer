# `workflow-validation.service.ts` Explained

File:

```text
src/app/services/workflow-validation.service.ts
```

This service performs lightweight local validation against BPMN XML. It is not a full BPMN semantic validator and does not replace Camunda deployment validation.

## API

```ts
validate(xml: string, engineType = EngineType.CAMUNDA_8): WorkflowProblem[]
```

`engineType` matters because Camunda 7 and Camunda 8 have different execution metadata.

## Shared Checks

The validator always checks:

- XML parses successfully.
- The first BPMN process has a name.
- Tasks have names.
- Exclusive gateways with multiple outgoing flows have either conditions or a default flow.

## Camunda 8 Check

For Camunda 8 only, executable job-capable tasks must have exactly one `zeebe:taskDefinition`.

This applies to:

- `task`
- `serviceTask`
- `scriptTask`
- `businessRuleTask`
- `sendTask`
- `receiveTask`

If the workflow is Camunda 7, this Zeebe rule is skipped. That prevents Camunda 7 diagrams from showing false Camunda 8 deployment errors.

## Problem Output

Each validation result is a `WorkflowProblem`:

```ts
{
  id: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  elementId?: string;
}
```

When `elementId` is present, the Problems panel can ask the BPMN adapter to focus that element.

## Flow

```text
User clicks Validate
  -> BpmnWorkspaceComponent.validate()
  -> WorkflowValidationService.validate(workflow.bpmnXml, workflow.engineType)
  -> WorkflowStateService.setProblems(...)
  -> ProblemsPanelComponent displays results
```
