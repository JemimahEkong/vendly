import React, { useEffect, useRef, useState } from 'react';
import { Seed, Wallet } from '@breeztech/breez-sdk-spark';
import { PrimaryButton, SecondaryButton, TextButton } from '../components/ui';
import LoadingSpinner from '../components/LoadingSpinner';
import PageLayout from '../components/layout/PageLayout';
import { AlertCard } from '../components/AlertCard';
import { NostrKeyIcon, CheckIcon, PasskeyIcon } from '../components/Icons';
import {
  createPasskey,
  getSavedPasskeyLabel,
  getWallet,
  listLabels,
  saveLabel,
} from '@/services/passkeyService';
import type { PrfCapability } from '@/services/passkeyPrfProvider';
import { classifyAuthError, getErrorDiagnostic, type AuthErrorInfo } from '@/services/authErrors';
import { logger, LogCategory } from '@/services/logger';
import StepperBar from '@/components/OnboardingStepper';

// ============================================
// Types
// ============================================

/**
 * Explicit, user-confirmed phase machine.
 *
 * Every WebAuthn prompt is triggered directly by a click handler — never by a
 * useEffect that fires after a state change. Browsers require (and vary in
 * how strictly they require) transient user activation for
 * navigator.credentials.create()/get(), so an indirect prompt is unreliable.
 *
 * Returning merchant:
 *   entry → (Sign in: prompt) checking → labels
 *   labels → (Continue: prompt) deriving → connecting
 *   labels → new label → (Continue: prompt) saving → ready
 *   ready → (Open my wallet: prompt) deriving → connecting
 *
 * New merchant:
 *   entry → create-review → (Create passkey: prompt) creating → name-label
 *   name-label → (Save label: prompt) saving → ready
 *   ready → (Open my wallet: prompt) deriving → connecting
 */
type Phase =
  | 'entry'
  | 'checking'
  | 'labels'
  | 'create-review'
  | 'creating'
  | 'name-label'
  | 'saving'
  | 'ready'
  | 'deriving'
  | 'connecting'
  | 'initializing';

interface PasskeyPageProps {
  onWalletRestored: (seed: Seed, label: string) => Promise<void>;
  onBack: () => void;
  onUseRecoveryPhrase: () => void;
  sdkConnected?: boolean;
  onFlowComplete?: () => void;
  capability?: PrfCapability | null;
}

function newUserStepIndex(phase: Phase): number {
  switch (phase) {
    case 'create-review':
    case 'creating':
      return 0;
    case 'name-label':
    case 'saving':
      return 1;
    case 'ready':
    case 'deriving':
    case 'connecting':
    case 'initializing':
      return 2;
    default:
      return 0;
  }
}

// ============================================
// Component
// ============================================

const PasskeyPage: React.FC<PasskeyPageProps> = ({
  onWalletRestored,
  onBack,
  onUseRecoveryPhrase,
  sdkConnected,
  onFlowComplete,
  capability,
}) => {
  const [phase, setPhase] = useState<Phase>('entry');
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [labels, setLabels] = useState<string[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [manualLabel, setManualLabel] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [error, setError] = useState<AuthErrorInfo | null>(null);
  const [discoveryWarning, setDiscoveryWarning] = useState<string | null>(null);
  const [labelAction, setLabelAction] = useState<'save' | 'derive'>('save');
  const [capabilityOverride, setCapabilityOverride] = useState<PrfCapability | null>(null);

  // Stable callbacks for async handlers
  const onWalletRestoredRef = useRef(onWalletRestored);
  onWalletRestoredRef.current = onWalletRestored;
  const onFlowCompleteRef = useRef(onFlowComplete);
  onFlowCompleteRef.current = onFlowComplete;

  // Label to use when deriving, and the wallet derived before SDK connection
  const connectLabelRef = useRef<string | undefined>(undefined);
  const derivedWalletRef = useRef<Wallet | null>(null);

  const effectiveCapability = capabilityOverride ?? capability;
  const passkeysUnsupported = !!effectiveCapability && !effectiveCapability.supported;

  // SDK finished connecting → leave the page
  useEffect(() => {
    if (sdkConnected && phase === 'initializing') {
      onFlowCompleteRef.current?.();
    }
  }, [sdkConnected, phase]);

  // ============================================
  // Helpers
  // ============================================

  const recordError = (e: unknown, context: 'detect' | 'create' | 'label' | 'derive' | 'sdk') => {
    const info = classifyAuthError(e, context);
    const diagnostic = getErrorDiagnostic(e);
    logger.error(LogCategory.AUTH, `Passkey ${context} failed`, {
      code: info.code,
      errorName: diagnostic.name,
      error: diagnostic.message,
    });
    setError(info);
    return info;
  };

  const mergeLabel = (label: string) => {
    setLabels((prev) => (prev.includes(label) ? prev : [...prev, label]));
    setSelectedLabel(label);
  };

  // ============================================
  // User-initiated actions (each click = at most one prompt)
  // ============================================

  const handleSignIn = async () => {
    setError(null);
    setDiscoveryWarning(null);
    setLabelAction('derive');
    setPhase('checking');
    try {
      const found = await listLabels();
      if (found.length === 0) {
        // The passkey exists, but no labels are published yet. Let the user
        // open the wallet with the label saved on this device (usually
        // "Default") instead of forcing a new registration.
        setShowManualInput(true);
        setManualLabel(getSavedPasskeyLabel() ?? 'Default');
        setSelectedLabel(null);
        setPhase('labels');
        return;
      }
      const sorted = [...found].reverse();
      setLabels(sorted);
      setShowManualInput(false);
      setSelectedLabel(sorted.includes('Default') ? 'Default' : sorted[0]);
      setPhase('labels');
    } catch (e) {
      // A cancelled prompt does NOT mean the user has no passkey. Label
      // discovery is a Nostr operation: if the relays are unreachable, the
      // passkey can still derive the wallet with the label this device saved.
      const info = recordError(e, 'detect');
      if (info.code === 'relay-unavailable') {
        // The passkey prompt succeeded; only label discovery failed. Keep the
        // user moving with the label this device last used.
        setError(null);
        setDiscoveryWarning(
          'Vendly could not reach the label service. You can still open the wallet saved on this device with its account label.',
        );
        setShowManualInput(true);
        setManualLabel(getSavedPasskeyLabel() ?? 'Default');
        setSelectedLabel(null);
        setPhase('labels');
        return;
      }
      setPhase('entry');
    }
  };

  const goToCreateReview = () => {
    setError(null);
    setIsNewAccount(true);
    setPhase('create-review');
  };

  const handleCreatePasskey = async () => {
    setError(null);
    setIsNewAccount(true);
    setPhase('creating');
    try {
      await createPasskey();
      connectLabelRef.current = 'Default';
      setManualLabel('Default');
      setShowManualInput(true);
      setPhase('name-label');
    } catch (e) {
      const info = recordError(e, 'create');
      if (info.code === 'prf-unsupported' || info.code === 'invalid-rp') {
        setCapabilityOverride({
          supported: false,
          verified: true,
          reason: info.code === 'prf-unsupported' ? 'no-prf' : 'invalid-rp',
          message: info.message,
        });
      }
      setPhase('create-review');
    }
  };

  const saveLabelAndAdvance = async (label: string, failurePhase: Phase) => {
    connectLabelRef.current = label;
    setError(null);
    setPhase('saving');
    try {
      await saveLabel(label);
      mergeLabel(label);
      setShowManualInput(false);
      setPhase('ready');
    } catch (e) {
      recordError(e, 'label');
      setPhase(failurePhase);
    }
  };

  const handleContinueFromLabels = async () => {
    const trimmed = manualLabel.trim();
    if (showManualInput) {
      if (!trimmed) return;
      const duplicate = labels.some((l) => l.toLowerCase() === trimmed.toLowerCase());
      if (duplicate && labelAction === 'save') return;

      if (labelAction === 'save') {
        await saveLabelAndAdvance(trimmed, 'labels');
        return;
      }

      // Derive with an already-existing label. No label is published here:
      // a returning user must not create a duplicate label just to sign in.
      connectLabelRef.current = trimmed;
      await handleOpenWallet();
      return;
    }
    if (!selectedLabel) return;
    connectLabelRef.current = selectedLabel;
    await handleOpenWallet();
  };

  const handleOpenWallet = async () => {
    if (!connectLabelRef.current) return;
    setError(null);
    setPhase('deriving');
    try {
      const wallet = await getWallet(connectLabelRef.current);
      derivedWalletRef.current = wallet;
      setPhase('connecting');
      await onWalletRestoredRef.current(wallet.seed, wallet.label);
      setPhase('initializing');
    } catch (e) {
      // If the wallet was derived, the failure came from the Breez connection.
      recordError(e, derivedWalletRef.current ? 'sdk' : 'derive');
      setPhase('ready');
    }
  };

  /** Retry only the Breez connection using the already-derived wallet (no prompt). */
  const handleReconnect = async () => {
    const wallet = derivedWalletRef.current;
    if (!wallet) {
      await handleOpenWallet();
      return;
    }
    setError(null);
    setPhase('connecting');
    try {
      await onWalletRestoredRef.current(wallet.seed, wallet.label);
      setPhase('initializing');
    } catch (e) {
      recordError(e, 'sdk');
      setPhase('ready');
    }
  };

  const goToEntry = () => {
    setError(null);
    setPhase('entry');
  };

  // ============================================
  // Render helpers
  // ============================================

  const renderEntry = () => (
    <>
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-2xl bg-vendly-tint flex items-center justify-center">
          <PasskeyIcon size="xl" className="text-vendly-deep" />
        </div>
      </div>

      <div className="text-center mb-4">
        <h2 className="text-xl font-display font-bold text-vendly-ink mb-2">
          Continue with passkey
        </h2>
        <p className="text-vendly-ink">
          Sign in with the passkey saved on this device, or create a new one for this business
          account.
        </p>
      </div>

      {passkeysUnsupported && (
        <AlertCard variant="warning" title="Passkeys unavailable on this device">
          <p className="text-vendly-ink text-sm">
            {effectiveCapability?.message ??
              'This browser or device cannot create the type of passkey Vendly needs.'}
          </p>
          <p className="text-vendly-ink text-sm mt-2">
            You can still create or restore your account with a recovery phrase.
          </p>
        </AlertCard>
      )}

      <div className="flex-1" />
    </>
  );

  const renderCreateReview = () => (
    <>
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-2xl bg-vendly-tint flex items-center justify-center">
          <PasskeyIcon size="xl" className="text-vendly-deep" />
        </div>
      </div>

      <div className="text-center mb-4">
        <h2 className="text-xl font-display font-bold text-vendly-ink mb-2">
          Create your passkey
        </h2>
        <p className="text-vendly-ink">
          Create a passkey on this device to protect your business account.
        </p>
      </div>

      <AlertCard variant="warning" title="Your passkey protects your account">
        <p className="text-vendly-ink text-sm">
          If you remove this passkey from your device, browser or password manager, you may lose
          access to your account.
        </p>
      </AlertCard>

      <div className="flex-1" />
    </>
  );

  const renderNameLabel = () => (
    <>
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-2xl bg-vendly-tint flex items-center justify-center">
          <NostrKeyIcon size="xl" className="text-vendly-deep" />
        </div>
      </div>

      <div className="text-center mb-4">
        <h2 className="text-xl font-display font-bold text-vendly-ink mb-2">
          Name this account
        </h2>
        <p className="text-vendly-ink text-sm">
          Vendly saves this label to Nostr so you can find the account again on another device.
        </p>
      </div>

      <div className="w-full p-4 rounded-2xl border bg-vendly-light border-vendly-deep">
        <label className="text-sm font-medium text-vendly-ink block mb-2" htmlFor="passkey-label">
          Account label
        </label>
        <input
          id="passkey-label"
          type="text"
          value={manualLabel}
          onChange={(e) => {
            const val = e.target.value;
            if (/^[a-zA-Z0-9 ]*$/.test(val) && val.length <= 24) {
              setManualLabel(val);
            }
          }}
          placeholder="Label name"
          maxLength={24}
          className="w-full bg-vendly-light border border-vendly-border rounded-xl px-3 py-2 text-vendly-ink placeholder:text-vendly-muted focus:outline-none focus:ring-2 focus:ring-vendly-deep/50 focus:border-vendly-deep text-sm"
          data-testid="passkey-label-input"
        />
        <p className="text-vendly-muted text-xs mt-2">
          You can keep the default name if this is your only account.
        </p>
      </div>

      <div className="flex-1" />
    </>
  );

  const renderLabelPicker = () => {
    const trimmedManual = manualLabel.trim();
    const isDuplicate = trimmedManual
      ? labels.some((l) => l.toLowerCase() === trimmedManual.toLowerCase())
      : false;

    return (
      <>
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-vendly-tint flex items-center justify-center">
            <NostrKeyIcon size="xl" className="text-vendly-deep" />
          </div>
        </div>

        <div className="text-center mb-4">
          <h2 className="text-xl font-display font-bold text-vendly-ink mb-2">
            Select a label
          </h2>
          <p className="text-vendly-ink text-sm">
            Choose a label for this business account, or create a new one.
          </p>
        </div>

        {discoveryWarning && (
          <AlertCard variant="info" title="Labels unavailable">
            <p className="text-vendly-ink text-sm">{discoveryWarning}</p>
          </AlertCard>
        )}

        <div className="space-y-2">
          {labels.map((label) => (
            <button
              key={label}
              onClick={() => {
                setSelectedLabel(label);
                setManualLabel('');
                setShowManualInput(false);
                setError(null);
              }}
              className={`
                w-full p-4 rounded-2xl border text-left transition-all
                ${selectedLabel === label && !showManualInput
                  ? 'bg-vendly-tint border-vendly-deep'
                  : 'bg-vendly-light border-vendly-border hover:border-vendly-green'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <span className="font-display font-medium text-vendly-ink">{label}</span>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    selectedLabel === label && !showManualInput ? 'bg-vendly-deep' : 'bg-transparent'
                  }`}
                >
                  {selectedLabel === label && !showManualInput && (
                    <CheckIcon size="sm" className="text-vendly-light" />
                  )}
                </div>
              </div>
            </button>
          ))}

          {!showManualInput ? (
            <button
              type="button"
              onClick={() => {
                setShowManualInput(true);
                setManualLabel('');
                setLabelAction('save');
                setError(null);
              }}
              className="w-full p-4 rounded-2xl border bg-vendly-light border-vendly-border hover:border-vendly-green text-left transition-all"
            >
              <span className="text-sm font-medium text-vendly-ink">Create a new label...</span>
            </button>
          ) : (
            <div className="w-full p-4 rounded-2xl border transition-all bg-vendly-light border-vendly-deep">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-vendly-ink">
                  {labelAction === 'derive' ? 'Account label' : 'Create a new label'}
                </span>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    trimmedManual && !isDuplicate ? 'bg-vendly-deep' : 'bg-transparent'
                  }`}
                >
                  {trimmedManual && !isDuplicate && (
                    <CheckIcon size="sm" className="text-vendly-light" />
                  )}
                </div>
              </div>
              <input
                type="text"
                value={manualLabel}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^[a-zA-Z0-9 ]*$/.test(val) && val.length <= 24) {
                    setManualLabel(val);
                  }
                }}
                placeholder="Label name"
                maxLength={24}
                className="w-full bg-vendly-light border border-vendly-border rounded-xl px-3 py-2 text-vendly-ink placeholder:text-vendly-muted focus:outline-none focus:ring-2 focus:ring-vendly-deep/50 focus:border-vendly-deep text-sm"
                data-testid="new-passkey-label-input"
              />
              {isDuplicate && labelAction === 'save' && (
                <p className="text-vendly-ink text-xs mt-1">
                  A label with this name already exists
                </p>
              )}
              {labelAction === 'derive' && (
                <p className="text-vendly-muted text-xs mt-1">
                  Use the label this passkey used when its wallet was created.
                </p>
              )}
            </div>
          )}
        </div>
      </>
    );
  };

  const renderReady = () => (
    <>
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-2xl bg-vendly-tint flex items-center justify-center">
          <PasskeyIcon size="xl" className="text-vendly-deep" />
        </div>
      </div>

      <div className="text-center mb-2">
        <h2 className="text-xl font-display font-bold text-vendly-ink mb-2">
          Passkey ready
        </h2>
        <p className="text-vendly-ink text-sm">
          Open your wallet to finish setting up this business account. Your device may ask you to
          confirm your passkey once more.
        </p>
      </div>

      <div className="flex-1" />
    </>
  );

  const renderSpinner = (text: string) => (
    <div className="flex flex-col items-center justify-center py-16 text-vendly-ink">
      <LoadingSpinner text={text} />
    </div>
  );

  const content = (() => {
    switch (phase) {
      case 'entry':
        return renderEntry();
      case 'checking':
        return renderSpinner('Waiting for your passkey...');
      case 'labels':
        return renderLabelPicker();
      case 'create-review':
        return renderCreateReview();
      case 'creating':
        return renderSpinner('Creating your passkey...');
      case 'name-label':
        return renderNameLabel();
      case 'saving':
        return renderSpinner('Saving account label...');
      case 'ready':
        return renderReady();
      case 'deriving':
        return renderSpinner('Unlocking your wallet...');
      case 'connecting':
        return renderSpinner('Connecting to the wallet service...');
      case 'initializing':
        return renderSpinner('Starting Vendly...');
    }
  })();

  // ============================================
  // Footer
  // ============================================

  const trimmedManual = manualLabel.trim();
  const isDuplicate = trimmedManual
    ? labels.some((l) => l.toLowerCase() === trimmedManual.toLowerCase())
    : false;
  const canContinueFromLabels = showManualInput
    ? !!trimmedManual && !(isDuplicate && labelAction === 'save')
    : !!selectedLabel;

  const footer = (() => {
    if (passkeysUnsupported && phase === 'entry') {
      return (
        <div className="max-w-xl mx-auto space-y-3">
          <PrimaryButton className="w-full" onClick={onUseRecoveryPhrase}>
            Use a recovery phrase
          </PrimaryButton>
          <SecondaryButton className="w-full" onClick={onBack}>
            Go Back
          </SecondaryButton>
        </div>
      );
    }

    if (phase === 'entry') {
      return (
        <div className="max-w-xl mx-auto space-y-3">
          <PrimaryButton
            className="w-full"
            onClick={handleSignIn}
            data-testid="passkey-signin-button"
          >
            Sign in with passkey
          </PrimaryButton>
          <SecondaryButton
            className="w-full"
            onClick={goToCreateReview}
            data-testid="passkey-create-button"
          >
            Create a new passkey
          </SecondaryButton>
          <div className="text-center pt-1">
            <TextButton onClick={onUseRecoveryPhrase} data-testid="passkey-recovery-button">
              Use a recovery phrase instead
            </TextButton>
          </div>
        </div>
      );
    }

    if (phase === 'create-review') {
      if (passkeysUnsupported) {
        return (
          <div className="max-w-xl mx-auto space-y-3">
            <PrimaryButton className="w-full" onClick={onUseRecoveryPhrase}>
              Use a recovery phrase
            </PrimaryButton>
            <SecondaryButton className="w-full" onClick={goToEntry}>
              Go Back
            </SecondaryButton>
          </div>
        );
      }
      return (
        <div className="max-w-xl mx-auto space-y-3">
          <PrimaryButton
            className="w-full"
            onClick={handleCreatePasskey}
            data-testid="passkey-create-confirm-button"
          >
            Create passkey
          </PrimaryButton>
          <SecondaryButton className="w-full" onClick={goToEntry}>
            Go Back
          </SecondaryButton>
        </div>
      );
    }

    if (phase === 'name-label') {
      return (
        <div className="max-w-xl mx-auto space-y-3">
          <PrimaryButton
            className="w-full"
            disabled={!trimmedManual}
            onClick={() => saveLabelAndAdvance(trimmedManual, 'name-label')}
            data-testid="passkey-save-label-button"
          >
            Save account label
          </PrimaryButton>
          <SecondaryButton
            className="w-full"
            onClick={() => {
              connectLabelRef.current = 'Default';
              setError(null);
              setPhase('ready');
            }}
          >
            Skip for now
          </SecondaryButton>
        </div>
      );
    }

    if (phase === 'labels') {
      return (
        <div className="max-w-xl mx-auto space-y-3">
          <PrimaryButton
            className="w-full"
            disabled={!canContinueFromLabels}
            onClick={handleContinueFromLabels}
            data-testid="passkey-continue-button"
          >
            Continue
          </PrimaryButton>
          <SecondaryButton className="w-full" onClick={goToEntry}>
            Go Back
          </SecondaryButton>
        </div>
      );
    }

    if (phase === 'ready') {
      const retryingConnection = !!error && !!derivedWalletRef.current;
      return (
        <div className="max-w-xl mx-auto space-y-3">
          <PrimaryButton
            className="w-full"
            onClick={retryingConnection ? handleReconnect : handleOpenWallet}
            data-testid="passkey-open-wallet-button"
          >
            {retryingConnection ? 'Try again' : 'Open my wallet'}
          </PrimaryButton>
          <div className="text-center pt-1">
            <TextButton onClick={onUseRecoveryPhrase}>
              Use a recovery phrase instead
            </TextButton>
          </div>
        </div>
      );
    }

    return null;
  })();

  // ============================================
  // Layout
  // ============================================

  return (
    <PageLayout onBack={onBack} footer={footer} title={isNewAccount ? 'Create account' : 'Sign in'}>
      <div className="max-w-xl mx-auto w-full flex flex-col min-h-full">
        {isNewAccount && (
          <StepperBar stepCount={3} activeIndex={newUserStepIndex(phase)} />
        )}
        <div className="mt-6 space-y-4 flex flex-col flex-1">
          {content}
          {error && (
            <AlertCard variant={error.code === 'cancelled' ? 'info' : 'error'} title={error.title}>
              <p className="text-vendly-ink text-sm">{error.message}</p>
              {error.useRecoveryPhrase && (
                <div className="mt-3">
                  <TextButton onClick={onUseRecoveryPhrase}>
                    Create or restore with a recovery phrase
                  </TextButton>
                </div>
              )}
            </AlertCard>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default PasskeyPage;
