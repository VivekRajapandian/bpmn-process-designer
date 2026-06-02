# Play Mode, Token Simulation, And Camunda 8 Runtime Flow

This document explains how the Angular BPMN designer connects local token simulation with the experimental Camunda 8 runtime integration.

## Scope

Play Mode has two layers:

- local token simulation in the BPMN canvas, powered by `bpmn-js-token-simulation`
- an experimental Camunda 8 runtime bridge that can deploy the current BPMN, start a process instance, complete Camunda user tasks, complete service-task jobs, detect message events, and correlate direct message-event traces

This is still not Camunda Web Modeler Play Mode. The browser simulation and the Camunda runtime instance are coordinated by app code, but they are not the same execution engine.

The current integration does not provide forms, variable editing, production job workers, incident management, Operate overlays, configurable message correlation keys, or runtime-state polling beyond the local user-task/job/message lookup needed for Play mode.

## User Interface

The workspace has two modes:

- `Design`: normal editing mode with the properties/XML panel available
- `Play mode`: runtime-oriented mode that enables token simulation and shows the local Camunda 8 runtime status panel

The workspace also exposes a `Token simulation` toggle. Switching to Play mode turns token simulation on automatically if it is off. Switching back to Design mode turns token simulation off.

When token simulation is active, the right-side inspector is hidden so the canvas has more room for the simulation controls.

In Play mode, the UI also shows:

- `Local Camunda 8 Runtime` status panel
- `Auto-complete` checkbox
- a canvas blocker while deployment is in progress

## Library Integration

Token simulation is provided by:

```text
bpmn-js-token-simulation
```

`BpmnModelerAdapterService` imports the module and adds it to both Camunda 7 and Camunda 8 modeler stacks:

```ts
import TokenSimulationModule from 'bpmn-js-token-simulation';
```

```ts
additionalModules: [
  TokenSimulationModule,
  ...
]
```

The plugin CSS is imported globally from `src/styles.scss`:

```scss
@import 'bpmn-js-token-simulation/assets/css/bpmn-js-token-simulation.css';
```

The plugin owns the canvas-level simulation controls, token animation, context pads, play/pause/reset behavior, and supported BPMN simulation semantics.

## Runtime Integration Boundary

`PlayRuntimeIntegrationService` listens to token simulator events from the `bpmn-js` event bus, but it only talks to Camunda when Play mode is active.

Token simulation outside Play mode remains local and does not deploy or start anything.

Angular owns:

- Design/Play mode state
- app-level token simulation toggle
- Camunda 8 deployment and instance-start orchestration
- runtime status messages
- user-task handling mode
- message-event logging and direct message correlation

`bpmn-js-token-simulation` owns:

- simulation state and token movement
- canvas simulation controls
- pause/resume behavior at simulated tasks and events

## Camunda 8 Flow

High-level flow:

```text
workspace initializes modeler
  -> PlayRuntimeIntegrationService subscribes to token simulator events
  -> user switches to Play mode
  -> workspace enables token simulation
  -> tokenSimulation.toggleMode(active=true) is observed
  -> PlayRuntimeIntegrationService exports current BPMN XML
  -> executable process id is read from the modeler
  -> Camunda8ClientService deploys XML to /v2/deployments
  -> deployed process definition id/version are extracted from the response
  -> runtime status waits for simulation play
  -> tokenSimulation.playSimulation or root createScope is observed
  -> Camunda8ClientService starts an instance through /v2/process-instances
```

Deployment happens once per Play mode token-simulation session. Resetting token simulation or turning it off resets the runtime session and allows a fresh deployment.

Starting an instance is also guarded so repeated play/pause clicks do not create duplicate instances for the same manual session.

## Auto-Complete Handling

The runtime bridge supports two task handling modes.

`Manual` mode:

- process instance starts in Camunda
- user tasks and service tasks get simulator wait points
- user tasks wait in Camunda
- service tasks wait for Camunda jobs to be activated and completed
- when a simulated user-task token is resumed, the service looks up the matching open Camunda user task and completes it
- when a simulated service-task token is resumed, the service activates and completes the matching Camunda job

`Auto-complete` mode:

- process instance starts in Camunda
- when simulation enters a BPMN user task, the service searches for the corresponding open Camunda user task
- the user task is completed through the Camunda 8 API
- the simulator token is continued after completion
- when simulation enters a BPMN service task, the service reads the service task's `zeebe:taskDefinition` type
- the service activates one Camunda job of that type and completes it when it belongs to the current process instance
- the simulator token is continued after service-task job completion

User-task lookup uses the process instance key and tries to match BPMN element identifiers exposed by the Camunda task response, with a fallback to the only open user task when there is exactly one.

Service-task job activation is type-based because Camunda jobs are activated by job type. The bridge requests one job at a time and prefers activated jobs that match the current process instance and BPMN element id.

## Message Event Handling

The runtime bridge logs message-event metadata when token simulation reaches a BPMN element with a `bpmn:MessageEventDefinition`.

It logs:

- trace action
- message event element id/type
- message event definition id
- BPMN message id/name
- attached task id/type for boundary events

For boundary message events attached to a task, the token simulator may trace the task rather than the boundary event itself. In that case the bridge looks up attached message boundary events and logs them, but does not correlate the message. That prevents a normal user-task resume from accidentally triggering message correlation.

Message correlation is currently allowed only when the traced element itself is the message event.

Correlation timing follows the task mode:

- manual mode: correlate on `signal`, after the paused token is resumed
- auto-complete mode: correlate on `enter`

The correlation call uses:

```text
POST /v2/messages/correlation
```

with the BPMN message name and temporary hardcoded correlation key:

```text
123
```

## Camunda 8 Client

`Camunda8ClientService` wraps the REST calls:

- `deployBpmnXml()` posts multipart BPMN resources to `/v2/deployments`
- `startProcessInstance()` posts process definition id/version to `/v2/process-instances`
- `searchUserTasks()` posts to `/v2/user-tasks/search`
- `completeUserTask()` posts to `/v2/user-tasks/{key}/completion`
- `activateJobs()` posts to `/v2/jobs/activation`
- `completeJob()` posts to `/v2/jobs/{key}/completion`
- `correlateMessage()` posts to `/v2/messages/correlation`

Bearer authentication is supported when `environment.camunda8.authStrategy` is `BEARER`. Tokens are requested with the client credentials flow and cached until shortly before expiry.

## Local Configuration

Development configuration lives in `src/environments/environment.ts`:

```ts
export const environment = {
  production: false,
  camunda8: {
    restAddress: '/camunda8-api',
    authStrategy: 'BEARER',
    auth: {
      tokenUrl: '/camunda-auth/realms/camunda-platform/protocol/openid-connect/token',
      clientId: 'orchestration',
      clientSecret: 'secret',
      audience: 'orchestration-api'
    }
  }
};
```

`proxy.conf.json` maps those browser-safe paths to local services:

- `/camunda8-api` -> `http://localhost:8088`
- `/camunda-auth` -> `http://localhost:18080/auth`

The Angular dev server uses this proxy through `angular.json`.

## Failure Behavior

If deployment, authentication, instance start, user-task search/completion, job activation/completion, or message correlation fails:

- the runtime status panel shows an error
- console logs include `[PlayRuntime]` or `[Camunda8]`
- deployment failures reset the deployment guard so the next session can retry
- the BPMN editor stays usable

Common causes include Camunda not running, proxy target ports not matching the local runtime, invalid bearer credentials, missing executable process ids, deployment validation errors, and CORS/authentication problems when bypassing the dev proxy.

## Known Gaps

- No variable input or inspection UI
- No forms
- Service-task auto-complete is a local POC job worker path, not a production worker implementation
- Message correlation uses a temporary hardcoded correlation key, `123`
- No incident panel
- No live runtime overlays from Operate
- No production backend gateway
- No Camunda 7 runtime integration
