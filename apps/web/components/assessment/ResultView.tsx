import type { AssessmentResultView } from '@/lib/assessment-api';
import { Card } from '@/components/ui/Card';

// Plain-language labels. These are preliminary indications, never decisions.
export const STATUS_LABEL: Record<string, string> = {
  NOT_YET_ASSESSED: 'Not yet assessed',
  PROFILE_INCOMPLETE: 'Profile incomplete',
  REQUIRES_REVIEW: 'Requires further review',
  POTENTIALLY_SUITABLE: 'Potentially suitable for further assessment',
  ADDITIONAL_REQUIREMENTS: 'Additional requirements identified',
  NOT_MATCHING: 'Not currently matching configured criteria',
};

const STATE_LABEL = { MET: 'Met', NOT_MET: 'Not met', UNKNOWN: 'Needs information' } as const;

export function ResultView({ result }: { result: AssessmentResultView }) {
  const d = result.details;
  return (
    <div className="space-y-6">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue">Preliminary readiness indication</p>
        <h2 className="mt-2 text-2xl font-bold text-navy">{STATUS_LABEL[result.status] ?? result.status}</h2>
        <p className="mt-1 text-sm text-ink/70">
          {result.pathway.name} ({result.pathway.destination.replace('_', ' ').toLowerCase()})
          {result.reviewedByStaff && ' · reviewed by a JO consultant'}
        </p>
        {result.status === 'NOT_YET_ASSESSED' && (
          <p className="mt-3 text-sm text-ink/80">
            Official requirements for this pathway have not been configured yet, so we cannot give a result. A JO
            consultant will review your profile.
          </p>
        )}
        {result.totalPoints !== null && (
          <p className="mt-3 text-sm">
            Points estimate: <strong>{result.totalPoints}</strong>
            {d.passMark !== null && <> (configured pass mark {d.passMark})</>}
          </p>
        )}
      </Card>

      {d.breakdown.length > 0 && (
        <Card>
          <h3 className="font-semibold text-navy">Points breakdown</h3>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {d.breakdown.map((b) => (
                <tr key={b.factorId} className="border-t border-navy/10">
                  <td className="py-2 pr-4">{b.label}</td>
                  <td className="py-2 pr-4 text-ink/60">{b.reason}</td>
                  <td className="py-2 text-right font-semibold">{b.points ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {d.requirements.length > 0 && (
        <Card>
          <h3 className="font-semibold text-navy">Requirements checked</h3>
          <ul className="mt-3 divide-y divide-navy/10 text-sm">
            {d.requirements.map((r) => (
              <li key={r.requirementId} className="py-2">
                <div className="flex justify-between gap-4">
                  <span>{r.label}</span>
                  <span className={r.state === 'MET' ? 'text-green-700' : r.state === 'NOT_MET' ? 'text-red-700' : 'text-ink/60'}>
                    {STATE_LABEL[r.state]}
                  </span>
                </div>
                {r.documents.length > 0 && (
                  <p className="mt-1 text-xs text-ink/60">Documents that may be needed: {r.documents.join(', ')}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {d.missingInformation.length > 0 && (
        <Card>
          <h3 className="font-semibold text-navy">Outstanding information</h3>
          <p className="mt-2 text-sm text-ink/70">{d.missingInformation.join(', ')}</p>
        </Card>
      )}

      <Card>
        <h3 className="font-semibold text-navy">How this result was produced</h3>
        <ul className="mt-2 list-disc pl-5 text-sm text-ink/80">
          {d.explanation.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink/60">
          Rule version: {result.ruleSetVersion ?? 'none'} · Generated {new Date(result.generatedAt).toLocaleString()}
        </p>
      </Card>

      <Card className="bg-light">
        <h3 className="font-semibold text-navy">Important</h3>
        <ul className="mt-2 list-disc pl-5 text-xs text-ink/80">
          {result.disclaimers.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
