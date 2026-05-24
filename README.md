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
- Zeebe moddle extension support through `zeebe-bpmn-moddle`.
- Local sample workflows:
  - Customer Onboarding Workflow
  - Invoice Approval Workflow
  - Support Ticket Escalation Workflow
- Local persistence with `localStorage`.
- Dirty state tracking and browser reload warning for unsaved changes.
- Basic validation for invalid XML, missing process names, and unnamed tasks.
- Import and export for `.bpmn` and `.xml` files.

## What Comes From BPMN Libraries Vs Our Angular Code

The POC does not rebuild the BPMN engine from scratch. It uses `bpmn-js` and related BPMN packages for core diagram modeling, then wraps them in a custom Angular application shell.

Library-provided features:

- `bpmn-js` provides BPMN canvas rendering, shapes, sequence flows, selection, drag/drop editing, command stack, undo/redo, zoom, XML import, and XML export.
- `diagram-js` is used internally by `bpmn-js` for canvas interaction, palette behavior, command stack, and viewport services.
- `bpmn-js-properties-panel` provides the right-side BPMN properties inspector.
- `zeebe-bpmn-moddle` lets the modeler parse and preserve Camunda 8 / Zeebe extension XML.
- BPMN package CSS provides the BPMN icons, canvas styling, palette/toolbox visuals, and properties panel styling.

Custom Angular features:

- Angular owns the workspace layout, toolbar, workflow explorer, save/import/export flows, XML viewer, problems panel, local storage, state management, and lifecycle integration.
- The BPMN modeler is isolated behind an Angular adapter service so UI components do not directly manage `bpmn-js` internals.

## Storage Behavior

The app saves diagrams in browser `localStorage` under the current browser origin, such as `http://localhost:4200`.

Stopping and restarting Angular with `npm start` does not delete saved diagrams. Data can be lost if browser site data is cleared, a private browsing session is closed, or the app is opened from a different origin such as `http://127.0.0.1:4200`.

Use **Export** to download an actual `.bpmn` file to disk.

## Known Limitations

- No backend or database.
- No authentication, RBAC, or user accounts.
- No Camunda deployment action inside the app.
- No collaboration or version history.
- No AI workflow generation.
- Validation is intentionally lightweight and does not replace Camunda 8 deployment validation.
- A production build may show a CommonJS optimization warning from a transitive BPMN properties-panel dependency. This does not block the POC build.

## Future Phases

The MVP does not include a backend, login, Camunda deployment, API integration, RBAC, version history, collaboration, or AI generation. Those are deliberate future phases.

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
src/app/
  bpmn-workspace/        Main page layout and workflow orchestration
  bpmn-canvas/           Canvas host for bpmn-js
  toolbar/               New, import, export, save, validate, undo, redo, zoom
  properties-panel/      Host for bpmn-js-properties-panel
  xml-viewer/            Read-only BPMN XML view
  problems-panel/        Validation results with element focus
  workflow-explorer/     Local sample workflow picker
  services/
    bpmn-modeler-adapter.service.ts
    workflow-state.service.ts
    workflow-storage.service.ts
    workflow-validation.service.ts
    sample-workflows.service.ts
  models/
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
- `workflow-explorer/` - Custom Angular sample workflow picker that loads local BPMN examples and saved workflow versions.
- `bpmn-modeler-adapter.service.ts` - Custom Angular wrapper around `bpmn-js`; initializes the modeler, imports/exports XML, handles undo/redo/zoom/focus, listens to modeler changes, and destroys the modeler.
- `workflow-state.service.ts` - Custom Angular/RxJS state service for current workflow, dirty state, saved samples, and validation problems.
- `workflow-storage.service.ts` - Custom browser persistence service that stores BPMN XML in `localStorage`.
- `workflow-validation.service.ts` - Custom lightweight validator for XML parsing, process/task naming, simple gateway rules, and basic Zeebe task definition checks.
- `sample-workflows.service.ts` - Custom local sample BPMN XML provider for the demo workflows and blank workflow.
- `models/` - Custom TypeScript interfaces/enums for workflows, validation problems, and workflow status.

## Demo Talk Track

This milestone proves the Angular foundation. The BPMN engine is provided by `bpmn-js` and Camunda/Zeebe-compatible packages for rendering, editing, palette behavior, command stack, XML import/export, properties inspection, and Zeebe extension support. Around that, this project adds a custom Angular shell with workflow navigation, local save, validation display, XML viewing, import/export UI, and lifecycle cleanup.

In short: this POC wraps proven BPMN libraries inside a clean Angular architecture instead of rebuilding BPMN modeling from scratch or porting the full Camunda Modeler Electron app.

## Demo Flow

1. Open the app and show the default Customer Onboarding workflow.
2. Select a task and edit its name in the right inspector.
3. Open the XML tab to show the updated BPMN XML.
4. Save locally, refresh the browser, and confirm the workflow is restored.
5. Import a `.bpmn` or `.xml` file.
6. Export the current diagram as a `.bpmn` file.
7. Run validation and click a problem to focus the related BPMN element when possible.

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
