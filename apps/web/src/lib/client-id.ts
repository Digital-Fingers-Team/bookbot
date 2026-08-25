let fallbackCounter = 0;

/**
 * React message ids are local-only identifiers, so they must also work when
 * the app is temporarily served over plain HTTP (where randomUUID can be
 * unavailable outside localhost).
 */
export function createClientId(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }

  fallbackCounter += 1;
  return `client-${Date.now().toString(36)}-${fallbackCounter.toString(36)}-${Math.random().toString(36).slice(2)}`;
}
