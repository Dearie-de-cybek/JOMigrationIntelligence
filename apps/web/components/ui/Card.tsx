import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-lg border border-navy/10 bg-white p-6 shadow-sm ${className}`} {...props} />;
}
