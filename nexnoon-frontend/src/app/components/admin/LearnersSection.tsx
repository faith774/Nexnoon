import { useMemo, useState } from 'react';
import { Award, GraduationCap, Mail, UserMinus, UserPlus, Users } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useAdmin, useAdminAction } from './context';
import { CreateAccountModal, EmailModal, EnrollModal } from './modals';
import type { Account, EnrollmentRow } from './types';
import {
  Avatar,
  DetailGrid,
  Drawer,
  EmptyBlock,
  ExportButton,
  FilterChips,
  Pagination,
  Panel,
  Pill,
  ProgressBar,
  SectionLabel,
  SegmentedTabs,
  StatTile,
  btn,
  daysAgo,
  fmtDate,
  matches,
  money,
  statusToneOf,
  usePagination,
  useSticky,
} from './ui';

type View = 'people' | 'enrollments';
type PeopleFilter = 'all' | 'enrolled' | 'none';
type EnrollFilter = 'all' | 'active' | 'completed';

export default function LearnersSection() {
  const { data, search, intent } = useAdmin();
  const run = useAdminAction();
  const [view, setView] = useState<View>('people');
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>('all');
  const [enrollFilter, setEnrollFilter] = useState<EnrollFilter>('all');
  const [openId, setOpenId] = useState<string | null>(intent.openLearnerId ?? null);
  const [addOpen, setAddOpen] = useState(false);
  const [enroll, setEnroll] = useState<{ open: boolean; userId?: string }>({ open: false });
  const [dropping, setDropping] = useState<string | null>(null);

  const enrollments = data.enrollments || [];
  const learners = (data.users || []).filter((u) => u.role === 'student');
  const byLearner = useMemo(() => {
    const map = new Map<string, EnrollmentRow[]>();
    for (const e of enrollments) map.set(e.userId, [...(map.get(e.userId) || []), e]);
    return map;
  }, [enrollments]);

  const enrolledCount = learners.filter((u) => byLearner.has(u.id)).length;
  const avgProgress = enrollments.length ? Math.round(enrollments.reduce((s, e) => s + (e.progress || 0), 0) / enrollments.length) : 0;
  const newThisMonth = learners.filter((u) => Date.now() - new Date(u.createdAt).getTime() < 30 * 86400000).length;

  const people = learners
    .filter((u) => (peopleFilter === 'enrolled' ? byLearner.has(u.id) : peopleFilter === 'none' ? !byLearner.has(u.id) : true))
    .filter((u) => matches(search, u.fullName, u.email))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const peoplePager = usePagination(people, 10, `${peopleFilter}|${search}`);

  const enrollRows = enrollments
    .filter((e) => (enrollFilter === 'completed' ? e.status === 'completed' : enrollFilter === 'active' ? e.status !== 'completed' : true))
    .filter((e) => matches(search, e.learnerName, e.learnerEmail, e.classTitle, e.instructorName))
    .sort((a, b) => new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime());
  const enrollPager = usePagination(enrollRows, 10, `${enrollFilter}|${search}`);

  async function drop(e: EnrollmentRow) {
    if (!window.confirm(`Drop ${e.learnerName} from ${e.classTitle}?`)) return;
    setDropping(e.id);
    await run(() => apiClient.delete(`/data/admin/enrollments/${e.id}`), { success: `${e.learnerName} dropped` });
    setDropping(null);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Learners" value={learners.length} hint={`${newThisMonth} joined in the last 30 days`} />
        <StatTile label="Enrolled" value={enrolledCount} hint="In at least one class" tone={enrolledCount ? 'good' : undefined} />
        <StatTile
          label="Not enrolled yet"
          value={learners.length - enrolledCount}
          hint="Signed up, no class"
          tone={learners.length - enrolledCount ? 'warn' : undefined}
          onClick={() => {
            setView('people');
            setPeopleFilter('none');
          }}
        />
        <StatTile label="Avg progress" value={`${avgProgress}%`} hint={`${enrollments.length} active enrollments`} />
      </div>

      <Panel
        title="Learners"
        subtitle="Everyone learning on Nexnoon. Open a learner to see their classes, progress and payments."
        icon={<Users className="h-4 w-4" />}
        actions={
          <>
            <ExportButton
              filename={view === 'people' ? 'learners' : 'enrollments'}
              rows={() =>
                view === 'people'
                  ? people.map((u) => ({
                      name: u.fullName,
                      email: u.email,
                      joined: fmtDate(u.createdAt),
                      classes: (byLearner.get(u.id) || []).length,
                      completed: (byLearner.get(u.id) || []).filter((e) => e.status === 'completed').length,
                    }))
                  : enrollRows.map((e) => ({
                      learner: e.learnerName,
                      email: e.learnerEmail,
                      class: e.classTitle,
                      instructor: e.instructorName,
                      status: e.status,
                      progress_pct: e.progress,
                      enrolled: fmtDate(e.enrolledAt),
                    }))
              }
            />
            <button type="button" className={btn.secondary} onClick={() => setEnroll({ open: true })}>
              <GraduationCap className="h-4 w-4" /> Enroll learner
            </button>
            <button type="button" className={btn.primary} onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add learner
            </button>
          </>
        }
        bodyClassName=""
      >
        <div className="space-y-3 border-b border-[#e4ebf2] px-5 pt-3 md:px-6">
          <SegmentedTabs
            value={view}
            onChange={setView}
            tabs={[
              { id: 'people', label: 'People', count: learners.length },
              { id: 'enrollments', label: 'Enrollments', count: enrollments.length },
            ]}
          />
          <div className="pb-3">
            {view === 'people' ? (
              <FilterChips
                label="Enrollment"
                value={peopleFilter}
                onChange={setPeopleFilter}
                options={[
                  { id: 'all', label: 'All', count: learners.length },
                  { id: 'enrolled', label: 'Enrolled', count: enrolledCount },
                  { id: 'none', label: 'Not enrolled', count: learners.length - enrolledCount },
                ]}
              />
            ) : (
              <FilterChips
                label="Status"
                value={enrollFilter}
                onChange={setEnrollFilter}
                options={[
                  { id: 'all', label: 'All', count: enrollments.length },
                  { id: 'active', label: 'In progress', count: enrollments.filter((e) => e.status !== 'completed').length },
                  { id: 'completed', label: 'Completed', count: enrollments.filter((e) => e.status === 'completed').length },
                ]}
              />
            )}
          </div>
        </div>

        {view === 'people' ? (
          !people.length ? (
            <div className="p-5 md:p-6">
              <EmptyBlock text={learners.length ? 'No learners match.' : 'No learner accounts yet.'} />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#e4ebf2] bg-[#f7f9fc] text-[11px] uppercase tracking-wider text-[#6a7a8c]">
                      <th className="px-5 py-2.5 font-medium md:px-6">Learner</th>
                      <th className="px-3 py-2.5 font-medium">Classes</th>
                      <th className="px-3 py-2.5 font-medium">Avg progress</th>
                      <th className="px-3 py-2.5 font-medium">Joined</th>
                      <th className="px-3 py-2.5 font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {peoplePager.pageItems.map((u) => {
                      const rows = byLearner.get(u.id) || [];
                      const avg = rows.length ? Math.round(rows.reduce((s, e) => s + e.progress, 0) / rows.length) : 0;
                      return (
                        <tr
                          key={u.id}
                          onClick={() => setOpenId(u.id)}
                          className="cursor-pointer border-b border-[#eef2f7] last:border-0 hover:bg-[#f7f9fc]"
                        >
                          <td className="px-5 py-3 md:px-6">
                            <div className="flex items-center gap-3">
                              <Avatar name={u.fullName} src={u.avatar} size={36} />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-[#0b1220]">{u.fullName}</p>
                                <p className="truncate text-xs text-[#7a8898]">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {rows.length ? (
                              <span className="tabular-nums">{rows.length}</span>
                            ) : (
                              <Pill tone="amber">none</Pill>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {rows.length ? (
                              <div className="flex items-center gap-2">
                                <ProgressBar value={avg} className="w-20" />
                                <span className="text-xs tabular-nums text-[#5c6b7a]">{avg}%</span>
                              </div>
                            ) : (
                              <span className="text-xs text-[#9aa7b5]">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-[#5c6b7a]">{fmtDate(u.createdAt)}</td>
                          <td className="px-3 py-3">
                            {u.isEmailVerified ? <Pill tone="green">verified</Pill> : <Pill tone="slate">unverified</Pill>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination {...peoplePager} noun="learners" />
            </>
          )
        ) : !enrollRows.length ? (
          <div className="p-5 md:p-6">
            <EmptyBlock text={enrollments.length ? 'No enrollments match.' : 'No active enrollments yet.'} />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e4ebf2] bg-[#f7f9fc] text-[11px] uppercase tracking-wider text-[#6a7a8c]">
                    <th className="px-5 py-2.5 font-medium md:px-6">Learner</th>
                    <th className="px-3 py-2.5 font-medium">Class</th>
                    <th className="px-3 py-2.5 font-medium">Progress</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Enrolled</th>
                    <th className="px-5 py-2.5 md:px-6" />
                  </tr>
                </thead>
                <tbody>
                  {enrollPager.pageItems.map((e) => (
                    <tr key={e.id} className="border-b border-[#eef2f7] last:border-0 hover:bg-[#f7f9fc]">
                      <td className="px-5 py-3 md:px-6">
                        <button type="button" className="text-left" onClick={() => setOpenId(e.userId)}>
                          <p className="font-medium text-[#0b1220] hover:text-[#3a5f8a]">{e.learnerName}</p>
                          <p className="text-xs text-[#7a8898]">{e.learnerEmail}</p>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-[#0b1220]">{e.classTitle}</p>
                        <p className="text-xs text-[#7a8898]">{e.instructorName || 'No instructor'}</p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={e.progress} className="w-20" />
                          <span className="text-xs tabular-nums text-[#5c6b7a]">{e.progress}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Pill tone={statusToneOf(e.status)}>{e.status}</Pill>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-[#5c6b7a]">{fmtDate(e.enrolledAt)}</td>
                      <td className="px-5 py-3 text-right md:px-6">
                        <button
                          type="button"
                          disabled={dropping === e.id}
                          onClick={() => void drop(e)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          <UserMinus className="h-3.5 w-3.5" /> Drop
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...enrollPager} noun="enrollments" />
          </>
        )}
      </Panel>

      <LearnerDrawer
        learner={learners.find((u) => u.id === openId) || null}
        enrollments={openId ? byLearner.get(openId) || [] : []}
        onClose={() => setOpenId(null)}
        onEnroll={(userId) => setEnroll({ open: true, userId })}
        onDrop={drop}
        dropping={dropping}
      />
      <CreateAccountModal open={addOpen} onClose={() => setAddOpen(false)} />
      <EnrollModal open={enroll.open} userId={enroll.userId} onClose={() => setEnroll({ open: false })} />
    </div>
  );
}

function LearnerDrawer({
  learner: openLearner,
  enrollments: openEnrollments,
  onClose,
  onEnroll,
  onDrop,
  dropping,
}: {
  learner: Account | null;
  enrollments: EnrollmentRow[];
  onClose: () => void;
  onEnroll: (userId: string) => void;
  onDrop: (e: EnrollmentRow) => void;
  dropping: string | null;
}) {
  const { data, goTo } = useAdmin();
  const learner = useSticky(openLearner);
  const enrollments = openLearner ? openEnrollments : [];
  const [emailing, setEmailing] = useState<Account | null>(null);

  const payments = learner ? data.payments.filter((p) => p.userId === learner.id || (!p.userId && p.student === learner.fullName)) : [];
  const spent = payments.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
  const certificates = enrollments.filter((e) => e.certificateUrl).length;
  const avg = enrollments.length ? Math.round(enrollments.reduce((s, e) => s + e.progress, 0) / enrollments.length) : 0;

  return (
    <>
      <Drawer
        open={!!openLearner}
        onClose={onClose}
        eyebrow="Learner"
        title={
          learner ? (
            <span className="flex items-center gap-3">
              <Avatar name={learner.fullName} src={learner.avatar} size={44} />
              <span className="min-w-0">
                <span className="block truncate">{learner.fullName}</span>
                <span className="block truncate font-sans text-sm font-normal text-[#5c6b7a]">{learner.email}</span>
              </span>
            </span>
          ) : null
        }
        footer={
          learner ? (
            <>
              <button type="button" className={btn.secondary} onClick={() => setEmailing(learner)}>
                <Mail className="h-3.5 w-3.5" /> Email
              </button>
              <button type="button" className={btn.primary} onClick={() => onEnroll(learner.id)}>
                <GraduationCap className="h-3.5 w-3.5" /> Enroll in a class
              </button>
            </>
          ) : null
        }
      >
        {learner ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="Classes" value={enrollments.length} />
              <StatTile label="Avg progress" value={`${avg}%`} />
              <StatTile label="Certificates" value={certificates} />
              <StatTile label="Spent" value={money(spent)} />
            </div>

            <Panel bodyClassName="p-5">
              <DetailGrid
                items={[
                  { label: 'Joined', value: `${fmtDate(learner.createdAt)} · ${daysAgo(learner.createdAt)}` },
                  {
                    label: 'Email',
                    value: learner.isEmailVerified ? <span className="text-emerald-700">Verified</span> : <span className="text-amber-800">Not verified</span>,
                  },
                  { label: 'Timezone', value: learner.timezone || '—' },
                  { label: 'Languages', value: (learner.languages || []).join(', ') || '—' },
                ]}
              />
            </Panel>

            <div>
              <SectionLabel>Classes</SectionLabel>
              {!enrollments.length ? (
                <EmptyBlock
                  text="Not enrolled in any class yet."
                  action={
                    <button type="button" className={btn.primary} onClick={() => onEnroll(learner.id)}>
                      <GraduationCap className="h-4 w-4" /> Enroll in a class
                    </button>
                  }
                />
              ) : (
                <ul className="space-y-2.5">
                  {enrollments.map((e) => (
                    <li key={e.id} className="border border-[#e4ebf2] bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <button type="button" className="min-w-0 text-left" onClick={() => goTo('classes', { openClassId: e.classId })}>
                          <p className="font-medium text-[#0b1220] hover:text-[#3a5f8a]">{e.classTitle}</p>
                          <p className="mt-0.5 text-xs text-[#7a8898]">
                            {e.instructorName || 'No instructor'} · enrolled {fmtDate(e.enrolledAt)}
                          </p>
                        </button>
                        <div className="flex shrink-0 items-center gap-2">
                          {e.certificateUrl ? (
                            <a href={e.certificateUrl} target="_blank" rel="noreferrer" title="Certificate" className="text-emerald-700">
                              <Award className="h-4 w-4" />
                            </a>
                          ) : null}
                          <Pill tone={statusToneOf(e.status)}>{e.status}</Pill>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <ProgressBar value={e.progress} className="flex-1" />
                        <span className="w-10 text-right text-xs tabular-nums text-[#5c6b7a]">{e.progress}%</span>
                        <button
                          type="button"
                          disabled={dropping === e.id}
                          onClick={() => onDrop(e)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          <UserMinus className="h-3.5 w-3.5" /> Drop
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <SectionLabel>Payments</SectionLabel>
              {!payments.length ? (
                <p className="text-sm text-[#9aa7b5]">No payments on record.</p>
              ) : (
                <ul className="divide-y divide-[#eef2f7] border border-[#e4ebf2] bg-white">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-[#0b1220]">{p.classTitle || 'Deleted class'}</p>
                        <p className="text-xs text-[#7a8898]">{fmtDate(p.createdAt)}</p>
                      </div>
                      <span className="font-medium">{money(p.amount, p.currency)}</span>
                      <Pill tone={statusToneOf(p.status)}>{p.status}</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>
      <EmailModal recipient={emailing} onClose={() => setEmailing(null)} />
    </>
  );
}
