import React, { useEffect, useState } from 'react';
import { WarningIcon, SpinnerIcon, EyeIcon, FingerprintIcon } from '../components/Icons';
import SlideInPage from '../components/layout/SlideInPage';
import { isPasskeyMode, getWallet } from '@/services/passkeyService';
import { loadMnemonic } from '@/services/walletStorage';
import { logger, LogCategory } from '@/services/logger';

interface BackupPageProps {
  onBack: () => void;
}

const BackupPage: React.FC<BackupPageProps> = ({ onBack }) => {
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPasskey = isPasskeyMode();

  useEffect(() => {
    if (isPasskey) return;
    let cancelled = false;
    loadMnemonic()
      .then((phrase) => {
        if (!cancelled) setMnemonic(phrase);
      })
      .catch((e) => {
        logger.warn(LogCategory.AUTH, 'Failed to load recovery phrase from secure storage', {
          error: e instanceof Error ? e.message : String(e),
        });
        if (!cancelled) setMnemonic(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isPasskey]);

  const handleRevealPasskey = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const w = await getWallet();
      if (w.seed.type === 'mnemonic' && w.seed.mnemonic) {
        setMnemonic(w.seed.mnemonic);
        setIsRevealed(true);
      } else {
        setError('Could not derive recovery phrase');
      }
    } catch (e) {
      logger.error(LogCategory.AUTH, 'Failed to derive mnemonic from passkey', {
        error: e instanceof Error ? e.message : String(e),
      });
      setError(e instanceof Error ? e.message : 'Failed to authenticate');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!mnemonic) return;
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      logger.warn(LogCategory.UI, 'Failed to copy mnemonic to clipboard', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleHide = () => {
    setIsRevealed(false);
    if (isPasskey) {
      setMnemonic(null);
    }
  };

  const words = mnemonic ? mnemonic.split(' ') : [];

  return (
  <SlideInPage title="Account backup" onClose={onBack} slideFrom="left">
    <div className="p-4 bg-vendly-cream">
      <div className="max-w-xl mx-auto w-full space-y-6">
        {/* Passkey info card */}
        {isPasskey && (
          <div className="bg-vendly-light border border-vendly-border rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-vendly-tint flex items-center justify-center flex-shrink-0">
                <FingerprintIcon size="md" className="text-vendly-ink" />
              </div>
              <div>
                <h4 className="font-medium text-vendly-ink mb-1">Passkey Protected</h4>
                <p className="text-vendly-muted text-sm">
                  Your recovery phrase is derived from your passkey. To restore on another device, use your passkey or the recovery phrase below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Reveal button — passkey mode */}
        {isPasskey && !isRevealed && !mnemonic && (
          <button
            onClick={handleRevealPasskey}
            disabled={isLoading}
            className="w-full bg-vendly-light border border-vendly-border rounded-2xl p-8 flex flex-col items-center gap-4 hover:border-vendly-green transition-colors disabled:opacity-50"
          >
            <div className="w-16 h-16 rounded-2xl bg-vendly-tint flex items-center justify-center">
              {isLoading ? (
                <SpinnerIcon size="xl" className="text-vendly-ink" />
              ) : (
                <EyeIcon size="xl" className="text-vendly-ink" />
              )}
            </div>
            <span className="font-display font-semibold text-vendly-ink">
              {isLoading ? 'Authenticating...' : 'Tap to reveal phrase'}
            </span>
            <span className="text-sm text-vendly-muted">
              {isLoading ? 'Complete passkey authentication' : 'Requires passkey authentication'}
            </span>
          </button>
        )}

        {/* Reveal button — mnemonic mode */}
        {!isPasskey && !isRevealed && mnemonic && (
          <button
            onClick={() => setIsRevealed(true)}
            className="w-full bg-vendly-light border border-vendly-border rounded-2xl p-8 flex flex-col items-center gap-4 hover:border-vendly-green transition-colors"
          >
            <div className="w-16 h-16 rounded-2xl bg-vendly-tint flex items-center justify-center">
              <EyeIcon size="xl" className="text-vendly-ink" />
            </div>
            <span className="font-display font-semibold text-vendly-ink">Tap to reveal phrase</span>
            <span className="text-sm text-vendly-muted">Make sure no one is watching</span>
          </button>
        )}

        {/* Error message (passkey only) */}
        {error && (
          <div className="bg-vendly-tint border border-vendly-border rounded-xl p-4 text-center">
            <p className="text-vendly-ink text-sm">{error}</p>
          </div>
        )}

        {/* Mnemonic word grid (shared) */}
        {isRevealed && mnemonic && (
          <div className="bg-vendly-light border border-vendly-border rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-vendly-ink">Recovery Phrase</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleHide}
                  className="px-3 py-1.5 text-sm font-medium text-vendly-muted hover:text-vendly-ink border border-vendly-border rounded-lg hover:bg-vendly-tint transition-colors"
                >
                  Hide
                </button>
                <button
                  onClick={handleCopy}
                  className={`
                    px-3 py-1.5 text-sm font-medium rounded-lg transition-all
                    ${copied
                      ? 'bg-vendly-tint text-vendly-ink border border-vendly-border'
                      : 'bg-vendly-deep text-vendly-light hover:bg-vendly-deep'
                    }
                  `}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

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
        )}

        {/* No backup found (mnemonic mode only) */}
        {!isPasskey && !mnemonic && (
          <div className="bg-vendly-light border border-vendly-border rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-vendly-tint flex items-center justify-center mx-auto mb-4">
              <WarningIcon size="xl" className="text-vendly-ink" />
            </div>
            <h3 className="font-display font-semibold text-vendly-ink mb-2">No backup found</h3>
            <p className="text-vendly-muted text-sm">
              We could not find a recovery phrase for this account.
            </p>
          </div>
        )}
      </div>
    </div>
  </SlideInPage>
);
};

export default BackupPage;
