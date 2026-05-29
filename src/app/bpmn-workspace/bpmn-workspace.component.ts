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

type RightPanel = 'properties' | 'xml';

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
    XmlViewerComponent
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
  saveMessage = '';
  engineChoice?: {
    title: string;
    prompt: string;
    selected: EngineType;
    resolve: (engineType: EngineType | null) => void;
  };

  samples: Workflow[] = [];
  readonly workflowStatus = WorkflowStatus;
  readonly engineType = EngineType;

  private readonly subscription = new Subscription();
  private isImporting = false;

  constructor(
    private readonly bpmnAdapter: BpmnModelerAdapterService,
    private readonly sampleWorkflows: SampleWorkflowsService,
    private readonly workflowState: WorkflowStateService,
    private readonly workflowValidation: WorkflowValidationService
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

    const engineType = await this.selectEngineType(
      'Create New BPMN Diagram',
      'Target Engine:'
    );

    if (!engineType) {
      return;
    }

    await this.loadWorkflow(this.sampleWorkflows.createBlankWorkflow(engineType), true);
  }

  async selectWorkflow(workflow: Workflow): Promise<void> {
    if (workflow.id === this.workflow.id || !this.canDiscardChanges()) {
      return;
    }

    await this.loadWorkflow(this.workflowState.resolveWorkflow(workflow), false);
  }

  async importDiagram(file: File): Promise<void> {
    if (!this.canDiscardChanges()) {
      return;
    }

    const xml = await file.text();
    const engineType = await this.selectEngineType(
      'Import BPMN Diagram',
      'Which engine should this workflow target?'
    );

    if (!engineType) {
      return;
    }

    const now = new Date().toISOString();
    const workflow: Workflow = {
      id: `import-${Date.now()}`,
      name: file.name.replace(/\.(bpmn|xml)$/i, '') || 'Imported BPMN',
      engineType,
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

  resolveEngineChoice(engineType: EngineType): void {
    this.engineChoice?.resolve(engineType);
    this.engineChoice = undefined;
  }

  cancelEngineChoice(): void {
    this.engineChoice?.resolve(null);
    this.engineChoice = undefined;
  }

  engineLabel(engineType: EngineType): string {
    return engineType === EngineType.CAMUNDA_7 ? 'Camunda 7' : 'Camunda 8';
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

  private selectEngineType(title: string, prompt: string): Promise<EngineType | null> {
    return new Promise((resolve) => {
      this.engineChoice = {
        title,
        prompt,
        selected: EngineType.CAMUNDA_8,
        resolve
      };
    });
  }
}
