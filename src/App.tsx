import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff } from 'lucide-react';
import { WalletProvider } from './contexts/WalletContext';
import LoadingSpinner from './components/LoadingSpinner';
import PaymentReceivedCelebration from './components/PaymentReceivedCelebration';
import InstallPrompt from './components/InstallPrompt';
import StagingGate from './components/StagingGate';
import { ToastProvider, useToast } from './contexts/ToastContext';
import AppShell from './components/layout/AppShell';
import { useBreezSdk } from './hooks/useBreezSdk';
import { satsToNgnKobo } from './utils/formatCurrency';
import { getCurrentNgnPerBtc } from './services/exchangeRate';

import HomePage from './pages/HomePage';
import WalletPage from './pages/WalletPage';
import RestorePage from './pages/RestorePage';
import GeneratePage from './pages/GeneratePage';
import GetRefundPage from './pages/GetRefundPage';
import BackupPage from './pages/BackupPage';
import PasskeyPage from './pages/PasskeyPage';
import DevDashboardPage from './pages/DevDashboardPage';
import SettingsPage from './pages/SettingsPage';
import POSPage from './pages/POSPage';
import SalesPage from './pages/SalesPage';
import InventoryPage from './pages/InventoryPage';
import FiatCurrenciesPage from './pages/FiatCurrenciesPage';
import { ContactsProvider } from './contexts/ContactsContext';
import { useIOSViewportFix } from './hooks/useIOSViewportFix';
import type { Seed } from '@breeztech/breez-sdk-spark';
import {
  enterDevAccess,
  exitDevAccess,
  hasDevAccessSession,
  isDevAccessEnabled,
} from './services/devAccess';

type Screen = 'home' | 'restore' | 'generate' | 'wallet' | 'getRefund' | 'settings' | 'backup' | 'fiatCurrencies' | 'passkey' | 'pos' | 'sales' | 'inventory' | 'dev';

const OfflineBadge: React.FC = () => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      className="fixed right-3 z-[200] flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-vendly-light border border-vendly-border text-vendly-ink text-[11px] font-semibold shadow-sm pointer-events-none"
      style={{ top: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
    >
      <WifiOff size={11} />
      <span>Offline</span>
    </div>
  );
};

const AppContent: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>(() =>
    hasDevAccessSession() ? 'dev' : 'home',
  );
  const [devMode, setDevMode] = useState(() => hasDevAccessSession());
  const [refundAnimationDirection, setRefundAnimationDirection] = useState<'left' | 'up'>('left');
  const [passkeySdkConnected, setPasskeySdkConnected] = useState(false);
  const { showToast } = useToast();

  useIOSViewportFix();

  const sdk = useBreezSdk(showToast);
  const devAccessEnabled = isDevAccessEnabled();

  const enterDevelopmentMode = () => {
    enterDevAccess();
    setDevMode(true);
    setCurrentScreen('dev');
  };

  const leaveDevelopmentMode = () => {
    exitDevAccess();
    setDevMode(false);
    setCurrentScreen('home');
  };

  // Auto-navigate to wallet when SDK reconnects from saved mnemonic
  useEffect(() => {
    if (sdk.isConnected && currentScreen === 'home') {
      setCurrentScreen('wallet');
    }
  }, [sdk.isConnected, currentScreen]);

  // Navigate to wallet after successful connect
  const handleConnect = async (mnemonic: string, restore: boolean) => {
    await sdk.connectWallet({ type: 'mnemonic', mnemonic }, restore);
    setDevMode(false);
    exitDevAccess();
    setCurrentScreen('wallet');
  };

  // Navigate to wallet after passkey connect
  const handlePasskeyConnect = async (seed: Seed, label: string) => {
    // Errors propagate to PasskeyPage so it can show an actionable message and
    // retry without prompting for the passkey again.
    await sdk.connectWallet(seed, true, label);
    setPasskeySdkConnected(true);
  };

  const handlePasskeyFlowComplete = useCallback(() => {
    setPasskeySdkConnected(false);
    setDevMode(false);
    exitDevAccess();
    setCurrentScreen('wallet');
  }, []);

  const handleLogout = async () => {
    setCurrentScreen('home');
    setDevMode(false);
    exitDevAccess();
    await sdk.handleLogout();
  };

  // Render screens
  const renderCurrentScreen = () => {
    if (
      sdk.isLoading &&
      currentScreen !== 'restore' &&
      currentScreen !== 'passkey' &&
      currentScreen !== 'generate' &&
      currentScreen !== 'dev'
    ) {
      return (
        <div className="absolute inset-0 bg-vendly-cream z-50 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      );
    }

    switch (currentScreen) {
      case 'home':
        return (
          <HomePage
            onRestoreWallet={() => setCurrentScreen('restore')}
            onCreateNewWallet={() => setCurrentScreen('generate')}
            onUsePasskey={() => setCurrentScreen('passkey')}
            prfAvailable={sdk.prfAvailable}
            passkeyUnavailableReason={sdk.prfCapability?.message}
            walletConfigured={sdk.walletConfigured}
            onExploreDevMode={devAccessEnabled ? enterDevelopmentMode : undefined}
          />
        );

      case 'dev':
        return (
          <DevDashboardPage
            onExit={leaveDevelopmentMode}
            onOpenSales={() => setCurrentScreen('sales')}
            onOpenInventory={() => setCurrentScreen('inventory')}
            onConnectWallet={() => setCurrentScreen('home')}
          />
        );

      case 'passkey':
        return (
          <PasskeyPage
            onWalletRestored={handlePasskeyConnect}
            onBack={() => {
              setPasskeySdkConnected(false);
              setCurrentScreen('home');
            }}
            onUseRecoveryPhrase={() => setCurrentScreen('restore')}
            sdkConnected={passkeySdkConnected}
            onFlowComplete={handlePasskeyFlowComplete}
            capability={sdk.prfCapability}
          />
        );

      case 'getRefund':
        return (
          <GetRefundPage
            onBack={() => setCurrentScreen('wallet')}
            animationDirection={refundAnimationDirection}
          />
        );

      case 'settings':
        return (
          <SettingsPage
            onBack={() => setCurrentScreen('wallet')}
            config={sdk.config}
            onOpenFiatCurrencies={() => setCurrentScreen('fiatCurrencies')}
          />
        );

      case 'fiatCurrencies':
        return (
          <FiatCurrenciesPage onBack={() => setCurrentScreen('settings')} />
        );

      case 'backup':
        return (
          <BackupPage onBack={() => setCurrentScreen('wallet')} />
        );

      case 'pos':
        return (
          <POSPage onBack={() => setCurrentScreen('wallet')} />
        );

      case 'sales':
        return (
          <SalesPage onBack={() => setCurrentScreen(devMode ? 'dev' : 'wallet')} />
        );

      case 'inventory':
        return (
          <InventoryPage onBack={() => setCurrentScreen(devMode ? 'dev' : 'wallet')} />
      );

      case 'restore':
        return (
          <RestorePage
            onConnect={(mnemonic) => handleConnect(mnemonic, true)}
            onBack={() => setCurrentScreen('home')}
            onClearError={sdk.clearError}
            isLoading={sdk.isLoading}
          />
        );

      case 'generate':
        return (
          <GeneratePage
            onMnemonicConfirmed={(mnemonic) => handleConnect(mnemonic, false)}
            onBack={() => setCurrentScreen('home')}
            error={sdk.error}
            onClearError={sdk.clearError}
          />
        );

      case 'wallet':
        if (!sdk.isConnected) {
          return (
            <HomePage
              onRestoreWallet={() => setCurrentScreen('restore')}
              onCreateNewWallet={() => setCurrentScreen('generate')}
              onUsePasskey={() => setCurrentScreen('passkey')}
              prfAvailable={sdk.prfAvailable}
              passkeyUnavailableReason={sdk.prfCapability?.message}
              walletConfigured={sdk.walletConfigured}
              onExploreDevMode={devAccessEnabled ? enterDevelopmentMode : undefined}
            />
          );
        }
        return (
          <WalletPage
            walletInfo={sdk.walletInfo}
            transactions={sdk.transactions}
            unclaimedDeposits={sdk.unclaimedDeposits}
            fiatRates={sdk.fiatRates}
            fiatCurrencies={sdk.fiatCurrencies}
            refreshWalletData={sdk.refreshWalletData}
            isSyncing={sdk.isSyncing}
            error={sdk.error}
            onClearError={sdk.clearError}
            onLogout={handleLogout}
            hasRejectedDeposits={sdk.hasRejectedDeposits}
            onOpenGetRefund={(source?: 'menu' | 'icon') => {
              setRefundAnimationDirection(source === 'icon' ? 'up' : 'left');
              setCurrentScreen('getRefund');
            }}
            onOpenSettings={() => setCurrentScreen('settings')}
            onOpenBackup={() => setCurrentScreen('backup')}
            onOpenPOS={() => setCurrentScreen('pos')}
            onOpenSales={() => setCurrentScreen('sales')}
            onOpenInventory={() => setCurrentScreen('inventory')}
            onDepositChanged={sdk.fetchUnclaimedDeposits}
          />
        );

      default:
        return <div>Unknown screen</div>;
    }
  };

  return (
    <WalletProvider client={sdk.sdk}>
      <ContactsProvider>
        {renderCurrentScreen()}
      </ContactsProvider>
      {sdk.celebrationAmount !== null && (
        <PaymentReceivedCelebration
          amount={satsToNgnKobo(sdk.celebrationAmount, getCurrentNgnPerBtc() ?? 0)}
          items={[]}
          paymentMethod="lightning"
          paymentStatus="confirmed"
          btcAmount={sdk.celebrationAmount}
          exchangeRate={getCurrentNgnPerBtc() ?? undefined}
          onClose={sdk.dismissCelebration}
        />
      )}
      <InstallPrompt />
      <OfflineBadge />
      {devMode && (
        <div className="pointer-events-none fixed left-3 z-[200] flex items-center gap-1.5 rounded-full border border-vendly-border bg-vendly-deep px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-vendly-cream shadow-sm"
          style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
          data-testid="dev-mode-badge"
        >
          Dev mode · wallet off
        </div>
      )}
    </WalletProvider>
  );
};

function App() {
  return (
    <StagingGate>
      <AppShell>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AppShell>
    </StagingGate>
  );
}

export default App;
