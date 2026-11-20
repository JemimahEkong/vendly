import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useProductStore } from './useProductStore';

export interface CartItem {
  id: string;
  name: string;
  priceNgn: number;  // unit price in kobo
  pricesats: number;
  quantity: number;
  image: string;
}

interface CartStore {
  items: CartItem[];
  total: number;
  scanBarcode: (barcode: string) => void;
  addProduct: (product: CartItem) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
}

function recalcTotal(items: CartItem[]): number {
  return items.reduce((acc, item) => acc + item.pricesats * item.quantity, 0);
}

function availableStock(id: string): number | null {
  const product = useProductStore.getState().products.find((p) => p.id === id);
  return product ? product.stock : null;
}

function toCartItem(product: {
  id: string;
  name: string;
  priceNgn: number;
  pricesats: number;
  image: string;
}): CartItem {
  return {
    id: product.id,
    name: product.name,
    priceNgn: product.priceNgn,
    pricesats: product.pricesats,
    quantity: 1,
    image: product.image,
  };
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      total: 0,

      scanBarcode: (barcode: string) => {
        // Look up against products added in InventoryPage via useProductStore
        const storeProducts = useProductStore.getState().products;
        const product = storeProducts.find(
          (p) => p.id === barcode || String(p.id) === barcode
        );

        if (!product) return;

        const existing = get().items.find((i) => i.id === product.id);
        const nextQuantity = existing ? existing.quantity + 1 : 1;
        if (product.stock < nextQuantity) return;

        const newItems = existing
          ? get().items.map((i) =>
              i.id === product.id ? { ...i, quantity: nextQuantity } : i
            )
          : [...get().items, toCartItem(product)];

        set({ items: newItems, total: recalcTotal(newItems) });
      },

      addProduct: (product: CartItem) => {
        const existing = get().items.find((i) => i.id === product.id);
        const stock = availableStock(product.id);
        const nextQuantity = existing ? existing.quantity + 1 : 1;

        // Never put more units in the cart than are actually in stock.
        if (stock != null && nextQuantity > stock) return;

        const newItems = existing
          ? get().items.map((i) =>
              i.id === product.id ? { ...i, quantity: nextQuantity } : i
            )
          : [...get().items, { ...product }];

        set({ items: newItems, total: recalcTotal(newItems) });
      },

      updateQuantity: (id, quantity) => {
        const stock = availableStock(id);
        const clamped = stock != null ? Math.min(quantity, stock) : quantity;

        const newItems =
          clamped <= 0
            ? get().items.filter((i) => i.id !== id)
            : get().items.map((i) => (i.id === id ? { ...i, quantity: clamped } : i));

        set({ items: newItems, total: recalcTotal(newItems) });
      },

      removeItem: (id) => {
        const newItems = get().items.filter((i) => i.id !== id);
        set({ items: newItems, total: recalcTotal(newItems) });
      },

      clearCart: () => set({ items: [], total: 0 }),
    }),
    {
      name: 'cart-store',
    }
  )
);
