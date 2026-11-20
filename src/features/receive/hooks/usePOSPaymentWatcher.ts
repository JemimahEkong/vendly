import { useEffect, useRef } from 'react';
import type { SdkEvent } from '@breeztech/breez-sdk-spark';
import { useWallet } from '../../../contexts/WalletContext';
import { logger, LogCategory } from '@/services/logger';

/**
 * Watches for incoming Lightning payments while the POS receive dialog is open.
 *
 * - `paymentSucceeded` → calls `onSettled(amountSats)` exactly for the expected
 *   invoice amount (other invoices are ignored).
 * - `paymentFailed` → calls `onFailed(amountSats)` so checkout can tell the
 *   merchant to retry; no sale is recorded.
 *
 * The listener is only active while `isActive` is true and is removed on close.
 */
export function usePOSPaymentWatcher({
  isActive,
  expectedAmountSats,
  onSettled,
  onFailed,
}: {
  isActive: boolean;
  expectedAmountSats?: number;
  onSettled?: (amountSats: number) => void;
  onFailed?: (amountSats: number) => void;
}) {
  const wallet = useWallet();
  const onSettledRef = useRef(onSettled);
  const onFailedRef = useRef(onFailed);
  onSettledRef.current = onSettled;
  onFailedRef.current = onFailed;

  useEffect(() => {
    if (!isActive) return;

    let removed = false;
    let listenerId: string | undefined;

    const listener = {
      onEvent: (event: SdkEvent) => {
        if (removed) return;
        if (event.type !== 'paymentSucceeded' && event.type !== 'paymentFailed') return;

        const payment = event.payment;
        if (payment.paymentType !== 'receive') return;

        const amountSats = Number(payment.amount) || 0;
        if (expectedAmountSats && amountSats !== expectedAmountSats) return;

        if (event.type === 'paymentFailed') {
          logger.warn(LogCategory.PAYMENT, 'POS Lightning payment failed', { amountSats });
          onFailedRef.current?.(amountSats);
          return;
        }

        logger.info(LogCategory.PAYMENT, 'POS payment settled', { amountSats });

        window.dispatchEvent(
          new CustomEvent('pos-payment-settled', {
            detail: { payment, amountSats },
          })
        );

        onSettledRef.current?.(amountSats);
      },
    };

    (async () => {
      try {
        listenerId = await wallet.addEventListener(listener);
        logger.debug(LogCategory.PAYMENT, 'POS payment watcher registered');
      } catch (err) {
        logger.error(LogCategory.PAYMENT, 'Failed to register POS payment watcher', { err });
      }
    })();

    return () => {
      removed = true;
      if (listenerId) {
        void wallet.removeEventListener(listenerId);
      }
      logger.debug(LogCategory.PAYMENT, 'POS payment watcher removed');
    };
  }, [isActive, expectedAmountSats, wallet]);
}
