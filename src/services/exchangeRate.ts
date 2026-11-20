/**
 * BTC/NGN exchange rate service
 *
 * Sources (tried in order):
 * 1. CoinGecko simple price — returns BTC priced directly in NGN.
 *    https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=ngn,usd
 * 2. Coinbase BTC/USD spot × open.er-api.com USD/NGN.
 * 3. Binance BTC/USDT × open.er-api.com USD/NGN.
 *
 * Rules:
 * - One consistent unit: NGN per full BTC.
 * - Integer kobo math for all NGN amounts (1 NGN = 100 kobo).
 * - No hardcoded or invented fallback rates. If every provider fails and the
 *   cache is older than MAX_CACHE_AGE_MS, return null so callers block
 *   Lightning invoices instead of quoting a made-up price.
 * - A cached rate is used for at most MAX_CACHE_AGE_MS and is always labelled
 *   with its age/source so it is never presented as live.
 */

export interface BtcNgRateInfo {
  /** NGN per 1 BTC. */
  rate: number;
  /** When this rate was fetched (ms since epoch). */
  timestamp: number;
  /** Human-readable provider name. */
  source: string;
  /** True when the rate came from cache and is older than FRESH_TTL_MS. */
  stale: boolean;
}

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=ngn,usd&precision=full';
const COINBASE_URL = 'https://api.coinbase.com/v2/prices/BTC-USD/spot';
const BINANCE_URL = 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT';
const FX_URL = 'https://open.er-api.com/v6/latest/USD';

/** Do not refetch before this age. */
const FRESH_TTL_MS = 5 * 60 * 1000;
/** Never quote a cached rate older than this. */
export const MAX_CACHE_AGE_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

const RATE_KEY = 'vendly_exchange_rate';
const RATE_TS_KEY = 'vendly_exchange_rate_ts';
const RATE_SOURCE_KEY = 'vendly_exchange_rate_source';

interface CoinGeckoResponse {
  bitcoin?: { ngn?: number; usd?: number };
}

interface CoinbaseResponse {
  data?: { amount?: string };
}

interface BinanceResponse {
  price?: string;
}

interface FxResponse {
  rates?: { NGN?: number };
}

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full/disabled — the in-memory rate still works for this session.
  }
}

function loadCachedInfo(): BtcNgRateInfo | null {
  const rawRate = readStorage(RATE_KEY);
  const rawTs = readStorage(RATE_TS_KEY);
  if (!rawRate || !rawTs) return null;

  const rate = parseFloat(rawRate);
  const timestamp = parseInt(rawTs, 10);
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }
  if (Date.now() - timestamp > MAX_CACHE_AGE_MS) return null;

  return {
    rate,
    timestamp,
    source: readStorage(RATE_SOURCE_KEY) || 'Cached rate',
    stale: Date.now() - timestamp >= FRESH_TTL_MS,
  };
}

let cachedRateInfo: BtcNgRateInfo | null = loadCachedInfo();

function storeRate(rate: number, source: string): BtcNgRateInfo {
  const info: BtcNgRateInfo = {
    rate,
    timestamp: Date.now(),
    source,
    stale: false,
  };
  cachedRateInfo = info;
  writeStorage(RATE_KEY, String(rate));
  writeStorage(RATE_TS_KEY, String(info.timestamp));
  writeStorage(RATE_SOURCE_KEY, source);
  return info;
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Request to ${url} failed: ${response.status}`);
  }
  return response.json();
}

function isUsableRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

async function fetchFromCoinGecko(signal: AbortSignal): Promise<{ rate: number; source: string }> {
  const data = (await fetchJson(COINGECKO_URL, signal)) as CoinGeckoResponse;
  const ngn = data?.bitcoin?.ngn;
  if (!isUsableRate(ngn)) throw new Error('CoinGecko did not return a BTC/NGN rate');
  return { rate: ngn, source: 'CoinGecko' };
}

async function fetchUsdPerBtc(
  signal: AbortSignal
): Promise<{ usd: number; source: string }> {
  // Coinbase first; Binance is a second independent USD-quote source.
  try {
    const data = (await fetchJson(COINBASE_URL, signal)) as CoinbaseResponse;
    const usd = Number(data?.data?.amount);
    if (!isUsableRate(usd)) throw new Error('Coinbase returned no BTC/USD price');
    return { usd, source: 'Coinbase' };
  } catch (coinbaseError) {
    if (signal.aborted) throw coinbaseError;
    const data = (await fetchJson(BINANCE_URL, signal)) as BinanceResponse;
    const usd = Number(data?.price);
    if (!isUsableRate(usd)) throw new Error('Binance returned no BTC/USDT price');
    return { usd, source: 'Binance' };
  }
}

async function fetchUsdNgn(signal: AbortSignal): Promise<number> {
  const data = (await fetchJson(FX_URL, signal)) as FxResponse;
  const ngn = data?.rates?.NGN;
  if (!isUsableRate(ngn)) throw new Error('FX provider returned no USD/NGN rate');
  return ngn;
}

async function fetchFromUsdSources(
  signal: AbortSignal
): Promise<{ rate: number; source: string }> {
  const [{ usd, source }, ngnPerUsd] = await Promise.all([
    fetchUsdPerBtc(signal),
    fetchUsdNgn(signal),
  ]);
  return { rate: usd * ngnPerUsd, source: `${source} + exchangerate-api` };
}

/**
 * Fetch a fresh BTC/NGN rate.
 *
 * Returns the cached rate (marked `stale`) when providers fail but the cache is
 * still within MAX_CACHE_AGE_MS, otherwise null.
 */
export async function fetchBtcNgRate(
  options: { force?: boolean } = {}
): Promise<BtcNgRateInfo | null> {
  const now = Date.now();

  if (
    !options.force &&
    cachedRateInfo != null &&
    now - cachedRateInfo.timestamp < FRESH_TTL_MS
  ) {
    return cachedRateInfo;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let result: { rate: number; source: string };
    try {
      result = await fetchFromCoinGecko(controller.signal);
    } catch (primaryError) {
      if (controller.signal.aborted) throw primaryError;
      // One retry on the primary provider covers transient 429/5xx responses.
      try {
        result = await fetchFromCoinGecko(controller.signal);
      } catch {
        if (controller.signal.aborted) throw primaryError;
        result = await fetchFromUsdSources(controller.signal);
      }
    }

    return storeRate(result.rate, result.source);
  } catch {
    // Keep an in-memory rate only if it is still within the allowed age.
    if (cachedRateInfo && Date.now() - cachedRateInfo.timestamp <= MAX_CACHE_AGE_MS) {
      return { ...cachedRateInfo, stale: true };
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Rate currently usable for quoting, or null when absent/expired.
 * Never returns a rate older than MAX_CACHE_AGE_MS.
 */
export function getRateInfo(): BtcNgRateInfo | null {
  if (!cachedRateInfo) return null;
  if (Date.now() - cachedRateInfo.timestamp > MAX_CACHE_AGE_MS) return null;
  return {
    ...cachedRateInfo,
    stale: Date.now() - cachedRateInfo.timestamp >= FRESH_TTL_MS,
  };
}

/** NGN per BTC, or null when no usable rate is cached. */
export function getCurrentNgnPerBtc(): number | null {
  return getRateInfo()?.rate ?? null;
}

/** Timestamp of the cached rate, or null. */
export function getRateTimestamp(): number | null {
  return cachedRateInfo?.timestamp ?? null;
}

/** Human-readable relative age for a rate timestamp. */
export function formatRateAge(timestamp: number): string {
  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;

  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours === 1) return '1 hour ago';
  return `${diffHours} hours ago`;
}

export function formatRateTimestamp(): string {
  if (!cachedRateInfo) return 'No rate fetched yet';
  return formatRateAge(cachedRateInfo.timestamp);
}

/** Convert NGN (float) to integer kobo. */
export function ngnToKobo(ngn: number): number {
  return Math.round(ngn * 100);
}

/** Convert integer kobo to a Naira string, e.g. 1234 → "₦12.34". */
export function koboToNgnString(kobo: number): string {
  return `₦${(kobo / 100).toFixed(2)}`;
}

/** kobo = amountSats * ngnPerBtc / 1_000_000 */
export function satsToNgnKobo(amountSats: number, ngnPerBtc: number): number {
  if (ngnPerBtc <= 0) return 0;
  return Math.round((amountSats * ngnPerBtc) / 1_000_000);
}

/** Test-only: clear module + storage cache. */
export function __resetRateCacheForTests(): void {
  cachedRateInfo = null;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(RATE_KEY);
      localStorage.removeItem(RATE_TS_KEY);
      localStorage.removeItem(RATE_SOURCE_KEY);
    } catch {
      // ignore
    }
  }
}

export default {
  fetchBtcNgRate,
  getRateInfo,
  getRateTimestamp,
  formatRateAge,
  formatRateTimestamp,
  ngnToKobo,
  koboToNgnString,
  satsToNgnKobo,
  getCurrentNgnPerBtc,
};
