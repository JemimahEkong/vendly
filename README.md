# Vendly

Vendly is a merchant-first point-of-sale and business management app for everyday Nigerian traders.

It brings sales, inventory and payment records into one lightweight mobile experience, with a butter-cream and deep-green identity designed to feel calm, practical and local.

## What Vendly does

- **Point of sale** — add products to a cart, scan barcodes and take payment.
- **Inventory** — register products with prices, stock levels, barcodes and images.
- **Sales records** — review daily and all-time sales, with item-level detail.
- **Payments** — send and receive via the Breez SDK, with passkey or recovery-phrase access.
- **Installable app** — installable PWA with offline caching and a mobile-first shell.

Vendly is built on the existing Breez Spark integration. It does not introduce a separate payment backend or custody layer.

## Brand

The interface uses a fixed palette:

| Purpose | Colour |
| --- | --- |
| Primary deep green | `#173F2B` |
| Butter cream | `#F7F0D8` |
| Supporting green | `#386B4B` |
| Light cream surfaces | `#FFFDF5` |
| Primary text | `#243329` |
| Muted text | `#5C6B60` |
| Borders | `#DFE3D2` |
| Subtle green tint | `#EEF1E4` |

Brand assets live in `public/assets`, app icons in `public/icons`, and the six merchant illustrations in `public/illustrations`.

## Tech stack

- React 18 and TypeScript
- Vite 5
- Tailwind CSS 3
- Zustand with persistence
- Breez SDK Spark
- `vite-plugin-pwa`
- Vitest and Playwright

## Getting started

### Requirements

- Node.js 18 or newer
- npm (the repository includes `package-lock.json`)

### Install and run

```bash
npm ci
npm run dev
```

Vite prints the local development URL (normally `http://localhost:5173`).

### Production build

```bash
npm run build
npm run preview
```

### Checks

```bash
npm run lint
npm test
npm run test:e2e
```

The Playwright suite may require the wallet/faucet environment described in `e2e/` and `example.env`.

## Project structure

```text
public/
├── assets/          # Vendly logo suite and retained product images
├── icons/           # PWA icons and favicons
└── illustrations/   # Six custom merchant illustrations

src/
├── components/      # Shared UI, layout, navigation and payment surfaces
├── contexts/        # Wallet, contacts and toast providers
├── features/        # Send and receive payment flows
├── hooks/           # SDK, viewport and UI hooks
├── pages/           # Home, POS, inventory, sales, wallet, auth and settings
├── services/        # SDK-side and device services
├── store/           # Persistent product, cart and sales stores
├── test/            # Test setup and payment scenario tests
└── utils/           # Formatting and deposit helpers
```

## Payments and attribution

Payment functionality is powered by the [Breez SDK](https://sdk-doc-spark.breez.technology/). Breez integration and attribution are retained. Payment behaviour, wallet logic and local store schemas are unchanged by the visual rebrand.

## Licence

Vendly is released under the MIT License. See `LICENSE`.

The original Breez SDK licence is preserved in `THIRD_PARTY_NOTICES`. The Breez notice also remains in `src/LICENSE`.
