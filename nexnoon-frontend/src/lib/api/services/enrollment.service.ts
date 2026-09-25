import apiClient from '../client';
import type { APIResponse } from '@/types/api';

export interface WaitlistState {
  status: 'waiting' | 'offered';
  joinedAt: string;
  offerExpiresAt?: string;
  position: number | null;
}

export interface EnrollmentStatus {
  classId: string;
  price: number;
  currency: string;
  seatCap: number;
  seatsLeft: number;
  full: boolean;
  open: boolean;
  closedReason: string | null;
  teaches: boolean;
  enrollment: { id: string; status: 'active' | 'completed' | 'dropped'; droppedAt?: string } | null;
  waitlist: WaitlistState | null;
  alreadyPaid: boolean;
  canReview: boolean;
  refundWindowDays: number;
  waitlistClaimHours: number;
}

export interface LeaveTerms {
  status: 'active' | 'completed' | 'dropped';
  refundable: boolean;
  amount: number;
  currency: string;
  refundDeadline: string | null;
  windowDays: number;
  paid: boolean;
}

export type EnrollResult =
  | { kind: 'enrolled'; message: string }
  | { kind: 'requires_action'; clientSecret: string; paymentIntentId: string };

function toResult(body: APIResponse<any> & { code?: string }): EnrollResult {
  if (body.code === 'REQUIRES_ACTION' && body.data?.clientSecret) {
    return { kind: 'requires_action', clientSecret: body.data.clientSecret, paymentIntentId: body.data.paymentIntentId };
  }
  return { kind: 'enrolled', message: body.message || 'Enrolled' };
}

export const enrollmentService = {
  async status(classId: string): Promise<EnrollmentStatus> {
    const res = await apiClient.get<APIResponse<EnrollmentStatus>>(`/enrollments/status/${classId}`);
    return res.data.data;
  },

  async enroll(classId: string, paymentMethodId?: string): Promise<EnrollResult> {
    const res = await apiClient.post('/enrollments', { classId, paymentMethodId });
    return toResult(res.data);
  },

  async confirm(paymentIntentId: string): Promise<EnrollResult> {
    const res = await apiClient.post('/enrollments/confirm', { paymentIntentId });
    return toResult(res.data);
  },

  async leaveTerms(enrollmentId: string): Promise<LeaveTerms> {
    const res = await apiClient.get<APIResponse<LeaveTerms>>(`/enrollments/${enrollmentId}/leave`);
    return res.data.data;
  },

  async leave(enrollmentId: string): Promise<{ message: string; refunded: boolean }> {
    const res = await apiClient.delete(`/enrollments/${enrollmentId}`);
    return { message: res.data.message, refunded: !!res.data.data?.refunded };
  },

  async joinWaitlist(classId: string): Promise<{ message: string; position: number | null }> {
    const res = await apiClient.post(`/enrollments/waitlist/${classId}`);
    return { message: res.data.message, position: res.data.data?.position ?? null };
  },

  async leaveWaitlist(classId: string): Promise<string> {
    const res = await apiClient.delete(`/enrollments/waitlist/${classId}`);
    return res.data.message;
  },
};

export function formatMoney(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}
