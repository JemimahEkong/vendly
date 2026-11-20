import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { assetPath } from '@/utils/assetPath';
import { formatNgnAmount } from '@/utils/formatCurrency';

interface PaymentReceivedCelebrationProps {
  amount: number;              // amount in kobo (NGN internal)
  items: Array<{ name: string; quantity: number; priceNgn: number; }>; // purchased items
  paymentMethod: string;       // 'cash' | 'bank-transfer' | 'lightning'
  paymentStatus: string;       // 'confirmed' | 'pending' | 'failed'
  btcAmount?: number;          // Lightning: sats amount (optional)
  exchangeRate?: number;       // NGN per BTC rate at time of sale (optional)
  rateTimestamp?: number;      // When rate was fetched (ms since epoch)
  cashReceived?: number;       // Cash only: amount handed over (kobo)
  change?: number;             // Cash only: change given (kobo)
  transactionRef?: string;     // Optional transaction reference
  merchantName?: string;       // Merchant name for receipt
  onClose: () => void;
}

const PaymentReceivedCelebration: React.FC<PaymentReceivedCelebrationProps> = ({
  amount,
  items,
  paymentMethod,
  paymentStatus,
  btcAmount,
  exchangeRate,
  rateTimestamp,
  cashReceived,
  change,
  transactionRef,
  merchantName = 'Merchant',
  onClose,
}) => {
  // Start invisible, animate in on mount
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation on next frame
    const enterFrame = requestAnimationFrame(() => setIsVisible(true));

    // Auto-dismiss after 4 seconds
    const autoDismiss = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 500);
    }, 4000);

    return () => {
      cancelAnimationFrame(enterFrame);
      clearTimeout(autoDismiss);
    };
  }, [onClose]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onClose, 500);
  };

  const ngnAmount = formatNgnAmount(amount);
  const formattedDate = new Date().toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Generate a transaction reference if not provided
  const ref = transactionRef || `VENDLY-${Date.now().toString(36).toUpperCase()}`;

  // Determine payment method display text
  let paymentMethodDisplay: React.ReactNode;
  if (paymentMethod === 'lightning' && btcAmount != null) {
    paymentMethodDisplay = <div className="mt-2"><span>BTC: {btcAmount} sats</span></div>;
  } else if (paymentMethod === 'cash') {
    paymentMethodDisplay = (
      <div className="mt-2 space-y-1">
        <div>
          <span>Cash received</span>
          {cashReceived != null && (
            <span className="ml-2 font-medium text-vendly-ink">
              {formatNgnAmount(cashReceived)}
            </span>
          )}
        </div>
        {change != null && change > 0 && (
          <div className="flex justify-between text-sm">
            <span>Change given</span>
            <span className="font-medium text-vendly-ink">{formatNgnAmount(change)}</span>
          </div>
        )}
      </div>
    );
  } else if (paymentMethod === 'bank-transfer') {
    paymentMethodDisplay = (
      <div className="mt-2">
        <span>Bank transfer</span>
        {paymentStatus === 'confirmed' && (
          <span className="text-vendly-success ml-2">✓ Confirmed</span>
        )}
      </div>
    );
  } else {
    paymentMethodDisplay = null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleDismiss}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-vendly-cream/95" />

      {/* Main receipt content */}
      <div
        className={`relative z-10 w-full max-w-md mx-4 p-6 transform transition-all duration-700 ${isVisible ? 'scale-100 translate-y-0' : 'scale-50 translate-y-20'}`}
        style={{ maxWidth: '420px' }}
      >
        {/* Receipt header with branding */}
        <div className="border-b border-vendly-border pb-4 mb-6 text-center">
          <img
            src={assetPath('illustrations/digital-payment.svg')}
            alt=""
            className="w-full max-w-[200px] h-auto mb-3"
          />
          <h2 className="text-2xl font-bold text-vendly-ink mb-1">
            Vendly
          </h2>
          <p className="text-vendly-muted text-sm">Merchant Copy</p>
        </div>

        {/* Receipt details */}
        <div className="space-y-4">
          {/* Transaction reference and date */}
          <div className="flex flex-col sm:flex-row justify-between text-sm text-vendly-muted">
            <span>Ref: {ref}</span>
            <span>{formattedDate}</span>
          </div>

          {/* Merchant name */}
          <div>
            <p className="font-medium text-vendly-ink">{merchantName}</p>
          </div>

          {/* Items list */}
          {items.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto pb-4">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-vendly-ink">
                  <span className="w-8 text-xs font-medium">{item.quantity}x</span>
                  <span>{item.name}</span>
                  <span className="text-right">{formatNgnAmount(item.priceNgn)}</span>
                </div>
              ))}
            </div>
          ) || (
            <p className="text-vendly-muted italic">No items</p>
          )}

          {/* Totals */}
          <div className="pt-4 border-t border-vendly-border flex flex-col sm:flex-row justify-between">
            <span>Subtotal</span>
            <span className="font-medium text-vendly-ink">{ngnAmount}</span>
          </div>

          {/* Payment method */}
          {paymentMethodDisplay}

          {/* Exchange rate used for the sale (never show an unknown ₦0 rate) */}
          {exchangeRate != null && exchangeRate > 0 && (
            <p className="mt-2 text-xs text-vendly-muted">
              Rate: ₦{Math.round(exchangeRate).toLocaleString()}/BTC
              {rateTimestamp ? ` · ${new Date(rateTimestamp).toLocaleTimeString()}` : ''}
            </p>
          )}

          {/* Total in bold */}
          <div className="pt-4 border-t border-vendly-border font-bold text-2xl text-vendly-ink mt-4">
            {ngnAmount}
          </div>

          {/* Payment status */}
          {paymentStatus === 'confirmed' && (
            <p className="mt-3 text-vendly-success text-sm">
              ✓ Payment confirmed
            </p>
          )}
          {paymentStatus === 'failed' && (
            <p className="mt-3 text-vendly-error text-sm">
              ✗ Payment failed
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PaymentReceivedCelebration;