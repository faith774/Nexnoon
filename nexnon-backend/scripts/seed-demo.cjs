// Explicit local setup only; never called by production startup.
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { User } = require('../dist/models/User');
const { ClassScheduleModel } = require('../dist/models/Class');

async function main() {
  const uri = process.env.MONGODB_URI || '';
  if (process.env.NODE_ENV === 'production' || !/^mongodb:\/\/(127\.0\.0\.1|localhost):27017\/nexnoon$/.test(uri)) {
    throw new Error('Demo setup requires the local nexnoon database on port 27017.');
  }
  const file = path.join(__dirname, '../.local-data/demo-accounts.json');
  const accounts = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [
    { email: 'teacher.demo@nexnoon.test', role: 'instructor', firstName: 'Demo', lastName: 'Teacher', password: 'Teach-' + crypto.randomBytes(6).toString('hex') + '!' },
    { email: 'student.demo@nexnoon.test', role: 'student', firstName: 'Demo', lastName: 'Student', password: 'Learn-' + crypto.randomBytes(6).toString('hex') + '!' },
  ];
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  // Check every existing identity before creating anything; never reset a password.
  for (const account of accounts) {
    const existing = await User.findOne({ email: account.email });
    if (existing && (existing.role !== account.role || !(await bcrypt.compare(account.password, existing.password)))) {
      throw new Error(`Existing account ${account.email} does not match the saved demo credentials.`);
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(accounts, null, 2), { mode: 0o600 });
  for (const account of accounts) {
    if (!(await User.exists({ email: account.email }))) await User.create({ ...account,
      fullName: `${account.firstName} ${account.lastName}`, password: await bcrypt.hash(account.password, 12), isEmailVerified: true,
    });
  }
  const request = async (route, token, body, method = body ? 'POST' : 'GET') => {
    const response = await fetch(`http://127.0.0.1:${process.env.PORT || 4000}/v1${route}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(`Demo API request ${route} failed (${response.status})`);
    return result.data;
  };
  const teacher = await request('/auth/login', null, accounts[0]);
  const student = await request('/auth/login', null, accounts[1]);
  const mine = await request('/classes/my', teacher.token);
  const title = 'Build Your First Web Page - Demo Workshop';
  let cls = mine.data.find(c => c.title === title);
  if (!cls) {
    const start = new Date(Date.now() + 7 * 86400000);
    cls = await request('/classes', teacher.token, {
      title, description: 'A free introductory workshop created by the Demo Teacher. Explore the classroom, review the assignment, and try the student and instructor dashboards.',
      category: 'Development', level: 'Beginner', price: 0, duration: 60, totalSessions: 1, status: 'published', language: 'English', maxStudents: 20,
      learningOutcomes: ['Structure a page with HTML', 'Style a page with CSS'], prerequisites: ['A browser and a text editor'],
      materials: ['Workshop notes: Start with a heading, a paragraph, and a link. Add CSS to choose your colors and spacing.'],
      assignments: [{ title: 'Create a personal introduction page', description: 'Write a heading, a short introduction, and a link. Bring your page to the workshop.' }],
      schedule: [],
    });
  }
  if (!(await ClassScheduleModel.exists({ classId: cls.id }))) {
    const start = new Date(Date.now() + 7 * 86400000);
    await ClassScheduleModel.create({ classId: cls.id, sessionNumber: 1, title: 'Your first web page', startTime: start, endTime: new Date(+start + 3600000), status: 'scheduled' });
  }
  if (!cls.details?.overview) {
    await request(`/classes/${cls.id}`, teacher.token, {
      thumbnail: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=80',
      learningOutcomes: ['Write semantic HTML', 'Style a page with CSS', 'Create a responsive layout', 'Use browser developer tools', 'Build a personal introduction page', 'Review and improve your work'],
      prerequisites: ['A laptop or desktop computer', 'A modern browser', 'A text editor', 'No previous coding experience required'],
      details: {
        overview: 'Build a complete personal introduction page from a blank file. This beginner workshop introduces HTML structure, readable typography, spacing, color, and responsive layout.\n\nFollow the instructor through short demonstrations, then practice each technique on your own page. Bring questions and use the project checklist to review your work before the session ends.',
        instructorTitle: 'Web Development Workshop Instructor',
        instructorBio: 'Demo Teacher is the local instructor account for exploring Nexnoon. This workshop demonstrates how teachers publish a complete curriculum, explain prerequisites, share learning outcomes, and manage enrolled students. Sign in with the teacher account to edit these details and see them update here.',
        curriculumIntro: 'Three guided modules within one 60-minute live workshop.',
        curriculum: [
          { title: 'HTML foundations', topics: ['Headings, paragraphs, and links', 'Semantic page structure', 'Accessible image descriptions'], project: 'Create the content for your personal introduction page.' },
          { title: 'Make it your own with CSS', topics: ['Fonts, color, and spacing', 'The box model', 'Reusable CSS classes'], project: 'Style your page with a consistent color palette and readable typography.' },
          { title: 'Responsive design and review', topics: ['Flexible layouts', 'Testing different screen sizes', 'Browser developer tools'], project: 'Finish a page that works on both mobile and desktop.' },
        ],
        outcomes: ['Create an HTML document independently', 'Explain the role of HTML and CSS', 'Adapt a simple layout for mobile screens', 'Use a checklist to review your first web page'],
        certificateInfo: 'This local demonstration workshop does not issue certificates. The preview shows the certificate design; teachers can explain certificate availability and completion requirements here.',
        faqs: [
          { question: 'Do I need coding experience?', answer: 'No. This workshop starts with a blank HTML file and explains each step.' },
          { question: 'What should I prepare?', answer: 'Install a text editor and have a modern browser ready. Bring a short introduction about yourself for the project.' },
          { question: 'Is there a live meeting for this demo?', answer: 'This local demo has a scheduled session but no Zoom meeting attached.' },
          { question: 'Can I edit the workshop?', answer: 'Yes. Sign in as Demo Teacher, open My Classes, and choose Edit Class. Full Class Details is in the Content step.' },
        ],
      },
    }, 'PATCH');
  }
  
  await request('/enrollments', student.token, { classId: cls.id });
  const classroom = await request(`/data/class/${cls.id}`, student.token);
  const dashboard = await request('/data/instructor', teacher.token);
  if (!classroom.enrollment || !dashboard.classes.some(c => c.id === cls.id || c._id === cls.id)) throw new Error('Demo verification failed.');
  console.log('Verified both logins, teacher dashboard, and enrolled student classroom.');
  console.log('Local credentials saved in .local-data/demo-accounts.json (gitignored).');
  console.log('Demo class: ' + cls.id);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
