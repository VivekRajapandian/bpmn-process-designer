import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { BpmnModelerAdapterService } from '../../services/bpmn-modeler-adapter.service';
import {
  CoveredFlowNode,
  TestCase,
  TestInstruction,
  TestScenario,
  TestScenarioRuntimeAction
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
  private readonly interruptedActivityElementIds = new Set<string>();
  private readonly scenariosByDiagram = new Map<string, TestScenario[]>();
  private readonly selectedScenario$ = new BehaviorSubject<TestScenario | undefined>(undefined);
  private readonly savedScenarios$ = new BehaviorSubject<TestScenario[]>([]);
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

    eventBus.on('testScenario.runtimeAction', (event: any) => {
      if (!this.playModeActive || !event?.action) {
        return;
      }

      this.recordRuntimeAction(event.action);
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

  getSavedScenarios(): Observable<TestScenario[]> {
    return this.savedScenarios$.asObservable();
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

  deleteSavedScenario(index: number): void {
    const diagramKey = this.activeDiagramKey;

    if (!diagramKey) {
      return;
    }

    const scenarios = this.getScenarios(diagramKey);

    if (index < 0 || index >= scenarios.length) {
      return;
    }

    scenarios.splice(index, 1);

    if (scenarios.length) {
      this.scenariosByDiagram.set(diagramKey, scenarios);
    } else {
      this.scenariosByDiagram.delete(diagramKey);
    }

    this.persistStoredScenarios();
    this.savedScenarios$.next(this.cloneScenarios(scenarios));
    this.selectedScenario$.next(this.cloneScenario(this.getLatestScenario(diagramKey)));
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
    this.interruptedActivityElementIds.clear();
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
      this.recordBoundaryCoverageFromSequenceFlow(element);
      this.recordSequenceFlow(element);
      return;
    }

    if (elementType === 'bpmn:BoundaryEvent') {
      return;
    }

    if (event?.action === 'enter') {
      this.recordFlowNode({
        flowNodeId: elementId,
        elementType
      });
    }
  }

  private recordRuntimeAction(action: TestScenarioRuntimeAction): void {
    if (
      !this.scenario ||
      !this.currentTestCase ||
      (action.type === 'create-process-instance' && this.scenarioLogged)
    ) {
      this.startRecording();
    }

    if (!this.scenario || !this.currentTestCase) {
      return;
    }

    if (action.type === 'process-instance-completed') {
      this.publishCurrentScenario();
      return;
    }

    const instruction = this.mapper.fromRuntimeAction({
      ...action,
      elementId: action.elementId || this.getStartEventId() || this.scenario.processId,
      processDefinitionId: action.processDefinitionId || this.scenario.processId
    });

    if (!instruction) {
      return;
    }

    this.addInstruction(instruction);
    this.recordRuntimeActionCoverage(instruction);
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
    if (
      !this.currentTestCase ||
      !this.isCoverableFlowNodeType(flowNode.elementType) ||
      this.coveredFlowNodeIds.has(flowNode.flowNodeId)
    ) {
      return;
    }

    this.coveredFlowNodeIds.add(flowNode.flowNodeId);
    this.currentTestCase.metadata.coveredFlowNodes.push(flowNode);
  }

  private recordSequenceFlow(sequenceFlow: any): void {
    const sequenceFlowId = sequenceFlow?.id;

    if (!this.currentTestCase || !sequenceFlowId) {
      return;
    }

    if (this.coveredSequenceFlowIds.has(sequenceFlowId)) {
      return;
    }

    this.coveredSequenceFlowIds.add(sequenceFlowId);
    this.currentTestCase.metadata.coveredSequenceFlows.push(sequenceFlowId);
  }

  private addInstruction(instruction: TestInstruction): void {
    if (!this.currentTestCase) {
      return;
    }

    let insertAtIndex: number | undefined;

    if (
      instruction.type === 'complete-user-task' &&
      this.interruptedActivityElementIds.has(instruction.elementId)
    ) {
      return;
    }

    if (
      instruction.type === 'complete-job' &&
      this.interruptedActivityElementIds.has(instruction.elementId)
    ) {
      return;
    }

    if (this.isInterruptingBoundaryInstruction(instruction)) {
      insertAtIndex = this.markActivityInterrupted(instruction.attachedToElementId);
    }

    const key = `${instruction.type}:${instruction.elementId}`;

    if (this.instructionKeys.has(key)) {
      return;
    }

    this.instructionKeys.add(key);

    if (insertAtIndex !== undefined) {
      this.currentTestCase.instructions.splice(insertAtIndex, 0, instruction);
      return;
    }

    this.currentTestCase.instructions.push(instruction);
  }

  private isInterruptingBoundaryInstruction(instruction: TestInstruction): boolean {
    return (
      Boolean(instruction.attachedToElementId) &&
      instruction.interrupting !== false &&
      instruction.type === 'publish-message'
    );
  }

  private markActivityInterrupted(elementId: string | undefined): number | undefined {
    if (!elementId || !this.currentTestCase) {
      return undefined;
    }

    this.interruptedActivityElementIds.add(elementId);
    return this.removeFirstInstruction([
      { type: 'complete-user-task', elementId },
      { type: 'complete-job', elementId }
    ]);
  }

  private removeFirstInstruction(candidates: Array<{ type: string; elementId: string }>): number | undefined {
    if (!this.currentTestCase) {
      return undefined;
    }

    const removedIndex = this.currentTestCase.instructions.findIndex(
      (instruction) =>
        candidates.some(
          (candidate) =>
            instruction.type === candidate.type &&
            instruction.elementId === candidate.elementId
        )
    );

    if (removedIndex === -1) {
      return undefined;
    }

    const removedInstruction = this.currentTestCase.instructions[removedIndex];
    this.currentTestCase.instructions.splice(removedIndex, 1);
    this.instructionKeys.delete(`${removedInstruction.type}:${removedInstruction.elementId}`);
    return removedIndex;
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
    this.interruptedActivityElementIds.clear();
    this.scenarioLogged = false;
    this.canSaveCurrentScenario$.next(false);
  }

  private selectScenarioForCurrentDiagram(): void {
    const processId = this.modelerAdapter.getExecutableProcessId();
    const diagramKey = this.getDiagramKey(processId);
    this.activeDiagramKey = diagramKey;

    this.selectedScenario$.next(
      this.cloneScenario(this.getLatestScenario(diagramKey))
    );
    this.savedScenarios$.next(this.cloneScenarios(this.getScenarios(diagramKey)));
    this.canSaveCurrentScenario$.next(false);
  }

  private saveScenario(scenario: TestScenario): void {
    const diagramKey = this.activeDiagramKey || this.getDiagramKey(scenario.processId);

    if (!diagramKey) {
      return;
    }

    const scenarios = this.getScenarios(diagramKey);
    scenarios.push(this.cloneScenario(scenario));
    this.scenariosByDiagram.set(diagramKey, scenarios);
    this.persistStoredScenarios();
    this.selectedScenario$.next(this.cloneScenario(scenario));
    this.savedScenarios$.next(this.cloneScenarios(scenarios));
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

  private getStartEventId(): string | undefined {
    try {
      const elementRegistry = this.modelerAdapter.getModeler().get('elementRegistry');
      const startEvents: any[] = [];

      elementRegistry.forEach((element: any) => {
        if (element?.type === 'bpmn:StartEvent' && !element?.labelTarget) {
          startEvents.push(element);
        }
      });

      return startEvents.find((element) => element?.parent?.type === 'bpmn:Process')?.id ||
        startEvents[0]?.id;
    } catch (error) {
      console.warn('[TestScenarioRecorder] Failed to resolve BPMN start event id.', error);
      return undefined;
    }
  }

  private getSequenceFlowSourceElementId(sequenceFlow: any): string | undefined {
    return sequenceFlow?.businessObject?.sourceRef?.id;
  }

  private recordBoundaryCoverageFromSequenceFlow(sequenceFlow: any): void {
    const sourceElementId = this.getSequenceFlowSourceElementId(sequenceFlow);
    const sourceElement = this.getElementById(sourceElementId);

    if (sourceElement?.type !== 'bpmn:BoundaryEvent') {
      return;
    }

    this.recordFlowNode({
      flowNodeId: sourceElement.id,
      elementType: sourceElement.type
    });
  }

  private getElementById(elementId: string | undefined): any | undefined {
    if (!elementId) {
      return undefined;
    }

    try {
      return this.modelerAdapter.getModeler().get('elementRegistry').get(elementId);
    } catch (error) {
      console.warn(`[TestScenarioRecorder] Failed to resolve BPMN element "${elementId}".`, error);
      return undefined;
    }
  }

  private recordRuntimeActionCoverage(instruction: TestInstruction): void {
    if (instruction.type === 'create-process-instance') {
      this.recordFlowNode({
        flowNodeId: instruction.elementId,
        elementType: 'bpmn:StartEvent'
      });
      return;
    }

    const element = this.getElementById(instruction.elementId);
    const elementType = element?.type || element?.businessObject?.$type;

    if (!elementType) {
      return;
    }

    this.recordFlowNode({
      flowNodeId: instruction.elementId,
      elementType
    });
  }

  private cloneScenario(scenario: TestScenario): TestScenario;
  private cloneScenario(scenario: TestScenario | undefined): TestScenario | undefined;
  private cloneScenario(scenario: TestScenario | undefined): TestScenario | undefined {
    return scenario ? JSON.parse(JSON.stringify(scenario)) as TestScenario : undefined;
  }

  private cloneScenarios(scenarios: TestScenario[]): TestScenario[] {
    return JSON.parse(JSON.stringify(scenarios)) as TestScenario[];
  }

  private getScenarios(diagramKey: string | undefined): TestScenario[] {
    if (!diagramKey) {
      return [];
    }

    return this.scenariosByDiagram.get(diagramKey) || [];
  }

  private getLatestScenario(diagramKey: string | undefined): TestScenario | undefined {
    const scenarios = this.getScenarios(diagramKey);
    return scenarios[scenarios.length - 1];
  }

  private loadStoredScenarios(): void {
    const raw = localStorage.getItem(TEST_SCENARIOS_KEY);

    if (!raw) {
      return;
    }

    try {
      const storedScenarios = JSON.parse(raw) as Record<string, TestScenario | TestScenario[]>;

      for (const [diagramKey, scenarioOrScenarios] of Object.entries(storedScenarios)) {
        const scenarios = Array.isArray(scenarioOrScenarios)
          ? scenarioOrScenarios.filter((scenario) => this.isTestScenario(scenario))
          : this.isTestScenario(scenarioOrScenarios)
            ? [scenarioOrScenarios]
            : [];

        if (scenarios.length) {
          this.scenariosByDiagram.set(diagramKey, scenarios);
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

  private isCoverableFlowNodeType(elementType: string | undefined): boolean {
    return Boolean(
      elementType &&
      elementType.startsWith('bpmn:') &&
      ![
        'bpmn:Process',
        'bpmn:Participant',
        'bpmn:Collaboration',
        'bpmn:SequenceFlow'
      ].includes(elementType)
    );
  }
}
