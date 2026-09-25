// Explicit one-off: make the single catalogue course cover every class and offer the platform languages.
// Usage: node scripts/link-classes-to-course.cjs --local | --atlas   (atlas reads ATLAS_DEMO_URI from .env.deploy.local)
const path = require('node:path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env.deploy.local') });

const OLD_SLUG = 'product-design';
const COURSE = {
  title: 'Nexnoon Live Classes',
  slug: 'nexnoon-live-classes',
  category: 'General',
  description: 'Live, small-group classes across development, design, business, marketing, music, photography, data and languages, taught by certified Nexnoon instructors.',
};
const LANGUAGES = [
  ['en', 'English'],
  ['fr', 'French'],
  ['es', 'Spanish'],
  ['pt', 'Portuguese'],
  ['yo', 'Yoruba'],
  ['ar', 'Arabic'],
  ['ha', 'Hausa'],
];
const TEACHER_EMAIL = 'teacher.demo@nexnoon.test';
const ADMIN_EMAIL = 'admin.demo@nexnoon.test';

async function main() {
  const atlas = process.argv.includes('--atlas');
  if (!atlas && !process.argv.includes('--local')) throw new Error('Pass --local or --atlas.');
  const uri = atlas ? process.env.ATLAS_DEMO_URI : 'mongodb://127.0.0.1:27017/nexnoon';
  if (!uri) throw new Error('Set ATLAS_DEMO_URI in .env.deploy.local.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  const courses = db.collection('courses');

  const course = (await courses.findOne({ slug: COURSE.slug })) || (await courses.findOne({ slug: OLD_SLUG }));
  if (!course) throw new Error(`No course with slug "${OLD_SLUG}" or "${COURSE.slug}" in ${db.databaseName}.`);
  if (course.slug !== COURSE.slug && (await courses.findOne({ slug: COURSE.slug, _id: { $ne: course._id } }))) {
    throw new Error(`Another course already uses the slug "${COURSE.slug}".`);
  }

  const offerings = [...(course.languageOfferings || [])];
  for (const [code, label] of LANGUAGES) {
    if (!offerings.some((o) => o.code === code)) offerings.push({ _id: new mongoose.Types.ObjectId(), code, label, status: 'active' });
  }
  await courses.updateOne(
    { _id: course._id },
    { $set: { ...COURSE, status: 'published', languageOfferings: offerings, updatedAt: new Date() } }
  );

  const offeringFor = (language) =>
    offerings.find((o) => o.label.toLowerCase() === String(language || '').trim().toLowerCase()) || offerings.find((o) => o.code === 'en');
  const classes = await db.collection('classes').find({}, { projection: { language: 1 } }).toArray();
  for (const cls of classes) {
    await db.collection('classes').updateOne(
      { _id: cls._id },
      { $set: { courseId: course._id, languageOfferingId: offeringFor(cls.language)._id } }
    );
  }

  const admin = await db.collection('users').findOne({ email: ADMIN_EMAIL }, { projection: { _id: 1 } });
  const teacher = await db.collection('users').findOne({ email: TEACHER_EMAIL }, { projection: { certifications: 1 } });
  let certified = false;
  if (teacher) {
    const has = (teacher.certifications || []).some((c) => String(c.courseId) === String(course._id) && !c.languageOfferingId && c.status === 'active');
    if (!has) {
      await db.collection('users').updateOne(
        { _id: teacher._id },
        {
          $push: { certifications: { _id: new mongoose.Types.ObjectId(), courseId: course._id, status: 'active', certifiedAt: new Date(), ...(admin ? { certifiedBy: admin._id } : {}), note: 'Demo teacher: all languages' } },
          $addToSet: { approvedCourseIds: course._id },
        }
      );
    }
    certified = true;
  }

  console.log(`[${db.databaseName}] Course "${COURSE.title}" (/${COURSE.slug}) languages: ${offerings.map((o) => o.label).join(', ')}`);
  console.log(`[${db.databaseName}] Linked ${classes.length} classes to the course.`);
  console.log(`[${db.databaseName}] Demo teacher certified for every language: ${certified ? 'yes' : 'teacher not found'}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
