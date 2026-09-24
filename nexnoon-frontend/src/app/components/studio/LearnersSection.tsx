import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useStudio } from './context';
import type { StudioLearner } from './types';
import { Avatar, EmptyBlock, ExportButton, FilterChips, Pagination, Pill, ProgressBar, daysAgo, fmtDate, inputCls, matches, statusToneOf, usePagination } from './ui';

type Filter = 'active' | 'risk' | 'completed' | 'dropped' | 'all';

/** Attended under 60% of at least two held sessions. */
export const atRisk = (l: StudioLearner) => l.status === 'active' && l.sessionsHeld >= 2 && (l.attendanceRate ?? 100) < 60;

export default function LearnersSection() {
  const { data, search, openClass } = useStudio();
  const [params] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('active');
  const [classId, setClassId] = useState(params.get('classId') || 'all');

  const classes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const l of data.learners) seen.set(l.classId, l.classTitle);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data.learners]);

  const inClass = data.learners.filter((l) => classId === 'all' || l.classId === classId);
  const buckets: Record<Filter, StudioLearner[]> = {
    active: inClass.filter((l) => l.status === 'active'),
    risk: inClass.filter(atRisk),
    completed: inClass.filter((l) => l.status === 'completed'),
    dropped: inClass.filter((l) => l.status === 'dropped'),
    all: inClass,
  };
  const rows = buckets[filter]
    .filter((l) => matches(search, l.name, l.email, l.classTitle))
    .sort((a, b) => Number(atRisk(b)) - Number(atRisk(a)) || a.name.localeCompare(b.name));
  const pager = usePagination(rows, 20, `${filter}|${classId}|${search}`);

  if (!data.learners.length) return <EmptyBlock text="No learners yet. They’ll appear here as soon as someone enrolls in one of your classes." />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips
          label="Filter learners"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'active', label: 'Active', count: buckets.active.length },
            { id: 'risk', label: 'At risk', count: buckets.risk.length },
            { id: 'completed', label: 'Completed', count: buckets.completed.length },
            { id: 'dropped', label: 'Dropped', count: buckets.dropped.length },
            { id: 'all', label: 'All', count: buckets.all.length },
          ]}
        />
        <select aria-label="Class" value={classId} onChange={(e) => setClassId(e.target.value)} className={`${inputCls} w-auto max-w-[260px] py-2`}>
          <option value="all">All classes</option>
          {classes.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
        <div className="ml-auto">
          <ExportButton
            filename="learners"
            rows={() =>
              rows.map((l) => ({
                name: l.name,
                email: l.email,
                class: l.classTitle,
                status: l.status,
                enrolled: l.enrolledAt?.slice(0, 10),
                progress_pct: l.progress,
                attendance_pct: l.attendanceRate ?? '',
                sessions_attended: l.sessionsAttended,
                sessions_held: l.sessionsHeld,
                last_attended: l.lastSeenAt ? String(l.lastSeenAt).slice(0, 10) : '',
                assignments_submitted: l.submitted,
                assignments_total: l.assignmentsTotal,
                avg_grade_pct: l.avgGrade ?? '',
                at_risk: atRisk(l) ? 'yes' : '',
              }))
            }
          />
        </div>
      </div>

      {filter === 'risk' && rows.length ? (
        <p className="border border-[#f0d3c1] bg-[#fbeee6] px-4 py-3 text-sm text-[#9a4518]">
          These learners have attended less than 60% of held sessions. A quick message before the next session often brings them back.
        </p>
      ) : null}

      {rows.length ? (
        <div className="border border-[#e4dfd6] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#eee9e0] bg-[#faf8f5] text-left text-[11px] uppercase tracking-wider text-[#8a847a]">
                  <th className="px-5 py-2.5 font-medium">Learner</th>
                  <th className="px-3 py-2.5 font-medium">Class</th>
                  <th className="px-3 py-2.5 font-medium">Attendance</th>
                  <th className="px-3 py-2.5 font-medium">Progress</th>
                  <th className="px-3 py-2.5 font-medium">Work</th>
                  <th className="px-3 py-2.5 font-medium">Last attended</th>
                </tr>
              </thead>
              <tbody>
                {pager.pageItems.map((l) => (
                  <tr key={l.id} className="border-b border-[#f1ede6] last:border-0 hover:bg-[#faf8f5]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={l.name} src={l.avatar || undefined} size={32} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-[#14110e]">
                            {l.name}
                            {atRisk(l) ? <Pill tone="rose">At risk</Pill> : null}
                            {l.status !== 'active' ? <Pill tone={statusToneOf(l.status)}>{l.status}</Pill> : null}
                          </p>
                          <p className="truncate text-xs text-[#8a847a]">{l.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[220px] px-3 py-3">
                      <button type="button" onClick={() => openClass(l.classId, 'roster')} className="block w-full max-w-full truncate text-left text-sm font-normal text-[#14110e] hover:underline"
                        title={l.classTitle}
                      >
                        {l.classTitle}
                      </button>
                      <span className="text-xs text-[#8a847a]">since {fmtDate(l.enrolledAt)}</span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {l.attendanceRate != null ? <span className={l.attendanceRate < 60 ? 'text-rose-700' : ''}>{l.attendanceRate}%</span> : '—'}
                      <span className="block text-xs text-[#8a847a]">
                        {l.sessionsAttended}/{l.sessionsHeld} sessions
                      </span>
                    </td>
                    <td className="w-32 px-3 py-3">
                      <ProgressBar value={l.progress} />
                      <span className="mt-1 block text-xs text-[#8a847a]">{l.progress}%</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-[#6b655c]">
                      {l.submitted}/{l.assignmentsTotal} submitted
                      {l.avgGrade != null ? <span className="block">avg {l.avgGrade}%</span> : null}
                    </td>
                    <td className="px-3 py-3 text-xs text-[#6b655c]">{l.lastSeenAt ? daysAgo(String(l.lastSeenAt)) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pager} noun="learners" />
        </div>
      ) : (
        <EmptyBlock text={search ? 'No learners match your search.' : 'No learners in this view.'} />
      )}
    </div>
  );
}
