import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import Stripe from "stripe";
import { EnrollmentModel } from "../models/Enrollment";
import { ClassModel, ClassScheduleModel, IClass } from "../models/Class";
import { CourseModel } from "../models/Course";
import { PaymentModel, IPayment } from "../models/Payment";
import { NotificationModel } from "../models/Notification";
import { WaitlistModel } from "../models/Waitlist";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";
import { getMaxClassSeats, getPlatformSettings } from "../models/PlatformSettings";
import { certificateLink, ensureCertificate } from "../utils/certificates";
import { User } from "../models/User";
import { buildEnrollmentConfirmationEmail, sendEmailSafe } from "../utils/email";
import { syncEarnings } from "../utils/earnings";
import { getStripe } from "../utils/stripe";
import { teachesClass } from "../utils/team";
import { notifyUserInApp } from "../utils/notify";
import { rateLimit } from "../middleware/rateLimit";
import {
  activeOfferFor,
  classTimeline,
  enrollmentBlock,
  freeSeats,
  leaveTerms,
  refundPayment,
  releaseOffer,
  releaseSeat,
  reserveSeat,
  waitlistPosition,
} from "../utils/seats";

const router = Router();

router.use((req: AuthRequest, res, next) => {
  if (req.headers.authorization) return requireAuth(req, res, next);
  next();
});

const enrollSchema = z.object({
  classId: z.string(),
  paymentMethodId: z.string().optional(),
});

type ClassDoc = InstanceType<typeof ClassModel>;

const enrollmentDto = (e: any) => (e ? { ...(e.toObject ? e.toObject() : e), id: String(e._id ?? e.id) } : null);

function teachesOrLeads(cls: ClassDoc, userId: string) {
  return String(cls.instructor.id) === userId || teachesClass(cls, userId);
}

/** A learner who left without a refund keeps their place in the ledger and can rejoin without paying again. */
async function paidAlready(userId: string, classId: string) {
  return !!(await PaymentModel.exists({ userId, classId, status: "completed" }));
}

async function canTakeSeat(cls: ClassDoc, userId: string) {
  if (await activeOfferFor(cls.id, userId)) return true;
  return freeSeats(cls, await getMaxClassSeats()) > 0;
}

/**
 * Seat + enrollment once payment (if any) is settled. Refunds the payment when the
 * class filled up in the meantime.
 */
async function finalizeEnrollment(userId: string, cls: ClassDoc, payment: IPayment | null) {
  const { cls: reserved, cap } = await reserveSeat(cls.id, userId);
  if (!reserved) {
    let refunded = false;
    if (payment && payment.status === "completed") {
      refunded = await refundPayment(payment, "Class filled before enrollment finished").then(() => true, () => false);
    }
    return {
      status: 409,
      body: {
        success: false,
        code: "CLASS_FULL",
        message: `This class just filled up (${cap} seats).${refunded ? " Your payment was refunded." : ""} You can join the waitlist.`,
      },
    };
  }

  const now = new Date();
  const rejoined = await EnrollmentModel.findOneAndUpdate(
    { classId: cls.id, userId, status: "dropped" },
    { $set: { status: "active", enrolledAt: now }, $unset: { droppedAt: 1 } },
    { new: true }
  );
  let enrollment = rejoined;
  if (!enrollment) {
    const result = await EnrollmentModel.updateOne(
      { classId: cls.id, userId },
      { $setOnInsert: { status: "active", progress: 0, enrolledAt: now } },
      { upsert: true }
    ).catch((error: any) => {
      if (error?.code === 11000) return { upsertedCount: 0 };
      throw error;
    });
    enrollment = await EnrollmentModel.findOne({ classId: cls.id, userId });
    if (!result.upsertedCount) {
      await releaseSeat(cls.id);
      return { status: 200, body: { success: true, data: enrollmentDto(enrollment), message: "Already enrolled" } };
    }
  }

  if (payment) syncEarnings().catch((e) => console.error("Earnings sync failed:", e));

  await NotificationModel.create({
    userId,
    type: "payment",
    title: "You're enrolled",
    message: `Welcome to ${cls.title}. Your classroom is ready.`,
    read: false,
    actionUrl: `/classroom/${cls.id}`,
  }).catch(() => {});

  const learner = await User.findById(userId).select("fullName email").lean();
  if (learner?.email) {
    sendEmailSafe(
      learner.email,
      `Enrolled: ${cls.title}`,
      buildEnrollmentConfirmationEmail({ learnerName: learner.fullName, classTitle: cls.title, classId: cls.id })
    ).catch(() => {});
  }

  return {
    status: 201,
    body: { success: true, data: enrollmentDto(enrollment), message: rejoined ? "Welcome back" : "Enrolled successfully" },
  };
}

function paymentIntentResponse(intent: Stripe.PaymentIntent) {
  return {
    status: 202,
    body: {
      success: false,
      code: "REQUIRES_ACTION",
      message: "Your bank needs you to confirm this payment.",
      data: { requiresAction: true, clientSecret: intent.client_secret, paymentIntentId: intent.id },
    },
  };
}

router.post("/", requireAuth, rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "enroll" }), async (req: AuthRequest, res) => {
  const parsed = enrollSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Validation failed" });
  }
  const { classId, paymentMethodId } = parsed.data;
  const userId = req.user!.id;
  if (!isValidObjectId(classId)) {
    return res.status(400).json({ success: false, message: "Invalid class ID" });
  }

  const cls = await ClassModel.findById(classId);
  if (!cls) return res.status(404).json({ success: false, message: "Class not found" });
  if (teachesOrLeads(cls, userId)) {
    return res.status(409).json({ success: false, message: "You teach this class" });
  }

  const existing = await EnrollmentModel.findOne({ classId, userId });
  if (existing && existing.status !== "dropped") {
    return res.status(200).json({ success: true, data: enrollmentDto(existing), message: "Already enrolled" });
  }

  const blocked = await enrollmentBlock(cls);
  if (blocked) return res.status(409).json({ success: false, code: "CLOSED", message: blocked });

  if (!(await canTakeSeat(cls, userId))) {
    return res.status(409).json({
      success: false,
      code: "CLASS_FULL",
      message: "This class is full. Join the waitlist and we'll hold a seat for you when one opens.",
    });
  }

  const needsPayment = cls.price > 0 && !(await paidAlready(userId, cls.id));
  if (!needsPayment) {
    const result = await finalizeEnrollment(userId, cls, null);
    return res.status(result.status).json(result.body);
  }

  const stripe = getStripe();
  if (!stripe || !paymentMethodId) {
    return res.status(402).json({
      success: false,
      message: "Paid enrollment requires a card. No payment has been taken.",
    });
  }

  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create(
      {
        amount: Math.round(cls.price * 100),
        currency: (cls.currency || "usd").toLowerCase(),
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        description: `Nexnoon: ${cls.title}`,
        metadata: { classId: cls.id, userId },
      },
      { idempotencyKey: `enroll-${userId}-${cls.id}-${paymentMethodId}` }
    );
  } catch (err: any) {
    return res.status(402).json({ success: false, message: err?.message || "Your card was declined. No payment has been taken." });
  }

  const payment = await PaymentModel.findOneAndUpdate(
    { stripePaymentIntentId: intent.id },
    {
      $setOnInsert: {
        userId,
        classId: cls.id,
        amount: cls.price,
        currency: (cls.currency || "usd").toLowerCase(),
        paymentMethod: intent.payment_method_types.join(","),
        stripePaymentIntentId: intent.id,
      },
      $set: {
        status: intent.status === "succeeded" ? "completed" : "pending",
        stripeChargeId: (intent.latest_charge as string) || undefined,
      },
    },
    { upsert: true, new: true }
  );

  if (intent.status === "requires_action") {
    const r = paymentIntentResponse(intent);
    return res.status(r.status).json(r.body);
  }
  if (intent.status !== "succeeded") {
    return res.status(402).json({ success: false, message: "The payment didn't go through. No enrollment was made." });
  }

  const result = await finalizeEnrollment(userId, cls, payment);
  return res.status(result.status).json(result.body);
});

/** Called after the learner completes a bank check (3-D Secure) in the browser. */
router.post("/confirm", requireAuth, async (req: AuthRequest, res) => {
  const parsed = z.object({ paymentIntentId: z.string().min(5).max(255) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid request" });
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ success: false, message: "Payments are not configured" });

  const userId = req.user!.id;
  const intent = await stripe.paymentIntents.retrieve(parsed.data.paymentIntentId).catch(() => null);
  if (!intent || intent.metadata?.userId !== userId) {
    return res.status(404).json({ success: false, message: "Payment not found" });
  }
  const payment = await PaymentModel.findOne({ stripePaymentIntentId: intent.id, userId });
  const cls = await ClassModel.findById(intent.metadata.classId);
  if (!payment || !cls) return res.status(404).json({ success: false, message: "Payment not found" });

  if (intent.status === "requires_action") {
    const r = paymentIntentResponse(intent);
    return res.status(r.status).json(r.body);
  }
  if (intent.status !== "succeeded") {
    payment.status = "failed";
    await payment.save();
    return res.status(402).json({ success: false, message: "The bank check didn't complete. No payment was taken." });
  }
  if (payment.status === "pending") {
    payment.status = "completed";
    payment.stripeChargeId = (intent.latest_charge as string) || payment.stripeChargeId;
    await payment.save();
  }

  const existing = await EnrollmentModel.findOne({ classId: cls.id, userId, status: { $in: ["active", "completed"] } });
  if (existing) return res.json({ success: true, data: enrollmentDto(existing), message: "Already enrolled" });

  const result = await finalizeEnrollment(userId, cls, payment);
  return res.status(result.status).json(result.body);
});

/** Everything the class page and checkout need to show the right call to action. */
router.get("/status/:classId", async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.classId)) {
    return res.status(400).json({ success: false, message: "Invalid class ID" });
  }
  const cls = await ClassModel.findById(req.params.classId);
  if (!cls) return res.status(404).json({ success: false, message: "Class not found" });

  const [cap, settings, blocked, timeline] = await Promise.all([getMaxClassSeats(), getPlatformSettings(), enrollmentBlock(cls), classTimeline(cls)]);
  const seatsLeft = freeSeats(cls, cap);
  const userId = req.user?.id;

  let enrollment: any = null;
  let waitlist: any = null;
  let alreadyPaid = false;
  let teaches = false;
  if (userId) {
    teaches = teachesOrLeads(cls, userId);
    const [enr, entry, paid] = await Promise.all([
      EnrollmentModel.findOne({ classId: cls.id, userId }).lean(),
      WaitlistModel.findOne({ classId: cls.id, userId, status: { $in: ["waiting", "offered"] } }),
      paidAlready(userId, cls.id),
    ]);
    alreadyPaid = paid;
    if (enr) enrollment = { id: String(enr._id), status: enr.status, droppedAt: enr.droppedAt };
    if (entry) {
      waitlist = {
        status: entry.status,
        joinedAt: entry.joinedAt,
        offerExpiresAt: entry.status === "offered" ? entry.offerExpiresAt : undefined,
        position: await waitlistPosition(entry),
      };
    }
  }

  const hasOffer = waitlist?.status === "offered" && new Date(waitlist.offerExpiresAt) > new Date();
  return res.json({
    success: true,
    data: {
      classId: cls.id,
      price: cls.price,
      currency: (cls.currency || "usd").toUpperCase(),
      seatCap: cap,
      seatsLeft,
      full: seatsLeft <= 0 && !hasOffer,
      open: !blocked,
      closedReason: blocked,
      teaches,
      enrollment,
      waitlist,
      alreadyPaid,
      canReview: !!enrollment && (enrollment.status === "completed" || (enrollment.status === "active" && timeline.ended)),
      refundWindowDays: settings.refundWindowDays ?? 7,
      waitlistClaimHours: 24,
    },
  });
});

router.get("/my", requireAuth, async (req: AuthRequest, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 10)));
  const query = { userId: req.user!.id };
  const [items, totalItems] = await Promise.all([
    EnrollmentModel.find(query).sort({ enrolledAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    EnrollmentModel.countDocuments(query),
  ]);
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  return res.json({
    success: true,
    data: {
      data: items.map(enrollmentDto),
      pagination: { page, pageSize, totalPages, totalItems, hasNext: page < totalPages, hasPrevious: page > 1 },
    },
  });
});

/* ------------------------------------------------------------------ */
/* Waitlist                                                            */
/* ------------------------------------------------------------------ */

router.post("/waitlist/:classId", requireAuth, async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.classId)) return res.status(400).json({ success: false, message: "Invalid class ID" });
  const userId = req.user!.id;
  const cls = await ClassModel.findById(req.params.classId);
  if (!cls) return res.status(404).json({ success: false, message: "Class not found" });
  if (teachesOrLeads(cls, userId)) return res.status(409).json({ success: false, message: "You teach this class" });

  const blocked = await enrollmentBlock(cls);
  if (blocked) return res.status(409).json({ success: false, message: blocked });
  if (await EnrollmentModel.exists({ classId: cls.id, userId, status: { $in: ["active", "completed"] } })) {
    return res.status(409).json({ success: false, message: "You're already enrolled in this class" });
  }
  if (freeSeats(cls, await getMaxClassSeats()) > 0) {
    return res.status(409).json({ success: false, code: "SEATS_AVAILABLE", message: "Seats are available, so you can enroll right away." });
  }

  const current = await WaitlistModel.findOne({ classId: cls.id, userId });
  if (current && (current.status === "waiting" || current.status === "offered")) {
    return res.json({ success: true, data: { status: current.status, position: await waitlistPosition(current) }, message: "You're already on the waitlist" });
  }
  const entry = await WaitlistModel.findOneAndUpdate(
    { classId: cls.id, userId },
    { $set: { status: "waiting", joinedAt: new Date() }, $unset: { offeredAt: 1, offerExpiresAt: 1, resolvedAt: 1 } },
    { upsert: true, new: true }
  );
  const position = await waitlistPosition(entry);
  await notifyUserInApp({
    userId,
    type: "class",
    title: "You're on the waitlist",
    message: `You're number ${position} for ${cls.title}. We'll email you and hold the seat for 24 hours when one opens.`,
    actionUrl: `/class/${cls.id}`,
  });
  return res.status(201).json({ success: true, data: { status: entry.status, position }, message: `You're number ${position} on the waitlist` });
});

router.delete("/waitlist/:classId", requireAuth, async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.classId)) return res.status(400).json({ success: false, message: "Invalid class ID" });
  const entry = await WaitlistModel.findOne({ classId: req.params.classId, userId: req.user!.id, status: { $in: ["waiting", "offered"] } });
  if (!entry) return res.json({ success: true, message: "You're not on this waitlist" });
  if (entry.status === "offered") {
    await releaseOffer(entry._id as any, "left");
  } else {
    entry.status = "left";
    entry.resolvedAt = new Date();
    await entry.save();
  }
  return res.json({ success: true, message: "You left the waitlist" });
});

/* ------------------------------------------------------------------ */
/* Certificates                                                        */
/* ------------------------------------------------------------------ */

async function certificateView(enrollment: InstanceType<typeof EnrollmentModel>) {
  const certificateId = await ensureCertificate(enrollment);
  if (!certificateId) return null;
  const [cls, learner] = await Promise.all([
    ClassModel.findById(enrollment.classId).select("title language courseId instructor details.certificateInfo").lean(),
    User.findById(enrollment.userId).select("fullName").lean(),
  ]);
  if (!cls) return null;
  const [lead, course, totalSessions] = await Promise.all([
    User.findById(cls.instructor.id).select("fullName").lean(),
    cls.courseId ? CourseModel.findById(cls.courseId).select("title slug").lean() : null,
    ClassScheduleModel.countDocuments({ classId: cls._id, status: { $ne: "cancelled" } }),
  ]);
  return {
    certificateId,
    url: certificateLink(certificateId),
    learnerName: learner?.fullName || "Nexnoon learner",
    classId: String(cls._id),
    classTitle: cls.title,
    courseTitle: course?.title,
    courseSlug: course?.slug,
    language: cls.language || undefined,
    instructorName: lead?.fullName || cls.instructor.name,
    completedAt: enrollment.completedAt,
    issuedAt: enrollment.certificateIssuedAt || enrollment.completedAt,
    sessionsAttended: enrollment.attendedSessions?.length || 0,
    totalSessions,
    note: (cls as any).details?.certificateInfo || undefined,
  };
}

/** Public verification: anyone with the id can confirm the certificate is genuine. */
router.get("/certificates/verify/:certificateId", async (req, res) => {
  const certificateId = String(req.params.certificateId || "").trim().toUpperCase();
  if (!/^NX-[0-9A-F]{10}$/.test(certificateId)) {
    return res.status(404).json({ success: false, message: "Certificate not found" });
  }
  const enrollment = await EnrollmentModel.findOne({ certificateId });
  if (!enrollment || enrollment.status !== "completed") {
    return res.status(404).json({ success: false, message: "Certificate not found" });
  }
  const view = await certificateView(enrollment);
  if (!view) return res.status(404).json({ success: false, message: "Certificate not found" });
  const viewerOwns = (req as AuthRequest).user?.id === String(enrollment.userId);
  return res.json({ success: true, data: { ...view, valid: true, viewerOwns } });
});

router.get("/certificates/mine", requireAuth, async (req: AuthRequest, res) => {
  const completed = await EnrollmentModel.find({ userId: req.user!.id, status: "completed" }).sort({ completedAt: -1 });
  const views = (await Promise.all(completed.map(certificateView))).filter(Boolean);
  return res.json({ success: true, data: views });
});

/** Learner's certificate for one class, or why it isn't ready yet. */
router.get("/certificates/class/:classId", requireAuth, async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.classId)) return res.status(400).json({ success: false, message: "Invalid class ID" });
  const enrollment = await EnrollmentModel.findOne({ classId: req.params.classId, userId: req.user!.id });
  if (!enrollment || enrollment.status === "dropped") {
    return res.status(404).json({ success: false, message: "You're not enrolled in this class" });
  }
  if (enrollment.status !== "completed") {
    return res.json({ success: true, data: { ready: false, progress: enrollment.progress || 0 } });
  }
  const view = await certificateView(enrollment);
  return res.json({ success: true, data: view ? { ready: true, ...view } : { ready: false, progress: enrollment.progress || 0 } });
});

/** Lead instructor or admin issues a completion certificate. */
router.post("/:id/certificate", requireAuth, requireRole("instructor", "admin"), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid enrollment ID" });
  }
  const enrollment = await EnrollmentModel.findById(req.params.id);
  if (!enrollment) return res.status(404).json({ success: false, message: "Enrollment not found" });
  if (enrollment.status === "dropped") {
    return res.status(409).json({ success: false, message: "Cannot issue a certificate for a dropped enrollment" });
  }
  const cls = await ClassModel.findById(enrollment.classId);
  if (!cls) return res.status(404).json({ success: false, message: "Class not found" });
  if (req.user!.role !== "admin" && String(cls.instructor.id) !== req.user!.id) {
    return res.status(403).json({ success: false, message: "Only the lead instructor can issue certificates" });
  }

  enrollment.status = "completed";
  enrollment.completedAt = enrollment.completedAt || new Date();
  enrollment.progress = 100;
  await enrollment.save();
  await ensureCertificate(enrollment);

  await NotificationModel.create({
    userId: enrollment.userId,
    type: "achievement",
    title: "Certificate issued",
    message: `Your certificate for ${cls.title} is ready.`,
    read: false,
    actionUrl: `/certificates/${enrollment.certificateId}`,
  }).catch(() => {});

  return res.json({ success: true, data: enrollmentDto(enrollment), message: "Certificate issued" });
});

/* ------------------------------------------------------------------ */
/* Leaving a class                                                     */
/* ------------------------------------------------------------------ */

async function ownEnrollment(req: AuthRequest) {
  if (!isValidObjectId(req.params.id)) return { error: { status: 400, message: "Invalid enrollment ID" } };
  const enrollment = await EnrollmentModel.findById(req.params.id);
  if (!enrollment || String(enrollment.userId) !== req.user!.id) {
    return { error: { status: 404, message: "Enrollment not found" } };
  }
  const cls = await ClassModel.findById(enrollment.classId);
  if (!cls) return { error: { status: 404, message: "Class not found" } };
  return { enrollment, cls };
}

function termsDto(terms: Awaited<ReturnType<typeof leaveTerms>>) {
  return {
    refundable: terms.refundable,
    amount: terms.amount,
    currency: terms.currency.toUpperCase(),
    refundDeadline: terms.refundDeadline,
    windowDays: terms.windowDays,
    paid: !!terms.payment,
  };
}

router.get("/:id/leave", requireAuth, async (req: AuthRequest, res) => {
  const found = await ownEnrollment(req);
  if (found.error) return res.status(found.error.status).json({ success: false, message: found.error.message });
  const terms = await leaveTerms(req.user!.id, found.cls as unknown as IClass & { _id: unknown });
  return res.json({ success: true, data: { status: found.enrollment!.status, ...termsDto(terms) } });
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const found = await ownEnrollment(req);
  if (found.error) return res.status(found.error.status).json({ success: false, message: found.error.message });
  const { enrollment, cls } = found as { enrollment: InstanceType<typeof EnrollmentModel>; cls: ClassDoc };

  if (enrollment.status === "dropped") return res.json({ success: true, data: null, message: "You already left this class" });
  if (enrollment.status === "completed") {
    return res.status(409).json({ success: false, message: "You've completed this class, so there's nothing to leave." });
  }

  const terms = await leaveTerms(req.user!.id, cls as unknown as IClass & { _id: unknown });
  let refunded = false;
  if (terms.refundable && terms.payment) {
    try {
      await refundPayment(terms.payment, "Learner left within the refund window");
      refunded = true;
    } catch (err: any) {
      return res.status(502).json({ success: false, message: `We couldn't process your refund, so you're still enrolled. ${err?.message || ""}`.trim() });
    }
  }

  const left = await EnrollmentModel.findOneAndUpdate(
    { _id: enrollment._id, status: "active" },
    { $set: { status: "dropped", droppedAt: new Date() } }
  );
  if (left) await releaseSeat(cls.id);

  const amount = `${terms.amount.toFixed(2)} ${terms.currency.toUpperCase()}`;
  await notifyUserInApp({
    userId: req.user!.id,
    type: "payment",
    title: refunded ? "Refund on its way" : "You left the class",
    message: refunded
      ? `You left ${cls.title}. ${amount} is being refunded to your card (usually 5–10 business days).`
      : `You left ${cls.title}.`,
    actionUrl: "/my-classes?tab=payments",
  });
  const learner = await User.findById(req.user!.id).select("fullName").lean();
  await notifyUserInApp({
    userId: String(cls.instructor.id),
    type: "class",
    title: "A learner left",
    message: `${learner?.fullName || "A learner"} left ${cls.title}.`,
    actionUrl: `/classroom/${cls.id}`,
  });

  return res.json({
    success: true,
    data: { refunded, amount: refunded ? terms.amount : 0, currency: terms.currency.toUpperCase() },
    message: refunded ? `You left the class. ${amount} will be refunded.` : "You left the class.",
  });
});

export default router;
