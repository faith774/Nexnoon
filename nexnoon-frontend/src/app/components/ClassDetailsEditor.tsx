import { useEffect, useId, useRef, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Film,
  HelpCircle,
  Layers,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { ClassDetails, ClassSchedule } from '@/types/api';
import { uploadFile, getErrorMessage } from '@/lib/api';
import { AddSessionPanel, SessionScheduleRow } from '@/app/components/SessionScheduleEditor';
import { browserTimeZone } from '@/lib/timezone';
import TeachingTeamPanel, { type PendingInvite } from '@/app/components/TeachingTeamPanel';
import type { Class } from '@/types/api';

const fieldLabel = 'block text-xs uppercase tracking-[0.14em] text-[#6b655c] mb-1.5';
const fieldControl =
  'w-full border border-[#e4dfd6] bg-white px-3 py-2.5 text-sm text-[#14110e] outline-none focus:border-[#14110e] placeholder:text-[#a39c92]';
const fieldArea = `${fieldControl} resize-y min-h-[88px]`;

function newModuleId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `mod_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isDirectVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url) || /res\.cloudinary\.com\/.+\.(mp4|webm|mov)/i.test(url);
}

function isEmbeddableVideoUrl(url: string) {
  return /youtube\.com|youtu\.be|vimeo\.com/i.test(url) || isDirectVideoUrl(url) || /^https:\/\//i.test(url);
}

export default function ClassDetailsEditor({
  value,
  onChange,
  classId,
  classData,
  sessions = [],
  defaultDurationMinutes = 60,
  onPreviewVideoFileChange,
  pendingInvites,
  onPendingInvitesChange,
  onClassUpdated,
  timeZone,
}: {
  value: ClassDetails;
  onChange: (value: ClassDetails) => void;
  /** When set, video files upload immediately to this class. */
  classId?: string;
  /** Existing class — used for teaching team management. */
  classData?: Class | null;
  /** Live sessions for this class — nested under matching modules via moduleId. */
  sessions?: ClassSchedule[];
  defaultDurationMinutes?: number;
  /** Used on create-class before an id exists — parent uploads after create. */
  onPreviewVideoFileChange?: (file: File | null) => void;
  pendingInvites?: PendingInvite[];
  onPendingInvitesChange?: (invites: PendingInvite[]) => void;
  onClassUpdated?: (cls: Class) => void;
  /** Class time zone sessions are scheduled in. */
  timeZone?: string;
}) {
  const id = useId();
  const zone = timeZone || classData?.timezone || browserTimeZone();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [localFileName, setLocalFileName] = useState('');
  const [openModule, setOpenModule] = useState<number | null>(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Ensure every module has a stable id (needed to attach live sessions).
  useEffect(() => {
    const curriculum = value.curriculum || [];
    if (!curriculum.length || curriculum.every((m) => m.id)) return;
    onChange({
      ...value,
      curriculum: curriculum.map((m) => ({ ...m, id: m.id || newModuleId() })),
    });
    // Only run when curriculum ids are missing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.curriculum]);

  const setPreviewUrl = (url: string) => onChange({ ...value, previewVideoUrl: url });

  const handleVideoFile = async (file: File | null) => {
    setUploadError('');
    if (!file) {
      setLocalFileName('');
      onPreviewVideoFileChange?.(null);
      return;
    }
    if (!file.type.startsWith('video/')) {
      setUploadError('Please choose a video file (MP4 or MOV).');
      return;
    }
    if (file.size > 80 * 1024 * 1024) {
      setUploadError('Video must be 80MB or smaller.');
      return;
    }

    setLocalFileName(file.name);

    if (!classId) {
      onPreviewVideoFileChange?.(file);
      return;
    }

    setUploading(true);
    try {
      const result = await uploadFile(`/classes/${classId}/uploads`, file);
      setPreviewUrl(result.url);
      onPreviewVideoFileChange?.(null);
    } catch (err) {
      setUploadError(getErrorMessage(err));
      setLocalFileName('');
    } finally {
      setUploading(false);
    }
  };

  const clearPreview = () => {
    setPreviewUrl('');
    setLocalFileName('');
    onPreviewVideoFileChange?.(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const modules = value.curriculum || [];
  const faqs = value.faqs || [];

  const moveModule = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= modules.length) return;
    const copy = [...modules];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    onChange({ ...value, curriculum: copy });
    setOpenModule(next);
  };

  const addModule = () => {
    const nextIndex = modules.length;
    onChange({
      ...value,
      curriculum: [...modules, { id: newModuleId(), title: '', topics: [''], project: '' }],
    });
    setOpenModule(nextIndex);
  };

  const moduleOptions = modules
    .filter((m) => m.id)
    .map((m) => ({ id: m.id!, title: m.title || 'Untitled module' }));

  const sessionsForModule = (moduleId?: string) =>
    (sessions || [])
      .filter((s) => moduleId && s.moduleId === moduleId)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const knownModuleIds = new Set(moduleOptions.map((m) => m.id));
  const unassignedSessions = (sessions || [])
    .filter((s) => !s.moduleId || !knownModuleIds.has(s.moduleId))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const addFaq = () => {
    const nextIndex = faqs.length;
    onChange({ ...value, faqs: [...faqs, { question: '', answer: '' }] });
    setOpenFaq(nextIndex);
  };

  return (
    <section className="space-y-10">
      <header>
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c]">Public page</p>
        <h2 className="font-serif text-2xl text-[#14110e] mt-1">Full class details</h2>
        <p className="text-sm text-[#6b655c] mt-1.5 max-w-2xl leading-relaxed">
          These details appear on your public class page — overview, curriculum modules, instructor bio, and FAQs.
        </p>
      </header>

      {/* Preview video */}
      <div className="border border-[#e4dfd6] bg-[#faf8f5] p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 border border-[#e4dfd6] bg-white flex items-center justify-center flex-shrink-0">
            <Film className="h-4 w-4 text-[#14110e]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#14110e]">Class preview video</h3>
            <p className="text-xs text-[#6b655c] mt-0.5 leading-relaxed">
              Plays in the enroll card. Paste an HTTPS link (MP4, YouTube, Vimeo) or upload a file.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor={`${id}-previewVideoUrl`} className={`${fieldLabel} inline-flex items-center gap-1.5`}>
            <Link2 className="h-3.5 w-3.5" />
            Video URL
          </label>
          <input
            id={`${id}-previewVideoUrl`}
            type="url"
            value={value.previewVideoUrl || ''}
            onChange={(e) => {
              setPreviewUrl(e.target.value.trim());
              setLocalFileName('');
              onPreviewVideoFileChange?.(null);
            }}
            placeholder="https://… (MP4, YouTube, or Vimeo)"
            className={fieldControl}
          />
          {value.previewVideoUrl && !isEmbeddableVideoUrl(value.previewVideoUrl) && (
            <p className="text-xs text-amber-800 mt-1.5">Use an HTTPS link so the video can play on the class page.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => handleVideoFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 border border-[#d5cfc4] bg-white px-3.5 py-2 text-sm font-medium text-[#14110e] hover:border-[#14110e] disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Uploading…' : classId ? 'Upload video' : 'Choose video file'}
          </button>
          {(value.previewVideoUrl || localFileName) && (
            <button
              type="button"
              onClick={clearPreview}
              className="inline-flex items-center gap-1 text-sm text-red-700 hover:text-red-900"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </button>
          )}
          {localFileName && !value.previewVideoUrl && (
            <span className="text-xs text-[#6b655c] truncate max-w-[220px]">
              {localFileName} (uploads when you publish)
            </span>
          )}
        </div>
        {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

        {value.previewVideoUrl && (
          <div className="overflow-hidden border border-[#e4dfd6] bg-black aspect-video max-h-[200px]">
            {/youtube\.com|youtu\.be/i.test(value.previewVideoUrl) ? (
              <iframe
                title="Preview"
                src={toYouTubeEmbed(value.previewVideoUrl)}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : /vimeo\.com/i.test(value.previewVideoUrl) ? (
              <iframe
                title="Preview"
                src={toVimeoEmbed(value.previewVideoUrl)}
                className="w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video src={value.previewVideoUrl} controls preload="metadata" className="w-full h-full object-contain" />
            )}
          </div>
        )}
      </div>

      {/* Story fields — instructor bios live on User profiles, not here */}
      <div className="space-y-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c]">Story</p>
          <h3 className="font-serif text-lg text-[#14110e] mt-1">Class overview</h3>
        </div>
        <div className="grid gap-5">
          <Field
            id={`${id}-overview`}
            label="Class overview"
            value={value.overview || ''}
            onChange={(text) => onChange({ ...value, overview: text })}
            rows={5}
            hint="Shown as the main description on the public page."
          />

          <TeachingTeamPanel
            classId={classId}
            classData={classData}
            onClassUpdated={onClassUpdated}
            pendingInvites={pendingInvites}
            onPendingInvitesChange={onPendingInvitesChange}
          />

          <Field
            id={`${id}-curriculumIntro`}
            label="Curriculum introduction"
            value={value.curriculumIntro || ''}
            onChange={(text) => onChange({ ...value, curriculumIntro: text })}
            rows={2}
            hint="Short line under “Course structure”."
          />
          <Field
            id={`${id}-certificateInfo`}
            label="Certificate notes"
            value={value.certificateInfo || ''}
            onChange={(text) => onChange({ ...value, certificateInfo: text })}
            rows={2}
          />
          <Field
            id={`${id}-outcomes`}
            label="By the end of the class"
            value={(value.outcomes || []).join('\n')}
            onChange={(text) => onChange({ ...value, outcomes: text.split('\n') })}
            rows={4}
            hint="One outcome per line."
          />
        </div>
      </div>

      {/* Curriculum modules */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c] inline-flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Curriculum
            </p>
            <h3 className="font-serif text-lg text-[#14110e] mt-1">Modules & projects</h3>
            <p className="text-sm text-[#6b655c] mt-1">
              Each module is a learning unit. Attach zero or more live sessions inside it.
            </p>
          </div>
          <button
            type="button"
            onClick={addModule}
            className="inline-flex items-center gap-2 border border-[#14110e] bg-[#14110e] text-white px-3.5 py-2 text-sm font-medium hover:bg-[#2a241c]"
          >
            <Plus className="h-4 w-4" />
            Add module
          </button>
        </div>

        {!modules.length ? (
          <div className="border border-dashed border-[#ddd6ca] bg-[#faf8f5] px-5 py-8 text-center">
            <p className="text-sm text-[#6b655c]">No modules yet. Add your first session outline.</p>
            <button
              type="button"
              onClick={addModule}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#14110e] underline underline-offset-2"
            >
              <Plus className="h-3.5 w-3.5" />
              Add module
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {modules.map((module, index) => {
              const open = openModule === index;
              const titlePreview = module.title.trim() || `Module ${index + 1}`;
              const topicCount = module.topics.filter((t) => t.trim()).length;
              const moduleSessions = sessionsForModule(module.id);
              return (
                <div key={module.id || index} className="border border-[#e4dfd6] bg-white overflow-hidden">
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => setOpenModule(open ? null : index)}
                      className="flex-1 flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#faf8f5] transition-colors min-w-0"
                    >
                      <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center bg-[#14110e] text-[11px] font-semibold text-white">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#14110e] truncate">{titlePreview}</p>
                        <p className="text-xs text-[#6b655c] mt-0.5">
                          {topicCount} topic{topicCount === 1 ? '' : 's'}
                          {module.project.trim() ? ' · Has project' : ''}
                          {classId
                            ? ` · ${moduleSessions.length} live session${moduleSessions.length === 1 ? '' : 's'}`
                            : ''}
                        </p>
                      </div>
                      {open ? (
                        <ChevronUp className="h-4 w-4 text-[#6b655c] flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[#6b655c] flex-shrink-0" />
                      )}
                    </button>
                    <div className="flex items-center border-l border-[#e4dfd6] px-1">
                      <button
                        type="button"
                        title="Move up"
                        disabled={index === 0}
                        onClick={() => moveModule(index, -1)}
                        className="p-2 text-[#6b655c] hover:text-[#14110e] disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Move down"
                        disabled={index === modules.length - 1}
                        onClick={() => moveModule(index, 1)}
                        className="p-2 text-[#6b655c] hover:text-[#14110e] disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Remove module"
                        onClick={() => {
                          onChange({ ...value, curriculum: modules.filter((_, i) => i !== index) });
                          setOpenModule(null);
                        }}
                        className="p-2 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {open && (
                    <div className="border-t border-[#eee9e0] bg-[#faf8f5] px-4 py-5 space-y-5">
                      <div>
                        <label htmlFor={`${id}-module-${index}`} className={fieldLabel}>
                          Module title
                        </label>
                        <input
                          id={`${id}-module-${index}`}
                          value={module.title}
                          onChange={(e) =>
                            onChange({
                              ...value,
                              curriculum: modules.map((m, i) =>
                                i === index ? { ...m, title: e.target.value } : m
                              ),
                            })
                          }
                          placeholder="e.g., Greetings and pronunciation"
                          className={fieldControl}
                        />
                      </div>
                      <div>
                        <label htmlFor={`${id}-topics-${index}`} className={fieldLabel}>
                          Topics (one per line)
                        </label>
                        <textarea
                          id={`${id}-topics-${index}`}
                          value={module.topics.join('\n')}
                          onChange={(e) =>
                            onChange({
                              ...value,
                              curriculum: modules.map((m, i) =>
                                i === index ? { ...m, topics: e.target.value.split('\n') } : m
                              ),
                            })
                          }
                          rows={4}
                          placeholder={'Core ideas…\nGuided demonstration\nIndependent practice'}
                          className={fieldArea}
                        />
                      </div>
                      <div>
                        <label htmlFor={`${id}-project-${index}`} className={fieldLabel}>
                          Hands-on project
                        </label>
                        <textarea
                          id={`${id}-project-${index}`}
                          value={module.project}
                          onChange={(e) =>
                            onChange({
                              ...value,
                              curriculum: modules.map((m, i) =>
                                i === index ? { ...m, project: e.target.value } : m
                              ),
                            })
                          }
                          rows={3}
                          placeholder="What learners build or practice in this module"
                          className={fieldArea}
                        />
                      </div>

                      {/* Live sessions nested under this module */}
                      <div className="border-t border-[#e4dfd6] pt-4 space-y-3">
                        <div className="flex items-start gap-2">
                          <Calendar className="h-4 w-4 text-[#6b655c] mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-[#14110e]">Live sessions</p>
                            <p className="text-xs text-[#6b655c] mt-0.5">
                              Optional. Add 0, 1, or many Zoom meetings for this module.
                            </p>
                          </div>
                        </div>

                        {!classId ? (
                          <p className="text-xs text-[#6b655c] border border-dashed border-[#ddd6ca] bg-white px-3 py-3">
                            Save / create the class first, then return here to schedule live sessions for this module.
                          </p>
                        ) : (
                          <>
                            {moduleSessions.length === 0 && (
                              <p className="text-xs text-[#6b655c]">No live sessions yet — self-paced is fine.</p>
                            )}
                            <div className="space-y-2.5">
                              {moduleSessions.map((session) => (
                                <SessionScheduleRow
                                  key={session.id}
                                  classId={classId}
                                  session={session}
                                  modules={moduleOptions}
                                  timeZone={zone}
                                />
                              ))}
                            </div>
                            {module.id && (
                              <AddSessionPanel
                                classId={classId}
                                sessions={sessions}
                                defaultDurationMinutes={defaultDurationMinutes}
                                moduleId={module.id}
                                defaultTitle={module.title.trim() || `Session ${sessions.length + 1}`}
                                timeZone={zone}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Orphan / unassigned sessions (legacy or deleted module) */}
        {classId && unassignedSessions.length > 0 && (
          <div className="border border-amber-200 bg-amber-50/40 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-[#14110e]">Unassigned sessions</p>
              <p className="text-xs text-[#6b655c] mt-0.5">
                These live meetings aren’t linked to a module. Assign them below or leave as class-level.
              </p>
            </div>
            <div className="space-y-2.5">
              {unassignedSessions.map((session) => (
                <SessionScheduleRow
                  key={session.id}
                  classId={classId}
                  session={session}
                  modules={moduleOptions}
                  timeZone={zone}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FAQs */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c] inline-flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" />
              Support
            </p>
            <h3 className="font-serif text-lg text-[#14110e] mt-1">Frequently asked questions</h3>
            <p className="text-sm text-[#6b655c] mt-1">Common questions shown near the bottom of the class page.</p>
          </div>
          <button
            type="button"
            onClick={addFaq}
            className="inline-flex items-center gap-2 border border-[#d5cfc4] bg-white px-3.5 py-2 text-sm font-medium text-[#14110e] hover:border-[#14110e]"
          >
            <Plus className="h-4 w-4" />
            Add FAQ
          </button>
        </div>

        {!faqs.length ? (
          <div className="border border-dashed border-[#ddd6ca] px-5 py-6 text-center text-sm text-[#6b655c]">
            No FAQs yet. Add questions learners often ask before enrolling.
          </div>
        ) : (
          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const open = openFaq === index;
              const qPreview = faq.question.trim() || `Question ${index + 1}`;
              return (
                <div key={index} className="border border-[#e4dfd6] bg-white overflow-hidden">
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : index)}
                      className="flex-1 flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#faf8f5] transition-colors min-w-0"
                    >
                      <span className="text-xs font-semibold text-[#6b655c] tabular-nums w-6 flex-shrink-0">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <p className="text-sm font-medium text-[#14110e] truncate flex-1 min-w-0">{qPreview}</p>
                      {open ? (
                        <ChevronUp className="h-4 w-4 text-[#6b655c] flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[#6b655c] flex-shrink-0" />
                      )}
                    </button>
                    <button
                      type="button"
                      title="Remove FAQ"
                      onClick={() => {
                        onChange({ ...value, faqs: faqs.filter((_, i) => i !== index) });
                        setOpenFaq(null);
                      }}
                      className="border-l border-[#e4dfd6] px-3 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {open && (
                    <div className="border-t border-[#eee9e0] bg-[#faf8f5] px-4 py-5 space-y-4">
                      <div>
                        <label htmlFor={`${id}-question-${index}`} className={fieldLabel}>
                          Question
                        </label>
                        <input
                          id={`${id}-question-${index}`}
                          value={faq.question}
                          onChange={(e) =>
                            onChange({
                              ...value,
                              faqs: faqs.map((f, i) =>
                                i === index ? { ...f, question: e.target.value } : f
                              ),
                            })
                          }
                          placeholder="Who is this course for?"
                          className={fieldControl}
                        />
                      </div>
                      <div>
                        <label htmlFor={`${id}-answer-${index}`} className={fieldLabel}>
                          Answer
                        </label>
                        <textarea
                          id={`${id}-answer-${index}`}
                          value={faq.answer}
                          onChange={(e) =>
                            onChange({
                              ...value,
                              faqs: faqs.map((f, i) =>
                                i === index ? { ...f, answer: e.target.value } : f
                              ),
                            })
                          }
                          rows={3}
                          placeholder="Clear answer for prospective learners"
                          className={fieldArea}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  rows = 3,
  hint,
  input,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
  input?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      {input ? (
        <input
          id={id}
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={fieldControl}
          placeholder="https://"
        />
      ) : (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className={fieldArea}
        />
      )}
      {hint && <p className="text-xs text-[#6b655c] mt-1.5">{hint}</p>}
    </div>
  );
}

function toYouTubeEmbed(url: string) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/i);
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
}

function toVimeoEmbed(url: string) {
  const match = url.match(/vimeo\.com\/(\d+)/i);
  return match ? `https://player.vimeo.com/video/${match[1]}` : url;
}
