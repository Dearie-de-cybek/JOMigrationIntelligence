'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { INTERNAL_ROLES } from '@jo/schemas';
import { useAuth } from '@/lib/auth-context';

/**
 * Client-side gate for the staff app: redirects an unauthenticated or
 * non-staff visitor away before rendering. This is a UX convenience, not
 * the security boundary - every API route behind this UI independently
 * enforces JwtAuthGuard + RolesGuard on the backend regardless of what the
 * frontend shows.
 */
export default function InternalLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !INTERNAL_ROLES.includes(user.role)) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user || !INTERNAL_ROLES.includes(user.role)) {
    return <div className="flex min-h-dvh items-center justify-center text-ink/60">Loading…</div>;
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-60 flex-col justify-between border-r border-navy/10 bg-navy px-5 py-6 text-white">
        <div>
          <p className="font-bold">JO Migration Intelligence</p>
          <nav className="mt-8 flex flex-col gap-1 text-sm">
            <a href="/dashboard" className="rounded-md px-3 py-2 font-semibold hover:bg-white/10">
              Dashboard
            </a>
          </nav>
        </div>
        <div className="text-xs text-white/70">
          <p className="font-semibold text-white">{user.fullName}</p>
          <p>{user.role.replace('_', ' ')}</p>
          <button
            type="button"
            onClick={() => {
              void logout().then(() => router.replace('/login'));
            }}
            className="mt-3 font-semibold text-white/80 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-background p-8">{children}</main>
    </div>
  );
}
