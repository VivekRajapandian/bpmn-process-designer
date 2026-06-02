## Observable Compared To Java Spring Boot

This file uses RxJS observables to publish runtime status changes:

```ts
private readonly status$ = new BehaviorSubject<RuntimeStatus>({
  state: 'idle',
  message: 'Play mode is off'
});
```

In Spring Boot terms, this is similar to a service keeping the latest runtime state in memory and notifying interested listeners whenever that state changes.

The closest mental model is:

```java
@Service
public class PlayRuntimeIntegrationService {
  private RuntimeStatus currentStatus =
      new RuntimeStatus("idle", "Play mode is off");

  private final List<RuntimeStatusListener> listeners = new ArrayList<>();

  public RuntimeStatus getCurrentStatus() {
    return currentStatus;
  }

  public void subscribe(RuntimeStatusListener listener) {
    listeners.add(listener);
    listener.onStatusChanged(currentStatus);
  }

  private void updateStatus(RuntimeStatus nextStatus) {
    this.currentStatus = nextStatus;
    listeners.forEach(listener -> listener.onStatusChanged(nextStatus));
  }
}
```

`BehaviorSubject` is useful here because it does two jobs:

- stores the latest value, like an in-memory `currentStatus` field
- pushes every new value to subscribers, like calling all registered listeners

That differs from a normal Spring MVC REST controller. A REST controller usually responds only when a client asks:

```java
@GetMapping("/runtime-status")
public RuntimeStatus getStatus() {
  return playRuntimeIntegrationService.getCurrentStatus();
}
```

That is pull-based. The browser asks, the server returns the current value, and nothing else happens until the browser asks again.

The observable in this Angular service is push-based. `RuntimeStatusComponent` subscribes once:

```ts
this.runtimeService.getStatus().subscribe((status) => {
  this.currentStatus = status;
});
```

After that, every call to `updateStatus(...)` automatically notifies the component.

The Spring Boot equivalent would be closer to server-sent events, WebSocket messaging, or application events than to a plain REST GET:

```java
publisher.publishEvent(new RuntimeStatusChangedEvent(nextStatus));
```

or:

```java
sseEmitter.send(nextStatus);
```

In this Angular app, everything is happening inside the browser instead of across the network. `PlayRuntimeIntegrationService` is the producer of status changes, and `RuntimeStatusComponent` is the consumer.

`getStatus()` returns:

```ts
this.status$.asObservable()
```

That is like exposing a read-only subscription interface. Other components can listen for status updates, but they cannot directly call `next(...)` on the underlying `BehaviorSubject`. Only this service updates the stream through its private `updateStatus(...)` method.

`getCurrentStatus()` is the pull-style escape hatch:

```ts
return this.status$.value;
```

That is similar to a Spring service getter returning the current in-memory state. Most UI code should prefer subscribing to `getStatus()` so it stays updated automatically.
