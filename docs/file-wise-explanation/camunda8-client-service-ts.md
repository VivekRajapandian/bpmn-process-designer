# camunda8-client.service.ts

File:

```text
src/app/core/camunda8/camunda8-client.service.ts
```

## Purpose

`Camunda8ClientService` is the Angular HTTP wrapper for the experimental local Camunda 8 runtime integration.

It is intentionally a thin client. It does not own Play mode state, token simulation state, workflow state, or UI messages. Those responsibilities stay in `PlayRuntimeIntegrationService` and the workspace.

## Public Models

The service defines small interfaces around the Camunda API responses used by the app:

- `DeploymentResponse`
- `DeployedProcessDefinition`
- `ProcessInstanceResponse`
- `MessageCorrelationResponse`
- `UserTask`
- `ActivatedJob`
- `Camunda8DeploymentError`

These types keep runtime integration code from passing unstructured `any` values everywhere.

## Configuration

The service reads local runtime configuration from:

```text
src/environments/environment.ts
```

Important values:

- `environment.camunda8.restAddress`
- `environment.camunda8.authStrategy`
- `environment.camunda8.auth`

In development, `restAddress` is normally `/camunda8-api`, which is proxied by `proxy.conf.json`.

## Deployment

`deployBpmnXml(bpmnXml, fileName)` posts the current BPMN as multipart form data:

```text
POST {restAddress}/v2/deployments
field: resources
```

The BPMN XML is wrapped in a browser `File` and appended to `FormData`.

The method returns the raw deployment response so the caller can inspect deployed resources.

## Process Instance Start

`startProcessInstance(processDefinitionId, processDefinitionVersion, variables?)` starts a process instance through:

```text
POST {restAddress}/v2/process-instances
```

The app starts by deployed process definition id and version, not only by BPMN process id. That is why `PlayRuntimeIntegrationService` first deploys the current XML and then asks this service to normalize the deployed process definition.

## Deployment Normalization

`findDeployedProcessDefinition(deployment, processDefinitionId)`:

1. calls `getDeployedProcessDefinitions(deployment)`
2. normalizes possible deployment response shapes
3. finds the definition matching the executable BPMN process id
4. throws if the deployment response does not include that process

The normalization handles a few response layouts by checking:

- `deployed.processDefinition`
- `deployed.metadata.processDefinition`
- `deployed.process`
- the deployed item itself

## User Task APIs

`searchUserTasks(processInstanceKey)` posts to:

```text
POST {restAddress}/v2/user-tasks/search
```

It filters by process instance key and returns up to 50 tasks.

`completeUserTask(userTaskKey, variables?)` posts to:

```text
POST {restAddress}/v2/user-tasks/{userTaskKey}/completion
```

Variables are currently optional and default to an empty object. There is no variable editor UI yet.

## Service Task Job APIs

`activateJobs(type, worker?)` posts to:

```text
POST {restAddress}/v2/jobs/activation
```

It activates one job for the given Zeebe job type using a local worker name:

```text
bpmn-process-designer-play-mode
```

The request includes:

- `type`
- `worker`
- `timeout`
- `maxJobsToActivate: 1`
- `fetchVariable: []`
- `requestTimeout`

`completeJob(jobKey, variables?)` posts to:

```text
POST {restAddress}/v2/jobs/{jobKey}/completion
```

This is the service-task equivalent of completing a user task. It lets the local Play mode bridge behave like a small job worker for demo auto-complete scenarios.

## Message Correlation API

`correlateMessage(name, correlationKey, variables?)` posts to:

```text
POST {restAddress}/v2/messages/correlation
```

The request body uses:

- `name`
- `correlationKey`
- `variables`

The current Play mode bridge passes the BPMN message name from the detected message event and a temporary hardcoded correlation key:

```text
123
```

This is immediate message correlation, not message publication or buffering.

## Authentication

When `environment.camunda8.authStrategy` is not `BEARER`, requests are sent without auth headers.

When the strategy is `BEARER`, the service:

1. requests a token with the OAuth client credentials flow
2. caches the access token
3. refreshes shortly before expiry
4. adds `Authorization: Bearer <token>` to Camunda API requests

Only non-secret metadata is logged during token requests. The access token itself is not logged.

## Error Handling

Each public API method catches HTTP or runtime errors and rethrows a normalized `Error`.

`handleError(error, message)` extracts useful detail from:

- native `Error`
- Camunda error response bodies
- string errors

It logs with the `[Camunda8]` prefix so browser-console debugging can filter Camunda client failures separately from Play mode orchestration logs.

## What This Service Does Not Do

This service does not:

- know whether workspace Play mode is active
- listen to token simulation events
- export BPMN XML from the modeler
- manage runtime status UI
- decide manual vs auto-complete behavior
- decide when a message event is safe to correlate
- implement forms, variable editing, production job workers, incidents, or Operate overlays
