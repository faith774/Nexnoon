const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

// Never reads the configured Atlas URI or writes to the application's database.
const database = `nexnoon_lifecycle_${crypto.randomBytes(8).toString('hex')}`;
const WEBHOOK_SECRET = 'test_webhook_secret_token';
Object.assign(process.env, {
  NODE_ENV: 'test', MONGODB_URI: `mongodb://127.0.0.1:27017/${database}`,
  JWT_ACCESS_SECRET: crypto.randomBytes(32).toString('hex'),
  JWT_REFRESH_SECRET: crypto.randomBytes(32).toString('hex'),
  SMTP_HOST: '', SMTP_USER: '', STRIPE_SECRET_KEY: '',
  ZOOM_ACCOUNT_ID: '', ZOOM_CLIENT_ID: '', ZOOM_CLIENT_SECRET: '',
  ZOOM_MEETING_SDK_CLIENT_ID: 'test_meeting_sdk_client_id',
  ZOOM_MEETING_SDK_CLIENT_SECRET: 'test_meeting_sdk_client_secret',
  ZOOM_WEBHOOK_SECRET_TOKEN: WEBHOOK_SECRET,
});
const app = require('../dist/app').default;
const { evaluateJoinWindow, sessionsOverlap } = require('../dist/config/liveClassPolicy');

function signWebhook(bodyString, { timestamp = Math.floor(Date.now() / 1000), secret = WEBHOOK_SECRET } = {}) {
  const signature = 'v0=' + crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${bodyString}`).digest('hex');
  return { signature, timestamp: String(timestamp) };
}

test('join-window policy: pure unit coverage', () => {
  const base = { status: 'scheduled', hasZoomMeeting: true };
  const start = new Date('2027-01-01T10:00:00.000Z');
  const end = new Date('2027-01-01T11:00:00.000Z');

  assert.equal(evaluateJoinWindow({ ...base, startTime: start, endTime: end }, new Date('2027-01-01T09:40:00.000Z')).code, 'too_early');
  assert.equal(evaluateJoinWindow({ ...base, startTime: start, endTime: end }, new Date('2027-01-01T09:50:00.000Z')).code, 'joinable');
  assert.equal(evaluateJoinWindow({ ...base, startTime: start, endTime: end }, new Date('2027-01-01T10:30:00.000Z')).code, 'joinable');
  assert.equal(evaluateJoinWindow({ ...base, startTime: start, endTime: end }, new Date('2027-01-01T11:15:00.000Z')).code, 'late_joinable');
  assert.equal(evaluateJoinWindow({ ...base, startTime: start, endTime: end }, new Date('2027-01-01T11:31:00.000Z')).code, 'ended');
  // A host who starts early (status flips to 'live' via the meeting.started
  // webhook) must let students in immediately, even hours before the originally
  // scheduled start - the live signal overrides the early-join-window estimate.
  assert.equal(evaluateJoinWindow({ ...base, status: 'live', startTime: start, endTime: end }, new Date('2027-01-01T06:00:00.000Z')).code, 'joinable');
  assert.equal(evaluateJoinWindow({ ...base, status: 'cancelled', startTime: start, endTime: end }, new Date('2027-01-01T10:00:00.000Z')).code, 'cancelled');
  assert.equal(evaluateJoinWindow({ ...base, status: 'completed', startTime: start, endTime: end }, new Date('2027-01-01T10:00:00.000Z')).code, 'completed');
  assert.equal(evaluateJoinWindow({ ...base, hasZoomMeeting: false, startTime: start, endTime: end }, new Date('2027-01-01T10:00:00.000Z')).code, 'missing_meeting');

  assert.equal(sessionsOverlap(new Date('2027-01-01T10:00:00Z'), new Date('2027-01-01T11:00:00Z'), new Date('2027-01-01T10:30:00Z'), new Date('2027-01-01T12:00:00Z')), true);
  assert.equal(sessionsOverlap(new Date('2027-01-01T10:00:00Z'), new Date('2027-01-01T11:00:00Z'), new Date('2027-01-01T11:00:00Z'), new Date('2027-01-01T12:00:00Z')), false);
});

test('zoom lifecycle: scheduling conflicts, idempotent creation, host access, and webhooks', async t => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  // Build indexes (uniqueness guards for idempotent session/event creation) before
  // any request runs, so the tests below can't race an in-progress index build.
  await mongoose.connection.syncIndexes();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, database);
    assert.match(database, /^nexnoon_lifecycle_[a-f0-9]{16}$/);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const request = async (path, { method = 'GET', token, body, headers = {} } = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: response.status, body: json, headers: response.headers };
  };
  const signup = async (name, role) => {
    const result = await request('/v1/auth/signup', { method: 'POST', body: {
      firstName: name, lastName: 'Test', email: `${name.toLowerCase()}@example.invalid`, password: 'Local-test-password-2026!', role,
    } });
    assert.equal(result.status, 201);
    return result.body.data;
  };
  const createClass = async (token, title) => {
    const created = await request('/v1/classes', { method: 'POST', token, body: {
      title, description: 'Lifecycle test class', category: 'Testing', level: 'Beginner',
      price: 0, duration: 60, totalSessions: 2, status: 'published',
    } });
    assert.equal(created.status, 201);
    return created.body.data.id;
  };

  let instructorA, instructorB, student, classA, classB;

  await t.test('fixtures: two instructors, two classes', async () => {
    instructorA = await signup('InstructorA', 'instructor');
    instructorB = await signup('InstructorB', 'instructor');
    student = await signup('LifecycleStudent', 'student');

    classA = await createClass(instructorA.token, 'Lifecycle Class A');
    classB = await createClass(instructorB.token, 'Lifecycle Class B');
  });

  await t.test('non-overlapping sessions are permitted', async () => {
    const first = await request(`/v1/classes/${classA}/schedule`, { method: 'POST', token: instructorA.token, body: {
      sessionNumber: 1, title: 'Session 1', startTime: '2027-02-01T10:00:00.000Z', endTime: '2027-02-01T11:00:00.000Z',
    } });
    assert.equal(first.status, 201);
    const second = await request(`/v1/classes/${classA}/schedule`, { method: 'POST', token: instructorA.token, body: {
      sessionNumber: 2, title: 'Session 2', startTime: '2027-02-01T12:00:00.000Z', endTime: '2027-02-01T13:00:00.000Z',
    } });
    assert.equal(second.status, 201);
  });

  await t.test('same instructor, overlapping -> reject', async () => {
    const conflicting = await request(`/v1/classes/${classA}/schedule`, { method: 'POST', token: instructorA.token, body: {
      sessionNumber: 3, title: 'Overlap', startTime: '2027-02-01T10:30:00.000Z', endTime: '2027-02-01T11:30:00.000Z',
    } });
    assert.equal(conflicting.status, 409);
    assert.match(conflicting.body.message, /already have a session/i);
  });

  await t.test('different instructors, shared fallback host, overlapping -> reject', async () => {
    // Neither instructorA nor instructorB has an explicit Zoom user mapping, so
    // both resolve to the shared "shared:me" fallback host - the platform must
    // never assume that shared account can run two concurrent meetings, so this
    // must be rejected exactly like a same-host conflict, even though the two
    // sessions belong to different instructors and different classes.
    const conflicting = await request(`/v1/classes/${classB}/schedule`, { method: 'POST', token: instructorB.token, body: {
      sessionNumber: 1, title: 'Class B Session 1', startTime: '2027-02-01T10:00:00.000Z', endTime: '2027-02-01T11:00:00.000Z',
    } });
    assert.equal(conflicting.status, 409);
    assert.match(conflicting.body.message, /zoom host/i);
  });

  await t.test('different instructors, same explicit Zoom host mapping, overlapping -> reject', async () => {
    const { User } = require('../dist/models/User');
    const instructorC = await signup('InstructorC', 'instructor');
    const instructorD = await signup('InstructorD', 'instructor');
    await User.updateOne({ _id: instructorC.user.id }, { $set: { zoomHostEnabled: true, zoomUserId: 'shared-explicit-host@example.invalid' } });
    await User.updateOne({ _id: instructorD.user.id }, { $set: { zoomHostEnabled: true, zoomUserId: 'shared-explicit-host@example.invalid' } });

    const classC = await createClass(instructorC.token, 'Lifecycle Class C');
    const classD = await createClass(instructorD.token, 'Lifecycle Class D');

    const first = await request(`/v1/classes/${classC}/schedule`, { method: 'POST', token: instructorC.token, body: {
      sessionNumber: 1, title: 'Class C Session 1', startTime: '2027-02-03T10:00:00.000Z', endTime: '2027-02-03T11:00:00.000Z',
    } });
    assert.equal(first.status, 201);

    const conflicting = await request(`/v1/classes/${classD}/schedule`, { method: 'POST', token: instructorD.token, body: {
      sessionNumber: 1, title: 'Class D Session 1', startTime: '2027-02-03T10:30:00.000Z', endTime: '2027-02-03T11:30:00.000Z',
    } });
    assert.equal(conflicting.status, 409);
    assert.match(conflicting.body.message, /zoom host/i);
  });

  await t.test('different instructors, different explicit Zoom hosts, overlapping -> allow', async () => {
    const { User } = require('../dist/models/User');
    const instructorE = await signup('InstructorE', 'instructor');
    const instructorF = await signup('InstructorF', 'instructor');
    await User.updateOne({ _id: instructorE.user.id }, { $set: { zoomHostEnabled: true, zoomUserId: 'host-e@example.invalid' } });
    await User.updateOne({ _id: instructorF.user.id }, { $set: { zoomHostEnabled: true, zoomUserId: 'host-f@example.invalid' } });

    const classE = await createClass(instructorE.token, 'Lifecycle Class E');
    const classF = await createClass(instructorF.token, 'Lifecycle Class F');

    const first = await request(`/v1/classes/${classE}/schedule`, { method: 'POST', token: instructorE.token, body: {
      sessionNumber: 1, title: 'Class E Session 1', startTime: '2027-02-04T10:00:00.000Z', endTime: '2027-02-04T11:00:00.000Z',
    } });
    assert.equal(first.status, 201);

    const simultaneous = await request(`/v1/classes/${classF}/schedule`, { method: 'POST', token: instructorF.token, body: {
      sessionNumber: 1, title: 'Class F Session 1', startTime: '2027-02-04T10:00:00.000Z', endTime: '2027-02-04T11:00:00.000Z',
    } });
    assert.equal(simultaneous.status, 201);
  });

  let rescheduleTargetId;
  await t.test('updating a session does not conflict with itself', async () => {
    const created = await request(`/v1/classes/${classA}/schedule`, { method: 'POST', token: instructorA.token, body: {
      sessionNumber: 4, title: 'Reschedule Me', startTime: '2027-02-02T10:00:00.000Z', endTime: '2027-02-02T11:00:00.000Z',
    } });
    assert.equal(created.status, 201);
    rescheduleTargetId = created.body.data.id;
    const noChange = await request(`/v1/classes/${classA}/schedule/${rescheduleTargetId}`, { method: 'PATCH', token: instructorA.token, body: {
      startTime: '2027-02-02T10:00:00.000Z', endTime: '2027-02-02T11:00:00.000Z',
    } });
    assert.equal(noChange.status, 200);
  });

  await t.test('rescheduling into an existing conflict is rejected', async () => {
    const rescheduled = await request(`/v1/classes/${classA}/schedule/${rescheduleTargetId}`, { method: 'PATCH', token: instructorA.token, body: {
      startTime: '2027-02-01T10:15:00.000Z', endTime: '2027-02-01T10:45:00.000Z',
    } });
    assert.equal(rescheduled.status, 409);
  });

  await t.test('duplicate session-number submission does not create a second document', async () => {
    const duplicate = await request(`/v1/classes/${classA}/schedule`, { method: 'POST', token: instructorA.token, body: {
      sessionNumber: 1, title: 'Session 1 (resubmitted)', startTime: '2027-02-01T10:00:00.000Z', endTime: '2027-02-01T11:00:00.000Z',
    } });
    assert.equal(duplicate.status, 200);
    assert.match(duplicate.body.message, /already exists/i);

    const { ClassScheduleModel } = require('../dist/models/Class');
    const count = await ClassScheduleModel.countDocuments({ classId: classA, sessionNumber: 1 });
    assert.equal(count, 1);
  });

  await t.test('schedule responses never include host-only fields', async () => {
    const schedule = await request(`/v1/classes/${classA}/schedule`);
    assert.equal(schedule.status, 200);
    for (const session of schedule.body.data) {
      for (const key of ['zoomStartUrl', 'zoomHostUserId', 'meetingCreationStatus', 'zoomLink', 'zoomMeetingId', 'zoomPasscode']) {
        assert.equal(session[key], undefined, `schedule response must not include ${key}`);
      }
    }
  });

  await t.test('host-access: student and non-owning instructor are forbidden', async () => {
    const { ClassScheduleModel } = require('../dist/models/Class');
    const anySession = await ClassScheduleModel.findOne({ classId: classA });

    const asStudent = await request(`/v1/classes/${classA}/sessions/${anySession.id}/host-access`, { method: 'POST', token: student.token });
    assert.equal(asStudent.status, 403);

    const asOtherInstructor = await request(`/v1/classes/${classA}/sessions/${anySession.id}/host-access`, { method: 'POST', token: instructorB.token });
    assert.equal(asOtherInstructor.status, 403);
  });

  await t.test('host-access: missing meeting fails safely (409, no fabricated URL)', async () => {
    const { ClassScheduleModel } = require('../dist/models/Class');
    // Zoom is unconfigured in this test env, so this fixture session (created via
    // the real route earlier) has no zoomMeetingId - the route must fail safely,
    // never fabricate a URL.
    const anySession = await ClassScheduleModel.findOne({ classId: classA, zoomMeetingId: { $exists: false } });
    const asOwner = await request(`/v1/classes/${classA}/sessions/${anySession.id}/host-access`, { method: 'POST', token: instructorA.token });
    assert.equal(asOwner.status, 409);
  });

  await t.test('host-access: cancelled and completed sessions are both rejected', async () => {
    const { ClassScheduleModel } = require('../dist/models/Class');
    let sessionNumber = 900;
    for (const status of ['cancelled', 'completed']) {
      const session = await ClassScheduleModel.create({
        classId: classA, sessionNumber: sessionNumber++, title: `Host access ${status} fixture`,
        startTime: new Date('2027-04-01T10:00:00.000Z'), endTime: new Date('2027-04-01T11:00:00.000Z'),
        zoomMeetingId: '11122233344', status,
      });
      const response = await request(`/v1/classes/${classA}/sessions/${session.id}/host-access`, { method: 'POST', token: instructorA.token });
      assert.equal(response.status, 409, `expected 409 for a ${status} session`);
    }
  });

  await t.test('host-access: assigned instructor gets a FRESH start_url, never a stale stored one, with no-store caching', async () => {
    const { ClassScheduleModel } = require('../dist/models/Class');
    const zoomUtils = require('../dist/utils/zoom');
    const originalGetZoomMeetingStartUrl = zoomUtils.getZoomMeetingStartUrl;
    const originalConsoleError = console.error;

    const staleUrl = 'https://us02web.zoom.us/s/00000000000?zak=STALE_DO_NOT_USE_TOKEN';
    const freshUrl = 'https://us02web.zoom.us/s/11111111111?zak=FRESH_TOKEN_FOR_THIS_REQUEST';
    let fetchCalledWithMeetingId;

    // A pre-correction deployment could have persisted a start_url at meeting
    // creation time; simulate that by writing one directly, bypassing the app
    // (which no longer writes this field). The route must never read or trust it.
    const session = await ClassScheduleModel.create({
      classId: classA, sessionNumber: 950, title: 'Host access freshness fixture',
      startTime: new Date('2027-04-02T10:00:00.000Z'), endTime: new Date('2027-04-02T11:00:00.000Z'),
      zoomMeetingId: '22233344455', status: 'scheduled', zoomStartUrl: staleUrl,
    });

    const loggedMessages = [];
    console.error = (...args) => { loggedMessages.push(args.map(String).join(' ')); };
    zoomUtils.getZoomMeetingStartUrl = async (meetingId) => {
      fetchCalledWithMeetingId = meetingId;
      return freshUrl;
    };

    let response;
    try {
      response = await request(`/v1/classes/${classA}/sessions/${session.id}/host-access`, { method: 'POST', token: instructorA.token });
    } finally {
      zoomUtils.getZoomMeetingStartUrl = originalGetZoomMeetingStartUrl;
      console.error = originalConsoleError;
    }

    assert.equal(response.status, 200);
    assert.equal(fetchCalledWithMeetingId, '22233344455', 'must call the fresh-fetch path for this exact meeting');
    assert.equal(response.body.data.startUrl, freshUrl, 'must return the freshly-fetched URL');
    assert.notEqual(response.body.data.startUrl, staleUrl, 'must never return the stale stored URL');
    assert.ok(JSON.stringify(response.body).indexOf('STALE_DO_NOT_USE_TOKEN') === -1, 'stale token must not appear anywhere in the response');
    assert.match(response.headers.get('cache-control') || '', /no-store/i);

    const stillStale = await ClassScheduleModel.findById(session.id).select('+zoomStartUrl');
    assert.equal(stillStale.zoomStartUrl, staleUrl, 'the app must not have re-persisted the fresh URL either');
    assert.ok(!loggedMessages.some(line => line.includes(freshUrl) || line.includes('FRESH_TOKEN')), 'the fresh host URL must never be logged');
  });

  await t.test('host-access: Zoom failure returns a generic 503 with no URL or Zoom body leaked, and logs nothing sensitive', async () => {
    const { ClassScheduleModel } = require('../dist/models/Class');
    const zoomUtils = require('../dist/utils/zoom');
    const originalGetZoomMeetingStartUrl = zoomUtils.getZoomMeetingStartUrl;
    const originalConsoleError = console.error;

    const session = await ClassScheduleModel.create({
      classId: classA, sessionNumber: 951, title: 'Host access failure fixture',
      startTime: new Date('2027-04-03T10:00:00.000Z'), endTime: new Date('2027-04-03T11:00:00.000Z'),
      zoomMeetingId: '33344455566', status: 'scheduled',
    });

    const loggedMessages = [];
    console.error = (...args) => { loggedMessages.push(args.map(String).join(' ')); };
    zoomUtils.getZoomMeetingStartUrl = async () => null; // simulates a Zoom API failure

    let response;
    try {
      response = await request(`/v1/classes/${classA}/sessions/${session.id}/host-access`, { method: 'POST', token: instructorA.token });
    } finally {
      zoomUtils.getZoomMeetingStartUrl = originalGetZoomMeetingStartUrl;
      console.error = originalConsoleError;
    }

    assert.equal(response.status, 503);
    const serialized = JSON.stringify(response.body);
    assert.ok(!/zoom\.us|zak=|start_url/i.test(serialized), 'error response must not contain a Zoom URL or leaked field name');
    assert.ok(!loggedMessages.some(line => /zoom\.us|zak=/i.test(line)), 'nothing sensitive should have been logged for this simulated failure');
  });

  await t.test('host-access: a Zoom OAuth token failure inside the fresh-fetch call fails safely (no leaked auth header or response body, anywhere)', async () => {
    // Exercises the REAL getZoomMeetingStartUrl (not a stub of it), specifically
    // the code path where its own internal getZoomAccessToken() call throws -
    // this must be caught inside getZoomMeetingStartUrl itself and turned into a
    // safe `null`, never left to bubble to the global error handler (which logs
    // the raw error object, including an AxiosError's request/response details).
    const { ClassScheduleModel } = require('../dist/models/Class');
    const { ENV } = require('../dist/config/env');
    const axios = require('axios');

    const originalAccountId = ENV.ZOOM_ACCOUNT_ID;
    const originalClientId = ENV.ZOOM_CLIENT_ID;
    const originalClientSecret = ENV.ZOOM_CLIENT_SECRET;
    const originalAxiosPost = axios.post;
    const originalConsoleError = console.error;

    // A realistic AxiosError-shaped rejection carrying the kind of sensitive
    // fields a real Zoom OAuth failure could carry, so the test can prove none
    // of it ever surfaces - not in the HTTP response, not in the logs.
    const SENSITIVE_AUTH_HEADER = 'Basic ZmFrZS1jbGllbnQtaWQ6ZmFrZS1jbGllbnQtc2VjcmV0';
    const SENSITIVE_RESPONSE_DETAIL = 'invalid_client_super_secret_reason';
    const simulatedOAuthFailure = Object.assign(new Error('Request failed with status code 401'), {
      isAxiosError: true,
      config: { headers: { Authorization: SENSITIVE_AUTH_HEADER } },
      response: { status: 401, data: { reason: SENSITIVE_RESPONSE_DETAIL } },
    });

    const session = await ClassScheduleModel.create({
      classId: classA, sessionNumber: 952, title: 'Host access OAuth-failure fixture',
      startTime: new Date('2027-04-04T10:00:00.000Z'), endTime: new Date('2027-04-04T11:00:00.000Z'),
      zoomMeetingId: '44455566677', status: 'scheduled',
    });

    const loggedMessages = [];
    console.error = (...args) => { loggedMessages.push(args.map(String).join(' ')); };
    // Non-empty so getZoomAccessToken() actually attempts the (mocked) OAuth call
    // instead of short-circuiting to demo mode.
    ENV.ZOOM_ACCOUNT_ID = 'fake-account-id';
    ENV.ZOOM_CLIENT_ID = 'fake-client-id';
    ENV.ZOOM_CLIENT_SECRET = 'fake-client-secret';
    axios.post = async () => { throw simulatedOAuthFailure; };

    let response;
    try {
      response = await request(`/v1/classes/${classA}/sessions/${session.id}/host-access`, { method: 'POST', token: instructorA.token });
    } finally {
      ENV.ZOOM_ACCOUNT_ID = originalAccountId;
      ENV.ZOOM_CLIENT_ID = originalClientId;
      ENV.ZOOM_CLIENT_SECRET = originalClientSecret;
      axios.post = originalAxiosPost;
      console.error = originalConsoleError;
    }

    // Fails safely - a generic 503, not a 500 from an uncaught exception reaching
    // the global error handler.
    assert.equal(response.status, 503);
    const serialized = JSON.stringify(response.body);
    assert.ok(!serialized.includes(SENSITIVE_AUTH_HEADER), 'response must never include the OAuth Authorization header');
    assert.ok(!serialized.includes(SENSITIVE_RESPONSE_DETAIL), 'response must never include Zoom\'s raw error response body');

    const allLogs = loggedMessages.join('\n');
    assert.ok(!allLogs.includes(SENSITIVE_AUTH_HEADER), 'logs must never include the OAuth Authorization header');
    assert.ok(!allLogs.includes(SENSITIVE_RESPONSE_DETAIL), 'logs must never include Zoom\'s raw error response body');
  });

  await t.test('host-access: normal class/schedule responses exclude host access', async () => {
    const classDetail = await request(`/v1/classes/${classA}`);
    assert.equal(classDetail.status, 200);
    for (const session of classDetail.body.data.schedule) {
      for (const key of ['zoomStartUrl', 'zoomHostUserId', 'meetingCreationStatus']) {
        assert.equal(session[key], undefined, `class detail response must not include ${key}`);
      }
    }
  });

  await t.test('manual complete: instructor can finalize a session Zoom never webhook-notified about', async () => {
    const { ClassScheduleModel } = require('../dist/models/Class');
    const session = await ClassScheduleModel.create({
      classId: classA, sessionNumber: 953, title: 'Manual complete fixture',
      startTime: new Date('2027-04-05T10:00:00.000Z'), endTime: new Date('2027-04-05T11:00:00.000Z'),
      zoomMeetingId: '55566677788', status: 'live',
    });

    const asStudentOrOther = await request(`/v1/classes/${classA}/schedule/${session.id}/complete`, { method: 'POST', token: instructorB.token });
    assert.equal(asStudentOrOther.status, 403, 'a different instructor must not be able to complete someone else\'s session');

    const completed = await request(`/v1/classes/${classA}/schedule/${session.id}/complete`, { method: 'POST', token: instructorA.token });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.data.status, 'completed');

    const { ClassScheduleModel: Model2 } = require('../dist/models/Class');
    const persisted = await Model2.findById(session.id);
    assert.equal(persisted.status, 'completed');

    const repeat = await request(`/v1/classes/${classA}/schedule/${session.id}/complete`, { method: 'POST', token: instructorA.token });
    assert.equal(repeat.status, 409, 'completing an already-completed session must fail, not silently succeed twice');
  });

  await t.test('webhook: endpoint URL validation challenge', async () => {
    const response = await request('/v1/zoom/webhook', { method: 'POST', body: {
      event: 'endpoint.url_validation', payload: { plainToken: 'abc123' },
    } });
    assert.equal(response.status, 200);
    assert.equal(response.body.plainToken, 'abc123');
    const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update('abc123').digest('hex');
    assert.equal(response.body.encryptedToken, expected);
  });

  let webhookMeetingId, webhookSessionId;
  await t.test('webhook fixture: a session with a Zoom meeting id', async () => {
    const { ClassScheduleModel } = require('../dist/models/Class');
    webhookMeetingId = '55511122233';
    const session = await ClassScheduleModel.create({
      classId: classA, sessionNumber: 99, title: 'Webhook Target',
      startTime: new Date('2027-03-01T10:00:00.000Z'), endTime: new Date('2027-03-01T11:00:00.000Z'),
      zoomMeetingId: webhookMeetingId, status: 'scheduled',
    });
    webhookSessionId = session.id;
  });

  await t.test('webhook: invalid signature rejected', async () => {
    const payload = JSON.stringify({ event: 'meeting.started', event_ts: Date.now(), payload: { object: { id: webhookMeetingId } } });
    const response = await request('/v1/zoom/webhook', { method: 'POST', body: payload, headers: {
      'x-zm-signature': 'v0=not-a-real-signature', 'x-zm-request-timestamp': String(Math.floor(Date.now() / 1000)),
    } });
    assert.equal(response.status, 401);
  });

  await t.test('webhook: stale timestamp rejected', async () => {
    const payload = JSON.stringify({ event: 'meeting.started', event_ts: Date.now(), payload: { object: { id: webhookMeetingId } } });
    const { signature, timestamp } = signWebhook(payload, { timestamp: Math.floor(Date.now() / 1000) - 3600 });
    const response = await request('/v1/zoom/webhook', { method: 'POST', body: payload, headers: {
      'x-zm-signature': signature, 'x-zm-request-timestamp': timestamp,
    } });
    assert.equal(response.status, 401);
  });

  await t.test('webhook: valid meeting.started signature updates the correct session to live', async () => {
    const payload = JSON.stringify({ event: 'meeting.started', event_ts: Date.now(), payload: { object: { id: webhookMeetingId, uuid: 'uuid-started-1' } } });
    const { signature, timestamp } = signWebhook(payload);
    const response = await request('/v1/zoom/webhook', { method: 'POST', body: payload, headers: {
      'x-zm-signature': signature, 'x-zm-request-timestamp': timestamp,
    } });
    assert.equal(response.status, 200);

    const { ClassScheduleModel } = require('../dist/models/Class');
    const updated = await ClassScheduleModel.findById(webhookSessionId);
    assert.equal(updated.status, 'live');
  });

  await t.test('a student can join the moment the host starts early, even hours before the scheduled time', async () => {
    // webhookSessionId is scheduled for 2027-03-01 (months from "now" in test
    // time) and was just flipped to 'live' by the previous test's webhook - this
    // is the exact end-to-end scenario the join-window override exists for: the
    // teacher started class early, so a student must be let in immediately
    // instead of seeing a "starts in N hours" countdown.
    const enroll = await request('/v1/enrollments', { method: 'POST', token: student.token, body: { classId: classA } });
    assert.ok([200, 201].includes(enroll.status));

    const joined = await request(`/v1/classes/${classA}/sessions/${webhookSessionId}/join-credentials`, { method: 'POST', token: student.token });
    assert.equal(joined.status, 200);
    assert.ok(joined.body.data.signature, 'student must receive real join credentials, not a rejection');
  });

  await t.test('webhook: duplicate delivery of the same event is processed once (idempotent)', async () => {
    const { ZoomWebhookEventModel } = require('../dist/models/ZoomWebhookEvent');
    const countBefore = await ZoomWebhookEventModel.countDocuments({ eventType: 'meeting.started' });

    const payload = JSON.stringify({ event: 'meeting.started', event_ts: Date.now(), payload: { object: { id: webhookMeetingId, uuid: 'uuid-dup-delivery-1' } } });
    const { signature, timestamp } = signWebhook(payload);
    // Same body + same request -> same synthetic event id, so the second delivery
    // must short-circuit as already-processed instead of erroring or reapplying.
    const first = await request('/v1/zoom/webhook', { method: 'POST', body: payload, headers: { 'x-zm-signature': signature, 'x-zm-request-timestamp': timestamp } });
    const second = await request('/v1/zoom/webhook', { method: 'POST', body: payload, headers: { 'x-zm-signature': signature, 'x-zm-request-timestamp': timestamp } });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);

    const countAfter = await ZoomWebhookEventModel.countDocuments({ eventType: 'meeting.started' });
    assert.equal(countAfter - countBefore, 1, 'exactly one new event row for two identical deliveries');
  });

  await t.test('webhook: meeting.ended moves the session straight to completed and blocks further joins', async () => {
    const payload = JSON.stringify({ event: 'meeting.ended', event_ts: Date.now(), payload: { object: { id: webhookMeetingId, uuid: 'uuid-ended-1' } } });
    const { signature, timestamp } = signWebhook(payload);
    const response = await request('/v1/zoom/webhook', { method: 'POST', body: payload, headers: { 'x-zm-signature': signature, 'x-zm-request-timestamp': timestamp } });
    assert.equal(response.status, 200);

    const { ClassScheduleModel } = require('../dist/models/Class');
    const updated = await ClassScheduleModel.findById(webhookSessionId);
    // No separate "ended" limbo state - completed for instructor and students alike.
    assert.equal(updated.status, 'completed');

    // Already enrolled by the earlier "join early" test - this is just an
    // idempotency check, not asserting first-time enrollment.
    const enroll = await request('/v1/enrollments', { method: 'POST', token: student.token, body: { classId: classA } });
    assert.ok([200, 201].includes(enroll.status));
    const blocked = await request(`/v1/classes/${classA}/sessions/${webhookSessionId}/join-credentials`, { method: 'POST', token: student.token });
    assert.equal(blocked.status, 409);
  });

  await t.test('webhook: event for an unknown meeting id is handled safely (no crash, no match)', async () => {
    const payload = JSON.stringify({ event: 'meeting.started', event_ts: Date.now(), payload: { object: { id: '000000000', uuid: 'uuid-unknown-1' } } });
    const { signature, timestamp } = signWebhook(payload);
    const response = await request('/v1/zoom/webhook', { method: 'POST', body: payload, headers: { 'x-zm-signature': signature, 'x-zm-request-timestamp': timestamp } });
    assert.equal(response.status, 200);
  });
});
