import { useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, CalendarPlus, ExternalLink, FileText, Hourglass, Pencil, Video } from 'lucide-react';
import { useStudio } from './context';
import type { ClassPanel, GradingItem, StudioClass } from './types';
import AttendanceRegister from './AttendanceRegister';
import { GradeModal } from './GradingSection';
import {
  Avatar,
  DetailGrid,
  Drawer,
  EmptyBlock,
  ExportButton,
  Pill,
  ProgressBar,
  SegmentedTabs,
  StatTile,
  btn,
  fmtDate,
  money,
  relativeDue,
  statusToneOf,
  useSticky,
} from './ui';
import { formatInZone, tzLabel, useTimeFormat } from '@/lib/timezone';

export default function ClassDrawer({
  classId,
  panel,
  onPanel,
  onClose,
}: {
  classId: string | null;
  panel: ClassPanel;
  onPanel: (p: ClassPanel) => void;
  onClose: () => void;
}) {
  const { data } = useStudio();
  const found = classId ? data.classes.find((c) => c.id === classId && c.myRole !== 'invited') : null;
  const cls = useSticky(found);

  const learners = cls ? data.learners.filter((l) => l.classId === cls.id) : [];
  const tabs: { id: ClassPanel; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'sessions', label: 'Sessions', count: cls?.ops.sessionsTotal },
    { id: 'roster', label: 'Roster', count: learners.filter((l) => l.status !== 'dropped').length },
    { id: 'attendance', label: 'Attendance' },
    { id: 'assignments', label: 'Assignments', count: cls?.assignments?.length || 0 },
  ];

  return (
    <Drawer
      open={Boolean(found)}
      onClose={onClose}
      eyebrow={cls ? [cls.courseTitle, cls.languageLabel].filter(Boolean).join(' · ') || cls.category : undefined}
      title={cls?.title || ''}
      headerExtra={
        cls ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill tone={statusToneOf(cls.cancelledAt ? 'cancelled' : cls.status)}>{cls.cancelledAt ? 'cancelled' : cls.status}</Pill>
            <Pill tone={cls.myRole === 'lead' ? 'ink' : 'clay'}>{cls.myRole === 'lead' ? 'You lead' : 'You support'}</Pill>
            <span className="ml-auto flex gap-2">
              <Link to={`/classroom/${cls.id}`} className={`${btn.primary} py-1.5 text-xs`}>
                <Video className="h-3.5 w-3.5" /> Classroom
              </Link>
              {cls.myRole === 'lead' && !cls.cancelledAt ? (
                <Link to={`/edit-class/${cls.id}`} className={`${btn.secondary} py-1.5 text-xs`}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
              ) : null}
            </span>
          </div>
        ) : null
      }
    >
      {cls ? (
        <div className="space-y-5">
          <SegmentedTabs value={panel} onChange={onPanel} tabs={tabs} />
          {panel === 'overview' && <OverviewPanel cls={cls} />}
          {panel === 'sessions' && <SessionsPanel cls={cls} />}
          {panel === 'roster' && <RosterPanel cls={cls} />}
          {panel === 'attendance' && <AttendanceRegister classId={cls.id} />}
          {panel === 'assignments' && <AssignmentsPanel cls={cls} />}
        </div>
      ) : null}
    </Drawer>
  );
}

function OverviewPanel({ cls }: { cls: StudioClass }) {
  const t = useTimeFormat();
  const { data } = useStudio();
  const team = (cls.teachingTeam || []).filter((m) => m.status === 'accepted' || m.status === 'pending');
  const reviews = data.reviews.filter((r) => r.classId === cls.id);

  return (
    <div className="space-y-5">
      {cls.freeApproval?.status === 'pending' ? (
        <div className="flex gap-3 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Hourglass className="mt-0.5 h-4 w-4 shrink-0" />
          <p>This is a free class. An admin needs to approve it before learners can see it. We’ll notify you when they decide.</p>
        </div>
      ) : null}
      {cls.freeApproval?.status === 'rejected' ? (
        <div className="flex gap-3 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Free pricing wasn’t approved.</p>
            {cls.freeApproval.note ? <p className="mt-1">Admin note: “{cls.freeApproval.note}”</p> : null}
            <p className="mt-1">Set a price within the course range to publish it.</p>
            {cls.myRole === 'lead' ? (
              <Link to={`/edit-class/${cls.id}`} className={`${btn.link} mt-2`}>
                Edit pricing
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
      {cls.cancelledAt ? (
        <div className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          Cancelled by an admin on {fmtDate(cls.cancelledAt)}
          {cls.cancellationReason ? `: ${cls.cancellationReason}` : ''}.
        </div>
      ) : null}
      {cls.status === 'published' && !cls.ops.sessionsTotal && cls.myRole === 'lead' ? (
        <div className="flex flex-wrap items-center gap-3 border border-[#f0d3c1] bg-[#fbeee6] p-4 text-sm text-[#9a4518]">
          <CalendarPlus className="h-4 w-4 shrink-0" />
          <p className="flex-1">No sessions yet. Learners can’t join until you schedule them.</p>
          <Link to={`/edit-class/${cls.id}`} className={btn.secondary}>
            Add sessions
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Seats" value={`${cls.ops.enrolled}/${cls.ops.maxStudents}`} hint={`${cls.ops.seatsLeft} left`} />
        <StatTile label="Attendance" value={cls.ops.sessionsHeld ? `${cls.ops.attendanceRate}%` : '—'} hint={`${cls.ops.sessionsHeld} held`} />
        <StatTile label="Completion" value={`${cls.ops.completionRate}%`} hint={cls.ops.dropped ? `${cls.ops.dropped} dropped` : 'No drop-outs'} />
        <StatTile label="Rating" value={cls.ops.avgRating != null ? cls.ops.avgRating.toFixed(1) : '—'} hint={`${cls.ops.reviewsCount} reviews`} />
      </div>

      <section className="border border-[#e4dfd6] bg-white p-5">
        <DetailGrid
          items={[
            { label: 'Price', value: cls.price > 0 ? money(cls.price, cls.currency) : 'Free' },
            { label: 'Level', value: cls.level || '—' },
            { label: 'Starts', value: fmtDate(cls.startDate) },
            { label: 'Ends', value: fmtDate(cls.endDate) },
            { label: 'Class time zone', value: cls.timezone ? tzLabel(cls.timezone) : '—' },
            { label: 'Next session', value: cls.ops.nextSessionAt ? t.dayTime(cls.ops.nextSessionAt) : '—' },
          ]}
        />
      </section>

      <section className="border border-[#e4dfd6] bg-white p-5">
        <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">Teaching team</p>
        <ul className="space-y-3">
          <li className="flex items-center gap-3">
            <Avatar name={cls.instructor.name} src={cls.instructor.avatar} size={32} />
            <span className="flex-1 text-sm text-[#14110e]">{cls.instructor.name}</span>
            <Pill tone="ink">Lead</Pill>
          </li>
          {team
            .filter((m) => m.role === 'support')
            .map((m) => (
              <li key={m.userId} className="flex items-center gap-3">
                <Avatar name={m.name} src={m.avatar} size={32} />
                <span className="flex-1 text-sm text-[#14110e]">{m.name}</span>
                <Pill tone={m.status === 'accepted' ? 'clay' : 'amber'}>{m.status === 'accepted' ? 'Support' : 'Invited'}</Pill>
              </li>
            ))}
        </ul>
        {cls.myRole === 'lead' ? <p className="mt-3 text-xs text-[#8a847a]">Invite or remove support instructors from the classroom page.</p> : null}
      </section>

      {reviews.length ? (
        <section className="border border-[#e4dfd6] bg-white p-5">
          <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">Recent reviews</p>
          <ul className="space-y-3">
            {reviews.slice(0, 4).map((r) => (
              <li key={r.id} className="text-sm">
                <span className="text-[#c45c26]">{'★'.repeat(r.rating)}</span>
                <span className="text-[#e4dfd6]">{'★'.repeat(5 - r.rating)}</span>
                <span className="ml-2 text-xs text-[#8a847a]">{r.learnerName}</span>
                {r.comment ? <p className="mt-0.5 text-[#3d3933]">“{r.comment}”</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SessionsPanel({ cls }: { cls: StudioClass }) {
  const { data, openClass } = useStudio();
  const t = useTimeFormat();
  const showClassTime = !!cls.timezone && cls.timezone !== t.tz;
  const sessions = data.sessions.filter((s) => s.classId === cls.id);
  const upcoming = sessions.filter((s) => !s.held);
  const past = sessions.filter((s) => s.held).reverse();

  if (!sessions.length) {
    return (
      <EmptyBlock
        text="No sessions scheduled for this class."
        action={
          cls.myRole === 'lead' ? (
            <Link to={`/edit-class/${cls.id}`} className={btn.secondary}>
              Add sessions
            </Link>
          ) : null
        }
      />
    );
  }

  const row = (s: (typeof sessions)[number]) => (
    <li key={s.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
      <div className="w-24 shrink-0">
        <p className="text-sm text-[#14110e]">{t.day(s.startTime)}</p>
        <p className="text-xs text-[#8a847a]">
          {t.time(s.startTime)}–{t.time(s.endTime)}
        </p>
        {showClassTime ? (
          <p className="text-[11px] text-[#a39c92]" title={`Class time zone: ${cls.timezone}`}>
            {formatInZone(s.startTime, cls.timezone!, 'time')} class time
          </p>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-[#14110e]">
          {s.sessionNumber ? `S${s.sessionNumber} · ` : ''}
          {s.title}
        </p>
        {s.held ? (
          <p className="text-xs text-[#8a847a]">
            {s.attended ?? 0}/{s.expected} attended
          </p>
        ) : null}
      </div>
      {s.needsAttendance ? (
        <button type="button" onClick={() => openClass(cls.id, 'attendance')} className="bg-[#fbeee6] px-2 py-1 text-xs text-[#9a4518] hover:bg-[#f6dccb]">
          Mark attendance
        </button>
      ) : s.held ? (
        <Pill tone="green">Held</Pill>
      ) : s.status === 'live' ? (
        <Pill tone="clay">Live</Pill>
      ) : null}
    </li>
  );

  return (
    <div className="space-y-5">
      {upcoming.length ? (
        <section className="border border-[#e4dfd6] bg-white">
          <p className="border-b border-[#eee9e0] px-5 py-3 text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">Upcoming · {upcoming.length}</p>
          <ul className="divide-y divide-[#eee9e0]">{upcoming.map(row)}</ul>
        </section>
      ) : null}
      {past.length ? (
        <section className="border border-[#e4dfd6] bg-white">
          <p className="border-b border-[#eee9e0] px-5 py-3 text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">Held · {past.length}</p>
          <ul className="divide-y divide-[#eee9e0]">{past.map(row)}</ul>
        </section>
      ) : null}
      {cls.myRole === 'lead' && !cls.cancelledAt ? (
        <p className="text-xs text-[#8a847a]">
          To add, move or cancel sessions,{' '}
          <Link to={`/edit-class/${cls.id}`} className="text-[#c45c26] hover:underline">
            edit the class schedule
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

function RosterPanel({ cls }: { cls: StudioClass }) {
  const { data } = useStudio();
  const rows = data.learners.filter((l) => l.classId === cls.id).sort((a, b) => (a.status === 'dropped' ? 1 : 0) - (b.status === 'dropped' ? 1 : 0) || a.name.localeCompare(b.name));

  if (!rows.length) return <EmptyBlock text="No learners have enrolled yet." />;

  return (
    <section className="border border-[#e4dfd6] bg-white">
      <div className="flex items-center justify-between border-b border-[#eee9e0] px-5 py-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">{rows.length} learners</p>
        <ExportButton
          filename={`roster-${cls.title.slice(0, 40)}`}
          label="CSV"
          rows={() =>
            rows.map((l) => ({
              name: l.name,
              email: l.email,
              status: l.status,
              enrolled: l.enrolledAt?.slice(0, 10),
              progress_pct: l.progress,
              attendance_pct: l.attendanceRate ?? '',
              sessions_attended: `${l.sessionsAttended}/${l.sessionsHeld}`,
              assignments_submitted: `${l.submitted}/${l.assignmentsTotal}`,
              avg_grade_pct: l.avgGrade ?? '',
            }))
          }
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#eee9e0] bg-[#faf8f5] text-left text-[11px] uppercase tracking-wider text-[#8a847a]">
              <th className="px-5 py-2.5 font-medium">Learner</th>
              <th className="px-3 py-2.5 font-medium">Attendance</th>
              <th className="px-3 py-2.5 font-medium">Progress</th>
              <th className="px-3 py-2.5 font-medium">Work</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className={`border-b border-[#f1ede6] last:border-0 ${l.status === 'dropped' ? 'opacity-55' : ''}`}>
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={l.name} src={l.avatar || undefined} size={30} />
                    <div className="min-w-0">
                      <p className="truncate text-[#14110e]">
                        {l.name} {l.status !== 'active' ? <Pill tone={statusToneOf(l.status)}>{l.status}</Pill> : null}
                      </p>
                      <p className="truncate text-xs text-[#8a847a]">{l.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 tabular-nums">
                  {l.attendanceRate != null ? (
                    <span className={l.attendanceRate < 60 ? 'text-rose-700' : 'text-[#14110e]'}>{l.attendanceRate}%</span>
                  ) : (
                    '—'
                  )}
                  <span className="block text-xs text-[#8a847a]">
                    {l.sessionsAttended}/{l.sessionsHeld}
                  </span>
                </td>
                <td className="w-32 px-3 py-2.5">
                  <ProgressBar value={l.progress} />
                  <span className="mt-1 block text-xs text-[#8a847a]">{l.progress}%</span>
                </td>
                <td className="px-3 py-2.5 text-xs text-[#6b655c]">
                  {l.submitted}/{l.assignmentsTotal} submitted
                  {l.avgGrade != null ? <span className="block">avg {l.avgGrade}%</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AssignmentsPanel({ cls }: { cls: StudioClass }) {
  const { data } = useStudio();
  const [grading, setGrading] = useState<GradingItem | null>(null);
  const assignments = cls.assignments || [];
  const queue = data.gradingQueue.filter((g) => g.classId === cls.id);

  return (
    <div className="space-y-5">
      {assignments.length ? (
        <ul className="space-y-3">
          {assignments.map((a) => {
            const pending = queue.filter((g) => g.assignmentId === a.id);
            return (
              <li key={a.id} className="border border-[#e4dfd6] bg-white">
                <div className="flex flex-wrap items-start gap-3 px-5 py-4">
                  <FileText className="mt-0.5 h-4 w-4 text-[#c45c26]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#14110e]">{a.title}</p>
                    <p className="text-xs text-[#8a847a]">{relativeDue(a.dueDate)}</p>
                  </div>
                  {pending.length ? <Pill tone="clay">{pending.length} to grade</Pill> : <Pill tone="stone">Up to date</Pill>}
                </div>
                {pending.length ? (
                  <ul className="divide-y divide-[#eee9e0] border-t border-[#eee9e0]">
                    {pending.map((g) => (
                      <li key={g.id} className="flex items-center gap-3 px-5 py-2.5">
                        <Avatar name={g.learnerName} size={26} />
                        <span className="flex-1 truncate text-sm text-[#14110e]">{g.learnerName}</span>
                        {g.late ? <Pill tone="amber">Late</Pill> : null}
                        <button type="button" onClick={() => setGrading(g)} className={`${btn.secondary} py-1.5 text-xs`}>
                          Grade
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyBlock text="No assignments posted for this class yet." />
      )}
      <p className="text-xs text-[#8a847a]">
        Post or edit assignments in the{' '}
        <Link to={`/assignments/${cls.id}`} className="inline-flex items-center gap-0.5 text-[#c45c26] hover:underline">
          class assignments page <ExternalLink className="h-3 w-3" />
        </Link>
        .
      </p>
      <GradeModal item={grading} onClose={() => setGrading(null)} />
    </div>
  );
}
