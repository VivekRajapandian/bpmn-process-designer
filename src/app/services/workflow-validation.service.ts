import { Injectable } from '@angular/core';
import { WorkflowProblem } from '../models/workflow-problem.model';

@Injectable({ providedIn: 'root' })
export class WorkflowValidationService {
  validate(xml: string): WorkflowProblem[] {
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

    for (const taskName of taskNames) {
      for (const task of this.byLocalName(document, taskName)) {
        if (!task.getAttribute('name')?.trim()) {
          const id = task.getAttribute('id') || `${taskName}-${problems.length}`;
          problems.push({
            id: `task-without-name-${id}`,
            message: `${this.humanize(task.localName)} "${id}" is missing a name.`,
            severity: 'warning',
            elementId: id
          });
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

  private humanize(value: string): string {
    return value.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
  }
}
