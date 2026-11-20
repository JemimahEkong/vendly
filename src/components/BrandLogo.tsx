import React, { useState } from 'react';
import { assetPath } from '@/utils/assetPath';

interface VendlyMarkProps {
  className?: string;
}

/** Inline Vendly mark used when an image request fails. */
export const VendlyMark: React.FC<VendlyMarkProps> = ({ className = 'w-10 h-10' }) => (
  <svg
    viewBox="0 0 56 56"
    className={className}
    role="img"
    aria-label="Vendly"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="2" y="2" width="52" height="52" rx="14" fill="#173F2B" />
    <path
      d="M14 18.5 26.1 39.7c1.2 2.1 4.6 2.1 5.8 0L36 31.5l8.2-13"
      fill="none"
      stroke="#F7F0D8"
      strokeWidth="6.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M37 13h9v9"
      fill="none"
      stroke="#F7F0D8"
      strokeWidth="4.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface BrandLogoProps {
  className?: string;
  /** Reverse logo for dark green surfaces. */
  variant?: 'default' | 'light';
  onClick?: () => void;
  label?: string;
}

/**
 * Vendly logo with a graceful inline fallback.
 *
 * If the SVG request fails (stale deployment, blocked asset, bad base path),
 * the fallback keeps the wordmark visible instead of showing broken-image
 * alt text or an empty gap.
 */
const BrandLogo: React.FC<BrandLogoProps> = ({
  className = 'h-10 w-auto',
  variant = 'default',
  onClick,
  label = 'Vendly',
}) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`inline-flex items-center gap-2 ${className}`}
        role="img"
        aria-label={label}
        onClick={onClick}
      >
        <VendlyMark className="h-full w-auto" />
        <span
          className={`font-display font-bold tracking-[0.08em] ${
            variant === 'light' ? 'text-vendly-cream' : 'text-vendly-deep'
          }`}
        >
          VENDLY
        </span>
      </span>
    );
  }

  return (
    <img
      src={assetPath(variant === 'light' ? 'assets/vendly-logo-light.svg' : 'assets/vendly-logo.svg')}
      alt={label}
      className={className}
      onClick={onClick}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
};

export default BrandLogo;
