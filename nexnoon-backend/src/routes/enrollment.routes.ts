import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { EnrollmentModel } from "../models/Enrollment";
import { ClassModel } from "../models/Class";
import { PaymentModel } from "../models/Payment";
import { NotificationModel } from "../models/Notification";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";
import { getMaxClassSeats } from "../models/PlatformSettings";
import Stripe from "stripe";
import { ENV } from "../config/env";

const router = Router();

const stripe = ENV.STRIPE_SECRET_KEY
  ? new Stripe(ENV.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

const enrollSchema = z.object({
  classId: z.string(),
  paymentMethodId: z.string().optional(),
});

async function releaseSeat(classId: string) {
  await ClassModel.updateOne(
    { _id: classId, enrolledStudents: { $gt: 0 } },
    { $inc: { enrolledStudents: -1 } }
  );
}

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = enrollSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  }

  const { classId, paymentMethodId } = parsed.data;

  if (!isValidObjectId(classId)) {
    return res.status(400).json({ success: false, message: "Invalid class ID" });
  }

  const cls = await ClassModel.findById(classId);
  if (!cls) {
    return res.status(404).json({ success: false, message: "Class not found" });
  }

  if (cls.status !== "published") {
    return res.status(409).json({ success: false, message: "This class is not open for enrollment" });
  }
  if (String(cls.instructor.id) === req.user!.id) {
    return res.status(409).json({ success: false, message: "You already teach this class" });
  }

  const existing = await EnrollmentModel.findOne({ classId, userId: req.user!.id });
  if (existing) {
    return res.status(existing.status === "dropped" ? 409 : 200).json({
      success: existing.status !== "dropped",
      data: { ...existing.toObject(), id: existing.id },
      message:
        existing.status === "dropped"
          ? "This enrollment was dropped. Contact the instructor."
          : "Already enrolled",
    });
  }

  const maxClassSeats = await getMaxClassSeats();
  if ((cls.enrolledStudents || 0) >= maxClassSeats) {
    return res.status(409).json({
      success: false,
      message: `This class is full (${maxClassSeats} seats).`,
      data: { maxClassSeats, enrolledStudents: cls.enrolledStudents },
    });
  }

  if (cls.price > 0 && (!stripe || !paymentMethodId)) {
    return res.status(402).json({
      success: false,
      message: "Paid enrollment requires a configured payment method. No payment has been taken.",
    });
  }

  let paymentRecord;

  if (cls.price > 0 && stripe && paymentMethodId) {
    const amountInCents = Math.round(cls.price * 100);

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountInCents,
        currency: cls.currency.toLowerCase(),
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        metadata: {
          classId: cls.id,
          userId: req.user!.id,
        },
      },
      { idempotencyKey: `enroll-${req.user!.id}-${cls.id}-${paymentMethodId}` }
    );

    paymentRecord = await PaymentModel.create({
      userId: req.user!.id,
      classId: cls.id,
      amount: cls.price,
      currency: cls.currency.toLowerCase(),
      status: paymentIntent.status === "succeeded" ? "completed" : "pending",
      paymentMethod: paymentIntent.payment_method_types.join(","),
      stripePaymentIntentId: paymentIntent.id,
      stripeChargeId: (paymentIntent.latest_charge as string) || undefined,
    });

    if (paymentIntent.status !== "succeeded") {
      return res.status(402).json({
        success: false,
        message: "Payment not completed",
      });
    }
  }

  // Race-safe seat reservation using the admin-configured platform cap.
  const reserved = await ClassModel.findOneAndUpdate(
    {
      _id: cls._id,
      status: "published",
      enrolledStudents: { $lt: maxClassSeats },
    },
    { $inc: { enrolledStudents: 1 }, $set: { maxStudents: maxClassSeats } },
    { new: true }
  );

  if (!reserved) {
    if (paymentRecord && stripe && paymentRecord.stripePaymentIntentId) {
      await stripe.refunds.create({ payment_intent: paymentRecord.stripePaymentIntentId }).catch(() => {});
      paymentRecord.status = "refunded";
      await paymentRecord.save().catch(() => {});
    }
    return res.status(409).json({
      success: false,
      message: `This class just filled up (${maxClassSeats} seats).${paymentRecord ? " Your payment was refunded." : ""}`,
      data: { maxClassSeats },
    });
  }

  try {
    const result = await EnrollmentModel.updateOne(
      { classId: cls.id, userId: req.user!.id },
      { $setOnInsert: { status: "active", progress: 0, enrolledAt: new Date() } },
      { upsert: true }
    );

    // Concurrent duplicate enroll: seat was reserved twice for one user — release extra.
    if (!result.upsertedCount) {
      await releaseSeat(cls.id);
      const enrollment = await EnrollmentModel.findOne({ classId: cls.id, userId: req.user!.id });
      return res.status(200).json({
        success: true,
        data: enrollment ? { ...enrollment.toObject(), id: enrollment.id } : null,
        message: "Already enrolled",
      });
    }

    const enrollment = await EnrollmentModel.findOne({ classId: cls.id, userId: req.user!.id });

    await NotificationModel.create({
      userId: req.user!.id,
      type: "payment",
      title: "Enrolled successfully",
      message: `You're now enrolled in ${cls.title}`,
      read: false,
      actionUrl: `/class/${cls.id}`,
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      data: enrollment ? { ...enrollment.toObject(), id: enrollment.id } : null,
      message: "Enrolled successfully",
    });
  } catch (error: any) {
    await releaseSeat(cls.id);
    if (error?.code === 11000) {
      const enrollment = await EnrollmentModel.findOne({ classId: cls.id, userId: req.user!.id });
      return res.status(200).json({
        success: true,
        data: enrollment ? { ...enrollment.toObject(), id: enrollment.id } : null,
        message: "Already enrolled",
      });
    }
    throw error;
  }
});

router.get("/my", requireAuth, async (req: AuthRequest, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 10);

  const query = { userId: req.user!.id };

  const [items, totalItems] = await Promise.all([
    EnrollmentModel.find(query)
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    EnrollmentModel.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  return res.json({
    success: true,
    data: {
      data: items.map((e) => ({ ...e.toObject(), id: e.id })),
      pagination: {
        page,
        pageSize,
        totalPages,
        totalItems,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    },
  });
});

/**
 * Instructor/admin issues a completion certificate for an enrollment.
 * Sets enrollment to completed and stores a certificate URL.
 */
router.post("/:id/certificate", requireAuth, requireRole("instructor", "admin"), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid enrollment ID" });
  }

  const enrollment = await EnrollmentModel.findById(req.params.id);
  if (!enrollment) {
    return res.status(404).json({ success: false, message: "Enrollment not found" });
  }
  if (enrollment.status === "dropped") {
    return res.status(409).json({ success: false, message: "Cannot issue a certificate for a dropped enrollment" });
  }

  const cls = await ClassModel.findById(enrollment.classId);
  if (!cls) {
    return res.status(404).json({ success: false, message: "Class not found" });
  }
  const isOwner = String(cls.instructor.id) === req.user!.id;
  if (req.user!.role !== "admin" && !isOwner) {
    return res.status(403).json({ success: false, message: "Only the class instructor can issue certificates" });
  }

  const certificateUrl =
    typeof req.body?.certificateUrl === "string" && req.body.certificateUrl.startsWith("https://")
      ? req.body.certificateUrl
      : `${ENV.FRONTEND_URL.replace(/\/+$/, "")}/certificate/${cls.id}?enrollment=${enrollment.id}`;

  enrollment.status = "completed";
  enrollment.completedAt = enrollment.completedAt || new Date();
  enrollment.certificateUrl = certificateUrl;
  enrollment.progress = 100;
  await enrollment.save();

  await NotificationModel.create({
    userId: enrollment.userId,
    type: "achievement",
    title: "Certificate issued",
    message: `Your certificate for ${cls.title} is ready.`,
    read: false,
    actionUrl: `/certificate/${cls.id}`,
  }).catch(() => {});

  return res.json({
    success: true,
    data: { ...enrollment.toObject(), id: enrollment.id },
    message: "Certificate issued",
  });
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const enrollment = await EnrollmentModel.findById(req.params.id);
  if (!enrollment) {
    return res
      .status(404)
      .json({ success: false, message: "Enrollment not found" });
  }

  if (String(enrollment.userId) !== req.user!.id) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  if (enrollment.status !== "dropped") {
    await releaseSeat(String(enrollment.classId));
  }
  enrollment.status = "dropped";
  await enrollment.save();

  return res.json({
    success: true,
    data: null,
    message: "Enrollment dropped",
  });
});

export default router;
