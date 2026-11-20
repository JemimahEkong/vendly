import { beforeEach, describe, expect, it } from 'vitest';
import { createSaleReference, useSalesStore } from './useSalesStore';

const baseSale = {
  items: [
    {
      id: 'sku-1',
      name: 'Test product',
      quantity: 2,
      pricesats: 1000,
      image: '',
      priceNgn: 500,
    },
  ],
  totalSats: 2000,
  totalNgn: 1000,
  paymentMethod: 'cash' as const,
  paymentStatus: 'confirmed' as const,
  exchangeRate: 100_000_000,
  rateTimestamp: Date.now(),
  createdAt: new Date().toISOString(),
};

describe('sales ledger', () => {
  beforeEach(() => {
    useSalesStore.setState({ sales: [] });
  });

  it('records a unique sale once', () => {
    const added = useSalesStore.getState().addSale({ ...baseSale, id: 'sale-1' });

    expect(added).toBe(true);
    expect(useSalesStore.getState().sales).toHaveLength(1);
    expect(useSalesStore.getState().sales[0].totalNgn).toBe(1000);
  });

  it('rejects a duplicate id so retries cannot double-count revenue', () => {
    const { addSale } = useSalesStore.getState();

    expect(addSale({ ...baseSale, id: 'sale-1' })).toBe(true);
    expect(addSale({ ...baseSale, id: 'sale-1' })).toBe(false);
    expect(useSalesStore.getState().sales).toHaveLength(1);
  });

  it('records separate sales with different ids', () => {
    const { addSale } = useSalesStore.getState();

    addSale({ ...baseSale, id: 'sale-1' });
    addSale({ ...baseSale, id: 'sale-2' });

    expect(useSalesStore.getState().sales).toHaveLength(2);
  });

  it('creates readable, unique receipt references', () => {
    const first = createSaleReference(new Date('2026-11-20T12:34:56Z'));
    const second = createSaleReference(new Date('2026-11-20T12:34:56Z'));

    expect(first).toMatch(/^VENDLY-20261120123456-[A-Z0-9]{4}$/);
    expect(first).not.toBe(second);
  });
});
