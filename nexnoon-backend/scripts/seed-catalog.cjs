const path = require('node:path');
const fs = require('node:fs');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { ClassModel, ClassScheduleModel } = require('../dist/models/Class');
const catalog = require('./demo-catalog.cjs');

async function main() {
  const uri = process.env.MONGODB_URI || '';
  if (process.env.NODE_ENV === 'production' || !/^mongodb:\/\/(127\.0\.0\.1|localhost):27017\/nexnoon$/.test(uri)) throw new Error('This command only seeds the local nexnoon database.');
  const accounts = JSON.parse(fs.readFileSync(path.join(__dirname, '../.local-data/demo-accounts.json'), 'utf8'));
  const request = async (route, token, body) => {
    const response = await fetch(`http://127.0.0.1:${process.env.PORT || 4000}/v1${route}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error(`Request ${route} failed (${response.status})`);
    return (await response.json()).data;
  };
  const teacher = await request('/auth/login', null, accounts.find(a => a.role === 'instructor'));
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  let created = 0;
  for (const [index, course] of catalog.entries()) {
    let cls = await ClassModel.findOne({ title: course.title, 'instructor.id': teacher.user.id });
    const startDate = new Date(Date.now() + (8 + index) * 86400000);
    if (!cls) {
      // Stay under the create-class rate limit (10/min) during local seeding.
      await new Promise(r => setTimeout(r, 7000));
      const result = await request('/classes', teacher.token, { ...course, startDate: startDate.toISOString(), schedule: [] });
      cls = await ClassModel.findById(result.id);
      created++;
    }
    for (let i = 0; i < 3; i++) {
      await ClassScheduleModel.updateOne({ classId: cls._id, sessionNumber: i + 1 }, { $setOnInsert: {
        title: course.details.curriculum[i].title, description: course.details.curriculum[i].topics.join('\n'),
        startTime: new Date(+new Date(cls.startDate) + i * 7 * 86400000), endTime: new Date(+new Date(cls.startDate) + i * 7 * 86400000 + 3600000), status: 'scheduled',
      } }, { upsert: true });
    }
    const detail = await request(`/classes/${cls.id}`);
    if (detail.details.curriculum.length !== 3 || detail.schedule.length !== 3 || !detail.details.overview) throw new Error(`Incomplete course: ${course.title}`);
  }
  const published = await request('/classes?pageSize=100');
  console.log(`Created ${created} courses. Verified all 16 full detail pages and schedules. Published catalogue total: ${published.pagination.totalItems}.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
