// Explicit authenticated publication to the user's deployed API. No remote DB credentials.
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
let source;
async function main() {
  if (!process.argv.includes('--confirm-live-demo')) throw new Error('Pass --confirm-live-demo to publish the local demo to nexnoon-backend.onrender.com.');
  const accounts = JSON.parse(fs.readFileSync(path.join(__dirname, '../.local-data/demo-accounts.json'), 'utf8'));
  const base = 'https://nexnoon-backend.onrender.com/v1';
  const request = async (route, token, body, method = body ? 'POST' : 'GET') => {
    const response = await fetch(base + route, { method, signal: AbortSignal.timeout(60000), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    return { status: response.status, data: result.data };
  };
  const auth = [];
  for (const account of accounts) {
    let login = await request('/auth/login', null, { email: account.email, password: account.password });
    if (login.status === 401) {
      await request('/auth/signup', null, account);
      login = await request('/auth/login', null, { email: account.email, password: account.password });
    }
    if (login.status !== 200 || login.data.user.role !== account.role) throw new Error(`Cannot verify demo account ${account.email}; no password resets performed.`);
    auth.push(login.data);
    console.log(`Verified live ${account.role} login.`);
  }
  const teacher = auth.find(a => a.user.role === 'instructor');
  const student = auth.find(a => a.user.role === 'student');
  source = await mongoose.createConnection('mongodb://127.0.0.1:27017/nexnoon', { serverSelectionTimeoutMS: 5000 }).asPromise();
  const localTeacher = await source.collection('users').findOne({ email: teacher.user.email });
  const courses = await source.collection('classes').find({ 'instructor.id': localTeacher._id, status: 'published' }).toArray();
  const mine = await request('/classes/my?pageSize=100', teacher.token);
  if (mine.status !== 200) throw new Error('Cannot read live teacher catalogue.');
  const published = [];
  for (const course of courses) {
    let existing = mine.data.data.find(c => c.title === course.title);
    if (!existing) {
      const { _id, instructor, enrolledStudents, rating, reviewsCount, createdAt, updatedAt, __v, ...body } = course;
      const created = await request('/classes', teacher.token, { ...body, schedule: [] });
      if (created.status !== 201) throw new Error(`Cannot publish ${course.title} (${created.status}).`);
      existing = created.data;
    }
    const schedules = await source.collection('classschedules').find({ classId: course._id }).sort({ sessionNumber: 1 }).toArray();
    const live = await request(`/classes/${existing.id}/schedule`);
    if (live.status !== 200) throw new Error('Cannot read live schedule.');
    for (const session of schedules) {
      if (live.data.some(s => s.sessionNumber === session.sessionNumber)) continue;
      const result = await request(`/classes/${existing.id}/schedule`, teacher.token, {
        sessionNumber: session.sessionNumber, title: session.title, description: session.description,
        startTime: session.startTime.toISOString(), endTime: session.endTime.toISOString(),
      });
      if (result.status !== 201) throw new Error(`Schedule publication failed for ${course.title} (${result.status}). Class data is preserved; rerun resumes.`);
    }
    const detail = await request(`/classes/${existing.id}`);
    if (detail.status !== 200 || !detail.data.details?.overview || detail.data.schedule.length !== schedules.length) throw new Error('Live detail verification failed.');
    published.push(existing);
    console.log(`Verified: ${course.title}`);
  }
  const workshop = published.find(c => c.title === 'Build Your First Web Page - Demo Workshop');
  const enrollment = await request('/enrollments', student.token, { classId: workshop.id });
  if (![200, 201].includes(enrollment.status)) throw new Error('Student enrollment failed.');
  const workspace = await request(`/data/class/${workshop.id}`, student.token);
  const dashboard = await request('/data/instructor', teacher.token);
  if (!workspace.data?.enrollment || !dashboard.data?.classes || dashboard.data.classes.length < courses.length) throw new Error('Live account workflow verification failed.');
  console.log(`LIVE VERIFIED: ${published.length} courses, both demo logins, teacher dashboard, and enrolled student classroom.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => source?.close());
