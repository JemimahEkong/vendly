/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_BREEZ_API_KEY: string;
  readonly VITE_STAGING_PASSWORD?: string;
  readonly VITE_CONSOLE_LOGGING?: 'true' | 'false';
  readonly VITE_PASSKEY_RP_ID?: string;
  readonly VITE_DEV_ACCESS?: 'true' | 'false';
  readonly VITE_BASE_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
