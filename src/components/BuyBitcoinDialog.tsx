import React, { useCallback, useEffect, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useToast } from '../contexts/ToastContext';
import { BottomSheetContainer, BottomSheetCard, DialogHeader, CopyableText } from './ui';
import LoadingSpinner from './LoadingSpinner';
import { CurrencyIcon, ExternalLinkIcon } from './Icons';
import { logger, LogCategory } from '@/services/logger';
import { formatError } from '@/utils/formatError';
import { BITCOIN_RAMP_PROVIDER, getBitcoinRampUrl } from '@/services/buyBitcoin';

const BITCOIN_ADDRESS_CACHE_KEY = 'receive_cache_bitcoin_address';

function readCachedAddress(): string | null {
  try {
    return localStorage.getItem(BITCOIN_ADDRESS_CACHE_KEY);
  } catch {
    return null;
  }
}

function cacheAddress(address: string): void {
  try {
    localStorage.setItem(BITCOIN_ADDRESS_CACHE_KEY, address);
  } catch {
    /* Cache is a convenience; the address is still shown. */
  }
}

interface BuyBitcoinDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Shows the merchant's real Vendly on-chain Bitcoin address and sends them to
 * Guardarian's hosted checkout. The purchase, KYC and card payment all happen
 * on Guardarian; Vendly only supplies the destination address.
 */
const BuyBitcoinDialog: React.FC<BuyBitcoinDialogProps> = ({ isOpen, onClose }) => {
  const wallet = useWallet();
  const { showToast } = useToast();
  const [address, setAddress] = useState<string | null>(() => readCachedAddress());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    const cached = readCachedAddress();
    if (cached) {
      setAddress(cached);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await wallet.receivePayment({
          paymentMethod: { type: 'bitcoinAddress' },
        });
        const nextAddress = response.paymentRequest;
        if (cancelled) return;
        setAddress(nextAddress);
        cacheAddress(nextAddress);
        logger.info(LogCategory.PAYMENT, 'Generated Bitcoin address for on-ramp');
      } catch (err) {
        if (cancelled) return;
        logger.error(LogCategory.PAYMENT, 'Failed to generate Bitcoin address for on-ramp', {
          error: formatError(err),
        });
        setError(
          err instanceof Error
            ? `Could not create your Bitcoin address: ${err.message}`
            : 'Could not create your Bitcoin address.'
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, wallet, attempt]);

  const handleCopy = useCallback(() => {
    showToast('success', 'Bitcoin address copied');
  }, [showToast]);

  return (
    <BottomSheetContainer isOpen={isOpen} onClose={onClose} showBackdrop>
      <BottomSheetCard>
        <DialogHeader
          title="Buy Bitcoin"
          onClose={onClose}
          icon={<CurrencyIcon size="sm" />}
        />

        <div className="space-y-4 pb-2" data-testid="buy-bitcoin-dialog">
          <p className="text-sm text-vendly-muted leading-relaxed">
            Buy Bitcoin with naira through{' '}
            <span className="font-semibold text-vendly-ink">{BITCOIN_RAMP_PROVIDER}</span>,
            a hosted Bitcoin on-ramp. You complete the purchase on Guardarian; Vendly never
            sees your card details, bank login, private keys or recovery phrase.
          </p>

          <div className="rounded-2xl border border-vendly-border bg-vendly-light p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-vendly-muted">
              1. Your Vendly Bitcoin address
            </p>

            {isLoading && (
              <div className="flex items-center justify-center h-20">
                <LoadingSpinner />
              </div>
            )}

            {!isLoading && error && (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-red-600">{error}</p>
                <button
                  type="button"
                  onClick={() => setAttempt((value) => value + 1)}
                  className="text-sm font-semibold text-vendly-deep underline"
                >
                  Try again
                </button>
              </div>
            )}

            {!isLoading && !error && address && (
              <div className="mt-2" data-testid="buy-bitcoin-address">
                <CopyableText
                  text={address}
                  truncate
                  label="Bitcoin address"
                  onCopied={handleCopy}
                  data-testid="buy-bitcoin-address-text"
                />
              </div>
            )}

            {!isLoading && !error && !address && (
              <p className="mt-2 text-sm text-vendly-muted">
                Your address is not available yet. Close and reopen this window to retry.
              </p>
            )}

            <p className="mt-3 text-xs text-vendly-muted leading-relaxed">
              Bitcoin network only. Copy this address and paste it into Guardarian as the
              receiving wallet. Do not use a Lightning invoice or a different chain.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-vendly-muted">
              2. Complete the purchase
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-vendly-muted">
              <li>Open Guardarian and choose Bitcoin (BTC).</li>
              <li>Select NGN or your preferred payment method.</li>
              <li>Paste the address above as the destination wallet.</li>
              <li>Finish payment and any identity checks on Guardarian.</li>
            </ol>
          </div>

          {address && !isLoading && !error ? (
            <a
              href={getBitcoinRampUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-vendly-deep px-4 py-3 text-sm font-semibold text-vendly-cream transition-opacity hover:opacity-90"
              data-testid="continue-to-guardarian"
            >
              Continue to Guardarian
              <ExternalLinkIcon size="sm" />
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-vendly-deep px-4 py-3 text-sm font-semibold text-vendly-cream opacity-50"
            >
              Continue to Guardarian
            </button>
          )}

          <p className="text-[11px] leading-relaxed text-vendly-muted">
            Guardarian handles the payment, exchange rate, fees and identity verification;
            availability depends on your country, payment method and amount. Your BTC is
            delivered on-chain to the address above after the purchase. Opening Guardarian
            does not itself complete a purchase, and Vendly does not credit the balance until
            the Bitcoin is actually received and confirmed.
          </p>
        </div>
      </BottomSheetCard>
    </BottomSheetContainer>
  );
};

export default BuyBitcoinDialog;
