let ready = false;
const listeners = new Set<(value: boolean) => void>();

export function markOfflineReady(): void {
  ready = true;
  for (const listener of listeners) listener(true);
}

export function subscribeOfflineReady(listener: (value: boolean) => void): () => void {
  listeners.add(listener);
  listener(ready);
  return () => listeners.delete(listener);
}
