/** Lead instructor or an accepted support instructor on the class. */
export function teachesClass(cls: { instructor?: { id?: unknown }; teachingTeam?: { userId: unknown; status?: string }[] } | null | undefined, userId: string) {
  if (!cls) return false;
  if (String(cls.instructor?.id) === userId) return true;
  return (cls.teachingTeam || []).some((m) => String(m.userId) === userId && m.status === 'accepted');
}
