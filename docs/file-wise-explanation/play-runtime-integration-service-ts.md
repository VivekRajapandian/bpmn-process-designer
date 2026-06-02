# play-runtime-integration.service.ts

File:

```text
src/app/core/play-mode/play-runtime-integration.service.ts
```

## Purpose

`PlayRuntimeIntegrationService` coordinates the boundary between browser-side token simulation and the experimental local Camunda 8 runtime.

It listens to `bpmn-js-token-simulation` events from the modeler event bus, but only calls Camunda when the workspace is in Play mode.

## Main Types

`TaskHandlingMode` controls runtime auto-complete behavior:

```ts
type TaskHandlingMode = 'manual' | 'auto-complete';
```

`RuntimeStatus` is the state shown by the runtime status component:

```ts
state: 'idle' | 'waiting' | 'deploying' | 'starting' | 'success' | 'error'
message: string
processInstanceKey?: string
error?: string
```

The service publishes status through a `BehaviorSubject`, exposed as an observable by `getStatus()`.

## Dependencies

The service depends on:

- `BpmnModelerAdapterService` for modeler access, event bus access, XML export, executable process id lookup, and token continuation helpers
- `Camunda8ClientService` for deployment, instance start, user-task search/completion, and service-task job activation/completion

This keeps Camunda REST details out of the workspace component and keeps modeler details out of the Camunda client.

## Initialization

`initialize()` reads the modeler event bus and subscribes to token simulation events:

- `tokenSimulation.playSimulation`
- `tokenSimulation.simulator.createScope`
- `tokenSimulation.simulator.trace`
- `tokenSimulation.resetSimulation`
- `tokenSimulation.pauseSimulation`
- `tokenSimulation.toggleMode`

The trace handler is the main runtime bridge. It detects user tasks, service tasks, and message events from `tokenSimulation.simulator.trace`.

Initialization also sets the first status to:

```text
Play mode is off
```

## Play Mode Guard

`setPlayModeActive(active)` is called by the workspace when the user switches between Design and Play mode.

When Play mode is off:

- runtime session state is reset
- status returns to `idle`
- Camunda calls are blocked

When Play mode is on:

- status moves to `waiting`
- if token simulation is already active, deployment starts

Token simulation can still run locally outside Play mode, but this service will not deploy or start anything for it.

## Deployment Flow

Deployment starts through `ensureDeployment()`.

The service guards deployment with:

- `deploymentTriggered`
- `deploymentPromise`
- `deployedProcessDefinition`

This prevents duplicate deployments during the same token-simulation session.

`deployCurrentDiagram()`:

1. updates status to `deploying`
2. exports current BPMN XML through `modelerAdapter.saveXml()`
3. gets the executable process id through `modelerAdapter.getExecutableProcessId()`
4. deploys the XML through `camunda8Client.deployBpmnXml()`
5. finds the deployed process definition id and version
6. stores the deployed definition
7. updates status to waiting for simulator play

If deployment fails, the deployment guard is reset so the user can retry.

## Process Instance Start Flow

`startProcessInstance()` is triggered by:

- `tokenSimulation.playSimulation`
- root-level `tokenSimulation.simulator.createScope`

It blocks starting when:

- Play mode is off
- token simulation is off
- an instance is already started or starting for the current manual session
- no deployed process definition is available

On success, it stores the Camunda process instance key and updates status to `success`.

## Task Handling

The service supports two modes.

`manual`:

- user tasks and service tasks get simulator wait points
- Camunda user tasks wait in the runtime
- Camunda service tasks wait for jobs to be activated and completed
- when token simulation emits a user-task resume signal, `completeUserTaskAfterTokenResume()` looks up and completes the matching Camunda user task
- when token simulation emits a service-task resume signal, `completeServiceTaskJobAtElement()` activates and completes the matching Camunda job
- when token simulation emits a direct message-event resume signal, `correlateMessageEvent()` correlates the message

`auto-complete`:

- when token simulation enters a BPMN user task, `autoCompleteUserTaskAtElement()` waits for a matching Camunda user task
- the matching task is completed
- the simulated token is continued through `modelerAdapter.continueUserTaskToken()`
- when token simulation enters a BPMN service task, `completeServiceTaskJobAtElement()` reads the service task's Zeebe job type
- one Camunda job of that type is activated
- if the activated job belongs to the current process instance, the job is completed
- the simulated service-task token is continued through `modelerAdapter.continueTaskToken()`
- when token simulation enters a direct BPMN message event, the message is correlated immediately

Matching uses the BPMN element id when Camunda returns one of:

- `elementId`
- `flowNodeId`
- `taskDefinitionId`
- `bpmnElementId`

If exactly one open user task exists, the service can use it as a fallback.

Service-task jobs are different from user tasks. A service task creates a Camunda job, so the bridge must act like a small job worker:

```text
service task token enters
  -> read zeebe:taskDefinition type from the BPMN element
  -> activate one job of that type through /v2/jobs/activation
  -> prefer a job matching the current process instance and BPMN element id
  -> complete the job through /v2/jobs/{jobKey}/completion
```

The service distinguishes the two BPMN element kinds through the token simulator trace event:

```ts
element.type === 'bpmn:UserTask'
element.type === 'bpmn:ServiceTask'
```

The job type is read from the service task business object:

```text
businessObject.extensionElements.values
  -> zeebe:TaskDefinition
  -> type
```

## Message Event Handling

Message events are detected by checking whether the traced BPMN element has a `bpmn:MessageEventDefinition`.

`logMessageEventTrace()` records:

- trace action
- message event element id/type
- message event definition id
- BPMN message id/name
- attached task id/type for boundary events
- whether the trace is allowed to correlate

Direct message-event traces may correlate. Attached boundary-message events discovered from a task trace are log-only because the token simulator often traces the task when the user resumes a paused user task. Letting those attached lookups correlate would break normal user-task completion.

Correlation timing follows the task handling mode:

- `manual`: correlate on `signal`
- `auto-complete`: correlate on `enter`

`correlateMessageEvent()` currently calls:

```text
Camunda8ClientService.correlateMessage(messageName, '123')
```

The correlation key is intentionally hardcoded for the current experiment and should become configurable later.

## Reset Behavior

`resetRuntimeSession()` clears:

- deployment guard
- instance-start guard
- stored deployed process definition
- stored process instance key
- in-progress user-task completion ids
- in-progress service-task job completion ids
- correlated message event ids
- user-task pause points in the modeler

It runs when token simulation is reset, token simulation is turned off in Play mode, or Play mode is turned off.

Pause does not reset the runtime session, which prevents accidental duplicate deployments and instance starts during play/pause interactions.

## Logging

Logs use the `[PlayRuntime]` prefix and include guard state such as:

- `playModeActive`
- `tokenSimulationActive`
- `deploymentTriggered`
- `instanceStarted`
- `processInstanceKey`

These logs are intentionally verbose because the runtime bridge spans Angular state, token simulator events, and Camunda REST calls.

## What This Service Does Not Do

This service does not:

- implement the token simulator
- render runtime UI
- make raw HTTP requests directly
- manage workflow persistence
- validate BPMN before deployment beyond requiring an executable process id
- implement a production-grade job worker
- support Camunda 7 runtime execution
