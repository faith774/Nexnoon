import mongoose, { Document, Schema, Types } from 'mongoose';

export type CourseStatus = 'draft' | 'published' | 'archived';
export type LanguageOfferingStatus = 'active' | 'inactive';

export interface ILanguageOffering {
  _id: Types.ObjectId;
  /** BCP-47-ish short code, e.g. en, es, fr */
  code: string;
  /** Display label, e.g. English */
  label: string;
  status: LanguageOfferingStatus;
}

export interface ICourse extends Document {
  title: string;
  slug: string;
  description: string;
  /** Learning outcomes shown on the official course page. */
  outcomes: string[];
  /** Optional curriculum outline template for instructors. */
  curriculumTemplate: { id: string; title: string; description?: string }[];
  /** Platform-owned trailer / preview URL (not per-instructor). */
  officialPreviewUrl?: string;
  certificateNotes?: string;
  category?: string;
  /** Localized delivery options under this course. */
  languageOfferings: ILanguageOffering[];
  /** Price band (USD) instructors may choose within. Free classes always need admin approval. */
  pricing?: { minPrice?: number; maxPrice?: number };
  status: CourseStatus;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const LanguageOfferingSchema = new Schema<ILanguageOffering>(
  {
    code: { type: String, required: true, trim: true, lowercase: true, maxlength: 16 },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { _id: true }
);

const CourseSchema = new Schema<ICourse>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true, trim: true },
    outcomes: { type: [String], default: [] },
    curriculumTemplate: {
      type: [
        {
          id: { type: String, required: true },
          title: { type: String, required: true },
          description: { type: String },
        },
      ],
      default: [],
    },
    officialPreviewUrl: { type: String },
    certificateNotes: { type: String },
    category: { type: String },
    languageOfferings: { type: [LanguageOfferingSchema], default: [] },
    pricing: {
      minPrice: { type: Number, min: 0 },
      maxPrice: { type: Number, min: 0 },
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

CourseSchema.pre('validate', function (next) {
  if (!this.slug && this.title) {
    this.slug = `${slugify(this.title)}-${Date.now().toString(36)}`;
  }
  next();
});

export const CourseModel = mongoose.model<ICourse>('Course', CourseSchema);

export function toLanguageOfferingDto(doc: any) {
  return {
    id: String(doc._id),
    code: doc.code,
    label: doc.label,
    status: doc.status || 'active',
  };
}

export function toCourseDto(doc: any) {
  return {
    id: String(doc._id),
    title: doc.title,
    slug: doc.slug,
    description: doc.description,
    outcomes: doc.outcomes || [],
    curriculumTemplate: doc.curriculumTemplate || [],
    officialPreviewUrl: doc.officialPreviewUrl || '',
    certificateNotes: doc.certificateNotes || '',
    category: doc.category || '',
    languageOfferings: (doc.languageOfferings || []).map(toLanguageOfferingDto),
    pricing: {
      minPrice: doc.pricing?.minPrice ?? null,
      maxPrice: doc.pricing?.maxPrice ?? null,
    },
    status: doc.status,
    createdBy: doc.createdBy ? String(doc.createdBy) : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export { slugify };
