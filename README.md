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

## Play Mode Foundation

This release adds the first foundation for a custom Play Mode: frontend-only BPMN token simulation inside the canvas.

The simulation is powered by `bpmn-js-token-simulation`, integrated as a `bpmn-js` additional module. Simulation controls are provided by the plugin inside the BPMN canvas.

This is not Camunda 8 Web Modeler Play Mode. It does not deploy BPMN to Camunda, call Zeebe or Orchestration Cluster APIs, start real process instances, or use any backend. It is a client-side foundation for a future custom Play Mode.

Future Play Mode phases:

- Phase 2: Gateway path handling, variable input, and condition evaluation.
- Phase 3: Deploy the current BPMN to Camunda 8, start a process instance, and poll runtime state.
- Phase 4: User task completion, job completion or mock completion, variables panel, incident panel, and runtime overlays.

## Camunda 8 Runtime Experiment

**Overview**

This release includes an experimental Camunda 8 client integration that deploys BPMN to a local Camunda 8 runtime when token simulation starts. This is **not** a full Camunda 8 Play Mode yet. It only covers deployment and process instance creation with comprehensive logging for debugging and monitoring.

**Architecture**

The integration consists of three main components:

1. **Camunda8ClientService** (`src/app/core/camunda8/camunda8-client.service.ts`)
   - Handles all REST API communication with local Camunda 8 runtime
   - Methods: `deployBpmnXml()`, `startProcessInstance()`, `deployAndStart()`
   - Uses Angular's `HttpClient` for HTTP requests
   - Includes comprehensive error handling and logging

2. **PlayRuntimeIntegrationService** (`src/app/core/play-mode/play-runtime-integration.service.ts`)
   - Listens to token simulator events from `bpmn-js-token-simulation`
   - Coordinates the deployment workflow when simulation starts
   - Manages a deployment flag to prevent duplicate deployments per session
   - Exposes status observable for UI updates
   - Includes detailed event tracking and logging

3. **RuntimeStatusComponent** (`src/app/core/play-mode/runtime-status.component.ts`)
   - Displays real-time status of deployment and process instance creation
   - Shows progress states: Idle → Waiting → Deploying → Success/Error
   - Displays process instance key upon success
   - Reactive component using OnPush change detection

**How It Works**

When you enable token simulation (click the "Token Simulation" toggle in the canvas):

1. The app detects the `tokenSimulation.playSimulation` event.
2. It exports the latest BPMN XML from the modeler.
3. It extracts the executable process ID from the BPMN diagram.
4. It sends the BPMN to a local Camunda 8 REST API (default: `http://localhost:8080`).
5. It starts a process instance on the remote runtime.
6. It displays deployment and process instance status in the UI.
7. Console logs track every step of the workflow.

**Scope**

This experiment covers only:

- Deployment of BPMN XML to Camunda 8.
- Starting a process instance.
- Status display (success/error).
- Comprehensive console logging for monitoring.

This experiment does **not** cover:

- User task handling or forms.
- Variable input, output, or inspection.
- Job execution or polling.
- Incident handling.
- Operate overlays or runtime visibility.
- Full Play Mode simulation.

The token simulation visual animation continues to run client-side. The Camunda 8 deployment and process instance are independent of the local token simulation.

**Configuration**

The Camunda 8 REST address is configured in `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  camunda8: {
    restAddress: 'http://localhost:8080',
    authStrategy: 'NONE'
  }
};
```

Update `restAddress` if your local Camunda 8 instance runs on a different host or port.

**Status Panel**

A "Local Camunda 8 Runtime" status panel appears below the play-mode info. It shows:

- **Status**: Current state (Idle, Waiting, Deploying, Starting, Success, Error)
- **Message**: Detailed feedback about current operation
- **Instance Key**: Process instance key if deployment and start succeeded
- **Visual Indicator**: Color-coded indicator matches status state

**Logging and Debugging**

Comprehensive logging is built into both `Camunda8ClientService` and `PlayRuntimeIntegrationService`. All significant events are logged to the browser console with emoji-prefixed categorization:

```
Service Initialization:
🔧 [PlayRuntime] Initializing PlayRuntimeIntegrationService
👂 [PlayRuntime] Subscribing to token simulator events...
✅ [PlayRuntime] Initialization complete

Token Simulation Start:
🎯 [PlayRuntime] Event received: tokenSimulation.playSimulation
🎬 [PlayRuntime] Token Simulation STARTED - Initiating Camunda 8 deployment workflow

Deployment Process:
📄 [PlayRuntime] BPMN XML exported successfully
📋 [PlayRuntime] Process ID extracted: "CustomerProcess"
⚙️  [Camunda8] Starting deployAndStart workflow
📤 [Camunda8] Deploying BPMN file to http://localhost:8080/v1/deployments
✅ [Camunda8] Deployment successful - Key: 2251799813685249

Instance Creation:
🚀 [Camunda8] Starting process instance for: "CustomerProcess"
✅ [Camunda8] Process instance started - Key: 2251799813685250

Completion:
🎉 [PlayRuntime] Camunda 8 integration complete: deployment + instance started
```

**To View Logs**

1. Open the app at `http://localhost:4200`
2. Press `F12` to open Developer Tools
3. Go to the **Console** tab
4. Enable Token Simulation and click Play
5. Filter logs by typing `[PlayRuntime]` or `[Camunda8]` in the search box

See [LOGGING_GUIDE.md](LOGGING_GUIDE.md) for complete logging reference.

**CORS and Authentication**

This experiment assumes:

- Local Camunda 8 REST API is accessible from the Angular app (no CORS blocking).
- No authentication is required (`authStrategy: 'NONE'`).

For production or remote Camunda 8 instances, direct Angular-to-Camunda REST access may be blocked by CORS policies or require authentication. In those cases, implement a backend proxy/gateway to bridge the Angular app and the Camunda 8 REST API. The service interface is designed to support that without code changes.

**Guard Behavior**

The app deploys and starts only once per token simulation session. Repeated clicks of the play/pause button do not trigger multiple deployments. Resetting the token simulation (via the reset button) allows another deployment attempt on the next play.

**Error Handling**

If deployment or process start fails:

- An error message is displayed in the status panel and console logs.
- The deployment flag is reset so you can retry on the next play.
- The app does not crash.

Common errors with console log examples:

- `❌ [Camunda8] Failed to deploy BPMN XML: Connection refused` → Camunda 8 REST API is not running or not reachable.
- `❌ [PlayRuntime] FAILED: No executable process found in BPMN diagram` → The BPMN diagram has no executable process element.
- CORS errors → Your Camunda 8 instance does not allow requests from the Angular origin.

**Testing Locally**

To test this feature:

1. Start a local Camunda 8 instance (e.g., Docker):
   ```bash
   docker run -p 8080:8080 camunda/camunda-platform-core:latest
   ```

2. In another terminal, start the Angular dev server:
   ```bash
   npm start
   ```

3. Open the BPMN designer in your browser at `http://localhost:4200`.

4. Load or create a BPMN diagram with at least one executable process.

5. Open Developer Tools (F12) and go to the Console tab.

6. Click the "Token Simulation" toggle to enable token simulation.

7. Click the Play/Pause button to start simulation.

8. Observe:
   - Console logs showing the deployment workflow
   - Status panel transitioning from Deploying → Success
   - Process instance key displayed if successful

9. Verify the process instance was created in Camunda 8 Operate (if available at `http://localhost:8080`).

**Development Notes**

- The `BpmnModelerAdapterService` was enhanced with `getEventBus()` and `getExecutableProcessId()` methods to support the integration.
- The `PlayRuntimeIntegrationService` uses a `BehaviorSubject` for reactive status updates.
- All HTTP calls use Angular's `HttpClient` with `firstValueFrom()` for promise-based async/await.
- Error handling is designed to be non-blocking and user-friendly.

**Next Steps**

Future phases will add:

- Full Play Mode simulation tied to the Camunda 8 runtime (not just client-side animation).
- Variable inspection and assignment from the runtime.
- User task handling and form rendering.
- Job and incident management.
- Live runtime state polling and Operate overlays.
- Proper authentication and backend proxy for production use.

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
- `bpmn-js-token-simulation` provides frontend-only token simulation and its in-canvas simulation controls.
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
- Camunda 8 deployment is experimental (local POC only, no production authentication/proxy).
- Play Mode is primarily client-side token simulation. Experimental Camunda 8 integration does not include variable inspection, user tasks, job handling, or runtime polling.
- No collaboration or version history.
- Validation is intentionally lightweight and does not replace Camunda 7 or Camunda 8 engine/deployment validation.
- No conversion or migration tooling between Camunda 7 and Camunda 8.
- Engine-specific moddle descriptors are intentionally not loaded together because Camunda 7 and Zeebe both define some properties such as `modelerTemplate`.
- A production build may show a CommonJS optimization warning from a transitive BPMN properties-panel dependency. This does not block the POC build.
- A production build may exceed the default initial bundle budget slightly because both Camunda 7 and Camunda 8 modeler stacks are bundled.

## Future Phases

The MVP does not include a backend, login, Camunda deployment, API integration, RBAC, version history, or collaboration. Those are deliberate future phases.

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
