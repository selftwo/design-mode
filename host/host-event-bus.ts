import { HostEventSchema, type HostEvent } from '../src/features/local-host/host-api.schema.ts'

// Fan-out for server-sent events: every connected canvas sees agent runs and
// board refreshes as they happen.
export function createHostEventBus() {
  const subscribers = new Set<(event: HostEvent) => void>()
  return {
    subscribe(listener: (event: HostEvent) => void): () => void {
      subscribers.add(listener)
      return () => subscribers.delete(listener)
    },
    publish(event: HostEvent) {
      const validated = HostEventSchema.parse(event)
      for (const listener of subscribers) listener(validated)
    },
  }
}

export type HostEventBus = ReturnType<typeof createHostEventBus>
