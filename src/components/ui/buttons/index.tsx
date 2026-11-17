import React, { ReactNode } from 'react';

/**
 * Button components for consistent action styling across the app.
 */

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

export const PrimaryButton: React.FC<ButtonProps> = ({
  onClick,
  disabled = false,
  children,
  className = "",
  ...props
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`button bg-vendly-deep text-vendly-light hover:bg-vendly-green ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const SecondaryButton: React.FC<ButtonProps> = ({
  onClick,
  disabled = false,
  children,
  className = "",
  ...props
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`py-3 font-display font-semibold text-vendly-ink border border-vendly-border rounded-xl hover:text-vendly-ink hover:border-vendly-green transition-colors disabled:opacity-50 ${className}`}
    {...props}
  >
    {children}
  </button>
);

export interface FloatingIconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  onClick?: () => void;
  icon: ReactNode;
  className?: string;
}

export const FloatingIconButton: React.FC<FloatingIconButtonProps> = ({
  onClick,
  icon,
  className = "",
  ...props
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`p-3 rounded-full bg-vendly-light hover:bg-vendly-tint text-vendly-ink backdrop-blur-sm transition-colors border border-vendly-border ${className}`}
    {...props}
  >
    {icon}
  </button>
);

export const TextButton: React.FC<Omit<ButtonProps, 'disabled'>> = ({
  onClick,
  children,
  className = "",
  ...props
}) => (
  <button
    onClick={onClick}
    className={`text-vendly-muted text-xs hover:text-vendly-ink transition-colors ${className}`}
    {...props}
  >
    {children}
  </button>
);