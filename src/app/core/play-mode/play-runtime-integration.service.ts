import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { BpmnModelerAdapterService } from '../../services/bpmn-modeler-adapter.service';
import {
  ActivatedJob,
  Camunda8ClientService,
  DeployedProcessDefinition,
  UserTask
} from '../camunda8/camunda8-client.service';
import { TestScenarioRuntimeAction } from '../../play-mode/test-scenarios/test-scenario.model';

export type TaskHandlingMode = 'manual' | 'auto-complete';

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
  private instanceStartInProgress = false;
  private runtimeInstanceCompleted = false;
  private playModeActive = false;
  private tokenSimulationActive = false;
  private taskHandlingMode: TaskHandlingMode = 'manual';
  private deploymentPromise?: Promise<void>;
  private deployedProcessDefinition?: DeployedProcessDefinition;
  private currentProcessInstanceKey?: string;
  private readonly completingUserTaskElementIds = new Set<string>();
  private readonly completingServiceTaskElementIds = new Set<string>();
  private readonly correlatedMessageEventElementIds = new Set<string>();
  private readonly defaultMessageCorrelationKey = '123';

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

      console.log('[PlayRuntime] Initializing PlayRuntimeIntegrationService');
      console.log('[PlayRuntime] Subscribing to token simulator events...');

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

        if (
          !this.playModeActive ||
          !this.tokenSimulationActive ||
          event?.scope?.parent
        ) {
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

        if (this.isMessageEventElement(element)) {
          this.logMessageEventTrace(event, element);
        }

        this.logAttachedMessageEventTraces(event, element);

        if (
          event?.action === 'signal' &&
          element?.type === 'bpmn:UserTask' &&
          this.playModeActive &&
          this.tokenSimulationActive &&
          this.taskHandlingMode === 'manual'
        ) {
          void this.completeUserTaskAfterTokenResume(element.id);
        }

        if (
          event?.action === 'signal' &&
          element?.type === 'bpmn:ServiceTask' &&
          this.playModeActive &&
          this.tokenSimulationActive &&
          this.taskHandlingMode === 'manual'
        ) {
          void this.completeServiceTaskJobAtElement(element, false);
        }

        if (
          event?.action === 'enter' &&
          element?.type === 'bpmn:UserTask' &&
          this.playModeActive &&
          this.tokenSimulationActive &&
          this.taskHandlingMode === 'auto-complete'
        ) {
          void this.autoCompleteUserTaskAtElement(element.id);
        }

        if (
          event?.action === 'enter' &&
          element?.type === 'bpmn:ServiceTask' &&
          this.playModeActive &&
          this.tokenSimulationActive &&
          this.taskHandlingMode === 'auto-complete'
        ) {
          void this.completeServiceTaskJobAtElement(element, true);
        }
      });

      eventBus.on('tokenSimulation.simulator.destroyScope', (event: any) => {
        const scope = event?.scope;
        const element = scope?.element;
        console.log(
          `[PlayRuntime] tokenSimulation.simulator.destroyScope received ` +
          `(scopeElement=${element?.id || '(unknown)'}, type=${element?.type || '(none)'}, ` +
          `completed=${Boolean(scope?.completed)}, playModeActive=${this.playModeActive}, ` +
          `tokenSimulationActive=${this.tokenSimulationActive}, instanceStarted=${this.instanceStarted}, ` +
          `runtimeInstanceCompleted=${this.runtimeInstanceCompleted})`
        );

        if (
          this.playModeActive &&
          this.tokenSimulationActive &&
          scope?.completed &&
          this.isRootSimulationScope(element)
        ) {
          this.markRuntimeInstanceCompleted();
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
          console.log('[PlayRuntime] Token simulation toggled ON in Play mode - Deploying BPMN');
          this.modelerAdapter.setTaskPausePoints(true);
          this.ensureDeployment();
        } else {
          console.log('[PlayRuntime] Token simulation toggled OFF in Play mode - Resetting runtime session');
          this.modelerAdapter.setTaskPausePoints(false);
          this.resetRuntimeSession();
        }
      });

      console.log('[PlayRuntime] Initialization complete - Ready to intercept token simulation');

      this.updateStatus('idle', 'Play mode is off');
    } catch (error) {
      console.error('[PlayRuntime] Initialization failed:', error);
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
      this.modelerAdapter.setTaskPausePoints(true);
      this.ensureDeployment();
    }
  }

  setTaskHandlingMode(mode: TaskHandlingMode): void {
    console.log(`[PlayRuntime] setTaskHandlingMode(${mode}) called (previous=${this.taskHandlingMode})`);
    this.taskHandlingMode = mode;

    if (this.playModeActive) {
      const message =
        mode === 'auto-complete'
          ? 'Play mode is on - tasks will auto-complete'
          : 'Play mode is on - user and service tasks wait in Camunda';

      this.updateStatus('waiting', message);
    }
  }

  private resetRuntimeSession(): void {
    console.log(
      `[PlayRuntime] Runtime session reset ` +
      `(was deploymentTriggered=${this.deploymentTriggered}, instanceStarted=${this.instanceStarted})`
    );
    this.modelerAdapter.setTaskPausePoints(false);
    this.deploymentTriggered = false;
    this.instanceStarted = false;
    this.instanceStartInProgress = false;
    this.runtimeInstanceCompleted = false;
    this.deploymentPromise = undefined;
    this.deployedProcessDefinition = undefined;
    this.currentProcessInstanceKey = undefined;
    this.completingUserTaskElementIds.clear();
    this.completingServiceTaskElementIds.clear();
    this.correlatedMessageEventElementIds.clear();
    this.updateStatus('waiting', 'Play mode is on - enable token simulation to deploy');
  }

  private markRuntimeInstanceCompleted(): void {
    if (!this.instanceStarted && !this.currentProcessInstanceKey) {
      return;
    }

    console.log(
      `[PlayRuntime] Runtime instance session completed ` +
      `(processInstanceKey=${this.currentProcessInstanceKey || '(none)'})`
    );

    this.instanceStarted = false;
    this.instanceStartInProgress = false;
    this.runtimeInstanceCompleted = true;
    this.emitTestScenarioRuntimeAction({
      type: 'process-instance-completed',
      elementId: this.deployedProcessDefinition?.processDefinitionId || '',
      processDefinitionId: this.deployedProcessDefinition?.processDefinitionId,
      processInstanceId: this.currentProcessInstanceKey
    });
    this.updateStatus('waiting', 'Process instance completed. Click play to start a new instance.');
  }

  private clearCompletedRuntimeInstanceSession(): void {
    console.log(
      `[PlayRuntime] Clearing completed runtime instance before starting a new one ` +
      `(processInstanceKey=${this.currentProcessInstanceKey || '(none)'})`
    );

    this.instanceStarted = false;
    this.instanceStartInProgress = false;
    this.runtimeInstanceCompleted = false;
    this.currentProcessInstanceKey = undefined;
    this.completingUserTaskElementIds.clear();
    this.completingServiceTaskElementIds.clear();
    this.correlatedMessageEventElementIds.clear();
  }

  async startProcessInstance(): Promise<void> {
    console.log(
      `[PlayRuntime] startProcessInstance requested ` +
      `(playModeActive=${this.playModeActive}, tokenSimulationActive=${this.tokenSimulationActive}, ` +
      `deploymentTriggered=${this.deploymentTriggered}, instanceStarted=${this.instanceStarted}, ` +
      `runtimeInstanceCompleted=${this.runtimeInstanceCompleted}, ` +
      `hasProcessInstanceKey=${Boolean(this.currentProcessInstanceKey)}, ` +
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

    if (this.instanceStartInProgress) {
      console.warn('[PlayRuntime] Start blocked: instance already started for this simulation session');
      return;
    }

    if ((this.instanceStarted || this.currentProcessInstanceKey) && !this.runtimeInstanceCompleted) {
      console.warn('[PlayRuntime] Start blocked: process instance is still active for this simulation session');
      return;
    }

    if (this.runtimeInstanceCompleted) {
      this.clearCompletedRuntimeInstanceSession();
    }

    this.instanceStartInProgress = true;
    this.instanceStarted = true;
    this.runtimeInstanceCompleted = false;

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
      this.completingUserTaskElementIds.clear();
      this.correlatedMessageEventElementIds.clear();
      this.runtimeInstanceCompleted = false;
      this.emitTestScenarioRuntimeAction({
        type: 'create-process-instance',
        elementId: this.getStartEventId() || this.deployedProcessDefinition.processDefinitionId,
        processDefinitionId: this.deployedProcessDefinition.processDefinitionId,
        variables: '{}',
        processInstanceId: processInstanceKey
      });

      console.log(`[PlayRuntime] Process Instance START SUCCESS - Instance Key: "${processInstanceKey}"`);

      if (this.taskHandlingMode === 'auto-complete') {
        this.updateStatus(
          'success',
          `Process instance started: ${processInstanceKey}. Waiting to auto-complete tasks as tokens arrive.`,
          processInstanceKey
        );
        this.instanceStarted = false;
      } else {
        this.updateStatus(
          'success',
          `Process instance started: ${processInstanceKey}. User and service tasks wait in Camunda.`,
          processInstanceKey
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      console.error(`[PlayRuntime] FAILED: ${errorMessage}`, error);

      this.updateStatus('error', errorMessage);
      this.instanceStarted = false;
      this.runtimeInstanceCompleted = false;
    } finally {
      this.instanceStartInProgress = false;
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
      console.log('[PlayRuntime] BPMN XML exported successfully');

      // Extract the process ID
      const processId = this.modelerAdapter.getExecutableProcessId();
      console.log(`[PlayRuntime] Executable process ID from modeler: ${processId || '(none)'}`);

      if (!processId) {
        throw new Error(
          'No executable process found in BPMN diagram. ' +
          'Please ensure the diagram contains at least one executable process.'
        );
      }

      console.log(`[PlayRuntime] Process ID extracted: "${processId}"`);

      console.log(`[PlayRuntime] Starting Camunda 8 deployment for process: "${processId}"`);
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
      this.updateStatus('waiting', `BPMN deployed: ${deploymentKey}. Waiting for token simulation play...`);

      console.log('[PlayRuntime] Camunda 8 deployment complete; waiting for play to start instance');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      console.error(`[PlayRuntime] FAILED: ${errorMessage}`, error);

      this.updateStatus('error', errorMessage);

      // Reset flag on error to allow retry
      this.deploymentTriggered = false;
      this.deploymentPromise = undefined;

      throw error;
    }
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
      this.emitTestScenarioRuntimeAction({
        type: 'complete-user-task',
        elementId,
        processInstanceId: this.currentProcessInstanceKey
      });

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

  private async autoCompleteUserTaskAtElement(elementId: string): Promise<void> {
    if (!this.currentProcessInstanceKey) {
      console.warn(`[PlayRuntime] Cannot auto-complete user task for "${elementId}" because no process instance key is known`);
      return;
    }

    if (this.completingUserTaskElementIds.has(elementId)) {
      console.log(`[PlayRuntime] Auto-complete already in progress for "${elementId}"`);
      return;
    }

    this.completingUserTaskElementIds.add(elementId);

    try {
      this.updateStatus(
        'starting',
        `Waiting for Camunda user task at ${elementId}...`,
        this.currentProcessInstanceKey
      );

      const task = await this.findOpenUserTaskForElement(
        this.currentProcessInstanceKey,
        elementId
      );

      if (!task) {
        console.warn(`[PlayRuntime] No open Camunda user task found to auto-complete for "${elementId}"`);
        this.updateStatus(
          'success',
          `No open Camunda user task found for ${elementId}.`,
          this.currentProcessInstanceKey
        );
        return;
      }

      const userTaskKey = this.getUserTaskKey(task);

      if (!userTaskKey) {
        console.warn('[PlayRuntime] Cannot auto-complete Camunda user task without key:', task);
        return;
      }

      this.updateStatus(
        'starting',
        `Auto-completing user task ${task.name || userTaskKey}...`,
        this.currentProcessInstanceKey
      );

      await this.camunda8Client.completeUserTask(userTaskKey);
      this.emitTestScenarioRuntimeAction({
        type: 'complete-user-task',
        elementId,
        processInstanceId: this.currentProcessInstanceKey
      });
      this.continueUserTaskToken(task);

      this.updateStatus(
        'success',
        `Auto-completed user task ${task.name || userTaskKey}.`,
        this.currentProcessInstanceKey
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      console.error(`[PlayRuntime] Failed to auto-complete user task at "${elementId}": ${errorMessage}`, error);
      this.updateStatus('error', errorMessage, this.currentProcessInstanceKey);
    } finally {
      this.completingUserTaskElementIds.delete(elementId);
    }
  }

  private async completeServiceTaskJobAtElement(
    element: any,
    continueTokenAfterCompletion: boolean
  ): Promise<void> {
    const elementId = element?.id;

    if (!this.currentProcessInstanceKey) {
      console.warn(`[PlayRuntime] Cannot auto-complete service task "${elementId}" because no process instance key is known`);
      return;
    }

    if (!elementId) {
      console.warn('[PlayRuntime] Cannot auto-complete service task without an element id:', element);
      return;
    }

    if (this.completingServiceTaskElementIds.has(elementId)) {
      console.log(`[PlayRuntime] Service task auto-complete already in progress for "${elementId}"`);
      return;
    }

    const jobType = this.getServiceTaskJobType(element);

    if (!jobType) {
      console.warn(`[PlayRuntime] Service task "${elementId}" has no Zeebe job type to activate`);
      this.updateStatus(
        'success',
        `No job type found for service task ${elementId}.`,
        this.currentProcessInstanceKey
      );
      return;
    }

    this.completingServiceTaskElementIds.add(elementId);

    try {
      this.updateStatus(
        'starting',
        `${continueTokenAfterCompletion ? 'Auto-completing' : 'Completing'} Camunda job for service task ${elementId} (${jobType})...`,
        this.currentProcessInstanceKey
      );

      const job = await this.findActivatedJobForElement(
        this.currentProcessInstanceKey,
        elementId,
        jobType
      );

      if (!job) {
        console.warn(`[PlayRuntime] No Camunda job found to auto-complete for service task "${elementId}"`);
        this.updateStatus(
          'success',
          `No Camunda job found for service task ${elementId}.`,
          this.currentProcessInstanceKey
        );
        return;
      }

      const jobKey = this.getJobKey(job);

      if (!jobKey) {
        console.warn('[PlayRuntime] Cannot complete Camunda job without key:', job);
        return;
      }

      this.updateStatus(
        'starting',
        `${continueTokenAfterCompletion ? 'Auto-completing' : 'Completing'} service task job ${jobKey}...`,
        this.currentProcessInstanceKey
      );

      await this.camunda8Client.completeJob(jobKey);
      this.emitTestScenarioRuntimeAction({
        type: 'complete-job',
        elementId,
        jobType,
        processInstanceId: this.currentProcessInstanceKey
      });

      if (continueTokenAfterCompletion) {
        this.modelerAdapter.continueTaskToken(elementId);
      }

      this.updateStatus(
        'success',
        `${continueTokenAfterCompletion ? 'Auto-completed' : 'Completed'} service task job ${jobKey}.`,
        this.currentProcessInstanceKey
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      console.error(`[PlayRuntime] Failed to auto-complete service task "${elementId}": ${errorMessage}`, error);
      this.updateStatus('error', errorMessage, this.currentProcessInstanceKey);
    } finally {
      this.completingServiceTaskElementIds.delete(elementId);
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

    console.warn(
      `[PlayRuntime] Timed out waiting for open Camunda user task for BPMN element "${elementId}"`
    );
    this.updateStatus(
      'success',
      `No open Camunda user task found for ${elementId}. Token can continue.`,
      processInstanceKey
    );

    return undefined;
  }

  private getUserTaskElementId(task: UserTask): string | undefined {
    return task.elementId || task.flowNodeId || task.taskDefinitionId || task.bpmnElementId;
  }

  private async findActivatedJobForElement(
    processInstanceKey: string,
    elementId: string,
    jobType: string
  ): Promise<ActivatedJob | undefined> {
    const maxAttempts = 10;
    const pollDelayMs = 500;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const jobs = await this.camunda8Client.activateJobs(jobType);
      const matchingJob = jobs.find(
        (job) =>
          this.getJobProcessInstanceKey(job) === processInstanceKey &&
          this.getJobElementId(job) === elementId
      );
      const processInstanceJob = jobs.find(
        (job) => this.getJobProcessInstanceKey(job) === processInstanceKey
      );

      console.log(
        `[PlayRuntime] Service task job activation ${attempt}/${maxAttempts} for "${elementId}" (${jobType}):`,
        { jobs, matchingJob, processInstanceJob }
      );

      if (matchingJob) {
        return matchingJob;
      }

      if (processInstanceJob) {
        console.warn(
          `[PlayRuntime] Falling back to activated Camunda job from the current process instance for service task "${elementId}"`
        );
        return processInstanceJob;
      }

      await this.delay(pollDelayMs);
    }

    console.warn(
      `[PlayRuntime] Timed out waiting for Camunda job for service task "${elementId}" (${jobType})`
    );

    return undefined;
  }

  private getServiceTaskJobType(element: any): string | undefined {
    const values = element?.businessObject?.extensionElements?.values || [];
    const taskDefinition = values.find((value: any) => value.$type === 'zeebe:TaskDefinition');

    return taskDefinition?.type;
  }

  private getJobKey(job: ActivatedJob): string | undefined {
    const key = job.jobKey || job.key;
    return key === undefined || key === null ? undefined : String(key);
  }

  private getJobElementId(job: ActivatedJob): string | undefined {
    return job.elementId || job.flowNodeId || job.bpmnElementId;
  }

  private getJobProcessInstanceKey(job: ActivatedJob): string | undefined {
    return job.processInstanceKey === undefined || job.processInstanceKey === null
      ? undefined
      : String(job.processInstanceKey);
  }

  private isMessageEventElement(element: any): boolean {
    return this.getMessageEventDefinition(element) !== undefined;
  }

  private isRootSimulationScope(element: any): boolean {
    return element?.type === 'bpmn:Process' || element?.type === 'bpmn:Participant';
  }

  private getMessageEventDefinition(element: any): any | undefined {
    const eventDefinitions = element?.businessObject?.eventDefinitions || [];

    return eventDefinitions.find(
      (definition: any) => definition?.$type === 'bpmn:MessageEventDefinition'
    );
  }

  private logMessageEventTrace(
    event: any,
    element: any,
    allowCorrelation: boolean = true
  ): void {
    const messageDefinition = this.getMessageEventDefinition(element);
    const messageRef = messageDefinition?.messageRef;
    const attachedToRef = element?.businessObject?.attachedToRef;
    const traceAction = event?.action;

    console.log('[PlayRuntime] Message event trace detected:', {
      action: traceAction,
      elementId: element?.id,
      elementType: element?.type,
      messageEventDefinitionId: messageDefinition?.id,
      messageId: messageRef?.id,
      messageName: messageRef?.name,
      attachedToId: attachedToRef?.id,
      attachedToType: attachedToRef?.$type,
      allowCorrelation
    });

    console.log(
      `[PlayRuntime] Message correlation decision ` +
      `(action=${traceAction || '(none)'}, element=${element?.id || '(none)'}, ` +
      `messageName=${messageRef?.name || '(none)'}, playModeActive=${this.playModeActive}, ` +
      `tokenSimulationActive=${this.tokenSimulationActive}, alreadyCorrelated=${this.correlatedMessageEventElementIds.has(element?.id)}, ` +
      `allowCorrelation=${allowCorrelation})`
    );

    if (!allowCorrelation) {
      console.log(
        `[PlayRuntime] Message correlation skipped for "${element?.id || '(unknown)'}" ` +
        'because it was discovered as an attached boundary message event on a task trace'
      );
      return;
    }

    if (this.shouldCorrelateMessageEvent(traceAction)) {
      void this.correlateMessageEvent(element, messageRef);
      return;
    }

    console.log(
      `[PlayRuntime] Message correlation skipped for "${element?.id || '(unknown)'}" ` +
      `because trace action is "${traceAction || '(none)'}" and taskHandlingMode=${this.taskHandlingMode}`
    );
  }

  private shouldCorrelateMessageEvent(traceAction: string | undefined): boolean {
    if (this.taskHandlingMode === 'auto-complete') {
      return traceAction === 'enter';
    }

    return traceAction === 'signal';
  }

  private async correlateMessageEvent(element: any, messageRef: any): Promise<void> {
    const elementId = element?.id;
    const messageName = messageRef?.name;

    console.log(
      `[PlayRuntime] correlateMessageEvent requested ` +
      `(element=${elementId || '(none)'}, messageName=${messageName || '(none)'}, ` +
      `correlationKey=${this.defaultMessageCorrelationKey}, playModeActive=${this.playModeActive}, ` +
      `tokenSimulationActive=${this.tokenSimulationActive})`
    );

    if (!this.playModeActive || !this.tokenSimulationActive) {
      console.warn(
        `[PlayRuntime] Message correlation blocked for "${elementId || '(unknown)'}" ` +
        `because playModeActive=${this.playModeActive}, tokenSimulationActive=${this.tokenSimulationActive}`
      );
      return;
    }

    if (!elementId) {
      console.warn('[PlayRuntime] Cannot correlate message event without element id:', element);
      return;
    }

    if (!messageName) {
      console.warn(`[PlayRuntime] Cannot correlate message event "${elementId}" without message name`, {
        messageId: messageRef?.id
      });
      return;
    }

    if (this.correlatedMessageEventElementIds.has(elementId)) {
      console.log(`[PlayRuntime] Message event "${elementId}" already correlated for this runtime session`);
      return;
    }

    this.correlatedMessageEventElementIds.add(elementId);

    try {
      this.updateStatus(
        'starting',
        `Correlating message ${messageName} with key ${this.defaultMessageCorrelationKey}...`,
        this.currentProcessInstanceKey
      );

      console.log(
        `[PlayRuntime] Calling Camunda message correlation API ` +
        `(messageName=${messageName}, correlationKey=${this.defaultMessageCorrelationKey}, element=${elementId})`
      );

      const response = await this.camunda8Client.correlateMessage(
        messageName,
        this.defaultMessageCorrelationKey
      );

      console.log('[PlayRuntime] Message correlation API response:', response);
      this.emitTestScenarioRuntimeAction({
        type: 'publish-message',
        elementId,
        attachedToElementId: element?.businessObject?.attachedToRef?.id,
        eventDefinitionType: this.getMessageEventDefinition(element)?.$type,
        interrupting: element?.businessObject?.cancelActivity !== false,
        messageName,
        correlationKey: this.defaultMessageCorrelationKey,
        processInstanceId: response.processInstanceKey || this.currentProcessInstanceKey
      });

      this.updateStatus(
        'success',
        `Correlated message ${messageName} with key ${this.defaultMessageCorrelationKey}.`,
        response.processInstanceKey || this.currentProcessInstanceKey
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      console.error(`[PlayRuntime] Failed to correlate message event "${elementId}": ${errorMessage}`, error);
      this.updateStatus('error', errorMessage, this.currentProcessInstanceKey);
      this.correlatedMessageEventElementIds.delete(elementId);
    }
  }

  private logAttachedMessageEventTraces(event: any, element: any): void {
    const elementId = element?.id;

    if (!elementId) {
      return;
    }

    const attachedMessageEvents =
      this.modelerAdapter.getAttachedMessageEventElements(elementId);

    attachedMessageEvents.forEach((attachedMessageEvent) => {
      this.logMessageEventTrace(event, attachedMessageEvent, false);
    });
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

  private emitTestScenarioRuntimeAction(action: TestScenarioRuntimeAction): void {
    this.modelerAdapter.getEventBus().fire('testScenario.runtimeAction', { action });
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
      console.warn('[PlayRuntime] Failed to resolve BPMN start event id.', error);
      return undefined;
    }
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

