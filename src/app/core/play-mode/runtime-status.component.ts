import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PlayRuntimeIntegrationService, RuntimeStatus } from '../../core/play-mode/play-runtime-integration.service';

@Component({
  selector: 'app-runtime-status',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="runtime-status-panel" [class]="'state-' + currentStatus.state">
      <div class="runtime-status-header">
        <span class="runtime-status-title">Local Camunda 8 Runtime</span>
        <span class="runtime-status-indicator" [class]="'indicator-' + currentStatus.state"></span>
      </div>

      <div class="runtime-status-content">
        <div class="status-line">
          <span class="status-label">Status:</span>
          <span class="status-value">{{ getStatusLabel(currentStatus.state) }}</span>
        </div>

        <div class="status-message" *ngIf="currentStatus.message">
          {{ currentStatus.message }}
        </div>

        <div class="process-instance-key" *ngIf="currentStatus.processInstanceKey">
          <span class="key-label">Instance Key:</span>
          <span class="key-value">{{ currentStatus.processInstanceKey }}</span>
        </div>
      </div>
    </div>
  `,
  styleUrl: './runtime-status.component.scss'
})
export class RuntimeStatusComponent implements OnInit, OnDestroy {
  currentStatus: RuntimeStatus = {
    state: 'idle',
    message: 'Initializing...'
  };

  private readonly destroy$ = new Subject<void>();

  constructor(private readonly runtimeService: PlayRuntimeIntegrationService) {}

  ngOnInit(): void {
    this.runtimeService
      .getStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        this.currentStatus = status;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getStatusLabel(state: RuntimeStatus['state']): string {
    const labels: Record<RuntimeStatus['state'], string> = {
      idle: 'Idle',
      waiting: 'Waiting',
      deploying: 'Deploying...',
      starting: 'Starting...',
      success: 'Success',
      error: 'Error'
    };

    return labels[state] || 'Unknown';
  }
}
