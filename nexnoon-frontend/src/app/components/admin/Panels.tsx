import { useState } from 'react';
import { AlertCircle, ArrowUpRight, Check, Mail, TrendingUp, Video, X } from 'lucide-react';
import { useBackendData } from '@/hooks/useBackendData';
import { applicationProgress } from '@/lib/instructor-application';
import apiClient, { getErrorMessage } from '@/lib/api/client';
import type { Account, Course, Flash, Payment } from './types';
import { EmptyBlock, Panel, Pagination, Pill, daysAgo, fmtDate, matches, money, statusToneOf, usePagination } from './ui';

export function ApplicantPanel({
  account: u,
  courses,
  onFlash,
}: {
  account: Account;
  courses: Course[];
  onFlash: (flash: Flash) => void;
}) {
  const app = applicationProgress(u);
  const missingItems = app.items.filter((i) => i.required && !i.done);
  const nothingFilled = app.done === 0;
  const [requesting, setRequesting] = useState(false);
  const [requested_, setRequested] = useState(false);

  async function requestProfile() {
    setRequesting(true);
    try {
      const res = await apiClient.post(`/data/admin/instructors/${u.id}/request-profile`, {
        missing: missingItems.map((i) => i.label.toLowerCase()),
      });
      setRequested(true);
      onFlash({ type: 'ok', text: res.data.message || 'Request sent' });
    } catch (error) {
      onFlash({ type: 'err', text: getErrorMessage(error) });
    } finally {
      setRequesting(false);
    }
  }

  const accountFacts = [
    { label: 'Email', value: <a href={`mailto:${u.email}`} className="text-[#3a5f8a] hover:underline break-all">{u.email}</a> },
    { label: 'Status', value: <span className="capitalize">{u.instructorStatus || 'pending'}</span> },
    {
      label: 'Applied',
      value: u.createdAt ? `${new Date(u.createdAt).toLocaleDateString()} · ${daysAgo(u.createdAt)}` : '—',
    },
    {
      label: 'Email verified',
      value: u.isEmailVerified ? (
        <span className="text-emerald-700">Yes</span>
      ) : (
        <span className="text-amber-800">Not yet</span>
      ),
    },
    { label: 'Timezone', value: u.timezone || '—' },
    {
      label: 'Profile last updated',
      value: u.applicationUpdatedAt ? daysAgo(u.applicationUpdatedAt) : <span className="text-[#9aa7b5]">Never since sign-up</span>,
    },
  ];
  const requested = (u.requestedCourseIds || [])
    .map((id) => courses.find((c) => c.id === id)?.title)
    .filter(Boolean) as string[];
  const links = [
    { label: 'LinkedIn', href: u.linkedinUrl },
    { label: 'Portfolio', href: u.portfolioUrl },
    { label: 'Sample lesson', href: u.sampleVideoUrl },
  ].filter((l) => l.href);

  return (
    <div className="basis-full border border-[#e4ebf2] bg-white/90 p-5 md:p-6">
      <div className="flex flex-wrap items-start gap-5">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[#e8eef6]">
          {u.avatar ? (
            <img src={u.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-[#7a8898]">No photo</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg text-[#0b1220]">{u.fullName}</p>
          <p className="text-sm text-[#3a5f8a]">{u.headline || <span className="text-[#9aa7b5]">No headline yet</span>}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl text-[#0b1220]">{app.percent}%</p>
          <p className="text-[11px] uppercase tracking-wide text-[#7a8898]">profile complete</p>
        </div>
      </div>

      <dl className="mt-5 grid gap-x-6 gap-y-3 border-y border-[#e4ebf2] py-4 sm:grid-cols-2 lg:grid-cols-3">
        {accountFacts.map((f) => (
          <div key={f.label}>
            <dt className="text-[11px] uppercase tracking-[0.14em] text-[#7a8898]">{f.label}</dt>
            <dd className="mt-0.5 text-sm text-[#0b1220]">{f.value}</dd>
          </div>
        ))}
      </dl>

      {nothingFilled ? (
        <div className="mt-5 border border-dashed border-[#d0dae6] bg-[#f7f9fc] p-6 text-center">
          <p className="font-display text-lg text-[#0b1220]">
            {u.fullName.split(' ')[0]} hasn’t started their teaching profile yet
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-[#5c6b7a]">
            Only their name and email exist so far. Their bio, experience, languages, requested courses and links will
            appear here as soon as they complete their application.
          </p>
          <button
            type="button"
            onClick={() => void requestProfile()}
            disabled={requesting || requested_}
            className="mt-4 inline-flex items-center gap-1.5 bg-[#0b1220] px-4 py-2 text-sm text-white hover:bg-[#1a2438] disabled:opacity-50"
          >
            <Mail className="h-3.5 w-3.5" />
            {requested_ ? 'Request sent' : requesting ? 'Sending…' : 'Ask them to complete their profile'}
          </button>
        </div>
      ) : (
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#7a8898] mb-1.5">Bio</p>
          <p className="text-sm leading-relaxed text-[#0b1220] whitespace-pre-line">
            {u.bio || <span className="text-[#9aa7b5]">Not provided</span>}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#7a8898] mb-1.5">
            Teaching experience
            {typeof u.yearsExperience === 'number' ? ` · ${u.yearsExperience} yrs` : ''}
          </p>
          <p className="text-sm leading-relaxed text-[#0b1220] whitespace-pre-line">
            {u.teachingExperience || <span className="text-[#9aa7b5]">Not provided</span>}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#7a8898] mb-1.5">Expertise</p>
          <div className="flex flex-wrap gap-1.5">
            {(u.expertise || []).length ? (
              u.expertise!.map((t) => (
                <span key={t} className="bg-[#eef3f8] px-2 py-0.5 text-xs text-[#0b1220]">
                  {t}
                </span>
              ))
            ) : (
              <span className="text-sm text-[#9aa7b5]">Not provided</span>
            )}
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#7a8898] mb-1.5">Teaching languages</p>
          <p className="text-sm text-[#0b1220]">
            {(u.languages || []).join(', ') || <span className="text-[#9aa7b5]">Not provided</span>}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#7a8898] mb-1.5">Wants to teach</p>
          <div className="flex flex-wrap gap-1.5">
            {requested.length ? (
              requested.map((t) => (
                <span key={t} className="border border-[#0b1220]/20 px-2 py-0.5 text-xs text-[#0b1220]">
                  {t}
                </span>
              ))
            ) : (
              <span className="text-sm text-[#9aa7b5]">No courses selected</span>
            )}
          </div>
          {requested.length > 0 && (
            <p className="mt-1.5 text-[11px] text-[#7a8898]">Certify courses with the chips on the row once approved.</p>
          )}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#7a8898] mb-1.5">Links</p>
          {links.length ? (
            <div className="flex flex-wrap gap-2">
              {links.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 border border-[#d0dae6] bg-white px-2.5 py-1 text-xs text-[#3a5f8a] hover:border-[#3a5f8a]"
                >
                  {l.label}
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              ))}
            </div>
          ) : (
            <span className="text-sm text-[#9aa7b5]">No links provided</span>
          )}
        </div>
      </div>
      )}

      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#7a8898] mb-2">Application checklist</p>
        <div className="flex flex-wrap gap-1.5">
          {app.items.map((item) => (
            <span
              key={item.id}
              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] ${
                item.done
                  ? 'bg-emerald-50 text-emerald-800'
                  : item.required
                    ? 'bg-rose-50 text-rose-800'
                    : 'bg-[#eef3f8] text-[#5c6b7a]'
              }`}
            >
              {item.done ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              {item.label}
              {!item.required ? ' (bonus)' : ''}
            </span>
          ))}
        </div>
      </div>

      {!app.ready && !nothingFilled && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <span className="flex items-start gap-1.5">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {missingItems.length} required item{missingItems.length === 1 ? '' : 's'} missing.
          </span>
          <button
            type="button"
            onClick={() => void requestProfile()}
            disabled={requesting || requested_}
            className="inline-flex items-center gap-1.5 border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          >
            <Mail className="h-3 w-3" />
            {requested_ ? 'Request sent' : requesting ? 'Sending…' : 'Ask to complete missing items'}
          </button>
        </div>
      )}
    </div>
  );
}

export function PaymentsPanel({ payments, search }: { payments: Payment[]; search: string }) {
  const rows = payments.filter((p) => matches(search, p.classTitle, p.student, p.status));
  const pager = usePagination(rows, 10, `${search}|${payments.length}`);
  const completed = rows.filter((p) => p.status === 'completed');
  const gross = completed.reduce((s, p) => s + p.amount, 0);

  return (
    <Panel
      title="Payments"
      subtitle={`${rows.length} payment${rows.length === 1 ? '' : 's'} · ${money(gross)} completed`}
      icon={<TrendingUp className="h-4 w-4" />}
      bodyClassName=""
    >
      {!rows.length ? (
        <div className="p-5">
          <EmptyBlock text="No payments in this period." />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#e4ebf2] bg-[#f7f9fc] text-[11px] uppercase tracking-wider text-[#6a7a8c]">
                  {['Date', 'Learner', 'Class', 'Amount', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pager.pageItems.map((p) => (
                  <tr key={p.id} className="border-b border-[#eef2f7] last:border-0 hover:bg-[#f7f9fc]/80">
                    <td className="whitespace-nowrap px-4 py-3 text-[#5c6b7a]">{fmtDate(p.createdAt)}</td>
                    <td className="px-4 py-3">{p.student || '—'}</td>
                    <td className="px-4 py-3">{p.classTitle || 'Deleted class'}</td>
                    <td className="px-4 py-3 font-medium">{money(p.amount, p.currency)}</td>
                    <td className="px-4 py-3">
                      <Pill tone={statusToneOf(p.status)}>{p.status}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pager} noun="payments" />
        </>
      )}
    </Panel>
  );
}

export function IntegrationsReadinessCard() {
  const integ = useBackendData<{
    readyForSoftLaunch: boolean;
    stripe: { configured: boolean; mode: string; webhookConfigured: boolean; purpose: string };
    email: { configured: boolean; host: string | null; purpose: string };
    zoom: {
      meetings: { configured: boolean };
      meetingSdk: { configured: boolean };
      webhooks: { configured: boolean };
      readyForTutors?: boolean;
      readyForLearners?: boolean;
    };
  }>('/settings/integrations');

  const rows = integ.data
    ? [
        [
          'Stripe payments',
          integ.data.stripe.configured,
          integ.data.stripe.configured
            ? `${integ.data.stripe.mode} mode · webhook ${integ.data.stripe.webhookConfigured ? 'ok' : 'missing'}`
            : integ.data.stripe.purpose,
        ],
        [
          'Email (SMTP / Brevo)',
          integ.data.email.configured,
          integ.data.email.configured
            ? integ.data.email.host || 'configured'
            : integ.data.email.purpose,
        ],
        [
          'Zoom meetings + SDK',
          integ.data.zoom.meetings.configured && integ.data.zoom.meetingSdk.configured,
          `Meetings ${integ.data.zoom.meetings.configured ? 'ok' : 'missing'} · SDK ${
            integ.data.zoom.meetingSdk.configured ? 'ok' : 'missing'
          } · webhooks ${integ.data.zoom.webhooks.configured ? 'ok' : 'missing'}`,
        ],
      ] as const
    : [];

  return (
    <div className="border border-[#d0dae6]/90 bg-white/85 backdrop-blur-sm p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display text-xl tracking-tight">Soft-launch readiness</h3>
          <p className="text-sm text-[#5c6b7a] mt-1 leading-relaxed">
            Stripe, email, and Zoom must be real keys (not .env.example placeholders).
          </p>
        </div>
        {integ.data && (
          <span
            className={`text-[10px] uppercase tracking-wide px-2.5 py-1 ${
              integ.data.readyForSoftLaunch
                ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80'
                : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200/80'
            }`}
          >
            {integ.data.readyForSoftLaunch ? 'Ready' : 'Keys needed'}
          </span>
        )}
      </div>
      {integ.isLoading && <p className="text-sm text-[#5c6b7a]">Checking integrations…</p>}
      {integ.isError && (
        <p className="text-sm text-rose-700">Could not load status. Is the backend running?</p>
      )}
      {integ.data && (
        <div className="space-y-2.5">
          {rows.map(([label, ok, detail]) => (
            <div
              key={label}
              className="flex flex-wrap items-start justify-between gap-2 border border-[#e4ebf2] px-3.5 py-3"
            >
              <div>
                <p className="text-sm font-medium text-[#0b1220]">{label}</p>
                <p className="text-xs text-[#6a7a8c] mt-0.5">{detail}</p>
              </div>
              <span
                className={`text-[10px] uppercase tracking-wide px-2 py-0.5 ${
                  ok
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80'
                    : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200/80'
                }`}
              >
                {ok ? 'Configured' : 'Missing'}
              </span>
            </div>
          ))}
          <p className="text-xs text-[#6a7a8c] pt-1">
            CLI: <code className="bg-[#eef2f7] px-1">npm run check:integrations</code> ·{' '}
            <code className="bg-[#eef2f7] px-1">npm run smoke:e2e</code>
          </p>
        </div>
      )}
    </div>
  );
}

export function ZoomIntegrationCard() {
  const zoom = useBackendData<{
    meetings: { configured: boolean; purpose: string };
    meetingSdk: { configured: boolean; purpose: string };
    webhooks: { configured: boolean; purpose: string; endpointPath: string };
    readyForTutors: boolean;
    readyForLearners: boolean;
  }>('/settings/zoom');

  const rows = zoom.data
    ? [
        ['Meetings (S2S OAuth)', zoom.data.meetings.configured, zoom.data.meetings.purpose],
        ['Meeting SDK (learner join)', zoom.data.meetingSdk.configured, zoom.data.meetingSdk.purpose],
        [
          'Webhooks',
          zoom.data.webhooks.configured,
          `${zoom.data.webhooks.purpose} · ${zoom.data.webhooks.endpointPath}`,
        ],
      ] as const
    : [];

  return (
    <div className="border border-[#d0dae6]/90 bg-white/85 backdrop-blur-sm p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-8 w-8 flex items-center justify-center bg-[#e8eef6] text-[#3a5f8a]">
          <Video className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-display text-xl tracking-tight">Zoom classroom</h3>
          <p className="text-sm text-[#5c6b7a] mt-1 leading-relaxed">
            Backend env status for live sessions. See{' '}
            <code className="text-xs bg-[#eef2f7] px-1">docs/ZOOM_INTEGRATION.md</code> to create apps and
            paste keys.
          </p>
        </div>
      </div>
      {zoom.isLoading && <p className="text-sm text-[#5c6b7a]">Checking Zoom configuration…</p>}
      {zoom.isError && (
        <p className="text-sm text-rose-700">Could not load Zoom status. Is the backend running?</p>
      )}
      {zoom.data && (
        <div className="space-y-2.5">
          {rows.map(([label, ok, purpose]) => (
            <div
              key={label}
              className="flex flex-wrap items-start justify-between gap-2 border border-[#e4ebf2] px-3.5 py-3"
            >
              <div>
                <p className="text-sm font-medium text-[#0b1220]">{label}</p>
                <p className="text-xs text-[#6a7a8c] mt-0.5">{purpose}</p>
              </div>
              <span
                className={`text-[10px] uppercase tracking-wide px-2 py-0.5 ${
                  ok
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80'
                    : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200/80'
                }`}
              >
                {ok ? 'Configured' : 'Missing'}
              </span>
            </div>
          ))}
          <p className="text-xs text-[#6a7a8c] pt-1">
            Tutors ready: {zoom.data.readyForTutors ? 'yes' : 'no'} · Learners ready:{' '}
            {zoom.data.readyForLearners ? 'yes' : 'no'}
          </p>
        </div>
      )}
    </div>
  );
}
