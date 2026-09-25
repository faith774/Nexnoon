// Explicit one-time copy of the local demo admin/teacher/student, their classes and the course catalogue.
const path = require('node:path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env.deploy.local') });
const emails = ['admin.demo@nexnoon.test', 'teacher.demo@nexnoon.test', 'student.demo@nexnoon.test'];
let source, target;
async function main() {
  const uri = process.env.ATLAS_DEMO_URI || '';
  if (!process.argv.includes('--confirm-demo-import') || !/^mongodb\+srv:\/\/[^/]+\/[\w-]+(?:\?|$)/.test(uri)) {
    throw new Error('Set ATLAS_DEMO_URI to the Atlas database (same value as Render MONGODB_URI) in .env.deploy.local and pass --confirm-demo-import.');
  }
  source = await mongoose.createConnection('mongodb://127.0.0.1:27017/nexnoon', { serverSelectionTimeoutMS: 10000 }).asPromise();
  target = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 15000 }).asPromise();
  const users = await source.collection('users').find({ email: { $in: emails } }).toArray();
  if (users.length !== emails.length) throw new Error('Create the local demo accounts first (npm run seed:demo).');
  const teacher = users.find(u => u.role === 'instructor');
  if (!teacher) throw new Error('Demo teacher missing.');
  // Preflight identities so a rerun cannot replace someone else with a demo account.
  for (const user of users) {
    const conflict = await target.collection('users').findOne({ $or: [{ email: user.email }, { _id: user._id }] });
    if (conflict && (String(conflict._id) !== String(user._id) || conflict.email !== user.email || conflict.password !== user.password || conflict.role !== user.role)) throw new Error('An existing Atlas identity conflicts with a local demo account. No import performed.');
  }
  const classes = await source.collection('classes').find({ 'instructor.id': teacher._id }).toArray();
  const classIds = classes.map(c => c._id);
  const userIds = users.map(u => u._id);
  const groups = [
    ['users', users.map(({ resetPasswordToken, resetPasswordExpires, emailVerificationToken, ...user }) => user)],
    ['platformsettings', await source.collection('platformsettings').find({}).toArray()],
    ['courses', await source.collection('courses').find({}).toArray()],
    ['classes', classes],
    ['classschedules', await source.collection('classschedules').find({ classId: { $in: classIds } }).toArray()],
    ['enrollments', await source.collection('enrollments').find({ classId: { $in: classIds }, userId: { $in: userIds } }).toArray()],
    ['attendancerecords', await source.collection('attendancerecords').find({ classId: { $in: classIds }, userId: { $in: userIds } }).toArray()],
  ];
  const matchOn = { platformsettings: 'key', courses: 'slug' };
  for (const [name, documents] of groups) {
    const field = matchOn[name];
    for (const doc of documents) {
      const filter = field ? { [field]: doc[field] } : { _id: doc._id };
      await target.collection(name).updateOne(filter, { $setOnInsert: doc }, { upsert: true });
    }
    console.log(`${name}: verified ${documents.length} demo records (existing records preserved).`);
  }
  console.log(`Demo import complete into "${target.name}".`);
}
main().catch(error => { console.error(error.name === 'Error' ? error.message : 'Atlas import failed. Check database connectivity and credentials.'); process.exitCode = 1; }).finally(async () => { await source?.close(); await target?.close(); });
