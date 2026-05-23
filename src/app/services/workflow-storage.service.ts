import { Injectable } from '@angular/core';
import { Workflow } from '../models/workflow.model';

const WORKFLOW_KEY = 'bpmn-process-designer.current-workflow';
const WORKFLOWS_KEY = 'bpmn-process-designer.saved-workflows';

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
    const workflows = this.loadSavedWorkflows();
    workflows[workflow.id] = workflow;

    localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
    localStorage.setItem(WORKFLOW_KEY, JSON.stringify(workflow));
  }

  hasSavedWorkflow(): boolean {
    return localStorage.getItem(WORKFLOW_KEY) !== null;
  }

  loadWorkflow(id: string): Workflow | null {
    return this.loadSavedWorkflows()[id] ?? null;
  }

  hydrate(workflows: Workflow[]): Workflow[] {
    const savedWorkflows = this.loadSavedWorkflows();

    return workflows.map((workflow) => ({
      ...workflow,
      ...savedWorkflows[workflow.id]
    }));
  }

  private loadSavedWorkflows(): Record<string, Workflow> {
    const raw = localStorage.getItem(WORKFLOWS_KEY);

    if (!raw) {
      const currentWorkflow = this.load();
      return currentWorkflow ? { [currentWorkflow.id]: currentWorkflow } : {};
    }

    try {
      return JSON.parse(raw) as Record<string, Workflow>;
    } catch {
      localStorage.removeItem(WORKFLOWS_KEY);
      return {};
    }
  }
}
