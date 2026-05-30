import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import Modeler from 'bpmn-js/lib/Modeler';
import TokenSimulationModule from 'bpmn-js-token-simulation';
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  CamundaPlatformPropertiesProviderModule,
  ZeebePropertiesProviderModule
} from 'bpmn-js-properties-panel';
import CamundaPlatformBehaviorsModule from 'camunda-bpmn-js-behaviors/lib/camunda-platform';
import ZeebeBehaviorsModule from 'camunda-bpmn-js-behaviors/lib/camunda-cloud';
import camundaModdle from 'camunda-bpmn-moddle/resources/camunda.json';
import zeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe.json';
import { EngineType } from '../models/engine-type.enum';

@Injectable({ providedIn: 'root' })
export class BpmnModelerAdapterService {
  private modeler?: any;
  private canvas?: HTMLElement;
  private propertiesPanel?: HTMLElement;
  private engineType?: EngineType;
  private zoomLevel = 1;

  readonly changed$ = new Subject<void>();

  constructor(private readonly zone: NgZone) {}

  initialize(
    canvas: HTMLElement,
    propertiesPanel: HTMLElement,
    engineType = EngineType.CAMUNDA_8
  ): void {
    this.canvas = canvas;
    this.propertiesPanel = propertiesPanel;
    this.createModeler(engineType);
  }

  initializeForEngine(engineType: EngineType): void {
    if (this.modeler && this.engineType === engineType) {
      return;
    }

    if (!this.canvas || !this.propertiesPanel) {
      throw new Error('BPMN modeler host elements are not available.');
    }

    this.createModeler(engineType);
  }

  private createModeler(engineType: EngineType): void {
    this.destroy();
    this.engineType = engineType;
    const config = this.createModelerConfig(engineType);

    this.modeler = new Modeler({
      container: this.canvas,
      ...config
    });

    const eventBus = this.modeler.get('eventBus');
    eventBus.on('commandStack.changed', () => {
      this.zone.run(() => this.changed$.next());
    });
  }

  private createModelerConfig(engineType: EngineType): object {
    if (engineType === EngineType.CAMUNDA_7) {
      return this.createCamunda7Config();
    }

    return this.createCamunda8Config();
  }

  private createCamunda7Config(): object {
    return {
      propertiesPanel: {
        parent: this.propertiesPanel
      },
      additionalModules: [
        TokenSimulationModule,
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
        CamundaPlatformPropertiesProviderModule,
        CamundaPlatformBehaviorsModule
      ],
      moddleExtensions: {
        camunda: camundaModdle
      }
    };
  }

  private createCamunda8Config(): object {
    return {
      propertiesPanel: {
        parent: this.propertiesPanel
      },
      additionalModules: [
        TokenSimulationModule,
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
        ZeebePropertiesProviderModule,
        ZeebeBehaviorsModule
      ],
      moddleExtensions: {
        zeebe: zeebeModdle
      }
    };
  }

  async importXml(xml: string): Promise<void> {
    this.ensureModeler();
    await this.modeler.importXML(xml);
    await this.zoomFitWhenReady();
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
    if (!this.hasMeasurableCanvas()) {
      return;
    }

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

  private async zoomFitWhenReady(): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.nextAnimationFrame();

      if (!this.hasMeasurableCanvas()) {
        continue;
      }

      try {
        this.zoomFit();
      } catch {
        this.setZoom(1);
      }

      return;
    }
  }

  private hasMeasurableCanvas(): boolean {
    const bounds = this.canvas?.getBoundingClientRect();

    return Boolean(
      bounds &&
        Number.isFinite(bounds.width) &&
        Number.isFinite(bounds.height) &&
        bounds.width > 0 &&
        bounds.height > 0
    );
  }

  private nextAnimationFrame(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  private ensureModeler(): void {
    if (!this.modeler) {
      throw new Error('BPMN modeler has not been initialized.');
    }
  }
}
