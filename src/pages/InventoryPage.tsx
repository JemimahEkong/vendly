import React, { useState } from 'react';
import { useProductStore } from '../store/useProductStore';
import { convertNgnToSats, formatCurrencyFromSats } from '../utils/formatCurrency';
import { ScanLine } from 'lucide-react';

interface InventoryPageProps {
  onBack: () => void;
}

const InventoryPage: React.FC<InventoryPageProps> = ({ onBack }) => {
  const { products, addProduct, removeProduct } = useProductStore();

  const [name, setName] = useState('');
  const [priceNgn, setPriceNgn] = useState('');
  const [stock, setStock] = useState('');
  const [barcode, setBarcode] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [barcodeError, setBarcodeError] = useState('');

  const handleAdd = () => {
    if (!name || !priceNgn || !barcode.trim() || !imageFile) return;

    if (products.some((p) => p.id === barcode.trim())) {
      setBarcodeError('A product with this barcode already exists.');
      return;
    }

    setBarcodeError('');
    const ngn = Number(priceNgn);

    addProduct({
      id: barcode.trim(),          // barcode becomes the product id
      name,
      image: imagePreview,
      priceNgn: ngn,
      pricesats: convertNgnToSats(ngn),
      stock: Number(stock) || 0,
    });

    setName('');
    setPriceNgn('');
    setStock('');
    setBarcode('');
    setImageFile(null);
    setImagePreview('');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const canAdd = name && priceNgn && barcode.trim() && imageFile;

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
      <div className="p-4 space-y-3 border-b border-vendly-border bg-vendly-light">
        <div className="mb-1">
          <h2 className="font-display font-semibold text-vendly-ink">Add a product</h2>
          <p className="text-xs text-vendly-muted mt-0.5">Keep your prices and stock up to date.</p>
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
          className="w-full border p-2 rounded text-vendly-ink placeholder-vendly-muted"
          value={priceNgn}
          onChange={(e) => setPriceNgn(e.target.value)}
        />

        <input
          placeholder="Stock quantity"
          type="number"
          min={0}
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
                barcodeError ? 'border-vendly-ink' : ''
              }`}
              value={barcode}
              onChange={(e) => {
                setBarcode(e.target.value);
                setBarcodeError('');
              }}
            />
          </div>
          {barcodeError
            ? <p className="text-xs text-vendly-deep">{barcodeError}</p>
            : <p className="text-xs text-vendly-muted">Type the barcode printed on the packaging — the POS scanner uses this to find the product.</p>
          }
        </div>

        <p className="text-xs text-vendly-muted">
          Upload product image (recommended: square image)
        </p>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="w-full border p-2 rounded text-vendly-ink"
        />
        {imagePreview && (
          <img
            src={imagePreview}
            alt="Preview"
            className="w-full h-40 object-cover rounded mt-2 border"
          />
        )}

        <button
          onClick={handleAdd}
          disabled={!canAdd}
          className="w-full bg-vendly-deep text-vendly-light p-2 rounded disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add Product
        </button>
      </div>

      {/* Product list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <img
              src="/illustrations/inventory.svg"
              alt=""
              className="w-full max-w-[280px] h-auto mb-4"
            />
            <h2 className="font-display font-semibold text-vendly-ink mb-1">Your shelves are empty</h2>
            <p className="text-sm text-vendly-muted max-w-xs">Add your first product above to start selling with Vendly.</p>
          </div>
        )}
        {products.map((p) => (
          <div key={p.id} className="bg-vendly-light border border-vendly-border rounded-2xl p-3 flex gap-3 items-center">
            <img src={p.image} alt={p.name} className="w-14 h-14 object-cover rounded shrink-0" />

            <div className="flex-1 min-w-0">
              <p className="font-medium text-vendly-ink truncate">{p.name}</p>
              <p className="text-sm font-semibold text-vendly-ink">{formatCurrencyFromSats(p.pricesats)}</p>
              <p className="text-xs text-vendly-muted">{p.stock ?? 0} in stock</p>
              <p className="text-[10px] font-mono text-vendly-muted/70 truncate">#{p.id}</p>
            </div>

            <button
              onClick={() => removeProduct(p.id)}
              className="text-vendly-muted hover:text-vendly-ink text-xs font-semibold shrink-0 px-2 py-1 rounded-lg hover:bg-vendly-tint transition-colors"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InventoryPage;
