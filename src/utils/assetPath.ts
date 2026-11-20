/**
 * Resolve a public asset against the deployed Vite base URL.
 *
 * Public assets must not be hardcoded with a leading slash: a build served
 * under a sub-path (for example GitHub Pages at /vendly/) would otherwise
 * request /assets/... from the domain root and show broken-image alt text.
 */
export function assetPath(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${path.replace(/^\/+/, '')}`;
}
