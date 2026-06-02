# Source References

These are the main library and framework references used by this Angular BPMN modeler POC.

## BPMN / Camunda Libraries

### bpmn-js

URL:

```text
https://bpmn.io/toolkit/bpmn-js
https://bpmn.io/toolkit/bpmn-js/walkthrough/
```

Used for:

- browser BPMN rendering and modeling
- XML import/export
- canvas services
- command stack, undo, redo
- element registry and selection

Main code:

```text
src/app/services/bpmn-modeler-adapter.service.ts
src/app/bpmn-canvas/bpmn-canvas.component.ts
```

### bpmn-js-properties-panel

URL:

```text
https://github.com/bpmn-io/bpmn-js-properties-panel
```

Used for:

- generic BPMN properties panel
- Camunda 7 properties provider
- Camunda 8 / Zeebe properties provider

Main modules used:

```ts
BpmnPropertiesPanelModule
BpmnPropertiesProviderModule
CamundaPlatformPropertiesProviderModule
ZeebePropertiesProviderModule
```

Main code:

```text
src/app/services/bpmn-modeler-adapter.service.ts
src/app/properties-panel/properties-panel.component.ts
src/styles.scss
```

### bpmn-js-token-simulation

URL:

```text
https://github.com/bpmn-io/bpmn-js-token-simulation
https://bpmn-io.github.io/bpmn-js-token-simulation/
```

Used for:

- client-side BPMN token simulation
- in-canvas simulation controls
- token animation and simulation context pads
- browser-side token simulation used by Play Mode
- experimental runtime coordination remains in Angular services, not in the token simulation library

Main code:

```text
src/app/services/bpmn-modeler-adapter.service.ts
src/styles.scss
docs/feature-wise-explanation/play-mode-token-simulation-flow.md
```

### camunda-bpmn-moddle

URL:

```text
https://github.com/camunda/camunda-bpmn-moddle
```

Used for:

- Camunda 7 / Camunda Platform BPMN extension metadata
- parsing and writing `camunda:*` extension attributes and elements

Main code:

```text
src/app/services/bpmn-modeler-adapter.service.ts
src/app/services/sample-workflows.service.ts
```

### zeebe-bpmn-moddle

URL:

```text
https://www.npmjs.com/package/zeebe-bpmn-moddle
```

Used for:

- Camunda 8 / Zeebe BPMN extension metadata
- parsing and writing `zeebe:*` extension elements such as `zeebe:taskDefinition`

Main code:

```text
src/app/services/bpmn-modeler-adapter.service.ts
src/app/services/sample-workflows.service.ts
```

### camunda-bpmn-js-behaviors

URL:

```text
https://github.com/camunda/camunda-bpmn-js-behaviors
```

Used for:

- Camunda 7 editing behaviors through `lib/camunda-platform`
- Camunda 8 editing behaviors through `lib/camunda-cloud`
- keeping engine-specific extension elements consistent while the user edits diagrams

Main code:

```text
src/app/services/bpmn-modeler-adapter.service.ts
src/app/types/camunda-bpmn-js-behaviors.d.ts
```

## Angular Docs

### Standalone Components

URL:

```text
https://angular.dev/reference/migrations/standalone
```

Used for:

- standalone component structure
- component-level imports

Main code:

```text
src/app/**/*.component.ts
```

### Component API

URL:

```text
https://v19.angular.dev/api/core/Component
```

Used for:

- `@Component`
- `selector`
- `standalone`
- `imports`
- `templateUrl`
- `styleUrl`

### Forms

URL:

```text
https://angular.dev/guide/forms/template-driven-forms
```

Used for:

- `FormsModule`
- `[(ngModel)]` in the workflow details dialog

Main code:

```text
src/app/bpmn-workspace/bpmn-workspace.component.ts
src/app/bpmn-workspace/bpmn-workspace.component.html
```

### RxJS Observables

URL:

```text
https://rxjs.dev/guide/observable
https://rxjs.dev/api/index/class/BehaviorSubject
```

Used for:

- Play mode runtime status publishing
- component subscriptions to service state
- `BehaviorSubject` as the current runtime status holder
- `asObservable()` to expose read-only streams to components

Main code:

```text
src/app/core/play-mode/play-runtime-integration.service.ts
src/app/core/play-mode/runtime-status.component.ts
docs/angular-features-explanation/components.md
```

## Camunda 8 REST API

URL:

```text
https://docs.camunda.io/docs/apis-tools/camunda-api-rest/camunda-api-rest-overview/
```

Used for the experimental local Play mode runtime bridge:

- deploy the current BPMN
- start a process instance
- search and complete user tasks
- activate and complete service-task jobs
- correlate BPMN messages

Main endpoints used:

```text
POST /v2/deployments
POST /v2/process-instances
POST /v2/user-tasks/search
POST /v2/user-tasks/{userTaskKey}/completion
POST /v2/jobs/activation
POST /v2/jobs/{jobKey}/completion
POST /v2/messages/correlation
```

Main code:

```text
src/app/core/camunda8/camunda8-client.service.ts
src/app/core/play-mode/play-runtime-integration.service.ts
docs/feature-wise-explanation/play-mode-token-simulation-flow.md
docs/LOGGING_GUIDE.md
```

## Project Docs

Read this for current engine and workflow rules:

```text
docs/engine-and-workflow-management.md
```
