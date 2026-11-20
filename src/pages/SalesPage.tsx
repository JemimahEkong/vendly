import React, { useMemo, useState } from 'react';
import { useSalesStore } from '../store/useSalesStore';
import type { Sale } from '../store/useSalesStore';
import { formatSats, formatNgnAmount } from '../utils/formatCurrency';
import { TrendingUp, ShoppingBag, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { assetPath } from '@/utils/assetPath';

interface SalesPageProps {
  onBack: () => void;
}

interface DayGroup {
  label: string;       // e.g. "Today", "Yesterday", "22 May 2026"
  dateKey: string;     // YYYY-MM-DD for sorting
  sales: Sale[];
  totalNgn: number;    // Naira total from confirmed sales (kobo)
  totalSats: number;   // Sats total from confirmed sales
  itemsSold: number;
}

function getDayLabel(dateKey: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateKey === today) return 'Today';
  if (dateKey === yesterday) return 'Yesterday';
  return new Date(dateKey).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

// Filter only confirmed sales for revenue calculations
function getConfirmedSales(sales: Sale[]): Sale[] {
  return sales.filter((sale) => sale.paymentStatus === 'confirmed');
}

function paymentMethodLabel(method: Sale['paymentMethod']): string {
  if (method === 'cash') return 'Cash';
  if (method === 'bank-transfer') return 'Bank transfer';
  return 'Lightning';
}

const SalesPage: React.FC<SalesPageProps> = ({ onBack }) => {
  const sales = useSalesStore((state) => state.sales);
  const confirmedSales = getConfirmedSales(sales);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(
    new Set([new Date().toISOString().slice(0, 10)])
  );
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());

  // Group confirmed sales by day, most recent first
  const dayGroups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>();

    for (const sale of confirmedSales) {
      const dateKey = new Date(sale.createdAt).toISOString().slice(0, 10);
      if (!map.has(dateKey)) {
        map.set(dateKey, {
          label: getDayLabel(dateKey),
          dateKey,
          sales: [],
          totalNgn: 0,
          totalSats: 0,
          itemsSold: 0,
        });
      }
      const group = map.get(dateKey)!;
      group.sales.push(sale);
      group.totalNgn += sale.totalNgn;
      group.totalSats += sale.totalSats;
      group.itemsSold += sale.items.reduce((acc, i) => acc + i.quantity, 0);
    }

    return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [confirmedSales]);

  // Overall stats using only confirmed sales
  const allTimeNgn = useMemo(() => confirmedSales.reduce((acc, s) => acc + s.totalNgn, 0), [confirmedSales]);
  const todayNgn = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return confirmedSales
      .filter(s => new Date(s.createdAt).toISOString().slice(0, 10) === today)
      .reduce((acc, s) => acc + s.totalNgn, 0);
  }, [confirmedSales]);

  const todaySats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return confirmedSales
      .filter(s => new Date(s.createdAt).toISOString().slice(0, 10) === today)
      .reduce((acc, s) => acc + s.totalSats, 0);
  }, [confirmedSales]);

  const toggleDay = (dateKey: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      next.has(dateKey) ? next.delete(dateKey) : next.add(dateKey);
      return next;
    });
  };

  const toggleSale = (saleId: string) => {
    setExpandedSales(prev => {
      const next = new Set(prev);
      next.has(saleId) ? next.delete(saleId) : next.add(saleId);
      return next;
    });
  };

  return (
    <div className="h-[100dvh] bg-vendly-cream flex flex-col overflow-hidden">

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-4 border-b border-vendly-border bg-vendly-cream/95"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
      >
        <button onClick={onBack} className="text-vendly-deep font-semibold text-sm">Back</button>
        <h1 className="text-lg font-bold text-vendly-ink">Sales</h1>
        <div className="w-12" />
      </div>

      {/* Summary cards */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="bg-vendly-light rounded-2xl p-4 border border-vendly-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-vendly-muted" />
            <p className="text-xs text-vendly-muted font-medium uppercase tracking-wide">Today</p>
          </div>
          <p className="text-xl font-bold text-vendly-ink">{formatNgnAmount(todayNgn)}</p>
          <p className="text-xs text-vendly-muted mt-0.5">{formatSats(todaySats)}</p>
        </div>

        <div className="bg-vendly-light rounded-2xl p-4 border border-vendly-border">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag size={16} className="text-vendly-muted" />
            <p className="text-xs text-vendly-muted font-medium uppercase tracking-wide">All time</p>
          </div>
          <p className="text-xl font-bold text-vendly-ink">{formatNgnAmount(allTimeNgn)}</p>
          <p className="text-xs text-vendly-muted mt-0.5">{confirmedSales.length} confirmed sale{confirmedSales.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Sales list grouped by day */}
      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4">
        {confirmedSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <img
              src={assetPath('illustrations/business-growth.svg')}
              alt=""
              className="w-full max-w-[290px] h-auto mb-4"
            />
            <h2 className="font-display font-semibold text-vendly-ink mb-1">No sales yet</h2>
            <p className="text-sm text-vendly-muted max-w-xs">Complete your first sale in Vendly and your daily revenue will appear here.</p>
          </div>
        ) : (
          dayGroups.map((group) => {
            const isDayExpanded = expandedDays.has(group.dateKey);

            return (
              <div key={group.dateKey} className="bg-vendly-light rounded-2xl border border-vendly-border overflow-hidden">

                {/* Day header — tap to expand/collapse */}
                <button
                  onClick={() => toggleDay(group.dateKey)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <div>
                    <p className="font-bold text-vendly-ink">{group.label}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-sm text-vendly-muted">{group.sales.length} sale{group.sales.length !== 1 ? 's' : ''}</p>
                      <span className="text-vendly-border">·</span>
                      <p className="text-sm text-vendly-muted">{group.itemsSold} item{group.itemsSold !== 1 ? 's' : ''}</p>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="font-bold text-vendly-ink">{formatNgnAmount(group.totalNgn)}</p>
                      <p className="text-xs text-vendly-muted">{formatSats(group.totalSats)}</p>
                    </div>
                    {isDayExpanded
                      ? <ChevronUp size={16} className="text-vendly-muted shrink-0" />
                      : <ChevronDown size={16} className="text-vendly-muted shrink-0" />
                    }
                  </div>
                </button>

                {/* Daily P&L breakdown */}
                {isDayExpanded && (
                  <div className="border-t border-vendly-border">

                    {/* P&L summary row */}
                    <div className="px-4 py-3 bg-vendly-cream flex items-center justify-between text-xs text-vendly-muted">
                      <span className="flex items-center gap-1">
                        <TrendingUp size={12} />
                        Revenue ({group.sales.length} transactions)
                      </span>
                      <span className="font-semibold text-vendly-ink">
                        {formatNgnAmount(group.totalNgn)}
                        {group.totalSats > 0 ? ` · ${formatSats(group.totalSats)}` : ''}
                      </span>
                    </div>

                    {/* Individual sales */}
                    <div className="divide-y divide-vendly-border">
                      {group.sales.map((sale) => {
                        const isSaleExpanded = expandedSales.has(sale.id);
                        const saleTime = new Date(sale.createdAt).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <div key={sale.id}>
                            {/* Sale row */}
                            <button
                              onClick={() => toggleSale(sale.id)}
                              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-vendly-cream transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-vendly-tint flex items-center justify-center shrink-0">
                                  <Package size={14} className="text-vendly-muted" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-vendly-ink">
                                    {sale.items.reduce((acc, i) => acc + i.quantity, 0)} item
                                    {sale.items.reduce((acc, i) => acc + i.quantity, 0) !== 1 ? 's' : ''}
                                  </p>
                                  <p className="text-xs text-vendly-muted">{saleTime} · {paymentMethodLabel(sale.paymentMethod)}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-vendly-ink">{formatNgnAmount(sale.totalNgn)}</p>
                                  <p className="text-xs text-vendly-muted">{formatSats(sale.totalSats)}</p>
                                </div>
                                {isSaleExpanded
                                  ? <ChevronUp size={14} className="text-vendly-muted" />
                                  : <ChevronDown size={14} className="text-vendly-muted" />
                                }
                              </div>
                            </button>

                            {/* Expanded sale items */}
                            {isSaleExpanded && (
                              <div className="px-4 pb-3 space-y-2 bg-vendly-cream">
                                {sale.items.map((item) => (
                                  <div key={item.id} className="flex items-center gap-3">
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-vendly-ink truncate">{item.name}</p>
                                      <p className="text-xs text-vendly-muted">Qty: {item.quantity}</p>
                                    </div>
                                    <p className="text-sm font-semibold text-vendly-ink shrink-0 text-right">
                                      {formatNgnAmount((item.priceNgn ?? 0) * item.quantity)}
                                      {item.pricesats > 0 && (
                                        <span className="block text-xs font-normal text-vendly-muted">
                                          {formatSats(item.pricesats * item.quantity)}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SalesPage;

