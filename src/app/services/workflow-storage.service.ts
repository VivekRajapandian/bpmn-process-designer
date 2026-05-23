import { Injectable } from '@angular/core';
import { Workflow } from '../models/workflow.model';

const WORKFLOW_KEY = 'bpmn-process-designer.current-workflow';

@Injectable({ providedIn: 'root' })
export class WorkflowStorageService {
  load(): Workflow | null {
    const raw = localStorage.getItem(WORKFLOW_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as Workflow;
    } catch {
      localStorage.removeItem(WORKFLOW_KEY);
      return null;
    }
  }

  save(workflow: Workflow): void {
    localStorage.setItem(WORKFLOW_KEY, JSON.stringify(workflow));
  }
}
