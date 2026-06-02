# BPMN Process Designer

A lightweight Angular 19 web MVP for editing BPMN diagrams with `bpmn-js` and Camunda-compatible BPMN libraries.

This project is intentionally **not** a port of the Camunda Modeler Electron application. It reuses the BPMN modeling idea, but rebuilds the experience as a clean frontend-only Angular shell.

## Milestone 1 Scope

This POC validates the Angular BPMN modeler foundation:

- Angular can host a BPMN canvas cleanly.
- `bpmn-js` renders inside Angular with the BPMN palette, icons, and toolbox styles.
- A default diagram loads on startup.
- Basic visual editing works.
- BPMN modeler lifecycle and APIs are isolated behind an Angular adapter service.
- The app remains frontend-only for this milestone.

Milestone 1 is about proving the technical foundation, not recreating the full Camunda Modeler.

## What This MVP Includes

- BPMN workspace with a main canvas, toolbar, workflow explorer, properties inspector, XML viewer, and problems panel.
- Visual BPMN editing powered by `bpmn-js`.
- Properties editing powered by `bpmn-js-properties-panel`.
- Camunda 7 and Camunda 8 target-engine selection during workflow creation and import.
- Engine-specific properties panels:
  - Camunda 7 uses the Camunda Platform provider and `camunda-bpmn-moddle`.
  - Camunda 8 uses the Zeebe provider and `zeebe-bpmn-moddle`.
- Named workflows with rename support.
- Local sample workflows:
  - Customer Onboarding Workflow
  - Invoice Approval Workflow
  - Support Ticket Escalation Workflow
- Local workflow persistence with `localStorage`, including custom created/imported workflows.
- Dirty state tracking and browser reload warning for unsaved changes.
- Basic validation for invalid XML, missing process names, and unnamed tasks.
- Import and export for `.bpmn` and `.xml` files.
- Design/Play workspace modes with browser-side token simulation.
- Experimental local Camunda 8 runtime bridge for deployment, instance start, and user-task completion.

## Play Mode And Token Simulation

Play Mode combines local BPMN token simulation with an experimental Camunda 8 runtime bridge.

Token animation is powered by `bpmn-js-token-simulation`, loaded as a `bpmn-js` additional module. The plugin owns the canvas-level simulation controls, token movement, context pads, play/pause/reset behavior, and supported BPMN simulation semantics.

The Angular workspace adds a Design/Play mode switch and a `Token simulation` toggle. Switching to Play mode enables token simulation automatically; switching back to Design mode turns it off. When token simulation is active, the right-side properties/XML inspector is hidden to give the canvas more room.

This is not Camunda Web Modeler Play Mode. The browser token simulator and the Camunda runtime instance are coordinated by this app, but they are not the same execution engine.

## Camunda 8 Runtime Integration

The Camunda 8 integration is experimental and intended for local development. It can deploy the current BPMN, start a process instance, and optionally complete Camunda user tasks as the simulated token reaches BPMN user tasks.

Main pieces:

1. `Camunda8ClientService` (`src/app/core/camunda8/camunda8-client.service.ts`)
   - deploys BPMN XML through `/v2/deployments`
   - starts process instances through `/v2/process-instances`
   - searches user tasks through `/v2/user-tasks/search`
   - completes user tasks through `/v2/user-tasks/{key}/completion`
   - activates service-task jobs through `/v2/jobs/activation`
   - completes jobs through `/v2/jobs/{key}/completion`
   - supports bearer token authentication through the client credentials flow

2. `PlayRuntimeIntegrationService` (`src/app/core/play-mode/play-runtime-integration.service.ts`)
   - listens to `bpmn-js-token-simulation` event-bus events
   - only calls Camunda when workspace Play mode is active
   - deploys once per token simulation session
   - starts one process instance per manual session
   - coordinates manual and auto-complete behavior for user tasks and service-task jobs
   - exposes runtime status through an RxJS observable

3. `RuntimeStatusComponent` (`src/app/core/play-mode/runtime-status.component.ts`)
   - shows `Idle`, `Waiting`, `Deploying`, `Starting`, `Success`, or `Error`
   - shows runtime messages and the process instance key when available

High-level flow:

```text
user switches to Play mode
  -> workspace enables token simulation
  -> tokenSimulation.toggleMode(active=true)
  -> app exports current BPMN XML
  -> app deploys BPMN to Camunda 8
  -> user starts token simulation
  -> app starts a Camunda process instance
  -> optional user-task and service-task completion follows simulated token movement
```

The token simulation visuals continue to run in the browser. Camunda deployment, instance creation, and user-task completion happen through the configured Camunda 8 REST API.

## Runtime Configuration

Development configuration lives in `src/environments/environment.ts`:

```typescript
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

`proxy.conf.json` maps those paths for local development:

- `/camunda8-api` -> `http://localhost:8088`
- `/camunda-auth` -> `http://localhost:18080/auth`

The Angular dev server uses this proxy via `angular.json`, so `npm start` is enough on the Angular side. Update `environment.ts` and `proxy.conf.json` if your local Camunda 8 runtime or auth server uses different ports.

## Auto-Complete Modes

Play mode supports two task handling modes.

`Manual` mode adds simulator wait points to user tasks and service tasks. When the simulated user-task token is resumed, the app searches for the matching open Camunda user task and completes it. When the simulated service-task token is resumed, the app activates and completes the matching Camunda job.

`Auto-complete` mode completes the matching Camunda user task when the simulated token enters a BPMN user task, then asks the simulator to continue the token. It also activates and completes a matching Camunda job when the simulated token enters a BPMN service task with a Zeebe task definition type, then continues the paused service-task token.

User-task matching uses BPMN element ids from the Camunda response when available, with a fallback to the only open task for the process instance. Service-task job completion uses the service task's `zeebe:taskDefinition` type to activate a job and then matches the activated job back to the current process instance when possible.

## Logging And Debugging

Runtime logs are written to the browser console with `[PlayRuntime]` and `[Camunda8]` prefixes. Filter the console by either prefix to inspect deployment, instance start, auth, user-task search, and completion behavior.

See [LOGGING_GUIDE.md](docs/LOGGING_GUIDE.md) for a focused logging reference.

## Runtime Limitations

- No variable input or inspection UI.
- No forms.
- Service-task auto-complete is a local POC job worker path, not a production worker implementation.
- No incident panel.
- No live runtime overlays from Operate.
- No production backend gateway.
- No Camunda 7 runtime integration.

## Camunda Engine Targeting

The app supports workflows that are explicitly marked for Camunda 7 or Camunda 8. Users choose the workflow name and target engine when creating a new diagram or importing an existing `.bpmn` / `.xml` file. Camunda 8 is the default selection for new diagrams.

The selected engine type is saved with the workflow metadata in `localStorage` and restored with the BPMN XML after a browser refresh. Once a workflow has been created or imported, the engine type is read-only and cannot be changed from Camunda 7 to Camunda 8, or from Camunda 8 to Camunda 7.

Workflow names can be edited after creation. Renaming changes local metadata only; it does not rewrite BPMN process ids, element ids, or engine metadata.

Camunda 7 and Camunda 8 use different modeler configurations. The app creates a new `bpmn-js` modeler when the active workflow engine changes so the properties panel and moddle extension match the locked engine type.

Conversion between Camunda 7 and Camunda 8 is intentionally not supported in this release. Camunda 7 and Camunda 8 differ in namespaces, execution semantics, expression languages, extension properties, and BPMN coverage. Conversion requires dedicated migration tooling and validation.

## What Comes From BPMN Libraries Vs Our Angular Code

The POC does not rebuild the BPMN engine from scratch. It uses `bpmn-js` and related BPMN packages for core diagram modeling, then wraps them in a custom Angular application shell.

Library-provided features:

- `bpmn-js` provides BPMN canvas rendering, shapes, sequence flows, selection, drag/drop editing, command stack, undo/redo, zoom, XML import, and XML export.
- `diagram-js` is used internally by `bpmn-js` for canvas interaction, palette behavior, command stack, and viewport services.
- `bpmn-js-properties-panel` provides the right-side BPMN properties inspector.
- `camunda-bpmn-moddle` lets the Camunda 7 modeler parse and write Camunda Platform extension XML.
- `zeebe-bpmn-moddle` lets the Camunda 8 modeler parse and write Zeebe extension XML.
- `camunda-bpmn-js-behaviors` provides Camunda 7 and Camunda 8 behavior modules that keep engine-specific extension elements consistent while editing.
- `bpmn-js-token-simulation` provides browser-side token simulation and its in-canvas simulation controls.
- BPMN package CSS provides the BPMN icons, canvas styling, palette/toolbox visuals, and properties panel styling.

Custom Angular features:

- Angular owns the workspace layout, toolbar, workflow explorer, naming/renaming, engine selection, save/import/export flows, XML viewer, problems panel, local storage, state management, and lifecycle integration.
- The BPMN modeler is isolated behind an Angular adapter service so UI components do not directly manage `bpmn-js` internals.

## Storage Behavior

The app saves workflows in browser `localStorage` under the current browser origin, such as `http://localhost:4200`.

Stopping and restarting Angular with `npm start` does not delete saved diagrams. Data can be lost if browser site data is cleared, a private browsing session is closed, or the app is opened from a different origin such as `http://127.0.0.1:4200`.

The workflow metadata stored locally includes `id`, `name`, `engineType`, `bpmnXml`, `createdAt`, `updatedAt`, description, and current UI status. Older local records that used `xml` are normalized to `bpmnXml` on read and default to Camunda 8.

Use **Export** to download an actual `.bpmn` file to disk.

## Known Limitations

- No backend or database for core modeling features (local storage only).
- No authentication, RBAC, or user accounts.
- Camunda 8 runtime integration is experimental and intended for local development.
- Play Mode still uses browser-side token simulation. The experimental Camunda 8 bridge does not include variable inspection, forms, production job workers, incidents, Operate overlays, or broad runtime polling.
- No collaboration or version history.
- Validation is intentionally lightweight and does not replace Camunda 7 or Camunda 8 engine/deployment validation.
- No conversion or migration tooling between Camunda 7 and Camunda 8.
- Engine-specific moddle descriptors are intentionally not loaded together because Camunda 7 and Zeebe both define some properties such as `modelerTemplate`.
- A production build may show a CommonJS optimization warning from a transitive BPMN properties-panel dependency. This does not block the POC build.
- A production build may exceed the default initial bundle budget slightly because both Camunda 7 and Camunda 8 modeler stacks are bundled.

## Future Phases

The MVP does not include a production backend, login, RBAC, version history, collaboration, forms, variable management, job workers, incident handling, or production-grade Camunda deployment. Those are deliberate future phases.

## Setup

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm start
```

Open:

```text
http://localhost:4200/
```

Build the app:

```bash
npm run build
```

Run tests:

```bash
npm run test
```

## Project Structure

```text
docs/
  feature-wise-explanation/  Feature flow documentation, including Play Mode token simulation
  file-wise-explanation/     File-level implementation notes

src/app/
  bpmn-workspace/        Main page layout and workflow orchestration
  bpmn-canvas/           Canvas host for bpmn-js
  toolbar/               New, import, export, save, validate, undo, redo, zoom
  properties-panel/      Host for bpmn-js-properties-panel
  xml-viewer/            Read-only BPMN XML view
  problems-panel/        Validation results with element focus
  workflow-explorer/     Local workflow picker
  core/
    camunda8/            Local Camunda 8 REST client
    play-mode/           Play mode runtime bridge and status panel
  types/                 Local TypeScript declarations for untyped package entry points
  services/
    bpmn-modeler-adapter.service.ts
    workflow-state.service.ts
    workflow-storage.service.ts
    workflow-validation.service.ts
    sample-workflows.service.ts
  models/
    engine-type.enum.ts
    workflow.model.ts
    workflow-problem.model.ts
    workflow-status.enum.ts
```

## Component And Service Responsibilities

- `bpmn-workspace/` - Custom Angular page shell that wires the toolbar, explorer, BPMN canvas, properties panel, XML viewer, problems panel, and workflow actions together.
- `bpmn-canvas/` - Custom Angular host component that exposes the DOM element where `bpmn-js` renders the BPMN canvas.
- `toolbar/` - Custom Angular toolbar that emits actions for New, Import, Export, Save, Validate, Undo, Redo, and Zoom.
- `properties-panel/` - Custom Angular host for the library-provided `bpmn-js-properties-panel` inspector.
- `xml-viewer/` - Custom Angular read-only panel that displays the current BPMN XML from the modeler.
- `problems-panel/` - Custom Angular panel that displays local validation results and calls the adapter to focus BPMN elements.
- `workflow-explorer/` - Custom Angular workflow picker that shows built-in samples plus locally created/imported workflows.
- `bpmn-modeler-adapter.service.ts` - Custom Angular wrapper around `bpmn-js`; initializes the engine-specific modeler stack, loads `bpmn-js-token-simulation`, imports/exports XML, handles undo/redo/zoom/focus, listens to modeler changes, and destroys the modeler.
- `workflow-state.service.ts` - Custom Angular/RxJS state service for current workflow, dirty state, workflow list, renaming, saved workflows, and validation problems.
- `workflow-storage.service.ts` - Custom browser persistence service that stores workflow metadata and BPMN XML in `localStorage`.
- `workflow-validation.service.ts` - Custom lightweight validator for XML parsing, process/task naming, simple gateway rules, and Camunda 8 Zeebe task definition checks.
- `sample-workflows.service.ts` - Custom local sample BPMN XML provider for the demo workflows and engine-specific blank workflow.
- `core/camunda8/camunda8-client.service.ts` - Experimental Camunda 8 REST client for BPMN deployment, process instance start, user-task search, user-task completion, service-task job activation/completion, and bearer token handling.
- `core/play-mode/play-runtime-integration.service.ts` - Play mode runtime bridge that listens to token simulator events and coordinates Camunda 8 deployment, instance start, user-task completion, and service-task job completion.
- `core/play-mode/runtime-status.component.ts` - Compact Play mode status panel for local Camunda 8 runtime state and process instance key display.
- `models/` - Custom TypeScript interfaces/enums for engine type, workflows, validation problems, and workflow status.

## Demo Talk Track

This milestone proves the Angular foundation. The BPMN engine is provided by `bpmn-js` and Camunda-compatible packages for rendering, editing, palette behavior, command stack, XML import/export, engine-specific properties inspection, and Camunda 7 / Camunda 8 extension support. Around that, this project adds a custom Angular shell with workflow navigation, naming, renaming, local save, validation display, XML viewing, import/export UI, and lifecycle cleanup.

In short: this POC wraps proven BPMN libraries inside a clean Angular architecture instead of rebuilding BPMN modeling from scratch or porting the full Camunda Modeler Electron app.

## Demo Flow

1. Open the app and show the default Customer Onboarding workflow.
2. Select a task and edit its name in the right inspector.
3. Open the XML tab to show the updated BPMN XML.
4. Save locally, refresh the browser, and confirm the workflow is restored.
5. Create a new workflow, provide a name, and choose Camunda 7 or Camunda 8.
6. Select a task and compare the engine-specific properties panel.
7. Rename the workflow and confirm the left workflow list updates.
8. Import a `.bpmn` / `.xml` file, provide a name, and choose the target engine.
9. Export the current diagram as a `.bpmn` file.
10. Run validation and click a problem to focus the related BPMN element when possible.

## Demo Preparation

For a clean recorded demo, use one browser origin consistently, preferably:

```text
http://localhost:4200/
```

If old local data causes confusing warnings, clear this app's browser storage and reload:

```js
localStorage.removeItem('bpmn-process-designer.current-workflow');
localStorage.removeItem('bpmn-process-designer.saved-workflows');
location.reload();
```
