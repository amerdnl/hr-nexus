/**
 * The public demo, checked without a database: the read-only rule, the reset
 * secret, and a dataset that stays fresh and fictional on any day it is rebuilt.
 *
 * The database half - every blocked action refused at the API and nothing
 * changed - is demo-readonly.integration.test.ts.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_ALLOWED_WRITES, isDemoRequestAllowed } from "../src/middleware/demoReadOnly.js";
import { hasResetSecret } from "../src/utils/demoSecret.js";
import {
  PRESENTATION_ID_MAX,
  PRESENTATION_ID_MIN,
  presentationAnnouncements,
  presentationDemoAccount,
  presentationDetails,
  presentationEmployees,
  presentationEmployeesOn,
  presentationEvents,
  presentationHolidaysFor,
  presentationLifecyclePlans,
  presentationRecognitions,
  presentationReviewCycles,
  presentationVacancies,
  reviewQuarters,
} from "../src/database/presentationData.js";
import { payrollMonths, presentationCalendar } from "../src/database/presentationLoader.js";

test("a demo account may read anything", () => {
  for (const method of ["GET", "HEAD", "OPTIONS", "get"]) {
    assert.equal(isDemoRequestAllowed(method, "/api/settings"), true, method);
  }
});

test("a demo account may only mark its own news read and sign out", () => {
  assert.equal(isDemoRequestAllowed("POST", "/api/auth/logout"), true);
  assert.equal(isDemoRequestAllowed("PUT", "/api/notifications/read-all"), true);
  assert.equal(isDemoRequestAllowed("PUT", "/api/notifications/42/read"), true);
  assert.equal(isDemoRequestAllowed("PUT", "/api/announcements/7/read"), true);
  assert.equal(DEMO_ALLOWED_WRITES.length, 4, "the allowlist only grows deliberately");
});

test("every other write is refused, including look-alikes of allowed ones", () => {
  for (const [method, path] of [
    ["PUT", "/api/settings"], ["PUT", "/api/leaves/policies/annual"], ["POST", "/api/settings/holidays"],
    ["PUT", "/api/profile/password"], ["PUT", "/api/profile"], ["POST", "/api/employees"],
    ["DELETE", "/api/employees/9205"], ["DELETE", "/api/employees/9205/permanent"], ["DELETE", "/api/departments/1"],
    ["PUT", "/api/dashboard/layout"], ["DELETE", "/api/dashboard/layout"], ["POST", "/api/import/jobs"],
    ["POST", "/api/payroll/periods"], ["PUT", "/api/leaves/1/status"], ["POST", "/api/org/positions"],
    ["PATCH", "/api/employees/1/reactivate"], ["POST", "/api/demo/reset"],
    // Shapes close to the allowlist that must not slip through.
    ["DELETE", "/api/notifications/read-all"], ["POST", "/api/notifications/read-all"],
    ["PUT", "/api/notifications/42/read/extra"], ["PUT", "/api/notifications/../settings"],
    ["PUT", "/api/announcements/7"], ["GETX", "/api/settings"], ["POST", "/api/auth/logout/../../settings"],
  ] as const) {
    assert.equal(isDemoRequestAllowed(method, path), false, `${method} ${path}`);
  }
});

test("the reset needs the exact secret as a bearer token", () => {
  const request = (authorization?: string) => ({ headers: authorization ? { authorization } : {} });
  const secret = "0123456789abcdef0123";
  assert.equal(hasResetSecret(request(`Bearer ${secret}`), secret), true);
  assert.equal(hasResetSecret(request(`Bearer ${secret}x`), secret), false);
  assert.equal(hasResetSecret(request(secret), secret), false);
  assert.equal(hasResetSecret(request(), secret), false);
  // A missing or short secret is never satisfied, not even by an empty token.
  assert.equal(hasResetSecret(request("Bearer "), ""), false);
  assert.equal(hasResetSecret(request("Bearer short"), "short"), false);
});

test("the demo account is in the reserved range with a fresh, non-trivial password", () => {
  assert.ok(presentationDemoAccount.id >= PRESENTATION_ID_MIN && presentationDemoAccount.id <= PRESENTATION_ID_MAX);
  assert.equal(presentationDemoAccount.email, "demo@meridian.example");
  // Simple enough to type from the login page, but not a stock password.
  assert.ok(presentationDemoAccount.password.length >= 12);
  assert.doesNotMatch(presentationDemoAccount.password, /^(password|admin|demo|123|qwerty|letmein|welcome)/i);
  assert.doesNotMatch(presentationDemoAccount.password, /\d{4}$/, "no year or PIN suffix to guess");
  assert.ok(!presentationEmployees.some((employee) => employee.id === presentationDemoAccount.id));
});

test("vacancies are positions, not people, and sit under real managers", () => {
  const ids = new Set(presentationEmployees.map((employee) => employee.id));
  assert.ok(presentationVacancies.length >= 2);
  for (const vacancy of presentationVacancies) {
    assert.ok(vacancy.id >= PRESENTATION_ID_MIN && vacancy.id <= PRESENTATION_ID_MAX);
    assert.ok(!ids.has(vacancy.id), `${vacancy.id} collides with a person`);
    assert.ok(ids.has(vacancy.managerId), `${vacancy.title} reports to someone real`);
  }
});

test("no address or phone number points at a real place or line", () => {
  for (const detail of presentationDetails) {
    if (detail.address) assert.match(detail.address, /Contoh/, `${detail.address} is fictional`);
    if (detail.emergencyContactPhone) assert.match(detail.emergencyContactPhone, /^\+60 3-0000 \d{4}$/);
  }
  for (const text of [
    ...presentationEvents(presentationCalendar("2026-11-24")).map((event) => `${event.title} ${event.location ?? ""}`),
    ...presentationRecognitions(presentationCalendar("2026-11-24")).map((entry) => entry.message),
  ]) {
    assert.doesNotMatch(text, /Astra|Bangsar|Mont Kiara|Port Dickson/);
  }
});

test("payroll months are always the last three paid and this month open, across New Year", () => {
  assert.deepEqual(payrollMonths("2026-11-24"), [
    { year: 2026, month: 8, status: "paid" }, { year: 2026, month: 9, status: "paid" },
    { year: 2026, month: 10, status: "paid" }, { year: 2026, month: 11, status: "draft" },
  ]);
  assert.deepEqual(payrollMonths("2027-02-03").map(({ year, month }) => `${year}-${month}`), ["2026-11", "2026-12", "2027-1", "2027-2"]);
});

test("review cycles review the quarter just ended, and the one before is closed", () => {
  assert.deepEqual(reviewQuarters("2026-11-24"), {
    open: { name: "Q3 2026 review", start: "2026-07-01", end: "2026-09-30" },
    closed: { name: "Q2 2026 review", start: "2026-04-01", end: "2026-06-30" },
  });
  assert.equal(reviewQuarters("2027-01-08").open.name, "Q4 2026 review");
  assert.equal(reviewQuarters("2027-02-15").closed.name, "Q3 2026 review");
});

test("holidays outside 2026 are only the fixed-date ones, and the Agong's birthday is a Monday", () => {
  const rows = presentationHolidaysFor([2027]);
  assert.equal(rows.length, 7);
  const agong = rows.find((row) => /Agong/.test(row.name))!;
  assert.equal(new Date(`${agong.date}T00:00:00Z`).getUTCDay(), 1);
  assert.ok(presentationHolidaysFor([2025, 2026, 2027]).length > 20);
});

// The dataset must be coherent on any day it is rebuilt: a Monday, a Friday,
// New Year, a weekend, and a year with no gazetted holiday list.
for (const today of ["2026-11-24", "2026-11-27", "2027-01-04", "2027-01-09", "2027-06-30", "2028-03-01"]) {
  test(`the company is fresh and coherent on ${today}`, () => {
    const calendar = presentationCalendar(today);
    const employees = presentationEmployeesOn(calendar);

    for (const id of [9208, 9221]) {
      const joiner = employees.find((employee) => employee.id === id)!;
      assert.ok(joiner.employmentDate < today, `${id} has started`);
      assert.ok(joiner.employmentDate >= calendar.addDays(today, -60), `${id} is still a recent joiner`);
    }

    for (const announcement of presentationAnnouncements(calendar)) {
      if (announcement.publishedOn) assert.ok(announcement.publishedOn <= today, `${announcement.key} is not from the future`);
      assert.doesNotMatch(announcement.title + announcement.body, /Mid-year 2026|16 September|3 August/);
    }

    for (const cycle of presentationReviewCycles(calendar)) {
      assert.ok(cycle.openedOn <= today, `${cycle.name} opened by today`);
      assert.ok(cycle.periodEnd < today, `${cycle.name} reviews a period that has ended`);
      if (cycle.closedOn) assert.ok(cycle.closedOn < today);
      for (const review of cycle.reviews) {
        for (const stamp of [review.self?.[2], review.manager?.[2], review.response?.[1]]) {
          if (stamp) assert.ok(stamp <= today, `${cycle.name}: nothing is written in the future`);
        }
      }
    }

    for (const plan of presentationLifecyclePlans(calendar)) {
      assert.ok(plan.startsOn <= today, "every plan has started");
      if (plan.template === "onboarding") {
        assert.ok(plan.targetDate >= calendar.addDays(today, -20), "onboarding is current, not months old");
      }
    }

    const haziq = employees.find((employee) => employee.id === 9208)!;
    const mentoring = presentationRecognitions(calendar).find((entry) => /Danny/.test(entry.message))!;
    assert.ok(mentoring.givenOn > haziq.employmentDate, "nobody is thanked for mentoring someone before they joined");
  });
}
