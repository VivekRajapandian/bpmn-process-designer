# Angular Bootstrap and Config Files Explained

Related files:

- `src/app/app.config.ts`
- `src/main.ts`
- `src/index.html`
- TypeScript config files such as `tsconfig.json`
- Local app type declarations under `src/app/types/`
- Angular build config in `angular.json`

This document explains the startup/config side of the Angular app.

Spring Boot comparison:

These files are similar to the combination of `SpringApplication.run(...)`, application configuration, and build configuration. They start the frontend app and tell Angular how to compile/render it.

## `app.config.ts`

File:

`src/app/app.config.ts`

```ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true })]
};
```

### Imports

```ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
```

- `ApplicationConfig` is the type for app-level Angular configuration.
- `provideZoneChangeDetection` configures Angular change detection behavior.

### `appConfig`

```ts
export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true })]
};
```

This exports the app-level providers.

`eventCoalescing: true` tells Angular to group certain events together for more efficient change detection.

Spring Boot comparison:

This is similar to an application configuration bean, except it configures Angular's browser runtime instead of backend services.

## `main.ts`

Typical Angular standalone apps have a file like:

```ts
bootstrapApplication(AppComponent, appConfig)
```

That is where Angular starts the root component.

Flow:

```text
Browser loads index.html
  -> Angular bundle runs main.ts
  -> main.ts bootstraps AppComponent
  -> AppComponent renders BpmnWorkspaceComponent
```

Spring Boot comparison:

This is closest to:

```java
SpringApplication.run(Application.class, args);
```

The difference is that Angular starts in the browser, while Spring Boot starts on the server.

## `index.html`

`index.html` is the static HTML shell loaded by the browser.

It usually contains:

```html
<app-root></app-root>
```

Angular replaces/renders inside that root component selector.

Spring Boot comparison:

Think of it as the frontend host page. Angular takes over from there.

## `angular.json`

This is Angular CLI project configuration.

It controls:

- build target
- serve target
- style/script configuration
- asset configuration
- test configuration

For this BPMN app, it is important that global styles include BPMN library CSS, usually through `src/styles.scss` or Angular style config.

Why this matters:

BPMN.js needs its CSS for:

- canvas rendering
- icons
- palette/toolbox
- properties panel styling

## TypeScript Config Files

Files like:

- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.spec.json`

control TypeScript compilation.

Spring Boot comparison:

These are similar in spirit to Maven/Gradle compiler configuration, but for TypeScript.

## Local Type Declarations

The app includes:

```text
src/app/types/camunda-bpmn-js-behaviors.d.ts
src/typings.d.ts
```

This declares the package entry points used by the BPMN adapter:

```text
camunda-bpmn-js-behaviors/lib/camunda-platform
camunda-bpmn-js-behaviors/lib/camunda-cloud
```

The runtime package exists in `node_modules`, but it does not ship TypeScript declarations for those deep imports. The local declaration file keeps Angular's TypeScript build clean without changing runtime behavior.

`src/typings.d.ts` also declares `bpmn-js-token-simulation` so TypeScript can compile the package import used by `BpmnModelerAdapterService`.

## Flow Summary

```text
index.html provides <app-root>
  -> main.ts bootstraps AppComponent with appConfig
  -> AppComponent renders <app-bpmn-workspace>
  -> workspace initializes BPMN.js through adapter service
```

## Why These Files Matter

They prove the app is a normal Angular frontend project, not an Electron port. The app starts through Angular's browser bootstrap path and runs entirely client-side.
