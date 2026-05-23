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
    this.samples = this.sampleWorkflows.getSamples();
    this.workflowSubject = new BehaviorSubject<Workflow>(
      this.workflowStorage.load() ?? this.samples[0]
    );
    this.workflow$ = this.workflowSubject.asObservable();
  }

  setWorkflow(workflow: Workflow, dirty = false): void {
    this.workflowSubject.next({
      ...workflow,
      status: dirty ? WorkflowStatus.Dirty : workflow.status
    });
  }

  setXml(xml: string, dirty = true): void {
    this.workflowSubject.next({
      ...this.workflow,
      xml,
      updatedAt: new Date().toISOString(),
      status: dirty ? WorkflowStatus.Dirty : WorkflowStatus.Clean
    });
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
      xml,
      updatedAt: new Date().toISOString(),
      status: WorkflowStatus.Clean
    };

    this.workflowStorage.save(saved);
    this.workflowSubject.next(saved);

    return saved;
  }
}
