# `xml-viewer.component.ts` Explained

File:

```text
src/app/xml-viewer/xml-viewer.component.ts
```

This component shows the current BPMN XML as read-only text in the right panel.

## Input

```ts
@Input({ required: true }) xml = '';
```

The workspace passes:

```html
<app-xml-viewer [xml]="workflow.bpmnXml" />
```

The component does not fetch or save XML. It only renders the string it receives.

## Template Behavior

The component displays:

- a small header
- the XML character count
- a `<pre>` containing the BPMN XML

## Flow

```text
BPMN canvas edit
  -> workspace captures current XML
  -> WorkflowStateService.setXml(...)
  -> workflow.bpmnXml updates
  -> XmlViewerComponent receives new xml input
```
