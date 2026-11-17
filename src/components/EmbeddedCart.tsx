import { useCartStore } from '../store/useCartStore';
import { formatCurrencyFromSats, formatSats } from '../utils/formatCurrency';
import { Minus, Plus, ShoppingCart, Trash2, Grid } from 'lucide-react';

interface CartProps {
  onCheckout: () => void;
  onOpenProducts: () => void;
}

export default function EmbeddedCart({ onCheckout, onOpenProducts }: CartProps) {
  const { items, total, updateQuantity, clearCart } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-vendly-muted p-6 bg-vendly-light">
        <img
          src="/illustrations/sales-management.svg"
          alt=""
          className="w-full max-w-[240px] h-auto mb-2"
        />

        <p className="text-base font-semibold text-vendly-ink">
          Start a new sale
        </p>

        <p className="text-xs mt-1 mb-6 text-vendly-muted text-center">
          Scan a barcode or choose products from your inventory.
        </p>

        <button
          onClick={onOpenProducts}
          className="flex cursor-pointer items-center gap-2 bg-vendly-tint text-vendly-deep border border-vendly-border px-4 py-2.5 rounded-xl font-semibold hover:bg-vendly-border transition-colors"
        >
          <Grid size={18} />
          Browse products
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-vendly-light">
      {/* HEADER */}
      <div className="p-4 border-b border-vendly-border flex items-center justify-between sticky top-0 bg-vendly-light z-10">
        <div className="flex items-center gap-2">
          <ShoppingCart size={20} className="text-vendly-deep" />

          <h2 className="font-semibold text-vendly-ink">
            Current sale
          </h2>

          <span className="bg-vendly-tint text-vendly-ink text-xs font-bold px-2 py-0.5 rounded-full">
            {items.reduce((acc, item) => acc + item.quantity, 0)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenProducts}
            className="text-xs cursor-pointer text-vendly-ink font-medium px-3 py-1.5 rounded-full hover:bg-vendly-tint transition-colors"
          >
            Add items
          </button>

          <button
            onClick={clearCart}
            className="text-xs cursor-pointer text-vendly-muted font-medium px-3 py-1.5 rounded-full hover:bg-vendly-tint transition-colors"
          >
            Clear all
          </button>
        </div>
      </div>

      {/* ITEMS */}
      <div className="overflow-y-auto p-4 space-y-3 flex-1 bg-vendly-light">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 bg-vendly-light border border-vendly-border p-3 rounded-2xl"
          >
            <img
              src={item.image}
              alt={item.name}
              className="w-12 h-12 rounded-xl object-cover"
            />

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-vendly-ink truncate">
                {item.name}
              </h4>

              <p className="text-sm font-semibold text-vendly-ink mt-0.5">
                {formatCurrencyFromSats(item.pricesats)}
              </p>

              <p className="text-[11px] text-vendly-muted mt-0.5">
                {formatSats(item.pricesats)}
              </p>
            </div>

            {/* QUANTITY */}
            <div className="flex items-center gap-2 bg-vendly-light rounded-full border border-vendly-border p-1">
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-vendly-ink hover:bg-vendly-tint transition-colors"
              >
                {item.quantity === 1 ? (
                  <Trash2 size={14} className="text-vendly-muted" />
                ) : (
                  <Minus size={14} />
                )}
              </button>

              <span className="text-sm font-semibold w-6 text-center text-vendly-ink">
                {item.quantity}
              </span>

              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-vendly-ink hover:bg-vendly-tint transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div className="p-4 bg-vendly-light border-t border-vendly-border shrink-0">
        <div className="flex items-center justify-between mb-4">
          <span className="text-vendly-ink font-medium">
            Total Amount
          </span>

          <div className="text-right">
            <p className="text-2xl font-bold text-vendly-ink">
              {formatCurrencyFromSats(total)}
            </p>

            <p className="text-sm text-vendly-muted">
              {formatSats(total)}
            </p>
          </div>
        </div>

        <button
          onClick={onCheckout}
          className="w-full cursor-pointer bg-vendly-deep hover:bg-vendly-green text-vendly-light font-semibold py-4 rounded-2xl transition"
        >
          Charge customer
        </button>
      </div>
    </div>
  );
}