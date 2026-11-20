import React, { useState } from 'react';
import * as bip39 from 'bip39';
import PageLayout from '../components/layout/PageLayout';
import { PrimaryButton } from '../components/ui';
import { SimpleAlert } from '../components/AlertCard';
import { UploadIcon } from '../components/Icons';
import { classifyAuthError, getErrorDiagnostic } from '@/services/authErrors';

interface RestorePageProps {
  onConnect: (mnemonic: string) => Promise<void>;
  onBack: () => void;
  onClearError: () => void;
  isLoading?: boolean;
}

const RestorePage: React.FC<RestorePageProps> = ({
  onConnect,
  onBack,
  onClearError,
  isLoading = false,
}) => {
  const [mnemonic, setMnemonic] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const cleaned = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
    const wordCount = cleaned.split(' ').length;

    if (wordCount !== 12 && wordCount !== 24) {
      setError('Please enter a valid 12 or 24-word recovery phrase');
      return;
    }

    // Validate against BIP-39 before touching the wallet. Breez Spark accepts
    // standard 12- or 24-word BIP-39 phrases; the checksum and wordlist must be
    // correct, not merely the word count.
    if (!bip39.validateMnemonic(cleaned)) {
      setError('Invalid recovery phrase. Check the spelling and word order, then try again.');
      return;
    }

    setError(null);
    try {
      await onConnect(cleaned);
    } catch (err) {
      const { message } = getErrorDiagnostic(err);
      const looksLikeInvalidPhrase =
        /invalid (mnemonic|seed|word|phrase)|checksum|entropy|unknown word/i.test(message) &&
        !/api key|network|connection|timeout/i.test(message);

      setError(
        looksLikeInvalidPhrase
          ? 'Invalid recovery phrase. Please check your words and try again.'
          : classifyAuthError(err, 'sdk').message,
      );
    }
  };

  const footer = (
    <div className="max-w-xl mx-auto">
      <PrimaryButton
        onClick={handleSubmit}
        disabled={!mnemonic.trim() || isLoading}
        className="w-full"
        data-testid="restore-confirm-button"
      >
        {isLoading ? 'Restoring...' : 'Restore account'}
      </PrimaryButton>
    </div>
  );

 return (
  <PageLayout footer={footer} onBack={onBack} title="Restore account" onClearError={onClearError}>
    <div className="max-w-xl mx-auto w-full space-y-4 bg-transparent">
      {/* Icon */}
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-vendly-tint flex items-center justify-center">
          <UploadIcon size="xl" className="text-vendly-ink" />
        </div>
      </div>

      <p className="text-vendly-ink text-center mb-6">
        Enter the 12 or 24-word recovery phrase for your business account. Separate each word with a space.
      </p>

      <div className="relative">
        <textarea
          value={mnemonic}
          onChange={(e) => setMnemonic(e.target.value)}
          className="w-full h-36 px-4 py-3 text-vendly-ink bg-vendly-light border border-vendly-border rounded-xl focus:border-vendly-green focus:ring-2 focus:ring-vendly-border resize-none font-mono text-sm"
          placeholder="word1 word2 word3 ..."
          data-testid="mnemonic-input"
        />
      </div>

      {error && (
        <SimpleAlert variant="error" className="mt-4">
          {error}
        </SimpleAlert>
      )}

      <div className="flex-1" />
    </div>
  </PageLayout>
);
};

export default RestorePage;
