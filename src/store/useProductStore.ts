import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getCurrentNgnPerBtc } from '../services/exchangeRate';
import { PRODUCT_IMAGE_PLACEHOLDER } from '../utils/productImage';

export interface Product {
  id: string;                // = the barcode printed on the product (e.g. "6156000211626")
  name: string;
  image: string;             // data URL (uploaded) or a public asset path
  priceNgn: number;          // Naira price in kobo (integer, 1 NGN = 100 kobo). e.g. 500 = ₦5.00
  pricesats: number;         // Derived from priceNgn + exchange rate (sats equivalent)
  stock: number;
  // Internal: whether priceNgn has been set by merchant (vs default placeholder)
  _priceNgnSet?: boolean;
}

export interface StockLine {
  id: string;
  quantity: number;
}

// Compute pricesats from priceNgn (kobo) using the current exchange rate.
// If no rate is available, return the stored pricesats unchanged.
function computePricesatsFromPriceNgn(priceNgn: number, storedPricesats: number): number {
  const rate = getCurrentNgnPerBtc();
  if (rate == null || rate <= 0) return storedPricesats;
  return Math.round((priceNgn * 1_000_000) / rate);
}

// Keeps the original 4 products working with their real barcodes.
const DEFAULT_PRODUCTS: Product[] = [
  {
    id: '6156000211626',
    name: 'Nutsy Peanut Butter',
    image: '/assets/nutsy.png',
    priceNgn: 500,         // ₦5.00 in kobo
    pricesats: 1500,
    stock: 10,
    _priceNgnSet: true,
  },
  {
    id: '6156000261201',
    name: 'CWAY 750ml',
    image: '/assets/cway.png',
    priceNgn: 800,         // ₦8.00
    pricesats: 1000,
    stock: 10,
    _priceNgnSet: true,
  },
  {
    id: '5060909050013',
    name: 'Pop-Cola 35cl',
    image: '/assets/redoil.png',
    priceNgn: 400,         // ₦4.00
    pricesats: 250,
    stock: 10,
    _priceNgnSet: true,
  },
  {
    id: '8410300367673',
    name: 'Bama Mayonnaise 810ml',
    image: '/assets/bama.png',
    priceNgn: 1200,        // ₦12.00
    pricesats: 8000,
    stock: 10,
    _priceNgnSet: true,
  },
];

interface ProductStore {
  products: Product[];
  addProduct: (product: Product) => void;
  updateProduct: (id: string, patch: Partial<Omit<Product, 'id'>>) => void;
  removeProduct: (id: string) => void;
  /**
   * Subtract sold quantities from stock. All-or-nothing: if any line would go
   * negative, no stock is changed and the offending product names are returned.
   */
  deductStock: (lines: StockLine[]) => { ok: boolean; insufficient: string[] };
}

export const useProductStore = create<ProductStore>()(
  persist(
    (set, get) => ({
      products: DEFAULT_PRODUCTS,

      addProduct: (product) =>
        set((state) => {
          const existingIndex = state.products.findIndex((p) => p.id === product.id);
          const normalized: Product = {
            ...product,
            image: product.image || PRODUCT_IMAGE_PLACEHOLDER,
            priceNgn: Math.max(0, Math.round(product.priceNgn)),
            stock: Math.max(0, Math.floor(product.stock)),
          };
          const productWithNgnSet = {
            ...normalized,
            _priceNgnSet:
              normalized.priceNgn > 0
                ? true
                : state.products.some((p) => p.id === product.id && p._priceNgnSet),
          };

          if (existingIndex >= 0) {
            const updatedProducts = [...state.products];
            updatedProducts[existingIndex] = {
              ...updatedProducts[existingIndex],
              ...productWithNgnSet,
              pricesats: computePricesatsFromPriceNgn(
                normalized.priceNgn,
                updatedProducts[existingIndex].pricesats
              ),
            };
            return { products: updatedProducts };
          }

          return { products: [productWithNgnSet, ...state.products] };
        }),

      updateProduct: (id, patch) =>
        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== id) return p;
            const priceNgn =
              patch.priceNgn != null ? Math.max(0, Math.round(patch.priceNgn)) : p.priceNgn;
            return {
              ...p,
              ...patch,
              priceNgn,
              image: patch.image || p.image || PRODUCT_IMAGE_PLACEHOLDER,
              stock:
                patch.stock != null ? Math.max(0, Math.floor(patch.stock)) : p.stock,
              pricesats: computePricesatsFromPriceNgn(priceNgn, p.pricesats),
              _priceNgnSet: priceNgn > 0 ? true : p._priceNgnSet,
            };
          }),
        })),

      removeProduct: (id) =>
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        })),

      deductStock: (lines) => {
        const { products } = get();
        const insufficient: string[] = [];

        for (const line of lines) {
          const product = products.find((p) => p.id === line.id);
          if (!product) {
            insufficient.push(line.id);
            continue;
          }
          if (product.stock < line.quantity) {
            insufficient.push(product.name);
          }
        }

        if (insufficient.length > 0) {
          return { ok: false, insufficient };
        }

        set((state) => ({
          products: state.products.map((p) => {
            const line = lines.find((l) => l.id === p.id);
            if (!line) return p;
            return { ...p, stock: Math.max(0, p.stock - line.quantity) };
          }),
        }));

        return { ok: true, insufficient: [] };
      },
    }),
    { name: 'product-store' }
  )
);
