# Properties Panel And XML Viewer Flow

This document explains how the right-side panel works, including the BPMN properties inspector and the XML viewer tab.

## Components And Services Involved

- `BpmnWorkspaceComponent`  
  Owns the right-panel tab state and passes XML to the XML viewer.

- `PropertiesPanelComponent`  
  Angular host element where `bpmn-js-properties-panel` renders the inspector.

- `XmlViewerComponent`  
  Custom Angular read-only viewer for the current BPMN XML.

- `BpmnModelerAdapterService`  
  Mounts the library-provided properties panel into the Angular host element.

- `WorkflowStateService`  
  Keeps current workflow XML updated when the BPMN canvas changes.

## Right Panel Layout

File:

```text
src/app/bpmn-workspace/bpmn-workspace.component.html
```

```html
<aside class="right-panel">
  <div class="tabs" role="tablist" aria-label="Inspector panels">
    <button
      type="button"
      [class.active]="activePanel === 'properties'"
      (click)="setPanel('properties')"
    >
      Properties
    </button>
    <button
      type="button"
      [class.active]="activePanel === 'xml'"
      (click)="setPanel('xml')"
    >
      XML
    </button>
  </div>

  <div class="panel-content" [class.hidden]="activePanel !== 'properties'">
    <app-properties-panel />
  </div>
  <div class="panel-content" [class.hidden]="activePanel !== 'xml'">
    <app-xml-viewer [xml]="workflow.xml" />
  </div>
</aside>
```

The workspace tracks which tab is active:

```ts
activePanel: RightPanel = 'properties';
```

Tab switch:

```ts
setPanel(panel: RightPanel): void {
  this.activePanel = panel;
}
```

## Properties Panel Host

File:

```text
src/app/properties-panel/properties-panel.component.ts
```

Template:

```html
<header>
  <h2>Inspector</h2>
  <span>Select an element to edit its details</span>
</header>
<div #panel class="properties-host"></div>
```

The component exposes the real DOM element:

```ts
@ViewChild('panel', { static: true })
private readonly panelRef!: ElementRef<HTMLElement>;

get element(): HTMLElement {
  return this.panelRef.nativeElement;
}
```

The properties panel component does not render form fields itself. It only provides a host `<div>`.

## Mounting The BPMN Properties Panel

File:

```text
src/app/bpmn-workspace/bpmn-workspace.component.ts
```

Workspace passes the properties host element into the adapter:

```ts
this.bpmnAdapter.initialize(this.canvas.element, this.propertiesPanel.element);
```

File:

```text
src/app/services/bpmn-modeler-adapter.service.ts
```

The adapter gives that DOM element to `bpmn-js`:

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

The actual inspector UI comes from:

```ts
BpmnPropertiesPanelModule
BpmnPropertiesProviderModule
ZeebePropertiesProviderModule
```

## XML Viewer

File:

```text
src/app/xml-viewer/xml-viewer.component.ts
```

Input:

```ts
@Input({ required: true }) xml = '';
```

Template:

```html
<section>
  <header>
    <h2>BPMN XML</h2>
    <span>{{ xml.length | number }} characters</span>
  </header>
  <pre>{{ xml }}</pre>
</section>
```

The XML viewer is custom Angular UI. It does not use `bpmn-js` directly.

It receives XML from the workspace:

```html
<app-xml-viewer [xml]="workflow.xml" />
```

## How XML Updates

When the user edits the canvas, the adapter emits `changed$`.

Workspace captures XML:

```ts
const xml = await this.bpmnAdapter.saveXml();
this.workflowState.setXml(xml, dirty);
```

State emits the new workflow:

```ts
this.workflowSubject.next({
  ...this.workflow,
  xml,
  updatedAt: new Date().toISOString(),
  status: dirty ? WorkflowStatus.Dirty : WorkflowStatus.Clean
});
```

Workspace subscription receives it:

```ts
this.workflowState.workflow$.subscribe((workflow) => {
  this.workflow = workflow;
})
```

Then XML viewer receives the updated value:

```html
<app-xml-viewer [xml]="workflow.xml" />
```

## Small Diagram

```text
User edits BPMN diagram/properties
        |
        v
bpmn-js model changes
        |
        v
adapter emits changed$
        |
        v
workspace captures latest XML
        |
        v
WorkflowStateService updates workflow.xml
        |
        v
XmlViewerComponent receives [xml]
        |
        v
XML tab shows latest BPMN XML
```

## Important Lines Triggered In Order

### Properties Panel Startup

1. Workspace gets properties panel element:

```ts
this.propertiesPanel.element
```

2. Workspace initializes adapter:

```ts
this.bpmnAdapter.initialize(this.canvas.element, this.propertiesPanel.element);
```

3. Adapter mounts properties panel:

```ts
propertiesPanel: {
  parent: propertiesPanel
}
```

4. Adapter enables properties modules:

```ts
BpmnPropertiesPanelModule,
BpmnPropertiesProviderModule,
ZeebePropertiesProviderModule
```

### XML Tab Update

1. Diagram changes:

```ts
eventBus.on('commandStack.changed', ...)
```

2. Workspace captures XML:

```ts
const xml = await this.bpmnAdapter.saveXml();
```

3. State updates XML:

```ts
this.workflowState.setXml(xml, dirty);
```

4. XML viewer receives XML:

```html
<app-xml-viewer [xml]="workflow.xml" />
```

## Key Design Point

The properties inspector is library-provided, but the panel layout and tab behavior are custom Angular.

```text
Properties form fields = bpmn-js-properties-panel
Right panel tabs/layout = Angular
XML viewer = Angular
XML serialization = bpmn-js saveXML()
```
