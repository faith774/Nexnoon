import { useMemo, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Check,
  Eye,
  Languages,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import apiClient from '@/lib/api/client';
import { publicSiteHref } from '@/lib/portal';
import { useAdmin, useAdminAction } from './context';
import type { Course } from './types';
import {
  Avatar,
  DetailGrid,
  Drawer,
  EmptyBlock,
  Field,
  FilterChips,
  Modal,
  Pagination,
  Panel,
  Pill,
  ProgressBar,
  SectionLabel,
  StatTile,
  btn,
  fmtDate,
  inputCls,
  matches,
  statusToneOf,
  usePagination,
  useSticky,
} from './ui';

type StatusFilter = 'all' | 'published' | 'draft' | 'archived';

export default function CoursesSection() {
  const { data, search, intent } = useAdmin();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [viewId, setViewId] = useState<string | null>(intent.openCourseId ?? null);
  const [form, setForm] = useState<{ open: boolean; course: Course | null }>({ open: false, course: null });

  const courses = data.courses || [];
  const classesByCourse = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of data.classes) if (c.courseId) map.set(c.courseId, (map.get(c.courseId) || 0) + 1);
    return map;
  }, [data.classes]);
  const certifiedByCourse = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of data.users || []) {
      if (u.role !== 'instructor' || u.instructorStatus !== 'approved') continue;
      for (const id of u.approvedCourseIds || []) map.set(id, (map.get(id) || 0) + 1);
    }
    return map;
  }, [data.users]);

  const counts = {
    all: courses.length,
    published: courses.filter((c) => c.status === 'published').length,
    draft: courses.filter((c) => c.status === 'draft').length,
    archived: courses.filter((c) => c.status === 'archived').length,
  };

  const rows = courses
    .filter((c) => status === 'all' || c.status === status)
    .filter((c) => matches(search, c.title, c.category, c.slug))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const pager = usePagination(rows, 10, `${status}|${search}`);
  const viewing = courses.find((c) => c.id === viewId) || null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Courses" value={counts.all} hint="Official catalog templates" />
        <StatTile label="Published" value={counts.published} hint="Visible to learners" tone={counts.published ? 'good' : undefined} />
        <StatTile label="Drafts" value={counts.draft} hint="Not yet public" tone={counts.draft ? 'warn' : undefined} />
        <StatTile label="Classes delivering" value={[...classesByCourse.values()].reduce((s, n) => s + n, 0)} hint="Linked to a course" />
      </div>

      <Panel
        title="Course catalog"
        subtitle="Templates instructors teach against. Open a course to see everything about it."
        icon={<BookOpen className="h-4 w-4" />}
        actions={
          <button type="button" className={btn.primary} onClick={() => setForm({ open: true, course: null })}>
            <Plus className="h-4 w-4" />
            New course
          </button>
        }
        bodyClassName=""
      >
        <div className="border-b border-[#e4ebf2] px-5 py-3 md:px-6">
          <FilterChips
            label="Course status"
            value={status}
            onChange={setStatus}
            options={[
              { id: 'all', label: 'All', count: counts.all },
              { id: 'published', label: 'Published', count: counts.published },
              { id: 'draft', label: 'Draft', count: counts.draft },
              { id: 'archived', label: 'Archived', count: counts.archived },
            ]}
          />
        </div>

        {!rows.length ? (
          <div className="p-5 md:p-6">
            <EmptyBlock
              text={courses.length ? 'No courses match this filter.' : 'No courses yet. Create the first official course.'}
              action={
                !courses.length ? (
                  <button type="button" className={btn.primary} onClick={() => setForm({ open: true, course: null })}>
                    <Plus className="h-4 w-4" /> New course
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e4ebf2] bg-[#f7f9fc] text-[11px] uppercase tracking-wider text-[#6a7a8c]">
                    <th className="px-5 py-2.5 font-medium md:px-6">Course</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Languages</th>
                    <th className="px-3 py-2.5 font-medium">Classes</th>
                    <th className="px-3 py-2.5 font-medium">Certified tutors</th>
                    <th className="px-3 py-2.5 font-medium">Updated</th>
                    <th className="px-5 py-2.5 md:px-6" />
                  </tr>
                </thead>
                <tbody>
                  {pager.pageItems.map((c) => {
                    const langs = (c.languageOfferings || []).filter((o) => o.status !== 'inactive');
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setViewId(c.id)}
                        className="cursor-pointer border-b border-[#eef2f7] last:border-0 transition-colors hover:bg-[#f7f9fc]"
                      >
                        <td className="px-5 py-3.5 md:px-6">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-gradient-to-br from-[#1a2438] to-[#3a5f8a] font-display text-sm text-white">
                              {c.title.slice(0, 1).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-[#0b1220]">{c.title}</p>
                              <p className="truncate text-xs text-[#7a8898]">
                                {c.category || 'Uncategorised'} · /{c.slug}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <Pill tone={statusToneOf(c.status)}>{c.status}</Pill>
                        </td>
                        <td className="px-3 py-3.5">
                          {langs.length ? (
                            <div className="flex flex-wrap gap-1">
                              {langs.slice(0, 3).map((o) => (
                                <span key={o.id} className="bg-[#eef2f7] px-1.5 py-0.5 text-[11px] text-[#3d4a5c]">
                                  {o.label}
                                </span>
                              ))}
                              {langs.length > 3 ? <span className="text-[11px] text-[#7a8898]">+{langs.length - 3}</span> : null}
                            </div>
                          ) : (
                            <span className="text-xs text-[#9aa7b5]">None yet</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 tabular-nums">{classesByCourse.get(c.id) || 0}</td>
                        <td className="px-3 py-3.5 tabular-nums">{certifiedByCourse.get(c.id) || 0}</td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-[#5c6b7a]">{fmtDate(c.updatedAt)}</td>
                        <td className="px-5 py-3.5 text-right md:px-6">
                          <span className={btn.link}>
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination {...pager} noun="courses" />
          </>
        )}
      </Panel>

      <CourseDrawer
        course={viewing}
        onClose={() => setViewId(null)}
        onEdit={(course) => setForm({ open: true, course })}
      />
      <CourseFormModal
        open={form.open}
        course={form.course ? courses.find((c) => c.id === form.course!.id) || form.course : null}
        onClose={() => setForm({ open: false, course: null })}
        onCreated={(id) => setViewId(id)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Details drawer                                                      */
/* ------------------------------------------------------------------ */

function CourseDrawer({
  course: openCourse,
  onClose,
  onEdit,
}: {
  course: Course | null;
  onClose: () => void;
  onEdit: (course: Course) => void;
}) {
  const course = useSticky(openCourse);
  const { data, goTo } = useAdmin();
  const run = useAdminAction();
  const [busy, setBusy] = useState(false);

  const classes = course ? data.classes.filter((c) => c.courseId === course.id) : [];
  const classOps = new Map((data.classOps || []).map((c) => [c.id, c]));
  const instructors = (data.users || []).filter((u) => u.role === 'instructor');
  const certified = course
    ? instructors.filter((u) => u.instructorStatus === 'approved' && (u.approvedCourseIds || []).includes(course.id))
    : [];
  const requesting = course
    ? instructors.filter(
        (u) => (u.requestedCourseIds || []).includes(course.id) && !(u.approvedCourseIds || []).includes(course.id)
      )
    : [];

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    await run(fn);
    setBusy(false);
  }

  return (
    <Drawer
      open={!!openCourse}
      onClose={onClose}
      eyebrow="Course"
      title={course?.title}
      subtitle={
        course ? (
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={statusToneOf(course.status)}>{course.status}</Pill>
            <span>{course.category || 'Uncategorised'}</span>
            <span className="text-[#9aa7b5]">/{course.slug}</span>
          </span>
        ) : null
      }
      footer={
        course ? (
          <>
            {course.status === 'published' ? (
              <a href={publicSiteHref(`/courses/${course.slug}`)} target="_blank" rel="noreferrer" className={`${btn.link} mr-auto`}>
                Public page <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span className="mr-auto" />
            )}
            {course.status !== 'archived' && (
              <button
                type="button"
                disabled={busy}
                className={btn.danger}
                onClick={() => {
                  if (!window.confirm('Archive this course? It will leave the public catalog.')) return;
                  void act(() => apiClient.post(`/courses/${course.id}/archive`));
                }}
              >
                <Archive className="h-3.5 w-3.5" /> Archive
              </button>
            )}
            {course.status !== 'published' && (
              <button
                type="button"
                disabled={busy}
                className={btn.secondary}
                onClick={() => void act(() => apiClient.patch(`/courses/${course.id}`, { status: 'published' }))}
              >
                <Check className="h-3.5 w-3.5" /> Publish
              </button>
            )}
            <button type="button" className={btn.primary} onClick={() => onEdit(course)}>
              <Pencil className="h-3.5 w-3.5" /> Edit course
            </button>
          </>
        ) : null
      }
    >
      {course ? (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Classes" value={classes.length} />
            <StatTile label="Certified tutors" value={certified.length} />
            <StatTile label="Languages" value={(course.languageOfferings || []).filter((o) => o.status !== 'inactive').length} />
          </div>

          <Panel bodyClassName="p-5">
            <SectionLabel>About</SectionLabel>
            <p className="whitespace-pre-line text-sm leading-relaxed text-[#0b1220]">{course.description}</p>
            <div className="mt-5 border-t border-[#e4ebf2] pt-4">
              <DetailGrid
                items={[
                  { label: 'Created', value: fmtDate(course.createdAt) },
                  { label: 'Last updated', value: fmtDate(course.updatedAt) },
                  {
                    label: 'Official preview',
                    value: course.officialPreviewUrl ? (
                      <a href={course.officialPreviewUrl} target="_blank" rel="noreferrer" className="text-[#3a5f8a] hover:underline">
                        Open preview
                      </a>
                    ) : (
                      <span className="text-[#9aa7b5]">Not set</span>
                    ),
                  },
                  {
                    label: 'Certificate',
                    value: course.certificateNotes || <span className="text-[#9aa7b5]">No notes</span>,
                  },
                ]}
              />
            </div>
          </Panel>

          <Panel bodyClassName="p-5">
            <SectionLabel>Learning outcomes</SectionLabel>
            {course.outcomes?.length ? (
              <ul className="space-y-2">
                {course.outcomes.map((o, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-[#0b1220]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {o}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#9aa7b5]">No outcomes listed.</p>
            )}
          </Panel>

          <Panel bodyClassName="p-5">
            <SectionLabel>Curriculum template</SectionLabel>
            {course.curriculumTemplate?.length ? (
              <ol className="space-y-2">
                {course.curriculumTemplate.map((m, i) => (
                  <li key={m.id} className="flex gap-3 border border-[#e4ebf2] bg-[#fbfcfe] px-3.5 py-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-[#0b1220] text-[11px] font-semibold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0b1220]">{m.title}</p>
                      {m.description ? <p className="mt-0.5 text-xs leading-relaxed text-[#5c6b7a]">{m.description}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-[#9aa7b5]">No modules yet. Add them from Edit course.</p>
            )}
          </Panel>

          <Panel bodyClassName="p-5">
            <SectionLabel>
              <span className="inline-flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5" /> Language offerings
              </span>
            </SectionLabel>
            {(course.languageOfferings || []).length ? (
              <div className="flex flex-wrap gap-1.5">
                {(course.languageOfferings || []).map((o) => (
                  <span
                    key={o.id}
                    className={`border px-2.5 py-1 text-xs ${
                      o.status === 'active' ? 'border-[#0b1220] bg-[#0b1220] text-white' : 'border-[#d0dae6] text-[#7a8898] line-through'
                    }`}
                  >
                    {o.label} ({o.code})
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#9aa7b5]">No languages yet. Learners can’t pick this course until one is added.</p>
            )}
          </Panel>

          <Panel bodyClassName="p-5">
            <SectionLabel>Classes delivering this course</SectionLabel>
            {classes.length ? (
              <ul className="divide-y divide-[#eef2f7]">
                {classes.map((c) => {
                  const op = classOps.get(c.id);
                  const fill = op?.fillRate ?? 0;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => goTo('classes', { openClassId: c.id })}
                        className="flex w-full items-center gap-3 py-3 text-left hover:bg-[#f7f9fc]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#0b1220]">{c.title}</p>
                          <p className="text-xs text-[#7a8898]">
                            {c.instructor?.name || 'No instructor'} · {c.language || 'Any language'} · {c.enrolledStudents}/
                            {op?.maxStudents ?? c.maxStudents ?? '—'} seats
                          </p>
                          <ProgressBar value={fill} className="mt-1.5 max-w-[220px]" />
                        </div>
                        <Pill tone={statusToneOf(c.status)}>{c.status}</Pill>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-[#9aa7b5]">No classes are linked to this course yet.</p>
            )}
          </Panel>

          <Panel bodyClassName="p-5">
            <SectionLabel>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Tutors
              </span>
            </SectionLabel>
            {certified.length || requesting.length ? (
              <ul className="space-y-2.5">
                {certified.map((u) => (
                  <li key={u.id} className="flex items-center gap-3">
                    <Avatar name={u.fullName} src={u.avatar} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[#0b1220]">{u.fullName}</p>
                      <p className="truncate text-xs text-[#7a8898]">{u.email}</p>
                    </div>
                    <Pill tone="green">Certified</Pill>
                  </li>
                ))}
                {requesting.map((u) => (
                  <li key={u.id} className="flex items-center gap-3">
                    <Avatar name={u.fullName} src={u.avatar} size={32} tone="amber" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[#0b1220]">{u.fullName}</p>
                      <p className="truncate text-xs text-[#7a8898]">{u.email}</p>
                    </div>
                    <button type="button" className={btn.link} onClick={() => goTo('instructors', { instructorFilter: 'all' })}>
                      Wants to teach · review
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#9aa7b5]">No tutors are certified for this course yet.</p>
            )}
          </Panel>
        </div>
      ) : null}
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
/* Create / edit modal                                                 */
/* ------------------------------------------------------------------ */

type Module = { id: string; title: string; description: string };
type FormState = {
  title: string;
  description: string;
  category: string;
  status: 'draft' | 'published';
  outcomes: string[];
  modules: Module[];
  officialPreviewUrl: string;
  certificateNotes: string;
  languages: { code: string; label: string }[];
  minPrice: string;
  maxPrice: string;
};

const newId = () => Math.random().toString(36).slice(2, 10);

function formFrom(course: Course | null): FormState {
  return {
    title: course?.title || '',
    description: course?.description || '',
    category: course?.category || '',
    status: course?.status === 'published' ? 'published' : 'draft',
    outcomes: course?.outcomes?.length ? [...course.outcomes] : [''],
    modules: (course?.curriculumTemplate || []).map((m) => ({ id: m.id, title: m.title, description: m.description || '' })),
    officialPreviewUrl: course?.officialPreviewUrl || '',
    certificateNotes: course?.certificateNotes || '',
    languages: [],
    minPrice: course?.pricing?.minPrice != null ? String(course.pricing.minPrice) : '',
    maxPrice: course?.pricing?.maxPrice != null ? String(course.pricing.maxPrice) : '',
  };
}

const priceOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

function CourseFormModal({
  open,
  course,
  onClose,
  onCreated,
}: {
  open: boolean;
  course: Course | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { flash } = useAdmin();
  const run = useAdminAction();
  const [form, setForm] = useState<FormState>(() => formFrom(course));
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [langDraft, setLangDraft] = useState({ code: '', label: '' });
  const [busy, setBusy] = useState(false);

  const key = open ? course?.id || 'new' : null;
  if (key !== openKey) {
    setOpenKey(key);
    if (key) {
      setForm(formFrom(course));
      setLangDraft({ code: '', label: '' });
    }
  }

  const editing = !!course;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  function moveModule(index: number, dir: -1 | 1) {
    const next = [...form.modules];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    set('modules', next);
  }

  async function addLanguage() {
    const code = langDraft.code.trim().toLowerCase();
    const label = langDraft.label.trim();
    if (!/^[a-z]{2,3}(-[a-z0-9]+)?$/.test(code) || label.length < 2) {
      flash({ type: 'err', text: 'Language needs a code like “en” or “pt-br” and a label like “English”.' });
      return;
    }
    if (editing) {
      setBusy(true);
      await run(() => apiClient.post(`/courses/${course!.id}/languages`, { code, label, status: 'active' }));
      setBusy(false);
    } else {
      if (form.languages.some((l) => l.code === code)) return;
      set('languages', [...form.languages, { code, label }]);
    }
    setLangDraft({ code: '', label: '' });
  }

  async function submit() {
    if (form.title.trim().length < 3) return flash({ type: 'err', text: 'Title must be at least 3 characters.' });
    if (form.description.trim().length < 10)
      return flash({ type: 'err', text: 'Description must be at least 10 characters.' });
    const minPrice = priceOrNull(form.minPrice);
    const maxPrice = priceOrNull(form.maxPrice);
    if ([minPrice, maxPrice].some((p) => p !== null && (!Number.isFinite(p) || p < 0)))
      return flash({ type: 'err', text: 'Prices must be zero or more.' });
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice)
      return flash({ type: 'err', text: 'Minimum price can’t be above the maximum.' });
    const modules = form.modules.filter((m) => m.title.trim());
    const payload = {
      pricing: { minPrice, maxPrice },
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim() || undefined,
      status: form.status,
      outcomes: form.outcomes.map((o) => o.trim()).filter(Boolean),
      curriculumTemplate: modules.map((m) => ({
        id: m.id,
        title: m.title.trim(),
        ...(m.description.trim() ? { description: m.description.trim() } : {}),
      })),
      officialPreviewUrl: form.officialPreviewUrl.trim(),
      certificateNotes: form.certificateNotes.trim(),
      ...(!editing && form.languages.length ? { languageOfferings: form.languages } : {}),
    };
    setBusy(true);
    const res = await run(() =>
      editing ? apiClient.patch(`/courses/${course!.id}`, payload) : apiClient.post('/courses', payload)
    );
    setBusy(false);
    if (res) {
      onClose();
      const id = (res as { data?: { data?: { id?: string } } }).data?.data?.id;
      if (!editing && id) onCreated(id);
    }
  }

  const offerings = course?.languageOfferings || [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      eyebrow={editing ? 'Edit course' : 'New course'}
      title={editing ? course!.title : 'Create an official course'}
      subtitle="Courses are templates. Instructors run classes against them in one or more languages."
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btn.primary} disabled={busy} onClick={() => void submit()}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Create course'}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title" className="md:col-span-2">
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Product Design Foundations"
              autoFocus
            />
          </Field>
          <Field label="Description" className="md:col-span-2" hint={`${form.description.trim().length} characters`}>
            <textarea
              rows={4}
              className={`${inputCls} resize-y`}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What learners will master, who it’s for, how it runs…"
            />
          </Field>
          <Field label="Category">
            <input className={inputCls} value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Design" />
          </Field>
          <Field label="Visibility">
            <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value as FormState['status'])}>
              <option value="draft">Draft · hidden from learners</option>
              <option value="published">Published · in the catalog</option>
            </select>
          </Field>
          <Field label="Minimum class price (USD)" hint="Leave blank for no floor">
            <input type="number" min={0} step="0.01" className={inputCls} value={form.minPrice} onChange={(e) => set('minPrice', e.target.value)} placeholder="e.g. 49" />
          </Field>
          <Field label="Maximum class price (USD)" hint="Instructors set prices inside this range. Free always needs your approval.">
            <input type="number" min={0} step="0.01" className={inputCls} value={form.maxPrice} onChange={(e) => set('maxPrice', e.target.value)} placeholder="e.g. 299" />
          </Field>
        </div>

        <div>
          <SectionLabel
            aside={
              <button type="button" className={btn.link} onClick={() => set('outcomes', [...form.outcomes, ''])}>
                <Plus className="h-3.5 w-3.5" /> Add outcome
              </button>
            }
          >
            Learning outcomes
          </SectionLabel>
          <div className="space-y-2">
            {form.outcomes.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={inputCls}
                  value={o}
                  placeholder={i === 0 ? 'e.g. Ship a portfolio-ready case study' : 'Another outcome'}
                  onChange={(e) => set('outcomes', form.outcomes.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <button
                  type="button"
                  aria-label="Remove outcome"
                  className="flex w-10 shrink-0 items-center justify-center border border-[#d0dae6] text-[#7a8898] hover:border-rose-300 hover:text-rose-700"
                  onClick={() => set('outcomes', form.outcomes.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel
            aside={
              <button
                type="button"
                className={btn.link}
                onClick={() => set('modules', [...form.modules, { id: newId(), title: '', description: '' }])}
              >
                <Plus className="h-3.5 w-3.5" /> Add module
              </button>
            }
          >
            Curriculum template
          </SectionLabel>
          {!form.modules.length ? (
            <p className="border border-dashed border-[#d0dae6] px-4 py-5 text-center text-sm text-[#7a8898]">
              No modules yet. Modules give every class of this course the same backbone.
            </p>
          ) : (
            <ol className="space-y-2.5">
              {form.modules.map((m, i) => (
                <li key={m.id} className="flex gap-3 border border-[#e4ebf2] bg-[#fbfcfe] p-3">
                  <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center bg-[#0b1220] text-[11px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      className={inputCls}
                      value={m.title}
                      placeholder="Module title"
                      onChange={(e) => set('modules', form.modules.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))}
                    />
                    <input
                      className={inputCls}
                      value={m.description}
                      placeholder="Short description (optional)"
                      onChange={(e) =>
                        set('modules', form.modules.map((x) => (x.id === m.id ? { ...x, description: e.target.value } : x)))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => moveModule(i, -1)} className="p-1.5 text-[#7a8898] hover:text-[#0b1220] disabled:opacity-30">
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={i === form.modules.length - 1}
                      onClick={() => moveModule(i, 1)}
                      className="p-1.5 text-[#7a8898] hover:text-[#0b1220] disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove module"
                      onClick={() => set('modules', form.modules.filter((x) => x.id !== m.id))}
                      className="p-1.5 text-[#7a8898] hover:text-rose-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div>
          <SectionLabel>Language offerings</SectionLabel>
          <p className="mb-2.5 text-xs text-[#6a7a8c]">
            {editing
              ? 'Changes here save immediately. Click a language to switch it on or off.'
              : 'Languages learners can pick on the public course page.'}
          </p>
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {editing
              ? offerings.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      await run(
                        () =>
                          apiClient.patch(`/courses/${course!.id}/languages/${o.id}`, {
                            status: o.status === 'active' ? 'inactive' : 'active',
                          }),
                        { success: `${o.label} ${o.status === 'active' ? 'turned off' : 'turned on'}` }
                      );
                      setBusy(false);
                    }}
                    className={`border px-2.5 py-1 text-xs transition ${
                      o.status === 'active'
                        ? 'border-[#0b1220] bg-[#0b1220] text-white'
                        : 'border-[#d0dae6] bg-white text-[#7a8898] line-through'
                    }`}
                  >
                    {o.label} ({o.code})
                  </button>
                ))
              : form.languages.map((l) => (
                  <span key={l.code} className="inline-flex items-center gap-1.5 border border-[#0b1220] bg-[#0b1220] px-2.5 py-1 text-xs text-white">
                    {l.label} ({l.code})
                    <button
                      type="button"
                      aria-label={`Remove ${l.label}`}
                      onClick={() => set('languages', form.languages.filter((x) => x.code !== l.code))}
                      className="text-white/70 hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
            <input
              className={inputCls}
              placeholder="Code (en)"
              value={langDraft.code}
              onChange={(e) => setLangDraft({ ...langDraft, code: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="Label (English)"
              value={langDraft.label}
              onChange={(e) => setLangDraft({ ...langDraft, label: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void addLanguage();
                }
              }}
            />
            <button type="button" disabled={busy} className={btn.secondary} onClick={() => void addLanguage()}>
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Official preview URL">
            <input
              type="url"
              className={inputCls}
              value={form.officialPreviewUrl}
              onChange={(e) => set('officialPreviewUrl', e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field label="Certificate notes">
            <input
              className={inputCls}
              value={form.certificateNotes}
              onChange={(e) => set('certificateNotes', e.target.value)}
              placeholder="What learners earn on completion"
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
