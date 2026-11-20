import React, { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Transition } from '@headlessui/react';
import { isPasskeyMode } from '@/services/passkeyService';
import BrandLogo from './BrandLogo';
import { RefundIcon, BackupIcon, SettingsIcon, POSIcon, SalesIcon, InventoryIcon, LogoutIcon, CloseIcon, AlertTriangleIcon } from './Icons';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenBackup: () => void;
  onOpenPOS: () => void;
  onOpenSales: () => void;
  onOpenInventory: () => void;
  onOpenRefund?: () => void;
  hasRejectedDeposits?: boolean;
}

const SideMenu: React.FC<SideMenuProps> = ({ isOpen, onClose, onLogout, onOpenSettings, onOpenBackup, onOpenPOS, onOpenSales, onOpenInventory, onOpenRefund, hasRejectedDeposits = false }) => {
  const [leftOffset, setLeftOffset] = useState<number | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isPasskey = isPasskeyMode();


  useEffect(() => {
    const calc = () => {
      const el = document.getElementById('content-root');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setLeftOffset(rect.left);
    };
    calc();
    window.addEventListener('resize', calc);
    window.addEventListener('scroll', calc, true);
    return () => {
      window.removeEventListener('resize', calc);
      window.removeEventListener('scroll', calc, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = document.getElementById('content-root');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setLeftOffset(rect.left);
  }, [isOpen]);

  const menuItems = [
    // Get Refund - only show when there are rejected deposits
    ...(hasRejectedDeposits && onOpenRefund ? [{
      icon: <RefundIcon />,
      label: 'Get Refund',
      onClick: () => { onOpenRefund(); onClose(); },
      highlight: true
    }] : []),
    {
      icon: <POSIcon />,
      label: 'New sale',
      onClick: () => { onOpenPOS(); onClose(); }
    },
    {
      icon: <SalesIcon />,
      label: 'Sales',
      onClick: () => { onOpenSales(); onClose(); }
    },
    {
      icon: <InventoryIcon />,
      label: 'Inventory',
      onClick: () => { onOpenInventory(); onClose(); }
    },
    {
      icon: <BackupIcon />,
      label: 'Backup',
      onClick: () => { onOpenBackup(); onClose(); }
    },
    {
      icon: <SettingsIcon />,
      label: 'Settings',
      onClick: () => { onOpenSettings(); onClose(); }
    },
    {
      icon: <LogoutIcon />,
      label: 'Log out',
      onClick: () => { setShowLogoutConfirm(true); }
    }
  ];

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    onClose();
    onLogout();
  };

  return createPortal(
    <Transition show={isOpen} as="div" className="fixed inset-0 z-50">
      {/* Backdrop */}
      <Transition.Child
        as="div"
        enter="transition-opacity ease-out duration-200"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity ease-in duration-150"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        className="fixed inset-0"
      >
        <div className="fixed inset-0 bg-vendly-deep/55 backdrop-blur-sm" onClick={onClose} />
      </Transition.Child>

      {/* Panel */}
      {leftOffset !== null && (
        <div
          className="fixed top-0 bottom-0 w-72 overflow-hidden"
          style={{ left: leftOffset }}
        >
          <Transition.Child
            as="div"
            enter="transition transform ease-out duration-300"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition transform ease-in duration-200"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
            className="w-72 h-full bg-vendly-light/95 border-r border-vendly-border shadow-glass-lg px-6 flex flex-col"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-8 pt-6">
              <BrandLogo className="h-9 w-auto" />
              <button
                onClick={onClose}
                className="p-2 -mr-2 text-vendly-muted hover:text-vendly-ink rounded-lg hover:bg-vendly-tint/60 transition-colors"
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Navigation */}
            <nav className="space-y-1 flex-1">
              {menuItems.map((item, index) => (
                <button
                  key={index}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    ('highlight' in item && item.highlight)
                      ? 'text-vendly-muted hover:text-vendly-muted hover:bg-vendly-muted/10'
                      : 'text-vendly-ink hover:text-vendly-ink hover:bg-vendly-tint/60'
                  }`}
                  onClick={item.onClick}
                >
                  {item.icon}
                  <span className="font-display font-medium">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Footer */}
            <div className="pt-6 pb-6 border-t border-vendly-border">
              <p className="text-xs text-vendly-muted text-center">
                Vendly · Payments by Breez
              </p>
            </div>

            {/* Logout Confirmation Dialog */}
            <Transition show={showLogoutConfirm} as="div" className="fixed inset-0 z-60">
              <Transition.Child
                as="div"
                enter="transition-opacity ease-out duration-150"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="transition-opacity ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
                className="fixed inset-0 bg-vendly-deep/60"
                onClick={() => setShowLogoutConfirm(false)}
              />
              <div className="fixed inset-0 flex items-center justify-center p-4">
                <Transition.Child
                  as="div"
                  enter="transition transform ease-out duration-200"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="transition transform ease-in duration-150"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                  className="w-full max-w-sm bg-vendly-light border border-vendly-border rounded-2xl p-6 shadow-glass-lg"
                >
                  {/* Warning Icon */}
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 rounded-full bg-vendly-tint flex items-center justify-center">
                      <AlertTriangleIcon className="w-7 h-7 text-vendly-muted" />
                    </div>
                  </div>

                  <h3 className="font-display text-lg font-semibold text-vendly-ink text-center mb-2">
                    Log out of Vendly?
                  </h3>
                  <p className="text-vendly-muted text-sm text-center mb-6">
                    {isPasskey
                      ? "You'll need to authenticate with the same passkey to open your business account again."
                      : "Make sure you've saved your recovery phrase. You'll need it to access your account again."}
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowLogoutConfirm(false)}
                      className="flex-1 px-4 py-3 border border-vendly-border text-vendly-ink rounded-xl font-medium hover:text-vendly-ink hover:border-vendly-green transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmLogout}
                      className="flex-1 px-4 py-3 bg-vendly-ink text-vendly-light rounded-xl font-medium hover:bg-vendly-ink/90 transition-colors"
                    >
                      Log out
                    </button>
                  </div>
                </Transition.Child>
              </div>
            </Transition>
          </Transition.Child>
        </div>
      )}
    </Transition>,
    document.body
  );
};

export default SideMenu;
