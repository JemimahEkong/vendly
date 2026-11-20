import { motion } from 'framer-motion';
import { X, Plus, Package } from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import { formatSats, formatNgnAmount } from '../utils/formatCurrency';
import { useProductStore } from '../store/useProductStore';
import ProductImage from './ProductImage';

interface ProductGridModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProductGridModal({ isOpen, onClose }: ProductGridModalProps) {
  const { addProduct, items: cartItems } = useCartStore();
  const { products } = useProductStore();

  const handleAdd = (product: {
    id: string;
    name: string;
    priceNgn: number;
    pricesats: number;
    image: string;
  }) => {
    addProduct({ ...product, quantity: 1 });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* BACKDROP */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-vendly-cream/85"
      />

      {/* MODAL */}
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full sm:max-w-2xl bg-vendly-light border border-vendly-border sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden h-[80vh] sm:h-[70vh] flex flex-col"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-vendly-border bg-vendly-light sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-semibold text-vendly-ink">Add products to sale</h2>
            <p className="text-xs text-vendly-muted">From your inventory</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close product browser"
            className="p-2 rounded-full text-vendly-muted hover:bg-vendly-tint transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* GRID */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-vendly-light">
          {products.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-vendly-muted py-10">
              <Package size={40} className="mb-3" />
              <p className="font-semibold text-vendly-ink">No products yet</p>
              <p className="text-sm mt-1 max-w-xs">
                Add products in Inventory, then they will appear here for sale.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {products.map((item) => {
                const inCart = cartItems.find((i) => i.id === item.id)?.quantity ?? 0;
                const outOfStock = item.stock <= 0;
                const atLimit = inCart >= item.stock;

                return (
                  <div
                    key={item.id}
                    className={`bg-vendly-light border rounded-2xl p-3 flex flex-col ${
                      outOfStock ? 'border-vendly-border opacity-60' : 'border-vendly-border'
                    }`}
                  >
                    <div className="relative">
                      <ProductImage
                        src={item.image}
                        alt={item.name}
                        className="w-full aspect-square object-cover rounded-xl mb-3"
                      />
                      {/* Stock badge */}
                      <span
                        className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          outOfStock
                            ? 'bg-vendly-tint text-vendly-deep'
                            : item.stock < 5
                              ? 'bg-vendly-tint text-vendly-ink'
                              : 'bg-vendly-tint text-vendly-muted'
                        }`}
                      >
                        {outOfStock ? 'Out of stock' : `${item.stock} left`}
                      </span>
                    </div>

                    <h3 className="font-medium text-vendly-ink text-sm mb-1">{item.name}</h3>

                    <div className="flex items-center justify-between mt-auto pt-2">
                      <div>
                        <p className="text-sm font-bold text-vendly-ink">
                          {formatNgnAmount(item.priceNgn)}
                        </p>
                        {item.pricesats > 0 && (
                          <p className="text-[11px] text-vendly-muted">
                            {formatSats(item.pricesats)}
                          </p>
                        )}
                        {inCart > 0 && (
                          <p className="text-[11px] text-vendly-deep font-medium">
                            {inCart} in cart
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => handleAdd(item)}
                        disabled={outOfStock || atLimit}
                        aria-label={`Add ${item.name} to sale`}
                        className="w-8 h-8 rounded-full bg-vendly-deep text-vendly-light hover:bg-vendly-green flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
