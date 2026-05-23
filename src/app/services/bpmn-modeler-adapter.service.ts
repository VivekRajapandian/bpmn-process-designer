import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import Modeler from 'bpmn-js/lib/Modeler';
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  ZeebePropertiesProviderModule
} from 'bpmn-js-properties-panel';
import zeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe.json';

@Injectable({ providedIn: 'root' })
export class BpmnModelerAdapterService {
  private modeler?: any;
  private zoomLevel = 1;

  readonly changed$ = new Subject<void>();

  constructor(private readonly zone: NgZone) {}

  initialize(canvas: HTMLElement, propertiesPanel: HTMLElement): void {
    this.destroy();

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

    const eventBus = this.modeler.get('eventBus');
    eventBus.on('commandStack.changed', () => {
      this.zone.run(() => this.changed$.next());
    });
  }

  async importXml(xml: string): Promise<void> {
    this.ensureModeler();
    await this.modeler.importXML(xml);
    this.zoomFit();
  }

  async saveXml(): Promise<string> {
    this.ensureModeler();
    const result = await this.modeler.saveXML({ format: true });
    return result.xml;
  }

  undo(): void {
    this.commandStack().undo();
  }

  redo(): void {
    this.commandStack().redo();
  }

  zoomIn(): void {
    this.setZoom(this.zoomLevel + 0.15);
  }

  zoomOut(): void {
    this.setZoom(this.zoomLevel - 0.15);
  }

  zoomFit(): void {
    this.ensureModeler();
    this.modeler.get('canvas').zoom('fit-viewport', 'auto');
    this.zoomLevel = 1;
  }

  focusElement(elementId?: string): void {
    if (!elementId || !this.modeler) {
      return;
    }

    const registry = this.modeler.get('elementRegistry');
    const selection = this.modeler.get('selection');
    const canvas = this.modeler.get('canvas');
    const element = registry.get(elementId);

    if (!element) {
      return;
    }

    selection.select(element);
    canvas.scrollToElement(element);
  }

  destroy(): void {
    if (this.modeler) {
      this.modeler.destroy();
      this.modeler = undefined;
    }
  }

  private setZoom(level: number): void {
    this.ensureModeler();
    this.zoomLevel = Math.min(2.4, Math.max(0.3, level));
    this.modeler.get('canvas').zoom(this.zoomLevel);
  }

  private commandStack(): any {
    this.ensureModeler();
    return this.modeler.get('commandStack');
  }

  private ensureModeler(): void {
    if (!this.modeler) {
      throw new Error('BPMN modeler has not been initialized.');
    }
  }
}
