import { Wizard } from '@/components/assessment/Wizard';

export const metadata = { title: 'Migration Readiness Assessment — JO Migration Intelligence' };

export default function AssessPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold text-navy">Migration Readiness Assessment</h1>
      <p className="mt-2 mb-8 text-ink/70">
        A guided, preliminary look at where you stand. It takes a few minutes and you can resume later.
      </p>
      <Wizard />
    </div>
  );
}
