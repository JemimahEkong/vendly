import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  enterDevAccess,
  exitDevAccess,
  hasDevAccessSession,
  isDevAccessEnabled,
} from './devAccess';

describe('development access', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    sessionStorage.clear();
  });

  it('is available while running the Vite development server', () => {
    expect(isDevAccessEnabled()).toBe(true);
  });

  it('can be turned off with VITE_DEV_ACCESS=false', () => {
    vi.stubEnv('VITE_DEV_ACCESS', 'false');

    expect(isDevAccessEnabled()).toBe(false);
    enterDevAccess();
    expect(hasDevAccessSession()).toBe(false);
  });

  it('keeps access for the tab and clears it on exit', () => {
    enterDevAccess();
    expect(hasDevAccessSession()).toBe(true);

    exitDevAccess();
    expect(hasDevAccessSession()).toBe(false);
  });
});
