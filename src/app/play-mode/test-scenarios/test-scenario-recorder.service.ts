import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { BpmnModelerAdapterService } from '../../services/bpmn-modeler-adapter.service';
import {
  CoveredFlowNode,
  TestCase,
  TestInstruction,
  TestScenario
} from './test-scenario.model';
import { TestScenarioMapperService } from './test-scenario-mapper.service';

const TEST_SCENARIOS_KEY = 'bpmn-process-designer.test-scenarios';

@Injectable({ providedIn: 'root' })
export class TestScenarioRecorderService {
  private initialized = false;
  private playModeActive = false;
  private tokenSimulationActive = false;
  private scenario?: TestScenario;
  private currentTestCase?: TestCase;
  private readonly coveredFlowNodeIds = new Set<string>();
  private readonly coveredSequenceFlowIds = new Set<string>();
  private readonly instructionKeys = new Set<string>();
  private readonly scenariosByDiagram = new Map<string, TestScenario>();
  private readonly selectedScenario$ = new BehaviorSubject<TestScenario | undefined>(undefined);
  private readonly canSaveCurrentScenario$ = new BehaviorSubject<boolean>(false);
  private scenarioLogged = false;
  private activeWorkflowId?: string;
  private activeDiagramKey?: string;

  constructor(
    private readonly modelerAdapter: BpmnModelerAdapterService,
    private readonly mapper: TestScenarioMapperService
  ) {}

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.loadStoredScenarios();

    const eventBus = this.modelerAdapter.getEventBus();

    eventBus.on('tokenSimulation.toggleMode', (event: any) => {
      this.tokenSimulationActive = Boolean(event?.active);

      if (!this.tokenSimulationActive) {
        this.resetRecording();
      }
    });

    eventBus.on('tokenSimulation.playSimulation', () => {
      if (!this.shouldRecord()) {
        return;
      }

      this.startRecording();
    });

    eventBus.on('tokenSimulation.simulator.trace', (event: any) => {
      if (!this.shouldRecord()) {
        return;
      }

      this.recordTrace(event);
    });

    eventBus.on('tokenSimulation.simulator.destroyScope', (event: any) => {
      if (!this.shouldRecord()) {
        return;
      }

      this.recordScopeDestroyed(event);
    });

    this.initialized = true;
    console.log('[TestScenarioRecorder] Initialized');
  }

  setPlayModeActive(active: boolean): void {
    this.playModeActive = active;

    if (!active) {
      this.resetRecording();
      return;
    }

    this.tokenSimulationActive = this.modelerAdapter.isTokenSimulationActive();
  }

  setActiveWorkflow(workflowId: string): void {
    this.activeWorkflowId = workflowId;
    this.resetRecording();
    this.selectScenarioForCurrentDiagram();
  }

  getSelectedScenario(): Observable<TestScenario | undefined> {
    return this.selectedScenario$.asObservable();
  }

  canSaveScenario(): Observable<boolean> {
    return this.canSaveCurrentScenario$.asObservable();
  }

  getCurrentScenario(): TestScenario | undefined {
    return this.scenario;
  }

  saveCurrentScenario(): TestScenario | undefined {
    const scenario = this.cloneScenario(this.scenario);

    if (!scenario || !this.scenarioLogged) {
      console.warn('[TestScenarioRecorder] No completed test scenario is available to save.');
      return undefined;
    }

    if (scenario.testCases[0]) {
      scenario.testCases[0].name = this.createDefaultScenarioName();
    }

    this.saveScenario(scenario);
    console.log(
      'Saved Test Scenario',
      JSON.stringify(scenario, null, 2)
    );

    return this.cloneScenario(scenario);
  }

  private startRecording(): void {
    const processId = this.modelerAdapter.getExecutableProcessId();
    const diagramKey = this.getDiagramKey(processId);

    if (!processId || !diagramKey) {
      console.warn('[TestScenarioRecorder] Cannot start recording without a workflow id and process id.');
      return;
    }

    const testCase: TestCase = {
      name: 'Recorded Test',
      instructions: [],
      metadata: {
        coveredFlowNodes: [],
        coveredSequenceFlows: []
      }
    };

    this.scenario = {
      processId,
      testCases: [testCase]
    };
    this.activeDiagramKey = diagramKey;
    this.currentTestCase = testCase;
    this.coveredFlowNodeIds.clear();
    this.coveredSequenceFlowIds.clear();
    this.instructionKeys.clear();
    this.scenarioLogged = false;
    this.canSaveCurrentScenario$.next(false);
    this.selectedScenario$.next(this.cloneScenario(this.scenario));

    console.log('[TestScenarioRecorder] Recording started');
  }

  private recordTrace(event: any): void {
    if (!this.scenario || !this.currentTestCase) {
      this.startRecording();
    }

    if (!this.scenario || !this.currentTestCase) {
      return;
    }

    const element = event?.element;
    const elementId = element?.id;
    const elementType = element?.type || element?.businessObject?.$type;

    if (!elementId || !elementType) {
      return;
    }

    if (elementType === 'bpmn:SequenceFlow') {
      this.recordSequenceFlow(elementId);
      return;
    }

    if (event?.action === 'enter') {
      this.recordFlowNode({
        flowNodeId: elementId,
        elementType
      });
    }

    const instruction = this.mapper.toInstruction(
      element,
      event?.action,
      this.scenario.processId
    );

    if (instruction) {
      this.addInstruction(instruction);
    }
  }

  private recordScopeDestroyed(event: any): void {
    const scope = event?.scope;
    const elementType = scope?.element?.type || scope?.element?.businessObject?.$type;

    if (!scope?.completed || !this.isRootSimulationScope(elementType)) {
      return;
    }

    this.publishCurrentScenario();
  }

  private recordFlowNode(flowNode: CoveredFlowNode): void {
    if (!this.currentTestCase || this.coveredFlowNodeIds.has(flowNode.flowNodeId)) {
      return;
    }

    this.coveredFlowNodeIds.add(flowNode.flowNodeId);
    this.currentTestCase.metadata.coveredFlowNodes.push(flowNode);
  }

  private recordSequenceFlow(sequenceFlowId: string): void {
    if (!this.currentTestCase || this.coveredSequenceFlowIds.has(sequenceFlowId)) {
      return;
    }

    this.coveredSequenceFlowIds.add(sequenceFlowId);
    this.currentTestCase.metadata.coveredSequenceFlows.push(sequenceFlowId);
  }

  private addInstruction(instruction: TestInstruction): void {
    if (!this.currentTestCase) {
      return;
    }

    const key = `${instruction.type}:${instruction.elementId}`;

    if (this.instructionKeys.has(key)) {
      return;
    }

    this.instructionKeys.add(key);
    this.currentTestCase.instructions.push(instruction);
  }

  private publishCurrentScenario(): void {
    if (!this.scenario || this.scenarioLogged) {
      return;
    }

    this.scenarioLogged = true;
    this.canSaveCurrentScenario$.next(true);
    this.selectedScenario$.next(this.cloneScenario(this.scenario));
  }

  private resetRecording(): void {
    this.scenario = undefined;
    this.currentTestCase = undefined;
    this.coveredFlowNodeIds.clear();
    this.coveredSequenceFlowIds.clear();
    this.instructionKeys.clear();
    this.scenarioLogged = false;
    this.canSaveCurrentScenario$.next(false);
  }

  private selectScenarioForCurrentDiagram(): void {
    const processId = this.modelerAdapter.getExecutableProcessId();
    const diagramKey = this.getDiagramKey(processId);
    this.activeDiagramKey = diagramKey;

    this.selectedScenario$.next(
      diagramKey ? this.cloneScenario(this.scenariosByDiagram.get(diagramKey)) : undefined
    );
    this.canSaveCurrentScenario$.next(false);
  }

  private saveScenario(scenario: TestScenario): void {
    const diagramKey = this.activeDiagramKey || this.getDiagramKey(scenario.processId);

    if (!diagramKey) {
      return;
    }

    this.scenariosByDiagram.set(diagramKey, this.cloneScenario(scenario));
    this.persistStoredScenarios();
    this.selectedScenario$.next(this.cloneScenario(scenario));
  }

  private createDefaultScenarioName(): string {
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      this.padTimestampPart(now.getMonth() + 1),
      this.padTimestampPart(now.getDate())
    ].join('') +
      '-' +
      [
        this.padTimestampPart(now.getHours()),
        this.padTimestampPart(now.getMinutes()),
        this.padTimestampPart(now.getSeconds())
      ].join('');

    return `Recorded Test ${timestamp}`;
  }

  private padTimestampPart(value: number): string {
    return String(value).padStart(2, '0');
  }

  private getDiagramKey(processId: string | undefined): string | undefined {
    if (!this.activeWorkflowId || !processId) {
      return undefined;
    }

    return `${this.activeWorkflowId}:${processId}`;
  }

  private cloneScenario(scenario: TestScenario): TestScenario;
  private cloneScenario(scenario: TestScenario | undefined): TestScenario | undefined;
  private cloneScenario(scenario: TestScenario | undefined): TestScenario | undefined {
    return scenario ? JSON.parse(JSON.stringify(scenario)) as TestScenario : undefined;
  }

  private loadStoredScenarios(): void {
    const raw = localStorage.getItem(TEST_SCENARIOS_KEY);

    if (!raw) {
      return;
    }

    try {
      const storedScenarios = JSON.parse(raw) as Record<string, TestScenario>;

      for (const [diagramKey, scenario] of Object.entries(storedScenarios)) {
        if (this.isTestScenario(scenario)) {
          this.scenariosByDiagram.set(diagramKey, scenario);
        }
      }
    } catch (error) {
      console.warn('[TestScenarioRecorder] Failed to load stored test scenarios.', error);
    }
  }

  private persistStoredScenarios(): void {
    const storedScenarios = Object.fromEntries(this.scenariosByDiagram);
    localStorage.setItem(TEST_SCENARIOS_KEY, JSON.stringify(storedScenarios));
  }

  private isTestScenario(value: unknown): value is TestScenario {
    const scenario = value as Partial<TestScenario>;

    return (
      typeof scenario?.processId === 'string' &&
      Array.isArray(scenario.testCases)
    );
  }

  private shouldRecord(): boolean {
    return this.playModeActive && this.tokenSimulationActive;
  }

  private isRootSimulationScope(elementType: string | undefined): boolean {
    return elementType === 'bpmn:Process' || elementType === 'bpmn:Participant';
  }
}
