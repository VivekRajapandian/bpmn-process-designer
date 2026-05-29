import { Injectable } from '@angular/core';
import { EngineType } from '../models/engine-type.enum';
import { Workflow } from '../models/workflow.model';
import { WorkflowStatus } from '../models/workflow-status.enum';

@Injectable({ providedIn: 'root' })
export class SampleWorkflowsService {
  getSamples(): Workflow[] {
    const now = new Date().toISOString();

    return [
      {
        id: 'customer-onboarding',
        name: 'Customer Onboarding Workflow',
        engineType: EngineType.CAMUNDA_8,
        bpmnXml: customerOnboardingXml,
        createdAt: now,
        updatedAt: now,
        description: 'Qualify, approve, and welcome a new customer.',
        status: WorkflowStatus.Clean
      },
      {
        id: 'invoice-approval',
        name: 'Invoice Approval Workflow',
        engineType: EngineType.CAMUNDA_8,
        bpmnXml: invoiceApprovalXml,
        createdAt: now,
        updatedAt: now,
        description: 'Review, approve, and pay vendor invoices.',
        status: WorkflowStatus.Clean
      },
      {
        id: 'support-ticket-escalation',
        name: 'Support Ticket Escalation Workflow',
        engineType: EngineType.CAMUNDA_8,
        bpmnXml: supportEscalationXml,
        createdAt: now,
        updatedAt: now,
        description: 'Triage, resolve, or escalate support tickets.',
        status: WorkflowStatus.Clean
      }
    ];
  }

  createBlankWorkflow(engineType: EngineType): Workflow {
    const now = new Date().toISOString();

    return {
      id: `workflow-${Date.now()}`,
      name: 'Untitled BPMN Diagram',
      engineType,
      bpmnXml: this.blankWorkflowXml(engineType),
      createdAt: now,
      updatedAt: now,
      description: 'A new local BPMN workflow.',
      status: WorkflowStatus.Dirty
    };
  }

  private blankWorkflowXml(engineType: EngineType): string {
    return engineType === EngineType.CAMUNDA_7
      ? blankCamunda7WorkflowXml
      : blankCamunda8WorkflowXml;
  }
}

const blankCamunda8WorkflowXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" id="Definitions_Blank" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_Blank" name="Untitled Process" isExecutable="true">
    <bpmn:startEvent id="StartEvent_Blank" name="Start">
      <bpmn:outgoing>Flow_Blank_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_Blank" name="New Task">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="new-task" />
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_Blank_1</bpmn:incoming>
      <bpmn:outgoing>Flow_Blank_2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="EndEvent_Blank" name="End">
      <bpmn:incoming>Flow_Blank_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_Blank_1" sourceRef="StartEvent_Blank" targetRef="Task_Blank" />
    <bpmn:sequenceFlow id="Flow_Blank_2" sourceRef="Task_Blank" targetRef="EndEvent_Blank" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_Blank">
    <bpmndi:BPMNPlane id="BPMNPlane_Blank" bpmnElement="Process_Blank">
      <bpmndi:BPMNShape id="StartEvent_Blank_di" bpmnElement="StartEvent_Blank">
        <dc:Bounds x="160" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Blank_di" bpmnElement="Task_Blank">
        <dc:Bounds x="260" y="138" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_Blank_di" bpmnElement="EndEvent_Blank">
        <dc:Bounds x="460" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_Blank_1_di" bpmnElement="Flow_Blank_1">
        <di:waypoint x="196" y="178" />
        <di:waypoint x="260" y="178" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Blank_2_di" bpmnElement="Flow_Blank_2">
        <di:waypoint x="380" y="178" />
        <di:waypoint x="460" y="178" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const blankCamunda7WorkflowXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="Definitions_Blank" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_Blank" name="Untitled Process" isExecutable="true">
    <bpmn:startEvent id="StartEvent_Blank" name="Start">
      <bpmn:outgoing>Flow_Blank_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="Task_Blank" name="New Task" camunda:class="">
      <bpmn:incoming>Flow_Blank_1</bpmn:incoming>
      <bpmn:outgoing>Flow_Blank_2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="EndEvent_Blank" name="End">
      <bpmn:incoming>Flow_Blank_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_Blank_1" sourceRef="StartEvent_Blank" targetRef="Task_Blank" />
    <bpmn:sequenceFlow id="Flow_Blank_2" sourceRef="Task_Blank" targetRef="EndEvent_Blank" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_Blank">
    <bpmndi:BPMNPlane id="BPMNPlane_Blank" bpmnElement="Process_Blank">
      <bpmndi:BPMNShape id="StartEvent_Blank_di" bpmnElement="StartEvent_Blank">
        <dc:Bounds x="160" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Blank_di" bpmnElement="Task_Blank">
        <dc:Bounds x="260" y="138" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_Blank_di" bpmnElement="EndEvent_Blank">
        <dc:Bounds x="460" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_Blank_1_di" bpmnElement="Flow_Blank_1">
        <di:waypoint x="196" y="178" />
        <di:waypoint x="260" y="178" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Blank_2_di" bpmnElement="Flow_Blank_2">
        <di:waypoint x="380" y="178" />
        <di:waypoint x="460" y="178" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const customerOnboardingXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" id="Definitions_Customer" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_CustomerOnboarding" name="Customer Onboarding" isExecutable="true">
    <bpmn:startEvent id="StartEvent_Customer" name="Lead Received"><bpmn:outgoing>Flow_Customer_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="Task_Customer_Qualify" name="Qualify Customer"><bpmn:extensionElements><zeebe:taskDefinition type="qualify-customer" /></bpmn:extensionElements><bpmn:incoming>Flow_Customer_1</bpmn:incoming><bpmn:outgoing>Flow_Customer_2</bpmn:outgoing></bpmn:task>
    <bpmn:exclusiveGateway id="Gateway_Customer_Approved" name="Approved?" default="Flow_Customer_4"><bpmn:incoming>Flow_Customer_2</bpmn:incoming><bpmn:outgoing>Flow_Customer_3</bpmn:outgoing><bpmn:outgoing>Flow_Customer_4</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:task id="Task_Customer_CreateAccount" name="Create Account"><bpmn:extensionElements><zeebe:taskDefinition type="create-account" /></bpmn:extensionElements><bpmn:incoming>Flow_Customer_3</bpmn:incoming><bpmn:outgoing>Flow_Customer_5</bpmn:outgoing></bpmn:task>
    <bpmn:task id="Task_Customer_Welcome" name="Send Welcome Pack"><bpmn:extensionElements><zeebe:taskDefinition type="send-welcome-pack" /></bpmn:extensionElements><bpmn:incoming>Flow_Customer_5</bpmn:incoming><bpmn:outgoing>Flow_Customer_6</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="EndEvent_Customer_Live" name="Customer Live"><bpmn:incoming>Flow_Customer_6</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="EndEvent_Customer_Rejected" name="Rejected"><bpmn:incoming>Flow_Customer_4</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_Customer_1" sourceRef="StartEvent_Customer" targetRef="Task_Customer_Qualify" />
    <bpmn:sequenceFlow id="Flow_Customer_2" sourceRef="Task_Customer_Qualify" targetRef="Gateway_Customer_Approved" />
    <bpmn:sequenceFlow id="Flow_Customer_3" name="Yes" sourceRef="Gateway_Customer_Approved" targetRef="Task_Customer_CreateAccount"><bpmn:conditionExpression>=approved</bpmn:conditionExpression></bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_Customer_4" name="No" sourceRef="Gateway_Customer_Approved" targetRef="EndEvent_Customer_Rejected" />
    <bpmn:sequenceFlow id="Flow_Customer_5" sourceRef="Task_Customer_CreateAccount" targetRef="Task_Customer_Welcome" />
    <bpmn:sequenceFlow id="Flow_Customer_6" sourceRef="Task_Customer_Welcome" targetRef="EndEvent_Customer_Live" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_Customer"><bpmndi:BPMNPlane id="BPMNPlane_Customer" bpmnElement="Process_CustomerOnboarding">
    <bpmndi:BPMNShape id="StartEvent_Customer_di" bpmnElement="StartEvent_Customer"><dc:Bounds x="130" y="220" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Task_Customer_Qualify_di" bpmnElement="Task_Customer_Qualify"><dc:Bounds x="230" y="198" width="130" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Gateway_Customer_Approved_di" bpmnElement="Gateway_Customer_Approved" isMarkerVisible="true"><dc:Bounds x="420" y="213" width="50" height="50" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Task_Customer_CreateAccount_di" bpmnElement="Task_Customer_CreateAccount"><dc:Bounds x="540" y="198" width="130" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Task_Customer_Welcome_di" bpmnElement="Task_Customer_Welcome"><dc:Bounds x="730" y="198" width="140" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="EndEvent_Customer_Live_di" bpmnElement="EndEvent_Customer_Live"><dc:Bounds x="950" y="220" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="EndEvent_Customer_Rejected_di" bpmnElement="EndEvent_Customer_Rejected"><dc:Bounds x="427" y="350" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="Flow_Customer_1_di" bpmnElement="Flow_Customer_1"><di:waypoint x="166" y="238" /><di:waypoint x="230" y="238" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Flow_Customer_2_di" bpmnElement="Flow_Customer_2"><di:waypoint x="360" y="238" /><di:waypoint x="420" y="238" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Flow_Customer_3_di" bpmnElement="Flow_Customer_3"><di:waypoint x="470" y="238" /><di:waypoint x="540" y="238" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Flow_Customer_4_di" bpmnElement="Flow_Customer_4"><di:waypoint x="445" y="263" /><di:waypoint x="445" y="350" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Flow_Customer_5_di" bpmnElement="Flow_Customer_5"><di:waypoint x="670" y="238" /><di:waypoint x="730" y="238" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Flow_Customer_6_di" bpmnElement="Flow_Customer_6"><di:waypoint x="870" y="238" /><di:waypoint x="950" y="238" /></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const invoiceApprovalXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" id="Definitions_Invoice" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_InvoiceApproval" name="Invoice Approval" isExecutable="true">
    <bpmn:startEvent id="StartEvent_Invoice" name="Invoice Received"><bpmn:outgoing>Flow_Invoice_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="Task_Invoice_Capture" name="Capture Invoice"><bpmn:extensionElements><zeebe:taskDefinition type="capture-invoice" /></bpmn:extensionElements><bpmn:incoming>Flow_Invoice_1</bpmn:incoming><bpmn:outgoing>Flow_Invoice_2</bpmn:outgoing></bpmn:task>
    <bpmn:task id="Task_Invoice_Review" name="Manager Review"><bpmn:extensionElements><zeebe:taskDefinition type="manager-review" /></bpmn:extensionElements><bpmn:incoming>Flow_Invoice_2</bpmn:incoming><bpmn:outgoing>Flow_Invoice_3</bpmn:outgoing></bpmn:task>
    <bpmn:exclusiveGateway id="Gateway_Invoice_Approved" name="Approved?" default="Flow_Invoice_5"><bpmn:incoming>Flow_Invoice_3</bpmn:incoming><bpmn:outgoing>Flow_Invoice_4</bpmn:outgoing><bpmn:outgoing>Flow_Invoice_5</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:task id="Task_Invoice_Pay" name="Schedule Payment"><bpmn:extensionElements><zeebe:taskDefinition type="schedule-payment" /></bpmn:extensionElements><bpmn:incoming>Flow_Invoice_4</bpmn:incoming><bpmn:outgoing>Flow_Invoice_6</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="EndEvent_Invoice_Paid" name="Paid"><bpmn:incoming>Flow_Invoice_6</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="EndEvent_Invoice_Returned" name="Returned"><bpmn:incoming>Flow_Invoice_5</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_Invoice_1" sourceRef="StartEvent_Invoice" targetRef="Task_Invoice_Capture" />
    <bpmn:sequenceFlow id="Flow_Invoice_2" sourceRef="Task_Invoice_Capture" targetRef="Task_Invoice_Review" />
    <bpmn:sequenceFlow id="Flow_Invoice_3" sourceRef="Task_Invoice_Review" targetRef="Gateway_Invoice_Approved" />
    <bpmn:sequenceFlow id="Flow_Invoice_4" name="Yes" sourceRef="Gateway_Invoice_Approved" targetRef="Task_Invoice_Pay"><bpmn:conditionExpression>=approved</bpmn:conditionExpression></bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_Invoice_5" name="No" sourceRef="Gateway_Invoice_Approved" targetRef="EndEvent_Invoice_Returned" />
    <bpmn:sequenceFlow id="Flow_Invoice_6" sourceRef="Task_Invoice_Pay" targetRef="EndEvent_Invoice_Paid" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_Invoice"><bpmndi:BPMNPlane id="BPMNPlane_Invoice" bpmnElement="Process_InvoiceApproval">
    <bpmndi:BPMNShape id="StartEvent_Invoice_di" bpmnElement="StartEvent_Invoice"><dc:Bounds x="120" y="180" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Task_Invoice_Capture_di" bpmnElement="Task_Invoice_Capture"><dc:Bounds x="220" y="158" width="120" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Task_Invoice_Review_di" bpmnElement="Task_Invoice_Review"><dc:Bounds x="400" y="158" width="130" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Gateway_Invoice_Approved_di" bpmnElement="Gateway_Invoice_Approved" isMarkerVisible="true"><dc:Bounds x="590" y="173" width="50" height="50" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Task_Invoice_Pay_di" bpmnElement="Task_Invoice_Pay"><dc:Bounds x="710" y="158" width="130" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="EndEvent_Invoice_Paid_di" bpmnElement="EndEvent_Invoice_Paid"><dc:Bounds x="920" y="180" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="EndEvent_Invoice_Returned_di" bpmnElement="EndEvent_Invoice_Returned"><dc:Bounds x="597" y="300" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="Flow_Invoice_1_di" bpmnElement="Flow_Invoice_1"><di:waypoint x="156" y="198" /><di:waypoint x="220" y="198" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Flow_Invoice_2_di" bpmnElement="Flow_Invoice_2"><di:waypoint x="340" y="198" /><di:waypoint x="400" y="198" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Flow_Invoice_3_di" bpmnElement="Flow_Invoice_3"><di:waypoint x="530" y="198" /><di:waypoint x="590" y="198" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Flow_Invoice_4_di" bpmnElement="Flow_Invoice_4"><di:waypoint x="640" y="198" /><di:waypoint x="710" y="198" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Flow_Invoice_5_di" bpmnElement="Flow_Invoice_5"><di:waypoint x="615" y="223" /><di:waypoint x="615" y="300" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Flow_Invoice_6_di" bpmnElement="Flow_Invoice_6"><di:waypoint x="840" y="198" /><di:waypoint x="920" y="198" /></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const supportEscalationXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" id="Definitions_Support" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_SupportEscalation" name="Support Ticket Escalation" isExecutable="true">
    <bpmn:startEvent id="StartEvent_Support" name="Ticket Created"><bpmn:outgoing>Flow_Support_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="Task_Support_Triage" name="Triage Ticket"><bpmn:extensionElements><zeebe:taskDefinition type="triage-ticket" /></bpmn:extensionElements><bpmn:incoming>Flow_Support_1</bpmn:incoming><bpmn:outgoing>Flow_Support_2</bpmn:outgoing></bpmn:task>
    <bpmn:exclusiveGateway id="Gateway_Support_Resolved" name="Resolved?" default="Flow_Support_4"><bpmn:incoming>Flow_Support_2</bpmn:incoming><bpmn:outgoing>Flow_Support_3</bpmn:outgoing><bpmn:outgoing>Flow_Support_4</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:task id="Task_Support_Escalate" name="Escalate to Specialist"><bpmn:extensionElements><zeebe:taskDefinition type="escalate-to-specialist" /></bpmn:extensionElements><bpmn:incoming>Flow_Support_4</bpmn:incoming><bpmn:outgoing>Flow_Support_5</bpmn:outgoing></bpmn:task>
    <bpmn:task id="Task_Support_Notify" name="Notify Customer"><bpmn:extensionElements><zeebe:taskDefinition type="notify-customer" /></bpmn:extensionElements><bpmn:incoming>Flow_Support_3</bpmn:incoming><bpmn:incoming>Flow_Support_5</bpmn:incoming><bpmn:outgoing>Flow_Support_6</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="EndEvent_Support_Closed" name="Ticket Closed"><bpmn:incoming>Flow_Support_6</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_Support_1" sourceRef="StartEvent_Support" targetRef="Task_Support_Triage" />
    <bpmn:sequenceFlow id="Flow_Support_2" sourceRef="Task_Support_Triage" targetRef="Gateway_Support_Resolved" />
    <bpmn:sequenceFlow id="Flow_Support_3" name="Yes" sourceRef="Gateway_Support_Resolved" targetRef="Task_Support_Notify"><bpmn:conditionExpression>=resolved</bpmn:conditionExpression></bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_Support_4" name="No" sourceRef="Gateway_Support_Resolved" targetRef="Task_Support_Escalate" />
    <bpmn:sequenceFlow id="Flow_Support_5" sourceRef="Task_Support_Escalate" targetRef="Task_Support_Notify" />
    <bpmn:sequenceFlow id="Flow_Support_6" sourceRef="Task_Support_Notify" targetRef="EndEvent_Support_Closed" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_Support"><bpmndi:BPMNPlane id="BPMNPlane_Support" bpmnElement="Process_SupportEscalation">
    <bpmndi:BPMNShape id="StartEvent_Support_di" bpmnElement="StartEvent_Support"><dc:Bounds x="120" y="220" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Task_Support_Triage_di" bpmnElement="Task_Support_Triage"><dc:Bounds x="220" y="198" width="120" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Gateway_Support_Resolved_di" bpmnElement="Gateway_Support_Resolved" isMarkerVisible="true"><dc:Bounds x="400" y="213" width="50" height="50" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Task_Support_Escalate_di" bpmnElement="Task_Support_Escalate"><dc:Bounds x="520" y="310" width="150" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Task_Support_Notify_di" bpmnElement="Task_Support_Notify"><dc:Bounds x="720" y="198" width="130" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="EndEvent_Support_Closed_di" bpmnElement="EndEvent_Support_Closed"><dc:Bounds x="930" y="220" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="Flow_Support_1_di" bpmnElement="Flow_Support_1"><di:waypoint x="156" y="238" /><di:waypoint x="220" y="238" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Flow_Support_2_di" bpmnElement="Flow_Support_2"><di:waypoint x="340" y="238" /><di:waypoint x="400" y="238" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Flow_Support_3_di" bpmnElement="Flow_Support_3"><di:waypoint x="450" y="238" /><di:waypoint x="720" y="238" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Flow_Support_4_di" bpmnElement="Flow_Support_4"><di:waypoint x="425" y="263" /><di:waypoint x="425" y="350" /><di:waypoint x="520" y="350" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Flow_Support_5_di" bpmnElement="Flow_Support_5"><di:waypoint x="670" y="350" /><di:waypoint x="785" y="350" /><di:waypoint x="785" y="278" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Flow_Support_6_di" bpmnElement="Flow_Support_6"><di:waypoint x="850" y="238" /><di:waypoint x="930" y="238" /></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
