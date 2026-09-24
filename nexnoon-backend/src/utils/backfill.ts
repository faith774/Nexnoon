import { ClassModel } from '../models/Class';
import { User } from '../models/User';
import { isValidTimeZone } from './time';

/**
 * Gives classes created before per-class time zones one: the lead instructor's profile
 * zone, else UTC. Session instants are stored in UTC, so this only changes how times are
 * labelled and entered, never when a session happens. Idempotent; safe on every boot.
 */
export async function backfillClassTimeZones(): Promise<number> {
  const classes = await ClassModel.find({
    $or: [{ timezone: { $exists: false } }, { timezone: null }, { timezone: '' }],
  })
    .select('_id instructor.id')
    .lean();
  if (!classes.length) return 0;

  const leads = await User.find({ _id: { $in: [...new Set(classes.map((c) => String(c.instructor?.id)))] } })
    .select('timezone')
    .lean();
  const zoneByLead = new Map(leads.map((u: any) => [String(u._id), isValidTimeZone(u.timezone) ? u.timezone : 'UTC']));

  const ops = classes.map((c) => ({
    updateOne: {
      filter: { _id: c._id, $or: [{ timezone: { $exists: false } }, { timezone: null }, { timezone: '' }] },
      update: { $set: { timezone: zoneByLead.get(String(c.instructor?.id)) || 'UTC' } },
    },
  }));
  const result = await ClassModel.bulkWrite(ops);
  return result.modifiedCount;
}
