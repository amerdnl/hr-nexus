/**
 * Writes the Meridian Digital company into a database, inside a transaction the
 * caller owns.
 *
 * Two callers use it: `seedPresentation.ts`, which loads a local presentation
 * environment from the command line, and `demoReset.ts`, which rebuilds the
 * public demo every night. Neither the loader nor anything it imports touches
 * the application's connection pool, so it can only ever write through the
 * client it is handed.
 *
 * TIME. The company's own today, in Asia/Kuala_Lumpur, decides what "now"
 * means: attendance today, who is away, what is overdue, which payroll months
 * are paid and which review cycle is open. Rebuilding on another day produces a
 * company that is coherent on that day. Within one day the result is
 * deterministic, because the only variation comes from a seeded generator keyed
 * to the date.
 */
import type { PoolClient } from "pg";
import { calculatePeriod, openPeriod, refreshRecordTotals } from "../services/payrollService.js";
import {
  PRESENTATION_ID_MAX,
  PRESENTATION_ID_MIN,
  formatMonth,
  presentationAdmin,
  presentationAnnouncements,
  presentationCompany,
  presentationDemoAccount,
  presentationDepartments,
  presentationDetails,
  presentationEmployeeAccount,
  presentationEmployeeAccounts,
  presentationEmployeesOn,
  presentationEvents,
  presentationGoals,
  presentationHolidaysFor,
  presentationLeave,
  presentationLifecyclePlans,
  presentationLifecycleTemplates,
  presentationManagerAccount,
  presentationProfiles,
  presentationRecognitions,
  presentationReviewCycles,
  presentationTimeline,
  presentationVacancies,
  seededRandom,
  type PresentationCalendar,
} from "./presentationData.js";

/** ISO date arithmetic in UTC, so the host timezone cannot shift the dataset. */
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** The company's own clock, not the host's. */
export function companyNow(at: Date = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: presentationCompany.timezone,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(at);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: (Number(value("hour")) % 24) * 60 + Number(value("minute")),
  };
}

const minutesToTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;

/** Working days, public holidays and date arithmetic for one company today. */
export function presentationCalendar(today: string): PresentationCalendar & {
  isWorkingDay: (date: string) => boolean;
  holidays: Array<{ date: string; name: string }>;
} {
  const year = Number(today.slice(0, 4));
  const holidays = presentationHolidaysFor([year - 1, year, year + 1]);
  const holidayDates = new Set(holidays.map((holiday) => holiday.date));
  const isWorkingDay = (date: string) =>
    presentationCompany.workingDays.includes(isoWeekday(date)) && !holidayDates.has(date);
  const addWorkingDays = (date: string, days: number): string => {
    let cursor = date;
    const step = days >= 0 ? 1 : -1;
    for (let left = Math.abs(days); left > 0; left -= 1) {
      do { cursor = addDays(cursor, step); } while (!isWorkingDay(cursor));
    }
    return cursor;
  };
  return { today, addDays, addWorkingDays, isWorkingDay, holidays };
}

/** The last `count` whole months before today's, oldest first, then today's own month. */
export function payrollMonths(today: string, count = 3): Array<{ year: number; month: number; status: "paid" | "draft" }> {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const months: Array<{ year: number; month: number; status: "paid" | "draft" }> = [];
  for (let back = count; back >= 1; back -= 1) {
    const index = year * 12 + (month - 1) - back;
    months.push({ year: Math.floor(index / 12), month: (index % 12) + 1, status: "paid" });
  }
  months.push({ year, month, status: "draft" });
  return months;
}

/**
 * The statutory deductions a payroll executive enters by hand, as the product
 * expects: HR Nexus does not calculate EPF, SOCSO, EIS or PCB, so these are
 * manual lines marked statutory. The figures are illustrative approximations
 * (EPF 11% of basic; SOCSO and EIS on wages up to RM 6,000; a rough PCB), not
 * a statutory calculation, and are written while the period is still open.
 */
async function addStatutoryLines(client: PoolClient, periodId: string): Promise<void> {
  const records = await client.query<{ id: string; basic: string; gross: string }>(
    "SELECT id, basic_salary_sen AS basic, gross_sen AS gross FROM public.payroll_records WHERE period_id = $1",
    [periodId],
  );
  for (const record of records.rows) {
    const basic = Number(record.basic);
    const gross = Number(record.gross);
    const insurable = Math.min(gross, 600000);
    const lines: Array<[string, number]> = [
      ["EPF (employee, 11%)", Math.round(basic * 0.11)],
      ["SOCSO (employee)", Math.round(insurable * 0.005)],
      ["EIS (employee)", Math.round(insurable * 0.002)],
      ["PCB (monthly tax deduction)", Math.max(0, Math.round((gross - 350000) * 0.09))],
    ];
    for (const [label, amount] of lines) {
      if (amount <= 0) continue;
      await client.query(
        `INSERT INTO public.payroll_items
           (record_id, item_type, code, label, amount_sen, is_manual, is_statutory, note, created_by)
         VALUES ($1, 'deduction', 'statutory', $2, $3, TRUE, TRUE, NULL, $4)`,
        [record.id, label, amount, presentationAdmin.id],
      );
    }
    await refreshRecordTotals(client, record.id);
  }
}

export interface LoadOptions {
  /** The company's date, YYYY-MM-DD. */
  today: string;
  /** Minutes after midnight that today's attendance is drawn as of. */
  nowMinutes: number;
  /** bcrypt hash for the HR administrator, manager and employee sign-ins. */
  staffPasswordHash: string;
  /** bcrypt hash for the read-only public demo sign-in. */
  demoPasswordHash: string;
}

export interface LoadSummary {
  company: string;
  companyToday: string;
  seededAsOf: string;
  departments: number;
  employees: number;
  vacancies: number;
  attendanceRows: number;
  todayPresent: number;
  todayLate: number;
  todayOnLeave: number;
  leaveRequests: number;
  payrollPeriods: string[];
  payslipsInLatestPaidPeriod: number;
  holidays: number;
  events: number;
  announcements: number;
  lifecyclePlans: number;
  recognitions: number;
  goals: number;
  reviewCycles: number;
  notifications: number;
  auditEvents: number;
  preparedDashboardFor: string | null;
  accounts: { demo: string; admin: string; manager: string; employee: string };
}

export async function loadPresentationCompany(client: PoolClient, options: LoadOptions): Promise<LoadSummary> {
  const { today, nowMinutes, staffPasswordHash, demoPasswordHash } = options;
  const ledger = await client.query<{ version: string }>("SELECT version FROM public.schema_migrations ORDER BY version");
  const versions = ledger.rows.map((row) => row.version);
  if (!versions.includes("0023")) {
    throw new Error(`The database is not fully migrated (ledger ends at ${versions.at(-1) ?? "nothing"}); apply the migrations first.`);
  }

  // ------------------------------------------------------------- calendar
  const calendar = presentationCalendar(today);
  const { isWorkingDay } = calendar;
  const year = Number(today.slice(0, 4));
  // The product counts leave on the company working week alone: a public holiday
  // inside a leave range still counts as leave, which the leave page states.
  // Seeding any other rule would show figures the product would never produce.
  const countLeaveDays = (start: string, end: string): number => {
    let count = 0;
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      if (presentationCompany.workingDays.includes(isoWeekday(cursor))) count += 1;
    }
    return count;
  };

  const employees = presentationEmployeesOn(calendar);
  const leave = presentationLeave(calendar);
  const events = presentationEvents(calendar);
  const announcements = presentationAnnouncements(calendar);
  const plans = presentationLifecyclePlans(calendar);
  const recognitions = presentationRecognitions(calendar);
  const goals = presentationGoals(calendar);
  const reviewCycles = presentationReviewCycles(calendar);
  const months = payrollMonths(today);
  const holidays = calendar.holidays;

  // ------------------------------------------------------ company settings
  await client.query(
    `UPDATE public.company_settings
     SET company_name = $1, timezone = $2, working_days = $3::smallint[], work_start_time = $4::time,
         work_end_time = $5::time, grace_period_minutes = $6, office_latitude = $7, office_longitude = $8,
         attendance_radius_meters = $9, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`,
    [
      presentationCompany.name, presentationCompany.timezone, presentationCompany.workingDays,
      presentationCompany.workStart, presentationCompany.workEnd, presentationCompany.graceMinutes,
      presentationCompany.officeLatitude, presentationCompany.officeLongitude, presentationCompany.radiusMeters,
    ],
  );

  // ---------------------------------------------------- clear previous run
  // Only rows owned by the reserved range. A full rebuild (the demo reset, or
  // presentation-reset.sh) starts from empty tables and finds nothing here.
  await client.query(
    `DELETE FROM public.payroll_items WHERE record_id IN (
       SELECT id FROM public.payroll_records WHERE employee_id BETWEEN $1 AND $2)`,
    [PRESENTATION_ID_MIN, PRESENTATION_ID_MAX],
  );
  await client.query("DELETE FROM public.payroll_records WHERE employee_id BETWEEN $1 AND $2", [PRESENTATION_ID_MIN, PRESENTATION_ID_MAX]);
  for (const { year: periodYear, month } of months) {
    await client.query("DELETE FROM public.payroll_periods WHERE period_year = $1 AND period_month = $2", [periodYear, month]);
  }
  for (const table of ["employee_compensation", "leave_entitlements", "leave_requests", "attendance", "employee_profiles"]) {
    await client.query(`DELETE FROM public.${table} WHERE employee_id BETWEEN $1 AND $2`, [PRESENTATION_ID_MIN, PRESENTATION_ID_MAX]);
  }
  await client.query(
    `DELETE FROM public.lifecycle_tasks WHERE plan_id IN (
       SELECT id FROM public.lifecycle_plans WHERE employee_id BETWEEN $1 AND $2)`,
    [PRESENTATION_ID_MIN, PRESENTATION_ID_MAX],
  );
  await client.query("DELETE FROM public.lifecycle_plans WHERE employee_id BETWEEN $1 AND $2", [PRESENTATION_ID_MIN, PRESENTATION_ID_MAX]);
  for (const table of ["lifecycle_templates", "announcements", "company_events", "company_holidays"]) {
    await client.query(`DELETE FROM public.${table} WHERE created_by = $1`, [presentationAdmin.id]);
  }
  await client.query("UPDATE public.employees SET manager_id = NULL WHERE id BETWEEN $1 AND $2", [PRESENTATION_ID_MIN, PRESENTATION_ID_MAX]);
  await client.query("DELETE FROM public.users WHERE id BETWEEN $1 AND $2", [PRESENTATION_ID_MIN, PRESENTATION_ID_MAX]);
  await client.query("DELETE FROM public.users WHERE employee_id BETWEEN $1 AND $2", [PRESENTATION_ID_MIN, PRESENTATION_ID_MAX]);
  await client.query("DELETE FROM public.employees WHERE id BETWEEN $1 AND $2", [PRESENTATION_ID_MIN, PRESENTATION_ID_MAX]);

  // ----------------------------------------------------------- departments
  for (const department of presentationDepartments) {
    await client.query(
      `INSERT INTO public.departments (name, description) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
      [department.name, department.description],
    );
  }
  const departmentIds = new Map<string, number>(
    (await client.query<{ id: number; name: string }>("SELECT id, name FROM public.departments")).rows
      .map((row) => [row.name, row.id]),
  );

  // ------------------------------------------------------------- employees
  const detail = (id: number) => presentationDetails.find((row) => row.employeeId === id);
  for (const employee of employees) {
    await client.query(
      `INSERT INTO public.employees
         (id, employee_number, full_name, department_id, job_title, employment_status, employment_date, phone,
          address, date_of_birth, emergency_contact_name, emergency_contact_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        employee.id, employee.employeeNumber, employee.fullName,
        departmentIds.get(employee.department) ?? null, employee.jobTitle,
        employee.status, employee.employmentDate,
        // The unallocated 03-0000 block, which cannot ring a real line.
        `+60 3-0000 ${String(employee.id).slice(-4)}`,
        detail(employee.id)?.address ?? null, detail(employee.id)?.dateOfBirth ?? null,
        detail(employee.id)?.emergencyContactName ?? null, detail(employee.id)?.emergencyContactPhone ?? null,
      ],
    );
  }
  for (const employee of employees) {
    if (employee.managerId === undefined) continue;
    await client.query("UPDATE public.employees SET manager_id = $1 WHERE id = $2", [employee.managerId, employee.id]);
  }
  // Open seats on the chart: positions with a title and a place, and no person.
  for (const vacancy of presentationVacancies) {
    await client.query(
      `INSERT INTO public.employees
         (id, employee_number, full_name, job_title, department_id, employment_status,
          position_kind, occupancy, position_notes, manager_id)
       VALUES ($1, $2, $3, NULL, $4, 'active', 'vacant', 'vacant', $5, $6)`,
      [vacancy.id, vacancy.employeeNumber, vacancy.title, departmentIds.get(vacancy.department) ?? null,
        vacancy.notes, vacancy.managerId],
    );
  }
  for (const profile of presentationProfiles) {
    await client.query(
      `INSERT INTO public.employee_profiles (employee_id, about, skills, share_phone) VALUES ($1,$2,$3,$4)`,
      [profile.employeeId, profile.about, profile.skills, profile.sharePhone],
    );
  }
  for (const event of presentationTimeline) {
    await client.query(
      `INSERT INTO public.employee_events (employee_id, kind, visibility, occurred_on, title, source_type, source_id)
       VALUES ($1,$2,'company',$3,$4,'presentation_seed',$5) ON CONFLICT DO NOTHING`,
      [event.employeeId, event.kind, event.occurredOn, event.title, `${event.kind}:${event.occurredOn}`],
    );
  }

  // ------------------------------------------------------------- accounts
  // One HR administrator, one manager and one employee, plus the public demo
  // sign-in. Everyone else is a personnel record without a sign-in, as in a
  // real company.
  await client.query(
    `INSERT INTO public.users (id, employee_id, email, password_hash, role, is_active, must_change_password)
     VALUES ($1, NULL, $2, $3, 'admin', TRUE, FALSE)`,
    [presentationAdmin.id, presentationAdmin.email, staffPasswordHash],
  );
  for (const account of presentationEmployeeAccounts) {
    await client.query(
      `INSERT INTO public.users (id, employee_id, email, password_hash, role, is_active, must_change_password)
       VALUES ($1, $1, $2, $3, 'employee', TRUE, FALSE)`,
      [account.id, account.email, staffPasswordHash],
    );
  }
  // An administrator who can see everything and change nothing: the API
  // refuses every write from an account with demo_read_only set.
  await client.query(
    `INSERT INTO public.users (id, employee_id, email, password_hash, role, is_active, must_change_password, demo_read_only)
     VALUES ($1, NULL, $2, $3, 'admin', TRUE, FALSE, TRUE)`,
    [presentationDemoAccount.id, presentationDemoAccount.email, demoPasswordHash],
  );

  // ---------------------------------------------------------- compensation
  // Effective from the start of the year before the oldest payroll month, or
  // from the start date for anyone who joined since.
  const compensationFrom = `${months[0]!.year - 1}-01-01`;
  for (const employee of employees) {
    if (employee.basicSalarySen === undefined) continue;
    await client.query(
      `INSERT INTO public.employee_compensation
         (employee_id, basic_salary_sen, allowance_sen, overtime_rate_sen, effective_from)
       VALUES ($1,$2,$3,$4,$5)`,
      [employee.id, employee.basicSalarySen, employee.allowanceSen ?? 0, employee.overtimeRateSen ?? 0,
        employee.employmentDate > compensationFrom ? employee.employmentDate : compensationFrom],
    );
  }

  // ------------------------------------------------------------ attendance
  // Just over four months of history on working days only, then today's own
  // state as of `nowMinutes`: whoever should be in by then is in, and nobody
  // has a check-out time before they would have left.
  //
  // Seeded history carries no verification method or status. It claims
  // nothing: the product reads such a record as one that predates
  // verification, rather than as a QR and location scan that never happened.
  //
  // Collected first and written in one statement: thousands of single-row
  // inserts are what made a rebuild slow over a network connection.
  const random = seededRandom(Number(today.replaceAll("-", "")));
  const historyStart = addDays(today, -125);
  const approvedLeave = leave.filter((request) => request.status === "approved");
  const onLeave = (employeeId: number, date: string) =>
    approvedLeave.some((request) => request.employee === employeeId && date >= request.start && date <= request.end);

  const workStartMinutes = Number(presentationCompany.workStart.slice(0, 2)) * 60;
  const rows = { employee: [] as number[], date: [] as string[], checkIn: [] as (string | null)[],
    checkOut: [] as (string | null)[], status: [] as string[], late: [] as number[] };
  const push = (employeeId: number, date: string, status: string, checkIn: string | null = null,
    checkOut: string | null = null, late = 0) => {
    rows.employee.push(employeeId); rows.date.push(date); rows.status.push(status);
    rows.checkIn.push(checkIn); rows.checkOut.push(checkOut); rows.late.push(late);
  };
  let todayPresent = 0;
  let todayLate = 0;
  let todayOnLeave = 0;

  for (const employee of employees) {
    if (employee.status === "resigned" || employee.status === "inactive") continue;
    for (let date = historyStart; date <= today; date = addDays(date, 1)) {
      if (!isWorkingDay(date)) continue;
      if (date < employee.employmentDate) continue;

      if (onLeave(employee.id, date)) {
        push(employee.id, date, "on_leave");
        if (date === today) todayOnLeave += 1;
        continue;
      }

      const roll = random();
      // A quiet minority of days have no record or an absence, as in any company.
      if (date !== today && roll < 0.015) continue;
      if (date !== today && roll < 0.03) {
        push(employee.id, date, "absent");
        continue;
      }

      // Arrival: mostly a little before nine, sometimes later than the grace
      // period allows. Every timestamp is its own minute.
      const late = roll > 0.86;
      const arrival = late
        ? workStartMinutes + presentationCompany.graceMinutes + 3 + Math.floor(random() * 32)
        : workStartMinutes - 25 + Math.floor(random() * 37);
      const elapsed = Math.max(0, arrival - workStartMinutes);
      const isLate = elapsed > presentationCompany.graceMinutes;
      const departure = 17 * 60 + 50 + Math.floor(random() * 75);
      const forgotCheckout = random() < 0.035;

      if (date === today) {
        if (nowMinutes < arrival) continue;                         // not in yet
        const left = nowMinutes >= departure && !forgotCheckout;
        push(employee.id, date, isLate ? "late" : "present", minutesToTime(arrival),
          left ? minutesToTime(departure) : null, isLate ? elapsed : 0);
        isLate ? (todayLate += 1) : (todayPresent += 1);
        continue;
      }

      push(employee.id, date, isLate ? "late" : "present", minutesToTime(arrival),
        forgotCheckout ? null : minutesToTime(departure), isLate ? elapsed : 0);
    }
  }
  if (rows.employee.length > 0) {
    await client.query(
      `INSERT INTO public.attendance (employee_id, attendance_date, check_in_time, check_out_time, status, late_minutes)
       SELECT * FROM unnest($1::bigint[], $2::date[], $3::time[], $4::time[], $5::varchar[], $6::int[])`,
      [rows.employee, rows.date, rows.checkIn, rows.checkOut, rows.status, rows.late],
    );
  }
  const attendanceRows = rows.employee.length;

  // ----------------------------------------------------------------- leave
  // The entitlement everyone carries for this year and the last, so history
  // that crosses New Year still has a balance to count against.
  for (const employee of employees) {
    if (employee.status === "resigned") continue;
    const senior = employee.employmentDate < `${year - 4}-01-01`;
    for (const leaveYear of [year - 1, year]) {
      if (employee.employmentDate > `${leaveYear}-12-31`) continue;
      for (const [type, days] of [["annual", senior ? 18 : 14], ["medical", 14], ["emergency", 3]] as const) {
        await client.query(
          `INSERT INTO public.leave_entitlements
             (employee_id, leave_year, leave_type, entitled_days, carried_forward_days, adjustment_days, source)
           VALUES ($1, $2, $3, $4, $5, 0, 'policy')`,
          [employee.id, leaveYear, type, days, type === "annual" && senior ? 2 : 0],
        );
      }
    }
  }

  // A decision is attributed to whoever would have made it: the requester's own
  // manager when that manager has a sign-in, and HR otherwise. A cancellation
  // belongs to the requester when they have an account, and to HR when they do not.
  const accountIds = new Set([presentationAdmin.id, ...presentationEmployeeAccounts.map((account) => account.id)]);
  const actorFor = (employeeIdOfRequest: number) => {
    const person = employees.find((entry) => entry.id === employeeIdOfRequest);
    return person?.managerId !== undefined && accountIds.has(person.managerId) ? person.managerId : presentationAdmin.id;
  };
  for (const [index, request] of leave.entries()) {
    await client.query(
      `INSERT INTO public.leave_requests
         (employee_id, leave_type, start_date, end_date, reason, status, working_days, leave_year,
          reviewed_at, reviewed_by, cancelled_at, cancelled_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6::varchar,$7,$10,
               CASE WHEN $6::varchar IN ('approved','rejected') THEN ($3::date - interval '6 days') END,
               CASE WHEN $6::varchar IN ('approved','rejected') THEN $8::int END,
               CASE WHEN $6::varchar = 'cancelled' THEN ($3::date - interval '4 days') END,
               CASE WHEN $6::varchar = 'cancelled' THEN $9::int END,
               -- Applied nine days ahead, but never in the future: requests for
               -- far-off dates were sent over the last few days.
               LEAST($3::date - interval '9 days', CURRENT_TIMESTAMP - make_interval(days => $11::int, hours => $12::int)))`,
      [
        request.employee, request.type, request.start, request.end, request.reason, request.status,
        countLeaveDays(request.start, request.end), actorFor(request.employee),
        accountIds.has(request.employee) ? request.employee : presentationAdmin.id,
        Number(request.start.slice(0, 4)),
        1 + (index % 6), (index * 5) % 9,
      ],
    );
  }

  // -------------------------------------------------------- workplace layer
  for (const holiday of holidays) {
    await client.query(
      `INSERT INTO public.company_holidays (holiday_date, name, created_by, updated_by)
       VALUES ($1,$2,$3,$3) ON CONFLICT (holiday_date) DO NOTHING`,
      [holiday.date, holiday.name, presentationAdmin.id],
    );
  }
  for (const event of events) {
    await client.query(
      `INSERT INTO public.company_events
         (title, description, location, starts_on, ends_on, start_time, end_time, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
      [event.title, event.description ?? null, event.location ?? null, event.startsOn,
        event.endsOn ?? event.startsOn, event.startTime ?? null, event.endTime ?? null, presentationAdmin.id],
    );
  }
  const announcementIds = new Map<string, number>();
  for (const announcement of announcements) {
    const created = await client.query<{ id: string }>(
      `INSERT INTO public.announcements
         (title, body, priority, audience, department_id, status, expires_on,
          published_at, published_by, created_by, updated_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6::varchar,$7,
               CASE WHEN $8::date IS NULL THEN NULL ELSE ($8::date + time '09:00') AT TIME ZONE 'Asia/Kuala_Lumpur' END,
               CASE WHEN $6::varchar = 'published' THEN $9::int END, $9, $9,
               COALESCE(($8::date + time '08:30') AT TIME ZONE 'Asia/Kuala_Lumpur', CURRENT_TIMESTAMP),
               COALESCE(($8::date + time '09:00') AT TIME ZONE 'Asia/Kuala_Lumpur', CURRENT_TIMESTAMP))
       RETURNING id`,
      [
        announcement.title, announcement.body, announcement.priority,
        announcement.department ? "department" : "company",
        announcement.department ? departmentIds.get(announcement.department) ?? null : null,
        announcement.status, announcement.expiresOn ?? null,
        announcement.status === "published" ? announcement.publishedOn ?? null : null, presentationAdmin.id,
      ],
    );
    announcementIds.set(announcement.key, Number(created.rows[0]!.id));
  }

  // Onboarding and offboarding: checklists first, then each person's own copy.
  const templateIds = new Map<string, number>();
  for (const template of presentationLifecycleTemplates) {
    const created = await client.query<{ id: string }>(
      `INSERT INTO public.lifecycle_templates (kind, name, description, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$4) RETURNING id`,
      [template.kind, template.name, template.description, presentationAdmin.id],
    );
    const templateId = Number(created.rows[0]!.id);
    templateIds.set(template.key, templateId);
    for (const [index, task] of template.tasks.entries()) {
      await client.query(
        `INSERT INTO public.lifecycle_template_tasks (template_id, position, title, instructions, assignee_role, due_offset_days)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [templateId, index + 1, task.title, task.instructions ?? null, task.role, task.offset],
      );
    }
  }
  for (const plan of plans) {
    const template = presentationLifecycleTemplates.find((item) => item.key === plan.template)!;
    const created = await client.query<{ id: string }>(
      `INSERT INTO public.lifecycle_plans (employee_id, kind, template_id, title, starts_on, target_date, exit_status, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,($5::date + time '09:00') AT TIME ZONE 'Asia/Kuala_Lumpur') RETURNING id`,
      [plan.employeeId, template.kind, templateIds.get(plan.template), template.name, plan.startsOn,
        plan.targetDate, plan.exitStatus ?? null, presentationAdmin.id],
    );
    const planId = Number(created.rows[0]!.id);
    const anchor = template.kind === "onboarding" ? plan.startsOn : plan.targetDate;
    for (const [index, task] of template.tasks.entries()) {
      const due = addDays(anchor, task.offset);
      const finished = plan.done.includes(index + 1);
      await client.query(
        `INSERT INTO public.lifecycle_tasks (plan_id, position, title, instructions, assignee_role, due_on, status, completed_at, completed_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7::varchar,
                 CASE WHEN $7::varchar = 'done' THEN ($6::date + time '16:30') AT TIME ZONE 'Asia/Kuala_Lumpur' END,
                 CASE WHEN $7::varchar = 'done' THEN $8::int END)`,
        [planId, index + 1, task.title, task.instructions ?? null, task.role, due, finished ? "done" : "pending", presentationAdmin.id],
      );
    }
    if (template.kind === "onboarding") {
      await client.query(
        `INSERT INTO public.employee_events (employee_id, kind, visibility, occurred_on, title, source_type, source_id)
         VALUES ($1,'onboarding_started','company',$2,'Started onboarding','presentation_seed',$3) ON CONFLICT DO NOTHING`,
        [plan.employeeId, plan.startsOn, `onboarding:${plan.startsOn}`],
      );
    }
  }

  // Recognition, and the timeline entries it produces.
  const recognitionIds: number[] = [];
  for (const recognition of recognitions) {
    const created = await client.query<{ id: string }>(
      `INSERT INTO public.recognitions
         (giver_employee_id, receiver_employee_id, category, message, visibility, given_on, created_by, created_at)
       VALUES ($1::int,$2,$3,$4,$5,$6,(SELECT u.id FROM public.users u WHERE u.employee_id = $1::int),
               ($6::date + time '11:20') AT TIME ZONE 'Asia/Kuala_Lumpur') RETURNING id`,
      [recognition.giver, recognition.receiver, recognition.category, recognition.message, recognition.visibility, recognition.givenOn],
    );
    const id = Number(created.rows[0]!.id);
    recognitionIds.push(id);
    const giver = employees.find((employee) => employee.id === recognition.giver)!;
    const label = recognition.category.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
    await client.query(
      `INSERT INTO public.employee_events (employee_id, kind, visibility, occurred_on, title, source_type, source_id)
       VALUES ($1,'recognition_received',$2,$3,$4,'recognition',$5)`,
      [
        recognition.receiver,
        recognition.visibility === "company" ? "company" : "self",
        recognition.givenOn,
        recognition.visibility === "company" ? `Recognised for ${label} by ${giver.fullName}` : `Recognised for ${label}`,
        String(id),
      ],
    );
  }

  // Goals and their history.
  for (const goal of goals) {
    const created = await client.query<{ id: string }>(
      `INSERT INTO public.goals (owner_employee_id, title, description, starts_on, due_on, status, progress, visibility,
         created_as, created_by, created_at, completed_at, updated_at)
       VALUES ($1::int,$2,$3,$4::date,$5::date,$6::varchar,$7,$8,$9,
               (SELECT u.id FROM public.users u WHERE u.employee_id = $10::int),
               ($4::date + time '09:30') AT TIME ZONE 'Asia/Kuala_Lumpur',
               CASE WHEN $6::varchar = 'completed' THEN ($11::date + time '16:00') AT TIME ZONE 'Asia/Kuala_Lumpur' END,
               CURRENT_TIMESTAMP)
       RETURNING id`,
      [goal.owner, goal.title, goal.description, goal.startsOn, goal.dueOn, goal.status, goal.progress, goal.visibility,
        goal.setBy === goal.owner ? "owner" : "manager", goal.setBy, goal.completedOn ?? null],
    );
    const goalId = Number(created.rows[0]!.id);
    for (const update of goal.updates) {
      await client.query(
        `INSERT INTO public.goal_updates (goal_id, author_user_id, author_role, progress_before, progress_after,
           status_before, status_after, note, created_at)
         VALUES ($1,(SELECT u.id FROM public.users u WHERE u.employee_id = $2::int),$3,$4,$5,'active',$6,$7,
                 ($8::date + time '17:10') AT TIME ZONE 'Asia/Kuala_Lumpur')`,
        [goalId, update.by, update.by === goal.owner ? "owner" : "manager", update.from, update.to,
          update.status ?? "active", update.note ?? null, update.on],
      );
    }
    if (goal.status === "completed" && goal.visibility === "company") {
      await client.query(
        `INSERT INTO public.employee_events (employee_id, kind, visibility, occurred_on, title, source_type, source_id)
         VALUES ($1,'goal_completed','company',$2,$3,'goal',$4)`,
        [goal.owner, goal.completedOn, `Completed a goal: ${goal.title}`, String(goalId)],
      );
    }
  }

  // Review cycles and the reviews inside them.
  const reviewIds = new Map<string, number>();
  for (const cycle of reviewCycles) {
    const created = await client.query<{ id: string }>(
      `INSERT INTO public.review_cycles (name, period_start, period_end, self_due_on, manager_due_on, status,
         opened_at, opened_by, closed_at, closed_by, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6::varchar,
               ($7::date + time '09:00') AT TIME ZONE 'Asia/Kuala_Lumpur', $8::int,
               CASE WHEN $6::varchar = 'closed' THEN ($9::date + time '17:00') AT TIME ZONE 'Asia/Kuala_Lumpur' END,
               CASE WHEN $6::varchar = 'closed' THEN $8::int END,
               $8::int, ($7::date + time '08:00') AT TIME ZONE 'Asia/Kuala_Lumpur')
       RETURNING id`,
      [cycle.name, cycle.periodStart, cycle.periodEnd, cycle.selfDueOn, cycle.managerDueOn, cycle.status,
        cycle.openedOn, presentationAdmin.id, cycle.closedOn ?? null],
    );
    const cycleId = Number(created.rows[0]!.id);
    const people = cycle.departments.length === 0
      ? cycle.reviews.map((review) => review.employee)
      : employees
        .filter((employee) => cycle.departments.includes(employee.department)
          && (employee.status === "active" || employee.status === "probation"))
        .map((employee) => employee.id);
    for (const employeeId of people) {
      const review = cycle.reviews.find((entry) => entry.employee === employeeId);
      const status = review?.manager ? "completed" : review?.self ? "pending_manager" : "pending_self";
      const row = await client.query<{ id: string }>(
        `INSERT INTO public.review_participants (cycle_id, employee_id, status,
           self_summary, self_rating, self_submitted_at,
           manager_summary, manager_rating, manager_submitted_at, manager_submitted_by,
           employee_response, responded_at, created_at)
         VALUES ($1,$2,$3,
           $4,$5,($6::date + time '15:00') AT TIME ZONE 'Asia/Kuala_Lumpur',
           $7,$8,($9::date + time '15:00') AT TIME ZONE 'Asia/Kuala_Lumpur',
           (SELECT u.id FROM public.users u WHERE u.employee_id = $10::int),
           $11,($12::date + time '10:00') AT TIME ZONE 'Asia/Kuala_Lumpur',
           ($13::date + time '09:00') AT TIME ZONE 'Asia/Kuala_Lumpur')
         RETURNING id`,
        [
          cycleId, employeeId, status,
          review?.self?.[1] ?? null, review?.self?.[0] ?? null, review?.self?.[2] ?? null,
          review?.manager?.[1] ?? null, review?.manager?.[0] ?? null, review?.manager?.[2] ?? null, review?.manager?.[3] ?? null,
          review?.response?.[0] ?? null, review?.response?.[1] ?? null,
          cycle.openedOn,
        ],
      );
      reviewIds.set(`${cycle.key}:${employeeId}`, Number(row.rows[0]!.id));
      if (review?.manager) {
        await client.query(
          `INSERT INTO public.employee_events (employee_id, kind, visibility, occurred_on, title, source_type, source_id)
           VALUES ($1,'review_completed','self',$2,$3,'review_participant',$4)`,
          [employeeId, review.manager[2], `Completed the ${cycle.name} review`, row.rows[0]!.id],
        );
      }
    }
  }
  const openCycle = reviewCycles.find((cycle) => cycle.status === "open")!;

  // --------------------------------------------------------------- payroll
  // Built through the real payroll service: the last three months are paid,
  // and this month is the open period a finance team is working in -
  // calculated, waiting for review, and still free to recalculate.
  let payslips = 0;
  const periodLabels: string[] = [];
  let lastPaid: { year: number; month: number } | null = null;
  for (const { year: periodYear, month, status } of months) {
    const period = await openPeriod(client, periodYear, month, presentationAdmin.id);
    const summary = await calculatePeriod(client, period);
    await addStatutoryLines(client, period.id);
    if (status === "draft") {
      const monthStart = `${periodYear}-${String(month).padStart(2, "0")}-01`;
      const calculatedOn = addDays(today, -1) > monthStart ? addDays(today, -1) : monthStart;
      await client.query(
        `UPDATE public.payroll_periods SET status = 'calculated',
           calculated_at = ($2::timestamp AT TIME ZONE 'Asia/Kuala_Lumpur') WHERE id = $1`,
        [period.id, `${calculatedOn} 16:30`],
      );
      periodLabels.push(`${periodYear}-${String(month).padStart(2, "0")} calculated`);
      continue;
    }
    periodLabels.push(`${periodYear}-${String(month).padStart(2, "0")} ${status}`);
    payslips = summary.calculated;
    lastPaid = { year: periodYear, month };
    // The database enforces one step at a time, as the product does: a period
    // is calculated, reviewed, approved and only then paid, just after it ends.
    const close = addDays(`${periodYear}-${String(month).padStart(2, "0")}-01`, 25);
    for (const [step, column, day, time] of [
      ["calculated", "calculated_at", 0, "10:00"],
      ["reviewed", "reviewed_at", 0, "14:00"],
      ["approved", "approved_at", 2, "09:30"],
      ["paid", "paid_at", 2, "15:00"],
    ] as const) {
      await client.query(
        `UPDATE public.payroll_periods
         SET status = $2, ${column} = ($3::timestamp AT TIME ZONE 'Asia/Kuala_Lumpur')${step === "approved" ? ", approved_by = $4" : ""}
         WHERE id = $1`,
        step === "approved"
          ? [period.id, step, `${addDays(close, day)} ${time}`, presentationAdmin.id]
          : [period.id, step, `${addDays(close, day)} ${time}`],
      );
    }
  }
  const lastPaidLabel = lastPaid ? formatMonth(lastPaid.year, lastPaid.month) : "";
  const lastPaidOn = lastPaid ? addDays(`${lastPaid.year}-${String(lastPaid.month).padStart(2, "0")}-01`, 27) : today;

  // ------------------------------------------------------- what people saw
  // Notifications for the sign-ins, written as the product would have.
  const notifications: Array<[number, string, string, string | null, string | null, string | null, string | null, string]> = [];
  const managerId = presentationManagerAccount.id;
  const employeeId = presentationEmployeeAccount.id;
  const demoId = presentationDemoAccount.id;
  const employeeName = employees.find((person) => person.id === employeeId)!.fullName;
  const nameOf = (id: number) => employees.find((person) => person.id === id)!.fullName;
  const leaveLabel = (type: string) => ({ annual: "Annual", medical: "Medical", emergency: "Emergency", unpaid: "Unpaid" })[type] ?? type;
  const at = (date: string, time: string) => `${date}T${time}+08:00`;

  for (const key of ["welcome-anisha", "hiring-platform", "fire-drill", "review-cycle"]) {
    const announcement = announcements.find((item) => item.key === key)!;
    const id = announcementIds.get(key)!;
    for (const userId of [managerId, employeeId, demoId]) {
      notifications.push([
        userId, "announcement_published",
        announcement.priority === "important" ? `Important: ${announcement.title}` : announcement.title,
        announcement.body.replace(/\s+/g, " ").slice(0, 139),
        `/announcements/${id}`, "announcement", String(id), at(announcement.publishedOn!, "09:00:00"),
      ]);
    }
  }

  const pendingForManager = leave.filter((request) => request.status === "pending"
    && employees.find((person) => person.id === request.employee)?.managerId === managerId);
  for (const request of pendingForManager) {
    notifications.push([
      managerId, "leave_submitted", `${nameOf(request.employee)} requested leave`,
      `${leaveLabel(request.type)} leave · ${request.start} to ${request.end}`,
      "/team/leave?status=pending", "leave", null, at(addDays(today, -2), "10:15:00"),
    ]);
  }
  // HR decides for everyone whose manager has no sign-in: the demo account's queue.
  const pendingForHr = leave.filter((request) => request.status === "pending" && actorFor(request.employee) === presentationAdmin.id);
  for (const [index, request] of pendingForHr.entries()) {
    notifications.push([
      demoId, "leave_submitted", `${nameOf(request.employee)} requested leave`,
      `${leaveLabel(request.type)} leave · ${request.start} to ${request.end}`,
      "/admin/leave?status=pending", "leave", null, at(addDays(today, -1 - index), "11:05:00"),
    ]);
  }
  notifications.push(
    [employeeId, "leave_submitted", `Your leave request was sent to ${nameOf(managerId)}`, "Annual leave, waiting for a decision",
      "/employee/leave", "leave", null, at(addDays(today, -2), "10:14:00")],
    [employeeId, "recognition_received", "Arvind Menon recognised you for Problem solving",
      "The billing reconciliation fix was neat, and the tests you added around it are better than the code they cover.",
      "/recognition?view=received", "recognition", String(recognitionIds[7]), at(addDays(today, -4), "11:20:00")],
    [employeeId, "review_opened", `Your ${openCycle.name} self-review is open`, null, "/reviews", "review_cycle", null, at(openCycle.openedOn, "09:00:00")],
    [managerId, "review_opened", `${openCycle.name} reviews are open for your team`, "Self-reviews close this week; manager reviews the week after.",
      "/reviews", "review_cycle", null, at(openCycle.openedOn, "09:00:00")],
    [managerId, "review_submitted", `${employeeName} submitted their ${openCycle.name} self-review`, null,
      `/reviews/${reviewIds.get(`current:${employeeId}`)}`, "review_participant",
      String(reviewIds.get(`current:${employeeId}`)), at(addDays(today, -4), "15:00:00")],
    [managerId, "review_submitted", `Tan Yi Xuan submitted their ${openCycle.name} self-review`, null,
      `/reviews/${reviewIds.get("current:9207")}`, "review_participant",
      String(reviewIds.get("current:9207")), at(addDays(today, -2), "15:00:00")],
    [demoId, "plan_started", "Onboarding started for Anisha Kaur", "New joiner onboarding, eight tasks",
      "/admin/onboarding", null, null, at(plans[1]!.startsOn, "09:00:00")],
    [demoId, "task_assigned", "Meet the team and agree the first project", "Onboarding · Anisha Kaur",
      "/tasks", null, null, at(addDays(today, -2), "09:00:00")],
    [demoId, "payroll_paid", `${lastPaidLabel} payroll was paid`, `${payslips} payslips published to employees`,
      "/admin/payroll", null, null, at(lastPaidOn, "15:00:00")],
  );
  for (const userId of [managerId, employeeId]) {
    notifications.push([userId, "payslip_published", `Your payslip for ${lastPaidLabel} is ready`, null,
      "/employee/payroll", "payroll_period", null, at(lastPaidOn, "15:05:00")]);
  }

  for (const [userId, kind, title, body, link, entityType, entityId, createdAt] of notifications) {
    // The schema pairs the two: a notification names an entity, or it names none.
    const paired = entityId === null ? null : entityType;
    await client.query(
      `INSERT INTO public.notifications (user_id, kind, title, body, link, entity_type, entity_id, actor_user_id, created_at, read_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,
               -- Older news has been read; the last few days are still new.
               CASE WHEN $9::timestamptz < ($10::date - interval '3 days') THEN $9::timestamptz + interval '3 hours' END)`,
      [userId, kind, title, body, link, paired, entityId, presentationAdmin.id, createdAt, today],
    );
  }
  await client.query(
    `INSERT INTO public.announcement_reads (announcement_id, user_id, read_at)
     VALUES ($1, $2, ($3::date + time '10:00') AT TIME ZONE 'Asia/Kuala_Lumpur')`,
    [announcementIds.get("welcome-anisha"), employeeId, addDays(plans[1]!.startsOn, 1)],
  );

  // ----------------------------------------------------------- audit trail
  // Written directly rather than through the audit service, deliberately: the
  // audit service uses the application's connection pool, and everything here
  // must go through the client the caller handed in.
  type Actor = { userId: number | null; employeeId: number | null; label: string; role: "admin" | "employee" | null };
  const hr: Actor = { userId: presentationAdmin.id, employeeId: null, label: presentationAdmin.email, role: "admin" };
  const manager: Actor = { userId: managerId, employeeId: managerId, label: presentationManagerAccount.email, role: "employee" };
  const employee: Actor = { userId: employeeId, employeeId, label: presentationEmployeeAccount.email, role: "employee" };
  const haziq = employees.find((person) => person.id === 9208)!;
  const anisha = employees.find((person) => person.id === 9221)!;
  const draftMonth = months.at(-1)!;
  const trail: Array<[Actor, string, string, string | null, string, unknown, string, ("success" | "failure")?]> = [
    [hr, "EMPLOYEE_CREATED", "employee", "9208", "Created employee MDS-008 (Haziq bin Kamarul)", { employee_number: "MDS-008", employment_status: "probation" }, at(addDays(haziq.employmentDate, -10), "10:02:00")],
    [hr, "LIFECYCLE_PLAN_STARTED", "lifecycle_plan", null, "Started New joiner onboarding for Haziq bin Kamarul", null, at(haziq.employmentDate, "09:05:00")],
    [hr, "EMPLOYEE_CREATED", "employee", "9221", "Created employee MDS-021 (Anisha Kaur)", { employee_number: "MDS-021", employment_status: "probation" }, at(addDays(anisha.employmentDate, -9), "09:12:00")],
    [hr, "LIFECYCLE_PLAN_STARTED", "lifecycle_plan", null, "Started New joiner onboarding for Anisha Kaur", null, at(anisha.employmentDate, "09:04:00")],
    [hr, "ANNOUNCEMENT_PUBLISHED", "announcement", String(announcementIds.get("welcome-anisha")), "Published \"Welcome Anisha Kaur to People & Culture\"", null, at(anisha.employmentDate, "09:00:00")],
    [hr, "PAYROLL_CALCULATED", "payroll", null, `${lastPaidLabel} payroll calculated for ${payslips} employees`, null, at(addDays(lastPaidOn, -2), "10:00:00")],
    [hr, "PAYROLL_APPROVED", "payroll", null, `${lastPaidLabel} payroll approved`, { status: { before: "reviewed", after: "approved" } }, at(lastPaidOn, "09:30:00")],
    [hr, "PAYROLL_PAID", "payroll", null, `${lastPaidLabel} payroll paid`, { status: { before: "approved", after: "paid" } }, at(lastPaidOn, "15:00:00")],
    [hr, "PAYROLL_PERIOD_OPENED", "payroll", null, `Opened the ${formatMonth(draftMonth.year, draftMonth.month)} payroll period`, null, at(`${today.slice(0, 7)}-01`, "09:15:00")],
    [manager, "LEAVE_APPROVED", "leave", null, "Approved annual leave for Arvind Menon", { status: { before: "pending", after: "approved" }, working_days: 5 }, at(addDays(today, -53), "11:20:00")],
    [hr, "LEAVE_APPROVED", "leave", null, "Approved annual leave for Sharifah binti Yahya", { status: { before: "pending", after: "approved" }, working_days: 4 }, at(addDays(today, -37), "11:20:00")],
    [hr, "LEAVE_REJECTED", "leave", null, "Rejected annual leave for Chan Li Wen", { status: { before: "pending", after: "rejected" } }, at(addDays(today, -18), "16:40:00")],
    [manager, "LEAVE_APPROVED", "leave", null, "Approved annual leave for Siti Balqis binti Azmi", { status: { before: "pending", after: "approved" }, working_days: 5 }, at(addDays(today, -6), "14:02:00")],
    [hr, "SETTINGS_CHANGED", "settings", "1", "Company settings saved", { grace_period_minutes: { before: 10, after: 15 } }, at(addDays(today, -27), "16:05:00")],
    [hr, "SALARY_CHANGED", "compensation", "9204", "Set compensation for employee #9204", { basic_salary_sen: 1040000 }, at(addDays(today, -22), "10:40:00")],
    [hr, "EMPLOYEE_UPDATED", "employee", "9234", "Recorded resignation for MDS-034 (Wong Kah Meng)", { notice: "resigned" }, at(addDays(today, -18), "14:25:00")],
    [hr, "LIFECYCLE_PLAN_STARTED", "lifecycle_plan", null, "Started Leaver offboarding for Wong Kah Meng", null, at(addDays(today, -18), "14:31:00")],
    [hr, "ORG_POSITION_CREATED", "employee", "9240", "Added vacant position Platform Engineer", null, at(addDays(today, -17), "15:10:00")],
    [hr, "ORG_POSITION_CREATED", "employee", "9241", "Added vacant position Customer Success Executive", null, at(addDays(today, -17), "15:14:00")],
    [hr, "ANNOUNCEMENT_PUBLISHED", "announcement", String(announcementIds.get("hiring-platform")), "Published \"We are hiring: Platform Engineering and Customer Success\"", null, at(addDays(today, -18), "09:00:00")],
    [hr, "ORG_POSITION_CREATED", "employee", "9242", "Added vacant position Head of Data", null, at(addDays(today, -12), "11:48:00")],
    [hr, "REVIEW_CYCLE_OPENED", "review_cycle", null, `Opened the ${openCycle.name} cycle`, null, at(openCycle.openedOn, "09:00:00")],
    [employee, "REVIEW_SELF_SUBMITTED", "review_participant", String(reviewIds.get(`current:${employeeId}`)), `Submitted the ${openCycle.name} self-review`, null, at(addDays(today, -4), "15:00:00")],
    [hr, "ANNOUNCEMENT_PUBLISHED", "announcement", String(announcementIds.get("review-cycle")), `Published "${openCycle.name}: self-reviews close soon"`, null, at(addDays(today, -3), "09:00:00")],
    [hr, "DATA_EXPORTED", "export", null, "Exported the workforce report (CSV)", { report: "workforce" }, at(addDays(today, -2), "16:20:00")],
    [hr, "ATTENDANCE_CORRECTED", "attendance", null, "Corrected a missing check-out for Tan Yi Xuan", { check_out_time: { before: null, after: "18:04" } }, at(addDays(today, -1), "09:40:00")],
  ];
  // Everyday sign-ins over the last week, and the odd mistyped password.
  for (let back = 7; back >= 0; back -= 1) {
    const day = addDays(today, -back);
    if (!isWorkingDay(day)) continue;
    trail.push([hr, "LOGIN", "auth", String(presentationAdmin.id), "Administrator signed in", null, at(day, `08:${String(41 + back).padStart(2, "0")}:00`)]);
    if (back % 2 === 0) trail.push([manager, "LOGIN", "auth", String(managerId), "Employee signed in", null, at(day, "08:57:00")]);
    if (back % 3 === 1) trail.push([employee, "LOGIN", "auth", String(employeeId), "Employee signed in", null, at(day, "09:02:00")]);
  }
  trail.push([{ userId: null, employeeId: null, label: `kar.wai@${presentationEmployeeAccount.email.split("@")[1]}`, role: null },
    "LOGIN_FAILED", "auth", null, "Sign-in failed: invalid email or password", null, at(addDays(today, -1), "09:01:00"), "failure"]);
  trail.sort((left, right) => left[6].localeCompare(right[6]));
  const nowStamp = Date.now();
  let auditEvents = 0;
  for (const [actor, action, entityType, entityId, summaryText, changes, occurredAt, outcome] of trail) {
    if (new Date(occurredAt).getTime() > nowStamp) continue;          // never a record of the future
    await client.query(
      `INSERT INTO public.audit_events
         (actor_user_id, actor_employee_id, actor_label, actor_role, action, entity_type, entity_id,
          summary, changes, outcome, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11::timestamptz)`,
      [
        actor.userId, actor.employeeId, actor.label, actor.role, action, entityType, entityId, summaryText,
        changes === null ? null : JSON.stringify(changes), outcome ?? "success", occurredAt,
      ],
    );
    auditEvents += 1;
  }

  // ------------------------------------------------- the prepared Home
  // The manager starts with a personalised Home, so the walkthrough can show the
  // finished feature. Every widget in it is one the manager's own capability
  // already allows, and the server checks that on every read. The demo account
  // keeps the approved default.
  const layout = {
    version: 1,
    items: [
      { kind: "widget", widget: "action-center", size: "large" },
      { kind: "stack", id: "stack-team01", size: "medium", widgets: ["team-leave", "team-reviews"], smart: true },
      { kind: "widget", widget: "team-today", size: "medium" },
      { kind: "widget", widget: "my-attendance", size: "small" },
      { kind: "widget", widget: "leave-balance", size: "small" },
      { kind: "widget", widget: "today", size: "medium" },
      { kind: "widget", widget: "whos-out", size: "medium" },
    ],
  };
  await client.query(
    `INSERT INTO public.user_dashboard_layouts (user_id, layout, revision, updated_at)
     VALUES ($1, $2::jsonb, 1, ($3::date - interval '9 days'))
     ON CONFLICT (user_id) DO UPDATE SET layout = EXCLUDED.layout, revision = public.user_dashboard_layouts.revision + 1`,
    [managerId, JSON.stringify(layout), today],
  );

  return {
    company: presentationCompany.name,
    companyToday: today,
    seededAsOf: minutesToTime(nowMinutes).slice(0, 5),
    departments: presentationDepartments.length,
    employees: employees.length,
    vacancies: presentationVacancies.length,
    attendanceRows,
    todayPresent, todayLate, todayOnLeave,
    leaveRequests: leave.length,
    payrollPeriods: periodLabels,
    payslipsInLatestPaidPeriod: payslips,
    holidays: holidays.length,
    events: events.length,
    announcements: announcements.length,
    lifecyclePlans: plans.length,
    recognitions: recognitions.length,
    goals: goals.length,
    reviewCycles: reviewCycles.length,
    notifications: notifications.length,
    auditEvents,
    preparedDashboardFor: presentationManagerAccount.email,
    accounts: {
      demo: presentationDemoAccount.email,
      admin: presentationAdmin.email,
      manager: presentationManagerAccount.email,
      employee: presentationEmployeeAccount.email,
    },
  };
}
