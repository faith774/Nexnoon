import { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Eye,
  EyeOff,
  GraduationCap,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  UserMinus,
  UserPlus,
  XCircle,
} from 'lucide-react';
import apiClient from '@/lib/api/client';
import { classDetailUrl } from '@/lib/url';
import { Link } from 'react-router';
import { publicSiteHref } from '@/lib/portal';
import { useAdmin, useAdminAction } from './context';
import { AssignmentDetailsModal } from './AssignmentsSection';
import { AttendancePanel } from './AttendancePanel';
import { EnrollModal } from './modals';
import { CancelClassModal, CreateClassModal, SessionsPanel, TeachingTeamPanel } from './ClassOps';
import type { AssignmentOp, ClassOp, Payment } from './types';
import {
  Avatar,
  DetailGrid,
  Drawer,
  EmptyBlock,
  ExportButton,
  Field,
  FilterChips,
  Modal,
  inputCls,
  Pagination,
  Panel,
  Pill,
  ProgressBar,
  SegmentedTabs,
  StatTile,
  btn,
  fmtDate,
  fmtDateTime,
  matches,
  money,
  relativeDue,
  statusToneOf,
  usePagination,
  useSticky,
} from './ui';

type StatusFilter = 'all' | 'published' | 'draft' | 'archived' | 'free-approval';
type FillFilter = 'all' | 'near-full' | 'low-fill';

const GRID_SIZES = [12, 24, 48] as const;

function fillColor(rate: number) {
  return rate >= 80 ? 'bg-emerald-500' : rate < 30 ? 'bg-amber-400' : 'bg-[#3a5f8a]';
}

function StatusPill({ c, className }: { c: ClassOp; className?: string }) {
  return c.cancelledAt ? (
    <Pill tone="rose" className={className}>
      cancelled
    </Pill>
  ) : (
    <Pill tone={statusToneOf(c.status)} className={className}>
      {c.status}
    </Pill>
  );
}

export default function ClassesSection() {
  const { classOps, search, intent, data } = useAdmin();
  const [statusChoice, setStatus] = useState<StatusFilter>(intent.classStatus ?? 'all');
  const [fill, setFill] = useState<FillFilter>(intent.classFill ?? 'all');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [openId, setOpenId] = useState<string | null>(intent.openClassId ?? null);
  const [openTab, setOpenTab] = useState<DrawerTab>('overview');
  const [creating, setCreating] = useState(false);

  function open(id: string, tab: DrawerTab = 'overview') {
    setOpenTab(tab);
    setOpenId(id);
  }

  const counts = {
    all: classOps.length,
    published: classOps.filter((c) => c.status === 'published').length,
    draft: classOps.filter((c) => c.status === 'draft').length,
    archived: classOps.filter((c) => c.status === 'archived').length,
    freePending: classOps.filter((c) => c.freeApproval?.status === 'pending').length,
  };
  const status: StatusFilter = statusChoice === 'free-approval' && !counts.freePending ? 'all' : statusChoice;
  const nearFull = classOps.filter((c) => c.fillRate >= 80).length;
  const lowFill = classOps.filter((c) => c.fillRate < 30 && c.enrolledStudents > 0).length;

  const rows = classOps
    .filter((c) => status === 'all' || (status === 'free-approval' ? c.freeApproval?.status === 'pending' : c.status === status))
    .filter((c) => (fill === 'near-full' ? c.fillRate >= 80 : fill === 'low-fill' ? c.fillRate < 30 && c.enrolledStudents > 0 : true))
    .filter((c) => matches(search, c.title, c.category, c.instructorName))
    .sort((a, b) => b.fillRate - a.fillRate);
  const gridPager = usePagination(rows, 12, `${status}|${fill}|${search}`);
  const tablePager = usePagination(rows, 10, `${status}|${fill}|${search}`);
  const pager = view === 'grid' ? gridPager : tablePager;

  const published = classOps.filter((c) => c.status === 'published');
  const avgFill = published.length ? Math.round(published.reduce((s, c) => s + c.fillRate, 0) / published.length) : 0;
  const upcoming = classOps.filter((c) => c.nextSessionStart).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Classes" value={counts.all} hint={`${counts.published} published`} />
        <StatTile label="Avg fill rate" value={`${avgFill}%`} hint="Published classes" />
        <StatTile
          label="Near-full"
          value={nearFull}
          hint="80%+ seats taken"
          tone={nearFull ? 'good' : undefined}
          onClick={nearFull ? () => setFill('near-full') : undefined}
        />
        <StatTile
          label="Low-fill"
          value={lowFill}
          hint={`${upcoming} with a session scheduled`}
          tone={lowFill ? 'warn' : undefined}
          onClick={lowFill ? () => setFill('low-fill') : undefined}
        />
      </div>

      <Panel
        title="Classes"
        subtitle="Every cohort on the platform, sorted by how full it is."
        icon={<GraduationCap className="h-4 w-4" />}
        actions={
          <div className="flex items-center gap-2">
          <ExportButton
            filename="classes"
            rows={() =>
              rows.map((c) => ({
                class: c.title,
                status: c.cancelledAt ? 'cancelled' : c.status,
                category: c.category,
                instructor: c.instructorName || '',
                enrolled: c.enrolledStudents,
                capacity: c.maxStudents,
                fill_pct: c.fillRate,
                price: c.price,
                currency: c.currency,
                timezone: c.timezone || '',
                next_session: c.nextSessionStart ? fmtDateTime(c.nextSessionStart) : '',
                created: fmtDate(c.createdAt),
              }))
            }
          />
          <button type="button" className={btn.primary} onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New class
          </button>
          <div className="flex border border-[#d0dae6]" role="group" aria-label="Layout">
            {(
              [
                ['grid', LayoutGrid, 'Cards'],
                ['table', List, 'Table'],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                aria-label={label}
                aria-pressed={view === id}
                onClick={() => setView(id)}
                className={`flex h-9 w-9 items-center justify-center transition-colors ${
                  view === id ? 'bg-[#0b1220] text-white' : 'bg-white text-[#5c6b7a] hover:text-[#0b1220]'
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          </div>
        }
        bodyClassName=""
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4ebf2] px-5 py-3 md:px-6">
          <FilterChips
            label="Class status"
            value={status}
            onChange={setStatus}
            options={[
              { id: 'all', label: 'All', count: counts.all },
              { id: 'published', label: 'Published', count: counts.published },
              { id: 'draft', label: 'Draft', count: counts.draft },
              { id: 'archived', label: 'Archived', count: counts.archived },
              ...(counts.freePending ? [{ id: 'free-approval' as const, label: 'Free — needs approval', count: counts.freePending }] : []),
            ]}
          />
          <FilterChips
            label="Fill"
            value={fill}
            onChange={setFill}
            options={[
              { id: 'all', label: 'Any fill' },
              { id: 'near-full', label: 'Near-full', count: nearFull },
              { id: 'low-fill', label: 'Low-fill', count: lowFill },
            ]}
          />
        </div>

        {!rows.length ? (
          <div className="p-5 md:p-6">
            <EmptyBlock text={classOps.length ? 'No classes match these filters.' : 'No classes have been created yet.'} />
          </div>
        ) : view === 'grid' ? (
          <>
            <div className="grid gap-4 p-5 sm:grid-cols-2 md:p-6 xl:grid-cols-3">
              {pager.pageItems.map((c) => (
                <ClassCard key={c.id} c={c} onOpen={() => open(c.id)} />
              ))}
            </div>
            <Pagination {...pager} noun="classes" sizes={GRID_SIZES} />
          </>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e4ebf2] bg-[#f7f9fc] text-[11px] uppercase tracking-wider text-[#6a7a8c]">
                    <th className="px-5 py-2.5 font-medium md:px-6">Class</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Seats</th>
                    <th className="px-3 py-2.5 font-medium">Price</th>
                    <th className="px-3 py-2.5 font-medium">Work</th>
                    <th className="px-3 py-2.5 font-medium">Next session</th>
                  </tr>
                </thead>
                <tbody>
                  {pager.pageItems.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => open(c.id)}
                      className="cursor-pointer border-b border-[#eef2f7] last:border-0 hover:bg-[#f7f9fc]"
                    >
                      <td className="px-5 py-3 md:px-6">
                        <div className="flex items-center gap-3">
                          {c.thumbnail ? (
                            <img src={c.thumbnail} alt="" className="h-10 w-14 shrink-0 object-cover" />
                          ) : (
                            <span className="h-10 w-14 shrink-0 bg-gradient-to-br from-[#1a2438] via-[#3a5f8a] to-[#889dd1]" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#0b1220]">{c.title}</p>
                            <p className="truncate text-xs text-[#7a8898]">
                              {c.instructorName || 'No instructor'} · {c.category}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill c={c} />
                      </td>
                      <td className="px-3 py-3">
                        <p className="tabular-nums text-[#0b1220]">
                          {c.enrolledStudents}/{c.maxStudents}
                        </p>
                        <ProgressBar value={c.fillRate} tone={fillColor(c.fillRate)} className="mt-1 w-20" />
                      </td>
                      <td className="px-3 py-3">{money(c.price, c.currency)}</td>
                      <td className="px-3 py-3 text-xs text-[#5c6b7a]">
                        {c.assignmentCount ?? 0} tasks · {c.submissionCount ?? 0} subs
                      </td>
                      <td className="px-3 py-3 text-xs text-[#5c6b7a]">{c.nextSessionStart ? fmtDateTime(c.nextSessionStart) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...pager} noun="classes" />
          </>
        )}
      </Panel>

      <ClassDrawer
        classId={openId}
        initialTab={openTab}
        onClose={() => setOpenId(null)}
        hasCourses={!!data.courses?.length}
      />
      <CreateClassModal open={creating} onClose={() => setCreating(false)} onCreated={(id) => open(id, 'sessions')} />
    </div>
  );
}

function ClassCard({ c, onOpen }: { c: ClassOp; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden border border-[#e4ebf2] bg-white text-left transition-all hover:-translate-y-0.5 hover:border-[#889dd1]/70 hover:shadow-[0_16px_40px_-24px_rgba(11,18,32,0.45)]"
    >
      <div className="relative h-32 w-full overflow-hidden">
        {c.thumbnail ? (
          <img src={c.thumbnail} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#1a2438] via-[#3a5f8a] to-[#889dd1]" />
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <StatusPill c={c} className="bg-white/95" />
        </div>
        <span className="absolute bottom-3 right-3 bg-[#0b1220]/80 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
          {money(c.price, c.currency)}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] uppercase tracking-[0.12em] text-[#7a8898]">{c.category}</p>
        <p className="mt-1 line-clamp-2 font-medium leading-snug text-[#0b1220] group-hover:text-[#3a5f8a]">{c.title}</p>
        <p className="mt-1 text-xs text-[#6a7a8c]">
          {c.instructorName || 'No instructor'}
          {c.teachingTeamCount ? ` + ${c.teachingTeamCount} support` : ''}
        </p>
        <div className="mt-auto pt-4">
          <div className="mb-1 flex justify-between text-[11px] text-[#6a7a8c]">
            <span>
              {c.enrolledStudents}/{c.maxStudents} seats · {c.fillRate}%
            </span>
            <span>{c.seatsLeft} left</span>
          </div>
          <ProgressBar value={c.fillRate} tone={fillColor(c.fillRate)} />
          <div className="mt-3 flex items-center justify-between text-[11px] text-[#7a8898]">
            <span>
              {c.sessionCount ?? 0} sessions · {c.assignmentCount ?? 0} assignments
            </span>
            {c.nextSessionStart ? (
              <span className="inline-flex items-center gap-1 text-[#3a5f8a]">
                <CalendarClock className="h-3 w-3" />
                {fmtDate(c.nextSessionStart)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Details drawer                                                      */
/* ------------------------------------------------------------------ */

type DrawerTab = 'overview' | 'sessions' | 'attendance' | 'learners' | 'assignments' | 'payments';

function ClassDrawer({
  classId,
  initialTab = 'overview',
  onClose,
  hasCourses,
}: {
  classId: string | null;
  initialTab?: DrawerTab;
  onClose: () => void;
  hasCourses: boolean;
}) {
  const { data, classOps, goTo } = useAdmin();
  const run = useAdminAction();
  const [tab, setTab] = useState<DrawerTab>(initialTab);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [dropping, setDropping] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<AssignmentOp | null>(null);
  const [refunding, setRefunding] = useState<Payment | null>(null);
  const [lastId, setLastId] = useState(classId);
  if (classId !== lastId) {
    setLastId(classId);
    if (classId) setTab(initialTab);
  }
  const shownId = useSticky(classId);

  const op = classOps.find((c) => c.id === shownId);
  const cls = data.classes.find((c) => c.id === shownId);
  const roster = (data.enrollments || []).filter((e) => e.classId === shownId);
  const assignments = (data.assignmentOps || []).filter((a) => a.classId === shownId);
  const payments = data.payments.filter((p) => p.classId === shownId);
  const course = cls?.courseId ? data.courses?.find((c) => c.id === cls.courseId) : undefined;
  const cancelled = !!cls?.cancelledAt;
  const revenue = payments.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount, 0);

  const rosterPager = usePagination(roster, 10, classId || '');
  const payPager = usePagination(payments, 10, classId || '');

  async function drop(enrollmentId: string, name: string) {
    if (!window.confirm(`Drop ${name} from this class?`)) return;
    setDropping(enrollmentId);
    await run(() => apiClient.delete(`/data/admin/enrollments/${enrollmentId}`), { success: `${name} dropped` });
    setDropping(null);
  }

  async function toggleVisibility() {
    if (!op) return;
    const next = op.status === 'published' ? 'draft' : 'published';
    if (next === 'draft' && op.enrolledStudents > 0 && !window.confirm('Hide this class from the catalog? Enrolled learners keep access.')) return;
    setToggling(true);
    await run(() => apiClient.patch(`/classes/${op.id}`, { status: next }), {
      success: next === 'published' ? 'Class published' : 'Class moved to draft',
    });
    setToggling(false);
  }

  return (
    <>
      <Drawer
        open={!!classId && !!op}
        onClose={onClose}
        width="max-w-3xl"
        eyebrow="Class"
        title={op?.title}
        subtitle={
          op ? (
            <span className="flex flex-wrap items-center gap-2">
              <StatusPill c={op} />
              <span>{op.instructorName || 'No instructor'}</span>
              <span className="text-[#9aa7b5]">·</span>
              <span>{op.category}</span>
            </span>
          ) : null
        }
        headerExtra={
          <div className="mt-4">
            <SegmentedTabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'overview', label: 'Overview' },
                { id: 'sessions', label: 'Sessions', count: op?.sessionCount ?? cls?.totalSessions ?? 0 },
                { id: 'attendance', label: 'Attendance' },
                { id: 'learners', label: 'Learners', count: roster.length },
                { id: 'assignments', label: 'Assignments', count: assignments.length },
                { id: 'payments', label: 'Payments', count: payments.length },
              ]}
            />
          </div>
        }
        footer={
          op ? (
            <>
              <a href={publicSiteHref(classDetailUrl(op.id, op.title))} target="_blank" rel="noreferrer" className={`${btn.link} mr-auto`}>
                Public page <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              {!cancelled && (
                <button type="button" className={btn.danger} onClick={() => setCancelOpen(true)}>
                  <XCircle className="h-3.5 w-3.5" /> Cancel class
                </button>
              )}
              {!cancelled && (
                <Link to={`/admin/classes/${op.id}/edit`} className={btn.secondary}>
                  <Pencil className="h-3.5 w-3.5" /> Edit class
                </Link>
              )}
              {!cancelled && op.status !== 'archived' && (
                <button type="button" className={btn.secondary} disabled={toggling} onClick={() => void toggleVisibility()}>
                  {op.status === 'published' ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" /> Unpublish
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" /> Publish
                    </>
                  )}
                </button>
              )}
              {op.status === 'published' && (
                <button type="button" className={btn.primary} onClick={() => setEnrollOpen(true)}>
                  <UserPlus className="h-3.5 w-3.5" /> Enroll learner
                </button>
              )}
            </>
          ) : null
        }
      >
        {op ? (
          <div className="space-y-5">
            {tab === 'overview' && (
              <>
                {op.freeApproval?.status === 'pending' || op.freeApproval?.status === 'rejected' ? <FreeApprovalBanner op={op} /> : null}
                {cls?.cancelledAt ? (
                  <div className="flex gap-3 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">Cancelled {fmtDateTime(cls.cancelledAt)}</p>
                      {cls.cancellationReason ? <p className="mt-0.5 whitespace-pre-line">{cls.cancellationReason}</p> : null}
                    </div>
                  </div>
                ) : null}
                <div className="relative h-40 overflow-hidden">
                  {op.thumbnail ? (
                    <img src={op.thumbnail} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-[#1a2438] via-[#3a5f8a] to-[#889dd1]" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0b1220]/85 to-transparent p-4 text-white">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-white/70">Seats</p>
                        <p className="font-display text-2xl">
                          {op.enrolledStudents}/{op.maxStudents}
                        </p>
                      </div>
                      <p className="text-sm">{op.seatsLeft} left · {op.fillRate}% full</p>
                    </div>
                    <ProgressBar value={op.fillRate} tone={fillColor(op.fillRate)} className="mt-2 bg-white/20" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <StatTile label="Revenue" value={money(revenue, op.currency)} />
                  <StatTile label="Sessions" value={op.sessionCount ?? cls?.totalSessions ?? 0} />
                  <StatTile label="Assignments" value={op.assignmentCount ?? assignments.length} />
                  <StatTile label="Submissions" value={op.submissionCount ?? 0} />
                </div>

                {op.nextSessionStart ? (
                  <div className="flex items-center gap-3 border border-[#c9d6e6] bg-[#eef3f9] px-4 py-3 text-sm">
                    <CalendarClock className="h-4 w-4 text-[#3a5f8a]" />
                    <span className="text-[#0b1220]">
                      Next: <strong className="font-medium">{op.nextSessionTitle || 'Session'}</strong> · {fmtDateTime(op.nextSessionStart)}
                    </span>
                  </div>
                ) : null}

                <Panel bodyClassName="p-5">
                  <DetailGrid
                    cols={3}
                    items={[
                      { label: 'Price', value: money(op.price, op.currency) },
                      { label: 'Level', value: cls?.level || '—' },
                      { label: 'Language', value: cls?.language || '—' },
                      {
                        label: 'Course',
                        value: course ? (
                          <button type="button" className="text-left text-[#3a5f8a] hover:underline" onClick={() => goTo('courses', { openCourseId: course.id })}>
                            {course.title}
                          </button>
                        ) : (
                          <span className="text-[#9aa7b5]">{hasCourses ? 'Not linked' : '—'}</span>
                        ),
                      },
                      { label: 'Session length', value: cls?.duration ? `${cls.duration} min` : '—' },
                      { label: 'Timezone', value: cls?.timezone || '—' },
                      { label: 'Created', value: fmtDate(op.createdAt) },
                      { label: 'Starts', value: fmtDate(cls?.startDate) },
                      { label: 'Ends', value: fmtDate(cls?.endDate) },
                      { label: 'Rating', value: cls?.reviewsCount ? `${cls.rating.toFixed(1)} (${cls.reviewsCount})` : 'No reviews' },
                    ]}
                  />
                  {cls?.description ? (
                    <p className="mt-5 line-clamp-6 whitespace-pre-line border-t border-[#e4ebf2] pt-4 text-sm leading-relaxed text-[#3d4a5c]">
                      {cls.description}
                    </p>
                  ) : null}
                </Panel>

                {cls ? <TeachingTeamPanel cls={cls} /> : null}
              </>
            )}

            {tab === 'sessions' && cls ? <SessionsPanel cls={cls} /> : null}

            {tab === 'attendance' ? <AttendancePanel classId={op.id} /> : null}

            {tab === 'learners' && (
              <Panel bodyClassName="">
                {!roster.length ? (
                  <div className="p-5">
                    <EmptyBlock
                      text="No learners enrolled yet."
                      action={
                        op.status === 'published' ? (
                          <button type="button" className={btn.primary} onClick={() => setEnrollOpen(true)}>
                            <UserPlus className="h-4 w-4" /> Enroll learner
                          </button>
                        ) : undefined
                      }
                    />
                  </div>
                ) : (
                  <>
                    <ul className="divide-y divide-[#eef2f7]">
                      {rosterPager.pageItems.map((e) => (
                        <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                          <Avatar name={e.learnerName} size={34} />
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => goTo('learners', { openLearnerId: e.userId })}
                          >
                            <p className="truncate text-sm font-medium text-[#0b1220] hover:text-[#3a5f8a]">{e.learnerName}</p>
                            <p className="truncate text-xs text-[#7a8898]">
                              {e.learnerEmail} · joined {fmtDate(e.enrolledAt)}
                            </p>
                          </button>
                          <div className="hidden w-28 sm:block">
                            <p className="mb-1 text-right text-[11px] text-[#6a7a8c]">{e.progress}%</p>
                            <ProgressBar value={e.progress} />
                          </div>
                          <button
                            type="button"
                            disabled={dropping === e.id}
                            onClick={() => void drop(e.id, e.learnerName)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            <UserMinus className="h-3.5 w-3.5" /> Drop
                          </button>
                        </li>
                      ))}
                    </ul>
                    <Pagination {...rosterPager} noun="learners" />
                  </>
                )}
              </Panel>
            )}

            {tab === 'assignments' && (
              <Panel bodyClassName="">
                {!assignments.length ? (
                  <div className="p-5">
                    <EmptyBlock text="The instructor hasn’t posted any assignments for this class." />
                  </div>
                ) : (
                  <ul className="divide-y divide-[#eef2f7]">
                    {assignments.map((a) => {
                      const pct = a.enrolledStudents ? Math.round((a.submissionCount / a.enrolledStudents) * 100) : 0;
                      return (
                        <li key={a.id}>
                          <button type="button" onClick={() => setAssignment(a)} className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-[#f7f9fc]">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-[#0b1220]">{a.title}</p>
                              <p className="text-xs text-[#7a8898]">{relativeDue(a.dueDate)}</p>
                            </div>
                            <div className="w-32">
                              <p className="mb-1 text-right text-[11px] text-[#6a7a8c]">
                                {a.submissionCount}/{a.enrolledStudents} submitted
                              </p>
                              <ProgressBar value={pct} />
                            </div>
                            <ArrowUpRight className="h-4 w-4 text-[#9aa7b5]" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            )}

            {tab === 'payments' && (
              <Panel
                bodyClassName=""
                title="Payments"
                actions={
                  <ExportButton
                    filename={`payments-${op.title.slice(0, 40)}`}
                    label="CSV"
                    rows={() => payments.map((p) => ({ date: fmtDate(p.createdAt), learner: p.student || '', amount: p.amount, currency: p.currency, status: p.status }))}
                  />
                }
              >
                {!payments.length ? (
                  <div className="p-5">
                    <EmptyBlock text="No payments recorded for this class." />
                  </div>
                ) : (
                  <>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#e4ebf2] bg-[#f7f9fc] text-[11px] uppercase tracking-wider text-[#6a7a8c]">
                          <th className="px-4 py-2.5 font-medium">Date</th>
                          <th className="px-4 py-2.5 font-medium">Learner</th>
                          <th className="px-4 py-2.5 font-medium">Amount</th>
                          <th className="px-4 py-2.5 font-medium">Status</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {payPager.pageItems.map((p) => (
                          <tr key={p.id} className="border-b border-[#eef2f7] last:border-0">
                            <td className="px-4 py-3 text-[#5c6b7a]">{fmtDate(p.createdAt)}</td>
                            <td className="px-4 py-3">{p.student || '—'}</td>
                            <td className="px-4 py-3 font-medium">{money(p.amount, p.currency)}</td>
                            <td className="px-4 py-3">
                              <Pill tone={statusToneOf(p.status)}>{p.status}</Pill>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {p.status === 'completed' ? (
                                <button type="button" className="text-xs text-rose-700 hover:underline" onClick={() => setRefunding(p)}>
                                  Refund
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Pagination {...payPager} noun="payments" />
                  </>
                )}
              </Panel>
            )}
          </div>
        ) : null}
      </Drawer>

      <EnrollModal open={enrollOpen} onClose={() => setEnrollOpen(false)} classId={op?.id} />
      <CancelClassModal open={cancelOpen} onClose={() => setCancelOpen(false)} op={op} />
      <AssignmentDetailsModal assignment={assignment} onClose={() => setAssignment(null)} />
      <RefundModal payment={refunding} onClose={() => setRefunding(null)} />
    </>
  );
}

function FreeApprovalBanner({ op }: { op: ClassOp }) {
  const run = useAdminAction();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const rejected = op.freeApproval?.status === 'rejected';

  async function decide(decision: 'approve' | 'reject') {
    if (decision === 'reject' && !note.trim()) return;
    setBusy(decision);
    await run(() => apiClient.post(`/admin/classes/${op.id}/free-approval`, { decision, note: note.trim() || undefined }));
    setBusy(null);
  }

  return (
    <div className={`border px-4 py-3 text-sm ${rejected ? 'border-slate-200 bg-slate-50 text-slate-800' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>
      <p className="font-medium">{rejected ? 'Free pricing was rejected' : `${op.instructorName || 'The instructor'} wants to run this class for free`}</p>
      <p className="mt-0.5">
        {rejected
          ? op.freeApproval?.note
          : 'Free classes are approved one by one to prevent instructors collecting money outside Nexnoon. It stays hidden until you decide.'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input className={`${inputCls} min-w-[220px] flex-1 bg-white`} placeholder="Note to the instructor (required to reject)" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="button" className={btn.primary} disabled={!!busy} onClick={() => void decide('approve')}>
          {busy === 'approve' ? 'Approving…' : 'Approve free'}
        </button>
        {!rejected ? (
          <button type="button" className={btn.danger} disabled={!!busy || !note.trim()} onClick={() => void decide('reject')}>
            {busy === 'reject' ? 'Rejecting…' : 'Reject'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RefundModal({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const run = useAdminAction();
  const shown = useSticky(payment);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if ((payment?.id ?? null) !== lastId) {
    setLastId(payment?.id ?? null);
    setReason('');
  }
  return (
    <Modal
      open={!!payment}
      onClose={onClose}
      size="sm"
      title="Refund payment"
      eyebrow={shown ? `${shown.student || 'Learner'} · ${money(shown.amount, shown.currency)}` : undefined}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`${btn.danger} border-rose-600 bg-rose-600 text-white hover:bg-rose-700`}
            disabled={busy || reason.trim().length < 3}
            onClick={async () => {
              if (!shown) return;
              setBusy(true);
              const res = await run(() => apiClient.post(`/admin/payments/${shown.id}/refund`, { reason: reason.trim() }));
              setBusy(false);
              if (res) onClose();
            }}
          >
            {busy ? 'Refunding…' : 'Refund in full'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-[#5c6b7a]">
          The learner gets their money back through Stripe. The instructor’s share is removed from their balance, or taken from their next payout if already paid.
        </p>
        <Field label="Reason">
          <input className={inputCls} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Class cancelled" />
        </Field>
      </div>
    </Modal>
  );
}
