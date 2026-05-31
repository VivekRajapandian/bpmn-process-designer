import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { BpmnModelerAdapterService } from '../../services/bpmn-modeler-adapter.service';
import { Camunda8ClientService } from '../camunda8/camunda8-client.service';

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
 * When token simulation starts, automatically deploys the BPMN XML
 * and starts a process instance in the local Camunda 8 runtime.
 */
@Injectable({ providedIn: 'root' })
export class PlayRuntimeIntegrationService {
  private readonly status$ = new BehaviorSubject<RuntimeStatus>({
    state: 'idle',
    message: 'Waiting for token simulation'
  });

  private deploymentTriggered = false;

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

      // Listen for simulation play event
      eventBus.on('tokenSimulation.playSimulation', () => {
        console.log('🎯 [PlayRuntime] Event received: tokenSimulation.playSimulation');
        this.handleSimulationPlay();
      });

      // Reset the deployment flag when simulation is reset
      eventBus.on('tokenSimulation.resetSimulation', () => {
        console.log('🔄 [PlayRuntime] Event received: tokenSimulation.resetSimulation - Resetting deployment flag');
        this.resetDeploymentFlag();
      });

      // Reset when simulation is paused (allow re-triggering on next play)
      eventBus.on('tokenSimulation.pauseSimulation', () => {
        console.log('⏸️  [PlayRuntime] Event received: tokenSimulation.pauseSimulation');
        // Don't reset here - we want to prevent multiple deploys during a single session
      });

      // Reset on toggle off
      eventBus.on('tokenSimulation.toggleMode', (event: any) => {
        console.log(`🔀 [PlayRuntime] Event received: tokenSimulation.toggleMode (active: ${event.active})`);
        if (!event.active) {
          console.log('🔴 [PlayRuntime] Token simulation toggled OFF - Resetting deployment flag');
          this.resetDeploymentFlag();
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

  /**
   * Reset the deployment flag to allow another deployment attempt.
   */
  private resetDeploymentFlag(): void {
    console.log('🔁 [PlayRuntime] Deployment flag reset - Next simulation will trigger new deployment');
    this.deploymentTriggered = false;
    this.updateStatus('waiting', 'Waiting for token simulation');
  }

  /**
   * Handle when token simulation starts playing.
   */
  private async handleSimulationPlay(): Promise<void> {
    if (this.deploymentTriggered) {
      console.log('ℹ️ [PlayRuntime] Deployment already triggered for this simulation session');
      return;
    }

    this.deploymentTriggered = true;

    try {
      console.log('🎬 [PlayRuntime] Token Simulation STARTED - Initiating Camunda 8 deployment workflow');

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

      // Deploy and start
      console.log(`🚀 [PlayRuntime] Starting Camunda 8 deployment for process: "${processId}"`);
      this.updateStatus('deploying', `Deploying BPMN (Process ID: ${processId})...`);

      const result = await this.camunda8Client.deployAndStart(
        bpmnXml,
        processId,
        'process.bpmn'
      );

      const deploymentKey = result.deployment.key;
      const processInstanceKey = result.instance.processInstanceKey;

      console.log(`✅ [PlayRuntime] BPMN Deployment SUCCESS - Deployment Key: "${deploymentKey}"`);
      console.log(`✅ [PlayRuntime] Process Instance START SUCCESS - Instance Key: "${processInstanceKey}"`);

      this.updateStatus(
        'success',
        `Process instance started: ${processInstanceKey}`,
        processInstanceKey
      );

      console.log('🎉 [PlayRuntime] Camunda 8 integration complete: deployment + instance started');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      console.error(`❌ [PlayRuntime] FAILED: ${errorMessage}`, error);

      this.updateStatus('error', errorMessage);

      // Reset flag on error to allow retry
      this.deploymentTriggered = false;
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
