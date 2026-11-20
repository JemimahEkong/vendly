// Shared domain types for the wallet example app

import { InputType } from "@breeztech/breez-sdk-spark/bundler";

// Supported receive tabs / methods in Receive dialog
export type PaymentMethod = 'lightning' | 'spark' | 'bitcoin';

// Payment status for a sale (only 'confirmed' sales count toward revenue)
export type PaymentStatus = 'confirmed' | 'pending' | 'failed';

// Sale payment method
export type SalePaymentMethod = 'cash' | 'bank-transfer' | 'lightning';

// A single item within a completed sale
export interface SaleItem {
  id: string;
  name: string;
  quantity: number;
  pricesats: number;
  image: string;
  priceNgn?: number;   // Naira price per unit (kobo, internal)
}

// Interface for a completed sale record with Naira fields
export interface SaleRecord {
  id: string;
  items: SaleItem[];
  totalSats: number;
  totalNgn: number;         // Naira total (kobo * 100 / 100 = NGN value, displayed as ₦X.XX)
  paymentMethod: SalePaymentMethod;
  paymentStatus: PaymentStatus;
  btcAmountSats?: number;   // Lightning: original sat amount before conversion
  exchangeRate: number;     // NGN per BTC rate at time of sale
  rateTimestamp: number;    // Timestamp when rate was fetched (ms since epoch)
}

// Steps for the Receive dialog
export type ReceiveStep = 'loading_limits' | 'input' | 'qr' | 'loading';

// Steps for the Send dialog
export type PaymentStep = 'input' | 'amount' | 'fee' | 'confirm' | 'processing' | 'result';

// Common fee options structure (e.g., for on-chain fee presets)
export interface FeeOptions {
  fast: number;
  medium: number;
  slow: number;
}

export interface SendInput {
  rawInput: string;
  parsedInput: InputType;
}