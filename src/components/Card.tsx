import type { ReactNode } from 'react';

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-[0_4px_20px_-5px_rgba(30,27,75,0.04)] ${className}`}>
      {children}
    </div>
  );
}
