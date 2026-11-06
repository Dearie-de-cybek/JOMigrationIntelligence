import type { ReactNode } from 'react';
import Link from 'next/link';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-navy/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-bold text-navy">
            JO Migration Intelligence
          </Link>
          <Link href="/login" className="text-sm font-semibold text-blue hover:text-navy">
            Staff sign in
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
