/**
 * WebAuthn PRF provider for passkey-based wallet operations.
 *
 * Architecture:
 * - WebAuthnConfig: injectable RP configuration (DIP)
 * - Pure WebAuthn functions: detectPrfCapability, createPrfCredential, evaluatePrf
 * - BrowserPasskeyPrfProvider: SDK interface + createPasskey extension
 *
 * Each public credential operation triggers exactly ONE WebAuthn prompt, and
 * callers must invoke it from a user gesture (see PasskeyPage). PRF output is
 * never logged or persisted.
 */

import { PasskeyPrfProvider } from '@breeztech/breez-sdk-spark';
import { logger, LogCategory } from './logger';
import {
  PASSKEY_RP_NAME,
  isIpHostname,
  resolvePasskeyRpConfig,
  type PasskeyRpConfig,
} from './webauthnConfig';

// ============================================
// Types
// ============================================

export type PrfUnavailableReason =
  | 'no-webauthn'
  | 'insecure-context'
  | 'invalid-origin'
  | 'invalid-rp'
  | 'no-platform-authenticator'
  | 'no-prf'
  | 'unsupported-browser';

export interface PrfCapability {
  supported: boolean;
  /**
   * True when the browser explicitly reported PRF support. False means the
   * browser has no capability API and support can only be confirmed when the
   * credential is created.
   */
  verified: boolean;
  reason?: PrfUnavailableReason;
  message?: string;
}

export type PasskeyErrorCode =
  | 'prf-unsupported'
  | 'invalid-rp'
  | 'unsupported-device'
  | 'credential-exists'
  | 'cancelled'
  | 'unknown';

/** Error with a machine-readable code; messages never contain wallet secrets. */
export class PasskeyError extends Error {
  constructor(
    public readonly code: PasskeyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PasskeyError';
  }
}

type ClientCapabilities = Record<string, boolean>;

/** Browser capability APIs can hang without a usable authenticator. */
const CAPABILITY_TIMEOUT_MS = 1500;

async function withCapabilityTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), CAPABILITY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface PublicKeyCredentialWithCapabilities {
  getClientCapabilities?: () => Promise<ClientCapabilities>;
}

// ============================================
// Capability detection (no WebAuthn prompt)
// ============================================

function getRpConfig(): PasskeyRpConfig {
  return resolvePasskeyRpConfig();
}

/**
 * Best-effort PRF capability detection.
 *
 * `isUserVerifyingPlatformAuthenticatorAvailable()` only proves that *some*
 * platform authenticator exists; it says nothing about PRF. Where the browser
 * exposes `PublicKeyCredential.getClientCapabilities()` we require the
 * `extension:prf` capability (and a passkey-capable platform authenticator).
 * Older browsers fall back to the platform-authenticator check and PRF is
 * verified definitively when the credential is created.
 */
export async function detectPrfCapability(
  config: PasskeyRpConfig = getRpConfig(),
): Promise<PrfCapability> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
    return {
      supported: false,
      verified: true,
      reason: 'no-webauthn',
      message: 'This browser does not support WebAuthn passkeys.',
    };
  }

  if (config.status === 'invalid-rp-id') {
    return {
      supported: false,
      verified: true,
      reason: 'invalid-rp',
      message: config.issue,
    };
  }

  if (config.status === 'invalid-origin') {
    const insecure =
      !config.origin.startsWith('https:') &&
      config.hostname !== 'localhost' &&
      !isIpHostname(config.hostname);
    return {
      supported: false,
      verified: true,
      reason: insecure ? 'insecure-context' : 'invalid-origin',
      message: config.issue,
    };
  }

  // A cancelled or hung detection must never hide the passkey option silently.
  // If the browser does not answer, assume a platform authenticator may exist
  // and let credential creation verify PRF definitively.
  let platformAvailable = true;
  try {
    platformAvailable = await withCapabilityTimeout(
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
      true,
    );
  } catch (e) {
    logger.warn(LogCategory.AUTH, 'Platform authenticator detection failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  if (!platformAvailable) {
    return {
      supported: false,
      verified: true,
      reason: 'no-platform-authenticator',
      message:
        'No screen-lock-protected platform authenticator is available. Set up Windows Hello, Touch ID or a device screen lock, or use a recovery phrase.',
    };
  }

  const capabilityApi = (
    window.PublicKeyCredential as unknown as PublicKeyCredentialWithCapabilities
  ).getClientCapabilities;

  if (typeof capabilityApi === 'function') {
    try {
      const capabilities = await withCapabilityTimeout<ClientCapabilities | null>(
        capabilityApi.call(window.PublicKeyCredential),
        null,
      );
      if (capabilities === null) {
        logger.warn(
          LogCategory.AUTH,
          'Browser capability detection timed out; PRF will be verified at creation',
        );
        return { supported: true, verified: false };
      }
      if (capabilities['extension:prf'] === false) {
        return {
          supported: false,
          verified: true,
          reason: 'no-prf',
          message:
            'This browser reports that the WebAuthn PRF extension is unavailable. Vendly cannot derive a wallet key from a passkey here.',
        };
      }
      if (capabilities.passkeyPlatformAuthenticator === false) {
        return {
          supported: false,
          verified: true,
          reason: 'no-platform-authenticator',
          message:
            'This browser cannot create platform passkeys on this device. Use a recovery phrase instead.',
        };
      }
      if (capabilities['extension:prf'] === true) {
        return { supported: true, verified: true };
      }
    } catch (e) {
      logger.warn(LogCategory.AUTH, 'Client capability detection failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Firefox historically shipped PRF support later and inconsistently. Without
  // a capability API we keep the conservative guard rather than advertising a
  // flow that is likely to fail after creating an unusable credential.
  if (/Firefox\//i.test(navigator.userAgent) && !/Seamonkey\//i.test(navigator.userAgent)) {
    return {
      supported: false,
      verified: true,
      reason: 'unsupported-browser',
      message:
        'Firefox cannot confirm WebAuthn PRF support on this device. Use a recovery phrase, or a recent version of Chrome, Edge or Safari.',
    };
  }

  return { supported: true, verified: false };
}

// ============================================
// Pure WebAuthn operations
// ============================================

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function assertUsableConfig(config: PasskeyRpConfig): void {
  if (config.status !== 'ok' || !config.rpId) {
    throw new PasskeyError(
      'invalid-rp',
      config.issue ?? 'Passkey relying-party configuration is invalid for this address.',
    );
  }
}

/**
 * Register a new discoverable credential with PRF enabled.
 * Triggers 1 WebAuthn prompt: navigator.credentials.create().
 *
 * Must be called from a user gesture. Throws a PasskeyError if the
 * authenticator does not enable PRF; the credential cannot be deleted by the
 * page, so the UI must explain that it is unusable before this point.
 */
async function createPrfCredential(config: PasskeyRpConfig): Promise<void> {
  assertUsableConfig(config);

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: PASSKEY_RP_NAME, id: config.rpId ?? undefined },
      user: {
        id: userId,
        name: `vendly-${randomHex(8)}`,
        displayName: 'Vendly merchant',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        userVerification: 'required',
        residentKey: 'required',
      },
      extensions: { prf: {} },
    },
  });

  if (!credential || credential.type !== 'public-key') {
    throw new PasskeyError('unsupported-device', 'The authenticator returned no passkey.');
  }

  const extResults = (credential as PublicKeyCredential).getClientExtensionResults() as {
    prf?: { enabled?: boolean };
  };

  if (!extResults.prf?.enabled) {
    throw new PasskeyError(
      'prf-unsupported',
      'PRF extension not supported by this authenticator',
    );
  }
}

/**
 * Authenticate with an existing discoverable credential and evaluate PRF.
 * Triggers 1 WebAuthn prompt: navigator.credentials.get().
 *
 * @returns 32-byte PRF output.
 */
async function evaluatePrf(config: PasskeyRpConfig, salt: string): Promise<Uint8Array> {
  assertUsableConfig(config);

  const saltBytes = new TextEncoder().encode(salt);
  if (saltBytes.length === 0) {
    throw new PasskeyError('unknown', 'PRF salt must not be empty.');
  }
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: config.rpId ?? undefined,
      allowCredentials: [],
      userVerification: 'required',
      extensions: {
        prf: { eval: { first: saltBytes } },
      },
    },
  })) as PublicKeyCredential | null;

  if (!credential || credential.type !== 'public-key') {
    throw new PasskeyError('cancelled', 'No passkey was returned.');
  }

  const extResults = credential.getClientExtensionResults() as {
    prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } };
  };

  if (!extResults.prf?.results?.first) {
    throw new PasskeyError(
      'prf-unsupported',
      'The authenticator did not return PRF output for this passkey.',
    );
  }

  const output = new Uint8Array(extResults.prf.results.first);
  if (output.length !== 32) {
    throw new PasskeyError(
      'prf-unsupported',
      `PRF output has unexpected length ${output.length}; expected 32 bytes.`,
    );
  }

  return output;
}

// ============================================
// Provider (SDK interface + app extension)
// ============================================

/**
 * Browser implementation of the SDK's PasskeyPrfProvider using WebAuthn PRF.
 *
 * Uses discoverable credentials (resident keys), so no credential IDs are
 * stored by the app.
 */
export class BrowserPasskeyPrfProvider implements PasskeyPrfProvider {
  /** Optional callback fired after a successful WebAuthn prompt. */
  onAuthComplete?: () => void;

  constructor(private readonly config: PasskeyRpConfig = getRpConfig()) {}

  /** Check if a PRF-capable passkey can be used on this device. */
  async isPrfAvailable(): Promise<boolean> {
    const capability = await detectPrfCapability(this.config);
    if (!capability.supported) {
      logger.info(LogCategory.AUTH, 'PRF not available', {
        reason: capability.reason,
      });
    }
    return capability.supported;
  }

  /**
   * Create a new passkey with PRF support (1 prompt).
   * Only registers the credential — no seed derivation.
   */
  async createPasskey(): Promise<void> {
    logger.info(LogCategory.AUTH, 'Creating new passkey');
    await createPrfCredential(this.config);
    logger.info(LogCategory.AUTH, 'Passkey created with PRF support');
  }

  /**
   * Derive a 32-byte seed from passkey PRF with the given salt (1 prompt).
   * Called by the SDK for listLabels, storeLabel and getWallet operations.
   */
  async derivePrfSeed(salt: string): Promise<Uint8Array> {
    logger.info(LogCategory.AUTH, 'Deriving PRF seed');
    const seed = await evaluatePrf(this.config, salt);
    logger.info(LogCategory.AUTH, 'PRF seed derived successfully');
    this.onAuthComplete?.();
    return seed;
  }
}

// Singleton instance for production use
export const passkeyPrfProvider = new BrowserPasskeyPrfProvider();

// Export pure operations for tests
export { createPrfCredential, evaluatePrf };
