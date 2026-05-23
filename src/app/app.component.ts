import { Component } from '@angular/core';
import { BpmnWorkspaceComponent } from './bpmn-workspace/bpmn-workspace.component';

@Component({
  selector: 'app-root',
  imports: [BpmnWorkspaceComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'BPMN Process Designer';
}
