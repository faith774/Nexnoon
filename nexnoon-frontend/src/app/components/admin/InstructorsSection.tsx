import { useState } from 'react';
import { AlertCircle, Mail, Settings2, UserCheck, UserPlus } from 'lucide-react';
import { applicationProgress } from '@/lib/instructor-application';
import { useAdmin } from './context';
import { InstructorDrawer, STAGE_LABEL, STAGE_TONE, stageOf } from './InstructorOps';
import { CreateAccountModal, EmailModal } from './modals';
import type { Account, LifecycleStage } from './types';
import { Avatar, EmptyBlock, ExportButton, FilterChips, Pagination, Panel, Pill, btn, daysAgo, fmtDate, matches, usePagination } from './ui';

type Filter = 'pipeline' | 'teaching' | 'attention' | 'inactive' | 'all';

const GROUP: Record<LifecycleStage, Exclude<Filter, 'all'>> = {
  applied: 'pipeline',
  review: 'pipeline',
  interview: 'pipeline',
  training: 'pipeline',
  certified: 'teaching',
  active: 'teaching',
  improvement: 'attention',
  suspended: 'attention',
  removed: 'inactive',
  rejected: 'inactive',
};

const STAGE_ORDER: LifecycleStage[] = ['applied', 'review', 'interview', 'training', 'certified', 'improvement', 'active', 'suspended', 'removed', 'rejected'];

const FILTER_LABEL: Record<Filter, string> = {
  pipeline: 'Pipeline',
  teaching: 'Teaching',
  attention: 'Needs attention',
  inactive: 'Removed / rejected',
  all: 'All',
};

export default function InstructorsSection() {
  const { data, search, intent } = useAdmin();
  const initial: Filter = intent.instructorFilter === 'approved' ? 'teaching' : intent.instructorFilter === 'suspended' ? 'attention' : intent.instructorFilter === 'rejected' ? 'inactive' : intent.instructorFilter === 'all' ? 'all' : 'pipeline';
  const [filter, setFilter] = useState<Filter>(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [emailing, setEmailing] = useState<Account | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const instructors = (data.users || []).filter((u) => u.role === 'instructor');
  const coursesById = new Map((data.courses || []).map((c) => [c.id, c]));
  const reviewOverdue = (u: Account) => !!u.lifecycle?.reviewDueAt && new Date(u.lifecycle.reviewDueAt).getTime() < Date.now();
  const inFilter = (u: Account, f: Filter) => f === 'all' || GROUP[stageOf(u)] === f || (f === 'attention' && GROUP[stageOf(u)] === 'teaching' && reviewOverdue(u));
  const count = (f: Filter) => instructors.filter((u) => inFilter(u, f)).length;
  const rows = instructors
    .filter((u) => inFilter(u, filter))
    .filter((u) => matches(search, u.fullName, u.email, u.headline))
    .sort((a, b) => STAGE_ORDER.indexOf(stageOf(a)) - STAGE_ORDER.indexOf(stageOf(b)));
  const pager = usePagination(rows, 10, `${filter}|${search}`);

  const certLabel = (u: Account) =>
    (u.certifications || [])
      .filter((c) => c.status === 'active')
      .map((c) => {
        const course = coursesById.get(c.courseId);
        const lang = c.languageOfferingId ? course?.languageOfferings?.find((o) => o.id === c.languageOfferingId)?.label : 'all languages';
        return `${course?.title || 'Course'} (${lang || 'language'})`;
      });

  return (
    <div className="space-y-5">
      <Panel
        title="Instructors"
        subtitle="Apply → review → interview → training → certification → teaching, with renewals and improvement plans."
        icon={<UserCheck className="h-4 w-4" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportButton
              filename="instructors"
              rows={() =>
                rows.map((u) => ({
                  name: u.fullName,
                  email: u.email,
                  stage: STAGE_LABEL[stageOf(u)],
                  status: u.instructorStatus || '',
                  certifications: certLabel(u).join('; '),
                  next_review: u.lifecycle?.reviewDueAt ? fmtDate(u.lifecycle.reviewDueAt) : '',
                  joined: u.createdAt ? fmtDate(u.createdAt) : '',
                }))
              }
            />
            <button type="button" className={btn.secondary} onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add instructor
            </button>
          </div>
        }
        bodyClassName=""
      >
        <div className="border-b border-[#e4ebf2] px-5 py-3 md:px-6">
          <FilterChips
            label="Lifecycle"
            value={filter}
            onChange={setFilter}
            options={(['pipeline', 'teaching', 'attention', 'inactive', 'all'] as const).map((id) => ({ id, label: FILTER_LABEL[id], count: count(id) }))}
          />
        </div>

        {!instructors.length ? (
          <div className="p-5 md:p-6">
            <EmptyBlock text="No instructor accounts yet. When someone signs up to teach, they appear here as applied." />
          </div>
        ) : !rows.length ? (
          <div className="p-5 md:p-6">
            <EmptyBlock text={filter === 'pipeline' ? 'Pipeline is clear — no open applications.' : 'No instructors in this filter.'} />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-[#e4ebf2]">
              {pager.pageItems.map((u) => {
                const stage = stageOf(u);
                const app = applicationProgress(u);
                const certs = certLabel(u);
                const lc = u.lifecycle;
                return (
                  <li key={u.id} className={GROUP[stage] === 'pipeline' ? 'bg-gradient-to-r from-amber-50/60 to-transparent' : ''}>
                    <div className="flex flex-wrap items-center gap-4 px-5 py-4 md:px-6">
                      <Avatar name={u.fullName} src={u.avatar} size={44} tone={STAGE_TONE[stage]} />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-[#0b1220]">
                          {u.fullName}
                          <Pill tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Pill>
                          {reviewOverdue(u) ? <Pill tone="rose">review overdue</Pill> : null}
                        </p>
                        <p className="truncate text-sm text-[#5c6b7a]">
                          {u.headline || u.email}
                          {u.createdAt ? <span className="text-[#9aa7b5]"> · joined {daysAgo(u.createdAt)}</span> : null}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[#5c6b7a]">
                          {GROUP[stage] === 'pipeline' ? (
                            <>
                              <Pill tone={app.ready ? 'green' : app.requiredDone >= app.requiredTotal / 2 ? 'amber' : 'rose'}>
                                Profile {app.requiredDone}/{app.requiredTotal}
                                {u.sampleVideoUrl ? ' · video' : ''}
                              </Pill>
                              {lc?.interview?.scheduledAt && !lc.interview.result ? <span>Interview {fmtDate(lc.interview.scheduledAt)}</span> : null}
                              {lc?.interview?.result === 'pass' ? <span>Interview passed</span> : null}
                              {lc?.trainingCompletedAt ? <span>· Trained</span> : null}
                            </>
                          ) : certs.length ? (
                            <span className="truncate" title={certs.join('\n')}>
                              Certified: {certs.slice(0, 2).join(', ')}
                              {certs.length > 2 ? ` +${certs.length - 2}` : ''}
                            </span>
                          ) : GROUP[stage] === 'teaching' ? (
                            <Pill tone="amber">No course certifications yet</Pill>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={btn.secondary} onClick={() => setEmailing(u)}>
                          <Mail className="h-3.5 w-3.5" /> Email
                        </button>
                        <button type="button" className={btn.primary} onClick={() => setOpenId(u.id)}>
                          <Settings2 className="h-3.5 w-3.5" /> Manage
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pagination {...pager} noun="instructors" />
          </>
        )}
      </Panel>

      <p className="flex items-start gap-1.5 text-xs text-[#7a8898]">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Only certified instructors can teach, and only the course × language pairs you grant them. Removing an instructor revokes all certifications.
      </p>

      <InstructorDrawer userId={openId} onClose={() => setOpenId(null)} />
      <EmailModal recipient={emailing} onClose={() => setEmailing(null)} />
      <CreateAccountModal open={addOpen} onClose={() => setAddOpen(false)} defaultRole="instructor" />
    </div>
  );
}
