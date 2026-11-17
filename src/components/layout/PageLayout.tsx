import React, { ReactNode } from 'react';
import { BackIcon } from '../Icons';

interface PageLayoutProps {
  children: ReactNode;
  footer: ReactNode
  onBack: () => void | null;
  title?: string;
  showHeader?: boolean;
  onClearError?: () => void;
}

const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  title,
  footer,
  onBack = null,
  showHeader = true,
}) => {
  return (
    <div className="min-h-dvh h-dvh w-full flex flex-col bg-vendly-cream relative">
      {showHeader && (
        <header
          className="relative z-10 flex-shrink-0 border-b border-vendly-border bg-vendly-cream/95"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="relative px-4 py-4 flex items-center justify-center">
            <h1 className="text-center font-display text-xl font-bold text-vendly-ink">
              {title || 'Vendly'}
            </h1>
            {onBack && (
              <button
                onClick={onBack}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-vendly-ink hover:text-vendly-deep rounded-lg hover:bg-vendly-tint transition-colors"
                aria-label="Go back"
              >
                <BackIcon />
              </button>
            )}
          </div>
        </header>
      )}

      {/* Scrollable content area */}
      <main 
        className="relative z-10 flex-1 w-full overflow-y-auto p-4 bg-vendly-cream"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </main>

      {/* Fixed footer */}
      {footer && (
        <footer
          className="relative z-10 flex-shrink-0 w-full border-t border-vendly-border bg-vendly-light"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="px-4 py-4">
            {footer}
          </div>
        </footer>
      )}
    </div>
  );
};

export default PageLayout;