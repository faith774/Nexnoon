/**
 * Stabilization smoke: free enroll path + seat-cap (26th blocked).
 * Requires local API running and demo accounts (npm run seed:demo).
 *
 * Usage:
 *   npm run smoke:e2e
 */
const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE = `http://127.0.0.1:${process.env.PORT || 4000}`;

async function request(route, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${BASE}/v1${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, body: json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const health = await fetch(`${BASE}/health`).then((r) => r.json()).catch(() => null);
  assert(health?.success, `Backend not reachable at ${BASE}/health — start with npm run dev`);

  const accountsFile = path.join(__dirname, '../.local-data/demo-accounts.json');
  assert(fs.existsSync(accountsFile), 'Missing demo accounts. Run: npm run seed:demo');
  const accounts = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
  const adminAcc = accounts.find((a) => a.role === 'admin');
  const teacherAcc = accounts.find((a) => a.role === 'instructor');
  const studentAcc = accounts.find((a) => a.role === 'student');
  assert(adminAcc && teacherAcc && studentAcc, 'Demo accounts need admin, instructor, student');

  console.log('\n1) Login demo users…');
  const admin = (await request('/auth/admin/login', { method: 'POST', body: adminAcc })).body.data;
  const teacher = (await request('/auth/login', { method: 'POST', body: teacherAcc })).body.data;
  const student = (await request('/auth/login', { method: 'POST', body: studentAcc })).body.data;
  assert(admin?.token && teacher?.token && student?.token, 'Login failed');

  console.log('2) Integrations status (admin)…');
  const integ = await request('/settings/integrations', { token: admin.token });
  assert(integ.ok, `Integrations endpoint failed: ${integ.body?.message || integ.status}`);
  const status = integ.body.data;
  console.log(`   Stripe: ${status.stripe.configured ? status.stripe.mode : 'NOT SET'}`);
  console.log(`   Email:  ${status.email.configured ? status.email.host : 'NOT SET'}`);
  console.log(`   Zoom meetings: ${status.zoom.meetings.configured ? 'OK' : 'NOT SET'}`);
  console.log(`   Zoom SDK:      ${status.zoom.meetingSdk.configured ? 'OK' : 'NOT SET'}`);
  console.log(`   Soft-launch ready: ${status.readyForSoftLaunch ? 'YES' : 'NO'}`);

  console.log('3) Seat cap from platform settings…');
  const platform = await request('/settings/platform');
  const seatCap = platform.body.data?.maxClassSeats ?? 25;
  console.log(`   maxClassSeats = ${seatCap}`);
  assert(seatCap >= 1, 'Invalid seat cap');

  console.log('4) Ensure a free published class exists…');
  const mine = await request('/classes/my?pageSize=50', { token: teacher.token });
  let cls = (mine.body.data?.data || mine.body.data || []).find(
    (c) => c.price === 0 && c.status === 'published'
  );
  if (!cls) {
    const created = await request('/classes', {
      method: 'POST',
      token: teacher.token,
      body: {
        title: `Smoke Seat Cap Class ${Date.now()}`,
        description: 'Temporary free class for seat-cap smoke test.',
        category: 'Development',
        level: 'Beginner',
        price: 0,
        duration: 60,
        totalSessions: 1,
        status: 'published',
        language: 'English',
        learningOutcomes: ['Verify seat cap'],
        prerequisites: [],
        materials: [],
      },
    });
    assert(created.ok, `Create class failed: ${created.body?.message || created.status}`);
    cls = created.body.data;
  }
  console.log(`   Using class ${cls.id} (${cls.title})`);

  console.log('5) Learner enroll (free)…');
  const enroll = await request('/enrollments', {
    method: 'POST',
    token: student.token,
    body: { classId: cls.id },
  });
  assert(
    enroll.status === 201 || enroll.status === 200,
    `Enroll failed (${enroll.status}): ${enroll.body?.message}`
  );
  console.log(`   ${enroll.body?.message || 'enrolled'}`);

  console.log('6) Force class full, then prove next enroll is blocked…');
  // Direct DB bump via admin place? Use ClassModel through a temporary enroll flood with fake users is heavy.
  // Instead: PATCH via settings temporarily lower seat cap to current enrolled, then try enroll with a second student.
  const detail = await request(`/classes/${cls.id}`);
  const enrolled = detail.body.data?.enrolledStudents ?? 0;
  const prevCap = seatCap;

  // Set cap to current enrolled (or 1 if somehow 0) so class is full.
  const fullCap = Math.max(1, enrolled);
  const setFull = await request('/settings/platform', {
    method: 'PATCH',
    token: admin.token,
    body: { maxClassSeats: fullCap },
  });
  assert(setFull.ok, `Could not set seat cap: ${setFull.body?.message}`);

  // Second learner signup for overflow attempt
  const overflowEmail = `smoke.overflow.${Date.now()}@nexnoon.test`;
  const overflowPass = 'Smoke-Overflow-2026!';
  const signup = await request('/auth/signup', {
    method: 'POST',
    body: {
      firstName: 'Smoke',
      lastName: 'Overflow',
      email: overflowEmail,
      password: overflowPass,
      role: 'student',
    },
  });
  assert(signup.ok || signup.status === 409, `Signup failed: ${signup.body?.message}`);
  const overflowLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: overflowEmail, password: overflowPass },
  });
  assert(overflowLogin.ok, 'Overflow learner login failed');

  const blocked = await request('/enrollments', {
    method: 'POST',
    token: overflowLogin.body.data.token,
    body: { classId: cls.id },
  });
  assert(
    blocked.status === 409,
    `Expected 409 full class, got ${blocked.status}: ${blocked.body?.message}`
  );
  console.log(`   Blocked as expected: ${blocked.body?.message}`);

  // Restore seat cap
  await request('/settings/platform', {
    method: 'PATCH',
    token: admin.token,
    body: { maxClassSeats: prevCap },
  });
  console.log(`   Restored maxClassSeats to ${prevCap}`);

  console.log('\nSmoke passed: enroll works; seat cap blocks when full.');
  if (!status.readyForSoftLaunch) {
    console.log('Integrations still incomplete — fill Stripe / Zoom / Brevo, then re-run.');
    process.exitCode = 2;
  } else {
    console.log('Integrations look ready for a live Zoom + paid rehearsal.\n');
  }
}

main().catch((err) => {
  console.error('\nSmoke FAILED:', err.message || err);
  process.exit(1);
});
