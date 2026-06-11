import { Injectable } from '@angular/core';
import { TestInstruction, TestScenarioRuntimeAction } from './test-scenario.model';

@Injectable({ providedIn: 'root' })
export class TestScenarioMapperService {
  fromRuntimeAction(action: TestScenarioRuntimeAction): TestInstruction | undefined {
    if (action.type === 'create-process-instance') {
      return {
        type: 'create-process-instance',
        elementId: action.elementId,
        processDefinitionId: action.processDefinitionId,
        variables: action.variables || '{}'
      };
    }

    if (action.type === 'complete-user-task') {
      return {
        type: 'complete-user-task',
        elementId: action.elementId
      };
    }

    if (action.type === 'complete-job') {
      return {
        type: 'complete-job',
        elementId: action.elementId,
        jobType: action.jobType
      };
    }

    if (action.type === 'publish-message') {
      return {
        type: 'publish-message',
        elementId: action.elementId,
        attachedToElementId: action.attachedToElementId,
        eventDefinitionType: action.eventDefinitionType,
        interrupting: action.interrupting,
        messageName: action.messageName,
        correlationKey: action.correlationKey
      };
    }

    return undefined;
  }
}
