import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DeploymentResponse {
  key: string;
  tenantId: string;
  processes: Array<{
    bpmnProcessId: string;
    version: number;
    processDefinitionKey: string;
    resourceName: string;
  }>;
  decisionRequirements: any[];
  form: any;
}

export interface ProcessInstanceResponse {
  processDefinitionKey: string;
  bpmnProcessId: string;
  version: number;
  processInstanceKey: string;
  tenantId: string;
  creationTimestamp: number;
}

export interface Camunda8DeploymentError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
}

@Injectable({ providedIn: 'root' })
export class Camunda8ClientService {
  private readonly restAddress = environment.camunda8.restAddress;

  constructor(private readonly http: HttpClient) {}

  async deployBpmnXml(
    bpmnXml: string,
    fileName: string = 'process.bpmn'
  ): Promise<DeploymentResponse> {
    try {
      console.log(`📤 [Camunda8] Deploying BPMN file: "${fileName}" to ${this.restAddress}/v1/deployments`);

      const formData = new FormData();
      const file = new File([bpmnXml], fileName, { type: 'application/xml' });
      formData.append('file', file);

      const url = `${this.restAddress}/v1/deployments`;
      const response = await firstValueFrom(
        this.http.post<DeploymentResponse>(url, formData)
      );

      console.log(`✅ [Camunda8] Deployment successful - Key: ${response.key}`);
      console.log(`   Processes deployed:`, response.processes.map(p => p.bpmnProcessId).join(', '));

      return response;
    } catch (error) {
      throw this.handleError(error, 'Failed to deploy BPMN XML');
    }
  }

  async startProcessInstance(
    bpmnProcessId: string,
    variables?: Record<string, any>
  ): Promise<ProcessInstanceResponse> {
    try {
      const url = `${this.restAddress}/v1/processes/${encodeURIComponent(
        bpmnProcessId
      )}/instances`;

      console.log(`🚀 [Camunda8] Starting process instance for: "${bpmnProcessId}" at ${url}`);

      const body = {
        variables: variables || {}
      };

      const response = await firstValueFrom(
        this.http.post<ProcessInstanceResponse>(url, body)
      );

      console.log(`✅ [Camunda8] Process instance started - Key: ${response.processInstanceKey}`);
      console.log(`   Process: ${response.bpmnProcessId} (v${response.version})`);

      return response;
    } catch (error) {
      throw this.handleError(error, 'Failed to start process instance');
    }
  }

  async deployAndStart(
    bpmnXml: string,
    bpmnProcessId: string,
    fileName?: string,
    variables?: Record<string, any>
  ): Promise<{ deployment: DeploymentResponse; instance: ProcessInstanceResponse }> {
    try {
      console.log(`⚙️  [Camunda8] Starting deployAndStart workflow for process: "${bpmnProcessId}"`);

      const deployment = await this.deployBpmnXml(bpmnXml, fileName);
      const instance = await this.startProcessInstance(bpmnProcessId, variables);

      console.log(`🎯 [Camunda8] deployAndStart workflow complete`);

      return {
        deployment,
        instance
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to deploy and start process');
    }
  }

  private handleError(error: any, message: string): Error {
    let details = message;

    if (error instanceof Error) {
      details += `: ${error.message}`;
    } else if (error?.error) {
      const camundaError = error.error as Camunda8DeploymentError;
      details += `: ${camundaError.detail || camundaError.title || 'Unknown error'}`;
    } else if (typeof error === 'string') {
      details += `: ${error}`;
    }

    console.error(`❌ [Camunda8] ${details}`, error);
    return new Error(details);
  }
}
