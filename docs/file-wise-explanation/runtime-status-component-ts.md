# runtime-status.component.ts

File:

```text
src/app/core/play-mode/runtime-status.component.ts
```

## Purpose

`RuntimeStatusComponent` renders the compact `Local Camunda 8 Runtime` status panel shown in Play mode.

It is a standalone Angular component that subscribes to `PlayRuntimeIntegrationService` and displays the current runtime state, message, and process instance key.

## Component Metadata

The component uses:

- selector: `app-runtime-status`
- standalone component imports with `CommonModule`
- `ChangeDetectionStrategy.OnPush`
- inline HTML template
- external stylesheet: `runtime-status.component.scss`

OnPush is used because the component updates from an observable subscription and explicitly marks itself for check.

## Runtime Subscription

On init, the component subscribes to:

```ts
this.runtimeService.getStatus()
```

It stores each emitted status in `currentStatus` and calls:

```ts
this.changeDetector.markForCheck()
```

This keeps the UI reactive while preserving OnPush change detection.

## Cleanup

The component owns a `destroy$` subject.

`ngOnDestroy()` emits and completes it so the `getStatus()` subscription is cleaned up through `takeUntil(this.destroy$)`.

## Template Structure

The template renders:

- outer `.runtime-status-panel`
- status-specific state class, such as `state-deploying`
- header with optional spinner, title, and colored status dot
- optional loading pill for busy states
- status label and value
- status message
- process instance key when available

The process instance key is only shown after Camunda successfully starts an instance.

## Status Labels

`getStatusLabel()` maps service states to user-facing text:

- `idle` -> `Idle`
- `waiting` -> `Waiting`
- `deploying` -> `Deploying...`
- `starting` -> `Starting...`
- `success` -> `Success`
- `error` -> `Error`

## Busy States

`isBusy()` returns true for:

- `deploying`
- `starting`

Busy states show spinners and loading treatment in the template.

## What This Component Does Not Do

This component does not:

- deploy BPMN
- start process instances
- complete user tasks
- complete service-task jobs
- correlate messages
- decide manual vs auto-complete behavior
- toggle token simulation
- know about workflow data

It is display-only UI fed by `PlayRuntimeIntegrationService`.
