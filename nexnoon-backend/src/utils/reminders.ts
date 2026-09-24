import { ClassModel, ClassScheduleModel } from '../models/Class';
import { EnrollmentModel } from '../models/Enrollment';
import { NotificationModel } from '../models/Notification';
import { User, emailPrefsOf, type ReminderEmailPref } from '../models/User';
import { ENV } from '../config/env';
import { buildClassUpdateEmail, sendEmailSafe } from './email';
import { formatWhen, pickTimeZone } from './time';

const MIN = 60_000;
const TICK_MS = 30_000;
/** A "starting now" reminder still goes out if the server was briefly down at start time. */
const START_GRACE = 10 * MIN;

/**
 * One reminder per window: it fires once when a session's start falls inside
 * `(now + lowerMs, now + upperMs]`. Windows don't overlap, so a session added at
 * short notice only gets the reminders that are still ahead of it.
 */
type Reminder = { key: string; offsetMin: number; lowerMs: number; upperMs: number; inApp: boolean };

function buildLadder(minutes: number[]): Reminder[] {
  const ladder: Reminder[] = [
    { key: 'day', offsetMin: 24 * 60, lowerMs: Math.max(60, minutes[0] ?? 0) * MIN, upperMs: 24 * 60 * MIN, inApp: true },
  ];
  minutes.forEach((m, i) => {
    const next = minutes[i + 1];
    if (m === 0) {
      ladder.push({ key: 'start', offsetMin: 0, lowerMs: -START_GRACE, upperMs: 0, inApp: true });
    } else {
      ladder.push({ key: `m${m}`, offsetMin: m, lowerMs: (next ?? 0) * MIN, upperMs: m * MIN, inApp: m <= 10 });
    }
  });
  return ladder;
}

const LADDER = buildLadder(ENV.SESSION_REMINDER_MINUTES);

type Recipient = {
  userId: string;
  name: string;
  email?: string;
  timezone?: string;
  teaching: boolean;
  reminderPref: ReminderEmailPref;
};

/** The reminders a "key only" person still gets: the day before, the one closest to 10 minutes out, and at start. */
const KEY_REMINDERS = new Set([
  'day',
  'start',
  ...(() => {
    const near = ENV.SESSION_REMINDER_MINUTES.filter((m) => m > 0).sort((a, b) => Math.abs(a - 10) - Math.abs(b - 10))[0];
    return near ? [`m${near}`] : [];
  })(),
]);

const wantsEmail = (p: Recipient, key: string) =>
  p.reminderPref === 'all' || (p.reminderPref === 'key' && KEY_REMINDERS.has(key));

async function recipientsFor(cls: any): Promise<Recipient[]> {
  const teamIds = [
    String(cls.instructor?.id),
    ...(cls.teachingTeam || []).filter((m: any) => m.status === 'accepted').map((m: any) => String(m.userId)),
  ];
  const enrollments = await EnrollmentModel.find({ classId: cls._id, status: 'active' }).select('userId').lean();
  const learnerIds = enrollments.map((e) => String(e.userId));
  const users = await User.find({ _id: { $in: [...new Set([...teamIds, ...learnerIds])] } })
    .select('fullName email timezone emailPrefs')
    .lean();
  const team = new Set(teamIds);
  return users.map((u: any) => ({
    userId: String(u._id),
    name: u.fullName || 'there',
    email: u.email,
    timezone: u.timezone,
    teaching: team.has(String(u._id)),
    reminderPref: emailPrefsOf(u).sessionReminders,
  }));
}

function copyFor(reminder: Reminder, session: any, cls: any, p: Recipient, now: Date) {
  const when = formatWhen(session.startTime, pickTimeZone(p.timezone, cls.timezone));
  const name = `${cls.title} — ${session.title}`;
  const live = session.status === 'live';
  const minsLeft = Math.max(1, Math.round((new Date(session.startTime).getTime() - now.getTime()) / MIN));

  if (reminder.key === 'day') {
    return {
      subject: `Tomorrow: ${cls.title}`,
      heading: 'Class reminder',
      body: p.teaching
        ? `Reminder: you're teaching ${name} on ${when}.`
        : `Reminder: ${name} is on ${when}. See you there!`,
    };
  }

  if (reminder.key === 'start') {
    if (p.teaching) {
      return {
        subject: `Starting now: ${cls.title}`,
        heading: live ? 'Your class is live' : 'Your class starts now',
        body: live
          ? `It's start time for ${name}. Your meeting is live and learners are joining.`
          : `${name} is due to start now (${when}) and hasn't been started yet. Open the classroom and start the meeting — learners are waiting.`,
      };
    }
    return {
      subject: `Starting now: ${cls.title}`,
      heading: 'Your class is starting',
      body: `${name} is starting now (${when}). Open your classroom and join.`,
    };
  }

  const inText = `${minsLeft} minute${minsLeft === 1 ? '' : 's'}`;
  if (p.teaching) {
    return {
      subject: `In ${inText}: ${cls.title}`,
      heading: `You're teaching in ${inText}`,
      body: live
        ? `${name} starts at ${when}. Your meeting is already live.`
        : `${name} starts in ${inText} (${when}). You can start the meeting from the classroom up to ${ENV.LIVE_CLASS_HOST_EARLY_MINUTES} minutes early.`,
    };
  }
  const canJoin = live || minsLeft <= ENV.LIVE_CLASS_JOIN_EARLY_MINUTES;
  return {
    subject: `In ${inText}: ${cls.title}`,
    heading: `Class starts in ${inText}`,
    body: `${name} starts in ${inText} (${when}). ${
      canJoin
        ? 'You can join now from your classroom.'
        : `The join button opens ${ENV.LIVE_CLASS_JOIN_EARLY_MINUTES} minutes before start.`
    }`,
  };
}

async function sendReminder(session: any, reminder: Reminder, now: Date) {
  const cls = await ClassModel.findById(session.classId).select('title timezone instructor teachingTeam cancelledAt').lean();
  if (!cls || cls.cancelledAt) return;
  const people = await recipientsFor(cls);
  if (!people.length) return;

  const actionUrl = `/classroom/${String(cls._id)}?sessionId=${String(session._id)}`;
  const messages = people.map((p) => ({ p, ...copyFor(reminder, session, cls, p, now) }));

  if (reminder.inApp) {
    await NotificationModel.insertMany(
      messages.map(({ p, heading, body }) => ({ userId: p.userId, type: 'class' as const, title: heading, message: body, actionUrl }))
    ).catch((error) => console.error('Failed to store session reminders:', error instanceof Error ? error.message : error));
  }

  await Promise.all(
    messages
      .filter(({ p }) => p.email && wantsEmail(p, reminder.key))
      .map(({ p, subject, heading, body }) =>
        sendEmailSafe(
          p.email!,
          subject,
          buildClassUpdateEmail({
            learnerName: p.name,
            heading,
            body,
            actionUrl,
            actionLabel: p.teaching ? 'Open classroom' : 'Join class',
          })
        )
      )
  );
}

/** Claims one due session per call so two servers (or overlapping ticks) never send the same reminder twice. */
function claimNext(reminder: Reminder, now: Date) {
  const path = `remindersSent.${reminder.key}`;
  return ClassScheduleModel.findOneAndUpdate(
    {
      status: { $in: reminder.key === 'day' ? ['scheduled'] : ['scheduled', 'live'] },
      startTime: { $gt: new Date(now.getTime() + reminder.lowerMs), $lte: new Date(now.getTime() + reminder.upperMs) },
      [path]: { $exists: false },
    },
    { $set: { [path]: now } },
    { new: true }
  ).lean();
}

export async function runSessionReminders(now = new Date()) {
  let sent = 0;
  // Closest-to-start first so the most urgent emails aren't queued behind "tomorrow" ones.
  for (const reminder of [...LADDER].reverse()) {
    for (let i = 0; i < 50; i++) {
      const session = await claimNext(reminder, now);
      if (!session) break;
      await sendReminder(session, reminder, now).catch((error) =>
        console.error(`Session reminder (${reminder.key}) failed:`, error instanceof Error ? error.message : error)
      );
      sent++;
    }
  }
  return sent;
}

let timer: NodeJS.Timeout | null = null;
let running = false;

export function startSessionReminders() {
  if (timer || ENV.NODE_ENV === 'test' || process.env.SESSION_REMINDERS === 'off') return;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runSessionReminders();
    } catch (error) {
      console.error('Session reminder tick failed:', error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  }, TICK_MS);
  timer.unref();
}
