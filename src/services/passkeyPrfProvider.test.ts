import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PasskeyError,
  createPrfCredential,
  detectPrfCapability,
  evaluatePrf,
} from './passkeyPrfProvider';
import type { PasskeyRpConfig } from './webauthnConfig';

const okConfig: PasskeyRpConfig = {
  rpName: 'Vendly',
  rpId: 'localhost',
  origin: 'http://localhost:4173',
  hostname: 'localhost',
  status: 'ok',
};

const invalidConfig: PasskeyRpConfig = {
  rpName: 'Vendly',
  rpId: null,
  origin: 'http://127.0.0.1:4173',
  hostname: '127.0.0.1',
  status: 'invalid-origin',
  issue: 'Passkeys cannot be created on an IP address.',
};

type CreateMock = ReturnType<typeof vi.fn>;

function installWebAuthn(options: {
  platform?: boolean;
  capabilities?: Record<string, boolean>;
  withCapabilityApi?: boolean;
} = {}) {
  const isUVPAA = vi.fn(async () => options.platform ?? true);
  const getClientCapabilities = vi.fn(async () => options.capabilities ?? {});

  class FakePublicKeyCredential {
    static isUserVerifyingPlatformAuthenticatorAvailable = isUVPAA;
    static getClientCapabilities = options.withCapabilityApi === false
      ? undefined
      : getClientCapabilities;
  }

  Object.defineProperty(window, 'PublicKeyCredential', {
    configurable: true,
    writable: true,
    value: FakePublicKeyCredential,
  });

  const create = vi.fn();
  const get = vi.fn();
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: { create, get },
  });

  return { create: create as CreateMock, get: get as CreateMock };
}

function credentialResult(extensionResults: unknown) {
  return {
    type: 'public-key',
    getClientExtensionResults: () => extensionResults,
  } as unknown as Credential;
}

describe('detectPrfCapability', () => {
  beforeEach(() => {
    installWebAuthn();
  });

  it('accepts a browser that reports PRF and passkey platform support', async () => {
    installWebAuthn({
      capabilities: { 'extension:prf': true, passkeyPlatformAuthenticator: true },
    });

    const capability = await detectPrfCapability(okConfig);

    expect(capability).toEqual({ supported: true, verified: true });
  });

  it('rejects a browser that explicitly reports no PRF', async () => {
    installWebAuthn({ capabilities: { 'extension:prf': false } });

    const capability = await detectPrfCapability(okConfig);

    expect(capability.supported).toBe(false);
    expect(capability.reason).toBe('no-prf');
    expect(capability.message).toContain('PRF');
  });

  it('rejects a browser without passkey platform authenticators', async () => {
    installWebAuthn({
      capabilities: { 'extension:prf': true, passkeyPlatformAuthenticator: false },
    });

    const capability = await detectPrfCapability(okConfig);

    expect(capability.supported).toBe(false);
    expect(capability.reason).toBe('no-platform-authenticator');
  });

  it('rejects devices without a user-verifying platform authenticator', async () => {
    installWebAuthn({ platform: false });

    const capability = await detectPrfCapability(okConfig);

    expect(capability.supported).toBe(false);
    expect(capability.reason).toBe('no-platform-authenticator');
  });

  it('rejects browsers without WebAuthn', async () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const capability = await detectPrfCapability(okConfig);

    expect(capability.supported).toBe(false);
    expect(capability.reason).toBe('no-webauthn');
  });

  it('rejects invalid relying-party configurations before prompting', async () => {
    const capability = await detectPrfCapability(invalidConfig);

    expect(capability.supported).toBe(false);
    expect(capability.reason).toBe('invalid-origin');
  });

  it('falls back to unverified support when the browser has no capability API', async () => {
    const capability = await detectPrfCapability(okConfig);

    expect(capability.supported).toBe(true);
    expect(capability.verified).toBe(false);
  });

  it('does not hide passkeys when the capability API hangs', async () => {
    vi.useFakeTimers();
    installWebAuthn();
    (
      window.PublicKeyCredential as unknown as {
        getClientCapabilities: () => Promise<Record<string, boolean>>;
      }
    ).getClientCapabilities = () => new Promise(() => undefined);

    const pending = detectPrfCapability(okConfig);
    await vi.advanceTimersByTimeAsync(1600);

    await expect(pending).resolves.toEqual({ supported: true, verified: false });
    vi.useRealTimers();
  });
});

describe('createPrfCredential', () => {
  it('creates a Vendly passkey with PRF enabled', async () => {
    const { create } = installWebAuthn();
    create.mockResolvedValue(credentialResult({ prf: { enabled: true } }));

    await expect(createPrfCredential(okConfig)).resolves.toBeUndefined();

    expect(create).toHaveBeenCalledTimes(1);
    const options = create.mock.calls[0][0] as {
      publicKey: PublicKeyCredentialCreationOptions;
    };
    const publicKey = options.publicKey;
    expect(publicKey.rp.name).toBe('Vendly');
    expect(publicKey.rp.id).toBe('localhost');
    expect(publicKey.authenticatorSelection?.residentKey).toBe('required');
    expect(publicKey.authenticatorSelection?.userVerification).toBe('required');
    expect(publicKey.extensions?.prf).toEqual({});
  });

  it('rejects when the authenticator does not enable PRF', async () => {
    const { create } = installWebAuthn();
    create.mockResolvedValue(credentialResult({ prf: { enabled: false } }));

    await expect(createPrfCredential(okConfig)).rejects.toMatchObject({
      name: 'PasskeyError',
      code: 'prf-unsupported',
    });
  });

  it('refuses to prompt on an invalid origin', async () => {
    const { create } = installWebAuthn();

    await expect(createPrfCredential(invalidConfig)).rejects.toBeInstanceOf(PasskeyError);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('evaluatePrf', () => {
  it('returns the 32-byte PRF output for the provided salt', async () => {
    const { get } = installWebAuthn();
    get.mockResolvedValue(
      credentialResult({ prf: { results: { first: new Uint8Array(32).fill(7).buffer } } }),
    );

    const output = await evaluatePrf(okConfig, 'identity');

    expect(output).toHaveLength(32);
    expect(output[0]).toBe(7);
    const options = get.mock.calls[0][0] as {
      publicKey: PublicKeyCredentialRequestOptions;
    };
    expect(
      new TextDecoder().decode(options.publicKey.extensions?.prf?.eval?.first as Uint8Array),
    ).toBe('identity');
  });

  it('rejects when PRF output is missing', async () => {
    const { get } = installWebAuthn();
    get.mockResolvedValue(credentialResult({ prf: {} }));

    await expect(evaluatePrf(okConfig, 'identity')).rejects.toMatchObject({
      code: 'prf-unsupported',
    });
  });

  it('rejects unexpected PRF output lengths instead of weakening derivation', async () => {
    const { get } = installWebAuthn();
    get.mockResolvedValue(
      credentialResult({ prf: { results: { first: new Uint8Array(16).buffer } } }),
    );

    await expect(evaluatePrf(okConfig, 'identity')).rejects.toMatchObject({
      code: 'prf-unsupported',
    });
  });
});
