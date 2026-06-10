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
}

export interface TestScenarioMetadata {
  processInstanceId?: string;
  coveredFlowNodes: CoveredFlowNode[];
  coveredSequenceFlows: string[];
}

export interface CoveredFlowNode {
  flowNodeId: string;
  elementType: string;
}
