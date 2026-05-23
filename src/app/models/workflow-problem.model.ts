export type WorkflowProblemSeverity = 'error' | 'warning' | 'info';

export interface WorkflowProblem {
  id: string;
  message: string;
  severity: WorkflowProblemSeverity;
  elementId?: string;
}
