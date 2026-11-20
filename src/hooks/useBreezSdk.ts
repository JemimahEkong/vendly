import { useEffect, useState, useCallback, useRef } from 'react';
import type {
  BreezSdk,
  Config,
  GetInfoResponse,
  Payment,
  SdkEvent,
  Rate,
  FiatCurrency,
  DepositInfo,
  LogEntry,
  Seed,
} from '@breeztech/breez-sdk-spark';
import { connect, initLogging } from '@breeztech/breez-sdk-spark';
import { useLatest } from './useLatest';
import { buildConnectConfig } from './buildConnectConfig';
import { logger, LogCategory, logSdkMessage } from '../services/logger';
import { formatError } from '../utils/formatError';
import { isDepositRejected } from '../services/depositState';
import { hideSplash } from '../main';
import {
  getPasskeyCapability,
  setPasskeyMode,
  clearPasskeyMode,
} from '../services/passkeyService';
import type { PrfCapability } from '../services/passkeyPrfProvider';
import { clearMnemonic, loadMnemonic, saveMnemonic } from '../services/walletStorage';
import { classifyAuthError, getErrorDiagnostic } from '../services/authErrors';
import { hasBreezApiKey, getBreezConfigDiagnostic } from '../services/breezConfig';


// ============================================
// SDK logging (initialized once)
// ============================================

let sdkLoggerInitialized = false;

function initSdkLogging() {
  if (sdkLoggerInitialized) return;
  sdkLoggerInitialized = true;
  initLogging({ log: (entry: LogEntry) => logSdkMessage(entry.level, entry.line) });
}

// ============================================
// Types
// ============================================


export interface BreezSdkState {
  sdk: BreezSdk | null;
  isConnected: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  walletInfo: GetInfoResponse | null;
  transactions: Payment[];
  unclaimedDeposits: DepositInfo[];
  fiatRates: Rate[];
  fiatCurrencies: FiatCurrency[];
  config: Config | null;
  error: string | null;
  hasRejectedDeposits: boolean;
  celebrationAmount: number | null;
  prfAvailable: boolean;
  prfCapability: PrfCapability | null;
  /** True when VITE_BREEZ_API_KEY is present in this build. */
  walletConfigured: boolean;
}

export interface BreezSdkActions {
  connectWallet: (seed: Seed, restore: boolean, passkeyLabel?: string) => Promise<void>;
  refreshWalletData: (showLoading?: boolean) => Promise<void>;
  fetchUnclaimedDeposits: () => Promise<void>;
  handleLogout: () => Promise<void>;
  clearError: () => void;
  dismissCelebration: () => void;
}

// ============================================
// Hook
// ============================================

export function useBreezSdk(
  showToast: (type: 'success' | 'error' | 'info', title: string, message?: string) => void,
): BreezSdkState & BreezSdkActions {
  // Core state
  const [sdk, setSdk] = useState<BreezSdk | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [walletInfo, setWalletInfo] = useState<GetInfoResponse | null>(null);
  const [transactions, setTransactions] = useState<Payment[]>([]);
  const [unclaimedDeposits, setUnclaimedDeposits] = useState<DepositInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fiatRates, setFiatRates] = useState<Rate[]>([]);
  const [fiatCurrencies, setFiatCurrencies] = useState<FiatCurrency[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [hasRejectedDeposits, setHasRejectedDeposits] = useState(false);
  const [celebrationAmount, setCelebrationAmount] = useState<number | null>(null);
  const [prfAvailable, setPrfAvailable] = useState(false);
  const [prfCapability, setPrfCapability] = useState<PrfCapability | null>(null);
  const walletConfigured = hasBreezApiKey();

  // Refs
  const isInitialLoadRef = useRef(true);
  const connectingRef = useRef(false);
  const eventListenerIdRef = useRef<string | null>(null);
  const shownPaymentIdsRef = useRef<Set<string>>(new Set());
  const sdkRef = useLatest(sdk);

  // Stable refs for callbacks used in event handler
  const showToastRef = useLatest(showToast);
  const isSyncingRef = useLatest(isSyncing);

  // ----------------------------------------
  // Data fetching (uses sdkRef for latest SDK)
  // ----------------------------------------

  const refreshWalletData = useCallback(async (showLoading = true) => {
    const s = sdkRef.current;
    if (!s) return;
    try {
      if (showLoading) setIsLoading(true);
      const [info, txns] = await Promise.all([
        s.getInfo({}),
        s.listPayments({ offset: 0, limit: 100 }),
      ]);
      setWalletInfo(info);
      setTransactions(txns.payments);
    } catch (e) {
      logger.error(LogCategory.SDK, 'Error refreshing wallet data', { error: formatError(e) });
      setError('Failed to refresh wallet data.');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [sdkRef]);

  const fetchUnclaimedDeposits = useCallback(async () => {
    const s = sdkRef.current;
    if (!s) return;
    try {
      const result = await s.listUnclaimedDeposits({});
      const deposits = result.deposits;
      setUnclaimedDeposits(deposits);
      setHasRejectedDeposits(deposits.some(d => isDepositRejected(d.txid, d.vout)));
    } catch (e) {
      logger.warn(LogCategory.SDK, 'Failed to fetch unclaimed deposits', { error: formatError(e) });
      setUnclaimedDeposits([]);
      setHasRejectedDeposits(false);
    }
  }, [sdkRef]);

  const fetchFiatData = useCallback(async () => {
    const s = sdkRef.current;
    if (!s) return;
    try {
      const [ratesResult, currenciesResult] = await Promise.all([
        s.listFiatRates(),
        s.listFiatCurrencies(),
      ]);
      setFiatRates(ratesResult.rates);
      setFiatCurrencies(currenciesResult.currencies);
    } catch (e) {
      logger.warn(LogCategory.SDK, 'Failed to fetch fiat data', { error: formatError(e) });
    }
  }, [sdkRef]);

  // ----------------------------------------
  // SDK event handler
  // ----------------------------------------

  const handleSdkEvent = useCallback((event: SdkEvent) => {
    logger.debug(LogCategory.SDK, 'SDK event received', { eventType: event.type });

    if (event.type === 'synced') {
      if (isSyncingRef.current) {
        logger.info(LogCategory.SESSION, 'Restoration sync complete; hiding overlay');
        setIsSyncing(false);
      }
      document.body.setAttribute('data-wallet-synced', 'true');
      refreshWalletData(false);
      fetchUnclaimedDeposits();
    } else if (event.type === 'paymentSucceeded') {
  const payment = event.payment as Payment & {
  metadata?: { source?: string };
};

  const paymentId = payment.id;

  if (!shownPaymentIdsRef.current.has(paymentId)) {
    shownPaymentIdsRef.current.add(paymentId);

    setTimeout(() => {
      shownPaymentIdsRef.current.delete(paymentId);
    }, 30000);

    const isReceived = payment.paymentType === 'receive';
    const amountSats = Number(payment.amount);

    if (isReceived) {
      setCelebrationAmount(amountSats);
    }

    if (payment.metadata?.source === 'pos') {
      window.dispatchEvent(
        new CustomEvent('pos-payment-settled', {
          detail: payment,
        })
      );
    }
  }

  refreshWalletData(false);
} else if (event.type === 'claimedDeposits') {
      logger.info(LogCategory.PAYMENT, 'Deposits claimed', { count: event.claimedDeposits.length });
      showToastRef.current('success', 'Deposits Claimed Successfully', `${event.claimedDeposits.length} deposits were claimed`);
      refreshWalletData(false);
      fetchUnclaimedDeposits();
    } else if (event.type === 'unclaimedDeposits') {
      logger.warn(LogCategory.PAYMENT, 'Claim deposits failed', { remaining: event.unclaimedDeposits.length });
      showToastRef.current('error', 'Failed to Claim Deposits', `${event.unclaimedDeposits.length} deposits could not be claimed`);
      fetchUnclaimedDeposits();
    }
  }, [refreshWalletData, fetchUnclaimedDeposits, isSyncingRef, showToastRef]);

  // ----------------------------------------
  // Connection lifecycle
  // ----------------------------------------

  const connectWallet = useCallback(async (seed: Seed, restore: boolean, passkeyLabel?: string) => {
    let connectedSdk: BreezSdk | undefined;
    try {
      logger.info(LogCategory.SDK, 'Initiating wallet connection', { restore });
      if (sdk) {
        logger.debug(LogCategory.SDK, 'Wallet already connected; skipping');
        return;
      }
      if (connectingRef.current) {
        logger.warn(LogCategory.SDK, 'Wallet connection already in progress; skipping duplicate');
        return;
      }

      // The config builder trims the key and throws a distinct missing-key
      // error before any SDK instance is created.
      logger.info(LogCategory.SDK, 'Breez configuration checked', getBreezConfigDiagnostic());
      connectingRef.current = true;
      setIsLoading(true);
      setIsSyncing(restore);
      setError(null);

      initSdkLogging();

      const cfg = buildConnectConfig();
      setConfig(cfg);

      connectedSdk = await connect({
        config: cfg,
        seed,
        storageDir: 'spark-wallet-example',
      });
      setSdk(connectedSdk);

      logger.sdkInitialized();
      logger.authSuccess(seed.type);
      logger.info(LogCategory.SDK, 'Wallet connected successfully');

      if (passkeyLabel != null) {
        setPasskeyMode(passkeyLabel);
      } else if (seed.type === 'mnemonic') {
        // Encrypted at rest with a non-extractable key; never plaintext.
        await saveMnemonic(seed.mnemonic);
      }

      const [info, txns] = await Promise.all([
        connectedSdk.getInfo({}),
        connectedSdk.listPayments({ offset: 0, limit: 100 }),
      ]);
      setWalletInfo(info);
      setTransactions(txns.payments);

      setIsConnected(true);

      try {
        const result = await connectedSdk.listUnclaimedDeposits({});
        const deposits = result.deposits;
        setUnclaimedDeposits(deposits);
        setHasRejectedDeposits(deposits.some(d => isDepositRejected(d.txid, d.vout)));
      } catch (e) {
        logger.warn(LogCategory.SDK, 'Failed to fetch unclaimed deposits', { error: formatError(e) });
      }

      setIsLoading(false);
    } catch (e) {
      const errorMsg = formatError(e);
      logger.error(LogCategory.SDK, 'Error connecting wallet', { error: errorMsg });
      logger.authFailure(seed.type, errorMsg);

      // If SDK connected but a subsequent step failed, disconnect to avoid leaked instance
      if (connectedSdk) {
        try { await connectedSdk.disconnect(); } catch { /* best-effort cleanup */ }
        setSdk(null);
      }

      setError(classifyAuthError(e, 'sdk').message);
      setIsSyncing(false);
      setIsLoading(false);
      setConfig(null);
      throw e;
    } finally {
      connectingRef.current = false;
    }
  }, [sdk]);

  const handleLogout = useCallback(async () => {
    setIsLoading(true);
    try {
      if (sdk) {
        await sdk.disconnect();
      }
    } catch (e) {
      logger.error(LogCategory.SDK, 'SDK disconnect failed', { error: formatError(e) });
    }
    try {
      await logger.endSession();
    } catch (e) {
      logger.warn(LogCategory.SESSION, 'Failed to end log session', { error: formatError(e) });
    }

    // Always reset all state — even if disconnect threw
    setSdk(null);
    await clearMnemonic();
    clearPasskeyMode();
    shownPaymentIdsRef.current.clear();
    setIsConnected(false);
    setIsSyncing(false);
    setWalletInfo(null);
    setTransactions([]);
    setUnclaimedDeposits([]);
    setFiatRates([]);
    setFiatCurrencies([]);
    setConfig(null);
    setError(null);
    setHasRejectedDeposits(false);
    setCelebrationAmount(null);
    setIsLoading(false);
    showToast('success', 'Successfully logged out');
  }, [sdk, showToast]);

  // ----------------------------------------
  // Effects
  // ----------------------------------------

  // LNURL domain body attribute
  useEffect(() => {
    const lnurlEnabled = config?.lnurlDomain ? 'true' : 'false';
    document.body.setAttribute('data-lnurl-enabled', lnurlEnabled);
    return () => { document.body.setAttribute('data-lnurl-enabled', 'false'); };
  }, [config?.lnurlDomain]);

  // Check passkey/PRF capability on mount (no WebAuthn prompt)
  useEffect(() => {
    getPasskeyCapability()
      .then((capability) => {
        setPrfCapability(capability);
        setPrfAvailable(capability.supported);
      })
      .catch((e) => {
        logger.warn(LogCategory.AUTH, 'Passkey capability detection failed', {
          error: formatError(e),
        });
        setPrfAvailable(false);
      });
  }, []);

  // Auto-reconnect on mount
  useEffect(() => {
    logger.initSession().catch((e) => {
      logger.warn(LogCategory.SESSION, 'Failed to initialize log session', { error: formatError(e) });
    });

    const checkForExistingWallet = async () => {
      const savedMnemonic = await loadMnemonic();
      if (savedMnemonic) {
        try {
          setIsLoading(true);
          await connectWallet({ type: 'mnemonic', mnemonic: savedMnemonic }, false);
        } catch (e) {
          logger.error(LogCategory.SDK, 'Failed to connect with stored wallet', { error: formatError(e) });
          setError(classifyAuthError(e, 'sdk').message);

          // A missing key, offline network or relay error must not destroy the
          // encrypted backup. Only a genuinely invalid phrase is discarded.
          const message = getErrorDiagnostic(e).message;
          if (/invalid (mnemonic|seed|phrase)|checksum|unknown word|entropy/i.test(message)) {
            await clearMnemonic();
          }
          setIsLoading(false);
        }
      } else {
        // Passkey sessions are intentionally NOT auto-authenticated on load:
        // WebAuthn prompts must follow an explicit user action, and a failed
        // prompt must never be mistaken for a missing passkey.
        setIsLoading(false);
      }

      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        hideSplash();
      }
    };

    checkForExistingWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only initialization
  }, []);

  // Event listener lifecycle
  useEffect(() => {
    if (isConnected && sdk) {
      sdk.addEventListener({ onEvent: handleSdkEvent })
        .then(id => {
          eventListenerIdRef.current = id;
          logger.debug(LogCategory.SDK, 'Registered wallet event listener', { listenerId: id });
        })
        .catch(e => {
          logger.error(LogCategory.SDK, 'Failed to add wallet event listener', { error: formatError(e) });
          setError('Failed to set up event listeners.');
        });

      return () => {
        if (eventListenerIdRef.current) {
          sdk.removeEventListener(eventListenerIdRef.current).catch(e => {
            logger.error(LogCategory.SDK, 'Error removing wallet event listener', { error: formatError(e) });
          });
          eventListenerIdRef.current = null;
        }
      };
    }
  }, [isConnected, sdk, handleSdkEvent]);

  // Periodic fiat rate fetching
  useEffect(() => {
    if (isConnected) {
      fetchFiatData();
      const interval = setInterval(fetchFiatData, 60000);
      return () => clearInterval(interval);
    }
  }, [isConnected, fetchFiatData]);

  return {
    // State
    sdk,
    isConnected,
    isLoading,
    isSyncing,
    walletInfo,
    transactions,
    unclaimedDeposits,
    fiatRates,
    fiatCurrencies,
    config,
    error,
    hasRejectedDeposits,
    celebrationAmount,
    prfAvailable,
    prfCapability,
    walletConfigured,
    // Actions
    connectWallet,
    refreshWalletData,
    fetchUnclaimedDeposits,
    handleLogout,
    clearError: () => setError(null),
    dismissCelebration: () => setCelebrationAmount(null),
  };
}
