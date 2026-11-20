/**
 * WebAuthn relying-party (RP) configuration for Vendly passkeys.
 *
 * WebAuthn only works on a secure origin whose hostname can be used as a
 * "registrable domain suffix" RP ID. In particular:
 *
 * - `https://vendly.app` and `https://app.vendly.app` are valid.
 * - `http://localhost:4173` is valid (localhost is a trustworthy origin and
 *   `localhost` is a valid RP ID).
 * - `http://127.0.0.1:4173` is a trustworthy origin but an IP address is not
 *   a valid RP ID, so Chrome/Firefox reject every WebAuthn call there.
 *
 * This module centralises that decision so the capability check, the SDK
 * provider and the UI all agree on whether passkeys can work.
 */

export const PASSKEY_RP_NAME = 'Vendly';

export type RpConfigStatus = 'ok' | 'invalid-origin' | 'invalid-rp-id';

export interface PasskeyRpConfig {
  rpName: string;
  /**
   * RP ID to send to WebAuthn. `null` means "omit `id` and let the browser
   * derive it from the origin" (used only when the hostname cannot be used).
   */
  rpId: string | null;
  origin: string;
  hostname: string;
  status: RpConfigStatus;
  /** Human-readable explanation when `status !== 'ok'`. */
  issue?: string;
}

export interface LocationLike {
  protocol: string;
  hostname: string;
  origin?: string;
  port?: string;
}

const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** True for IPv4/IPv6 literals, which WebAuthn cannot use as an RP ID. */
export function isIpHostname(hostname: string): boolean {
  if (IPV4_PATTERN.test(hostname)) return true;
  // IPv6 in URLs is bracketed; the hostname property may or may not keep them.
  return hostname.includes(':');
}

/** A configured RP ID is usable when the origin host equals or is a subdomain of it. */
export function isRpIdValidForHostname(rpId: string, hostname: string): boolean {
  return hostname === rpId || hostname.endsWith(`.${rpId}`);
}

function isSecureOrigin(location: LocationLike): boolean {
  if (location.protocol === 'https:') return true;
  return location.hostname === 'localhost';
}

/**
 * Resolve the RP configuration from the Vite env override and the current
 * location. Never throws — callers surface `status`/`issue` in the UI.
 *
 * `VITE_PASSKEY_RP_ID` is optional. When unset, the current hostname is used
 * (so production uses the real HTTPS deployment domain automatically). When
 * set, it must be the current hostname or a parent domain of it; a temporary
 * or unrelated development domain must never be baked into production config.
 */
export function resolvePasskeyRpConfig(
  location: LocationLike = window.location,
  configuredRpId: string | undefined = import.meta.env.VITE_PASSKEY_RP_ID,
): PasskeyRpConfig {
  const hostname = location.hostname.toLowerCase();
  const origin = location.origin ?? `${location.protocol}//${hostname}`;
  const override = configuredRpId?.trim();

  const base: PasskeyRpConfig = {
    rpName: PASSKEY_RP_NAME,
    rpId: override || hostname,
    origin,
    hostname,
    status: 'ok',
  };

  if (isIpHostname(hostname)) {
    return {
      ...base,
      rpId: null,
      status: 'invalid-origin',
      issue: `Passkeys cannot be created on an IP address. Open Vendly at http://localhost:${location.port || '5173'} instead.`,
    };
  }

  if (!isSecureOrigin(location)) {
    return {
      ...base,
      rpId: null,
      status: 'invalid-origin',
      issue:
        'Passkeys require a secure connection. Open Vendly over HTTPS, or use http://localhost during development.',
    };
  }

  if (!hostname.includes('.') && hostname !== 'localhost') {
    return {
      ...base,
      rpId: null,
      status: 'invalid-origin',
      issue:
        'Passkeys require a public domain or localhost. This hostname is not eligible for a WebAuthn relying-party ID.',
    };
  }

  if (override && !isRpIdValidForHostname(override.toLowerCase(), hostname)) {
    return {
      ...base,
      rpId: null,
      status: 'invalid-rp-id',
      issue: `The configured passkey relying-party ID "${override}" does not belong to ${hostname}. Use "${hostname}" or a parent domain of it.`,
    };
  }

  return base;
}
