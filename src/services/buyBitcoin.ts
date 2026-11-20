/**
 * Bitcoin on-ramp configuration.
 *
 * Vendly uses Guardarian's hosted purchase flow instead of the Breez SDK's
 * `buyBitcoin()` helper. Breez's MoonPay integration is gated behind a
 * provisioned client certificate that this project does not have, so it could
 * never open a checkout.
 *
 * Guardarian's public hosted flow:
 * - supports Nigerian customers and NGN;
 * - lets the buyer paste an external Bitcoin address;
 * - requires no API key, backend or signed URL for the hosted page;
 * - collects payment and KYC on Guardarian's side.
 *
 * Vendly never receives card details, private keys or recovery phrases, and
 * does not treat opening this page as a completed purchase.
 */
export const BITCOIN_RAMP_PROVIDER = 'Guardarian';

/** Public hosted purchase page for Nigeria. */
export const BITCOIN_RAMP_URL = 'https://guardarian.com/buy-btc-in-nigeria';

/** Guardarian's generic Bitcoin purchase page (fallback link). */
export const BITCOIN_RAMP_FALLBACK_URL = 'https://guardarian.com/buy-btc';

export function getBitcoinRampUrl(): string {
  return BITCOIN_RAMP_URL;
}
