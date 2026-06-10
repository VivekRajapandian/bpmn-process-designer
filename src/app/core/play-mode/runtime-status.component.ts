import { ChangeDetectorRef, Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
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
        <span class="runtime-status-spinner" *ngIf="isBusy(currentStatus.state)" aria-hidden="true"></span>
        <span class="runtime-status-title">Local Camunda 8 Runtime</span>
        <span class="runtime-status-indicator" [class]="'indicator-' + currentStatus.state"></span>
      </div>

      <div class="runtime-status-content">
        <div class="loading-pill" *ngIf="isBusy(currentStatus.state)">
          <span class="loading-spinner" aria-hidden="true"></span>
          Loading...
        </div>

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

  constructor(
    private readonly runtimeService: PlayRuntimeIntegrationService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.runtimeService
      .getStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        this.currentStatus = status;
        this.changeDetector.markForCheck();
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

  isBusy(state: RuntimeStatus['state']): boolean {
    return state === 'deploying' || state === 'starting';
  }
}
