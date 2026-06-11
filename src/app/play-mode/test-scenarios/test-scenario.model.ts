export interface TestScenario {
  processId: string;
  testCases: TestCase[];
}

export interface TestCase {
  name: string;
  instructions: TestInstruction[];
  metadata: TestScenarioMetadata;
}

export interface TestInstruction {
  type: string;
  elementId: string;
  processDefinitionId?: string;
  variables?: string;
  jobType?: string;
  attachedToElementId?: string;
  eventDefinitionType?: string;
  messageName?: string;
  correlationKey?: string;
  interrupting?: boolean;
}

export interface TestScenarioRuntimeAction extends TestInstruction {
  processInstanceId?: string;
  replay?: boolean;
}

export interface TestScenarioMetadata {
  coveredFlowNodes: CoveredFlowNode[];
  coveredSequenceFlows: string[];
}

export interface CoveredFlowNode {
  flowNodeId: string;
  elementType: string;
}
