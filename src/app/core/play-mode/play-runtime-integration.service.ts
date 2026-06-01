import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { BpmnModelerAdapterService } from '../../services/bpmn-modeler-adapter.service';
import {
  Camunda8ClientService,
  DeployedProcessDefinition
} from '../camunda8/camunda8-client.service';

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
 * Integrates the token simulator with Camunda 8 runtime.
 * When token simulation mode starts, automatically deploys the BPMN XML.
 * When the simulation play button is clicked, starts a process instance
 * in the local Camunda 8 runtime.
 */
@Injectable({ providedIn: 'root' })
export class PlayRuntimeIntegrationService {
  private readonly status$ = new BehaviorSubject<RuntimeStatus>({
    state: 'idle',
    message: 'Waiting for token simulation'
  });

  private deploymentTriggered = false;
  private instanceStarted = false;
  private playModeActive = false;
  private tokenSimulationActive = false;
  private deploymentPromise?: Promise<void>;
  private deployedProcessDefinition?: DeployedProcessDefinition;

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

      // Listen for simulation play event to start a process instance
      eventBus.on('tokenSimulation.playSimulation', () => {
        console.log('🎯 [PlayRuntime] Event received: tokenSimulation.playSimulation');
        if (!this.playModeActive) {
          console.log('ℹ️ [PlayRuntime] Ignoring simulation play because Play mode is not active');
          return;
        }

        this.handleSimulationPlay();
      });

      // Reset the deployment flag when simulation is reset
      eventBus.on('tokenSimulation.resetSimulation', () => {
        console.log('🔄 [PlayRuntime] Event received: tokenSimulation.resetSimulation - Resetting deployment flag');
        if (this.playModeActive) {
          this.resetRuntimeSession();
        }
      });

      // Reset when simulation is paused (allow re-triggering on next play)
      eventBus.on('tokenSimulation.pauseSimulation', () => {
        console.log('⏸️  [PlayRuntime] Event received: tokenSimulation.pauseSimulation');
        // Don't reset here - we want to prevent multiple deploys during a single session
      });

      // Reset on toggle off
      eventBus.on('tokenSimulation.toggleMode', (event: any) => {
        console.log(`🔀 [PlayRuntime] Event received: tokenSimulation.toggleMode (active: ${event.active})`);
        this.tokenSimulationActive = event.active;

        if (!this.playModeActive) {
          console.log('ℹ️ [PlayRuntime] Token simulation changed outside Play mode - no Camunda interaction');
          return;
        }

        if (event.active) {
          console.log('🟢 [PlayRuntime] Token simulation toggled ON - Deploying BPMN');
          this.handleSimulationModeStart();
        } else {
          console.log('🔴 [PlayRuntime] Token simulation toggled OFF - Resetting deployment flag');
          this.resetRuntimeSession();
        }
      });

      console.log('✅ [PlayRuntime] Initialization complete - Ready to intercept token simulation');

      this.updateStatus('waiting', 'Waiting for token simulation');
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
      this.handleSimulationModeStart();
    }
  }

  private resetRuntimeSession(): void {
    console.log('🔁 [PlayRuntime] Runtime session reset - Next simulation mode will trigger new deployment');
    this.deploymentTriggered = false;
    this.instanceStarted = false;
    this.deploymentPromise = undefined;
    this.deployedProcessDefinition = undefined;
    this.updateStatus('waiting', 'Waiting for token simulation');
  }

  /**
   * Handle when token simulation mode starts.
   */
  private handleSimulationModeStart(): void {
    if (this.deploymentTriggered) {
      console.log('ℹ️ [PlayRuntime] Deployment already triggered for this simulation session');
      return;
    }

    this.deploymentTriggered = true;
    this.deploymentPromise = this.deployCurrentDiagram();
    void this.deploymentPromise.catch(() => undefined);
  }

  private async deployCurrentDiagram(): Promise<void> {
    try {
      console.log('🎬 [PlayRuntime] Token Simulation MODE STARTED - Initiating Camunda 8 deployment workflow');

      this.updateStatus('deploying', 'Exporting BPMN and deploying...');

      // Get the latest BPMN XML from the modeler
      const bpmnXml = await this.modelerAdapter.saveXml();
      console.log('📄 [PlayRuntime] BPMN XML exported successfully');

      // Extract the process ID
      const processId = this.modelerAdapter.getExecutableProcessId();

      if (!processId) {
        throw new Error(
          'No executable process found in BPMN diagram. ' +
          'Please ensure the diagram contains at least one executable process.'
        );
      }

      console.log(`📋 [PlayRuntime] Process ID extracted: "${processId}"`);

      // Deploy only. The process instance starts when the simulation play button is clicked.
      console.log(`🚀 [PlayRuntime] Starting Camunda 8 deployment for process: "${processId}"`);
      this.updateStatus('deploying', `Deploying BPMN (Process ID: ${processId})...`);

      const deployment = await this.camunda8Client.deployBpmnXml(bpmnXml, 'process.bpmn');
      const deploymentKey = deployment.deploymentKey;
      const processDefinition =
        this.camunda8Client.findDeployedProcessDefinition(deployment, processId);

      console.log(`✅ [PlayRuntime] BPMN Deployment SUCCESS - Deployment Key: "${deploymentKey}"`);

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

  /**
   * Handle when token simulation starts playing.
   */
  private async handleSimulationPlay(): Promise<void> {
    if (this.instanceStarted) {
      console.log('ℹ️ [PlayRuntime] Process instance already started for this simulation session');
      return;
    }

    try {
      if (!this.deploymentTriggered) {
        console.log('ℹ️ [PlayRuntime] Play clicked before deployment; deploying BPMN first');
        this.handleSimulationModeStart();
      }

      await this.deploymentPromise;

      if (!this.deployedProcessDefinition) {
        throw new Error('No deployed process definition available to start a process instance.');
      }

      this.instanceStarted = true;
      this.updateStatus(
        'starting',
        `Starting process instance (Process ID: ${this.deployedProcessDefinition.processDefinitionId}, version: ${this.deployedProcessDefinition.processDefinitionVersion})...`
      );

      const instance = await this.camunda8Client.startProcessInstance(
        this.deployedProcessDefinition.processDefinitionId,
        this.deployedProcessDefinition.processDefinitionVersion
      );
      const processInstanceKey = instance.processInstanceKey;

      console.log(`✅ [PlayRuntime] Process Instance START SUCCESS - Instance Key: "${processInstanceKey}"`);

      this.updateStatus(
        'success',
        `Process instance started: ${processInstanceKey}`,
        processInstanceKey
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      console.error(`❌ [PlayRuntime] FAILED: ${errorMessage}`, error);

      this.updateStatus('error', errorMessage);

      // Reset instance flag on error to allow retry without redeploying when deployment succeeded.
      this.instanceStarted = false;
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
