# `properties-panel.component.ts` Explained

File location:

`src/app/properties-panel/properties-panel.component.ts`

This component provides the right-side container where the `bpmn-js-properties-panel` library renders its inspector UI.

It does not build the inspector fields manually. The actual property editor UI comes from the BPMN properties panel library. This component only creates a host element and exposes it to the BPMN adapter.

Spring Boot comparison:

This is like providing a placeholder view region that another framework/plugin fills. The Angular component owns the page slot. The third-party BPMN library owns the contents inside that slot.

## Imports

```ts
import { Component, ElementRef, ViewChild } from '@angular/core';
```

- `Component` registers the class as an Angular component.
- `ElementRef` wraps a real browser DOM element.
- `ViewChild` lets the class get a reference to an element in its template.

## Component Metadata

```ts
@Component({
  selector: 'app-properties-panel',
  standalone: true,
  template: `
    <header>
      <h2>Inspector</h2>
      <span>Select an element to edit its details</span>
    </header>
    <div #panel class="properties-host"></div>
  `,
  styleUrl: './properties-panel.component.scss'
})
```

### `selector`

```ts
selector: 'app-properties-panel'
```

This creates the HTML tag used by the workspace:

```html
<app-properties-panel></app-properties-panel>
```

### `standalone: true`

The component can be imported directly into another standalone component. It does not need to be declared in an Angular module.

### `template`

The template has two parts:

```html
<header>
  <h2>Inspector</h2>
  <span>Select an element to edit its details</span>
</header>
```

This is Angular-owned static UI.

```html
<div #panel class="properties-host"></div>
```

This is the host element for the BPMN properties panel library.

`#panel` is an Angular template reference variable. It lets `ViewChild` find this exact `div`.

### `styleUrl`

```ts
styleUrl: './properties-panel.component.scss'
```

This points to the SCSS file that styles the inspector region and the host div.

## Class

```ts
export class PropertiesPanelComponent {
```

This exports the component so the workspace can import it.

## ViewChild

```ts
@ViewChild('panel', { static: true })
private readonly panelRef!: ElementRef<HTMLElement>;
```

This tells Angular:

"Find the element marked `#panel` and store a reference to it."

Breaking it down:

- `'panel'`: matches `#panel` in the template.
- `{ static: true }`: the element is always in the template, so Angular can resolve it early.
- `ElementRef<HTMLElement>`: wrapper around the real browser element.
- `!`: TypeScript definite assignment assertion, because Angular assigns the value after construction.

## Element Getter

```ts
get element(): HTMLElement {
  return this.panelRef.nativeElement;
}
```

This returns the actual DOM element.

The workspace passes it to:

```ts
this.bpmnAdapter.initialize(this.canvas.element, this.propertiesPanel.element);
```

The adapter then gives it to BPMN.js:

```ts
propertiesPanel: {
  parent: propertiesPanel
}
```

## Flow

```text
Angular renders <app-properties-panel>
  -> component creates <div #panel>
  -> ViewChild captures the panel div
  -> element getter exposes HTMLElement
  -> workspace passes it to adapter
  -> bpmn-js-properties-panel renders inspector UI inside it
```

## Why This File Matters

This component keeps the Angular layout separate from BPMN library integration.

Angular owns:

- where the panel appears
- header text
- sizing/styling

`bpmn-js-properties-panel` owns:

- property fields
- BPMN element editing UI
- Camunda 7 property groups when the active workflow targets Camunda 7
- Camunda 8 / Zeebe property groups when the active workflow targets Camunda 8

The component itself does not choose which provider is active. `BpmnModelerAdapterService` recreates the modeler with the correct engine-specific provider and renders it into this host element.
