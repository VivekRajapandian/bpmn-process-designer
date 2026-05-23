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
