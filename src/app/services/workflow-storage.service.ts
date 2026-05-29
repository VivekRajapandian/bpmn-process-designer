import { Injectable } from '@angular/core';
import { EngineType } from '../models/engine-type.enum';
import { Workflow } from '../models/workflow.model';
import { WorkflowStatus } from '../models/workflow-status.enum';

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
      return this.normalizeWorkflow(JSON.parse(raw));
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

  deleteWorkflow(id: string): void {
    const workflows = this.loadSavedWorkflows();
    delete workflows[id];

    localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));

    if (this.load()?.id === id) {
      localStorage.removeItem(WORKFLOW_KEY);
    }
  }

  hasSavedWorkflow(): boolean {
    return localStorage.getItem(WORKFLOW_KEY) !== null;
  }

  loadWorkflow(id: string): Workflow | null {
    return this.loadSavedWorkflows()[id] ?? null;
  }

  loadWorkflowIds(): string[] {
    return Object.keys(this.loadSavedWorkflows());
  }

  hydrate(workflows: Workflow[]): Workflow[] {
    const savedWorkflows = this.loadSavedWorkflows();
    const hydratedWorkflows = workflows.map((workflow) => ({
      ...workflow,
      ...savedWorkflows[workflow.id]
    }));
    const sampleIds = new Set(workflows.map((workflow) => workflow.id));
    const customWorkflows = Object.values(savedWorkflows)
      .filter((workflow) => !sampleIds.has(workflow.id))
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));

    return [...customWorkflows, ...hydratedWorkflows];
  }

  private loadSavedWorkflows(): Record<string, Workflow> {
    const raw = localStorage.getItem(WORKFLOWS_KEY);

    if (!raw) {
      const currentWorkflow = this.load();
      return currentWorkflow ? { [currentWorkflow.id]: currentWorkflow } : {};
    }

    try {
      return this.normalizeWorkflows(JSON.parse(raw));
    } catch {
      localStorage.removeItem(WORKFLOWS_KEY);
      return {};
    }
  }

  private normalizeWorkflows(value: unknown): Record<string, Workflow> {
    if (!value || typeof value !== 'object') {
      return {};
    }

    return Object.entries(value as Record<string, unknown>).reduce<Record<string, Workflow>>(
      (workflows, [id, workflow]) => {
        workflows[id] = this.normalizeWorkflow(workflow);
        return workflows;
      },
      {}
    );
  }

  private normalizeWorkflow(value: unknown): Workflow {
    const workflow = value as Partial<Workflow> & { xml?: string };
    const now = new Date().toISOString();
    const engineType =
      workflow.engineType === EngineType.CAMUNDA_7
        ? EngineType.CAMUNDA_7
        : EngineType.CAMUNDA_8;

    return {
      id: workflow.id ?? `workflow-${Date.now()}`,
      name: workflow.name ?? 'Untitled BPMN Diagram',
      engineType,
      bpmnXml: workflow.bpmnXml ?? workflow.xml ?? '',
      createdAt: workflow.createdAt ?? workflow.updatedAt ?? now,
      updatedAt: workflow.updatedAt ?? now,
      description: workflow.description ?? 'A local BPMN workflow.',
      status: workflow.status ?? WorkflowStatus.Clean
    };
  }
}
