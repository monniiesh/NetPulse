type EventType = 'measurement' | 'score' | 'anomaly' | 'alert';

interface SSEEvent {
  type: EventType;
  data: unknown;
}

type Listener = (event: SSEEvent) => void;

class EventBus {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(probeId: string, listener: Listener): () => void {
    if (!this.listeners.has(probeId)) {
      this.listeners.set(probeId, new Set());
    }
    this.listeners.get(probeId)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(probeId)?.delete(listener);
      if (this.listeners.get(probeId)?.size === 0) {
        this.listeners.delete(probeId);
      }
    };
  }

  emit(probeId: string, event: SSEEvent): void {
    this.listeners.get(probeId)?.forEach((listener) => listener(event));
  }

  get clientCount(): number {
    let count = 0;
    this.listeners.forEach((set) => (count += set.size));
    return count;
  }
}

// Singleton - survives hot reloads in development
const globalForEvents = globalThis as unknown as { eventBus: EventBus };
export const eventBus = globalForEvents.eventBus ?? new EventBus();
globalForEvents.eventBus = eventBus;
