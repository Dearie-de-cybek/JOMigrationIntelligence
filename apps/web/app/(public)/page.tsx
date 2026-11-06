import Link from 'next/link';
import { Card } from '@/components/ui/Card';

export default function PublicHomePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-sm font-semibold uppercase tracking-wide text-blue">Skilled migration, assessed properly</p>
      <h1 className="mt-4 text-4xl font-bold text-navy">JO Migration Intelligence</h1>
      <p className="mt-6 text-lg text-ink/80">
        A guided readiness assessment for skilled migration to Australia, New Zealand and Canada is being built here.
        It will cover your profile, occupation and language test results, and produce a preliminary report you can act
        on or discuss with a JO consultant.
      </p>
      <Card className="mt-10">
        <p className="font-semibold text-navy">Migration Readiness Assessment</p>
        <p className="mt-2 text-sm text-ink/70">
          A guided, preliminary look at your readiness. It is not an immigration decision or professional advice.
        </p>
        <Link href="/assess" className="mt-4 inline-block text-sm font-semibold text-blue hover:text-navy">
          Start your assessment →
        </Link>
      </Card>
    </div>
  );
}
