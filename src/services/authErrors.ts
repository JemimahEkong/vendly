/**
 * User-facing classification of WebAuthn, Nostr and Breez errors.
 *
 * WebAuthn deliberately collapses "no credential", "user cancelled" and
 * "verification timed out" into `NotAllowedError`, so error handling must be
 * careful not to conclude that the user has no passkey simply because a prompt
 * was dismissed. The messages below explain what happened without exposing
 * credential IDs, PRF output or wallet material.
 */

import { PasskeyError } from './passkeyPrfProvider';
import { MissingBreezApiKeyError } from './breezConfig';

export type AuthErrorCode =
  | 'cancelled'
  | 'prf-unsupported'
  | 'invalid-rp'
  | 'unsupported-device'
  | 'credential-exists'
  | 'credential-create-failed'
  | 'relay-unavailable'
  | 'wallet-derivation-failed'
  | 'sdk-connect-failed'
  | 'unknown';

export type AuthErrorContext = 'detect' | 'create' | 'label' | 'derive' | 'sdk';

export interface AuthErrorInfo {
  code: AuthErrorCode;
  title: string;
  message: string;
  /** Whether repeating the same action could reasonably succeed. */
  canRetry: boolean;
  /** Whether the recovery-phrase route should be offered prominently. */
  useRecoveryPhrase: boolean;
}

interface ErrorDescription {
  name: string;
  message: string;
}

function describeError(error: unknown): ErrorDescription {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  if (typeof error === 'string') {
    return { name: '', message: error };
  }
  if (error && typeof error === 'object') {
    const candidate = error as { name?: unknown; message?: unknown };
    return {
      name: typeof candidate.name === 'string' ? candidate.name : '',
      message: typeof candidate.message === 'string' ? candidate.message : '',
    };
  }
  return { name: '', message: '' };
}

const CANCELLED: AuthErrorInfo = {
  code: 'cancelled',
  title: 'Passkey prompt cancelled',
  message:
    'The passkey prompt was dismissed or timed out before it finished. Nothing was changed — you can try again.',
  canRetry: true,
  useRecoveryPhrase: false,
};

const INVALID_RP: AuthErrorInfo = {
  code: 'invalid-rp',
  title: 'Passkeys are unavailable at this address',
  message:
    'This browser cannot use passkeys on the current address. Open Vendly over HTTPS, or use http://localhost during development. IP addresses such as 127.0.0.1 are not valid relying-party IDs.',
  canRetry: false,
  useRecoveryPhrase: true,
};

const PRF_UNSUPPORTED: AuthErrorInfo = {
  code: 'prf-unsupported',
  title: 'This passkey cannot secure a Vendly wallet',
  message:
    'Vendly needs a passkey with the WebAuthn PRF extension to derive your wallet key. This device, browser or authenticator does not provide PRF, so a passkey would be created but could not unlock your wallet. Use a recovery phrase instead.',
  canRetry: false,
  useRecoveryPhrase: true,
};

const UNSUPPORTED_DEVICE: AuthErrorInfo = {
  code: 'unsupported-device',
  title: 'Passkeys are not supported on this device',
  message:
    'This browser or device cannot create the type of passkey Vendly requires. Use a recovery phrase instead, or try a recent version of Chrome, Edge or Safari on a device with a screen lock.',
  canRetry: false,
  useRecoveryPhrase: true,
};

const RELAY_UNAVAILABLE: AuthErrorInfo = {
  code: 'relay-unavailable',
  title: 'Could not reach the label service',
  message:
    'The passkey authenticated, but Vendly could not reach the Nostr relays that store account labels. Check your connection and try again. Your wallet key was not affected.',
  canRetry: true,
  useRecoveryPhrase: false,
};

const WALLET_DERIVATION_FAILED: AuthErrorInfo = {
  code: 'wallet-derivation-failed',
  title: 'Could not unlock your wallet',
  message:
    'The passkey authenticated, but Vendly could not derive the wallet key. Try again, or restore the account with its recovery phrase if the problem continues.',
  canRetry: true,
  useRecoveryPhrase: true,
};

const MISSING_API_KEY: AuthErrorInfo = {
  code: 'sdk-connect-failed',
  title: 'Wallet service is not configured',
  message:
    'This Vendly build has no Breez API key. Add VITE_BREEZ_API_KEY to .env.local, then restart the dev server (or rebuild for production).',
  canRetry: false,
  useRecoveryPhrase: false,
};

const INVALID_API_KEY: AuthErrorInfo = {
  code: 'sdk-connect-failed',
  title: 'Breez rejected the API key',
  message:
    'Vendly found the configured API key, but Breez did not accept it. Check that the key is active and belongs to this environment, then restart the dev server or rebuild. This is different from a missing key.',
  canRetry: true,
  useRecoveryPhrase: false,
};

const SDK_CONNECT_FAILED: AuthErrorInfo = {
  code: 'sdk-connect-failed',
  title: 'Wallet service unavailable',
  message:
    'Your passkey worked, but Vendly could not connect to the Breez wallet service. Check your internet connection and try again.',
  canRetry: true,
  useRecoveryPhrase: false,
};

const CREDENTIAL_CREATE_FAILED: AuthErrorInfo = {
  code: 'credential-create-failed',
  title: 'Passkey could not be created',
  message:
    'The browser did not finish creating the passkey. Make sure this device has a screen lock enabled, then try again.',
  canRetry: true,
  useRecoveryPhrase: true,
};

const CREDENTIAL_EXISTS: AuthErrorInfo = {
  code: 'credential-exists',
  title: 'A passkey already exists',
  message:
    'This device already has a Vendly passkey. Sign in with the existing passkey instead of creating a new one.',
  canRetry: false,
  useRecoveryPhrase: false,
};

const UNKNOWN: AuthErrorInfo = {
  code: 'unknown',
  title: 'Authentication failed',
  message:
    'Vendly could not complete authentication. Please try again. If the problem continues, restore your account with its recovery phrase.',
  canRetry: true,
  useRecoveryPhrase: true,
};

function fromPasskeyError(error: PasskeyError): AuthErrorInfo | null {
  switch (error.code) {
    case 'prf-unsupported':
      return PRF_UNSUPPORTED;
    case 'invalid-rp':
      return INVALID_RP;
    case 'unsupported-device':
      return UNSUPPORTED_DEVICE;
    case 'cancelled':
      return CANCELLED;
    case 'credential-exists':
      return CREDENTIAL_EXISTS;
    default:
      return null;
  }
}

/**
 * Classify an error into a stable code plus a user-facing explanation.
 * Never includes raw error text in the returned UI copy.
 */
export function classifyAuthError(
  error: unknown,
  context: AuthErrorContext,
): AuthErrorInfo {
  if (error instanceof MissingBreezApiKeyError) {
    return MISSING_API_KEY;
  }

  if (error instanceof PasskeyError) {
    const mapped = fromPasskeyError(error);
    if (mapped) return mapped;
  }

  const { name, message } = describeError(error);
  const lower = message.toLowerCase();

  if (/prf.*(not support|unsupported|unavailable)|prf evaluation failed/.test(lower)) {
    return PRF_UNSUPPORTED;
  }

  // The Breez SDK wraps WebAuthn failures in a string, so the DOMException
  // name is lost. A generic PRF error at sign-in is either a dismissed prompt
  // or no discoverable credential; treat it as a cancelled attempt rather than
  // concluding that the account does not exist.
  if (/passkey prf error|prf error/.test(lower)) {
    return {
      ...CANCELLED,
      title: 'Passkey sign-in did not complete',
      message:
        'The passkey prompt was dismissed or timed out, or no passkey was found for this site. Nothing was changed — you can try again or create a new passkey.',
    };
  }

  if (name === 'SecurityError') {
    return INVALID_RP;
  }

  if (name === 'NotAllowedError' || name === 'AbortError') {
    return CANCELLED;
  }

  if (name === 'NotSupportedError') {
    return UNSUPPORTED_DEVICE;
  }

  if (name === 'InvalidStateError') {
    return context === 'create' ? CREDENTIAL_EXISTS : WALLET_DERIVATION_FAILED;
  }

  if (name === 'ConstraintError' || name === 'UnknownError') {
    return context === 'create' ? CREDENTIAL_CREATE_FAILED : UNKNOWN;
  }

  // A configured-but-rejected credential is not a missing key. Check this
  // before the generic network and API-key branches so the user gets the
  // correct remedy.
  if (
    /(invalid|expired|revoked|rejected|unauthori[sz]ed|forbidden|incorrect)[^.]{0,40}(api ?key|credential|token)|(api ?key|credential|token)[^.]{0,40}(invalid|expired|revoked|rejected|unauthori[sz]ed|forbidden|incorrect)|\b(401|403)\b/.test(
      lower,
    )
  ) {
    return INVALID_API_KEY;
  }

  if (
    /websocket|relay|nostr|network|failed to fetch|connection|timed out|timeout|econn|503/.test(
      lower,
    )
  ) {
    if (context === 'label' || context === 'detect') return RELAY_UNAVAILABLE;
    if (context === 'sdk') return SDK_CONNECT_FAILED;
  }

  if (/breez api key|api key not found|missing api key/.test(lower)) {
    return MISSING_API_KEY;
  }

  switch (context) {
    case 'create':
      return CREDENTIAL_CREATE_FAILED;
    case 'label':
      return RELAY_UNAVAILABLE;
    case 'derive':
      return WALLET_DERIVATION_FAILED;
    case 'sdk':
      return SDK_CONNECT_FAILED;
    default:
      return UNKNOWN;
  }
}

/** Short, non-sensitive error detail suitable for diagnostics. */
export function getErrorDiagnostic(error: unknown): {
  name: string;
  message: string;
} {
  return describeError(error);
}
