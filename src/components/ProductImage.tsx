import React, { useState } from 'react';
import { PRODUCT_IMAGE_PLACEHOLDER } from '../utils/productImage';

interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
}

/**
 * Product thumbnail that always renders something: falls back to a neutral
 * placeholder when the stored image is missing or fails to load.
 */
const ProductImage: React.FC<ProductImageProps> = ({ src, alt, className = '' }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolved = !src || failedSrc === src ? PRODUCT_IMAGE_PLACEHOLDER : src;

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      onError={() => setFailedSrc(src ?? null)}
    />
  );
};

export default ProductImage;
