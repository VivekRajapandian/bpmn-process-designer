# `bpmn-canvas.component.ts` Explained

File location:

`src/app/bpmn-canvas/bpmn-canvas.component.ts`

This component creates the empty HTML element where `bpmn-js` renders the BPMN diagram. It is intentionally small. It does not know how BPMN works. It only exposes a real browser `HTMLElement` to the parent workspace.

Spring Boot comparison:

This file is not like a service or controller. It is closer to a tiny view helper that provides one specific object needed by another layer. In this case, the object is a DOM element, because `bpmn-js` needs a real browser element to draw into.

## Full Source Shape

```ts
import { Component, ElementRef, ViewChild } from '@angular/core';

@Component({
  selector: 'app-bpmn-canvas',
  standalone: true,
  template: '<div #canvas class="bpmn-canvas"></div>',
  styleUrl: './bpmn-canvas.component.scss'
})
export class BpmnCanvasComponent {
  @ViewChild('canvas', { static: true })
  private readonly canvasRef!: ElementRef<HTMLElement>;

  get element(): HTMLElement {
    return this.canvasRef.nativeElement;
  }
}
```

## Imports

```ts
import { Component, ElementRef, ViewChild } from '@angular/core';
```

These are Angular framework APIs.

- `Component` marks the class as an Angular component.
- `ElementRef` is Angular's wrapper around a real DOM element.
- `ViewChild` lets the class access an element inside its own template.

Spring Boot comparison:

`Component` is similar in purpose to Spring annotations like `@Component`, because it tells the framework to manage this class. `ElementRef` has no direct Spring equivalent because backend Java code does not usually touch browser DOM elements.

## Component Metadata

```ts
@Component({
  selector: 'app-bpmn-canvas',
  standalone: true,
  template: '<div #canvas class="bpmn-canvas"></div>',
  styleUrl: './bpmn-canvas.component.scss'
})
```

This block tells Angular how to render and use the component.

### `selector: 'app-bpmn-canvas'`

This defines the custom HTML tag:

```html
<app-bpmn-canvas></app-bpmn-canvas>
```

The parent workspace uses this tag in its template. When Angular sees it, Angular creates an instance of `BpmnCanvasComponent`.

### `standalone: true`

This component does not need to be declared inside an Angular module. It can be imported directly by another standalone component.

Spring Boot comparison:

This is similar to modern Spring Boot reducing explicit XML/module registration. The component carries its own metadata.

### `template`

```ts
template: '<div #canvas class="bpmn-canvas"></div>',
```

This component uses an inline template instead of a separate `.html` file because the HTML is only one line.

The important part is:

```html
<div #canvas class="bpmn-canvas"></div>
```

- `div` is the physical container.
- `#canvas` is an Angular template reference variable.
- `class="bpmn-canvas"` lets the SCSS file size and style the area.

Important:

`#canvas` is not an HTML id. It is an Angular reference name used by `ViewChild`.

### `styleUrl`

```ts
styleUrl: './bpmn-canvas.component.scss'
```

This points to the SCSS file for the canvas host. That stylesheet controls the canvas height, width, and background behavior.

## Class Declaration

```ts
export class BpmnCanvasComponent {
```

This exports the component class so another component can import it.

In this app, `BpmnWorkspaceComponent` imports and uses it.

## ViewChild

```ts
@ViewChild('canvas', { static: true })
private readonly canvasRef!: ElementRef<HTMLElement>;
```

This tells Angular:

"Find the element in my template named `#canvas` and store it in `canvasRef`."

Breaking it down:

- `@ViewChild('canvas')`: look for the template reference variable named `canvas`.
- `{ static: true }`: the element exists immediately because it is always present in the template.
- `private readonly`: only this class can use this field, and it should not be reassigned.
- `canvasRef!`: Angular assigns this after creating the view. The `!` tells TypeScript not to complain.
- `ElementRef<HTMLElement>`: Angular wrapper around the actual browser element.

Spring Boot comparison:

This is not dependency injection. It is more like asking the UI framework, "Give me a reference to this child element after the view is built."

## Element Getter

```ts
get element(): HTMLElement {
  return this.canvasRef.nativeElement;
}
```

This exposes the real DOM element in a clean way.

The parent workspace can call:

```ts
this.canvas.element
```

That looks like a property, but internally it runs the getter.

`this.canvasRef.nativeElement` is the real browser element. This is what `bpmn-js` needs.

Why this getter is useful:

- The parent does not need to know about Angular `ElementRef`.
- The parent receives a plain `HTMLElement`.
- The BPMN adapter receives exactly what the third-party library expects.

## Flow

```text
Angular renders <app-bpmn-canvas>
  -> BpmnCanvasComponent creates <div #canvas>
  -> ViewChild captures that div
  -> element getter returns nativeElement
  -> workspace passes HTMLElement to BpmnModelerAdapterService
  -> bpmn-js renders the diagram inside that element
```

## Why This File Matters

This file keeps the DOM bridge clean.

Without it, the workspace component would directly manage low-level canvas DOM details. By keeping this component small, the app has a clear boundary:

```text
BpmnCanvasComponent = provides DOM host
BpmnWorkspaceComponent = coordinates page behavior
BpmnModelerAdapterService = talks to bpmn-js
```

