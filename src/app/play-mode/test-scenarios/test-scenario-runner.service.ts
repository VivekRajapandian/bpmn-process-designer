import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PlayRuntimeIntegrationService } from '../../core/play-mode/play-runtime-integration.service';
import { BpmnModelerAdapterService } from '../../services/bpmn-modeler-adapter.service';
import { TestInstruction, TestScenario } from './test-scenario.model';
import { TestScenarioEventService } from './test-scenario-event.service';
import { TestScenarioRecorderService } from './test-scenario-recorder.service';

export interface TestScenarioRunStatus {
  state: 'idle' | 'running' | 'passed' | 'failed';
  scenarioName?: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class TestScenarioRunnerService {
  private readonly status$ = new BehaviorSubject<TestScenarioRunStatus>({
    state: 'idle',
    message: 'No scenario is running'
  });
  private readonly visitedElementIds = new Set<string>();
  private readonly waiters: Array<{
    elementId: string;
    resolve: () => void;
  }> = [];
  private completedWaiter?: () => void;
  private initialized = false;
  private running = false;

  constructor(
    private readonly modelerAdapter: BpmnModelerAdapterService,
    private readonly runtimeIntegration: PlayRuntimeIntegrationService,
    private readonly recorder: TestScenarioRecorderService,
    private readonly testScenarioEvents: TestScenarioEventService
  ) {}

  initialize(): void {
    if (this.initialized) {
      return;
    }

    const eventBus = this.modelerAdapter.getEventBus();

    eventBus.on('tokenSimulation.simulator.trace', (event: any) => {
      const elementId = event?.element?.id;

      if (!elementId || event?.action !== 'enter') {
        return;
      }

      this.visitedElementIds.add(elementId);
      this.resolveElementWaiters(elementId);
    });

    this.testScenarioEvents.getRuntimeActions().subscribe((action) => {
      if (action.type === 'process-instance-completed') {
        this.completedWaiter?.();
        this.completedWaiter = undefined;
      }
    });

    this.initialized = true;
  }

  getStatus(): Observable<TestScenarioRunStatus> {
    return this.status$.asObservable();
  }

  async runScenario(scenario: TestScenario): Promise<void> {
    if (this.running) {
      return;
    }

    this.initialize();
    this.running = true;
    this.runtimeIntegration.setScenarioReplayActive(true);
    this.recorder.setScenarioReplayActive(true);
    this.visitedElementIds.clear();
    this.waiters.splice(0);
    this.completedWaiter = undefined;

    const testCase = scenario.testCases[0];
    const instructions = testCase?.instructions || [];
    const scenarioName = testCase?.name || 'Recorded Test';

    this.status$.next({
      state: 'running',
      scenarioName,
      message: `Running ${scenarioName}`
    });

    try {
      if (!instructions.length) {
        throw new Error('Scenario has no instructions to run.');
      }

      for (const instruction of instructions) {
        await this.runInstruction(instruction);
      }

      await this.waitForScenarioCompletion();

      this.status$.next({
        state: 'passed',
        scenarioName,
        message: `Scenario passed: ${scenarioName}`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scenario run failed.';

      this.status$.next({
        state: 'failed',
        scenarioName,
        message
      });
      throw error;
    } finally {
      this.runtimeIntegration.setScenarioReplayActive(false);
      this.recorder.setScenarioReplayActive(false);
      this.running = false;
    }
  }

  private async runInstruction(instruction: TestInstruction): Promise<void> {
    if (instruction.type === 'create-process-instance') {
      await this.startScenarioInstance(instruction);
      return;
    }

    if (instruction.type === 'complete-user-task') {
      await this.waitForElement(instruction.elementId);
      await this.runtimeIntegration.completeUserTaskForScenario(instruction.elementId);
      return;
    }

    if (instruction.type === 'complete-job') {
      await this.waitForElement(instruction.elementId);
      await this.runtimeIntegration.completeJobForScenario(instruction.elementId);
      return;
    }

    if (instruction.type === 'publish-message') {
      await this.waitForElement(instruction.attachedToElementId || instruction.elementId);
      await this.runtimeIntegration.publishMessageForScenario(
        instruction.elementId,
        instruction.messageName,
        instruction.correlationKey
      );
      return;
    }

    throw new Error(`Unsupported scenario instruction "${instruction.type}".`);
  }

  private async startScenarioInstance(instruction: TestInstruction): Promise<void> {
    if (!this.modelerAdapter.isTokenSimulationActive()) {
      this.modelerAdapter.setTokenSimulationActive(true);
      await this.delay(100);
    }

    await this.runtimeIntegration.startProcessInstance();
    this.modelerAdapter.triggerTokenSimulationElement(instruction.elementId);
  }

  private waitForElement(elementId: string): Promise<void> {
    if (this.visitedElementIds.has(elementId)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        const index = this.waiters.findIndex((waiter) => waiter.resolve === wrappedResolve);

        if (index !== -1) {
          this.waiters.splice(index, 1);
        }

        reject(new Error(`Timed out waiting for BPMN element "${elementId}".`));
      }, 30000);

      const wrappedResolve = () => {
        window.clearTimeout(timeoutId);
        resolve();
      };

      this.waiters.push({
        elementId,
        resolve: wrappedResolve
      });
    });
  }

  private waitForScenarioCompletion(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.completedWaiter = undefined;
        reject(new Error('Timed out waiting for process instance completion.'));
      }, 30000);

      this.completedWaiter = () => {
        window.clearTimeout(timeoutId);
        resolve();
      };
    });
  }

  private resolveElementWaiters(elementId: string): void {
    const matchingWaiters = this.waiters.filter((waiter) => waiter.elementId === elementId);

    this.waiters.splice(
      0,
      this.waiters.length,
      ...this.waiters.filter((waiter) => waiter.elementId !== elementId)
    );

    matchingWaiters.forEach((waiter) => waiter.resolve());
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }
}
