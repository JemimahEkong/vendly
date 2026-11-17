import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PaymentReceivedCelebrationProps {
  amount: number;
  onClose: () => void;
}

const PaymentReceivedCelebration: React.FC<PaymentReceivedCelebrationProps> = ({ amount, onClose }) => {
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

  const formatAmount = (sats: number) =>
    sats.toLocaleString('en-US').replace(/,/g, '\u2009');

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleDismiss}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-vendly-cream/95" />

      {/* Main content */}
      <div
        className={`relative z-10 flex flex-col items-center transform transition-all duration-700 ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-50 translate-y-20'
        }`}
      >
        <img
          src="/illustrations/digital-payment.svg"
          alt=""
          className="w-full max-w-[250px] h-auto mb-4"
        />

        <h2 className="text-2xl font-bold text-vendly-ink mb-5">
          Payment received
        </h2>

        <div className="relative">
          <div className="relative pl-14 pr-10 py-5 rounded-2xl bg-vendly-light border border-vendly-border text-center">
            <span className="relative text-5xl font-mono font-bold text-vendly-ink">
              <span className="absolute right-full top-1/2 -translate-y-1/2 mr-0.5 text-3xl text-vendly-ink opacity-70">₿</span>
              {formatAmount(amount)}
            </span>
          </div>
        </div>

        <p className="mt-8 text-vendly-muted text-sm">
          Tap anywhere to continue
        </p>
      </div>
    </div>,
    document.body
  );
};

export default PaymentReceivedCelebration;
