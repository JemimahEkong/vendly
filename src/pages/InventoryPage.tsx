import React, { useRef, useState } from 'react';
import { useProductStore } from '../store/useProductStore';
import type { Product } from '../store/useProductStore';
import { convertNgnToSats, formatNgnAmount } from '../utils/formatCurrency';
import { ngnToKobo } from '../services/exchangeRate';
import { fileToProductImage } from '../utils/productImage';
import { ScanLine, Pencil, X } from 'lucide-react';
import { assetPath } from '@/utils/assetPath';
import ProductImage from '../components/ProductImage';

interface InventoryPageProps {
  onBack: () => void;
}

const InventoryPage: React.FC<InventoryPageProps> = ({ onBack }) => {
  const { products, addProduct, updateProduct, removeProduct } = useProductStore();
  const formRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState('');
  const [priceNgn, setPriceNgn] = useState('');
  const [stock, setStock] = useState('');
  const [barcode, setBarcode] = useState('');
  const [imageData, setImageData] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const resetForm = () => {
    setName('');
    setPriceNgn('');
    setStock('');
    setBarcode('');
    setImageData('');
    setEditingId(null);
    setError('');
  };

  const beginEdit = (product: Product) => {
    setEditingId(product.id);
    setName(product.name);
    setPriceNgn((product.priceNgn / 100).toString());
    setStock(String(product.stock));
    setBarcode(product.id);
    setImageData(product.image);
    setError('');
    setStatus('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setIsProcessingImage(true);
    try {
      const dataUrl = await fileToProductImage(file);
      setImageData(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that image.');
    } finally {
      setIsProcessingImage(false);
      // Allow re-selecting the same file after an error.
      e.target.value = '';
    }
  };

  const handleSubmit = () => {
    setError('');
    setStatus('');

    const trimmedName = name.trim();
    const trimmedBarcode = barcode.trim();
    const ngn = Number(priceNgn);

    if (!trimmedName) {
      setError('Enter a product name.');
      return;
    }
    if (!trimmedBarcode) {
      setError('Enter the barcode printed on the product.');
      return;
    }
    if (!priceNgn || !Number.isFinite(ngn) || ngn < 0) {
      setError('Enter a valid selling price in Naira.');
      return;
    }

    if (!editingId && products.some((p) => p.id === trimmedBarcode)) {
      setError('A product with this barcode already exists.');
      return;
    }

    const priceKobo = ngnToKobo(ngn);
    const stockValue = Math.max(0, Math.floor(Number(stock) || 0));

    if (editingId) {
      updateProduct(editingId, {
        name: trimmedName,
        priceNgn: priceKobo,
        pricesats: convertNgnToSats(ngn),
        stock: stockValue,
        image: imageData,
      });
      setStatus(`Saved changes to ${trimmedName}.`);
      resetForm();
      return;
    }

    addProduct({
      id: trimmedBarcode,
      name: trimmedName,
      image: imageData,
      priceNgn: priceKobo,
      pricesats: convertNgnToSats(ngn),
      stock: stockValue,
    });
    setStatus(`${trimmedName} added to inventory.`);
    resetForm();
  };

  const handleRemove = (product: Product) => {
    removeProduct(product.id);
    if (editingId === product.id) resetForm();
    setStatus(`${product.name} removed.`);
  };

  const canSubmit =
    Boolean(name.trim()) && Boolean(priceNgn) && Boolean(barcode.trim()) && !isProcessingImage;

  return (
    <div className="h-[100dvh] bg-vendly-cream flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-4 border-b border-vendly-border bg-vendly-cream/95"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
      >
        <button onClick={onBack} className="text-vendly-deep font-semibold text-sm">Back</button>
        <h1 className="text-lg font-bold text-vendly-ink">Inventory</h1>
        <div className="w-12" />
      </div>

      {/* Form */}
      <div ref={formRef} className="p-4 space-y-3 border-b border-vendly-border bg-vendly-light">
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-vendly-ink">
              {editingId ? 'Edit product' : 'Add a product'}
            </h2>
            <p className="text-xs text-vendly-muted mt-0.5">
              {editingId
                ? 'Update the name, price, stock or photo.'
                : 'Keep your prices and stock up to date.'}
            </p>
          </div>
          {editingId && (
            <button
              onClick={resetForm}
              className="flex items-center gap-1 text-xs font-semibold text-vendly-muted px-2 py-1 rounded-lg hover:bg-vendly-tint"
            >
              <X size={14} /> Cancel
            </button>
          )}
        </div>

        <input
          placeholder="Product name"
          className="w-full border p-2 rounded text-vendly-ink placeholder-vendly-muted"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          placeholder="Price in Naira"
          type="number"
          min={0}
          step="0.01"
          className="w-full border p-2 rounded text-vendly-ink placeholder-vendly-muted"
          value={priceNgn}
          onChange={(e) => setPriceNgn(e.target.value)}
        />

        <input
          placeholder="Stock quantity"
          type="number"
          min={0}
          step="1"
          className="w-full border p-2 rounded text-vendly-ink placeholder-vendly-muted"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />

        {/* Barcode — this becomes the product id that the scanner matches against */}
        <div className="space-y-1">
          <div className="relative">
            <ScanLine size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-vendly-border" />
            <input
              placeholder="Barcode (e.g. 6156000211626)"
              className={`w-full border p-2 pl-9 rounded font-mono text-vendly-ink placeholder-vendly-muted ${
                editingId ? 'opacity-60' : ''
              }`}
              value={barcode}
              disabled={Boolean(editingId)}
              onChange={(e) => {
                setBarcode(e.target.value);
                setError('');
              }}
            />
          </div>
          <p className="text-xs text-vendly-muted">
            {editingId
              ? 'The barcode is the product ID and cannot be changed. Remove and re-add the product to use a different barcode.'
              : 'Type the barcode printed on the packaging — the POS scanner uses this to find the product.'}
          </p>
        </div>

        <p className="text-xs text-vendly-muted">
          Upload product image (recommended: square image). A placeholder is used if none is chosen.
        </p>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="w-full border p-2 rounded text-vendly-ink"
        />
        {isProcessingImage && (
          <p className="text-xs text-vendly-muted">Processing image…</p>
        )}
        {imageData && (
          <img
            src={imageData}
            alt="Preview"
            className="w-full h-40 object-cover rounded mt-2 border"
          />
        )}

        {error && <p className="text-xs text-vendly-deep">{error}</p>}
        {status && <p className="text-xs text-vendly-success">{status}</p>}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full bg-vendly-deep text-vendly-light p-2 rounded disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {editingId ? 'Save changes' : 'Add Product'}
        </button>
      </div>

      {/* Product list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <img
              src={assetPath('illustrations/inventory.svg')}
              alt=""
              className="w-full max-w-[280px] h-auto mb-4"
            />
            <h2 className="font-display font-semibold text-vendly-ink mb-1">Your shelves are empty</h2>
            <p className="text-sm text-vendly-muted max-w-xs">Add your first product above to start selling with Vendly.</p>
          </div>
        )}
        {products.map((p) => (
          <div key={p.id} className="bg-vendly-light border border-vendly-border rounded-2xl p-3 flex gap-3 items-center">
            <ProductImage
              src={p.image}
              alt={p.name}
              className="w-14 h-14 object-cover rounded shrink-0"
            />

            <div className="flex-1 min-w-0">
              <p className="font-medium text-vendly-ink truncate">{p.name}</p>
              <p className="text-sm font-semibold text-vendly-ink">{formatNgnAmount(p.priceNgn)}</p>
              <p className="text-xs text-vendly-muted">
                {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
              </p>
              <p className="text-[10px] font-mono text-vendly-muted/70 truncate">#{p.id}</p>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              <button
                onClick={() => beginEdit(p)}
                className="flex items-center gap-1 text-vendly-ink text-xs font-semibold px-2 py-1 rounded-lg hover:bg-vendly-tint transition-colors"
              >
                <Pencil size={12} /> Edit
              </button>
              <button
                onClick={() => handleRemove(p)}
                className="text-vendly-muted hover:text-vendly-ink text-xs font-semibold px-2 py-1 rounded-lg hover:bg-vendly-tint transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InventoryPage;
