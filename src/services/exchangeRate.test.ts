import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetRateCacheForTests,
  fetchBtcNgRate,
  getRateInfo,
  MAX_CACHE_AGE_MS,
} from './exchangeRate';

function jsonResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);
}

const COINGECKO = 'api.coingecko.com';
const COINBASE = 'api.coinbase.com';
const BINANCE = 'api.binance.com';
const FX = 'open.er-api.com';

function mockFetch(handler: (url: string, call: number) => Promise<Response>) {
  let call = 0;
  const mock = vi.fn((input: RequestInfo | URL) => {
    call += 1;
    return handler(String(input), call);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('exchangeRate service', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    __resetRateCacheForTests();
  });

  it('uses CoinGecko NGN price when available', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ bitcoin: { ngn: 82_000_000, usd: 60_000 } }));

    const info = await fetchBtcNgRate({ force: true });

    expect(info?.rate).toBe(82_000_000);
    expect(info?.source).toBe('CoinGecko');
    expect(info?.stale).toBe(false);
    expect(info?.timestamp).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRateInfo()?.rate).toBe(82_000_000);
  });

  it('returns the cached rate without refetching while fresh', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ bitcoin: { ngn: 80_000_000 } }));

    await fetchBtcNgRate({ force: true });
    const second = await fetchBtcNgRate();

    expect(second?.rate).toBe(80_000_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to Coinbase BTC/USD × USD/NGN when CoinGecko fails', async () => {
    const fetchMock = mockFetch((url) => {
      if (url.includes(COINGECKO)) return Promise.resolve({ ok: false, status: 429 } as Response);
      if (url.includes(COINBASE)) return jsonResponse({ data: { amount: '60000' } });
      if (url.includes(FX)) return jsonResponse({ rates: { NGN: 1400 } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    const info = await fetchBtcNgRate({ force: true });

    expect(info?.rate).toBe(84_000_000);
    expect(info?.source).toBe('Coinbase + exchangerate-api');
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it('uses Binance × FX when Coinbase fails', async () => {
    const fetchMock = mockFetch((url) => {
      if (url.includes(COINGECKO)) return Promise.resolve({ ok: false, status: 500 } as Response);
      if (url.includes(COINBASE)) return Promise.resolve({ ok: false, status: 500 } as Response);
      if (url.includes(BINANCE)) return jsonResponse({ price: '60000' });
      if (url.includes(FX)) return jsonResponse({ rates: { NGN: 1500 } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    const info = await fetchBtcNgRate({ force: true });

    expect(info?.rate).toBe(90_000_000);
    expect(info?.source).toBe('Binance + exchangerate-api');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('returns null when every provider fails and there is no cache', async () => {
    mockFetch(() => Promise.reject(new Error('offline')));

    const info = await fetchBtcNgRate({ force: true });

    expect(info).toBeNull();
    expect(getRateInfo()).toBeNull();
  });

  it('never returns a cache older than the maximum age', async () => {
    localStorage.setItem('vendly_exchange_rate', '70000000');
    localStorage.setItem('vendly_exchange_rate_ts', String(Date.now() - MAX_CACHE_AGE_MS - 1000));
    localStorage.setItem('vendly_exchange_rate_source', 'test');

    // Re-import to hydrate the module-level cache from localStorage.
    vi.resetModules();
    const fresh = await import('./exchangeRate');

    expect(fresh.getRateInfo()).toBeNull();
  });
});
