// Explicit one-time copy of only the local demo teacher/student and their data.
const path = require('node:path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env.deploy.local') });
const emails = ['teacher.demo@nexnoon.test', 'student.demo@nexnoon.test'];
let source, target;
async function main() {
  const uri = process.env.ATLAS_DEMO_URI || '';
  if (!process.argv.includes('--confirm-demo-import') || !/^mongodb\+srv:\/\/[^/]+\/nexnoon_demo(?:\?|$)/.test(uri)) {
    throw new Error('Set ATLAS_DEMO_URI to the Atlas nexnoon_demo database in .env.deploy.local and pass --confirm-demo-import.');
  }
  source = await mongoose.createConnection('mongodb://127.0.0.1:27017/nexnoon', { serverSelectionTimeoutMS: 10000 }).asPromise();
  target = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 15000 }).asPromise();
  const users = await source.collection('users').find({ email: { $in: emails } }).toArray();
  if (users.length !== 2) throw new Error('Create the local demo accounts first.');
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
    ['classes', classes],
    ['classschedules', await source.collection('classschedules').find({ classId: { $in: classIds } }).toArray()],
    ['enrollments', await source.collection('enrollments').find({ classId: { $in: classIds }, userId: { $in: userIds } }).toArray()],
  ];
  for (const [name, documents] of groups) {
    for (const doc of documents) await target.collection(name).updateOne({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true });
    console.log(`${name}: verified ${documents.length} demo records (existing records preserved).`);
  }
  console.log('Demo import complete. Point Render MONGODB_URI at this same nexnoon_demo database.');
}
main().catch(error => { console.error(error.name === 'Error' ? error.message : 'Atlas import failed. Check database connectivity and credentials.'); process.exitCode = 1; }).finally(async () => { await source?.close(); await target?.close(); });
