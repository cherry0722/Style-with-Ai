/**
 * Global 401 handler: clear auth and navigate to Auth screen.
 * Set by AuthProvider so API client can call without circular deps.
 * Do NOT log JWT or secrets.
 */
let handler: (() => void) | null = null;

export function setOn401(fn: (() => void) | null) {
  handler = fn;
}

export function getOn401(): (() => void) | null {
  return handler;
}

export function callOn401() {
  if (handler) handler();
}
