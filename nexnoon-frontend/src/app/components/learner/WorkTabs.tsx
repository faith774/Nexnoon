import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Award, Paperclip, RotateCcw } from 'lucide-react';
import { btn, EmptyBlock, FilterChips, Pill } from '../studio/ui';
import { formatMoney } from '@/lib/api';
import { useTimeFormat } from '@/lib/timezone';
import { assignmentMeta, Thumb } from './shared';
import type { LearnerClass, LearnerData, LearnerPayment } from './types';

type WorkFilter = 'todo' | 'submitted' | 'graded' | 'all';

export function AssignmentsTab({ data }: { data: LearnerData }) {
  const t = useTimeFormat();
  const [filter, setFilter] = useState<WorkFilter>('todo');
  const list = useMemo(
    () =>
      data.assignments.filter(
        (a) =>
          filter === 'all' ||
          (filter === 'todo' && (a.status === 'due' || a.status === 'overdue')) ||
          (filter === 'submitted' && a.status === 'submitted') ||
          (filter === 'graded' && a.status === 'graded')
      ),
    [data.assignments, filter]
  );
  const count = (f: WorkFilter) =>
    data.assignments.filter((a) =>
      f === 'todo' ? a.status === 'due' || a.status === 'overdue' : f === 'all' ? true : a.status === f
    ).length;

  return (
    <div className="space-y-4">
      <FilterChips<WorkFilter>
        label="Filter assignments"
        value={filter}
        onChange={setFilter}
        options={[
          { id: 'todo', label: 'To do', count: count('todo') },
          { id: 'submitted', label: 'Awaiting grade', count: count('submitted') },
          { id: 'graded', label: 'Graded', count: count('graded') },
          { id: 'all', label: 'All', count: count('all') },
        ]}
      />
      {list.length ? (
        <ul className="space-y-2.5">
          {list.map((a) => {
            const meta = assignmentMeta[a.status];
            const pct = a.grade ? Math.round((a.grade.score / (a.grade.maxScore || 100)) * 100) : null;
            return (
              <li key={`${a.classId}-${a.id}`} className="border border-[#e4dfd6] bg-white">
                <Link to={`/assignments/${a.classId}`} className="flex flex-wrap items-start gap-4 p-4 transition-colors hover:bg-[#faf8f5]">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{a.title}</p>
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                      {a.hasAttachment ? <Paperclip className="h-3.5 w-3.5 text-[#b5aea3]" aria-label="Has attachment" /> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-[#8a847a]">
                      {a.classTitle}
                      {a.dueDate ? ` · due ${t.dayTime(a.dueDate)}` : ' · no due date'}
                      {a.submittedAt ? ` · submitted ${t.date(a.submittedAt)}` : ''}
                    </p>
                    {a.grade?.feedback ? <p className="mt-2 line-clamp-2 text-sm text-[#3d3933]">“{a.grade.feedback}”</p> : null}
                  </div>
                  {a.grade ? (
                    <div className="shrink-0 text-right">
                      <p className="font-serif text-2xl leading-none">{a.grade.score}<span className="text-sm text-[#8a847a]">/{a.grade.maxScore}</span></p>
                      <p className="mt-1 text-[11px] text-[#8a847a]">{pct}%</p>
                    </div>
                  ) : (
                    <span className={`${btn.link} shrink-0`}>{a.status === 'submitted' ? 'View' : 'Start'} <ArrowRight className="h-3.5 w-3.5" /></span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyBlock text={filter === 'todo' ? "You're all caught up. Nice work." : 'Nothing here yet.'} />
      )}
    </div>
  );
}

export function CertificatesTab({ data }: { data: LearnerData }) {
  const t = useTimeFormat();
  const inProgress = data.classes.filter((c) => c.state === 'in_progress' || c.state === 'finished');
  return (
    <div className="space-y-8">
      {data.certificates.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.certificates.map((c) => (
            <Link
              key={c.certificateId}
              to={`/certificates/${c.certificateId}`}
              className="group relative flex aspect-[1.414/1] flex-col justify-between overflow-hidden border border-[#e4dfd6] bg-[#fffdf9] p-5 transition-shadow hover:shadow-[0_20px_50px_-25px_rgba(20,17,14,0.4)]"
            >
              <div className="absolute inset-2 border border-[#c45c26]/30" aria-hidden />
              <div className="relative flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-[#8a847a]">
                <span className="font-semibold text-[#14110e]">Nexnoon</span>
                <Award className="h-4 w-4 text-[#c45c26]" />
              </div>
              <div className="relative">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#8a847a]">Certificate of completion</p>
                <p className="mt-1 font-serif text-lg leading-snug tracking-tight group-hover:text-[#c45c26]">{c.classTitle}</p>
                <p className="mt-1 text-xs text-[#6b655c]">with {c.instructor}</p>
              </div>
              <div className="relative flex items-center justify-between text-[11px] text-[#8a847a]">
                <span>{c.completedAt ? t.date(c.completedAt) : ''}</span>
                <span className="font-mono">{c.certificateId}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyBlock text="Complete a class to earn your first certificate. Each one has a public link anyone can use to verify it." />
      )}

      {inProgress.length ? (
        <div>
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[#8a847a]">On the way</p>
          <ul className="divide-y divide-[#eee9e0] border border-[#e4dfd6] bg-white">
            {inProgress.map((c) => (
              <li key={c.id} className="flex items-center gap-4 px-4 py-3">
                <Thumb src={c.thumbnail} className="h-10 w-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="text-xs text-[#8a847a]">
                    {c.state === 'finished'
                      ? `Class finished · your instructor issues certificates after reviewing attendance and work`
                      : `${c.progress}% complete · ${c.attended}/${c.totalSessions} sessions`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const paymentTone = { completed: 'green', refunded: 'stone', pending: 'amber', failed: 'rose' } as const;
const paymentLabel = { completed: 'Paid', refunded: 'Refunded', pending: 'Pending', failed: 'Failed' } as const;

export function PaymentsTab({ data, onLeave }: { data: LearnerData; onLeave: (c: LearnerClass) => void }) {
  const t = useTimeFormat();
  const now = Date.now();
  const refundTarget = (p: LearnerPayment) =>
    data.classes.find((c) => c.id === p.classId && c.enrollmentStatus === 'active' && c.state === 'upcoming');
  const refundOpen = (p: LearnerPayment) => p.status === 'completed' && p.refundableUntil && new Date(p.refundableUntil).getTime() > now;

  return (
    <div className="space-y-4">
      {data.payments.length ? (
        <div className="overflow-x-auto border border-[#e4dfd6] bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-[#eee9e0] text-left text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">
                <th className="px-4 py-3 font-normal">Date</th>
                <th className="px-4 py-3 font-normal">Class</th>
                <th className="px-4 py-3 text-right font-normal">Amount</th>
                <th className="px-4 py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee9e0]">
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-[#6b655c]">{t.date(p.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/class/${p.classId}`} className="hover:text-[#c45c26]">{p.classTitle}</Link>
                    {refundOpen(p) ? (
                      <p className="text-xs text-[#8a847a]">
                        Refundable until {t.date(p.refundableUntil)} if the class hasn't started
                        {refundTarget(p) ? (
                          <>
                            {' · '}
                            <button type="button" className="text-[#c45c26] hover:underline" onClick={() => onLeave(refundTarget(p)!)}>Leave &amp; refund</button>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatMoney(p.amount, p.currency)}</td>
                  <td className="px-4 py-3"><Pill tone={paymentTone[p.status]}>{paymentLabel[p.status]}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyBlock text="No payments yet. Free classes don't show up here." />
      )}
      <p className="flex gap-2 text-xs leading-relaxed text-[#8a847a]">
        <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Leave a class within {data.policy.refundWindowDays} day{data.policy.refundWindowDays === 1 ? '' : 's'} of paying, and before its first session, for an automatic full refund. Refunds reach your card in 5–10 business days.
      </p>
    </div>
  );
}
