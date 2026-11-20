import React, { useState } from 'react';
import { useSecretTap } from '@/hooks/useSecretTap';
import BrandLogo from '@/components/BrandLogo';
import IllustrationImage from '@/components/IllustrationImage';

interface HomePageProps {
  onRestoreWallet: () => void;
  onCreateNewWallet: () => void;
  onUsePasskey: () => void;
  prfAvailable: boolean;
  passkeyUnavailableReason?: string;
  /** Present only in local development; never rendered in production builds. */
  onExploreDevMode?: () => void;
  /** False when VITE_BREEZ_API_KEY is not configured. */
  walletConfigured?: boolean;
}

const HomePage: React.FC<HomePageProps> = ({
  onRestoreWallet,
  onCreateNewWallet,
  onUsePasskey,
  prfAvailable,
  passkeyUnavailableReason,
  onExploreDevMode,
  walletConfigured = true,
}) => {
  const [showMnemonicFlow, setShowMnemonicFlow] = useState(false);
  const { handleTap: handleLogoTap } = useSecretTap(5, 2000, false, () => setShowMnemonicFlow(v => !v));

  return (
    <div className="h-full w-full flex flex-col bg-vendly-cream relative overflow-hidden">
      <div
        className="flex-1 flex flex-col items-center overflow-y-auto px-6"
        style={{
          paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))',
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="w-full max-w-md flex flex-col items-center my-auto py-4">
          <div className="mb-6">
            <BrandLogo className="h-10 w-auto" onClick={handleLogoTap} />
          </div>

          <IllustrationImage
            src="illustrations/local-merchant.svg"
            alt="A local merchant managing her market stall with Vendly"
            className="w-full max-w-[360px] h-auto mb-6"
          />

          <div className="text-center mb-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-vendly-green mb-3">
              Built for everyday business
            </p>
            <h1 className="font-display text-[2rem] sm:text-4xl font-bold text-vendly-ink tracking-tight leading-tight mb-3">
              Your business,
              <br />
              in your hands.
            </h1>
            <p className="text-sm sm:text-base text-vendly-muted leading-relaxed max-w-sm mx-auto">
              Sell, track your stock and receive payments with one simple tool made for Nigerian merchants.
            </p>
          </div>

          {!walletConfigured && (
            <div
              className="w-full mb-4 rounded-xl border border-vendly-border bg-vendly-light px-4 py-3 text-center"
              data-testid="wallet-config-note"
            >
              <p className="text-xs text-vendly-ink leading-relaxed">
                <span className="font-semibold">Wallet connection isn't configured.</span>{' '}
                Breez needs <code className="font-mono">VITE_BREEZ_API_KEY</code>. You can still
                set up passkey or recovery-phrase access, but payments stay off until it is added.
              </p>
              {import.meta.env.DEV && (
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 text-[11px] font-semibold text-vendly-deep underline underline-offset-4"
                  data-testid="reload-after-config-button"
                >
                  Added the key? Restart the dev server, then reload
                </button>
              )}
            </div>
          )}

          <div className="w-full space-y-3">
            {prfAvailable && !showMnemonicFlow ? (
              <>
                <button
                  onClick={onUsePasskey}
                  data-testid="create-wallet-passkey-button"
                  className="button w-full py-4 text-base"
                >
                  Continue with passkey
                </button>

                <button
                  onClick={() => setShowMnemonicFlow(true)}
                  className="w-full text-center py-2 text-xs font-medium text-vendly-muted hover:text-vendly-deep transition-colors"
                >
                  Use a recovery phrase instead
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onCreateNewWallet}
                  data-testid="create-wallet-button"
                  className="button w-full py-4 text-base"
                >
                  Create your business account
                </button>

                <button
                  onClick={onRestoreWallet}
                  data-testid="restore-wallet-button"
                  className="button-secondary w-full py-4 rounded-xl font-display font-semibold text-sm"
                >
                  I already have an account
                </button>

                {prfAvailable && (
                  <button
                    onClick={() => setShowMnemonicFlow(false)}
                    className="w-full text-center py-2 text-xs font-medium text-vendly-muted hover:text-vendly-deep transition-colors"
                  >
                    Continue with passkey instead
                  </button>
                )}

                {!prfAvailable && passkeyUnavailableReason && (
                  <p
                    className="text-[11px] text-vendly-muted text-center leading-relaxed pt-1"
                    data-testid="passkey-unavailable-note"
                  >
                    {passkeyUnavailableReason}
                  </p>
                )}
              </>
            )}
          </div>

          {onExploreDevMode && (
            <button
              onClick={onExploreDevMode}
              className="mt-5 w-full text-center py-2 text-xs font-semibold text-vendly-deep underline underline-offset-4 hover:text-vendly-ink transition-colors"
              data-testid="explore-dev-mode-button"
            >
              Explore Vendly without a wallet (development mode)
            </button>
          )}

          <div className="mt-8 flex items-center gap-2 text-[11px] text-vendly-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-vendly-green" />
            <span>Secure payments, built on Breez</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
