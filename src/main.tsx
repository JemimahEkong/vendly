import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { logger, LogCategory } from '@/services/logger';
import initBreezSDK from '@breeztech/breez-sdk-spark';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for offline support
registerSW({
  onOfflineReady() {
    console.log('Vendly ready to work offline');
  },
});

// Hide the initial splash screen - exported so App can call it when truly ready
export function hideSplash() {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('hidden');
    setTimeout(() => splash.remove(), 300);
  }
}

async function init() {
  try {
    logger.info(LogCategory.UI, 'Initializing application');
    // Initialize WASM module
    logger.info(LogCategory.SDK, 'Initializing WASM module');
    await initBreezSDK();
    logger.info(LogCategory.SDK, 'WASM module initialized successfully');

    // Render the app - splash stays visible until App signals it's ready
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <App />
    );
    logger.info(LogCategory.UI, 'Application initialized successfully');

    // Note: splash is now hidden by App.tsx when initial loading completes
  } catch (error) {
    logger.error(LogCategory.UI, 'Failed to initialize app', {
      error: error instanceof Error ? error.message : String(error),
    });
    hideSplash();
    document.getElementById('root')!.innerHTML = `
      <div style="color: #243329; padding: 24px; text-align: center; background: #F7F0D8; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; font-family: system-ui, sans-serif;">
        <h2 style="color: #173F2B;">Vendly could not start</h2>
        <p>There was a problem loading the app. Please refresh and try again.</p>
      </div>
    `;
  }
}

init();
