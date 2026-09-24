import { useState } from 'react';
import apiClient from '@/lib/api/client';
import { useAdmin, useAdminAction } from './context';
import { Field, Modal, btn, inputCls } from './ui';

export function EnrollModal({
  open,
  onClose,
  userId,
  classId,
}: {
  open: boolean;
  onClose: () => void;
  userId?: string;
  classId?: string;
}) {
  const { data, classOps, flash } = useAdmin();
  const run = useAdminAction();
  const [form, setForm] = useState({ userId: userId || '', classId: classId || '' });
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const key = open ? `${userId || ''}|${classId || ''}` : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) setForm({ userId: userId || '', classId: classId || '' });
  }

  const learners = (data.users || []).filter((u) => u.role === 'student').sort((a, b) => a.fullName.localeCompare(b.fullName));
  const alreadyIn = new Set(
    (data.enrollments || []).filter((e) => e.userId === form.userId).map((e) => e.classId)
  );
  const classes = classOps.filter((c) => c.status === 'published').sort((a, b) => a.title.localeCompare(b.title));
  const selectedClass = classes.find((c) => c.id === form.classId);

  async function submit() {
    if (!form.userId || !form.classId) return flash({ type: 'err', text: 'Choose a learner and a class.' });
    setBusy(true);
    const res = await run(() => apiClient.post('/data/admin/enrollments', form), { success: 'Learner enrolled' });
    setBusy(false);
    if (res) onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      eyebrow="Place enrollment"
      title="Enroll a learner"
      subtitle="Adds the learner to a published class without payment."
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btn.primary} disabled={busy} onClick={() => void submit()}>
            {busy ? 'Enrolling…' : 'Enroll learner'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Learner">
          <select className={inputCls} value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
            <option value="">Select learner…</option>
            {learners.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} · {u.email}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Class"
          hint={
            selectedClass
              ? selectedClass.seatsLeft > 0
                ? `${selectedClass.seatsLeft} seat${selectedClass.seatsLeft === 1 ? '' : 's'} left`
                : 'This class is full — enrollment will be blocked.'
              : undefined
          }
        >
          <select className={inputCls} value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
            <option value="">Select class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id} disabled={alreadyIn.has(c.id)}>
                {c.title} ({c.enrolledStudents}/{c.maxStudents}){alreadyIn.has(c.id) ? ' · already enrolled' : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

const emptyAccount = { firstName: '', lastName: '', email: '', password: '', role: 'student' as 'student' | 'instructor' };

export function CreateAccountModal({
  open,
  onClose,
  defaultRole = 'student',
}: {
  open: boolean;
  onClose: () => void;
  defaultRole?: 'student' | 'instructor';
}) {
  const { flash, goTo } = useAdmin();
  const run = useAdminAction();
  const [form, setForm] = useState({ ...emptyAccount, role: defaultRole });
  const [wasOpen, setWasOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm({ ...emptyAccount, role: defaultRole });
  }

  async function submit() {
    if (!form.firstName.trim() || !form.lastName.trim()) return flash({ type: 'err', text: 'First and last name are required.' });
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return flash({ type: 'err', text: 'Enter a valid email address.' });
    if (form.password.length < 6) return flash({ type: 'err', text: 'Temporary password must be at least 6 characters.' });
    setBusy(true);
    const res = await run(() =>
      apiClient.post('/data/admin/users', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        instructorStatus: form.role === 'instructor' ? 'approved' : undefined,
      })
    );
    setBusy(false);
    if (res) {
      onClose();
      if (form.role === 'instructor') goTo('instructors', { instructorFilter: 'approved' });
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      eyebrow="Add account"
      title={form.role === 'instructor' ? 'Add an instructor' : 'Add a learner'}
      subtitle="They can sign in straight away with the temporary password."
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btn.primary} disabled={busy} onClick={() => void submit()}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name">
          <input className={inputCls} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} autoFocus />
        </Field>
        <Field label="Last name">
          <input className={inputCls} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </Field>
        <Field label="Email" className="sm:col-span-2">
          <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Temporary password" hint="Share it privately; ask them to change it.">
          <input type="text" autoComplete="off" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Role">
          <select
            className={inputCls}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as 'student' | 'instructor' })}
          >
            <option value="student">Learner</option>
            <option value="instructor">Instructor (approved)</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}

export function EmailModal({
  recipient,
  onClose,
}: {
  recipient: { id: string; fullName: string; email: string } | null;
  onClose: () => void;
}) {
  const { flash } = useAdmin();
  const run = useAdminAction();
  const [draft, setDraft] = useState({ subject: '', body: '' });
  const [lastId, setLastId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const id = recipient?.id ?? null;
  if (id !== lastId) {
    setLastId(id);
    if (id) setDraft({ subject: '', body: '' });
  }

  async function send() {
    if (!recipient) return;
    if (!draft.subject.trim() || !draft.body.trim()) return flash({ type: 'err', text: 'Add a subject and a message.' });
    setBusy(true);
    const res = await run(
      () =>
        apiClient.post(`/data/admin/users/${recipient.id}/email`, {
          subject: draft.subject.trim(),
          body: draft.body.trim(),
        }),
      { success: `Email sent to ${recipient.fullName}`, refresh: false }
    );
    setBusy(false);
    if (res) onClose();
  }

  return (
    <Modal
      open={!!recipient}
      onClose={onClose}
      size="md"
      eyebrow="Send email"
      title={recipient ? `Email ${recipient.fullName}` : ''}
      subtitle={recipient?.email}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btn.primary} disabled={busy} onClick={() => void send()}>
            {busy ? 'Sending…' : 'Send email'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Subject">
          <input className={inputCls} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} autoFocus />
        </Field>
        <Field label="Message" hint="Sent from Nexnoon with the platform email template.">
          <textarea
            rows={7}
            className={`${inputCls} resize-y`}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}
