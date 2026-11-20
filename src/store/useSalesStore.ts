import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SaleItem {
  id: string;
  name: string;
  quantity: number;
  pricesats: number;
  image: string;
  priceNgn?: number;
}

export type SalePaymentMethod = 'cash' | 'bank-transfer' | 'lightning';
export type SalePaymentStatus = 'confirmed' | 'pending' | 'failed';

export interface Sale {
  id: string;
  /** Human-readable receipt reference. */
  reference?: string;
  items: SaleItem[];
  totalSats: number;
  /** Naira total in kobo (integer). */
  totalNgn: number;
  paymentMethod: SalePaymentMethod;
  paymentStatus: SalePaymentStatus;
  btcAmountSats?: number;
  exchangeRate: number;
  rateTimestamp: number;
  createdAt: string;
  /** Cash only: amount handed over and change given, both in kobo. */
  cashReceivedNgn?: number;
  changeNgn?: number;
}

interface SalesStore {
  sales: Sale[];
  /**
   * Append a sale. Returns false when a sale with the same id is already in the
   * ledger, which makes retries/double-clicks idempotent.
   */
  addSale: (sale: Sale) => boolean;
}

export function createSaleReference(now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VENDLY-${stamp}-${suffix}`;
}

export const useSalesStore = create<SalesStore>()(
  persist(
    (set, get) => ({
      sales: [],

      addSale: (sale: Sale) => {
        if (get().sales.some((existing) => existing.id === sale.id)) {
          return false;
        }
        set((state) => ({ sales: [sale, ...state.sales] }));
        return true;
      },
    }),
    { name: 'sales-store' }
  )
);
