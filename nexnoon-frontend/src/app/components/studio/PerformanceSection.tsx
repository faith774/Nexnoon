import { useState } from 'react';
import { Award, ClipboardList, Star } from 'lucide-react';
import { useStudio } from './context';
import { EmptyBlock, FilterChips, Pagination, Panel, Pill, StatTile, daysAgo, fmtDate, scoreToneOf, statusToneOf, usePagination } from './ui';

const STAGE_COPY: Record<string, { label: string; text: string }> = {
  active: { label: 'Active', text: 'You’re certified and teaching. Keep your score up to renew smoothly.' },
  certified: { label: 'Certified', text: 'You’re certified. Publish a class to start teaching.' },
  improvement: { label: 'Improvement plan', text: 'The quality team asked you to work on a few areas before your next review.' },
  training: { label: 'Training', text: 'Finish training to get certified.' },
  suspended: { label: 'Suspended', text: 'Teaching is paused. Contact support to restore access.' },
};

export default function PerformanceSection() {
  const { data } = useStudio();
  const p = data.performance;
  const w = p.weights;
  const stage = data.me.lifecycleStage || 'active';
  const stageCopy = STAGE_COPY[stage] || { label: stage, text: '' };

  const parts = [
    { key: 'rating', label: 'Learner rating', value: p.reviewsCount ? Math.round((p.avgRating / 5) * 100) : 0, weight: w.learnerRating, detail: p.reviewsCount ? `${p.avgRating.toFixed(2)} / 5 from ${p.reviewsCount} reviews` : 'No reviews yet' },
    {
      key: 'completion',
      label: 'Completion',
      value: p.completionRate,
      weight: w.completion,
      detail: p.completionBasis === 'finished_cohorts' ? 'Learners who completed finished cohorts' : 'Average progress in running cohorts',
    },
    { key: 'attendance', label: 'Attendance', value: p.attendanceRate, weight: w.attendance, detail: p.heldSessions ? `Across ${p.heldSessions} held sessions` : 'No sessions held yet' },
    { key: 'feedback', label: 'Satisfaction', value: p.reviewsCount ? p.satisfaction : 0, weight: w.feedback, detail: 'Share of reviews rated 4★ or higher' },
    { key: 'admin', label: 'Team evaluation', value: p.adminEvaluation, weight: w.adminEvaluation, detail: 'Set by the Nexnoon quality team' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <section className="border border-[#e4dfd6] bg-white p-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8a847a]">Quality score</p>
          <div className="mt-3 flex items-end gap-4">
            <ScoreRing score={p.qualityScore} />
            <div className="pb-2">
              <Pill tone={stage === 'improvement' || stage === 'suspended' ? 'rose' : 'green'}>{stageCopy.label}</Pill>
              <p className="mt-2 max-w-[16rem] text-sm text-[#6b655c]">{stageCopy.text}</p>
            </div>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-[#8a847a]">
            This is the same score, from the same formula, that the Nexnoon quality team sees. It updates as sessions are held and reviews come in.
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[#eee9e0] pt-4 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">Next review</dt>
              <dd className="mt-0.5 text-[#14110e]">{fmtDate(data.me.reviewDueAt)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">Last renewed</dt>
              <dd className="mt-0.5 text-[#14110e]">{fmtDate(data.me.renewedAt)}</dd>
            </div>
          </dl>
          {data.me.improvementPlan ? (
            <div className="mt-5 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              <p className="font-medium">Improvement plan{data.me.improvementPlan.dueAt ? ` · due ${fmtDate(data.me.improvementPlan.dueAt)}` : ''}</p>
              {data.me.improvementPlan.notes ? <p className="mt-1 whitespace-pre-wrap">{data.me.improvementPlan.notes}</p> : null}
            </div>
          ) : null}
        </section>

        <Panel title="How your score is built" subtitle="Each part is scored 0–100, then weighted">
          <ul className="space-y-4">
            {parts.map((part) => (
              <li key={part.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm text-[#14110e]">
                    {part.label} <span className="text-xs text-[#b5aea3]">· {part.weight}% weight</span>
                  </p>
                  <p className="text-sm tabular-nums text-[#14110e]">
                    {part.value}
                    <span className="ml-2 text-xs text-[#8a847a]">+{((part.value * part.weight) / 100).toFixed(1)} pts</span>
                  </p>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden bg-[#eee9e0]">
                  <div
                    className={`h-full ${part.value >= 80 ? 'bg-emerald-500' : part.value >= 60 ? 'bg-[#c45c26]' : 'bg-amber-400'}`}
                    style={{ width: `${Math.max(0, Math.min(100, part.value))}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-[#8a847a]">{part.detail}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Classes taught" value={p.classesTaught} hint={`${p.classesLed} as lead`} />
        <StatTile label="Enrollments" value={p.totalStudents} hint="Active across your classes" />
        <StatTile label="Dropout" value={`${p.dropoutRate}%`} hint={`${p.dropped} left early`} tone={p.dropoutRate >= 25 ? 'warn' : undefined} />
        <StatTile label="Written feedback" value={p.feedbackCount} hint="Reviews with comments" />
      </div>

      <Panel title="Certifications" subtitle="Courses and languages you’re approved to teach" icon={<Award className="h-4 w-4" />} bodyClassName="p-0">
        {data.certifications.length ? (
          <ul className="divide-y divide-[#eee9e0]">
            {data.certifications.map((c) => {
              const expiringSoon = c.status === 'active' && c.expiresAt && new Date(c.expiresAt).getTime() - Date.now() < 30 * 86_400_000;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5 md:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#14110e]">{c.courseTitle}</p>
                    <p className="text-xs text-[#8a847a]">
                      {c.languageLabel || 'All languages'}
                      {c.certifiedAt ? ` · certified ${fmtDate(c.certifiedAt)}` : ''}
                    </p>
                  </div>
                  <span className={`text-xs ${expiringSoon ? 'text-[#c45c26]' : 'text-[#8a847a]'}`}>{c.expiresAt ? `Expires ${fmtDate(c.expiresAt)}` : 'No expiry'}</span>
                  <Pill tone={statusToneOf(c.status)}>{c.status}</Pill>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-[#6b655c] md:px-6">No certifications on record yet. The admin team adds them when you’re approved for a course.</p>
        )}
      </Panel>

      <ReviewsPanel />
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const tone = scoreToneOf(score);
  const color = tone === 'green' ? '#10b981' : tone === 'amber' ? '#c45c26' : '#f59e0b';
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#eee9e0" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${(Math.max(0, Math.min(100, score)) / 100) * c} ${c}`} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-4xl leading-none text-[#14110e]">{score}</span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8a847a]">of 100</span>
      </span>
    </div>
  );
}

function ReviewsPanel() {
  const { data } = useStudio();
  const [stars, setStars] = useState<'all' | '5' | '4' | '3' | 'low'>('all');
  const reviews = data.reviews;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews.filter((r) => r.rating === n).length }));
  const rows = reviews.filter((r) => (stars === 'all' ? true : stars === 'low' ? r.rating <= 2 : r.rating === Number(stars)));
  const pager = usePagination(rows, 10, stars);

  return (
    <Panel title="Learner reviews" subtitle={reviews.length ? `${reviews.length} reviews` : undefined} icon={<Star className="h-4 w-4" />} bodyClassName="p-0">
      {reviews.length ? (
        <div className="grid md:grid-cols-[240px_1fr]">
          <div className="border-b border-[#eee9e0] p-5 md:border-b-0 md:border-r">
            <p className="font-serif text-4xl text-[#14110e]">{data.performance.avgRating.toFixed(1)}</p>
            <p className="text-xs text-[#8a847a]">average rating</p>
            <ul className="mt-4 space-y-1.5">
              {dist.map((d) => (
                <li key={d.n} className="flex items-center gap-2 text-xs text-[#6b655c]">
                  <span className="w-6 tabular-nums">{d.n}★</span>
                  <span className="h-1.5 flex-1 overflow-hidden bg-[#eee9e0]">
                    <span className="block h-full bg-[#c45c26]" style={{ width: `${reviews.length ? (d.count / reviews.length) * 100 : 0}%` }} />
                  </span>
                  <span className="w-6 text-right tabular-nums">{d.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="border-b border-[#eee9e0] px-5 py-3">
              <FilterChips
                label="Filter reviews"
                value={stars}
                onChange={setStars}
                options={[
                  { id: 'all', label: 'All' },
                  { id: '5', label: '5★', count: dist[0].count },
                  { id: '4', label: '4★', count: dist[1].count },
                  { id: '3', label: '3★', count: dist[2].count },
                  { id: 'low', label: '1–2★', count: dist[3].count + dist[4].count },
                ]}
              />
            </div>
            {rows.length ? (
              <ul className="divide-y divide-[#eee9e0]">
                {pager.pageItems.map((r) => (
                  <li key={r.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#8a847a]">
                      <span className="text-sm text-[#c45c26]">
                        {'★'.repeat(r.rating)}
                        <span className="text-[#e4dfd6]">{'★'.repeat(5 - r.rating)}</span>
                      </span>
                      <span>{r.learnerName}</span>·<span className="truncate">{r.classTitle}</span>·<span>{daysAgo(r.createdAt)}</span>
                      {r.status === 'flagged' ? <Pill tone="amber">Under review</Pill> : null}
                    </div>
                    {r.comment ? <p className="mt-1.5 text-sm leading-relaxed text-[#3d3933]">{r.comment}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-5">
                <EmptyBlock text="No reviews with this rating." />
              </div>
            )}
            <Pagination {...pager} noun="reviews" />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-5 py-6 text-sm text-[#6b655c] md:px-6">
          <ClipboardList className="h-4 w-4" /> No reviews yet. Learners can review a class after attending sessions.
        </div>
      )}
    </Panel>
  );
}
