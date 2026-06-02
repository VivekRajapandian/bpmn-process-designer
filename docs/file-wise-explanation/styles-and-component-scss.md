# Styles And Component SCSS Explained

Relevant files:

```text
src/styles.scss
src/app/**/*.component.scss
```

The SCSS files control the Angular shell layout and import the BPMN library styles needed by `bpmn-js` and the properties panel.

## Global Styles

`src/styles.scss` imports BPMN package CSS:

```scss
@import 'bpmn-js/dist/assets/diagram-js.css';
@import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
@import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-codes.css';
@import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
@import '@bpmn-io/properties-panel/dist/assets/properties-panel.css';
@import 'bpmn-js-token-simulation/assets/css/bpmn-js-token-simulation.css';
```

Without these imports, the BPMN canvas, palette icons, properties panel, and token simulation controls would render incorrectly.

## Workspace Styles

`bpmn-workspace.component.scss` owns:

- full-page workspace grid
- center modeler area
- header layout
- engine label
- Rename button
- Design/Play mode tabs
- Token simulation toggle
- Auto-complete option
- runtime status placement
- canvas deployment blocker
- right panel tabs
- workflow details modal
- responsive layout rules

## Canvas Styles

`bpmn-canvas.component.scss` gives the BPMN canvas a stable height and background grid.

Stable dimensions matter because `bpmn-js` needs a measurable container. The modeler adapter also guards zoom-fit so temporary zero-sized layout states do not surface as SVG matrix errors.

## Component Styles

Other component SCSS files style:

- toolbar buttons and status badge
- workflow explorer list
- problems panel rows
- XML viewer
- properties panel host container

## Styling Boundary

BPMN library CSS provides the internal canvas/palette/properties/token-simulation visuals. This project provides the surrounding Angular app shell, workflow list, modal, app-level Play mode controls, runtime status placement, canvas blocker, and layout polish.
