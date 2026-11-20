/**
 * Passkey Service.
 *
 * Wraps the Breez SDK's Passkey class to provide
 * passkey-based wallet creation and restoration functionality.
 *
 * Creates a fresh Passkey instance per operation so that no stale
 * PRF session or cached state can survive between wizard steps.
 * Every operation that touches WebAuthn must be called from a user gesture.
 */

import { Passkey, Wallet, NostrRelayConfig } from '@breeztech/breez-sdk-spark';
import {
  detectPrfCapability,
  passkeyPrfProvider,
  type PrfCapability,
} from './passkeyPrfProvider';
import { logger, LogCategory } from './logger';
import { getBreezApiKey } from './breezConfig';

// Storage key — presence signals passkey mode
const PASSKEY_LABEL_KEY = 'passkeyLabel';

// Relay operations are metadata-only; bound them so the UI cannot hang forever.
const RELAY_TIMEOUT_SECS = 20;
const LABEL_OPERATION_TIMEOUT_MS = 45_000;

function createPasskeyInstance(): Passkey {
  const breezApiKey = getBreezApiKey();
  const relayConfig: NostrRelayConfig = {
    ...(breezApiKey ? { breezApiKey } : {}),
    timeoutSecs: RELAY_TIMEOUT_SECS,
  };
  return new Passkey(passkeyPrfProvider, relayConfig);
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, LABEL_OPERATION_TIMEOUT_MS);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Detect whether this browser/authenticator can run the passkey flow,
 * including WebAuthn PRF support. No WebAuthn prompt is shown.
 */
export async function getPasskeyCapability(): Promise<PrfCapability> {
  return detectPrfCapability();
}

/**
 * Check if PRF (passkey) authentication is available on this device.
 */
export async function isPrfAvailable(): Promise<boolean> {
  const capability = await getPasskeyCapability();
  return capability.supported;
}

/**
 * Create a new passkey with PRF support (1 WebAuthn prompt).
 * Only registers the credential — no seed derivation.
 */
export async function createPasskey(): Promise<void> {
  logger.info(LogCategory.AUTH, 'Creating new passkey');
  await passkeyPrfProvider.createPasskey();
  logger.info(LogCategory.AUTH, 'Passkey created successfully');
}

/**
 * Check if the app is in passkey mode.
 * Passkey mode is signalled by a stored label, not by credential storage.
 */
export function isPasskeyMode(): boolean {
  return localStorage.getItem(PASSKEY_LABEL_KEY) !== null;
}

/**
 * Label used the last time this device opened a passkey wallet.
 * Not a secret: it is only a wallet label, never the seed.
 */
export function getSavedPasskeyLabel(): string | null {
  return localStorage.getItem(PASSKEY_LABEL_KEY);
}

/**
 * Set passkey mode by storing the label.
 */
export function setPasskeyMode(label?: string): void {
  localStorage.setItem(PASSKEY_LABEL_KEY, label ?? 'Default');
}

/**
 * Clear passkey mode.
 * Does NOT delete the passkey from the device — it should be reused on the
 * next sign-in.
 */
export function clearPasskeyMode(): void {
  localStorage.removeItem(PASSKEY_LABEL_KEY);
}

/**
 * List available labels from Nostr relays (1 WebAuthn prompt).
 */
export async function listLabels(): Promise<string[]> {
  logger.info(LogCategory.AUTH, 'Listing labels from nostr relays');
  const passkey = createPasskeyInstance();
  return withTimeout(passkey.listLabels(), 'Fetching labels');
}

/**
 * Save a label to Nostr relays so it can be discovered later (1 WebAuthn prompt).
 */
export async function saveLabel(label: string): Promise<void> {
  logger.info(LogCategory.AUTH, 'Saving label to nostr relays');
  const passkey = createPasskeyInstance();
  await withTimeout(passkey.storeLabel(label), 'Saving label');
}

/**
 * Derive a Wallet using passkey authentication (1 WebAuthn prompt).
 *
 * @param label - Optional label. If omitted, uses the saved label or the
 *                SDK default. Never derived from or stored with the mnemonic.
 */
export async function getWallet(label?: string): Promise<Wallet> {
  const effectiveLabel = label ?? localStorage.getItem(PASSKEY_LABEL_KEY) ?? undefined;

  logger.info(LogCategory.AUTH, 'Deriving wallet via passkey');

  const passkey = createPasskeyInstance();
  try {
    const wallet = await passkey.getWallet(effectiveLabel);
    logger.info(LogCategory.AUTH, 'Passkey wallet derived successfully');
    return wallet;
  } catch (e) {
    logger.error(LogCategory.AUTH, 'Failed to derive passkey wallet', {
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
