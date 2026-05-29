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

  constructor(
    private readonly sampleWorkflows: SampleWorkflowsService,
    private readonly workflowStorage: WorkflowStorageService
  ) {
    this.samples = this.workflowStorage.hydrate(this.sampleWorkflows.getSamples());
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

  private upsertWorkflow(saved: Workflow): void {
    const sampleIndex = this.samples.findIndex((sample) => sample.id === saved.id);

    if (sampleIndex >= 0) {
      this.samples[sampleIndex] = saved;
      return;
    }

    this.samples.unshift(saved);
  }
}
