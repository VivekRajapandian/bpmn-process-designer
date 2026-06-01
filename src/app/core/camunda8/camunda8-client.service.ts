import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DeploymentResponse {
  deploymentKey: string;
  tenantId: string;
  deployments: unknown[];
  decisionRequirements: any[];
  form: any;
}

export interface DeployedProcessDefinition {
  processDefinitionId: string;
  processDefinitionVersion: number;
  processDefinitionKey: string;
  resourceName: string;
}

export interface ProcessInstanceResponse {
  processDefinitionKey: string;
  processDefinitionId?: string;
  bpmnProcessId?: string;
  processDefinitionVersion?: number;
  version?: number;
  processInstanceKey: string;
  tenantId: string;
  creationTimestamp: number;
}

export interface UserTask {
  userTaskKey?: string;
  key?: string;
  id?: string;
  name?: string;
  state?: string;
  processInstanceKey?: string;
}

interface SearchResponse<T> {
  items: T[];
  page?: {
    totalItems?: number;
  };
}

export interface Camunda8DeploymentError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
}

@Injectable({ providedIn: 'root' })
export class Camunda8ClientService {
  private readonly restAddress = environment.camunda8.restAddress;
  private readonly authConfig = environment.camunda8.auth;
  private accessToken?: string;
  private accessTokenExpiresAt = 0;
  private tokenRequest?: Promise<string>;

  constructor(private readonly http: HttpClient) {}

  async deployBpmnXml(
    bpmnXml: string,
    fileName: string = 'process.bpmn'
  ): Promise<DeploymentResponse> {
    try {
      console.log(`📤 [Camunda8] Deploying BPMN file: "${fileName}" to ${this.restAddress}/v2/deployments`);

      const formData = new FormData();
      const file = new File([bpmnXml], fileName, { type: 'application/xml' });
      formData.append('resources', file);

      const url = `${this.restAddress}/v2/deployments`;
      const headers = await this.getAuthHeaders();
      console.log(`[Camunda8] POST ${url} multipart field=resources fileName=${fileName}`);
      const response = await firstValueFrom(
        this.http.post<DeploymentResponse>(url, formData, { headers })
      );

      console.log(`✅ [Camunda8] Deployment successful - Key: ${response.deploymentKey}`);
      console.log(`   Processes deployed:`, this.getDeployedProcessDefinitions(response).map(p => `${p.processDefinitionId} v${p.processDefinitionVersion}`).join(', '));


      return response;
    } catch (error) {
      throw this.handleError(error, 'Failed to deploy BPMN XML');
    }
  }

  async startProcessInstance(
    processDefinitionId: string,
    processDefinitionVersion: number,
    variables?: Record<string, any>
  ): Promise<ProcessInstanceResponse> {
    try {
      const url = `${this.restAddress}/v2/process-instances`;
      if (!processDefinitionId || processDefinitionVersion === undefined || processDefinitionVersion === null) {
        throw new Error(
          `Cannot start process instance without processDefinitionId and processDefinitionVersion. ` +
          `Received processDefinitionId="${processDefinitionId}", processDefinitionVersion="${processDefinitionVersion}".`
        );
      }
      console.log(`🚀 [Camunda8] Starting process instance for: "${processDefinitionId}" v${processDefinitionVersion} at ${url}`);

      const body = {
        "processDefinitionId": processDefinitionId,
        "processDefinitionVersion": processDefinitionVersion,
        "variables": variables || {}
      };

      console.log(`[Camunda8] POST ${url} start instance body:`, body);

      const response = await firstValueFrom(
        this.http.post<ProcessInstanceResponse>(url, body, {
          headers: await this.getAuthHeaders()
        })
      );

      console.log(`✅ [Camunda8] Process instance started - Key: ${response.processInstanceKey}`);
      console.log(`   Process: ${response.processDefinitionId || response.bpmnProcessId} (v${response.processDefinitionVersion || response.version})`);

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
      const processDefinition = this.findDeployedProcessDefinition(deployment, bpmnProcessId);
      const instance = await this.startProcessInstance(
        processDefinition.processDefinitionId,
        processDefinition.processDefinitionVersion,
        variables
      );

      console.log(`🎯 [Camunda8] deployAndStart workflow complete`);

      return {
        deployment,
        instance
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to deploy and start process');
    }
  }

  findDeployedProcessDefinition(
    deployment: DeploymentResponse,
    processDefinitionId: string
  ): DeployedProcessDefinition {
    const processDefinitions = this.getDeployedProcessDefinitions(deployment);
    console.log('[Camunda8] Normalized deployed process definitions:', processDefinitions);

    const processDefinition = processDefinitions.find(
      (deployed) => deployed.processDefinitionId === processDefinitionId
    );

    if (!processDefinition) {
      throw new Error(
        `Deployment did not include process definition "${processDefinitionId}".`
      );
    }

    return processDefinition;
  }

  async searchUserTasks(processInstanceKey: string): Promise<UserTask[]> {
    try {
      const url = `${this.restAddress}/v2/user-tasks/search`;
      const body = {
        filter: {
          processInstanceKey
        },
        page: {
          limit: 50
        }
      };

      console.log(`[Camunda8] POST ${url} search user tasks body:`, body);

      const response = await firstValueFrom(
        this.http.post<SearchResponse<UserTask>>(url, body, {
          headers: await this.getAuthHeaders()
        })
      );

      console.log('[Camunda8] User task search response:', response);

      return response.items || [];
    } catch (error) {
      throw this.handleError(error, 'Failed to search user tasks');
    }
  }

  async completeUserTask(userTaskKey: string, variables?: Record<string, any>): Promise<void> {
    try {
      const url = `${this.restAddress}/v2/user-tasks/${encodeURIComponent(userTaskKey)}/completion`;
      const body = {
        variables: variables || {}
      };

      console.log(`[Camunda8] POST ${url} complete user task body:`, body);

      await firstValueFrom(
        this.http.post<void>(url, body, {
          headers: await this.getAuthHeaders()
        })
      );

      console.log(`✅ [Camunda8] User task completed - Key: ${userTaskKey}`);
    } catch (error) {
      throw this.handleError(error, `Failed to complete user task ${userTaskKey}`);
    }
  }

  getDeployedProcessDefinitions(deployment: DeploymentResponse): DeployedProcessDefinition[] {
    return deployment.deployments
      .map((deployed) => this.toDeployedProcessDefinition(deployed))
      .filter((deployed): deployed is DeployedProcessDefinition => !!deployed);
  }

  private toDeployedProcessDefinition(deployed: unknown): DeployedProcessDefinition | undefined {
    const item = deployed as any;
    const processDefinition =
      item?.processDefinition ||
      item?.metadata?.processDefinition ||
      item?.process ||
      item;

    const processDefinitionId = processDefinition?.processDefinitionId;
    const processDefinitionVersion = processDefinition?.processDefinitionVersion;

    if (!processDefinitionId || processDefinitionVersion === undefined || processDefinitionVersion === null) {
      return undefined;
    }

    return {
      processDefinitionId,
      processDefinitionVersion,
      processDefinitionKey: processDefinition.processDefinitionKey,
      resourceName: processDefinition.resourceName
    };
  }

  private async getAuthHeaders(): Promise<HttpHeaders> {
    if (environment.camunda8.authStrategy !== 'BEARER') {
      return new HttpHeaders();
    }

    const token = await this.getAccessToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    const refreshBufferMs = 30_000;

    if (this.accessToken && now < this.accessTokenExpiresAt - refreshBufferMs) {
      return this.accessToken;
    }

    if (!this.tokenRequest) {
      console.log('[Camunda8] Access token missing or expiring soon - requesting a new token');
      this.tokenRequest = this.requestAccessToken().finally(() => {
        this.tokenRequest = undefined;
      });
    }

    return this.tokenRequest;
  }

  private async requestAccessToken(): Promise<string> {
    if (!this.authConfig) {
      throw new Error('Camunda bearer authentication is enabled but no auth config was provided.');
    }

    const body = new URLSearchParams({
      client_id: this.authConfig.clientId,
      client_secret: this.authConfig.clientSecret,
      grant_type: 'client_credentials',
      audience: this.authConfig.audience
    });

    console.log(`[Camunda8] POST ${this.authConfig.tokenUrl} token request`, {
      client_id: this.authConfig.clientId,
      grant_type: 'client_credentials',
      audience: this.authConfig.audience
    });

    const response = await firstValueFrom(
      this.http.post<TokenResponse>(this.authConfig.tokenUrl, body.toString(), {
        headers: new HttpHeaders({
          'Content-Type': 'application/x-www-form-urlencoded'
        })
      })
    );

    if (!response.access_token) {
      throw new Error('Camunda token endpoint did not return an access token.');
    }

    this.accessToken = response.access_token;
    this.accessTokenExpiresAt = Date.now() + (response.expires_in || 300) * 1000;
    console.log(`[Camunda8] Access token received (expires_in=${response.expires_in || 300}s)`);

    return response.access_token;
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
