import React, { useState, useEffect } from 'react';
import * as bip39 from 'bip39';
import { PrimaryButton } from '../components/ui';
import LoadingSpinner from '../components/LoadingSpinner';
import PageLayout from '../components/layout/PageLayout';
import { AlertCard } from '../components/AlertCard';
import { CheckIcon, CopyIcon, KeyIcon } from '../components/Icons';
import { logger, LogCategory } from '@/services/logger';

interface GeneratePageProps {
  onMnemonicConfirmed: (mnemonic: string) => void;
  onBack: () => void;
  error: string | null;
  onClearError: () => void;
}

const GeneratePage: React.FC<GeneratePageProps> = ({
  onMnemonicConfirmed,
  onBack,
  onClearError
}) => {
  const [mnemonic, setMnemonic] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    const generateMnemonic = async () => {
      try {
        const newMnemonic = bip39.generateMnemonic(128);
        setMnemonic(newMnemonic);
      } catch (error) {
        logger.error(LogCategory.AUTH, 'Failed to generate mnemonic', {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsLoading(false);
      }
    };

    generateMnemonic();
  }, []);

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(mnemonic)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(err => {
        logger.warn(LogCategory.UI, 'Failed to copy mnemonic', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
  };

  const handleConfirmMnemonic = () => {
    onMnemonicConfirmed(mnemonic);
  };

  if (isLoading) {
    return (
      <PageLayout onBack={onBack} footer={<div />} title="Create account" onClearError={onClearError}>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner text="Setting up Vendly..." />
        </div>
      </PageLayout>
    );
  }

  const footer = (
    <div className="max-w-xl mx-auto">
      <PrimaryButton className="w-full" onClick={handleConfirmMnemonic}>
        I've saved my phrase
      </PrimaryButton>
    </div>
  );

  const words = mnemonic.split(' ');

  return (
  <PageLayout onBack={onBack} footer={footer} title="Create account" onClearError={onClearError}>
    <div className="max-w-xl mx-auto w-full space-y-4 bg-transparent">
      {/* Icon */}
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-2xl bg-vendly-tint flex items-center justify-center">
          <KeyIcon size="xl" className="text-vendly-ink" />
        </div>
      </div>

      <p className="text-vendly-ink text-center mb-6">
        Write these words down in order. This is the only way to recover your business account if you lose access.
      </p>

      {/* Mnemonic grid */}
      <div className="bg-vendly-light border border-vendly-border rounded-2xl p-4 mb-4">
        <div className="grid grid-cols-3 gap-2">
          {words.map((word, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-vendly-tint rounded-lg px-3 py-2"
            >
              <span className="text-vendly-muted text-xs font-mono w-5 text-right">
                {index + 1}.
              </span>
              <span className="text-vendly-ink font-mono text-sm font-medium">
                {word}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Copy button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={handleCopyToClipboard}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg transition-all
            ${
              isCopied
                ? 'bg-vendly-tint text-vendly-ink border border-vendly-border'
                : 'text-vendly-ink hover:bg-vendly-tint'
            }
          `}
        >
          {isCopied ? (
            <>
              <CheckIcon size="md" />
              <span className="font-medium">Copied!</span>
            </>
          ) : (
            <>
              <CopyIcon size="md" />
              <span className="font-medium">Copy to clipboard</span>
            </>
          )}
        </button>
      </div>

      {/* Warning */}
      <AlertCard variant="warning" title="Keep it Secret">
        <p className="text-vendly-ink text-sm">
          Never share your recovery phrase. Anyone with these words can access your business account.
        </p>
      </AlertCard>

      <div className="flex-1" />
    </div>
  </PageLayout>
);
};

export default GeneratePage;
