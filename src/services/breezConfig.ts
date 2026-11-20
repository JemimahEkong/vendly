/**
 * Single source of truth for the Breez API key.
 *
 * Vite exposes `VITE_*` variables from the project's env directory at build
 * time. Values can pick up accidental surrounding whitespace when pasted, so
 * every consumer goes through the normalisation below rather than reading
 * `import.meta.env` directly.
 *
 * The key is never logged and never included in diagnostics.
 */

export const BREEZ_API_KEY_VAR = 'VITE_BREEZ_API_KEY';

/** Thrown before any SDK call when this build has no usable API key. */
export class MissingBreezApiKeyError extends Error {
  readonly code = 'missing-breez-api-key';

  constructor() {
    super(
      'Breez API key not found. Add VITE_BREEZ_API_KEY to .env.local, then restart the dev server (or rebuild for production).',
    );
    this.name = 'MissingBreezApiKeyError';
  }
}

/** Trim a raw environment value without rejecting valid key formats. */
export function normalizeBreezApiKey(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

/** The API key for this build, or an empty string when it is not configured. */
export function getBreezApiKey(raw: unknown = import.meta.env.VITE_BREEZ_API_KEY): string {
  return normalizeBreezApiKey(raw);
}

export function hasBreezApiKey(): boolean {
  return getBreezApiKey().length > 0;
}

/**
 * Return the configured key or fail with a specific, actionable error.
 * Callers can distinguish this from credentials rejected by Breez.
 */
export function requireBreezApiKey(raw: unknown = import.meta.env.VITE_BREEZ_API_KEY): string {
  const key = getBreezApiKey(raw);
  if (!key) throw new MissingBreezApiKeyError();
  return key;
}

/**
 * Safe configuration metadata for diagnostics and logs. Contains no key
 * material — only whether a value is available and how this build was made.
 */
export function getBreezConfigDiagnostic(): {
  present: boolean;
  length: number;
  mode: string;
  dev: boolean;
} {
  const key = getBreezApiKey();
  return {
    present: key.length > 0,
    length: key.length,
    mode: import.meta.env.MODE,
    dev: import.meta.env.DEV,
  };
}
