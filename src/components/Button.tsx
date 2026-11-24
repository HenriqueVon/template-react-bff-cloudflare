import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary   : 'bg-primary-container text-on-primary hover:bg-primary shadow-sm',
  secondary : 'border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low shadow-sm',
  ghost     : 'bg-transparent text-primary hover:bg-surface-container',
  danger    : 'bg-error text-on-error hover:bg-error/90 shadow-sm',
};

const SIZES: Record<Size, string> = {
  sm : 'px-3 py-1.5 text-label-sm',
  md : 'px-4 py-2.5 text-label-md',
};

export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}
