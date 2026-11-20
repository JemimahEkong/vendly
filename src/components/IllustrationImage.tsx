import React, { useState } from 'react';
import { assetPath } from '@/utils/assetPath';
import { VendlyMark } from './BrandLogo';

interface IllustrationImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Decorative illustrations keep an empty alt; meaningful ones describe the scene. */
  decorative?: boolean;
}

/**
 * Illustration image with a branded fallback card.
 *
 * Broken illustrations must never expose alt text in place of the design, so
 * a failed request is replaced with the Vendly mark inside a placeholder.
 */
const IllustrationImage: React.FC<IllustrationImageProps> = ({
  src,
  alt,
  className = 'w-full h-auto',
  decorative = false,
}) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`${className} flex aspect-[4/3] items-center justify-center rounded-[26px] border border-vendly-border bg-vendly-light`}
        role="img"
        aria-label={decorative ? undefined : alt}
        aria-hidden={decorative || undefined}
      >
        <VendlyMark className="w-16 h-16 opacity-80" />
      </div>
    );
  }

  return (
    <img
      src={assetPath(src)}
      alt={decorative ? '' : alt}
      className={className}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
};

export default IllustrationImage;
