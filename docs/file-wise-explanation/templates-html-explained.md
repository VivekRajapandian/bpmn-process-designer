# HTML Templates Explained

Main file:

```text
src/app/bpmn-workspace/bpmn-workspace.component.html
```

Angular templates define how component state appears on screen and how UI events call component methods.

## Workspace Layout

The workspace template arranges:

```text
top toolbar
left workflow explorer
center BPMN canvas
Design/Play mode bar
Play mode options and runtime status
bottom problems panel
right properties/XML panel
workflow details modal
```

## Child Components

The template uses custom Angular component tags:

```html
<app-toolbar />
<app-workflow-explorer />
<app-bpmn-canvas />
<app-problems-panel />
<app-properties-panel />
<app-xml-viewer />
```

These work because `BpmnWorkspaceComponent` imports the standalone components.

## Property Binding

Examples:

```html
[status]="workflow.status"
[workflows]="samples"
[activeWorkflowId]="workflow.id"
[problems]="problems"
[xml]="workflow.bpmnXml"
```

The XML viewer receives `workflow.bpmnXml`, not the old `workflow.xml` field.

## Event Binding

Examples:

```html
(newDiagram)="newDiagram()"
(importDiagram)="importDiagram($event)"
(save)="saveLocally()"
(workflowSelected)="selectWorkflow($event)"
```

Child components emit intent. The workspace performs the actual work.

## Header

The header shows:

```text
Workflow: <name>
Engine: Camunda 7 / Camunda 8
Updated <timestamp>
```

It also includes the Rename button. Rename opens a name-only dialog and does not expose engine switching.

## Play Mode Controls

The template includes a mode bar above the BPMN canvas:

```text
Design
Play mode
Token simulation
```

When Play mode is active, the template also shows:

```text
Auto-complete
Local Camunda 8 Runtime
```

`Auto-complete` toggles whether the runtime bridge should complete user tasks, service-task jobs, and direct message-event correlation automatically as token simulation enters those elements. With Auto-complete off, user tasks and service tasks wait for the user to resume the paused token.

The actual token simulation controls are rendered inside the BPMN canvas by `bpmn-js-token-simulation`. The runtime status panel is app-level UI fed by `PlayRuntimeIntegrationService`.

While deployment is running, the template shows a canvas blocker with:

```text
Deploying to Camunda...
```

## Modal

The modal is driven by `engineChoice`.

For New and Import:

- Name input is shown.
- Engine radio buttons are shown.
- Submit button says Create or Import.

For Rename:

- Name input is shown.
- Engine radio buttons are hidden.
- Submit button says Rename.

The submit button is disabled when the trimmed name is empty.

## Right Panel

The right panel uses `activePanel`:

```text
properties
xml
```

Only one panel is visible at a time.

When token simulation is active, the right panel is hidden so the simulator controls and token flow have more room.

## Template Boundary

The template does not contain BPMN library logic. It binds user actions to workspace methods, and the workspace delegates to services.
