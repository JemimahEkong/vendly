/**
 * Development-only application access.
 *
 * This lets the dashboard and local features be explored when no Breez wallet
 * is connected. It is NOT authentication and never creates a wallet, balance
 * or payment. The gate is compiled away in production builds because
 * `import.meta.env.DEV` is statically false there.
 */

const SESSION_KEY = 'vendly-dev-access';

export function isDevAccessEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_DEV_ACCESS !== 'false';
}

export function hasDevAccessSession(): boolean {
  if (!isDevAccessEnabled()) return false;
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function enterDevAccess(): void {
  if (!isDevAccessEnabled()) return;
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Session storage can be unavailable in private modes; access still works
    // for the current render because App keeps its own state.
  }
}

export function exitDevAccess(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}
