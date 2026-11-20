import { describe, it, expect } from 'vitest';
import { classifyAuthError } from './authErrors';
import { MissingBreezApiKeyError } from './breezConfig';
import { PasskeyError } from './passkeyPrfProvider';

describe('classifyAuthError', () => {
  it('treats a dismissed WebAuthn prompt as cancellation, not a missing passkey', () => {
    const info = classifyAuthError(new DOMException('cancelled', 'NotAllowedError'), 'detect');

    expect(info.code).toBe('cancelled');
    expect(info.canRetry).toBe(true);
    expect(info.title).toMatch(/cancelled/i);
  });

  it('treats SDK-wrapped WebAuthn failures as a cancelled attempt, not a missing account', () => {
    const info = classifyAuthError(
      new Error('PRF error: Passkey error: Passkey PRF error occurred'),
      'detect',
    );

    expect(info.code).toBe('cancelled');
    expect(info.message).toMatch(/Nothing was changed/);
    expect(info.message).toMatch(/create a new passkey/);
  });

  it('explains invalid relying-party/origin errors', () => {
    const info = classifyAuthError(new DOMException('invalid domain', 'SecurityError'), 'create');

    expect(info.code).toBe('invalid-rp');
    expect(info.message).toMatch(/localhost/);
    expect(info.useRecoveryPhrase).toBe(true);
  });

  it('explains PRF-unsupported authenticators', () => {
    const info = classifyAuthError(
      new PasskeyError('prf-unsupported', 'PRF extension not supported'),
      'create',
    );

    expect(info.code).toBe('prf-unsupported');
    expect(info.message).toContain('PRF');
    expect(info.canRetry).toBe(false);
  });

  it('maps relay failures during label storage', () => {
    const info = classifyAuthError(new Error('Saving label timed out'), 'label');

    expect(info.code).toBe('relay-unavailable');
    expect(info.canRetry).toBe(true);
  });

  it('maps missing configuration to a wallet-service error', () => {
    const info = classifyAuthError(
      new Error('Breez API key not found. Add VITE_BREEZ_API_KEY to your .env file.'),
      'sdk',
    );

    expect(info.code).toBe('sdk-connect-failed');
    expect(info.message).toContain('VITE_BREEZ_API_KEY');
  });

  it('uses the missing-key message for the dedicated configuration error', () => {
    const info = classifyAuthError(new MissingBreezApiKeyError(), 'sdk');

    expect(info.title).toMatch(/not configured/i);
    expect(info.message).toMatch(/restart the dev server/i);
    expect(info.canRetry).toBe(false);
  });

  it('does not relabel a rejected API key as missing', () => {
    const rejected = classifyAuthError(new Error('Invalid API key supplied'), 'sdk');
    const rejectedByBreez = classifyAuthError(new Error('Breez API key rejected (403)'), 'sdk');

    expect(rejected.title).toMatch(/rejected/i);
    expect(rejected.message).toMatch(/different from a missing key/i);
    expect(rejectedByBreez.title).toMatch(/rejected/i);
  });

  it('maps derivation failures', () => {
    const info = classifyAuthError(new Error('could not derive'), 'derive');

    expect(info.code).toBe('wallet-derivation-failed');
    expect(info.useRecoveryPhrase).toBe(true);
  });

  it('never echoes raw error text into user-facing copy', () => {
    const info = classifyAuthError(new Error('secret-looking-detail-12345'), 'detect');

    expect(info.message).not.toContain('secret-looking-detail-12345');
    expect(info.code).toBe('unknown');
  });
});
