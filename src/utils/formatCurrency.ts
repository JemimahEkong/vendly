// Currency formatting utilities for Vendly
// All internal math uses integer kobo (1 NGN = 100 kobo) to avoid floating-point issues
// Prices entered by merchant in NGN; internally converted to sats for Lightning
// All displayed NGN values use the ₦ symbol with proper formatting

import { getCurrentNgnPerBtc } from '../services/exchangeRate';

/**
 * Format an amount in sats as a string, e.g. 1234 → "1234 sats".
 */
export function formatSats(amount: number): string {
  return `${amount} sats`;
}

/**
 * Format an NGN amount (in kobo) as a Naira string with ₦ symbol and two decimal places.
 * e.g. 1234 → "₦12.34", 0 → "₦0.00"
 */
export function formatNgnAmount(kobo: number): string {
  const sign = kobo < 0 ? '-' : '';
  const absKobo = Math.abs(kobo);
  const whole = Math.floor(absKobo / 100);
  const frag = absKobo % 100;
  return `${sign}₦${whole}.${frag.toString().padStart(2, '0')}`;
}

/**
 * Format an NGN amount from a number (float) as a Naira string.
 * e.g. 12.34 → "₦12.34"
 */
export function formatNgnFromNumber(ngn: number): string {
  const kobo = Math.round(ngn * 100);
  return formatNgnAmount(kobo);
}

/**
 * Convert NGN amount in kobo to sats using the current BTC/NGN exchange rate.
 * @param ngnKobo NGN amount in kobo (integer)
 * @param ngnPerBtc NGN per BTC rate (from exchangeRate service)
 */
export function ngnKoboToSats(ngnKobo: number, ngnPerBtc: number): number {
  // sats = (ngnKobo / 100) * (1_000_000 / ngnPerBtc)
  //       = ngnKobo * 10_000 / ngnPerBtc
  if (ngnPerBtc <= 0) return 0;
  const raw = ngnKobo * 10_000 / ngnPerBtc;
  return Math.round(raw);
}

/**
 * Convert sats to NGN kobo using the current exchange rate.
 * @param amountSats Lightning invoice amount in sats
 * @param ngnPerBtc NGN per BTC rate (from exchangeRate service)
 * @returns NGN amount in kobo (integer, for internal math)
 */
export function satsToNgnKobo(amountSats: number, ngnPerBtc: number): number {
  if (ngnPerBtc <= 0) return 0;
  const raw = amountSats * ngnPerBtc / 1_000_000;
  return Math.round(raw);
}

/**
 * Convert an NGN amount (float, e.g. 12.34) to sats using the current BTC/NGN rate.
 * Returns 0 when no rate is available.
 */
export function convertNgnToSats(ngn: number, ngnPerBtc: number | null = getCurrentNgnPerBtc()): number {
  if (!ngnPerBtc || ngnPerBtc <= 0) return 0;
  // sats = ngn * (1_000_000 / ngnPerBtc)
  return Math.round(ngn * 1_000_000 / ngnPerBtc);
}

/**
 * Format an amount in sats as a Naira string using the current exchange rate.
 * Displays ₦0.00 when no rate is available.
 */
export function formatCurrencyFromSats(amountSats: number): string {
  const rate = getCurrentNgnPerBtc() ?? 0;
  return formatNgnAmount(satsToNgnKobo(amountSats, rate));
}

/**
 * Format number with thin space (U+2009) as thousand separator, better for monospace fonts.
 * Kept from original utils/formatNumber.ts for compatibility.
 */
export function formatWithThinSpaces(num: number | bigint): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
}

/**
 * Format number with comma as thousand separator.
 * Kept from original utils/formatNumber.ts for compatibility.
 */
export function formatWithCommas(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
