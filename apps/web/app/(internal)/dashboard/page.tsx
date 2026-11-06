'use client';

import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/Card';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
      <p className="mt-1 text-sm text-ink/70">
        Welcome, {user?.fullName}. The operational dashboard (leads, cases, assessments awaiting review) is built in
        Phase 3 of the plan.
      </p>
      <Card className="mt-6">
        <p className="text-sm font-semibold text-navy">Signed in as</p>
        <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-ink/60">Name</dt>
          <dd>{user?.fullName}</dd>
          <dt className="text-ink/60">Email</dt>
          <dd>{user?.email}</dd>
          <dt className="text-ink/60">Role</dt>
          <dd>{user?.role.replace('_', ' ')}</dd>
        </dl>
      </Card>
    </div>
  );
}
