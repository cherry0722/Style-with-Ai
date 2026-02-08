/**
 * Token getter set by AuthContext so client can read token from state before each request.
 * Ensures JWT is attached reliably; do NOT log token or secrets.
 */
let getTokenFromAuth: (() => string | null) | null = null;

export function setTokenGetter(fn: (() => string | null) | null) {
  getTokenFromAuth = fn;
}

export function getTokenFromAuthSync(): string | null {
  return getTokenFromAuth?.() ?? null;
}
