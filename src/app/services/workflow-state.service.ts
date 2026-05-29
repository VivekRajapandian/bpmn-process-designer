import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Workflow } from '../models/workflow.model';
import { WorkflowProblem } from '../models/workflow-problem.model';
import { WorkflowStatus } from '../models/workflow-status.enum';
import { SampleWorkflowsService } from './sample-workflows.service';
import { WorkflowStorageService } from './workflow-storage.service';

@Injectable({ providedIn: 'root' })
export class WorkflowStateService {
  readonly samples: Workflow[];

  private readonly builtInWorkflows: Workflow[];
  private readonly workflowSubject: BehaviorSubject<Workflow>;
  private readonly problemsSubject = new BehaviorSubject<WorkflowProblem[]>([]);

  readonly workflow$: Observable<Workflow>;
  readonly problems$ = this.problemsSubject.asObservable();

  get workflow(): Workflow {
    return this.workflowSubject.value;
  }

  get problems(): WorkflowProblem[] {
    return this.problemsSubject.value;
  }

  get deletableWorkflowIds(): string[] {
    const builtInIds = new Set(this.builtInWorkflows.map((workflow) => workflow.id));
    const savedIds = new Set(this.workflowStorage.loadWorkflowIds());

    return this.samples
      .filter((workflow) => savedIds.has(workflow.id) || !builtInIds.has(workflow.id))
      .map((workflow) => workflow.id);
  }

  constructor(
    private readonly sampleWorkflows: SampleWorkflowsService,
    private readonly workflowStorage: WorkflowStorageService
  ) {
    this.builtInWorkflows = this.sampleWorkflows.getSamples();
    this.samples = this.workflowStorage.hydrate(this.builtInWorkflows);
    const savedWorkflow = this.workflowStorage.load();
    this.workflowSubject = new BehaviorSubject<Workflow>(
      savedWorkflow ? { ...savedWorkflow, status: WorkflowStatus.Clean } : this.samples[0]
    );
    this.workflow$ = this.workflowSubject.asObservable();
  }

  setWorkflow(workflow: Workflow, dirty = false): void {
    const nextWorkflow = {
      ...workflow,
      status: dirty ? WorkflowStatus.Dirty : workflow.status
    };

    this.upsertWorkflow(nextWorkflow);
    this.workflowSubject.next(nextWorkflow);
  }

  setXml(xml: string, dirty = true): void {
    const nextWorkflow = {
      ...this.workflow,
      bpmnXml: xml,
      updatedAt: new Date().toISOString(),
      status: dirty ? WorkflowStatus.Dirty : WorkflowStatus.Clean
    };

    this.upsertWorkflow(nextWorkflow);
    this.workflowSubject.next(nextWorkflow);
  }

  renameWorkflow(name: string): Workflow {
    const renamed = {
      ...this.workflow,
      name,
      updatedAt: new Date().toISOString()
    };

    this.workflowStorage.save(renamed);
    this.upsertWorkflow(renamed);
    this.workflowSubject.next(renamed);

    return renamed;
  }

  setProblems(problems: WorkflowProblem[]): void {
    this.problemsSubject.next(problems);

    if (problems.some((problem) => problem.severity === 'error')) {
      this.workflowSubject.next({
        ...this.workflow,
        status: WorkflowStatus.Invalid
      });
    }
  }

  markSaved(xml: string): Workflow {
    const saved = {
      ...this.workflow,
      bpmnXml: xml,
      updatedAt: new Date().toISOString(),
      status: WorkflowStatus.Clean
    };

    this.workflowStorage.save(saved);
    this.upsertWorkflow(saved);
    this.workflowSubject.next(saved);

    return saved;
  }

  resolveWorkflow(workflow: Workflow): Workflow {
    const savedWorkflow = this.workflowStorage.loadWorkflow(workflow.id);

    return savedWorkflow
      ? { ...savedWorkflow, status: WorkflowStatus.Clean }
      : workflow;
  }

  deleteWorkflow(id: string): Workflow {
    this.workflowStorage.deleteWorkflow(id);

    const workflowIndex = this.samples.findIndex((workflow) => workflow.id === id);
    const builtInWorkflow = this.builtInWorkflows.find((workflow) => workflow.id === id);

    if (workflowIndex >= 0 && builtInWorkflow) {
      this.samples[workflowIndex] = builtInWorkflow;
    } else if (workflowIndex >= 0) {
      this.samples.splice(workflowIndex, 1);
    }

    const nextWorkflow =
      this.samples.find((workflow) => workflow.id !== id) ?? this.builtInWorkflows[0];
    const resolvedWorkflow = this.resolveWorkflow(nextWorkflow);
    const cleanWorkflow = { ...resolvedWorkflow, status: WorkflowStatus.Clean };

    if (this.workflow.id === id) {
      this.workflowSubject.next(cleanWorkflow);
      this.problemsSubject.next([]);
    }

    return cleanWorkflow;
  }

  private upsertWorkflow(saved: Workflow): void {
    const sampleIndex = this.samples.findIndex((sample) => sample.id === saved.id);

    if (sampleIndex >= 0) {
      this.samples[sampleIndex] = saved;
      return;
    }

    this.samples.unshift(saved);
  }
}
