import { describe, it, expect } from 'vitest';
import {
  PASSKEY_RP_NAME,
  isIpHostname,
  isRpIdValidForHostname,
  resolvePasskeyRpConfig,
  type LocationLike,
} from './webauthnConfig';

const loc = (overrides: Partial<LocationLike>): LocationLike => ({
  protocol: 'https:',
  hostname: 'vendly.app',
  port: '',
  ...overrides,
});

describe('resolvePasskeyRpConfig', () => {
  it('uses Vendly as the relying-party display name', () => {
    expect(PASSKEY_RP_NAME).toBe('Vendly');
    expect(resolvePasskeyRpConfig(loc({}), undefined).rpName).toBe('Vendly');
  });

  it('accepts localhost development origins', () => {
    const config = resolvePasskeyRpConfig(
      loc({ protocol: 'http:', hostname: 'localhost', port: '4173' }),
      undefined,
    );

    expect(config.status).toBe('ok');
    expect(config.rpId).toBe('localhost');
  });

  it('rejects 127.0.0.1 because an IP cannot be a relying-party ID', () => {
    const config = resolvePasskeyRpConfig(
      loc({ protocol: 'http:', hostname: '127.0.0.1', port: '4173' }),
      undefined,
    );

    expect(config.status).toBe('invalid-origin');
    expect(config.rpId).toBeNull();
    expect(config.issue).toMatch(/IP address/);
    expect(config.issue).toMatch(/localhost/);
  });

  it('uses the production hostname when no RP ID is configured', () => {
    const config = resolvePasskeyRpConfig(loc({ hostname: 'app.vendly.app' }), undefined);

    expect(config.status).toBe('ok');
    expect(config.rpId).toBe('app.vendly.app');
    expect(config.origin).toBe('https://app.vendly.app');
  });

  it('accepts an explicitly configured parent domain', () => {
    const config = resolvePasskeyRpConfig(loc({ hostname: 'app.vendly.app' }), 'vendly.app');

    expect(config.status).toBe('ok');
    expect(config.rpId).toBe('vendly.app');
  });

  it('rejects an RP ID that does not belong to the current hostname', () => {
    const config = resolvePasskeyRpConfig(loc({ hostname: 'app.vendly.app' }), 'example.com');

    expect(config.status).toBe('invalid-rp-id');
    expect(config.rpId).toBeNull();
    expect(config.issue).toContain('example.com');
  });

  it('does not accept a lookalike suffix as a parent domain', () => {
    const config = resolvePasskeyRpConfig(loc({ hostname: 'notvendly.app' }), 'vendly.app');

    expect(config.status).toBe('invalid-rp-id');
  });

  it('rejects insecure remote origins', () => {
    const config = resolvePasskeyRpConfig(
      loc({ protocol: 'http:', hostname: 'vendly.app' }),
      undefined,
    );

    expect(config.status).toBe('invalid-origin');
    expect(config.issue).toMatch(/HTTPS/);
  });

  it('rejects single-label intranet hostnames', () => {
    const config = resolvePasskeyRpConfig(
      loc({ protocol: 'https:', hostname: 'vendly-intranet' }),
      undefined,
    );

    expect(config.status).toBe('invalid-origin');
  });
});

describe('isIpHostname', () => {
  it.each(['127.0.0.1', '192.168.1.20', '::1', 'fe80::1'])('detects %s as an IP', (host) => {
    expect(isIpHostname(host)).toBe(true);
  });

  it.each(['localhost', 'vendly.app', 'app.vendly.app'])('treats %s as a hostname', (host) => {
    expect(isIpHostname(host)).toBe(false);
  });
});

describe('isRpIdValidForHostname', () => {
  it('allows equality and subdomains only', () => {
    expect(isRpIdValidForHostname('vendly.app', 'vendly.app')).toBe(true);
    expect(isRpIdValidForHostname('vendly.app', 'app.vendly.app')).toBe(true);
    expect(isRpIdValidForHostname('vendly.app', 'notvendly.app')).toBe(false);
    expect(isRpIdValidForHostname('app.vendly.app', 'vendly.app')).toBe(false);
  });
});
