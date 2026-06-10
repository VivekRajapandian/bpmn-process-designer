import { Injectable } from '@angular/core';
import { TestInstruction } from './test-scenario.model';

@Injectable({ providedIn: 'root' })
export class TestScenarioMapperService {
  toInstruction(
    element: any,
    traceAction: string | undefined,
    processDefinitionId: string
  ): TestInstruction | undefined {
    const elementId = element?.id;
    const elementType = element?.type || element?.businessObject?.$type;

    if (!elementId || !elementType) {
      return undefined;
    }

    if (elementType === 'bpmn:StartEvent' && traceAction === 'enter') {
      return {
        type: 'create-process-instance',
        elementId,
        processDefinitionId,
        variables: '{}'
      };
    }

    if (elementType === 'bpmn:UserTask' && traceAction === 'exit') {
      return {
        type: 'complete-user-task',
        elementId
      };
    }

    if (elementType === 'bpmn:ServiceTask' && traceAction === 'exit') {
      return {
        type: 'complete-job',
        elementId
      };
    }

    return undefined;
  }
}
