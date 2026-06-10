import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  HostListener,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { BpmnCanvasComponent } from '../bpmn-canvas/bpmn-canvas.component';
import { EngineType } from '../models/engine-type.enum';
import { WorkflowProblem } from '../models/workflow-problem.model';
import { Workflow } from '../models/workflow.model';
import { WorkflowStatus } from '../models/workflow-status.enum';
import { ProblemsPanelComponent } from '../problems-panel/problems-panel.component';
import { PropertiesPanelComponent } from '../properties-panel/properties-panel.component';
import { BpmnModelerAdapterService } from '../services/bpmn-modeler-adapter.service';
import { SampleWorkflowsService } from '../services/sample-workflows.service';
import { WorkflowStateService } from '../services/workflow-state.service';
import { WorkflowValidationService } from '../services/workflow-validation.service';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { WorkflowExplorerComponent } from '../workflow-explorer/workflow-explorer.component';
import { XmlViewerComponent } from '../xml-viewer/xml-viewer.component';
import { RuntimeStatusComponent } from '../core/play-mode/runtime-status.component';
import {
  PlayRuntimeIntegrationService,
  RuntimeStatus,
  TaskHandlingMode
} from '../core/play-mode/play-runtime-integration.service';

type RightPanel = 'properties' | 'xml';
type WorkspaceMode = 'design' | 'play';
interface WorkflowDetails {
  name: string;
  engineType: EngineType;
}

@Component({
  selector: 'app-bpmn-workspace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BpmnCanvasComponent,
    ProblemsPanelComponent,
    PropertiesPanelComponent,
    ToolbarComponent,
    WorkflowExplorerComponent,
    XmlViewerComponent,
    RuntimeStatusComponent
  ],
  templateUrl: './bpmn-workspace.component.html',
  styleUrl: './bpmn-workspace.component.scss'
})
export class BpmnWorkspaceComponent implements AfterViewInit, OnDestroy {
  @ViewChild(BpmnCanvasComponent, { static: true })
  private readonly canvas!: BpmnCanvasComponent;

  @ViewChild(PropertiesPanelComponent, { static: true })
  private readonly propertiesPanel!: PropertiesPanelComponent;

  workflow!: Workflow;
  problems: WorkflowProblem[] = [];
  activePanel: RightPanel = 'properties';
  activeMode: WorkspaceMode = 'design';
  tokenSimulationActive = false;
  taskHandlingMode: TaskHandlingMode = 'manual';
  runtimeStatus: RuntimeStatus = {
    state: 'idle',
    message: 'Play mode is off'
  };
  saveMessage = '';
  engineChoice?: {
    title: string;
    enginePrompt?: string;
    name: string;
    selectedEngineType: EngineType;
    showEngine: boolean;
    submitLabel: string;
    resolve: (details: WorkflowDetails | null) => void;
  };

  samples: Workflow[] = [];
  readonly workflowStatus = WorkflowStatus;
  readonly engineType = EngineType;

  get deletableWorkflowIds(): string[] {
    return this.workflowState.deletableWorkflowIds;
  }

  private readonly subscription = new Subscription();
  private isImporting = false;

  constructor(
    private readonly bpmnAdapter: BpmnModelerAdapterService,
    private readonly sampleWorkflows: SampleWorkflowsService,
    private readonly workflowState: WorkflowStateService,
    private readonly workflowValidation: WorkflowValidationService,
    private readonly runtimeIntegration: PlayRuntimeIntegrationService
  ) {
    this.workflow = this.workflowState.workflow;
    this.samples = this.workflowState.samples;
  }

  async ngAfterViewInit(): Promise<void> {
    this.bpmnAdapter.initialize(
      this.canvas.element,
      this.propertiesPanel.element,
      this.workflow.engineType
    );

    // Initialize Camunda 8 runtime integration for token simulator
    this.runtimeIntegration.initialize();
    this.runtimeIntegration.setPlayModeActive(false);

    this.bpmnAdapter.getEventBus().on('tokenSimulation.toggleMode', (event: any) => {
      console.log(
        `[Workspace] tokenSimulation.toggleMode observed: active=${Boolean(event.active)} ` +
        `(activeMode=${this.activeMode})`
      );
      this.tokenSimulationActive = Boolean(event.active);
    });

    this.subscription.add(
      this.workflowState.workflow$.subscribe((workflow) => {
        this.workflow = workflow;
      })
    );

    this.subscription.add(
      this.workflowState.problems$.subscribe((problems) => {
        this.problems = problems;
      })
    );

    this.subscription.add(
      this.runtimeIntegration.getStatus().subscribe((status) => {
        this.runtimeStatus = status;
      })
    );

    this.subscription.add(
      this.bpmnAdapter.changed$.subscribe(() => {
        void this.captureCurrentXml(true);
      })
    );

    await this.loadWorkflow(this.workflow, false);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.bpmnAdapter.destroy();
  }

  @HostListener('window:beforeunload', ['$event'])
  warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.workflow.status === WorkflowStatus.Dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  async newDiagram(): Promise<void> {
    if (!this.canDiscardChanges()) {
      return;
    }

    const details = await this.editWorkflowDetails(
      'Create New BPMN Diagram',
      'Untitled BPMN Diagram',
      'Target Engine:',
      true,
      'Create'
    );

    if (!details) {
      return;
    }

    const workflow = {
      ...this.sampleWorkflows.createBlankWorkflow(details.engineType),
      name: details.name
    };

    await this.loadWorkflow(workflow, true);
  }

  async selectWorkflow(workflow: Workflow): Promise<void> {
    if (workflow.id === this.workflow.id || !this.canDiscardChanges()) {
      return;
    }

    await this.loadWorkflow(this.workflowState.resolveWorkflow(workflow), false);
  }

  async deleteWorkflow(workflow: Workflow): Promise<void> {
    if (
      !window.confirm(`Delete "${workflow.name}" from local workflows?`)
    ) {
      return;
    }

    const wasActive = workflow.id === this.workflow.id;

    if (wasActive && !this.canDiscardChanges()) {
      return;
    }

    const nextWorkflow = this.workflowState.deleteWorkflow(workflow.id);
    this.samples = this.workflowState.samples;

    if (wasActive) {
      await this.loadWorkflow(nextWorkflow, false);
    }

    this.saveMessage = `Deleted "${workflow.name}" from local storage`;
  }

  async importDiagram(file: File): Promise<void> {
    if (!this.canDiscardChanges()) {
      return;
    }

    const xml = await file.text();
    const details = await this.editWorkflowDetails(
      'Import BPMN Diagram',
      file.name.replace(/\.(bpmn|xml)$/i, '') || 'Imported BPMN',
      'Which engine should this workflow target?',
      true,
      'Import'
    );

    if (!details) {
      return;
    }

    const now = new Date().toISOString();
    const workflow: Workflow = {
      id: `import-${Date.now()}`,
      name: details.name,
      engineType: details.engineType,
      bpmnXml: xml,
      createdAt: now,
      updatedAt: now,
      description: 'Imported from a local BPMN/XML file.',
      status: WorkflowStatus.Dirty
    };

    await this.loadWorkflow(workflow, true);
  }

  async exportDiagram(): Promise<void> {
    const xml = await this.bpmnAdapter.saveXml();
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.slugify(this.workflow.name)}.bpmn`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async saveLocally(): Promise<void> {
    const xml = await this.bpmnAdapter.saveXml();
    const saved = this.workflowState.markSaved(xml);
    this.samples = this.workflowState.samples;
    this.workflowState.setProblems(this.workflowValidation.validate(xml, saved.engineType));
    this.saveMessage = `Saved locally at ${new Date(saved.updatedAt).toLocaleTimeString()}`;
  }

  validate(): void {
    this.workflowState.setProblems(
      this.workflowValidation.validate(this.workflow.bpmnXml, this.workflow.engineType)
    );
    this.saveMessage = '';
  }

  focusProblem(problem: WorkflowProblem): void {
    this.bpmnAdapter.focusElement(problem.elementId);
  }

  undo(): void {
    this.bpmnAdapter.undo();
  }

  redo(): void {
    this.bpmnAdapter.redo();
  }

  zoomIn(): void {
    this.bpmnAdapter.zoomIn();
  }

  zoomOut(): void {
    this.bpmnAdapter.zoomOut();
  }

  setPanel(panel: RightPanel): void {
    this.activePanel = panel;
  }

  renameWorkflow(): void {
    void this.renameCurrentWorkflow();
  }

  setWorkspaceMode(mode: WorkspaceMode): void {
    console.log(
      `[Workspace] Mode changed: ${this.activeMode} -> ${mode} ` +
      `(tokenSimulationActive=${this.tokenSimulationActive})`
    );

    this.activeMode = mode;
    this.runtimeIntegration.setPlayModeActive(mode === 'play');

    if (mode === 'design' && this.tokenSimulationActive) {
      this.bpmnAdapter.setTokenSimulationActive(false);
      this.tokenSimulationActive = false;
      return;
    }

    if (mode === 'play' && !this.tokenSimulationActive) {
      this.bpmnAdapter.setTokenSimulationActive(true);
      this.tokenSimulationActive = true;
    }
  }

  setTaskHandlingMode(mode: TaskHandlingMode): void {
    console.log(`[Workspace] Play task handling changed: ${this.taskHandlingMode} -> ${mode}`);
    this.taskHandlingMode = mode;
    this.runtimeIntegration.setTaskHandlingMode(mode);
  }

  setAutoComplete(enabled: boolean): void {
    this.setTaskHandlingMode(enabled ? 'auto-complete' : 'manual');
  }

  isCanvasBlocked(): boolean {
    return this.activeMode === 'play' && this.runtimeStatus.state === 'deploying';
  }

  getCanvasBlockMessage(): string {
    if (this.activeMode === 'play' && this.runtimeStatus.state === 'deploying') {
      return 'Deploying to Camunda...';
    }

    return '';
  }

  toggleTokenSimulation(): void {
    const nextActive = !this.tokenSimulationActive;
    console.log(
      `[Workspace] Token simulation toggle clicked: ${this.tokenSimulationActive} -> ${nextActive} ` +
      `(activeMode=${this.activeMode})`
    );
    this.bpmnAdapter.setTokenSimulationActive(nextActive);
    this.tokenSimulationActive = nextActive;
  }

  resolveEngineChoice(): void {
    if (!this.engineChoice) {
      return;
    }

    const name = this.engineChoice.name.trim();

    if (!name) {
      return;
    }

    this.engineChoice.resolve({
      name,
      engineType: this.engineChoice.selectedEngineType
    });
    this.engineChoice = undefined;
  }

  cancelEngineChoice(): void {
    this.engineChoice?.resolve(null);
    this.engineChoice = undefined;
  }

  engineLabel(engineType: EngineType): string {
    return engineType === EngineType.CAMUNDA_7 ? 'Camunda 7' : 'Camunda 8';
  }

  private async renameCurrentWorkflow(): Promise<void> {
    const details = await this.editWorkflowDetails(
      'Rename BPMN Diagram',
      this.workflow.name,
      undefined,
      false,
      'Rename'
    );

    if (!details || details.name === this.workflow.name) {
      return;
    }

    const renamed = this.workflowState.renameWorkflow(details.name);
    this.samples = this.workflowState.samples;
    this.saveMessage = `Renamed at ${new Date(renamed.updatedAt).toLocaleTimeString()}`;
  }

  private async loadWorkflow(workflow: Workflow, dirty: boolean): Promise<void> {
    try {
      this.isImporting = true;
      this.workflowState.setWorkflow(workflow, dirty);
      this.bpmnAdapter.initializeForEngine(workflow.engineType);
      await this.bpmnAdapter.importXml(workflow.bpmnXml);
      this.workflowState.setProblems(
        this.workflowValidation.validate(workflow.bpmnXml, workflow.engineType)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load BPMN XML.';
      this.workflowState.setProblems([
        {
          id: 'load-error',
          message,
          severity: 'error'
        }
      ]);
    } finally {
      this.isImporting = false;
    }
  }

  private async captureCurrentXml(dirty: boolean): Promise<void> {
    if (this.isImporting) {
      return;
    }

    const xml = await this.bpmnAdapter.saveXml();
    this.workflowState.setXml(xml, dirty);
    this.saveMessage = '';
  }

  private canDiscardChanges(): boolean {
    return (
      this.workflow.status !== WorkflowStatus.Dirty ||
      window.confirm('Discard unsaved BPMN changes?')
    );
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'workflow';
  }

  private editWorkflowDetails(
    title: string,
    name: string,
    enginePrompt: string | undefined,
    showEngine: boolean,
    submitLabel: string
  ): Promise<WorkflowDetails | null> {
    return new Promise((resolve) => {
      this.engineChoice = {
        title,
        enginePrompt,
        name,
        selectedEngineType: this.workflow?.engineType ?? EngineType.CAMUNDA_8,
        showEngine,
        submitLabel,
        resolve
      };
    });
  }
}
