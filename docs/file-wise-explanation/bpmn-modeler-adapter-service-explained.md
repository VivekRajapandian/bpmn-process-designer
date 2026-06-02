# `bpmn-modeler-adapter.service.ts` Explained

File:

```text
src/app/services/bpmn-modeler-adapter.service.ts
```

`BpmnModelerAdapterService` is the integration boundary between Angular and the BPMN libraries. Components do not create `bpmn-js` directly; they call this service.

## Responsibilities

- Create and destroy the `bpmn-js` modeler.
- Use a Camunda 7 or Camunda 8 configuration based on `EngineType`.
- Import BPMN XML into the canvas.
- Export the current diagram as BPMN XML.
- Forward undo, redo, zoom, and element-focus actions to `bpmn-js`.
- Emit `changed$` when the BPMN command stack changes.
- Guard zoom-fit so a temporary zero-sized canvas does not break XML loading.
- Load `bpmn-js-token-simulation` as the client-side Play Mode foundation.

## Engine-Specific Configuration

The service stores the current engine:

```ts
private engineType?: EngineType;
```

`initialize(...)` stores the canvas and properties panel elements and creates the first modeler.

`initializeForEngine(engineType)` recreates the modeler only when the active workflow engine changes.

## Camunda 7 Stack

Camunda 7 uses:

```ts
TokenSimulationModule
CamundaPlatformPropertiesProviderModule
CamundaPlatformBehaviorsModule
camundaModdle
```

This gives the properties panel Camunda Platform groups such as implementation, asynchronous continuations, inputs, outputs, execution listeners, extension properties, and field injections.

## Camunda 8 Stack

Camunda 8 uses:

```ts
TokenSimulationModule
ZeebePropertiesProviderModule
ZeebeBehaviorsModule
zeebeModdle
```

This gives the properties panel Zeebe/Camunda 8 groups such as task definition, input/output mapping, headers, execution listeners, and extension properties.

## Token Simulation Module

Both Camunda 7 and Camunda 8 modeler configurations include:

```ts
import TokenSimulationModule from 'bpmn-js-token-simulation';
```

and add it through `additionalModules`.

The plugin provides the in-canvas token simulation controls and visual token animation. The app does not implement its own token engine or toolbar-based simulation controls.

The token simulator itself remains browser-side. Camunda 8 deployment, instance start, user-task completion, service-task job completion, message-event logging, and message correlation are handled separately by `PlayRuntimeIntegrationService` and `Camunda8ClientService` when workspace Play mode is active.

## Play Mode Pause Points

The adapter exposes Play mode helpers for the runtime bridge:

- `setTaskPausePoints(active)`
- `continueTaskToken(elementId?)`
- `continueUserTaskToken(elementId?)`

`setTaskPausePoints(true)` marks both `bpmn:UserTask` and `bpmn:ServiceTask` elements as simulator wait points. This makes manual Play mode pause at user tasks and service tasks by default.

When Play mode is turned off or token simulation is reset, `setTaskPausePoints(false)` restores the previous simulator wait setting for each element.

`continueUserTaskToken()` is used after user-task auto-complete. `continueTaskToken()` is the generic version used after service-task job auto-complete.

## Attached Message Event Lookup

The adapter also exposes:

```text
getAttachedMessageEventElements(elementId)
```

This scans the modeler element registry for boundary events attached to a task and filters to events with a `bpmn:MessageEventDefinition`.

`PlayRuntimeIntegrationService` uses this for logging because token simulation often traces the attached task instead of the boundary message event itself. Attached boundary-message lookups are log-only; direct message-event traces are the only traces allowed to call the message correlation API.

## Why The Moddle Descriptors Are Separate

The Camunda 7 and Zeebe moddle descriptors are not loaded into the same modeler. Both define some overlapping properties, including `modelerTemplate`, and `bpmn-moddle` rejects duplicate property definitions.

Instead, the app recreates the modeler with the active workflow's locked engine configuration.

## Change Events

The service listens to:

```ts
commandStack.changed
```

When this event fires, it re-enters Angular through `NgZone` and emits `changed$`. The workspace listens to that stream and captures the latest XML into workflow state.

## Import And Zoom Fit

`importXml(xml)` calls:

```ts
await this.modeler.importXML(xml);
await this.zoomFitWhenReady();
```

The delayed zoom is intentional. Immediately fitting the viewport while Angular is still laying out the canvas can produce invalid SVG matrix values. `zoomFitWhenReady()` waits for animation frames, checks that the canvas has finite non-zero dimensions, and falls back to normal zoom if fit-viewport fails.

## Export

`saveXml()` calls:

```ts
this.modeler.saveXML({ format: true })
```

The returned XML is used by Save, Export, validation, and dirty-state tracking.

## Cleanup

`destroy()` calls `modeler.destroy()` and clears the modeler reference. This prevents duplicate canvases and event listeners when the workspace or engine-specific modeler is recreated.

## Flow Summary

Startup:

```text
workspace ngAfterViewInit
  -> adapter.initialize(canvas, propertiesPanel, workflow.engineType)
  -> adapter.importXml(workflow.bpmnXml)
```

Switch to workflow with same engine:

```text
adapter keeps existing modeler
  -> importXml(newWorkflow.bpmnXml)
```

Switch to workflow with different engine:

```text
adapter.destroy()
  -> new Modeler(engine-specific config)
  -> importXml(newWorkflow.bpmnXml)
```
