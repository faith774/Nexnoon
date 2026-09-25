import { randomBytes } from 'crypto';
import { EnrollmentModel } from '../models/Enrollment';
import { ENV } from '../config/env';

export function newCertificateId() {
  return `NX-${randomBytes(5).toString('hex').toUpperCase()}`;
}

export const certificateLink = (certificateId: string) =>
  `${ENV.FRONTEND_URL.replace(/\/+$/, '')}/certificates/${certificateId}`;

/** Completed enrollments get a stable public certificate id the first time anyone asks for it. */
export async function ensureCertificate(enrollment: InstanceType<typeof EnrollmentModel>) {
  if (enrollment.status !== 'completed') return null;
  if (enrollment.certificateId) return enrollment.certificateId;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const id = newCertificateId();
    const updated = await EnrollmentModel.findOneAndUpdate(
      { _id: enrollment._id, certificateId: { $exists: false } },
      {
        $set: {
          certificateId: id,
          certificateIssuedAt: enrollment.completedAt || new Date(),
          certificateUrl: certificateLink(id),
        },
      },
      { new: true }
    ).catch((error: any) => {
      if (error?.code === 11000) return undefined;
      throw error;
    });
    if (updated === undefined) continue;
    if (updated) {
      enrollment.certificateId = updated.certificateId;
      enrollment.certificateIssuedAt = updated.certificateIssuedAt;
      return updated.certificateId!;
    }
    const current = await EnrollmentModel.findById(enrollment._id).select('certificateId').lean();
    return current?.certificateId || null;
  }
  return null;
}
