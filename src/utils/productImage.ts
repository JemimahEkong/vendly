/**
 * Product image helpers.
 *
 * Uploaded images are stored as compressed data URLs so they survive a page
 * refresh (blob: URLs are tied to the current document and do not persist).
 */

const PLACEHOLDER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="#EFEBDD"/>
  <path d="M100 48l52 24v56l-52 24-52-24V72z" fill="none" stroke="#2F4A3C" stroke-width="6" stroke-linejoin="round"/>
  <path d="M48 72l52 24 52-24M100 96v56" fill="none" stroke="#2F4A3C" stroke-width="6" stroke-linejoin="round"/>
</svg>`;

export const PRODUCT_IMAGE_PLACEHOLDER = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  PLACEHOLDER_SVG.trim()
)}`;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 640;
const JPEG_QUALITY = 0.82;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Read an image file and return a compressed data URL (max 640px on the long
 * edge). Falls back to the raw data URL if canvas processing is unavailable.
 */
export async function fileToProductImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Image is too large. Please choose a file under 10 MB.');
  }

  const rawDataUrl = await readAsDataUrl(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not decode the selected image.'));
      img.src = rawDataUrl;
    });

    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    if (longestSide === 0) return rawDataUrl;

    const scale = Math.min(1, MAX_DIMENSION / longestSide);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return rawDataUrl;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const compressed = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    // Keep the raw file if compression produced something unusable/larger.
    return compressed.startsWith('data:image/') ? compressed : rawDataUrl;
  } catch {
    return rawDataUrl;
  }
}
