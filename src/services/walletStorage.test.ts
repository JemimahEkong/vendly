import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  clearMnemonic,
  decryptString,
  encryptString,
  loadMnemonic,
  resetMemoryMnemonicForTests,
  saveMnemonic,
} from './walletStorage';

const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

async function createKey(): Promise<CryptoKey> {
  return (await webcrypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )) as unknown as CryptoKey;
}

describe('walletStorage crypto', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('encrypts and decrypts a recovery phrase with AES-GCM', async () => {
    const key = await createKey();
    const payload = await encryptString(key, PHRASE);

    expect(payload.iv).toHaveLength(12);
    const ciphertext = new TextDecoder().decode(new Uint8Array(payload.data));
    expect(ciphertext).not.toContain('abandon');

    await expect(decryptString(key, payload)).resolves.toBe(PHRASE);
  });

  it('produces a different ciphertext each time', async () => {
    const key = await createKey();
    const first = await encryptString(key, PHRASE);
    const second = await encryptString(key, PHRASE);

    expect(Array.from(new Uint8Array(first.data))).not.toEqual(
      Array.from(new Uint8Array(second.data)),
    );
  });
});

describe('walletStorage persistence fallback', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
    // Forces the in-memory fallback (happy-dom has no IndexedDB).
    vi.stubGlobal('indexedDB', undefined);
    resetMemoryMnemonicForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetMemoryMnemonicForTests();
  });

  it('keeps the wallet usable in memory without persisting plaintext', async () => {
    const persisted = await saveMnemonic(PHRASE);

    expect(persisted).toBe(false);
    await expect(loadMnemonic()).resolves.toBe(PHRASE);
    expect(localStorage.getItem('walletMnemonic')).toBeNull();
  });

  it('migrates and deletes a legacy plaintext mnemonic', async () => {
    localStorage.setItem('walletMnemonic', PHRASE);

    await expect(loadMnemonic()).resolves.toBe(PHRASE);
    expect(localStorage.getItem('walletMnemonic')).toBeNull();
  });

  it('clears the in-memory wallet on logout', async () => {
    await saveMnemonic(PHRASE);
    await clearMnemonic();

    await expect(loadMnemonic()).resolves.toBeNull();
    expect(localStorage.getItem('walletMnemonic')).toBeNull();
  });
});
