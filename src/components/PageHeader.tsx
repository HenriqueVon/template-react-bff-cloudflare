import type { ReactNode } from 'react';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="mb-1 text-headline-lg-mobile text-on-surface md:text-headline-xl">{title}</h1>
        {description && <p className="text-body-md text-on-surface-variant">{description}</p>}
      </div>
      {actions && <div className="flex w-full gap-3 md:w-auto">{actions}</div>}
    </div>
  );
}
