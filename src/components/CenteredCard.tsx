import type { ReactNode } from 'react';

// A card in the middle of the page, for the screens outside the app shell: login, no access, errors.
export function CenteredCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center">
        <h1 className="text-headline-lg text-primary-container">{title}</h1>
        {children}
      </div>
    </main>
  );
}
