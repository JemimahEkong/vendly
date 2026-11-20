import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasskeyPage from './PasskeyPage';
import * as passkeyService from '@/services/passkeyService';

vi.mock('@/services/passkeyService', () => ({
  createPasskey: vi.fn(),
  getWallet: vi.fn(),
  listLabels: vi.fn(),
  saveLabel: vi.fn(),
  setPasskeyMode: vi.fn(),
  getSavedPasskeyLabel: vi.fn(() => null),
}));

const mocked = vi.mocked(passkeyService);

const WALLET = {
  seed: { type: 'mnemonic' as const, mnemonic: 'test seed' },
  label: 'Default',
};

function renderPage(
  overrides: Partial<React.ComponentProps<typeof PasskeyPage>> = {},
) {
  const onWalletRestored = vi.fn(async () => undefined);
  const onBack = vi.fn();
  const onUseRecoveryPhrase = vi.fn();

  render(
    <PasskeyPage
      onWalletRestored={onWalletRestored}
      onBack={onBack}
      onUseRecoveryPhrase={onUseRecoveryPhrase}
      capability={{ supported: true, verified: true }}
      {...overrides}
    />,
  );

  return { onWalletRestored, onBack, onUseRecoveryPhrase };
}

describe('PasskeyPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.getWallet.mockResolvedValue(WALLET);
  });

  it('does not prompt on mount and treats a cancelled prompt as cancellation, not a new account', async () => {
    const user = userEvent.setup();
    mocked.listLabels.mockRejectedValue(new DOMException('cancelled', 'NotAllowedError'));

    renderPage();

    // No WebAuthn prompt is fired by an effect on load.
    expect(mocked.listLabels).not.toHaveBeenCalled();
    expect(screen.getByText('Continue with passkey')).toBeInTheDocument();

    await user.click(screen.getByTestId('passkey-signin-button'));

    expect(await screen.findByText('Passkey prompt cancelled')).toBeInTheDocument();
    expect(screen.queryByText('Create your passkey')).not.toBeInTheDocument();
    expect(screen.getByTestId('passkey-signin-button')).toBeInTheDocument();
  });

  it('explains invalid relying-party addresses instead of starting registration', async () => {
    const user = userEvent.setup();
    mocked.listLabels.mockRejectedValue(new DOMException('invalid domain', 'SecurityError'));

    renderPage();
    await user.click(screen.getByTestId('passkey-signin-button'));

    expect(await screen.findByText('Passkeys are unavailable at this address')).toBeInTheDocument();
    expect(screen.queryByText('Create your passkey')).not.toBeInTheDocument();
  });

  it('disables the passkey flow when PRF is unavailable and offers the recovery phrase', async () => {
    const user = userEvent.setup();
    const { onUseRecoveryPhrase } = renderPage({
      capability: {
        supported: false,
        verified: true,
        reason: 'no-prf',
        message: 'PRF is not available on this browser.',
      },
    });

    expect(screen.getByText('Passkeys unavailable on this device')).toBeInTheDocument();
    expect(screen.queryByTestId('passkey-signin-button')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Use a recovery phrase' }));
    expect(onUseRecoveryPhrase).toHaveBeenCalled();
  });

  it('creates a passkey, saves the label and derives the wallet in separate user steps', async () => {
    const user = userEvent.setup();
    mocked.createPasskey.mockResolvedValue(undefined);
    mocked.saveLabel.mockResolvedValue(undefined);
    const { onWalletRestored } = renderPage();

    await user.click(screen.getByTestId('passkey-create-button'));
    expect(screen.getByText('Create your passkey')).toBeInTheDocument();

    await user.click(screen.getByTestId('passkey-create-confirm-button'));
    expect(await screen.findByText('Name this account')).toBeInTheDocument();
    expect(mocked.createPasskey).toHaveBeenCalledTimes(1);

    expect(screen.getByTestId('passkey-label-input')).toHaveValue('Default');

    await user.click(screen.getByTestId('passkey-save-label-button'));
    expect(await screen.findByText('Passkey ready')).toBeInTheDocument();
    expect(mocked.saveLabel).toHaveBeenCalledWith('Default');
    // Derivation requires a fresh, explicit user action.
    expect(mocked.getWallet).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('passkey-open-wallet-button'));
    await waitFor(() => {
      expect(onWalletRestored).toHaveBeenCalledWith(WALLET.seed, 'Default');
    });
  });

  it('keeps sign-in possible when label discovery fails, using the saved label', async () => {
    const user = userEvent.setup();
    mocked.listLabels.mockRejectedValue(new Error('Fetching labels timed out'));
    vi.mocked(passkeyService.getSavedPasskeyLabel).mockReturnValue('Market stall');
    const { onWalletRestored } = renderPage();

    await user.click(screen.getByTestId('passkey-signin-button'));

    expect(await screen.findByText('Labels unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('new-passkey-label-input')).toHaveValue('Market stall');
    expect(mocked.saveLabel).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('passkey-continue-button'));

    await waitFor(() => {
      expect(mocked.getWallet).toHaveBeenCalledWith('Market stall');
      expect(onWalletRestored).toHaveBeenCalledWith(WALLET.seed, 'Default');
    });
  });

  it('signs in a returning user and derives the wallet from the chosen label', async () => {
    const user = userEvent.setup();
    mocked.listLabels.mockResolvedValue(['Shop', 'Default']);
    const { onWalletRestored } = renderPage();

    await user.click(screen.getByTestId('passkey-signin-button'));

    expect(await screen.findByText('Select a label')).toBeInTheDocument();
    expect(mocked.getWallet).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('passkey-continue-button'));
    await waitFor(() => {
      expect(mocked.getWallet).toHaveBeenCalledWith('Default');
      expect(onWalletRestored).toHaveBeenCalledWith(WALLET.seed, 'Default');
    });
  });

  it('recovers from a cancelled derivation without staying in a loading state', async () => {
    const user = userEvent.setup();
    mocked.listLabels.mockResolvedValue(['Default']);
    mocked.getWallet.mockRejectedValue(new DOMException('cancelled', 'NotAllowedError'));

    renderPage();
    await user.click(screen.getByTestId('passkey-signin-button'));
    await screen.findByText('Select a label');
    await user.click(screen.getByTestId('passkey-continue-button'));

    expect(await screen.findByText('Passkey prompt cancelled')).toBeInTheDocument();
    expect(screen.getByTestId('passkey-open-wallet-button')).toBeInTheDocument();
  });

  it('shows a relay error and allows retrying label storage', async () => {
    const user = userEvent.setup();
    mocked.createPasskey.mockResolvedValue(undefined);
    mocked.saveLabel.mockRejectedValue(new Error('Saving label timed out'));

    renderPage();
    await user.click(screen.getByTestId('passkey-create-button'));
    await user.click(screen.getByTestId('passkey-create-confirm-button'));
    await screen.findByText('Name this account');
    await user.click(screen.getByTestId('passkey-save-label-button'));

    expect(await screen.findByText('Could not reach the label service')).toBeInTheDocument();
    expect(screen.getByTestId('passkey-save-label-button')).toBeInTheDocument();
  });

  it('reports a wallet-service failure after a successful derivation and retries without another prompt', async () => {
    const user = userEvent.setup();
    mocked.createPasskey.mockResolvedValue(undefined);
    mocked.saveLabel.mockResolvedValue(undefined);
    const onWalletRestored = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce(undefined);

    renderPage({ onWalletRestored });

    await user.click(screen.getByTestId('passkey-create-button'));
    await user.click(screen.getByTestId('passkey-create-confirm-button'));
    await screen.findByText('Name this account');
    await user.click(screen.getByTestId('passkey-save-label-button'));
    await screen.findByText('Passkey ready');
    await user.click(screen.getByTestId('passkey-open-wallet-button'));

    expect(await screen.findByText('Wallet service unavailable')).toBeInTheDocument();
    expect(mocked.getWallet).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId('passkey-open-wallet-button'));

    await waitFor(() => {
      expect(onWalletRestored).toHaveBeenCalledTimes(2);
    });
    // The retry reused the derived wallet; no second WebAuthn prompt.
    expect(mocked.getWallet).toHaveBeenCalledTimes(1);
  });
});
