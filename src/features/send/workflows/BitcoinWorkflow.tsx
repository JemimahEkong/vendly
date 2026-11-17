import React, { useState } from 'react';
import type { SendPaymentMethod } from '@breeztech/breez-sdk-spark';
import type { PaymentStep } from '../../../types/domain';
import { PrimaryButton } from '../../../components/ui';
import { RadioCheckIcon } from '../../../components/Icons';
import ConfirmStep from '../steps/ConfirmStep';

interface BitcoinWorkflowProps {
  method: Extract<SendPaymentMethod, { type: 'bitcoinAddress' }>;
  amountSats: bigint;
  feesIncluded?: boolean;
  onBack: () => void;
  onSend: (options: { type: 'bitcoinAddress'; confirmationSpeed: 'fast' | 'medium' | 'slow' }) => Promise<void>;
}

const BitcoinWorkflow: React.FC<BitcoinWorkflowProps> = ({ method, amountSats, feesIncluded, onBack, onSend }) => {
  const [step, setStep] = useState<PaymentStep>('fee');
  // Fee selection happens here; processing/result are handled by parent
  const [selectedFeeRate, setSelectedFeeRate] = useState<'fast' | 'medium' | 'slow' | null>(null);

  const handleSend = async () => {
    if (!selectedFeeRate) return;
    await onSend({ type: 'bitcoinAddress', confirmationSpeed: selectedFeeRate });
  };

  // Compute fees from prepared response and selected rate
  const fq = method.feeQuote;
  let feesSat: number | null = null;
  if (selectedFeeRate) {
    const selected = selectedFeeRate === 'fast' ? fq.speedFast : selectedFeeRate === 'medium' ? fq.speedMedium : fq.speedSlow;
    feesSat = selected.l1BroadcastFeeSat + selected.userFeeSat;
  }

 return (
  <>
    {/* Fee selection */}
    {step === 'fee' && (
      <>
        <div className="mb-4">
          <label className="block text-sm font-medium text-vendly-ink mb-2">Select Fee Rate</label>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedFeeRate('slow')}
              className={`relative flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                selectedFeeRate === 'slow'
                  ? 'bg-vendly-deep text-vendly-light border-vendly-deep ring-2 ring-vendly-border'
                  : 'bg-vendly-light text-vendly-ink border-vendly-border hover:border-vendly-muted'
              }`}
            >
              {selectedFeeRate === 'slow' && (
                <RadioCheckIcon className="absolute top-2 right-2" />
              )}
              <div>Slow</div>
              <div className="text-xs opacity-70">₿{(fq.speedSlow.l1BroadcastFeeSat + fq.speedSlow.userFeeSat).toLocaleString()}</div>
            </button>

            <button
              onClick={() => setSelectedFeeRate('medium')}
              className={`relative flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                selectedFeeRate === 'medium'
                  ? 'bg-vendly-deep text-vendly-light border-vendly-deep ring-2 ring-vendly-border'
                  : 'bg-vendly-light text-vendly-ink border-vendly-border hover:border-vendly-muted'
              }`}
            >
              {selectedFeeRate === 'medium' && (
                <RadioCheckIcon className="absolute top-2 right-2" />
              )}
              <div>Medium</div>
              <div className="text-xs opacity-70">₿{(fq.speedMedium.l1BroadcastFeeSat + fq.speedMedium.userFeeSat).toLocaleString()}</div>
            </button>

            <button
              onClick={() => setSelectedFeeRate('fast')}
              className={`relative flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                selectedFeeRate === 'fast'
                  ? 'bg-vendly-deep text-vendly-light border-vendly-deep ring-2 ring-vendly-border'
                  : 'bg-vendly-light text-vendly-ink border-vendly-border hover:border-vendly-muted'
              }`}
            >
              {selectedFeeRate === 'fast' && (
                <RadioCheckIcon className="absolute top-2 right-2" />
              )}
              <div>Fast</div>
              <div className="text-xs opacity-70">₿{(fq.speedFast.l1BroadcastFeeSat + fq.speedFast.userFeeSat).toLocaleString()}</div>
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <PrimaryButton
            onClick={onBack}
            className="flex-1 bg-vendly-muted hover:bg-vendly-green text-vendly-light p-3 rounded-lg"
            disabled={false}
          >
            Back
          </PrimaryButton>

          <PrimaryButton
            onClick={() => setStep('confirm')}
            className="flex-1"
            disabled={!selectedFeeRate}
          >
            Continue
          </PrimaryButton>
        </div>
      </>
    )}

    {/* Confirm */}
    {step === 'confirm' && (
      <ConfirmStep
        amountSats={amountSats}
        feesSat={feesSat}
        feesIncluded={feesIncluded}
        error={null}
        isLoading={false}
        onConfirm={handleSend}
      />
    )}
  </>
);
};

export default BitcoinWorkflow;
