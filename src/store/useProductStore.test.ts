import { beforeEach, describe, expect, it } from 'vitest';
import { useProductStore } from './useProductStore';
import type { Product } from './useProductStore';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'sku-1',
  name: 'Test product',
  image: '',
  priceNgn: 500,
  pricesats: 1000,
  stock: 5,
  _priceNgnSet: true,
  ...overrides,
});

describe('product store', () => {
  beforeEach(() => {
    useProductStore.setState({ products: [product()] });
  });

  it('deducts stock for a sale', () => {
    const result = useProductStore
      .getState()
      .deductStock([{ id: 'sku-1', quantity: 2 }]);

    expect(result.ok).toBe(true);
    expect(useProductStore.getState().products[0].stock).toBe(3);
  });

  it('does not deduct anything when stock is insufficient', () => {
    const result = useProductStore
      .getState()
      .deductStock([{ id: 'sku-1', quantity: 6 }]);

    expect(result.ok).toBe(false);
    expect(result.insufficient).toEqual(['Test product']);
    expect(useProductStore.getState().products[0].stock).toBe(5);
  });

  it('rejects the whole sale when one line is short', () => {
    useProductStore.setState({
      products: [product(), product({ id: 'sku-2', name: 'Second', stock: 1 })],
    });

    const result = useProductStore.getState().deductStock([
      { id: 'sku-1', quantity: 1 },
      { id: 'sku-2', quantity: 2 },
    ]);

    expect(result.ok).toBe(false);
    expect(useProductStore.getState().products.find((p) => p.id === 'sku-1')?.stock).toBe(5);
    expect(useProductStore.getState().products.find((p) => p.id === 'sku-2')?.stock).toBe(1);
  });

  it('updates name, price and stock without changing the id', () => {
    useProductStore.getState().updateProduct('sku-1', {
      name: 'Renamed',
      priceNgn: 1250,
      stock: 9,
    });

    const updated = useProductStore.getState().products[0];
    expect(updated.id).toBe('sku-1');
    expect(updated.name).toBe('Renamed');
    expect(updated.priceNgn).toBe(1250);
    expect(updated.stock).toBe(9);
  });

  it('uses a placeholder when a product has no image', () => {
    useProductStore.getState().addProduct({
      id: 'sku-3',
      name: 'No photo',
      image: '',
      priceNgn: 100,
      pricesats: 10,
      stock: 1,
    });

    const added = useProductStore.getState().products.find((p) => p.id === 'sku-3');
    expect(added?.image).toContain('data:image/svg+xml');
  });
});
