import { Injectable } from '@angular/core';
import { EngineType } from '../models/engine-type.enum';
import { WorkflowProblem } from '../models/workflow-problem.model';

@Injectable({ providedIn: 'root' })
export class WorkflowValidationService {
  validate(xml: string, engineType = EngineType.CAMUNDA_8): WorkflowProblem[] {
    const parser = new DOMParser();
    const document = parser.parseFromString(xml, 'application/xml');
    const parserError = document.querySelector('parsererror');

    if (parserError) {
      return [
        {
          id: 'invalid-xml',
          message: parserError.textContent?.trim() || 'The BPMN XML is invalid.',
          severity: 'error'
        }
      ];
    }

    const problems: WorkflowProblem[] = [];
    const process = this.firstByLocalName(document, 'process');

    if (!process?.getAttribute('name')?.trim()) {
      problems.push({
        id: 'missing-process-name',
        message: 'Process is missing a name.',
        severity: 'warning',
        elementId: process?.getAttribute('id') || undefined
      });
    }

    const taskNames = [
      'task',
      'userTask',
      'serviceTask',
      'scriptTask',
      'businessRuleTask',
      'sendTask',
      'receiveTask',
      'manualTask'
    ];
    const zeebeTaskDefinitionNames = [
      'task',
      'serviceTask',
      'scriptTask',
      'businessRuleTask',
      'sendTask',
      'receiveTask'
    ];

    for (const taskName of taskNames) {
      for (const task of this.byLocalName(document, taskName)) {
        const id = task.getAttribute('id') || `${taskName}-${problems.length}`;

        if (!task.getAttribute('name')?.trim()) {
          problems.push({
            id: `task-without-name-${id}`,
            message: `${this.humanize(task.localName)} "${id}" is missing a name.`,
            severity: 'warning',
            elementId: id
          });
        }

        if (
          engineType !== EngineType.CAMUNDA_8 ||
          !zeebeTaskDefinitionNames.includes(task.localName)
        ) {
          continue;
        }

        const taskDefinitions = this.childByLocalName(task, 'extensionElements')
          ?.getElementsByTagNameNS('*', 'taskDefinition').length ?? 0;

        if (taskDefinitions !== 1) {
          problems.push({
            id: `task-definition-${id}`,
            message: `${this.humanize(task.localName)} "${id}" must have exactly one zeebe:taskDefinition extension element for Camunda 8 deployment.`,
            severity: 'error',
            elementId: id
          });
        }
      }
    }

    const sequenceFlows = this.byLocalName(document, 'sequenceFlow');

    for (const gateway of this.byLocalName(document, 'exclusiveGateway')) {
      const gatewayId = gateway.getAttribute('id');
      const outgoingFlows = sequenceFlows.filter((flow) => flow.getAttribute('sourceRef') === gatewayId);
      const defaultFlowId = gateway.getAttribute('default');

      if (outgoingFlows.length > 1) {
        for (const flow of outgoingFlows) {
          const flowId = flow.getAttribute('id') || `flow-${problems.length}`;
          const isDefault = flowId === defaultFlowId;
          const hasCondition = this.childByLocalName(flow, 'conditionExpression') !== undefined;

          if (!isDefault && !hasCondition) {
            problems.push({
              id: `sequence-flow-condition-${flowId}`,
              message: `Sequence flow "${flowId}" from exclusive gateway "${gatewayId}" must have a condition or be marked as the default flow.`,
              severity: 'error',
              elementId: flowId
            });
          }
        }
      }
    }

    return problems;
  }

  private firstByLocalName(document: Document, localName: string): Element | undefined {
    return this.byLocalName(document, localName)[0];
  }

  private byLocalName(document: Document, localName: string): Element[] {
    return Array.from(document.getElementsByTagName('*')).filter((node) => node.localName === localName);
  }

  private childByLocalName(element: Element, localName: string): Element | undefined {
    return Array.from(element.children).find((child) => child.localName === localName);
  }

  private humanize(value: string): string {
    return value.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
  }
}
