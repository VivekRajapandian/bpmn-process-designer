import { EngineType } from './engine-type.enum';
import { WorkflowStatus } from './workflow-status.enum';

export interface Workflow {
  id: string;
  name: string;
  engineType: EngineType;
  bpmnXml: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  status: WorkflowStatus;
}
