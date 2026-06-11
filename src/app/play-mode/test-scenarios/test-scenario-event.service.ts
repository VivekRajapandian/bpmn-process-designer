import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { TestScenarioRuntimeAction } from './test-scenario.model';

@Injectable({ providedIn: 'root' })
export class TestScenarioEventService {
  private readonly runtimeAction$ = new Subject<TestScenarioRuntimeAction>();

  emitRuntimeAction(action: TestScenarioRuntimeAction): void {
    this.runtimeAction$.next(action);
  }

  getRuntimeActions(): Observable<TestScenarioRuntimeAction> {
    return this.runtimeAction$.asObservable();
  }
}
