import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const outputDir = join(rootDir, 'public/icons');

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

const iconSource = join(rootDir, 'public/assets/vendly-app-icon.svg');
const maskableSource = join(rootDir, 'public/icons/vendly-app-icon-maskable.svg');
const faviconSource = join(rootDir, 'public/icons/vendly-favicon.svg');

const icons = [
  { source: iconSource, name: 'vendly-icon-192.png', size: 192 },
  { source: iconSource, name: 'vendly-icon-512.png', size: 512 },
  { source: maskableSource, name: 'vendly-icon-maskable-192.png', size: 192 },
  { source: maskableSource, name: 'vendly-icon-maskable-512.png', size: 512 },
  { source: iconSource, name: 'vendly-apple-touch-icon.png', size: 180 },
  { source: faviconSource, name: 'vendly-favicon.png', size: 32 },
];

async function generateIcons() {
  try {
    for (const { source, name, size } of icons) {
      await sharp(source)
        .resize(size, size, { fit: 'contain' })
        .png({ quality: 90, compressionLevel: 9 })
        .toFile(join(outputDir, name));
      console.log(`Created ${name} (${size}x${size})`);
    }
  } catch (error) {
    console.error('Error generating Vendly icons:', error);
    process.exit(1);
  }
}

generateIcons();
