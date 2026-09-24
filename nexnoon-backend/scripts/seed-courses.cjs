/**
 * Seed a few official Course documents with language offerings for local demo.
 * Usage (backend running + compiled dist optional — uses mongoose models via ts-node/require dist):
 *   node scripts/seed-courses.cjs
 */
const path = require('node:path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function main() {
  const uri = process.env.MONGODB_URI || '';
  if (
    process.env.NODE_ENV === 'production' ||
    !/^mongodb:\/\/(127\.0\.0\.1|localhost):27017\/nexnoon$/.test(uri)
  ) {
    throw new Error('This command only seeds the local nexnoon database.');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });

  // Prefer compiled models when available
  let CourseModel;
  let User;
  try {
    CourseModel = require('../dist/models/Course').CourseModel;
    User = require('../dist/models/User').User;
  } catch {
    throw new Error('Build the backend first (npm run build) so dist/models exist.');
  }

  const admin = await User.findOne({ role: 'admin' });
  if (!admin) throw new Error('No admin user found — create one before seeding courses.');

  const seeds = [
    {
      title: 'Product Design Foundations',
      slug: 'product-design-foundations',
      description:
        'A standardized live course covering research, critique, and portfolio-ready design craft.',
      category: 'Design',
      outcomes: [
        'Run structured critiques',
        'Ship a portfolio case study',
        'Facilitate learner feedback loops',
      ],
      certificateNotes: 'Certificate issued after cohort completion and attendance requirements.',
      officialPreviewUrl: '',
      languageOfferings: [
        { code: 'en', label: 'English', status: 'active' },
        { code: 'es', label: 'Spanish', status: 'active' },
      ],
    },
    {
      title: 'Full-Stack Web Development',
      slug: 'full-stack-web-development',
      description:
        'Build and ship live full-stack projects with instructor facilitation and peer practice.',
      category: 'Development',
      outcomes: ['Ship a full-stack app', 'Practice code reviews', 'Deploy with confidence'],
      certificateNotes: 'Earn a completion certificate after final project review.',
      languageOfferings: [
        { code: 'en', label: 'English', status: 'active' },
        { code: 'fr', label: 'French', status: 'active' },
      ],
    },
    {
      title: 'Data Analysis with Spreadsheets',
      slug: 'data-analysis-with-spreadsheets',
      description:
        'Practical analysis, storytelling with data, and cohort exercises in live sessions.',
      category: 'Data Science',
      outcomes: ['Clean and model tabular data', 'Build decision-ready dashboards', 'Present insights live'],
      certificateNotes: 'Certificate after final presentation.',
      languageOfferings: [
        { code: 'en', label: 'English', status: 'active' },
        { code: 'hi', label: 'Hindi', status: 'active' },
      ],
    },
  ];

  let created = 0;
  for (const seed of seeds) {
    const existing = await CourseModel.findOne({ slug: seed.slug });
    if (existing) {
      existing.title = seed.title;
      existing.description = seed.description;
      existing.category = seed.category;
      existing.outcomes = seed.outcomes;
      existing.certificateNotes = seed.certificateNotes;
      existing.status = 'published';
      if (!(existing.languageOfferings || []).length) {
        existing.languageOfferings = seed.languageOfferings;
      }
      await existing.save();
      continue;
    }
    await CourseModel.create({
      ...seed,
      status: 'published',
      curriculumTemplate: [],
      createdBy: admin._id,
    });
    created += 1;
  }

  // Link published classes without courseId to a matching seed by title/category when possible
  const { ClassModel } = require('../dist/models/Class');
  const courses = await CourseModel.find({ status: 'published' });
  let linked = 0;
  for (const course of courses) {
    const offering = (course.languageOfferings || [])[0];
    const classes = await ClassModel.find({
      courseId: { $exists: false },
      status: 'published',
      $or: [{ title: new RegExp(course.title.split(' ')[0], 'i') }, { category: course.category }],
    }).limit(5);
    for (const cls of classes) {
      cls.courseId = course._id;
      if (offering) {
        cls.languageOfferingId = offering._id;
        cls.language = offering.label;
      }
      await cls.save();
      linked += 1;
    }
  }

  console.log(`Courses created: ${created}. Classes linked: ${linked}.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
