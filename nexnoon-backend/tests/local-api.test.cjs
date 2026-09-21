const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

// Never reads the configured Atlas URI or writes to the application's database.
const database = `nexnoon_integration_${crypto.randomBytes(8).toString('hex')}`;
Object.assign(process.env, {
  NODE_ENV: 'test', MONGODB_URI: `mongodb://127.0.0.1:27017/${database}`,
  JWT_ACCESS_SECRET: crypto.randomBytes(32).toString('hex'),
  JWT_REFRESH_SECRET: crypto.randomBytes(32).toString('hex'),
  SMTP_HOST: '', SMTP_USER: '', STRIPE_SECRET_KEY: '',
  ZOOM_ACCOUNT_ID: '', ZOOM_CLIENT_ID: '', ZOOM_CLIENT_SECRET: '',
  ZOOM_MEETING_SDK_CLIENT_ID: 'test_meeting_sdk_client_id',
  ZOOM_MEETING_SDK_CLIENT_SECRET: 'test_meeting_sdk_client_secret',
});
const app = require('../dist/app').default;

test('local instructor and student workflows use persisted backend data', async t => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.syncIndexes();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, database);
    assert.match(database, /^nexnoon_integration_[a-f0-9]{16}$/);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const request = async (path, { method = 'GET', token, body } = {}) => {
    const response = await fetch(base + path, { method, headers: {
      'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const signup = async (name, role) => {
    const result = await request('/v1/auth/signup', { method: 'POST', body: {
      firstName: name, lastName: 'Test', email: `${name.toLowerCase()}@example.invalid`, password: 'Local-test-password-2026!', role,
    } });
    assert.equal(result.status, 201);
    return result.body.data;
  };
  let instructor, other, student, classId;
  await t.test('database health and empty catalogue', async () => {
    assert.equal((await request('/health')).status, 200);
    assert.equal((await request('/v1/classes')).body.data.pagination.totalItems, 0);
  });
  await t.test('signup, login and profile persist', async () => {
    instructor = await signup('Instructor', 'instructor');
    other = await signup('Other', 'instructor');
    student = await signup('Student', 'student');
    const login = await request('/v1/auth/login', { method: 'POST', body: { email: 'student@example.invalid', password: 'Local-test-password-2026!' } });
    assert.equal(login.status, 200);
    assert.equal(login.body.data.user.id, student.user.id);
    assert.equal((await request('/v1/auth/me', { token: student.token })).body.data.email, 'student@example.invalid');
  });
  await t.test('publishing retains instructor details and content', async () => {
    const created = await request('/v1/classes', { method: 'POST', token: instructor.token, body: {
      title: 'Backend Integration Class', description: 'An instructor-created test class.', category: 'Development',
      level: 'Beginner', price: 0, duration: 60, totalSessions: 1, status: 'published',
      details: { overview: 'Full overview', instructorBio: 'Instructor biography', curriculum: [{ title: 'Module one', topics: ['Topic one'], project: 'Build a page' }], faqs: [{ question: 'What do I need?', answer: 'A browser' }] },
      learningOutcomes: ['Read persisted data'], prerequisites: ['A browser'], materials: ['Instructor notes'],
      schedule: [{ sessionNumber: 1, title: 'First Session', startTime: '2027-01-01T10:00:00.000Z', endTime: '2027-01-01T11:00:00.000Z' }],
    } });
    assert.equal(created.status, 201);
    classId = created.body.data.id;
    assert.match(classId, /^[a-f0-9]{24}$/);
    assert.equal(created.body.data.instructor.name, 'Instructor Test');
    const detail = (await request(`/v1/classes/${classId}`)).body.data;
    assert.equal(detail.details.overview, 'Full overview');
    assert.equal(detail.details.curriculum[0].project, 'Build a page');
    assert.equal(detail.details.faqs[0].answer, 'A browser');
    assert.deepEqual(detail.materials, ['Instructor notes']);
    assert.equal(detail.schedule.length, 1);
    assert.equal(detail.schedule[0].zoomPasscode, undefined);
  });
  await t.test('search, category lists and category counts use saved classes', async () => {
    assert.equal((await request('/v1/classes/search?q=Integration')).body.data.pagination.totalItems, 1);
    assert.equal((await request('/v1/classes/category/development')).body.data.data[0].id, classId);
    assert.equal((await request('/v1/data/categories')).body.data[0].count, 1);
    assert.equal((await request('/v1/classes/my', { token: instructor.token })).body.data.data[0].id, classId);
  });
  await t.test('class edits enforce ownership and persist', async () => {
    assert.equal((await request(`/v1/classes/${classId}`, { method: 'PATCH', token: other.token, body: { title: 'Hijacked' } })).status, 403);
    assert.equal((await request(`/v1/classes/${classId}`, { method: 'PATCH', token: instructor.token, body: { title: 'Updated Integration Class', details: { overview: 'Updated full overview', faqs: [] } } })).status, 200);
    assert.equal((await request(`/v1/classes/${classId}`)).body.data.title, 'Updated Integration Class');
    assert.equal((await request(`/v1/classes/${classId}`)).body.data.details.overview, 'Updated full overview');
    assert.deepEqual((await request(`/v1/classes/${classId}`)).body.data.details.faqs, []);
    assert.equal((await request(`/v1/data/class/${classId}`, { token: student.token })).status, 403);
  });
  await t.test('free enrollment is persisted and repeated requests do not duplicate it', async () => {
    const enroll = () => request('/v1/enrollments', { method: 'POST', token: student.token, body: { classId } });
    assert.equal((await enroll()).status, 201);
    assert.equal((await enroll()).status, 200);
    const mine = (await request('/v1/enrollments/my', { token: student.token })).body.data;
    assert.equal(mine.pagination.totalItems, 1);
    assert.ok(mine.data[0].id);
    assert.equal((await request(`/v1/classes/${classId}`)).body.data.enrolledStudents, 1);
    const classroom = await request(`/v1/data/class/${classId}`, { token: student.token });
    assert.equal(classroom.status, 200);
    assert.equal(classroom.body.data.sessions[0].zoomLink, '');
    assert.equal(classroom.body.data.enrollment.progress, 0);
  });
  await t.test('dashboard and notifications reflect actual enrollment', async () => {
    const dashboard = (await request('/v1/data/instructor', { token: instructor.token })).body.data;
    assert.equal(dashboard.students.length, 1);
    assert.equal(dashboard.students[0].name, 'Student Test');
    assert.equal(dashboard.payments.length, 0);
    assert.equal((await request('/v1/data/admin', { token: student.token })).status, 403);
    assert.equal((await request('/v1/notifications', { token: student.token })).body.data.pagination.totalItems, 1);
  });
  await t.test('paid classes cannot silently simulate payment', async () => {
    await request(`/v1/classes/${classId}`, { method: 'PATCH', token: instructor.token, body: { price: 50 } });
    const blocked = await request('/v1/enrollments', { method: 'POST', token: other.token, body: { classId } });
    assert.equal(blocked.status, 402);
    assert.equal((await request(`/v1/classes/${classId}`)).body.data.enrolledStudents, 1);
  });
  // Fixture setup and every scenario below are sibling `t.test()` calls (2 levels deep,
  // matching every other test in this file). Nesting a third level of `t.test()` inside
  // one of these callbacks hangs indefinitely on this Node runtime (reproduced in isolation
  // with a bare http.createServer and no Mongo/Express involved) - a node:test subtest
  // scheduling issue, not an application bug. Keep this flat.
  let zoomClassId, readySessionId, tooEarlySessionId, configCheckSessionId;
  await t.test('Zoom Meeting SDK fixtures: class, sessions and enrollment', async () => {
    // No real Zoom API calls: meeting IDs below are local fixtures, and the SDK
    // signature is a locally-signed JWT (no network call to Zoom for the signature itself).
    const { ClassModel, ClassScheduleModel } = require('../dist/models/Class');

    const now = Date.now();
    const withinWindowStart = new Date(now + 10 * 60 * 1000); // 10 min out: inside the 15-min join window
    const withinWindowEnd = new Date(withinWindowStart.getTime() + 60 * 60 * 1000);
    const tooEarlyStart = new Date(now + 20 * 60 * 1000); // 20 min out: outside the join window
    const tooEarlyEnd = new Date(tooEarlyStart.getTime() + 60 * 60 * 1000);

    const testCls = await ClassModel.create({
      title: 'Zoom SDK Integration Test', description: 'Test class with valid Zoom fixture',
      category: 'Testing', level: 'Beginner', price: 0, duration: 60, totalSessions: 1,
      status: 'published', instructor: { id: instructor.user.id, name: 'Instructor Test' },
    });
    zoomClassId = testCls._id.toString();

    const readySession = await ClassScheduleModel.create({
      classId: testCls._id, sessionNumber: 1, title: 'Zoom SDK Ready Test',
      startTime: withinWindowStart, endTime: withinWindowEnd,
      zoomMeetingId: '987654321', zoomPasscode: 'testpass123', status: 'scheduled',
    });
    readySessionId = readySession._id.toString();

    const tooEarlySession = await ClassScheduleModel.create({
      classId: testCls._id, sessionNumber: 2, title: 'Zoom SDK Too Early Test',
      startTime: tooEarlyStart, endTime: tooEarlyEnd,
      zoomMeetingId: '987654322', zoomPasscode: 'testpass456', status: 'scheduled',
    });
    tooEarlySessionId = tooEarlySession._id.toString();

    const configCheckSession = await ClassScheduleModel.create({
      classId: testCls._id, sessionNumber: 3, title: 'Zoom SDK Config Check Test',
      startTime: withinWindowStart, endTime: withinWindowEnd,
      zoomMeetingId: '987654323', zoomPasscode: 'testpass789', status: 'scheduled',
    });
    configCheckSessionId = configCheckSession._id.toString();

    const enroll = await request('/v1/enrollments', { method: 'POST', token: student.token, body: { classId: zoomClassId } });
    assert.equal(enroll.status, 201);
  });

  await t.test('enrolled student within join window returns 200 with only the minimum SDK credentials', async () => {
    const creds = await request(`/v1/classes/${zoomClassId}/sessions/${readySessionId}/join-credentials`, {
      method: 'POST', token: student.token,
    });
    assert.equal(creds.status, 200);
    const data = creds.body.data;
    assert.match(data.signature, /^[\w-]+\.[\w-]+\.[\w-]+$/, 'signature must be a JWT');
    assert.equal(data.meetingNumber, '987654321');
    assert.equal(data.passWord, 'testpass123');
    assert.ok(data.userName);

    const forbiddenKeys = ['sdkKey', 'sdkSecret', 'clientSecret', 'appSecret', 'oauthToken', 'accessToken', 'startUrl', 'start_url', 'zakToken', 'zak', 'hostUrl', 'apiKey', 'apiSecret'];
    for (const key of forbiddenKeys) assert.equal(data[key], undefined, `response must not include ${key}`);
    const serialized = JSON.stringify(data);
    assert.ok(!serialized.includes('test_meeting_sdk_client_secret'), 'response must not leak the Meeting SDK client secret');
    assert.ok(!serialized.includes('mongodb://'), 'response must not leak environment values');
  });

  await t.test('too-early join attempt returns 409', async () => {
    const early = await request(`/v1/classes/${zoomClassId}/sessions/${tooEarlySessionId}/join-credentials`, {
      method: 'POST', token: student.token,
    });
    assert.equal(early.status, 409);
    assert.match(early.body.message, /not started/i);
  });

  await t.test('unenrolled student returns 403', async () => {
    const rejected = await request(`/v1/classes/${zoomClassId}/sessions/${readySessionId}/join-credentials`, {
      method: 'POST', token: other.token,
    });
    assert.equal(rejected.status, 403);
    assert.match(rejected.body.message, /not enrolled/i);
  });

  await t.test('cancelled session returns 409', async () => {
    const { ClassScheduleModel } = require('../dist/models/Class');
    await ClassScheduleModel.findByIdAndUpdate(readySessionId, { status: 'cancelled' });
    const cancelled = await request(`/v1/classes/${zoomClassId}/sessions/${readySessionId}/join-credentials`, {
      method: 'POST', token: student.token,
    });
    assert.equal(cancelled.status, 409);
    assert.match(cancelled.body.message, /cancelled/i);
  });

  await t.test('unauthenticated request returns 401', async () => {
    const unauth = await request(`/v1/classes/${zoomClassId}/sessions/${tooEarlySessionId}/join-credentials`, { method: 'POST' });
    assert.equal(unauth.status, 401);
  });

  await t.test('invalid IDs return 400', async () => {
    const badId = await request('/v1/classes/invalid/sessions/bad/join-credentials', {
      method: 'POST', token: student.token,
    });
    assert.equal(badId.status, 400);
  });

  await t.test('non-existent session returns 404', async () => {
    const notFound = await request(`/v1/classes/${zoomClassId}/sessions/507f1f77bcf86cd799439011/join-credentials`, {
      method: 'POST', token: student.token,
    });
    assert.equal(notFound.status, 404);
  });

  await t.test('missing Zoom Meeting SDK configuration returns 503 (fails closed, no fallback secret)', async () => {
    // The route reads ENV once at module load, so exercising a "not configured" server
    // requires a fresh module graph (env -> zoom -> class.routes) mounted on its own
    // ephemeral server, isolated from the shared app/DB used by the rest of this file.
    // Note: dotenv.config() re-reads the real backend .env on every fresh `require` of
    // config/env, so clearing process.env alone is not enough when a real .env with Zoom
    // SDK credentials is present on disk - the ENV object's properties are mutated directly
    // after the fresh require instead, so the simulated "unconfigured" state cannot be
    // silently undone by whatever is in the developer's local .env file.
    const envPath = require.resolve('../dist/config/env');
    const zoomPath = require.resolve('../dist/utils/zoom');
    const classRoutesPath = require.resolve('../dist/routes/class.routes');
    delete require.cache[envPath];
    delete require.cache[zoomPath];
    delete require.cache[classRoutesPath];

    let unconfiguredServer;
    try {
      const freshEnvModule = require('../dist/config/env');
      freshEnvModule.ENV.ZOOM_MEETING_SDK_CLIENT_ID = '';
      freshEnvModule.ENV.ZOOM_MEETING_SDK_CLIENT_SECRET = '';

      const expressLib = require('express');
      const freshClassRoutes = require('../dist/routes/class.routes').default;
      const unconfiguredApp = expressLib();
      unconfiguredApp.use(expressLib.json());
      unconfiguredApp.use('/v1/classes', freshClassRoutes);
      unconfiguredServer = unconfiguredApp.listen(0, '127.0.0.1');
      await new Promise(resolve => unconfiguredServer.once('listening', resolve));
      const port = unconfiguredServer.address().port;
      const response = await fetch(`http://127.0.0.1:${port}/v1/classes/${zoomClassId}/sessions/${configCheckSessionId}/join-credentials`, {
        method: 'POST', headers: { Authorization: `Bearer ${student.token}` },
      });
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.match(body.message, /not configured/i);
      assert.equal(body.data, undefined, 'no credentials must be returned when misconfigured');
    } finally {
      if (unconfiguredServer) await new Promise(resolve => unconfiguredServer.close(resolve));
      delete require.cache[envPath];
      delete require.cache[zoomPath];
      delete require.cache[classRoutesPath];
    }
  });
});
