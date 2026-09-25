import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { CourseModel, slugify, toCourseDto } from '../models/Course';
import { ClassModel, ClassScheduleModel } from '../models/Class';
import { notEndedFilter } from '../utils/seats';
import { getMaxClassSeats } from '../models/PlatformSettings';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

const languageOfferingSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(16)
    .regex(/^[a-z]{2,3}(?:-[a-z0-9]+)?$/i),
  label: z.string().min(2).max(80),
  status: z.enum(['active', 'inactive']).optional(),
});

const courseBodySchema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().min(10).max(8000),
  outcomes: z.array(z.string().min(1).max(300)).max(20).optional(),
  curriculumTemplate: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
      })
    )
    .max(40)
    .optional(),
  officialPreviewUrl: z.string().url().or(z.literal('')).optional(),
  certificateNotes: z.string().max(2000).optional(),
  category: z.string().max(80).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  languageOfferings: z.array(languageOfferingSchema).max(40).optional(),
  pricing: z
    .object({
      minPrice: z.number().min(0).max(100000).nullable().optional(),
      maxPrice: z.number().min(0).max(100000).nullable().optional(),
    })
    .refine((p) => p.minPrice == null || p.maxPrice == null || p.minPrice <= p.maxPrice, 'Minimum price cannot exceed the maximum')
    .optional(),
});

function normalizePricing(p?: { minPrice?: number | null; maxPrice?: number | null }) {
  if (!p) return undefined;
  return { minPrice: p.minPrice ?? undefined, maxPrice: p.maxPrice ?? undefined };
}

function classCardDto(cls: any, seatCap: number) {
  const max = seatCap;
  const enrolled = cls.enrolledStudents || 0;
  const taken = enrolled + (cls.heldSeats || 0);
  return {
    id: String(cls._id),
    title: cls.title,
    description: cls.description,
    category: cls.category,
    level: cls.level,
    price: cls.price,
    currency: cls.currency || 'USD',
    language: cls.language || '',
    courseId: cls.courseId ? String(cls.courseId) : undefined,
    languageOfferingId: cls.languageOfferingId ? String(cls.languageOfferingId) : undefined,
    thumbnail: cls.thumbnail || '',
    duration: cls.duration,
    startDate: cls.startDate,
    enrolledStudents: enrolled,
    maxStudents: max,
    seatsLeft: Math.max(0, max - taken),
    fillRate: max > 0 ? Math.round((enrolled / max) * 100) : 0,
    rating: cls.rating || 0,
    instructor: cls.instructor
      ? {
          id: cls.instructor.id ? String(cls.instructor.id) : undefined,
          name: cls.instructor.name,
          avatar: cls.instructor.avatar,
        }
      : undefined,
    status: cls.status,
  };
}

/** Public catalog — published courses only (no auth). */
router.get('/catalog', async (_req, res) => {
  const courses = await CourseModel.find({ status: 'published' }).sort({ updatedAt: -1 }).lean();
  return res.json({ success: true, data: courses.map(toCourseDto) });
});

/**
 * Public marketplace page payload by slug:
 * course + language offerings + published class cards.
 */
router.get('/by-slug/:slug', async (req, res) => {
  const slug = String(req.params.slug || '')
    .toLowerCase()
    .trim();
  if (!slug) {
    return res.status(400).json({ success: false, message: 'Invalid slug' });
  }

  const course = await CourseModel.findOne({ slug, status: 'published' }).lean();
  if (!course) {
    return res.status(404).json({ success: false, message: 'Course not found' });
  }

  const seatCap = await getMaxClassSeats();
  const classes = await ClassModel.find({
    courseId: course._id,
    status: 'published',
    ...(await notEndedFilter()),
  })
    .sort({ startDate: 1, createdAt: -1 })
    .lean();

  const languageFilter = String(req.query.language || '').trim().toLowerCase();
  let filtered = classes;
  if (languageFilter) {
    const offeringIds = (course.languageOfferings || [])
      .filter(
        (o: any) =>
          o.status !== 'inactive' &&
          (String(o.code).toLowerCase() === languageFilter ||
            String(o.label).toLowerCase() === languageFilter ||
            String(o._id) === languageFilter)
      )
      .map((o: any) => String(o._id));
    filtered = classes.filter((c: any) => {
      if (c.languageOfferingId && offeringIds.includes(String(c.languageOfferingId))) return true;
      const lang = String(c.language || '').toLowerCase();
      return lang === languageFilter || offeringIds.length === 0;
    });
  }

  // Best fit first: classes with seats, then soonest upcoming session.
  const now = new Date();
  const nextStart = new Map<string, number>();
  const firstUpcoming = await ClassScheduleModel.aggregate([
    { $match: { classId: { $in: filtered.map((c: any) => c._id) }, status: { $ne: 'cancelled' }, endTime: { $gt: now } } },
    { $group: { _id: '$classId', start: { $min: '$startTime' } } },
  ]);
  for (const row of firstUpcoming) nextStart.set(String(row._id), new Date(row.start).getTime());
  const cards = filtered
    .map((c: any) => ({ ...classCardDto(c, seatCap), startDate: nextStart.has(String(c._id)) ? new Date(nextStart.get(String(c._id))!) : c.startDate }))
    .sort((a, b) => {
      const af = a.seatsLeft > 0 ? 0 : 1;
      const bf = b.seatsLeft > 0 ? 0 : 1;
      if (af !== bf) return af - bf;
      const at = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const bt = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      return at - bt;
    });

  return res.json({
    success: true,
    data: {
      course: toCourseDto(course),
      classes: cards,
      seatCap,
    },
  });
});

/** Auth list (admins see all; others see published). */
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const isAdmin = req.user!.role === 'admin';
  const filter = isAdmin ? {} : { status: 'published' };
  const courses = await CourseModel.find(filter).sort({ updatedAt: -1 }).lean();
  return res.json({ success: true, data: courses.map(toCourseDto) });
});

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid course ID' });
  }
  const course = await CourseModel.findById(req.params.id).lean();
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  if (course.status !== 'published' && req.user!.role !== 'admin') {
    return res.status(404).json({ success: false, message: 'Course not found' });
  }
  return res.json({ success: true, data: toCourseDto(course) });
});

router.post('/', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  const parsed = courseBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Invalid course payload',
    });
  }

  const baseSlug = parsed.data.slug || slugify(parsed.data.title);
  let slug = baseSlug;
  let n = 0;
  while (await CourseModel.exists({ slug })) {
    n += 1;
    slug = `${baseSlug}-${n}`;
  }

  const languageOfferings = (parsed.data.languageOfferings || []).map((o) => ({
    code: o.code.toLowerCase(),
    label: o.label.trim(),
    status: o.status || 'active',
  }));

  const course = await CourseModel.create({
    ...parsed.data,
    slug,
    outcomes: parsed.data.outcomes || [],
    curriculumTemplate: parsed.data.curriculumTemplate || [],
    officialPreviewUrl: parsed.data.officialPreviewUrl || undefined,
    languageOfferings,
    pricing: normalizePricing(parsed.data.pricing),
    status: parsed.data.status || 'draft',
    createdBy: req.user!.id,
  });

  return res.status(201).json({
    success: true,
    data: toCourseDto(course),
    message: 'Course created',
  });
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid course ID' });
  }
  const parsed = courseBodySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Invalid course payload',
    });
  }

  const course = await CourseModel.findById(req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

  if (parsed.data.slug && parsed.data.slug !== course.slug) {
    const taken = await CourseModel.exists({ slug: parsed.data.slug, _id: { $ne: course._id } });
    if (taken) {
      return res.status(409).json({ success: false, message: 'Slug already in use' });
    }
    course.slug = parsed.data.slug;
  }

  if (parsed.data.title !== undefined) course.title = parsed.data.title;
  if (parsed.data.description !== undefined) course.description = parsed.data.description;
  if (parsed.data.outcomes !== undefined) course.outcomes = parsed.data.outcomes;
  if (parsed.data.curriculumTemplate !== undefined) {
    course.curriculumTemplate = parsed.data.curriculumTemplate;
  }
  if (parsed.data.officialPreviewUrl !== undefined) {
    course.officialPreviewUrl = parsed.data.officialPreviewUrl || undefined;
  }
  if (parsed.data.certificateNotes !== undefined) {
    course.certificateNotes = parsed.data.certificateNotes;
  }
  if (parsed.data.category !== undefined) course.category = parsed.data.category;
  if (parsed.data.pricing !== undefined) course.pricing = normalizePricing(parsed.data.pricing);
  if (parsed.data.status !== undefined) course.status = parsed.data.status;
  if (parsed.data.languageOfferings !== undefined) {
    // Replace offerings while preserving ids when client sends them via nested PATCH endpoints.
    course.languageOfferings = parsed.data.languageOfferings.map((o) => ({
      code: o.code.toLowerCase(),
      label: o.label.trim(),
      status: o.status || 'active',
    })) as any;
  }

  await course.save();
  return res.json({ success: true, data: toCourseDto(course), message: 'Course updated' });
});

/** Add a language offering under a course. */
router.post('/:id/languages', requireAuth, requireRole('admin'), async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid course ID' });
  }
  const parsed = languageOfferingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Invalid language offering',
    });
  }

  const course = await CourseModel.findById(req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

  const code = parsed.data.code.toLowerCase();
  const exists = course.languageOfferings.some((o) => o.code === code);
  if (exists) {
    return res.status(409).json({ success: false, message: 'Language already added to this course' });
  }

  course.languageOfferings.push({
    code,
    label: parsed.data.label.trim(),
    status: parsed.data.status || 'active',
  } as any);
  await course.save();

  return res.status(201).json({
    success: true,
    data: toCourseDto(course),
    message: 'Language offering added',
  });
});

/** Update / deactivate a language offering. */
router.patch('/:id/languages/:offeringId', requireAuth, requireRole('admin'), async (req, res) => {
  if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.offeringId)) {
    return res.status(400).json({ success: false, message: 'Invalid ID' });
  }
  const parsed = languageOfferingSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Invalid language offering',
    });
  }

  const course = await CourseModel.findById(req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

  const offering = (course.languageOfferings || []).find(
    (o) => String(o._id) === req.params.offeringId
  );
  if (!offering) {
    return res.status(404).json({ success: false, message: 'Language offering not found' });
  }

  if (parsed.data.code !== undefined) offering.code = parsed.data.code.toLowerCase();
  if (parsed.data.label !== undefined) offering.label = parsed.data.label.trim();
  if (parsed.data.status !== undefined) offering.status = parsed.data.status;
  await course.save();

  return res.json({ success: true, data: toCourseDto(course), message: 'Language offering updated' });
});

/** Soft-archive (preferred over hard delete). */
router.post('/:id/archive', requireAuth, requireRole('admin'), async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid course ID' });
  }
  const course = await CourseModel.findByIdAndUpdate(
    req.params.id,
    { $set: { status: 'archived' } },
    { new: true }
  );
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  return res.json({ success: true, data: toCourseDto(course), message: 'Course archived' });
});

export default router;
