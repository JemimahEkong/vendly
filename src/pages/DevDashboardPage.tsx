import React from 'react';
import { ShoppingBag, Package, Wallet, AlertTriangle } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { useSalesStore } from '@/store/useSalesStore';
import { useProductStore } from '@/store/useProductStore';

interface DevDashboardPageProps {
  onExit: () => void;
  onOpenSales: () => void;
  onOpenInventory: () => void;
  onConnectWallet: () => void;
}

/**
 * Honest dashboard for local development without a Breez wallet.
 *
 * It only shows data that already exists in this browser. There is no fake
 * balance and no way to take or simulate a payment from here.
 */
const DevDashboardPage: React.FC<DevDashboardPageProps> = ({
  onExit,
  onOpenSales,
  onOpenInventory,
  onConnectWallet,
}) => {
  const salesCount = useSalesStore((state) => state.sales.length);
  const productCount = useProductStore((state) => state.products.length);

  return (
    <div className="h-full w-full overflow-y-auto bg-vendly-cream">
      <div
        className="mx-auto w-full max-w-md px-5 pb-10"
        style={{
          paddingTop: 'calc(1.25rem + env(safe-area-inset-top, 0px))',
          paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <BrandLogo className="h-8 w-auto" />
          <span className="rounded-full bg-vendly-deep px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-vendly-cream">
            Dev mode
          </span>
        </div>

        <div className="rounded-2xl border border-vendly-border bg-vendly-light p-4 mb-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-vendly-deep" />
            <div>
              <h1 className="font-display font-bold text-vendly-ink">Wallet not connected</h1>
              <p className="mt-1 text-xs leading-relaxed text-vendly-muted">
                This is local development access, not a signed-in account. No Bitcoin balance is
                shown and no payment can be sent or received until the Breez SDK connects.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={onOpenSales}
            data-testid="dev-open-sales"
            className="flex w-full items-center gap-4 rounded-2xl border border-vendly-border bg-vendly-light p-4 text-left transition-colors hover:border-vendly-green"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-vendly-tint">
              <ShoppingBag size={20} className="text-vendly-deep" />
            </span>
            <span className="flex-1">
              <span className="block font-display font-semibold text-vendly-ink">Sales</span>
              <span className="block text-xs text-vendly-muted">
                {salesCount} recorded sale{salesCount === 1 ? '' : 's'} in this browser
              </span>
            </span>
          </button>

          <button
            onClick={onOpenInventory}
            data-testid="dev-open-inventory"
            className="flex w-full items-center gap-4 rounded-2xl border border-vendly-border bg-vendly-light p-4 text-left transition-colors hover:border-vendly-green"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-vendly-tint">
              <Package size={20} className="text-vendly-deep" />
            </span>
            <span className="flex-1">
              <span className="block font-display font-semibold text-vendly-ink">Inventory</span>
              <span className="block text-xs text-vendly-muted">
                {productCount} product{productCount === 1 ? '' : 's'} in this browser
              </span>
            </span>
          </button>

          <div className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-vendly-border bg-transparent p-4 opacity-70">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-vendly-tint">
              <Wallet size={20} className="text-vendly-muted" />
            </span>
            <span className="flex-1">
              <span className="block font-display font-semibold text-vendly-ink">
                Payments and POS checkout
              </span>
              <span className="block text-xs text-vendly-muted">
                Available only when the Breez wallet is connected
              </span>
            </span>
          </div>
        </div>

        <button
          onClick={onConnectWallet}
          className="mt-5 w-full rounded-xl bg-vendly-deep px-4 py-3.5 font-display text-sm font-semibold text-vendly-cream transition-colors hover:bg-vendly-ink"
        >
          Set up a wallet
        </button>
        <button
          onClick={onExit}
          data-testid="dev-exit"
          className="mt-3 w-full rounded-xl border border-vendly-border px-4 py-3 font-display text-sm font-semibold text-vendly-ink transition-colors hover:bg-vendly-tint"
        >
          Exit development mode
        </button>
      </div>
    </div>
  );
};

export default DevDashboardPage;
