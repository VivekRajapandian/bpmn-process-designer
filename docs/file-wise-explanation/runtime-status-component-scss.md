# runtime-status.component.scss

File:

```text
src/app/core/play-mode/runtime-status.component.scss
```

## Purpose

This stylesheet defines the compact `Local Camunda 8 Runtime` status bar shown while the workspace is in Play mode.

The design is intentionally small and horizontal so it can sit above the BPMN canvas without taking over the workspace.

## Panel Layout

`.runtime-status-panel` is a flex row with:

- compact height
- horizontal spacing
- light neutral background
- subtle bottom border
- small system font
- state-specific background colors

The panel uses status classes from the component template:

- `.state-idle`
- `.state-waiting`
- `.state-deploying`
- `.state-starting`
- `.state-success`
- `.state-error`

## State Colors

The state colors communicate runtime condition quickly:

- idle: neutral gray
- waiting: light blue
- deploying/starting: light orange
- success: light green
- error: light red

Deploying and starting also use a subtle pulse animation.

## Header Elements

`.runtime-status-header` groups:

- optional spinner
- title
- status indicator dot

`.runtime-status-indicator` is the colored dot. It uses state-specific classes such as `.indicator-success` and `.indicator-error`.

The indicator dot is ordered before the title with `order: -1`.

## Loading Treatment

Busy states show:

- `.runtime-status-spinner` near the title
- `.loading-pill` in the content row
- `.loading-spinner` inside the pill

Both spinners use the shared `spin` keyframe.

## Content Row

`.runtime-status-content` displays:

- loading pill
- status line
- message
- process instance key

The message uses ellipsis with `overflow: hidden`, `text-overflow: ellipsis`, and `white-space: nowrap` so long runtime messages do not resize the panel.

The process instance key uses a monospace font and stays inline.

## Animations

The file defines three keyframes:

- `pulse` for busy panel opacity
- `blink` for busy indicator dots
- `spin` for loading spinners

## Boundary

This stylesheet only controls the runtime status panel. It does not style the BPMN canvas, token simulator controls, workspace mode tabs, or the canvas deployment blocker.
