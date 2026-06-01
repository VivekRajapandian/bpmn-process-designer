import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { BpmnModelerAdapterService } from '../../services/bpmn-modeler-adapter.service';
import {
  Camunda8ClientService,
  DeployedProcessDefinition,
  UserTask
} from '../camunda8/camunda8-client.service';

export type TaskHandlingMode = 'manual' | 'auto-complete-user-tasks';

export interface RuntimeStatus {
  state:
    | 'idle'
    | 'waiting'
    | 'deploying'
    | 'starting'
    | 'success'
    | 'error';
  message: string;
  processInstanceKey?: string;
  error?: string;
}

/**
 * Integrates token simulator events with the Camunda 8 runtime only when
 * Play mode is active. Token simulation alone stays local to the modeler.
 */
@Injectable({ providedIn: 'root' })
export class PlayRuntimeIntegrationService {
  private readonly status$ = new BehaviorSubject<RuntimeStatus>({
    state: 'idle',
    message: 'Play mode is off'
  });

  private deploymentTriggered = false;
  private instanceStarted = false;
  private playModeActive = false;
  private tokenSimulationActive = false;
  private taskHandlingMode: TaskHandlingMode = 'manual';
  private deploymentPromise?: Promise<void>;
  private deployedProcessDefinition?: DeployedProcessDefinition;
  private currentProcessInstanceKey?: string;
  private readonly completingUserTaskElementIds = new Set<string>();

  constructor(
    private readonly modelerAdapter: BpmnModelerAdapterService,
    private readonly camunda8Client: Camunda8ClientService
  ) {}

  /**
   * Initialize the service and start listening to token simulator events.
   */
  initialize(): void {
    try {
      const eventBus = this.modelerAdapter.getEventBus();

      console.log('🔧 [PlayRuntime] Initializing PlayRuntimeIntegrationService');
      console.log('👂 [PlayRuntime] Subscribing to token simulator events...');

      eventBus.on('tokenSimulation.playSimulation', () => {
        console.log(
          `[PlayRuntime] tokenSimulation.playSimulation received ` +
          `(playModeActive=${this.playModeActive}, tokenSimulationActive=${this.tokenSimulationActive}, ` +
          `deploymentTriggered=${this.deploymentTriggered}, instanceStarted=${this.instanceStarted})`
        );
        if (!this.playModeActive) {
          console.warn('[PlayRuntime] Ignoring token simulation play because Play mode is not active');
          return;
        }

        void this.startProcessInstance();
      });

      eventBus.on('tokenSimulation.simulator.createScope', (event: any) => {
        console.log(
          `[PlayRuntime] tokenSimulation.simulator.createScope received ` +
          `(scopeElement=${event?.scope?.element?.id || '(unknown)'}, ` +
          `playModeActive=${this.playModeActive}, tokenSimulationActive=${this.tokenSimulationActive}, ` +
          `deploymentTriggered=${this.deploymentTriggered}, instanceStarted=${this.instanceStarted})`
        );

        if (!this.playModeActive || !this.tokenSimulationActive) {
          return;
        }

        void this.startProcessInstance();
      });

      eventBus.on('tokenSimulation.simulator.trace', (event: any) => {
        const element = event?.element;
        console.log(
          `[PlayRuntime] tokenSimulation.simulator.trace received ` +
          `(action=${event?.action}, element=${element?.id || '(none)'}, type=${element?.type || '(none)'}, ` +
          `playModeActive=${this.playModeActive}, tokenSimulationActive=${this.tokenSimulationActive}, ` +
          `processInstanceKey=${this.currentProcessInstanceKey || '(none)'})`
        );

        if (
          event?.action === 'signal' &&
          element?.type === 'bpmn:UserTask' &&
          this.playModeActive &&
          this.tokenSimulationActive &&
          this.taskHandlingMode === 'manual'
        ) {
          void this.completeUserTaskAfterTokenResume(element.id);
        }
      });

      // Reset the deployment flag when simulation is reset
      eventBus.on('tokenSimulation.resetSimulation', () => {
        console.log(
          `[PlayRuntime] tokenSimulation.resetSimulation received ` +
          `(playModeActive=${this.playModeActive})`
        );
        if (this.playModeActive) {
          this.resetRuntimeSession();
        }
      });

      // Reset when simulation is paused (allow re-triggering on next play)
      eventBus.on('tokenSimulation.pauseSimulation', () => {
        console.log(
          `[PlayRuntime] tokenSimulation.pauseSimulation received ` +
          `(playModeActive=${this.playModeActive}, instanceStarted=${this.instanceStarted})`
        );
        // Don't reset here - we want to prevent multiple deploys during a single session
      });

      // Reset on toggle off
      eventBus.on('tokenSimulation.toggleMode', (event: any) => {
        console.log(
          `[PlayRuntime] tokenSimulation.toggleMode received ` +
          `(active=${event.active}, playModeActive=${this.playModeActive}, ` +
          `deploymentTriggered=${this.deploymentTriggered})`
        );
        this.tokenSimulationActive = event.active;

        if (!this.playModeActive) {
          console.warn('[PlayRuntime] Token simulation changed outside Play mode - no Camunda interaction');
          return;
        }

        if (event.active) {
          console.log('🟢 [PlayRuntime] Token simulation toggled ON in Play mode - Deploying BPMN');
          this.modelerAdapter.setUserTaskPausePoints(true);
          this.ensureDeployment();
        } else {
          console.log('🔴 [PlayRuntime] Token simulation toggled OFF in Play mode - Resetting runtime session');
          this.modelerAdapter.setUserTaskPausePoints(false);
          this.resetRuntimeSession();
        }
      });

      console.log('✅ [PlayRuntime] Initialization complete - Ready to intercept token simulation');

      this.updateStatus('idle', 'Play mode is off');
    } catch (error) {
      console.error('❌ [PlayRuntime] Initialization failed:', error);
      this.updateStatus('error', 'Failed to initialize runtime integration');
    }
  }

  /**
   * Get the current runtime status as an observable.
   */
  getStatus(): Observable<RuntimeStatus> {
    return this.status$.asObservable();
  }

  /**
   * Get the current status value synchronously.
   */
  getCurrentStatus(): RuntimeStatus {
    return this.status$.value;
  }

  setPlayModeActive(active: boolean): void {
    console.log(
      `[PlayRuntime] setPlayModeActive(${active}) called ` +
      `(previous=${this.playModeActive}, tokenSimulationActive=${this.tokenSimulationActive}, ` +
      `deploymentTriggered=${this.deploymentTriggered})`
    );

    if (active === this.playModeActive) {
      return;
    }

    this.playModeActive = active;

    if (!active) {
      this.resetRuntimeSession();
      this.updateStatus('idle', 'Play mode is off');
      return;
    }

    this.updateStatus('waiting', 'Play mode is on - enable token simulation to deploy');

    if (this.tokenSimulationActive) {
      this.modelerAdapter.setUserTaskPausePoints(true);
      this.ensureDeployment();
    }
  }

  setTaskHandlingMode(mode: TaskHandlingMode): void {
    console.log(`[PlayRuntime] setTaskHandlingMode(${mode}) called (previous=${this.taskHandlingMode})`);
    this.taskHandlingMode = mode;

    if (this.playModeActive) {
      const message =
        mode === 'auto-complete-user-tasks'
          ? 'Play mode is on - user tasks will auto-complete'
          : 'Play mode is on - user tasks wait in Camunda';

      this.updateStatus('waiting', message);
    }
  }

  private resetRuntimeSession(): void {
    console.log(
      `[PlayRuntime] Runtime session reset ` +
      `(was deploymentTriggered=${this.deploymentTriggered}, instanceStarted=${this.instanceStarted})`
    );
    this.modelerAdapter.setUserTaskPausePoints(false);
    this.deploymentTriggered = false;
    this.instanceStarted = false;
    this.deploymentPromise = undefined;
    this.deployedProcessDefinition = undefined;
    this.currentProcessInstanceKey = undefined;
    this.completingUserTaskElementIds.clear();
    this.updateStatus('waiting', 'Play mode is on - enable token simulation to deploy');
  }

  async startProcessInstance(): Promise<void> {
    console.log(
      `[PlayRuntime] startProcessInstance requested ` +
      `(playModeActive=${this.playModeActive}, tokenSimulationActive=${this.tokenSimulationActive}, ` +
      `deploymentTriggered=${this.deploymentTriggered}, instanceStarted=${this.instanceStarted}, ` +
      `hasDeployment=${Boolean(this.deployedProcessDefinition)})`
    );

    if (!this.playModeActive) {
      console.warn('[PlayRuntime] Start blocked: Play mode is not active');
      this.updateStatus('idle', 'Switch to Play mode before starting an instance');
      return;
    }

    if (!this.tokenSimulationActive) {
      console.warn('[PlayRuntime] Start blocked: token simulation is not active');
      this.updateStatus('waiting', 'Enable token simulation before starting an instance');
      return;
    }

    if (this.instanceStarted) {
      console.warn('[PlayRuntime] Start blocked: instance already started for this simulation session');
      return;
    }

    this.instanceStarted = true;

    try {
      await this.ensureDeployment();

      if (!this.deployedProcessDefinition) {
        throw new Error('No deployed process definition available to start a process instance.');
      }

      console.log('[PlayRuntime] Starting instance with deployed definition:', this.deployedProcessDefinition);

      this.updateStatus(
        'starting',
        `Starting process instance (Process ID: ${this.deployedProcessDefinition.processDefinitionId}, version: ${this.deployedProcessDefinition.processDefinitionVersion})...`
      );

      const instance = await this.camunda8Client.startProcessInstance(
        this.deployedProcessDefinition.processDefinitionId,
        this.deployedProcessDefinition.processDefinitionVersion
      );
      const processInstanceKey = instance.processInstanceKey;
      this.currentProcessInstanceKey = processInstanceKey;

      console.log(`✅ [PlayRuntime] Process Instance START SUCCESS - Instance Key: "${processInstanceKey}"`);

      if (this.taskHandlingMode === 'auto-complete-user-tasks') {
        await this.autoCompleteUserTasks(processInstanceKey);
      } else {
        this.updateStatus(
          'success',
          `Process instance started: ${processInstanceKey}. User tasks wait in Camunda.`,
          processInstanceKey
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      console.error(`❌ [PlayRuntime] FAILED: ${errorMessage}`, error);

      this.updateStatus('error', errorMessage);
      this.instanceStarted = false;
    }
  }

  private ensureDeployment(): Promise<void> {
    console.log(
      `[PlayRuntime] ensureDeployment called ` +
      `(deploymentTriggered=${this.deploymentTriggered}, hasPromise=${Boolean(this.deploymentPromise)}, ` +
      `hasDefinition=${Boolean(this.deployedProcessDefinition)})`
    );

    if (this.deploymentTriggered) {
      console.log('[PlayRuntime] Deployment already triggered for this simulation session');
      return this.deploymentPromise || Promise.resolve();
    }

    this.deploymentTriggered = true;
    this.deploymentPromise = this.deployCurrentDiagram();
    void this.deploymentPromise.catch(() => undefined);

    return this.deploymentPromise;
  }

  private async deployCurrentDiagram(): Promise<void> {
    try {
      console.log('[PlayRuntime] Deploy current diagram started');

      this.updateStatus('deploying', 'Exporting BPMN and deploying...');

      // Get the latest BPMN XML from the modeler
      const bpmnXml = await this.modelerAdapter.saveXml();
      console.log('📄 [PlayRuntime] BPMN XML exported successfully');

      // Extract the process ID
      const processId = this.modelerAdapter.getExecutableProcessId();
      console.log(`[PlayRuntime] Executable process ID from modeler: ${processId || '(none)'}`);

      if (!processId) {
        throw new Error(
          'No executable process found in BPMN diagram. ' +
          'Please ensure the diagram contains at least one executable process.'
        );
      }

      console.log(`📋 [PlayRuntime] Process ID extracted: "${processId}"`);

      console.log(`🚀 [PlayRuntime] Starting Camunda 8 deployment for process: "${processId}"`);
      this.updateStatus('deploying', `Deploying BPMN (Process ID: ${processId})...`);

      const deployment = await this.camunda8Client.deployBpmnXml(bpmnXml, 'process.bpmn');
      const deploymentKey = deployment.deploymentKey;
      console.log('[PlayRuntime] Raw deployment response:', deployment);
      const processDefinition =
        this.camunda8Client.findDeployedProcessDefinition(deployment, processId);

      console.log(
        `[PlayRuntime] BPMN deployment success ` +
        `(deploymentKey=${deploymentKey}, processDefinitionId=${processDefinition.processDefinitionId}, ` +
        `processDefinitionVersion=${processDefinition.processDefinitionVersion})`
      );

      this.deployedProcessDefinition = processDefinition;
      this.updateStatus('success', `BPMN deployed: ${deploymentKey}`);

      console.log('🎉 [PlayRuntime] Camunda 8 deployment complete; waiting for play to start instance');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      console.error(`❌ [PlayRuntime] FAILED: ${errorMessage}`, error);

      this.updateStatus('error', errorMessage);

      // Reset flag on error to allow retry
      this.deploymentTriggered = false;
      this.deploymentPromise = undefined;

      throw error;
    }
  }

  private async autoCompleteUserTasks(processInstanceKey: string): Promise<void> {
    console.log(
      `[PlayRuntime] Auto-complete user tasks started ` +
      `(processInstanceKey=${processInstanceKey})`
    );
    const maxAttempts = 30;
    const pollDelayMs = 1000;
    let completedCount = 0;
    let idleChecks = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      this.updateStatus(
        'starting',
        `Watching user tasks for auto-complete (${attempt}/${maxAttempts})...`,
        processInstanceKey
      );

      const tasks = await this.camunda8Client.searchUserTasks(processInstanceKey);
      console.log(`[PlayRuntime] User task poll ${attempt}/${maxAttempts}:`, tasks);
      const openTasks = tasks.filter((task) => this.isOpenUserTask(task));

      if (openTasks.length === 0) {
        idleChecks += 1;

        if (idleChecks >= 3) {
          break;
        }

        await this.delay(pollDelayMs);
        continue;
      }

      idleChecks = 0;

      for (const task of openTasks) {
        const userTaskKey = this.getUserTaskKey(task);

        if (!userTaskKey) {
          console.warn('[PlayRuntime] Skipping user task without key:', task);
          continue;
        }

        this.updateStatus(
          'starting',
          `Auto-completing user task ${task.name || userTaskKey}...`,
          processInstanceKey
        );

        await this.camunda8Client.completeUserTask(userTaskKey);
        completedCount += 1;
        this.continueUserTaskToken(task);
      }

      await this.delay(pollDelayMs);
    }

    this.updateStatus(
      'success',
      `Process instance started: ${processInstanceKey}. Auto-completed ${completedCount} user task${completedCount === 1 ? '' : 's'}.`,
      processInstanceKey
    );
  }

  private isOpenUserTask(task: UserTask): boolean {
    return !['COMPLETED', 'CANCELED', 'CANCELLED'].includes((task.state || '').toUpperCase());
  }

  private getUserTaskKey(task: UserTask): string | undefined {
    return task.userTaskKey || task.key || task.id;
  }

  private async completeUserTaskAfterTokenResume(elementId: string): Promise<void> {
    if (!this.currentProcessInstanceKey) {
      console.warn(`[PlayRuntime] Cannot complete user task for "${elementId}" because no process instance key is known`);
      return;
    }

    if (this.completingUserTaskElementIds.has(elementId)) {
      console.log(`[PlayRuntime] User task completion already in progress for "${elementId}"`);
      return;
    }

    this.completingUserTaskElementIds.add(elementId);

    try {
      const task = await this.findOpenUserTaskForElement(
        this.currentProcessInstanceKey,
        elementId
      );

      if (!task) {
        console.warn(
          `[PlayRuntime] No open Camunda user task found for resumed token at "${elementId}"`
        );
        return;
      }

      const userTaskKey = this.getUserTaskKey(task);

      if (!userTaskKey) {
        console.warn('[PlayRuntime] Cannot complete Camunda user task without key:', task);
        return;
      }

      this.updateStatus(
        'starting',
        `Completing Camunda user task ${task.name || userTaskKey}...`,
        this.currentProcessInstanceKey
      );

      await this.camunda8Client.completeUserTask(userTaskKey);

      this.updateStatus(
        'success',
        `Completed Camunda user task ${task.name || userTaskKey}.`,
        this.currentProcessInstanceKey
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      console.error(`[PlayRuntime] Failed to complete user task after token resume: ${errorMessage}`, error);
      this.updateStatus('error', errorMessage, this.currentProcessInstanceKey);
    } finally {
      this.completingUserTaskElementIds.delete(elementId);
    }
  }

  private async findOpenUserTaskForElement(
    processInstanceKey: string,
    elementId: string
  ): Promise<UserTask | undefined> {
    const maxAttempts = 10;
    const pollDelayMs = 500;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const tasks = await this.camunda8Client.searchUserTasks(processInstanceKey);
      const openTasks = tasks.filter((task) => this.isOpenUserTask(task));
      const matchingTask = openTasks.find(
        (task) => this.getUserTaskElementId(task) === elementId
      );

      console.log(
        `[PlayRuntime] Manual user task lookup ${attempt}/${maxAttempts} for "${elementId}":`,
        { openTasks, matchingTask }
      );

      if (matchingTask) {
        return matchingTask;
      }

      if (openTasks.length === 1) {
        console.warn(
          `[PlayRuntime] Falling back to the only open Camunda user task for resumed BPMN element "${elementId}"`
        );
        return openTasks[0];
      }

      await this.delay(pollDelayMs);
    }

    return undefined;
  }

  private getUserTaskElementId(task: UserTask): string | undefined {
    return task.elementId || task.flowNodeId || task.taskDefinitionId || task.bpmnElementId;
  }

  private continueUserTaskToken(task: UserTask): void {
    const elementId = this.getUserTaskElementId(task);

    if (this.modelerAdapter.continueUserTaskToken(elementId)) {
      return;
    }

    if (elementId) {
      this.modelerAdapter.continueUserTaskToken();
    }
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }

  /**
   * Update the status and notify subscribers.
   */
  private updateStatus(
    state: RuntimeStatus['state'],
    message: string,
    processInstanceKey?: string
  ): void {
    this.status$.next({
      state,
      message,
      processInstanceKey,
      error: state === 'error' ? message : undefined
    });
  }
}
