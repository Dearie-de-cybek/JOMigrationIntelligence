'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ApiError } from '@/lib/api-client';
import { assessmentApi, type AssessmentResultView, type Pathway, type Question } from '@/lib/assessment-api';
import { ResultView } from './ResultView';

const NOTICE_VERSION = 'draft-1'; // replace with the approved privacy notice version
const STORE_KEY = 'jo-assessment';
const STEPS = ['Start', 'About you', 'Education', 'Employment', 'English', 'Pathway', 'Review'] as const;

type Row = Record<string, string>;
type Errors = Record<string, string[] | undefined>;

const blank = {
  education: { qualification: '', fieldOfStudy: '', institution: '', country: '', graduationYear: '' },
  employment: { jobTitle: '', occupation: '', employer: '', country: '', employmentType: '', startDate: '', endDate: '' },
  language: { testType: 'IELTS', testDate: '', listening: '', reading: '', writing: '', speaking: '', overall: '' },
};

/** Drop empty strings so optional fields validate as absent, not invalid. */
const clean = (r: Row) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== ''));

export function Wizard() {
  const [step, setStep] = useState(0);
  const [pathways, setPathways] = useState<Pathway[] | null>(null);
  const [session, setSession] = useState<{ id: string; token: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Errors>({});
  const [result, setResult] = useState<AssessmentResultView | null>(null);

  const [start, setStart] = useState({ pathwayId: '', fullName: '', email: '', phone: '', consent: false, marketing: false });
  const [personal, setPersonal] = useState<Row>({ dateOfBirth: '', countryOfResidence: '', nationality: '', relationshipStatus: '' });
  const [education, setEducation] = useState<Row[]>([{ ...blank.education }]);
  const [employment, setEmployment] = useState<Row[]>([{ ...blank.employment }]);
  const [language, setLanguage] = useState<Row[]>([{ ...blank.language }]);
  const [questions, setQuestions] = useState<{ configured: boolean; list: Question[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number | boolean | null>>({});
  const [resumeLink, setResumeLink] = useState<string | null>(null);

  useEffect(() => {
    assessmentApi.pathways().then(setPathways).catch(() => setPathways([]));
    // Resume from a link fragment (never sent to the server) or this browser's saved session.
    const frag = new URLSearchParams(window.location.hash.slice(1)).get('resume');
    let token = frag;
    if (!token) {
      try {
        token = (JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as { token?: string } | null)?.token ?? null;
      } catch {
        token = null;
      }
    }
    if (token) {
      assessmentApi
        .resume(token)
        .then((a) => {
          setSession({ id: a.id, token: token! });
          setAnswers(a.answers ?? {});
          setStart((s) => ({ ...s, pathwayId: a.pathway.id }));
          if (a.status === 'SUBMITTED') {
            assessmentApi.result(a.id, token!).then(setResult);
          } else setStep(1);
        })
        .catch(() => localStorage.removeItem(STORE_KEY));
    }
  }, []);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : e.message);
        setFieldErrors(e.fieldErrors ?? {});
      } else setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  const err = (k: string) => fieldErrors[k]?.[0];

  const onStart = () =>
    run(async () => {
      const r = await assessmentApi.start({
        pathwayId: start.pathwayId,
        fullName: start.fullName,
        email: start.email,
        phone: start.phone || undefined,
        consentAssessment: start.consent,
        consentMarketing: start.marketing,
        noticeVersion: NOTICE_VERSION,
      });
      localStorage.setItem(STORE_KEY, JSON.stringify({ token: r.resumeToken }));
      setSession({ id: r.assessmentId, token: r.resumeToken });
      setResumeLink(`${window.location.origin}${window.location.pathname}#resume=${r.resumeToken}`);
      setStep(1);
    });

  const saveProfileAnd = (body: unknown, next: number) =>
    run(async () => {
      await assessmentApi.saveProfile(session!.id, session!.token, body);
      setStep(next);
    });

  const goPathway = () =>
    run(async () => {
      await assessmentApi.saveProfile(session!.id, session!.token, {
        languageTests: language.filter((l) => l.overall || l.listening).map(clean),
      });
      const q = await assessmentApi.questions(session!.id, session!.token);
      setQuestions({ configured: q.configured, list: q.questions });
      setStep(5);
    });

  const onSubmit = () =>
    run(async () => {
      await assessmentApi.saveAnswers(session!.id, session!.token, answers);
      setResult(await assessmentApi.submit(session!.id, session!.token));
    });

  if (result) {
    return (
      <div>
        <ResultView result={result} />
        <p className="mt-6 text-sm text-ink/70">
          To discuss this with a JO consultant, contact JO Education Consultant and quote your assessment. Your
          details have been recorded with JO for review.
        </p>
      </div>
    );
  }

  const updateRow = (set: typeof setEducation, i: number, k: string, v: string) =>
    set((rows) => rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  return (
    <div>
      <ol className="mb-8 flex gap-1" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1" aria-current={i === step ? 'step' : undefined}>
            <div className={`h-1.5 rounded-full ${i <= step ? 'bg-blue' : 'bg-navy/10'}`} />
            <span className={`mt-1.5 hidden text-xs sm:block ${i === step ? 'font-semibold text-navy' : 'text-ink/50'}`}>{s}</span>
          </li>
        ))}
      </ol>

      {error && (
        <div role="alert" className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card className="space-y-4">
        {step === 0 && (
          <>
            <h2 className="text-xl font-bold text-navy">Start your assessment</h2>
            {pathways && pathways.length === 0 && (
              <p className="text-sm text-ink/70">No pathways are available yet. Please check back soon.</p>
            )}
            <Select
              label="Pathway"
              name="pathwayId"
              value={start.pathwayId}
              onChange={(e) => setStart({ ...start, pathwayId: e.target.value })}
              options={(pathways ?? []).map((p) => ({ value: p.id, label: `${p.name} — ${p.destination.replace('_', ' ')}` }))}
              error={err('pathwayId')}
            />
            <Input label="Full name" name="fullName" value={start.fullName} onChange={(e) => setStart({ ...start, fullName: e.target.value })} error={err('fullName')} />
            <Input label="Email" name="email" type="email" value={start.email} onChange={(e) => setStart({ ...start, email: e.target.value })} error={err('email')} />
            <Input label="Phone (optional)" name="phone" value={start.phone} onChange={(e) => setStart({ ...start, phone: e.target.value })} error={err('phone')} />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={start.consent} onChange={(e) => setStart({ ...start, consent: e.target.checked })} />
              <span>I agree to JO Education Consultant processing my information to produce this assessment. (Required)</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={start.marketing} onChange={(e) => setStart({ ...start, marketing: e.target.checked })} />
              <span>I am happy to be contacted about my enquiry and related services. (Optional)</span>
            </label>
            <Button onClick={onStart} disabled={busy || !start.consent || !start.pathwayId || !start.fullName || !start.email}>
              {busy ? 'Starting…' : 'Begin'}
            </Button>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="text-xl font-bold text-navy">About you</h2>
            {resumeLink && (
              <div className="rounded-md bg-light p-3 text-xs">
                <p className="font-semibold text-navy">Save this link to resume later on any device:</p>
                <p className="mt-1 break-all">{resumeLink}</p>
                <p className="mt-1 text-ink/60">Anyone with this link can open your assessment. Keep it private.</p>
              </div>
            )}
            <Input label="Date of birth" type="date" value={personal.dateOfBirth} onChange={(e) => setPersonal({ ...personal, dateOfBirth: e.target.value })} error={err('personal')} />
            <Input label="Country of residence" value={personal.countryOfResidence} onChange={(e) => setPersonal({ ...personal, countryOfResidence: e.target.value })} />
            <Input label="Nationality" value={personal.nationality} onChange={(e) => setPersonal({ ...personal, nationality: e.target.value })} />
            <Select
              label="Relationship status"
              value={personal.relationshipStatus}
              onChange={(e) => setPersonal({ ...personal, relationshipStatus: e.target.value })}
              options={['Single', 'Married', 'De facto / partnered', 'Divorced', 'Widowed'].map((v) => ({ value: v, label: v }))}
            />
            <Nav back={() => setStep(0)} next={() => saveProfileAnd({ personal: { fullName: start.fullName, ...clean(personal) } }, 2)} busy={busy} hideBack />
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-xl font-bold text-navy">Education</h2>
            <p className="text-sm text-ink/70">Start with your highest qualification.</p>
            {education.map((r, i) => (
              <fieldset key={i} className="space-y-3 rounded-md border border-navy/10 p-4">
                <Input label="Qualification" value={r.qualification} onChange={(e) => updateRow(setEducation, i, 'qualification', e.target.value)} />
                <Input label="Field of study" value={r.fieldOfStudy} onChange={(e) => updateRow(setEducation, i, 'fieldOfStudy', e.target.value)} />
                <Input label="Institution" value={r.institution} onChange={(e) => updateRow(setEducation, i, 'institution', e.target.value)} />
                <Input label="Country obtained" value={r.country} onChange={(e) => updateRow(setEducation, i, 'country', e.target.value)} />
                <Input label="Graduation year" type="number" value={r.graduationYear} onChange={(e) => updateRow(setEducation, i, 'graduationYear', e.target.value)} />
                {education.length > 1 && (
                  <Button variant="ghost" onClick={() => setEducation(education.filter((_, j) => j !== i))}>Remove</Button>
                )}
              </fieldset>
            ))}
            <Button variant="secondary" onClick={() => setEducation([...education, { ...blank.education }])}>Add another qualification</Button>
            <Nav back={() => setStep(1)} next={() => saveProfileAnd({ education: education.filter((r) => r.qualification).map(clean) }, 3)} busy={busy} />
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-xl font-bold text-navy">Employment</h2>
            {employment.map((r, i) => (
              <fieldset key={i} className="space-y-3 rounded-md border border-navy/10 p-4">
                <Input label="Job title" value={r.jobTitle} onChange={(e) => updateRow(setEmployment, i, 'jobTitle', e.target.value)} />
                <Input label="Occupation" value={r.occupation} onChange={(e) => updateRow(setEmployment, i, 'occupation', e.target.value)} />
                <Input label="Employer" value={r.employer} onChange={(e) => updateRow(setEmployment, i, 'employer', e.target.value)} />
                <Input label="Country of employment" value={r.country} onChange={(e) => updateRow(setEmployment, i, 'country', e.target.value)} />
                <Select label="Employment type" value={r.employmentType} onChange={(e) => updateRow(setEmployment, i, 'employmentType', e.target.value)} options={['Full-time', 'Part-time', 'Contract', 'Self-employed'].map((v) => ({ value: v, label: v }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Start date" type="date" value={r.startDate} onChange={(e) => updateRow(setEmployment, i, 'startDate', e.target.value)} />
                  <Input label="End date (blank if current)" type="date" value={r.endDate} onChange={(e) => updateRow(setEmployment, i, 'endDate', e.target.value)} />
                </div>
                {employment.length > 1 && (
                  <Button variant="ghost" onClick={() => setEmployment(employment.filter((_, j) => j !== i))}>Remove</Button>
                )}
              </fieldset>
            ))}
            <Button variant="secondary" onClick={() => setEmployment([...employment, { ...blank.employment }])}>Add another role</Button>
            <Nav back={() => setStep(2)} next={() => saveProfileAnd({ employment: employment.filter((r) => r.jobTitle).map(clean) }, 4)} busy={busy} />
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="text-xl font-bold text-navy">English language</h2>
            <p className="text-sm text-ink/70">Leave blank if you have not taken a test yet.</p>
            {language.map((r, i) => (
              <fieldset key={i} className="space-y-3">
                <Input label="Test (e.g. IELTS)" value={r.testType} onChange={(e) => updateRow(setLanguage, i, 'testType', e.target.value)} />
                <Input label="Test date" type="date" value={r.testDate} onChange={(e) => updateRow(setLanguage, i, 'testDate', e.target.value)} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {(['listening', 'reading', 'writing', 'speaking', 'overall'] as const).map((k) => (
                    <Input key={k} label={k[0].toUpperCase() + k.slice(1)} type="number" step="0.5" min="0" max="9" value={r[k]} onChange={(e) => updateRow(setLanguage, i, k, e.target.value)} />
                  ))}
                </div>
              </fieldset>
            ))}
            <Nav back={() => setStep(3)} next={goPathway} busy={busy} />
          </>
        )}

        {step === 5 && questions && (
          <>
            <h2 className="text-xl font-bold text-navy">Pathway questions</h2>
            {!questions.configured || questions.list.length === 0 ? (
              <p className="text-sm text-ink/80">
                Official requirements for this pathway have not been configured yet. You can still submit your profile
                and a JO consultant will review it. No eligibility result will be given until the rules are published.
              </p>
            ) : (
              questions.list.map((q) => {
                const v = answers[q.key];
                const set = (val: string | number | boolean | null) => setAnswers({ ...answers, [q.key]: val });
                const label = q.required ? `${q.label} *` : q.label;
                if (q.input === 'boolean')
                  return (
                    <Select key={q.key} label={label} value={v === undefined || v === null ? '' : String(v)} onChange={(e) => set(e.target.value === '' ? null : e.target.value === 'true')} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
                  );
                if (q.input === 'select')
                  return <Select key={q.key} label={label} value={v == null ? '' : String(v)} onChange={(e) => set(e.target.value || null)} options={(q.options ?? []).map((o) => ({ value: o, label: o }))} />;
                if (q.input === 'number')
                  return <Input key={q.key} label={label} type="number" value={v == null ? '' : String(v)} onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))} />;
                return <Input key={q.key} label={label} value={v == null ? '' : String(v)} onChange={(e) => set(e.target.value || null)} />;
              })
            )}
            <Nav back={() => setStep(4)} next={() => setStep(6)} busy={busy} />
          </>
        )}

        {step === 6 && (
          <>
            <h2 className="text-xl font-bold text-navy">Review and submit</h2>
            <p className="text-sm text-ink/80">
              When you submit, your answers are assessed against JO&apos;s published rules and shared with JO for review.
              The result is a preliminary indication only, not an immigration decision or professional advice.
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep(5)}>Back</Button>
              <Button onClick={onSubmit} disabled={busy}>{busy ? 'Submitting…' : 'Submit assessment'}</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Nav({ back, next, busy, hideBack }: { back: () => void; next: () => void; busy: boolean; hideBack?: boolean }) {
  return (
    <div className="flex gap-3 pt-2">
      {!hideBack && <Button variant="ghost" onClick={back}>Back</Button>}
      <Button onClick={next} disabled={busy}>{busy ? 'Saving…' : 'Continue'}</Button>
    </div>
  );
}
