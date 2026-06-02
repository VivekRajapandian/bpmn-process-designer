# Camunda 8 Runtime Integration Logging Guide

This guide explains the browser console logs emitted by the Play Mode runtime bridge.

Use this when debugging the path from Play mode token simulation to local Camunda 8 deployment, process instance start, user-task completion, service-task job completion, message-event logging, and message correlation.

## Log Prefixes

The runtime path uses two main prefixes:

- `[PlayRuntime]` for Play mode state, token simulator events, deployment orchestration, instance-start guards, user-task coordination, service-task job coordination, and message-event correlation decisions
- `[Camunda8]` for REST API calls, authentication, response normalization, and API errors

Filter the browser console by either prefix to reduce noise.

## Expected Startup Logs

When the BPMN workspace initializes, `PlayRuntimeIntegrationService` subscribes to the `bpmn-js` event bus:

```text
[PlayRuntime] Initializing PlayRuntimeIntegrationService
[PlayRuntime] Subscribing to token simulator events...
[PlayRuntime] Initialization complete - Ready to intercept token simulation
[PlayRuntime] setPlayModeActive(false) called ...
```

At this point no Camunda call should happen. Token simulation can be toggled in Design mode, but the runtime bridge ignores it unless Play mode is active.

## Play Mode Activation

Switching to Play mode calls:

```text
[Workspace] Mode changed: design -> play ...
[PlayRuntime] setPlayModeActive(true) called ...
```

If token simulation is not already active, the workspace enables it. The runtime bridge then observes:

```text
[PlayRuntime] tokenSimulation.toggleMode received (active=true, playModeActive=true, ...)
```

That event starts deployment for the current BPMN.

## Deployment Logs

Deployment begins with BPMN export and process-id detection:

```text
[PlayRuntime] ensureDeployment called ...
[PlayRuntime] Deploy current diagram started
[PlayRuntime] BPMN XML exported successfully
[PlayRuntime] Executable process ID from modeler: CustomerProcess
[PlayRuntime] Starting Camunda 8 deployment for process: "CustomerProcess"
```

`Camunda8ClientService` sends the BPMN as multipart form data:

```text
[Camunda8] Deploying BPMN file: "process.bpmn" to /camunda8-api/v2/deployments
[Camunda8] POST /camunda8-api/v2/deployments multipart field=resources fileName=process.bpmn
```

If bearer authentication is enabled and no valid cached token exists, you should also see:

```text
[Camunda8] Access token missing or expiring soon - requesting a new token
[Camunda8] POST /camunda-auth/realms/camunda-platform/protocol/openid-connect/token token request ...
[Camunda8] Access token received (expires_in=...)
```

Successful deployment logs the deployment key and normalized process definitions:

```text
[Camunda8] Deployment successful - Key: 2251799813685249
[Camunda8] Normalized deployed process definitions: [...]
[PlayRuntime] BPMN deployment success (deploymentKey=..., processDefinitionId=..., processDefinitionVersion=...)
[PlayRuntime] Camunda 8 deployment complete; waiting for play to start instance
```

## Instance Start Logs

Starting the simulator play button emits:

```text
[PlayRuntime] tokenSimulation.playSimulation received ...
[PlayRuntime] startProcessInstance requested ...
```

The client starts the instance using the deployed process definition id and version:

```text
[Camunda8] Starting process instance for: "CustomerProcess" v1 at /camunda8-api/v2/process-instances
[Camunda8] POST /camunda8-api/v2/process-instances start instance body: ...
[Camunda8] Process instance started - Key: 2251799813685250
[PlayRuntime] Process Instance START SUCCESS - Instance Key: "2251799813685250"
```

Repeated play/pause clicks in the same manual session should not create duplicate instances. In that case you may see:

```text
[PlayRuntime] Start blocked: instance already started for this simulation session
```

## Auto-Complete Logs

Manual mode completes a Camunda user task when the simulated user-task token is resumed:

```text
[PlayRuntime] tokenSimulation.simulator.trace received (action=signal, element=UserTask_..., type=bpmn:UserTask, ...)
[Camunda8] POST /camunda8-api/v2/user-tasks/search search user tasks body: ...
[PlayRuntime] Manual user task lookup 1/10 for "UserTask_...": ...
[Camunda8] POST /camunda8-api/v2/user-tasks/{key}/completion complete user task body: ...
[Camunda8] User task completed - Key: ...
```

Manual mode also keeps service-task tokens paused. When the simulated service-task token is resumed, the bridge activates and completes the matching Camunda job:

```text
[PlayRuntime] tokenSimulation.simulator.trace received (action=signal, element=ServiceTask_..., type=bpmn:ServiceTask, ...)
[Camunda8] POST /camunda8-api/v2/jobs/activation activate jobs body: ...
[Camunda8] POST /camunda8-api/v2/jobs/{jobKey}/completion complete job body: ...
[Camunda8] Job completed - Key: ...
```

Auto-complete mode completes a matching Camunda user task when simulation enters a BPMN user task:

```text
[PlayRuntime] tokenSimulation.simulator.trace received (action=enter, element=UserTask_..., type=bpmn:UserTask, ...)
[PlayRuntime] Waiting for Camunda user task at UserTask_...
[Camunda8] User task search response: ...
[PlayRuntime] Auto-completed user task ...
```

If no matching task is found, the service logs a warning and leaves the editor usable.

Auto-complete mode also completes a matching Camunda job when simulation enters a BPMN service task with a Zeebe task definition type:

```text
[PlayRuntime] tokenSimulation.simulator.trace received (action=enter, element=ServiceTask_..., type=bpmn:ServiceTask, ...)
[PlayRuntime] Activating Camunda job for service task ServiceTask_... (job-type)...
[Camunda8] POST /camunda8-api/v2/jobs/activation activate jobs body: ...
[Camunda8] Job activation response: ...
[Camunda8] POST /camunda8-api/v2/jobs/{jobKey}/completion complete job body: ...
[Camunda8] Job completed - Key: ...
[PlayRuntime] Auto-completed service task job ...
```

If a service task has no `zeebe:taskDefinition` type, the bridge cannot activate a Camunda job for it.

## Message Event Trace Logs

If a BPMN message event is reached by token simulation, the trace handler logs its message metadata:

```text
[PlayRuntime] Message event trace detected: {
  action: "enter",
  elementId: "Event_...",
  elementType: "bpmn:BoundaryEvent",
  messageEventDefinitionId: "MessageEventDefinition_...",
  messageId: "Message_...",
  messageName: "CustomerMessage",
  attachedToId: "UserTask_...",
  attachedToType: "bpmn:UserTask"
}
```

Message correlation follows the same manual/auto-complete behavior as tasks:

- In manual mode, correlation fires on trace action `signal`, after the paused token is resumed.
- In auto-complete mode, correlation fires on trace action `enter`.

When the eligible trace action is received, the runtime bridge calls the Camunda message correlation endpoint with the detected message name and the current hardcoded correlation key `123`:

```text
[PlayRuntime] Correlating message test-message with key 123...
[PlayRuntime] Message correlation decision (action=signal, element=Event_..., messageName=test-message, playModeActive=true, tokenSimulationActive=true, alreadyCorrelated=false)
[PlayRuntime] correlateMessageEvent requested (element=Event_..., messageName=test-message, correlationKey=123, playModeActive=true, tokenSimulationActive=true)
[PlayRuntime] Calling Camunda message correlation API (messageName=test-message, correlationKey=123, element=Event_...)
[Camunda8] POST /camunda8-api/v2/messages/correlation correlate message body: {
  name: "test-message",
  correlationKey: "123",
  variables: {}
}
[Camunda8] Message correlated - Process Instance Key: ...
[PlayRuntime] Message correlation API response: ...
```

This uses message correlation, not message publication/buffering.

If the API call does not fire, check the decision log. Common skip reasons are:

- in manual mode, trace action has not reached `signal` yet
- in auto-complete mode, trace action is not `enter`
- Play mode is not active
- token simulation is not active
- the message event already correlated in the current runtime session
- the BPMN message has no name

For boundary message events attached to a task, the token simulator may trace the task rather than the boundary event element. In that case the runtime bridge looks up message boundary events attached to the traced task and logs those as `Message event trace detected` too.

Attached boundary-message lookups are log-only. They do not call the correlation API because a normal user-task resume can also trace the attached task, and correlating at that point would interrupt user-task completion. Correlation is only allowed when the traced element itself is the message event.

## Reset Logs

Turning token simulation off or resetting it in Play mode clears the runtime session:

```text
[PlayRuntime] tokenSimulation.resetSimulation received ...
[PlayRuntime] Runtime session reset ...
```

Turning Play mode off also resets the runtime session and returns the status to idle.

## Common Failures

`Failed to deploy BPMN XML`

- Camunda 8 API is not reachable through `/camunda8-api`
- `proxy.conf.json` target does not match the local runtime port
- BPMN deployment validation failed
- bearer token request failed or returned an unusable token

`No executable process found in BPMN diagram`

- the current BPMN has no executable process id available to the modeler

`Failed to start process instance`

- deployment did not return the expected process definition
- the process definition id/version is not startable
- Camunda returned an authorization or validation error

`Failed to search user tasks` or `Failed to complete user task`

- the process instance key is missing or stale
- user-task APIs are unavailable
- the configured token/client lacks permissions
- the simulated user task cannot be matched to an open Camunda user task

`Failed to activate jobs` or `Failed to complete job`

- the service task has no Zeebe job type
- no job of that type is available yet
- another worker already activated or completed the job
- the activated job does not belong to the current process instance
- the configured token/client lacks job permissions

## Local Configuration Checklist

- Angular is running with `npm start`, which uses `proxy.conf.json`.
- `src/environments/environment.ts` has `restAddress: '/camunda8-api'`.
- `authStrategy` is `BEARER` when the local runtime requires OAuth.
- `/camunda8-api` points to the local Camunda 8 REST API, currently `http://localhost:8088`.
- `/camunda-auth` points to the local auth server path, currently `http://localhost:18080/auth`.
- The BPMN contains an executable process and deployable Camunda 8 metadata.
