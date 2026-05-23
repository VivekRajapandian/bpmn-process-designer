import { WorkflowStatus } from './workflow-status.enum';

export interface Workflow {
  id: string;
  name: string;
  description: string;
  xml: string;
  updatedAt: string;
  status: WorkflowStatus;
}
