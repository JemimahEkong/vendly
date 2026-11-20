import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSalesStore, createSaleReference } from '../store/useSalesStore';
import type { SaleItem, SalePaymentMethod } from '../store/useSalesStore';
import { useCartStore } from '../store/useCartStore';
import type { CartItem } from '../store/useCartStore';
import { useProductStore } from '../store/useProductStore';
import { formatNgnAmount, formatSats, ngnKoboToSats } from '../utils/formatCurrency';
import {
  fetchBtcNgRate,
  getRateInfo,
  formatRateAge,
  MAX_CACHE_AGE_MS,
} from '../services/exchangeRate';
import type { BtcNgRateInfo } from '../services/exchangeRate';
import { getBankDetails, saveBankDetails } from '../services/settings';
import type { BankDetails } from '../services/settings';
import Scanner from '../components/Scanner';
import EmbeddedCart from '../components/EmbeddedCart';
import ProductGridModal from '../components/ProductGridModal';
import ReceivePaymentDialog from '../features/receive/ReceivePaymentDialog';
import PaymentReceivedCelebration from '../components/PaymentReceivedCelebration';
import { usePOSPaymentWatcher } from '../features/receive/hooks/usePOSPaymentWatcher';

interface POSPageProps {
  onBack: () => void;
}

interface CartSnapshot {
  items: CartItem[];
  sats: number;
  ngnKobo: number;
  rate: number;
  rateTimestamp: number;
}

interface CelebrationState {
  amountKobo: number;
  items: Array<{ name: string; quantity: number; priceNgn: number }>;
  method: SalePaymentMethod;
  sats: number;
  rate: number;
  timestamp: number;
  reference: string;
  cashReceived?: number;
  change?: number;
}

function newSaleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sale-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const POSPage: React.FC<POSPageProps> = ({ onBack }) => {
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationState | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('cash');
  const [cashInput, setCashInput] = useState('');
  const [saleError, setSaleError] = useState<string | null>(null);

  const { addSale } = useSalesStore();
  const { items, clearCart } = useCartStore();
  const { products, deductStock } = useProductStore();

  const [rateInfo, setRateInfo] = useState<BtcNgRateInfo | null>(getRateInfo());
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  const [bankDetails, setBankDetails] = useState<BankDetails | null>(getBankDetails());
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankDraft, setBankDraft] = useState<BankDetails>({
    bankName: '',
    accountName: '',
    accountNumber: '',
  });

  const finalizingRef = useRef(false);
  const cartSnapshotRef = useRef<CartSnapshot | null>(null);

  const loadRate = useCallback(async (force: boolean) => {
    setRateLoading(true);
    setRateError(null);
    const info = await fetchBtcNgRate({ force });
    if (info) {
      setRateInfo(info);
    } else {
      setRateInfo(null);
      setRateError(
        'No BTC/NGN provider responded. Check your internet connection and retry. Lightning invoices are blocked until a real rate is available.'
      );
    }
    setRateLoading(false);
  }, []);

  // Load on mount when there is no usable rate, then refresh in the background.
  useEffect(() => {
    const existing = getRateInfo();
    if (!existing || existing.stale) {
      void loadRate(false);
    }
    const interval = setInterval(() => void loadRate(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadRate]);

  // Clear the cash input once the cart is emptied (sale completed / cleared).
  useEffect(() => {
    if (items.length === 0) setCashInput('');
  }, [items.length]);

  const unitPriceKobo = useCallback(
    (item: CartItem) => {
      const product = products.find((p) => p.id === item.id);
      return product?.priceNgn ?? item.priceNgn ?? 0;
    },
    [products]
  );

  // Naira total in kobo, computed from inventory prices (the single source of truth).
  const totalNgnKobo = items.reduce(
    (acc, item) => acc + unitPriceKobo(item) * item.quantity,
    0
  );

  const rate = rateInfo?.rate ?? null;
  const totalSats =
    rate && rate > 0
      ? ngnKoboToSats(totalNgnKobo, rate)
      : items.reduce((acc, item) => acc + item.pricesats * item.quantity, 0);

  const totalNgnString = formatNgnAmount(totalNgnKobo);
  const cartEmpty = items.length === 0 || totalNgnKobo <= 0;

  // Cash is valid only when a received amount is entered and covers the total.
  const parsedCashNgn = Number(cashInput);
  const cashEntered =
    cashInput.trim() !== '' && Number.isFinite(parsedCashNgn) && parsedCashNgn >= 0;
  const cashReceivedKobo = cashEntered ? Math.round(parsedCashNgn * 100) : 0;
  const cashValid = cashEntered && cashReceivedKobo >= totalNgnKobo;
  const changeKobo = cashValid ? cashReceivedKobo - totalNgnKobo : 0;

  // Stock is checked against the current inventory at completion time.
  const checkStock = useCallback(
    (lines: CartItem[]): string | null => {
      for (const line of lines) {
        const product = products.find((p) => p.id === line.id);
        if (!product) {
          return `${line.name} is no longer in inventory. Remove it from the cart.`;
        }
        if (product.stock < line.quantity) {
          return `Only ${product.stock} of ${product.name} left in stock.`;
        }
      }
      return null;
    },
    [products]
  );

  const closeCelebration = useCallback(() => setCelebration(null), []);

  const completeSale = useCallback(
    (
      method: SalePaymentMethod,
      snapshot: CartSnapshot,
      cash?: { receivedKobo: number; changeKobo: number }
    ) => {
      if (finalizingRef.current) return;
      if (snapshot.items.length === 0 || snapshot.ngnKobo <= 0) return;

      const stockProblem = checkStock(snapshot.items);
      if (stockProblem) {
        setSaleError(stockProblem);
        return;
      }

      finalizingRef.current = true;
      setSaleError(null);

      const saleItems: SaleItem[] = snapshot.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        pricesats: item.pricesats,
        image: item.image,
        priceNgn: products.find((p) => p.id === item.id)?.priceNgn ?? item.priceNgn,
      }));

      const reference = createSaleReference();
      const recorded = addSale({
        id: newSaleId(),
        reference,
        items: saleItems,
        totalSats: snapshot.sats,
        totalNgn: snapshot.ngnKobo,
        paymentMethod: method,
        paymentStatus: 'confirmed',
        btcAmountSats: method === 'lightning' ? snapshot.sats : undefined,
        exchangeRate: snapshot.rate,
        rateTimestamp: snapshot.rateTimestamp,
        createdAt: new Date().toISOString(),
        cashReceivedNgn: cash?.receivedKobo,
        changeNgn: cash?.changeKobo,
      });

      if (!recorded) {
        // Ledger rejected the record (duplicate id) — do not touch stock.
        finalizingRef.current = false;
        setSaleError('This sale was already recorded.');
        return;
      }

      // Deduct stock exactly once, after the ledger accepts the sale.
      deductStock(saleItems.map((item) => ({ id: item.id, quantity: item.quantity })));

      setCelebration({
        amountKobo: snapshot.ngnKobo,
        items: saleItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          priceNgn: item.priceNgn ?? 0,
        })),
        method,
        sats: snapshot.sats,
        rate: snapshot.rate,
        timestamp: snapshot.rateTimestamp,
        reference,
        cashReceived: cash?.receivedKobo,
        change: cash?.changeKobo,
      });

      clearCart();
      setIsReceiveDialogOpen(false);
      setPaymentMethod('cash');
      cartSnapshotRef.current = null;

      // Allow the next sale once the celebration has taken over the screen.
      window.setTimeout(() => {
        finalizingRef.current = false;
      }, 1200);
    },
    [addSale, checkStock, clearCart, deductStock, products]
  );

  const currentSnapshot = useCallback(
    (): CartSnapshot => ({
      items: [...items],
      sats: totalSats,
      ngnKobo: totalNgnKobo,
      rate: rate ?? 0,
      rateTimestamp: rateInfo?.timestamp ?? Date.now(),
    }),
    [items, totalSats, totalNgnKobo, rate, rateInfo]
  );

  const handleCashSubmit = useCallback(() => {
    if (!cashValid || cartEmpty) return;
    completeSale('cash', currentSnapshot(), {
      receivedKobo: cashReceivedKobo,
      changeKobo,
    });
  }, [
    cashValid,
    cartEmpty,
    completeSale,
    currentSnapshot,
    cashReceivedKobo,
    changeKobo,
  ]);

  const handleBankConfirm = useCallback(() => {
    if (cartEmpty) return;
    completeSale('bank-transfer', currentSnapshot());
  }, [cartEmpty, completeSale, currentSnapshot]);

  const handleLightningOpen = useCallback(() => {
    if (cartEmpty || !rate || totalSats <= 0) return;
    const stockProblem = checkStock(items);
    if (stockProblem) {
      setSaleError(stockProblem);
      return;
    }
    cartSnapshotRef.current = currentSnapshot();
    setSaleError(null);
    setIsReceiveDialogOpen(true);
  }, [cartEmpty, rate, totalSats, checkStock, items, currentSnapshot]);

  const handleCloseLightning = useCallback(() => {
    setIsReceiveDialogOpen(false);
    setPaymentMethod('cash');
    cartSnapshotRef.current = null;
  }, []);

  const finalizeLightningSale = useCallback(
    (amountSats: number) => {
      const snapshot = cartSnapshotRef.current;
      if (!snapshot) return;
      completeSale('lightning', { ...snapshot, sats: amountSats });
    },
    [completeSale]
  );

  usePOSPaymentWatcher({
    isActive: isReceiveDialogOpen && paymentMethod === 'lightning',
    expectedAmountSats: cartSnapshotRef.current?.sats,
    onSettled: finalizeLightningSale,
    onFailed: () => {
      setSaleError(
        'Lightning payment failed. No sale was recorded — ask the customer to try again.'
      );
    },
  });

  const saveBank = () => {
    if (
      !bankDraft.bankName.trim() &&
      !bankDraft.accountName.trim() &&
      !bankDraft.accountNumber.trim()
    ) {
      return;
    }
    saveBankDetails(bankDraft);
    setBankDetails(getBankDetails());
    setShowBankForm(false);
  };

  const canPayLightning = rate != null && rate > 0 && totalSats > 0;
  const rateIsTooOld = rateInfo != null && Date.now() - rateInfo.timestamp > MAX_CACHE_AGE_MS;

  return (
    <div className="h-[100dvh] flex flex-col bg-vendly-cream overflow-hidden">
      <div
        className="shrink-0 sticky top-0 z-20 flex items-center justify-between px-4 py-4 border-b border-vendly-border bg-vendly-cream/95"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
      >
        <button onClick={onBack} className="text-vendly-deep font-semibold text-sm">
          Back
        </button>
        <h1 className="text-lg font-bold text-vendly-ink">New sale</h1>
        <div className="w-12" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          <Scanner />
          <div className="rounded-2xl bg-vendly-light border border-vendly-border overflow-hidden">
            <EmbeddedCart
              onCheckout={() => setPaymentMethod('cash')}
              onOpenProducts={() => setIsProductsOpen(true)}
              totalNgn={totalNgnString}
              totalNgnKobo={totalNgnKobo}
            />
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-vendly-border bg-vendly-cream/50">
        <p className="text-sm text-vendly-muted font-medium uppercase tracking-wide">Payment method</p>
        <div className="grid grid-cols-3 gap-3 mt-3">
          {(
            [
              ['cash', 'Cash'],
              ['bank-transfer', 'Bank Transfer'],
              ['lightning', 'Lightning'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setPaymentMethod(value);
                setSaleError(null);
              }}
              className={`rounded-xl border py-2 px-2 text-sm font-medium transition-colors ${
                paymentMethod === value
                  ? 'border-vendly-primary bg-vendly-tint text-vendly-ink'
                  : 'border-vendly-border text-vendly-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {saleError && (
          <p className="mt-3 text-sm text-vendly-error" role="alert">
            {saleError}
          </p>
        )}

        {paymentMethod === 'cash' && (
          <div className="mt-4 p-3 rounded-2xl bg-vendly-light border border-vendly-border">
            <p className="text-sm text-vendly-muted mb-2">Total due: {totalNgnString}</p>
            <label htmlFor="cash-received" className="text-sm text-vendly-muted mb-1 block">
              Amount received (₦)
            </label>
            <input
              id="cash-received"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder={(totalNgnKobo / 100).toFixed(2)}
              value={cashInput}
              onChange={(e) => {
                setCashInput(e.target.value);
                setSaleError(null);
              }}
              className="w-full border rounded-xl p-2 text-vendly-ink focus-outline"
            />
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCashInput((totalNgnKobo / 100).toFixed(2))}
                className="text-xs font-semibold text-vendly-deep"
              >
                Use exact amount
              </button>
              {cashEntered && cashValid && (
                <p className="text-vendly-ink text-sm">
                  <strong>Change: {formatNgnAmount(changeKobo)}</strong>
                </p>
              )}
            </div>
            {cashEntered && !cashValid && (
              <p className="mt-2 text-sm text-vendly-error">
                Amount must be at least {totalNgnString}.
              </p>
            )}
            <button
              onClick={handleCashSubmit}
              disabled={!cashValid || cartEmpty}
              className="mt-3 w-full rounded-xl py-2 text-vendly-ink bg-vendly-primary font-semibold disabled:opacity-50"
            >
              Complete sale
            </button>
          </div>
        )}

        {paymentMethod === 'bank-transfer' && (
          <div className="mt-4 p-3 rounded-2xl bg-vendly-light border border-vendly-border">
            <p className="text-sm text-vendly-muted mb-2">Due amount: {totalNgnString}</p>

            {bankDetails ? (
              <div className="rounded-xl border border-vendly-border bg-vendly-cream p-3 mb-2 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-vendly-muted mb-1">
                  Transfer to
                </p>
                {bankDetails.bankName && (
                  <p className="text-vendly-ink font-medium">{bankDetails.bankName}</p>
                )}
                {bankDetails.accountName && (
                  <p className="text-vendly-ink">{bankDetails.accountName}</p>
                )}
                {bankDetails.accountNumber && (
                  <p className="text-vendly-ink font-mono">{bankDetails.accountNumber}</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setBankDraft(bankDetails);
                    setShowBankForm(true);
                  }}
                  className="mt-2 text-xs font-semibold text-vendly-deep"
                >
                  Edit bank details
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowBankForm(true)}
                className="mb-2 text-xs font-semibold text-vendly-deep"
              >
                Add your bank details
              </button>
            )}

            {showBankForm && (
              <div className="space-y-2 mb-2">
                <input
                  placeholder="Bank name"
                  value={bankDraft.bankName}
                  onChange={(e) => setBankDraft((d) => ({ ...d, bankName: e.target.value }))}
                  className="w-full border rounded-xl p-2 text-vendly-ink"
                />
                <input
                  placeholder="Account name"
                  value={bankDraft.accountName}
                  onChange={(e) => setBankDraft((d) => ({ ...d, accountName: e.target.value }))}
                  className="w-full border rounded-xl p-2 text-vendly-ink"
                />
                <input
                  placeholder="Account number"
                  inputMode="numeric"
                  value={bankDraft.accountNumber}
                  onChange={(e) => setBankDraft((d) => ({ ...d, accountNumber: e.target.value }))}
                  className="w-full border rounded-xl p-2 text-vendly-ink"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveBank}
                    className="flex-1 rounded-xl bg-vendly-deep px-3 py-2 text-sm font-semibold text-vendly-light"
                  >
                    Save details
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBankForm(false)}
                    className="rounded-xl border border-vendly-border px-3 py-2 text-sm font-medium text-vendly-ink"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <p className="text-xs text-vendly-muted">
              Confirm once the transfer has landed in your account. This is a manual confirmation.
            </p>
            <button
              onClick={handleBankConfirm}
              disabled={cartEmpty}
              className="mt-3 w-full rounded-xl py-2 text-vendly-ink bg-vendly-primary font-semibold disabled:opacity-50"
            >
              Confirm payment received
            </button>
          </div>
        )}

        {paymentMethod === 'lightning' && (
          <div className="mt-4 p-3 rounded-2xl bg-vendly-light border border-vendly-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-vendly-muted">Lightning amount: {totalNgnString}</p>
              <button
                type="button"
                onClick={() => void loadRate(true)}
                disabled={rateLoading}
                className="text-xs font-semibold text-vendly-deep disabled:opacity-50"
              >
                {rateLoading ? 'Refreshing…' : 'Refresh rate'}
              </button>
            </div>

            {rateInfo ? (
              <div className="space-y-1 mb-3">
                <p className="text-sm text-vendly-ink">
                  <strong>₦{Math.round(rateInfo.rate).toLocaleString()}</strong> / BTC
                  <span className="text-vendly-muted">
                    {' '}· {rateInfo.stale ? 'Cached' : 'Live'} · {rateInfo.source} ·{' '}
                    {formatRateAge(rateInfo.timestamp)}
                  </span>
                </p>
                {rateInfo.stale && !rateIsTooOld && (
                  <p className="text-xs text-vendly-muted">
                    Cached rate (max {MAX_CACHE_AGE_MS / 60000} min). Refresh for a live quote
                    before charging.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-vendly-error mb-3">
                {rateLoading
                  ? 'Fetching the current BTC/NGN rate…'
                  : 'No reliable BTC/NGN rate available. Refresh the rate before taking a Lightning payment.'}
              </p>
            )}

            {rateError && <p className="text-xs text-vendly-error mb-3">{rateError}</p>}

            <p className="text-xs text-vendly-muted mb-3">
              Customer pays{' '}
              <strong className="text-vendly-ink">{canPayLightning ? formatSats(totalSats) : '—'}</strong>{' '}
              for {totalNgnString}.
            </p>

            <button
              onClick={handleLightningOpen}
              disabled={!canPayLightning || cartEmpty || rateLoading}
              className="w-full rounded-xl py-2 text-vendly-ink bg-vendly-primary font-semibold disabled:opacity-50"
            >
              Create Lightning invoice
            </button>
            {!canPayLightning && !rateLoading && (
              <p className="mt-2 text-xs text-vendly-muted">
                Invoice generation stays blocked until a real rate is available. No made-up
                fallback is used.
              </p>
            )}
          </div>
        )}
      </div>

      <ProductGridModal isOpen={isProductsOpen} onClose={() => setIsProductsOpen(false)} />

      {paymentMethod === 'lightning' && isReceiveDialogOpen && canPayLightning && (
        <ReceivePaymentDialog
          isOpen={isReceiveDialogOpen}
          onClose={handleCloseLightning}
          presetAmountSats={cartSnapshotRef.current?.sats ?? totalSats}
          presetDescription="Vendly sale"
          autoGenerate
        />
      )}

      {celebration !== null && (
        <PaymentReceivedCelebration
          amount={celebration.amountKobo}
          items={celebration.items}
          paymentMethod={celebration.method}
          paymentStatus="confirmed"
          btcAmount={celebration.method === 'lightning' ? celebration.sats : undefined}
          exchangeRate={celebration.rate}
          rateTimestamp={celebration.timestamp}
          cashReceived={celebration.cashReceived}
          change={celebration.change}
          transactionRef={celebration.reference}
          onClose={closeCelebration}
        />
      )}
    </div>
  );
};

export default POSPage;
