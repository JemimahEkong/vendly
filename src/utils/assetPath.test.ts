import { describe, it, expect } from 'vitest';
import { assetPath } from './assetPath';

describe('assetPath', () => {
  it('resolves public assets from the Vite base URL', () => {
    expect(assetPath('assets/vendly-logo.svg')).toBe('/assets/vendly-logo.svg');
  });

  it('does not double the slash when given a leading slash', () => {
    expect(assetPath('/illustrations/local-merchant.svg')).toBe(
      '/illustrations/local-merchant.svg',
    );
  });
});
