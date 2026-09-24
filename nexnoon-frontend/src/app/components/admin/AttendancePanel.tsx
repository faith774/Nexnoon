import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { browserTimeZone, fmtInZone } from './ClassOps';
import { useAdminAction } from './context';
import { EmptyBlock, ExportButton, Panel, StatTile, btn } from './ui';

type MarkState = 'present' | 'late' | 'absent' | 'excused';

type AttendanceData = {
  class: { id: string; title: string; timezone: string | null };
  sessions: { id: string; sessionNumber: number; title: string; startTime: string; endTime: string; status: string; held: boolean; rate: number | null }[];
  learners: { userId: string; name: string; email: string; enrollmentStatus: string; rate: number | null }[];
  cells: Record<string, { state: MarkState | null; source: 'manual' | 'auto' | null; joinedAt: string | null; durationSeconds: number | null }>;
  summary: { attendanceRate: number; heldSessions: number; attendanceExpected: number; attended: number; dropoutRate: number; completionRate: number };
};

const CELL_STYLE: Record<MarkState, string> = {
  present: 'bg-emerald-500 text-white',
  late: 'bg-amber-400 text-[#0b1220]',
  absent: 'bg-rose-100 text-rose-800',
  excused: 'bg-slate-200 text-slate-700',
};
const CELL_LETTER: Record<MarkState, string> = { present: 'P', late: 'L', absent: 'A', excused: 'E' };
const NEXT: (MarkState | null)[] = ['present', 'late', 'absent', 'excused', null];

export function AttendancePanel({ classId }: { classId: string }) {
  const key = ['admin-attendance', classId];
  const qc = useQueryClient();
  const run = useAdminAction();
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useQuery<AttendanceData>({
    queryKey: key,
    queryFn: async () => (await apiClient.get(`/admin/classes/${classId}/attendance`)).data.data,
    staleTime: 0,
  });

  if (isLoading) return <div className="h-40 animate-pulse bg-[#eef2f7]" />;
  if (isError || !data)
    return (
      <EmptyBlock
        text="Couldn’t load attendance."
        action={
          <button type="button" className={btn.secondary} onClick={() => void refetch()}>
            Try again
          </button>
        }
      />
    );

  const tz = data.class.timezone || browserTimeZone();
  const now = Date.now();
  const markable = (s: AttendanceData['sessions'][number]) => new Date(s.startTime).getTime() <= now;

  async function mark(sessionId: string, userId: string, current: { state: MarkState | null; source: string | null }) {
    // A manual mark cycles forward; an automatic reading starts the cycle at "present".
    const idx = current.source === 'manual' && current.state ? NEXT.indexOf(current.state) : -1;
    const status = NEXT[(idx + 1) % NEXT.length];
    const cellKey = `${sessionId}:${userId}`;
    setBusy(cellKey);
    await run(() => apiClient.put(`/admin/classes/${classId}/attendance`, { sessionId, userId, status }), { success: () => '', refresh: false });
    await qc.invalidateQueries({ queryKey: key });
    setBusy(null);
  }

  const exportRows = () =>
    data.learners.map((l) => {
      const row: Record<string, string | number> = { learner: l.name, email: l.email, attendance_pct: l.rate ?? '' };
      for (const s of data.sessions) row[`S${s.sessionNumber} ${fmtInZone(s.startTime, tz)}`] = data.cells[`${s.id}:${l.userId}`]?.state || '';
      return row;
    });

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Attendance" value={data.summary.heldSessions ? `${data.summary.attendanceRate}%` : '—'} hint={`${data.summary.attended}/${data.summary.attendanceExpected} seats filled`} />
        <StatTile label="Sessions held" value={data.summary.heldSessions} hint={`of ${data.sessions.length} scheduled`} />
        <StatTile label="Dropout" value={`${data.summary.dropoutRate}%`} tone={data.summary.dropoutRate >= 25 ? 'warn' : undefined} />
        <StatTile label="Completion" value={`${data.summary.completionRate}%`} />
      </div>

      {!data.sessions.length || !data.learners.length ? (
        <EmptyBlock text={!data.sessions.length ? 'No sessions scheduled yet.' : 'No learners enrolled yet.'} />
      ) : (
        <Panel
          title="Session register"
          subtitle={`Times in ${tz}. Joins through Nexnoon are recorded automatically. Click a cell to override: present → late → absent → excused → automatic.`}
          actions={<ExportButton filename={`attendance-${data.class.title.slice(0, 40)}`} rows={exportRows} label="CSV" />}
          bodyClassName=""
        >
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr className="border-b border-[#e4ebf2] bg-[#f7f9fc] text-[11px] text-[#6a7a8c]">
                  <th className="sticky left-0 z-10 min-w-[180px] bg-[#f7f9fc] px-4 py-2.5 text-left font-medium uppercase tracking-wider">Learner</th>
                  {data.sessions.map((s) => (
                    <th key={s.id} className="min-w-[56px] px-1.5 py-2 text-center font-medium" title={`${s.title} · ${fmtInZone(s.startTime, tz)}`}>
                      <span className="block text-[#0b1220]">S{s.sessionNumber}</span>
                      <span className="block font-normal text-[#9aa7b5]">{s.rate != null ? `${s.rate}%` : markable(s) ? '—' : 'soon'}</span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right font-medium uppercase tracking-wider">Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.learners.map((l) => (
                  <tr key={l.userId} className="border-b border-[#eef2f7] last:border-0">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2">
                      <p className="truncate font-medium text-[#0b1220]">{l.name}</p>
                      <p className="truncate text-xs text-[#7a8898]">{l.email}</p>
                    </td>
                    {data.sessions.map((s) => {
                      const cellKey = `${s.id}:${l.userId}`;
                      const cell = data.cells[cellKey] || { state: null, source: null, joinedAt: null, durationSeconds: null };
                      const can = markable(s);
                      const label = cell.state
                        ? `${cell.state}${cell.source === 'manual' ? ' (marked manually)' : cell.source === 'auto' ? ' (joined)' : ''}${cell.durationSeconds ? ` · ${Math.round(cell.durationSeconds / 60)} min` : ''}`
                        : can
                          ? 'No record'
                          : 'Upcoming';
                      return (
                        <td key={s.id} className="px-1.5 py-2 text-center">
                          <button
                            type="button"
                            disabled={!can || busy === cellKey}
                            title={`${l.name} · S${s.sessionNumber}: ${label}`}
                            aria-label={`${l.name}, session ${s.sessionNumber}: ${label}`}
                            onClick={() => void mark(s.id, l.userId, cell)}
                            className={`relative inline-flex h-8 w-8 items-center justify-center text-xs font-semibold transition disabled:cursor-default ${
                              cell.state ? CELL_STYLE[cell.state] : can ? 'border border-dashed border-[#d0dae6] text-[#9aa7b5] hover:border-[#3a5f8a]' : 'bg-[#f7f9fc] text-[#d0dae6]'
                            } ${busy === cellKey ? 'opacity-50' : ''}`}
                          >
                            {cell.state ? CELL_LETTER[cell.state] : can ? '+' : '·'}
                            {cell.source === 'manual' ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#3a5f8a] ring-2 ring-white" /> : null}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right tabular-nums text-[#5c6b7a]">{l.rate != null ? `${l.rate}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-4 border-t border-[#e4ebf2] px-4 py-3 text-xs text-[#5c6b7a]">
            {(Object.keys(CELL_LETTER) as MarkState[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={`inline-flex h-4 w-4 items-center justify-center text-[9px] font-bold ${CELL_STYLE[k]}`}>{CELL_LETTER[k]}</span>
                {k}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#3a5f8a]" /> manually marked
            </span>
          </div>
        </Panel>
      )}
    </>
  );
}
