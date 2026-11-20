import { describe, it, expect } from 'vitest';
import {
  MissingBreezApiKeyError,
  normalizeBreezApiKey,
  requireBreezApiKey,
} from './breezConfig';

describe('Breez API key configuration', () => {
  it('trims pasted whitespace while preserving the key', () => {
    expect(normalizeBreezApiKey('  MIIBexample\n')).toBe('MIIBexample');
  });

  it('treats non-string and blank values as missing', () => {
    expect(normalizeBreezApiKey(undefined)).toBe('');
    expect(normalizeBreezApiKey('   ')).toBe('');
    expect(() => requireBreezApiKey('   ')).toThrow(MissingBreezApiKeyError);
    expect(requireBreezApiKey('  MIIBexample  ')).toBe('MIIBexample');
  });
});
