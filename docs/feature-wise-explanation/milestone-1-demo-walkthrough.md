# Milestone 1 Demo Walkthrough

## High-Level Pitch

This is a frontend-only Angular 19 BPMN modeler POC. It proves that Angular can host a BPMN canvas using `bpmn-js`, load BPMN XML, let users visually edit diagrams, save locally, import/export `.bpmn` files, and keep BPMN library logic separated from Angular UI code.

It is not an Electron Camunda Modeler port. It is a clean Angular foundation that can later grow into Camunda-style features.

## Library Features Vs Custom Angular Code

The POC intentionally does not rebuild the BPMN engine from scratch. It uses proven BPMN/Camunda ecosystem libraries for core modeling behavior, then wraps them in our own Angular application shell.

### Provided By BPMN / Camunda Libraries

- BPMN canvas rendering through `bpmn-js`.
- BPMN shape rendering, sequence flows, selection, drag/drop editing, and diagram interaction behavior.
- BPMN palette/toolbox behavior through `bpmn-js` and `diagram-js` internals.
- XML import through `modeler.importXML(xml)`.
- XML export through `modeler.saveXML({ format: true })`.
- Undo/redo through the `bpmn-js` command stack.
- Zoom and viewport control through the `diagram-js` canvas API exposed by `bpmn-js`.
- Element lookup and selection through `elementRegistry`, `selection`, and `canvas` services.
- Properties panel rendering through `bpmn-js-properties-panel`.
- Client-side token simulation through `bpmn-js-token-simulation`.
- Zeebe/Camunda 8 extension parsing through `zeebe-bpmn-moddle`.
- BPMN icons, palette icons, canvas CSS, token simulation CSS, and properties panel CSS through package style imports in `src/styles.scss`.

### Built By Us In Angular

- The Angular workspace layout: toolbar, workflow explorer, canvas area, bottom problems panel, and right-side inspector/XML tabs.
- The adapter service that owns BPMN modeler initialization, Angular integration, event bridging, and cleanup.
- Workflow state management with RxJS `BehaviorSubject`.
- Local browser persistence using `localStorage`.
- Sample workflow definitions for the demo.
- Toolbar actions and how they map to app behavior.
- Browser import/export behavior around BPMN XML files.
- Lightweight local validation and the Problems panel.
- XML viewer panel.
- Workflow explorer and saved-workflow resolution.
- Dirty state tracking and browser reload warning.
- App-level Play Mode controls, runtime status, and local Camunda 8 integration around the browser token simulator.

### Simple Buyer Explanation

"We are using `bpmn-js` and Camunda/Zeebe BPMN libraries for the actual BPMN modeling engine: rendering, editing, palette, command stack, XML import/export, properties panel, and Zeebe extension support. Around that, we built our own Angular shell: workspace layout, toolbar, workflow explorer, local save, validation panel, XML viewer, state management, and lifecycle integration. So we are not rebuilding the BPMN engine from scratch; we are wrapping proven BPMN libraries inside a clean Angular architecture."

## App Entry

The app starts from:

```text
src/app/app.component.html
```

```html
<app-bpmn-workspace />
```

That loads the main workspace component:

```text
src/app/bpmn-workspace/bpmn-workspace.component.ts
```

This is the main orchestrator for the page.

## Main Workspace Layout

UI layout is here:

```text
src/app/bpmn-workspace/bpmn-workspace.component.html
```

It contains:

- Top toolbar
- Left workflow explorer
- Center BPMN canvas
- Bottom problems panel
- Right properties/XML panel

Styling is here:

```text
src/app/bpmn-workspace/bpmn-workspace.component.scss
```

## BPMN Canvas

Canvas host:

```text
src/app/bpmn-canvas/bpmn-canvas.component.ts
```

This component only exposes a DOM element:

```ts
get element(): HTMLElement {
  return this.canvasRef.nativeElement;
}
```

The actual BPMN modeler is not created here. That is intentional. The canvas component stays simple and Angular-focused.

## BPMN Modeler Adapter

Core BPMN integration is here:

```text
src/app/services/bpmn-modeler-adapter.service.ts
```

This is the most important architecture file.

It creates the modeler:

```ts
this.modeler = new Modeler({
  container: canvas,
  propertiesPanel: {
    parent: propertiesPanel
  },
  additionalModules: [
    BpmnPropertiesPanelModule,
    BpmnPropertiesProviderModule,
    ZeebePropertiesProviderModule
  ],
  moddleExtensions: {
    zeebe: zeebeModdle
  }
});
```

It handles:

- BPMN modeler initialization
- `bpmn-js-token-simulation` module registration
- XML import
- XML export/save
- undo/redo
- zoom in/out
- focus/select element from Problems panel
- modeler cleanup

Cleanup:

```ts
destroy(): void {
  if (this.modeler) {
    this.modeler.destroy();
    this.modeler = undefined;
  }
}
```

Workspace calls this on destroy:

```ts
ngOnDestroy(): void {
  this.subscription.unsubscribe();
  this.bpmnAdapter.destroy();
}
```

## BPMN Styles And Icons

Global BPMN CSS imports are here:

```text
src/styles.scss
```

```scss
@import 'bpmn-js/dist/assets/diagram-js.css';
@import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
@import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-codes.css';
@import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
@import '@bpmn-io/properties-panel/dist/assets/properties-panel.css';
@import 'bpmn-js-token-simulation/assets/css/bpmn-js-token-simulation.css';
```

These make the canvas, BPMN icons, palette, toolbox, token simulation controls, and properties panel render correctly.

## Play Mode Token Simulation And Runtime Bridge

Token simulation is provided by:

```text
bpmn-js-token-simulation
```

The plugin is loaded as a `bpmn-js` additional module in `BpmnModelerAdapterService`. It renders its own simulation controls inside the BPMN canvas and performs browser-side token simulation.

When the workspace is in Play mode, `PlayRuntimeIntegrationService` listens to simulator events and coordinates the experimental Camunda 8 bridge. It can deploy the current BPMN through `Camunda8ClientService`, start a process instance, complete Camunda user tasks, complete service-task jobs, log message events, and correlate direct message-event traces with the temporary hardcoded key `123`.

## Sample Workflows

Sample BPMN XML lives here:

```text
src/app/services/sample-workflows.service.ts
```

We currently provide:

- Customer Onboarding Workflow
- Invoice Approval Workflow
- Support Ticket Escalation Workflow
- Blank workflow template

The app loads the first sample by default unless there is a saved workflow in browser storage.

## Workflow State

Runtime app state is here:

```text
src/app/services/workflow-state.service.ts
```

This manages:

- current workflow
- sample workflow list
- problems list
- dirty/clean/invalid status
- saving workflow into state
- resolving saved workflow when user switches diagrams

It uses RxJS `BehaviorSubject`:

```ts
readonly workflow$: Observable<Workflow>;
readonly problems$ = this.problemsSubject.asObservable();
```

## Local Storage

Persistence is here:

```text
src/app/services/workflow-storage.service.ts
```

It saves to browser `localStorage`, not disk.

Keys:

```text
bpmn-process-designer.current-workflow
bpmn-process-designer.saved-workflows
```

Important demo explanation: stopping Angular does not delete saved diagrams. Browser localStorage remains until site data is cleared.

## Toolbar Features

Toolbar code:

```text
src/app/toolbar/toolbar.component.ts
```

Toolbar buttons emit events:

- New
- Import
- Export
- Save
- Validate
- Undo
- Redo
- Zoom in
- Zoom out

The toolbar does not include Play Mode buttons. Token simulation controls live inside the BPMN canvas through the plugin.

Workspace handles those events in:

```text
src/app/bpmn-workspace/bpmn-workspace.component.ts
```

Examples:

```ts
async saveLocally(): Promise<void>
async importDiagram(file: File): Promise<void>
async exportDiagram(): Promise<void>
undo(): void
redo(): void
zoomIn(): void
zoomOut(): void
```

## Import BPMN

Import button accepts:

```html
<input type="file" accept=".bpmn,.xml,text/xml" />
```

The file is read as text:

```ts
const xml = await file.text();
```

Then loaded through the modeler:

```ts
await this.loadWorkflow(workflow, true);
```

## Export BPMN

Export uses the adapter to get current XML:

```ts
const xml = await this.bpmnAdapter.saveXml();
```

Then downloads a `.bpmn` file using a browser Blob.

## Save Locally

Save gets the latest XML from the BPMN modeler:

```ts
const xml = await this.bpmnAdapter.saveXml();
```

Then stores it through:

```ts
this.workflowState.markSaved(xml);
```

That eventually writes to localStorage in `workflow-storage.service.ts`.

## Dirty State

Whenever the diagram changes, the adapter listens to:

```ts
eventBus.on('commandStack.changed', ...)
```

Then workspace captures XML and marks the workflow dirty:

```ts
void this.captureCurrentXml(true);
```

The toolbar shows status:

```text
clean
dirty
invalid
```

There is also a browser reload warning:

```ts
@HostListener('window:beforeunload', ['$event'])
```

## Properties Panel

Properties host:

```text
src/app/properties-panel/properties-panel.component.ts
```

The panel itself is rendered by `bpmn-js-properties-panel`, mounted through the adapter:

```ts
propertiesPanel: {
  parent: propertiesPanel
}
```

This lets the user select BPMN elements and edit details.

## XML Viewer

XML viewer:

```text
src/app/xml-viewer/xml-viewer.component.ts
```

It displays the current BPMN XML:

```html
<pre>{{ xml }}</pre>
```

This is useful in the demo to show that visual edits update BPMN XML.

## Validation / Problems Panel

Validation service:

```text
src/app/services/workflow-validation.service.ts
```

It checks:

- invalid XML
- missing process name
- task without name
- basic Camunda 8 style gateway condition/default-flow issues
- task definition checks for job-worker task types

Problems UI:

```text
src/app/problems-panel/problems-panel.component.ts
```

Clicking a problem calls:

```ts
focusProblem(problem)
```

which uses the BPMN adapter to select and scroll to the element:

```ts
this.bpmnAdapter.focusElement(problem.elementId);
```

## Workflow Explorer

Workflow picker:

```text
src/app/workflow-explorer/workflow-explorer.component.ts
```

It shows the local sample workflows and lets the user switch between them.

When switching, the app checks localStorage first so saved edits are preserved:

```ts
this.workflowState.resolveWorkflow(workflow)
```

## Models

Typed workflow models are here:

```text
src/app/models/workflow.model.ts
src/app/models/workflow-problem.model.ts
src/app/models/workflow-status.enum.ts
```

They keep workflow, problem, and status data strongly typed.

## Build / Dependencies

Dependencies are in:

```text
package.json
```

Important packages:

```json
"@angular/core": "^19.2.0",
"bpmn-js": "^18.16.1",
"bpmn-js-token-simulation": "^0.39.3",
"bpmn-js-properties-panel": "^5.58.0",
"@bpmn-io/properties-panel": "^3.44.0",
"zeebe-bpmn-moddle": "^1.14.0",
"rxjs": "~7.8.0"
```

Build config:

```text
angular.json
```

Budgets were increased because BPMN libraries are large compared to Angular's default starter budget.

## README

Buyer-facing documentation is here:

```text
README.md
```

It explains:

- what this POC proves
- setup
- run
- build
- storage behavior
- project structure
- demo flow
- known limitations
- future phases
- Play Mode token simulation and Camunda 8 runtime bridge scope

## Demo Talk Track

You can say:

"This milestone proves the Angular foundation. The BPMN engine is wrapped in an Angular service instead of being mixed into UI components. The canvas renders with official BPMN styles and palette, we can load sample BPMN XML, visually edit it, inspect properties, view XML, run browser-side token simulation, save locally, import/export `.bpmn`, and clean up the modeler lifecycle properly. Play mode also has an experimental local Camunda 8 bridge for deployment, instance start, user-task completion, service-task job completion, and message-event correlation experiments. Production backend, login, collaboration, and richer runtime tooling are future milestones."

Then demo:

```bash
npm run start
```

Open:

```text
http://localhost:4200/
```

Walkthrough order:

1. Show Customer Onboarding default diagram.
2. Show BPMN palette/toolbox on the canvas.
3. Click a task.
4. Edit the task name in Inspector.
5. Open XML tab and show XML changed.
6. Click Save and show saved status.
7. Refresh browser and show it restored.
8. Switch workflows.
9. Export `.bpmn`.
10. Run Validate and show Problems panel.
11. Switch to Play mode, enable token simulation, and show the local Camunda 8 runtime status panel.
