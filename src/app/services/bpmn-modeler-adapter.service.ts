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
  private readonly autoPausePointPreviousState = new Map<string, boolean>();

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
      this.autoPausePointPreviousState.clear();
    }
  }

  /**
   * Get the underlying BPMN.js modeler instance.
   * Use with caution - prefer using adapter methods when possible.
   */
  getModeler(): any {
    this.ensureModeler();
    return this.modeler;
  }

  /**
   * Get the eventBus from the modeler for subscribing to events.
   */
  getEventBus(): any {
    this.ensureModeler();
    return this.modeler.get('eventBus');
  }

  isTokenSimulationActive(): boolean {
    this.ensureModeler();
    return Boolean(this.modeler.get('toggleMode')?._active);
  }

  setTokenSimulationActive(active: boolean): void {
    this.ensureModeler();
    this.modeler.get('toggleMode').toggleMode(active);
  }

  setUserTaskPausePoints(active: boolean): void {
    this.setTaskPausePoints(active);
  }

  setTaskPausePoints(active: boolean): void {
    this.ensureModeler();

    const simulator = this.modeler.get('simulator');
    const taskElements = this.getPlayModePausePointElements();

    if (active) {
      taskElements.forEach((element: any) => {
        if (!this.autoPausePointPreviousState.has(element.id)) {
          this.autoPausePointPreviousState.set(
            element.id,
            Boolean(simulator.getConfig(element).wait)
          );
        }

        simulator.waitAtElement(element, true);
      });

      console.log(`[BpmnAdapter] Added Play mode pause points to ${taskElements.length} task(s)`);
      return;
    }

    this.autoPausePointPreviousState.forEach((wasPaused, elementId) => {
      const element = this.modeler.get('elementRegistry').get(elementId);

      if (element) {
        simulator.waitAtElement(element, wasPaused);
      }
    });

    console.log(
      `[BpmnAdapter] Restored ${this.autoPausePointPreviousState.size} Play mode pause point(s)`
    );
    this.autoPausePointPreviousState.clear();
  }

  continueUserTaskToken(elementId?: string): boolean {
    return this.continueTokenAtElements(elementId, this.getUserTaskElements());
  }

  continueTaskToken(elementId?: string): boolean {
    return this.continueTokenAtElements(elementId, this.getPlayModePausePointElements());
  }

  private continueTokenAtElements(elementId: string | undefined, fallbackElements: any[]): boolean {
    this.ensureModeler();

    const simulator = this.modeler.get('simulator');
    const elementRegistry = this.modeler.get('elementRegistry');
    const candidateElements = elementId
      ? [elementRegistry.get(elementId)].filter(Boolean)
      : fallbackElements;

    for (const element of candidateElements) {
      const subscriptions = simulator
        .findSubscriptions({ element })
        .filter((subscription: any) => subscription.event?.type === 'continue');

      if (subscriptions.length === 0) {
        continue;
      }

      simulator.trigger({
        event: subscriptions[0].event,
        scope: subscriptions[0].scope
      });

      console.log(`[BpmnAdapter] Continued paused token at task "${element.id}"`);
      return true;
    }

    console.log(
      `[BpmnAdapter] No paused task token found${elementId ? ` for "${elementId}"` : ''}`
    );
    return false;
  }

  /**
   * Extract the executable process ID from the current modeler.
   * Returns the first executable process id, or undefined if not found.
   */
  getExecutableProcessId(): string | undefined {
    this.ensureModeler();

    try {
      const rootElement = this.modeler.get('canvas').getRootElement();

      if (!rootElement) {
        return undefined;
      }

      // For process definitions
      if (rootElement.type === 'bpmn:Process') {
        return rootElement.id;
      }

      // For collaboration (find first executable process)
      if (rootElement.type === 'bpmn:Collaboration' && rootElement.participants) {
        for (const participant of rootElement.participants) {
          const process = participant.processRef;
          if (process?.id && process.isExecutable !== false) {
            return process.id;
          }
        }
      }

      return undefined;
    } catch (error) {
      console.error('Failed to extract process ID from modeler:', error);
      return undefined;
    }
  }

  getAttachedMessageEventElements(elementId: string): any[] {
    this.ensureModeler();

    const attachedMessageEvents: any[] = [];
    this.modeler.get('elementRegistry').forEach((element: any) => {
      if (
        element?.businessObject?.attachedToRef?.id === elementId &&
        this.hasMessageEventDefinition(element)
      ) {
        attachedMessageEvents.push(element);
      }
    });

    return attachedMessageEvents;
  }

  private getUserTaskElements(): any[] {
    return this.getElementsByTypes(['bpmn:UserTask']);
  }

  private hasMessageEventDefinition(element: any): boolean {
    const eventDefinitions = element?.businessObject?.eventDefinitions || [];

    return eventDefinitions.some(
      (definition: any) => definition?.$type === 'bpmn:MessageEventDefinition'
    );
  }

  private getPlayModePausePointElements(): any[] {
    return this.getElementsByTypes(['bpmn:UserTask', 'bpmn:ServiceTask']);
  }

  private getElementsByTypes(types: string[]): any[] {
    this.ensureModeler();

    const elements: any[] = [];
    this.modeler.get('elementRegistry').forEach((element: any) => {
      if (types.includes(element.type)) {
        elements.push(element);
      }
    });

    return elements;
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
