/**
 * The presentation dataset: Meridian, a fictional Kuala Lumpur software
 * company that looks as though it has run HR Nexus for
 * months.
 *
 * Everything here is invented. Addresses use the `.invalid` top-level domain,
 * which RFC 2606 reserves so it can never resolve to a real mailbox; no name,
 * number, salary or identifier belongs to a real person or company.
 *
 * DATES. Only history that is genuinely fixed - long-standing employment dates
 * and the 2026 public-holiday calendar - is written as a calendar date.
 * Everything a viewer reads as "now" - new joiners, payroll months, review
 * cycles, announcements - is a function of the company's own today, so the
 * environment stays coherent on whichever day it is rebuilt. The public demo is
 * rebuilt every night for exactly that reason.
 *
 * The dataset is a description, separate from the loader that writes it, so
 * what the presentation contains can be reviewed without reading SQL.
 */

/** Reserved identifier range. The loader never touches a row outside it. */
export const PRESENTATION_ID_MIN = 9200;
export const PRESENTATION_ID_MAX = 9299;

export const presentationCompany = {
  name: "Meridian",
  shortName: "Meridian",
  timezone: "Asia/Kuala_Lumpur",
  workingDays: [1, 2, 3, 4, 5],
  workStart: "09:00",
  workEnd: "18:00",
  graceMinutes: 15,
  // Fictional office coordinates in the Kuala Lumpur city centre.
  officeLatitude: 3.1528,
  officeLongitude: 101.7133,
  radiusMeters: 150,
};

export interface PresentationDepartment {
  name: string;
  description: string;
}

export const presentationDepartments: PresentationDepartment[] = [
  { name: "Management", description: "The CEO" },
  { name: "Engineering", description: "Builds and runs the software" },
  { name: "Product", description: "Product, design and research" },
  { name: "HR", description: "Hiring, onboarding and people" },
  { name: "Finance", description: "Payroll and accounts" },
  { name: "Sales", description: "New customers and accounts" },
  { name: "Operations", description: "Customer support and office operations" },
];

export interface PresentationEmployee {
  id: number;
  employeeNumber: string;
  fullName: string;
  department: string;
  jobTitle: string;
  status: "active" | "probation" | "inactive" | "resigned";
  employmentDate: string;
  /** Sen per month. Omitted only for someone who should have no compensation record. */
  basicSalarySen?: number;
  allowanceSen?: number;
  overtimeRateSen?: number;
  account?: "admin" | "employee";
  managerId?: number;
  /**
   * A recent joiner. Their start date is this many working days before the
   * company's today, so they are always "new", and `employmentDate` above is
   * only the fallback used when no calendar is at hand.
   */
  joinedWorkingDaysAgo?: number;
}

/**
 * Thirty-four people across seven departments and four levels: the managing
 * director, six department heads, five managers and team leads, and the
 * individual contributors who do the work. Salaries vary by level and by
 * person, as they do in a real company.
 */
export const presentationEmployees: PresentationEmployee[] = [
  // ------------------------------------------------------------- Management
  { id: 9201, employeeNumber: "EMP-001", fullName: "David Tan", department: "Management", jobTitle: "CEO", status: "active", employmentDate: "2018-03-05", basicSalarySen: 3200000, allowanceSen: 420000, overtimeRateSen: 0 },

  // ------------------------------------------------------------ Engineering
  { id: 9202, employeeNumber: "EMP-002", fullName: "Jason Lim", department: "Engineering", jobTitle: "Head of Engineering", status: "active", employmentDate: "2019-01-14", basicSalarySen: 1780000, allowanceSen: 220000, overtimeRateSen: 0, managerId: 9201 },
  // The manager the presentation walks through: a real reporting line, five reports.
  { id: 9203, employeeNumber: "EMP-003", fullName: "Sarah Ahmad", department: "Engineering", jobTitle: "Engineering Manager", status: "active", employmentDate: "2020-06-01", basicSalarySen: 1285000, allowanceSen: 150000, overtimeRateSen: 0, account: "employee", managerId: 9202 },
  { id: 9204, employeeNumber: "EMP-004", fullName: "Ravi Kumar", department: "Engineering", jobTitle: "Senior Engineer", status: "active", employmentDate: "2020-11-09", basicSalarySen: 1040000, allowanceSen: 95000, overtimeRateSen: 6900, managerId: 9203 },
  // The employee the presentation walks through, inside that manager's team.
  { id: 9205, employeeNumber: "EMP-005", fullName: "Ben Wong", department: "Engineering", jobTitle: "Software Engineer", status: "active", employmentDate: "2022-02-14", basicSalarySen: 785000, allowanceSen: 70000, overtimeRateSen: 5200, account: "employee", managerId: 9203 },
  { id: 9206, employeeNumber: "EMP-006", fullName: "Aisha Rahman", department: "Engineering", jobTitle: "Software Engineer", status: "active", employmentDate: "2022-09-05", basicSalarySen: 742000, allowanceSen: 65000, overtimeRateSen: 4900, managerId: 9203 },
  { id: 9207, employeeNumber: "EMP-007", fullName: "Emily Tan", department: "Engineering", jobTitle: "QA Engineer", status: "active", employmentDate: "2023-03-13", basicSalarySen: 638000, allowanceSen: 55000, overtimeRateSen: 4250, managerId: 9203 },
  { id: 9208, employeeNumber: "EMP-008", fullName: "Danny Ismail", department: "Engineering", jobTitle: "Junior Engineer", status: "probation", employmentDate: "2026-07-06", basicSalarySen: 452000, allowanceSen: 35000, overtimeRateSen: 3000, managerId: 9203, joinedWorkingDaysAgo: 30 },
  { id: 9209, employeeNumber: "EMP-009", fullName: "Rachel Lee", department: "Engineering", jobTitle: "Engineering Manager", status: "active", employmentDate: "2021-04-12", basicSalarySen: 1245000, allowanceSen: 145000, overtimeRateSen: 0, managerId: 9202 },
  { id: 9210, employeeNumber: "EMP-010", fullName: "Faiz Ali", department: "Engineering", jobTitle: "Senior Engineer", status: "active", employmentDate: "2021-08-23", basicSalarySen: 995000, allowanceSen: 90000, overtimeRateSen: 6600, managerId: 9209 },
  { id: 9211, employeeNumber: "EMP-011", fullName: "Kevin Yeoh", department: "Engineering", jobTitle: "Software Engineer", status: "active", employmentDate: "2023-10-02", basicSalarySen: 706000, allowanceSen: 62000, overtimeRateSen: 4700, managerId: 9209 },
  { id: 9212, employeeNumber: "EMP-012", fullName: "Priya Nair", department: "Engineering", jobTitle: "DevOps Engineer", status: "active", employmentDate: "2022-05-16", basicSalarySen: 862000, allowanceSen: 78000, overtimeRateSen: 5750, managerId: 9209 },

  // ------------------------------------------------------- Product
  { id: 9213, employeeNumber: "EMP-013", fullName: "Grace Lai", department: "Product", jobTitle: "Head of Product", status: "active", employmentDate: "2019-07-01", basicSalarySen: 1615000, allowanceSen: 190000, overtimeRateSen: 0, managerId: 9201 },
  { id: 9214, employeeNumber: "EMP-014", fullName: "Omar Hakim", department: "Product", jobTitle: "Product Manager", status: "active", employmentDate: "2021-10-18", basicSalarySen: 1085000, allowanceSen: 105000, overtimeRateSen: 0, managerId: 9213 },
  { id: 9215, employeeNumber: "EMP-015", fullName: "Mei Ooi", department: "Product", jobTitle: "Senior Designer", status: "active", employmentDate: "2022-03-21", basicSalarySen: 918000, allowanceSen: 84000, overtimeRateSen: 0, managerId: 9213 },
  { id: 9216, employeeNumber: "EMP-016", fullName: "Adam Jamal", department: "Product", jobTitle: "Designer", status: "active", employmentDate: "2024-01-15", basicSalarySen: 672000, allowanceSen: 58000, overtimeRateSen: 0, managerId: 9215 },
  { id: 9217, employeeNumber: "EMP-017", fullName: "Joyce Ng", department: "Product", jobTitle: "UX Researcher", status: "active", employmentDate: "2023-06-05", basicSalarySen: 748000, allowanceSen: 64000, overtimeRateSen: 0, managerId: 9213 },

  // -------------------------------------------------------- HR
  { id: 9218, employeeNumber: "EMP-018", fullName: "Farah Hassan", department: "HR", jobTitle: "Head of HR", status: "active", employmentDate: "2019-09-02", basicSalarySen: 1520000, allowanceSen: 175000, overtimeRateSen: 0, managerId: 9201 },
  { id: 9219, employeeNumber: "EMP-019", fullName: "Melissa Tan", department: "HR", jobTitle: "HR Executive", status: "active", employmentDate: "2022-08-08", basicSalarySen: 615000, allowanceSen: 52000, overtimeRateSen: 4100, managerId: 9218 },
  { id: 9220, employeeNumber: "EMP-020", fullName: "Ryan Salleh", department: "HR", jobTitle: "Recruiter", status: "active", employmentDate: "2023-11-13", basicSalarySen: 682000, allowanceSen: 58000, overtimeRateSen: 4550, managerId: 9218 },
  { id: 9221, employeeNumber: "EMP-021", fullName: "Anna Kaur", department: "HR", jobTitle: "HR Assistant", status: "probation", employmentDate: "2026-08-03", basicSalarySen: 428000, allowanceSen: 32000, overtimeRateSen: 2850, managerId: 9219, joinedWorkingDaysAgo: 6 },

  // ----------------------------------------------------------------- Finance
  { id: 9222, employeeNumber: "EMP-022", fullName: "Alan Ong", department: "Finance", jobTitle: "Finance Manager", status: "active", employmentDate: "2019-05-06", basicSalarySen: 1435000, allowanceSen: 160000, overtimeRateSen: 0, managerId: 9201 },
  { id: 9223, employeeNumber: "EMP-023", fullName: "Nadia Aziz", department: "Finance", jobTitle: "Payroll Executive", status: "active", employmentDate: "2021-12-06", basicSalarySen: 725000, allowanceSen: 62000, overtimeRateSen: 4800, managerId: 9222 },
  { id: 9224, employeeNumber: "EMP-024", fullName: "Vimal Raj", department: "Finance", jobTitle: "Accountant", status: "active", employmentDate: "2023-02-20", basicSalarySen: 596000, allowanceSen: 48000, overtimeRateSen: 3950, managerId: 9222 },
  { id: 9225, employeeNumber: "EMP-025", fullName: "Peggy Low", department: "Finance", jobTitle: "Finance Analyst", status: "active", employmentDate: "2024-07-08", basicSalarySen: 658000, allowanceSen: 54000, overtimeRateSen: 4350, managerId: 9222 },

  // ------------------------------------------------------ Sales
  { id: 9226, employeeNumber: "EMP-026", fullName: "Marcus Teoh", department: "Sales", jobTitle: "Head of Sales", status: "active", employmentDate: "2019-02-11", basicSalarySen: 1690000, allowanceSen: 240000, overtimeRateSen: 0, managerId: 9201 },
  { id: 9227, employeeNumber: "EMP-027", fullName: "Sofia Yahya", department: "Sales", jobTitle: "Senior Account Manager", status: "active", employmentDate: "2021-06-14", basicSalarySen: 952000, allowanceSen: 130000, overtimeRateSen: 0, managerId: 9226 },
  { id: 9228, employeeNumber: "EMP-028", fullName: "Jonathan Chua", department: "Sales", jobTitle: "Account Manager", status: "active", employmentDate: "2022-11-28", basicSalarySen: 788000, allowanceSen: 105000, overtimeRateSen: 0, managerId: 9226 },
  { id: 9229, employeeNumber: "EMP-029", fullName: "Amir Nasir", department: "Sales", jobTitle: "Partnerships Executive", status: "active", employmentDate: "2024-03-04", basicSalarySen: 645000, allowanceSen: 72000, overtimeRateSen: 0, managerId: 9226 },
  { id: 9230, employeeNumber: "EMP-030", fullName: "Lily Chan", department: "Sales", jobTitle: "Sales Executive", status: "active", employmentDate: "2025-01-13", basicSalarySen: 512000, allowanceSen: 60000, overtimeRateSen: 3400, managerId: 9227 },

  // --------------------------------------------- Operations
  { id: 9231, employeeNumber: "EMP-031", fullName: "Devi Suresh", department: "Operations", jobTitle: "Head of Operations", status: "active", employmentDate: "2020-02-17", basicSalarySen: 1480000, allowanceSen: 168000, overtimeRateSen: 0, managerId: 9201 },
  { id: 9232, employeeNumber: "EMP-032", fullName: "Zul Hamzah", department: "Operations", jobTitle: "Support Manager", status: "active", employmentDate: "2021-09-06", basicSalarySen: 925000, allowanceSen: 88000, overtimeRateSen: 6150, managerId: 9231 },
  { id: 9233, employeeNumber: "EMP-033", fullName: "Maya Naidu", department: "Operations", jobTitle: "Support Executive", status: "active", employmentDate: "2023-08-14", basicSalarySen: 624000, allowanceSen: 52000, overtimeRateSen: 4150, managerId: 9232 },
  // Leaving at the end of the month: the offboarding the presentation shows.
  { id: 9234, employeeNumber: "EMP-034", fullName: "Kenny Chong", department: "Operations", jobTitle: "Operations Executive", status: "active", employmentDate: "2022-06-20", basicSalarySen: 668000, allowanceSen: 56000, overtimeRateSen: 4450, managerId: 9231 },
];

/**
 * The company's mail domain. `.example` is reserved by RFC 2606, so no address
 * below can ever reach a real mailbox.
 */
export const PRESENTATION_EMAIL_DOMAIN = "meridian.example";

/**
 * The HR administrator: an account, not a personnel record, as in a real company.
 * It, the manager and the employee below exist so the data has someone who
 * approved the leave, ran the payroll and wrote the announcements. None of them
 * can sign in: their password hash is NO_SIGN_IN_HASH, which no password
 * matches, and in demo mode the API refuses every account but the demo one.
 */
export const presentationAdmin = {
  id: PRESENTATION_ID_MIN,
  email: `hr@${PRESENTATION_EMAIL_DOMAIN}`,
};

/** The manager and the employee whose own pages the data fills in (approvals, goals, notifications). */
export const presentationManagerAccount = { id: 9203, email: `sarah@${PRESENTATION_EMAIL_DOMAIN}` };
export const presentationEmployeeAccount = { id: 9205, email: `ben@${PRESENTATION_EMAIL_DOMAIN}` };
export const presentationEmployeeAccounts = [presentationManagerAccount, presentationEmployeeAccount];

/**
 * The password hash of every account except the demo one. It is not a bcrypt
 * hash, so bcrypt.compare returns false for every password: these accounts have
 * no usable credentials at all, not merely an unknown password.
 */
export const NO_SIGN_IN_HASH = "!no-sign-in";

/**
 * The public demo account, and the only account anyone can sign in with: an
 * HR administrator who can open every module and change nothing. `users.demo_read_only` makes the API refuse its writes, so
 * publishing this password is the point, not a leak. It is kept simple so a
 * visitor can type it, belongs to this demo alone and is used nowhere else;
 * never reuse it.
 */
export const presentationDemoAccount = {
  id: 9290,
  email: `demo@${PRESENTATION_EMAIL_DOMAIN}`,
  password: "meridian-demo",
};

/**
 * Open seats on the chart. Each is a position, not a person: no name, no
 * personal details, and never counted in headcount, payroll or reviews. They
 * match the roles the hiring announcement advertises.
 */
export const presentationVacancies: Array<{
  id: number; employeeNumber: string; title: string; department: string; managerId: number; notes: string;
}> = [
  { id: 9240, employeeNumber: "POS-9240", title: "Software Engineer", department: "Engineering", managerId: 9203, notes: "Mid-level hire for the platform team. Interviews in progress." },
  { id: 9241, employeeNumber: "POS-9241", title: "Support Executive", department: "Operations", managerId: 9232, notes: "Backfill ahead of Kenny Chong's departure." },
  { id: 9242, employeeNumber: "POS-9242", title: "Head of Data", department: "Management", managerId: 9201, notes: "New role, approved for next quarter. Brief being written." },
];

/**
 * Kuala Lumpur's 2026 public holidays, including the substitute days that
 * follow a holiday falling on a weekend.
 *
 * Source: publicholidays.com.my Kuala Lumpur 2026, cross-checked against
 * malaysiapublicholiday.my (Kuala Lumpur, 2026). Both were read on
 * 16 September 2026 and agree on every gazetted date; the substitute days come
 * from the first. Nothing here is invented, and no new holiday engine exists:
 * these are rows in the product's existing company calendar.
 *
 * `company_holidays` holds one row per date, so 1 February - Thaipusam and
 * Federal Territory Day on the same Sunday - is one row naming both.
 */
export const presentationHolidays: Array<{ date: string; name: string }> = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-02-01", name: "Thaipusam / Federal Territory Day" },
  { date: "2026-02-02", name: "Thaipusam (substitute)" },
  { date: "2026-02-03", name: "Federal Territory Day (substitute)" },
  { date: "2026-02-17", name: "Chinese New Year" },
  { date: "2026-02-18", name: "Chinese New Year (second day)" },
  { date: "2026-03-07", name: "Nuzul Al-Quran" },
  { date: "2026-03-20", name: "Hari Raya Aidilfitri (additional day)" },
  { date: "2026-03-21", name: "Hari Raya Aidilfitri" },
  { date: "2026-03-22", name: "Hari Raya Aidilfitri (second day)" },
  { date: "2026-03-23", name: "Hari Raya Aidilfitri (substitute)" },
  { date: "2026-05-01", name: "Labour Day" },
  { date: "2026-05-27", name: "Hari Raya Haji" },
  { date: "2026-05-31", name: "Wesak Day" },
  { date: "2026-06-01", name: "Birthday of the Yang di-Pertuan Agong" },
  { date: "2026-06-02", name: "Wesak Day (substitute)" },
  { date: "2026-06-17", name: "Awal Muharram" },
  { date: "2026-08-25", name: "Birthday of Prophet Muhammad" },
  { date: "2026-08-31", name: "National Day" },
  { date: "2026-09-16", name: "Malaysia Day" },
  { date: "2026-11-08", name: "Deepavali" },
  { date: "2026-11-09", name: "Deepavali (substitute)" },
  { date: "2026-12-25", name: "Christmas Day" },
];

/**
 * The calendar for any set of years. 2026 is the gazetted list above. Other
 * years carry only the holidays fixed by date, because the lunar and
 * religious ones are announced year by year and are not invented here.
 */
export function presentationHolidaysFor(years: number[]): Array<{ date: string; name: string }> {
  const rows: Array<{ date: string; name: string }> = [];
  for (const year of [...new Set(years)].sort()) {
    if (year === 2026) { rows.push(...presentationHolidays); continue; }
    const firstJune = new Date(Date.UTC(year, 5, 1)).getUTCDay();
    const agong = 1 + ((8 - firstJune) % 7);
    rows.push(
      { date: `${year}-01-01`, name: "New Year's Day" },
      { date: `${year}-02-01`, name: "Federal Territory Day" },
      { date: `${year}-05-01`, name: "Labour Day" },
      { date: `${year}-06-${String(agong).padStart(2, "0")}`, name: "Birthday of the Yang di-Pertuan Agong" },
      { date: `${year}-08-31`, name: "National Day" },
      { date: `${year}-09-16`, name: "Malaysia Day" },
      { date: `${year}-12-25`, name: "Christmas Day" },
    );
  }
  return rows;
}

/** What some colleagues chose to say about themselves. */
export const presentationProfiles: Array<{ employeeId: number; about: string; skills: string[]; sharePhone: boolean }> = [
  { employeeId: 9203, about: "I lead the platform team. I care about shipping small, safe changes and about the people who ship them. Ask me about architecture, on-call or how to get something unblocked.", skills: ["Engineering management", "Distributed systems", "TypeScript", "Coaching"], sharePhone: true },
  { employeeId: 9205, about: "Software engineer on the platform team. Currently working on the billing service and the reporting pipeline.", skills: ["TypeScript", "PostgreSQL", "Node.js", "Testing"], sharePhone: false },
  { employeeId: 9218, about: "I look after hiring, onboarding and the policies that decide how we work day to day. If something about working here does not make sense, tell me.", skills: ["Employee relations", "Policy design", "Hiring", "Compensation"], sharePhone: true },
  { employeeId: 9202, about: "Head of Engineering. I spend most of my time on delivery, hiring and making sure the two teams are pulling in the same direction.", skills: ["Engineering leadership", "System design", "Hiring"], sharePhone: true },
  { employeeId: 9213, about: "Product and design. I am interested in the research behind a decision as much as the decision itself.", skills: ["Product strategy", "Design leadership", "User research"], sharePhone: false },
  { employeeId: 9204, about: "Senior engineer. Mostly platform work, and the person to ask about our deployment pipeline.", skills: ["Go", "Kubernetes", "Observability", "Mentoring"], sharePhone: false },
  { employeeId: 9226, about: "Sales and partnerships across Malaysia and Singapore.", skills: ["Enterprise sales", "Partnerships", "Negotiation"], sharePhone: true },
  { employeeId: 9231, about: "Operations and customer success. I care about response times and about the customers behind them.", skills: ["Service delivery", "Customer success", "Process design"], sharePhone: true },
  { employeeId: 9208, about: "Junior engineer, a few weeks in. Learning the codebase and pairing as much as I can.", skills: ["TypeScript", "React"], sharePhone: false },
];

/** A little company-visible history, so a profile is not blank. */
export const presentationTimeline: Array<{ employeeId: number; kind: "job_title_changed" | "department_changed" | "manager_changed"; occurredOn: string; title: string }> = [
  { employeeId: 9203, kind: "job_title_changed", occurredOn: "2023-01-01", title: "Promoted to Engineering Manager" },
  { employeeId: 9204, kind: "job_title_changed", occurredOn: "2023-07-01", title: "Promoted to Senior Engineer" },
  { employeeId: 9210, kind: "job_title_changed", occurredOn: "2024-01-01", title: "Promoted to Senior Engineer" },
  { employeeId: 9215, kind: "job_title_changed", occurredOn: "2024-04-01", title: "Promoted to Senior Designer" },
  { employeeId: 9219, kind: "manager_changed", occurredOn: "2024-09-01", title: "Now reports to Farah Hassan" },
  { employeeId: 9232, kind: "job_title_changed", occurredOn: "2023-03-01", title: "Promoted to Support Manager" },
  { employeeId: 9227, kind: "job_title_changed", occurredOn: "2023-10-01", title: "Promoted to Senior Account Manager" },
];

/**
 * Dates that a viewer reads as "now" are derived from the company's own today
 * through this calendar, which the loader supplies because it knows the
 * holiday list. Nothing below hard-codes a fake today.
 */
export interface PresentationCalendar {
  today: string;
  addDays: (date: string, days: number) => string;
  /** The date `days` working days after `date`, skipping weekends and holidays. */
  addWorkingDays: (date: string, days: number) => string;
}

/** "Thursday 26 November", as the company would write it. */
export function formatDay(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`)).replace(",", "");
}

/** "26 November". */
export function formatShortDay(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));
}

/** "November 2026" for a year and a 1-based month. */
export function formatMonth(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

/** The employees as they stand on the calendar's today: recent joiners get their real start date. */
export function presentationEmployeesOn(cal: PresentationCalendar): PresentationEmployee[] {
  return presentationEmployees.map((employee) => employee.joinedWorkingDaysAgo === undefined
    ? employee
    : { ...employee, employmentDate: cal.addWorkingDays(cal.today, -employee.joinedWorkingDaysAgo) });
}

const joinedOn = (cal: PresentationCalendar, id: number) =>
  presentationEmployeesOn(cal).find((employee) => employee.id === id)!.employmentDate;

/**
 * The review calendar. The open cycle reviews the quarter that has just ended
 * and the closed one the quarter before it, so on any day of any year there is
 * one cycle in progress and one finished behind it.
 */
export function reviewQuarters(today: string): {
  open: { name: string; start: string; end: string };
  closed: { name: string; start: string; end: string };
} {
  const year = Number(today.slice(0, 4));
  const quarter = Math.floor((Number(today.slice(5, 7)) - 1) / 3); // 0-3, the current quarter
  const bounds = (offset: number) => {
    const index = year * 4 + quarter + offset;
    const y = Math.floor(index / 4);
    const q = index - y * 4;
    const start = `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`;
    const endDate = new Date(Date.UTC(y, q * 3 + 3, 0));
    return { name: `Q${q + 1} ${y} review`, start, end: endDate.toISOString().slice(0, 10) };
  };
  return { open: bounds(-1), closed: bounds(-2) };
}

export interface PresentationLeave {
  employee: number;
  type: "annual" | "medical" | "emergency" | "unpaid";
  start: string;
  end: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason: string;
}

/**
 * Leave as a company actually holds it: history behind, decisions waiting, and
 * approved time off ahead. Two people are away on the day of the walkthrough,
 * so Who's Out and the attendance figures have something true to show, and the
 * requests waiting for a decision sit in the platform manager's queue.
 */
export function presentationLeave(cal: PresentationCalendar): PresentationLeave[] {
  const { today, addDays, addWorkingDays } = cal;
  return [
    // Away today.
    { employee: 9217, type: "annual", start: addWorkingDays(today, -1), end: addWorkingDays(today, 1), status: "approved", reason: "Family trip to Penang" },
    { employee: 9228, type: "annual", start: today, end: addWorkingDays(today, 2), status: "approved", reason: "Annual leave" },
    { employee: 9224, type: "medical", start: today, end: today, status: "approved", reason: "Medical appointment" },

    // Approved and still ahead.
    { employee: 9206, type: "annual", start: addWorkingDays(today, 7), end: addWorkingDays(today, 11), status: "approved", reason: "Wedding in Ipoh" },
    { employee: 9212, type: "annual", start: addWorkingDays(today, 4), end: addWorkingDays(today, 5), status: "approved", reason: "Long weekend" },
    { employee: 9232, type: "annual", start: addWorkingDays(today, 15), end: addWorkingDays(today, 19), status: "approved", reason: "Annual leave" },

    // Waiting for the platform manager: one of them is the employee account's.
    { employee: 9205, type: "annual", start: addWorkingDays(today, 14), end: addWorkingDays(today, 18), status: "pending", reason: "Planned time off" },
    { employee: 9207, type: "emergency", start: addWorkingDays(today, 2), end: addWorkingDays(today, 2), status: "pending", reason: "Family matter" },

    // Waiting for HR, from other teams.
    { employee: 9211, type: "annual", start: addWorkingDays(today, 21), end: addWorkingDays(today, 22), status: "pending", reason: "Short break" },
    { employee: 9233, type: "medical", start: addWorkingDays(today, 1), end: addWorkingDays(today, 1), status: "pending", reason: "Specialist appointment" },
    { employee: 9216, type: "unpaid", start: addWorkingDays(today, 25), end: addWorkingDays(today, 26), status: "pending", reason: "Personal matter" },

    // History.
    { employee: 9204, type: "annual", start: addDays(today, -47), end: addDays(today, -43), status: "approved", reason: "Annual leave" },
    { employee: 9219, type: "medical", start: addDays(today, -38), end: addDays(today, -37), status: "approved", reason: "Medical leave" },
    { employee: 9227, type: "annual", start: addDays(today, -31), end: addDays(today, -28), status: "approved", reason: "School holidays" },
    { employee: 9214, type: "annual", start: addDays(today, -24), end: addDays(today, -24), status: "approved", reason: "Personal errand" },
    { employee: 9210, type: "medical", start: addDays(today, -17), end: addDays(today, -17), status: "approved", reason: "Medical leave" },
    { employee: 9223, type: "emergency", start: addDays(today, -10), end: addDays(today, -10), status: "approved", reason: "Family emergency" },
    { employee: 9230, type: "annual", start: addDays(today, -12), end: addDays(today, -9), status: "rejected", reason: "Annual leave" },
    { employee: 9229, type: "annual", start: addWorkingDays(today, 9), end: addWorkingDays(today, 10), status: "cancelled", reason: "Plans changed" },
    // The employee account has a little history of its own to show.
    { employee: 9205, type: "annual", start: addDays(today, -66), end: addDays(today, -62), status: "approved", reason: "Annual leave" },
    { employee: 9205, type: "medical", start: addDays(today, -29), end: addDays(today, -29), status: "approved", reason: "Medical leave" },
    { employee: 9205, type: "annual", start: addDays(today, -20), end: addDays(today, -19), status: "cancelled", reason: "Plans changed" },
  ];
}

export function presentationEvents(cal: PresentationCalendar): Array<{
  title: string; description?: string; location?: string; startsOn: string; endsOn?: string; startTime?: string; endTime?: string;
}> {
  const { today, addDays, addWorkingDays } = cal;
  return [
    { title: "Platform demo day", description: "The platform team shows what shipped this fortnight. Everyone welcome.", location: "Level 18, Auditorium", startsOn: addWorkingDays(today, 2), startTime: "16:00", endTime: "17:00" },
    { title: "New joiner coffee session", description: "An informal half hour for everyone who joined in the last two months.", location: "Level 17, Pantry", startsOn: addWorkingDays(today, 4), startTime: "09:30", endTime: "10:15" },
    { title: "Company town hall", description: "Quarterly update from the managing director, followed by questions.", location: "Level 18, Auditorium", startsOn: addWorkingDays(today, 8), startTime: "10:00", endTime: "11:30" },
    { title: "Client workshop: Kestrel Retail", description: "Discovery workshop with the client team.", location: "Client office", startsOn: addWorkingDays(today, 12), startTime: "09:30", endTime: "16:30" },
    { title: "Engineering offsite", description: "Two days of planning for the next quarter.", location: "Off-site", startsOn: addDays(today, -21), endsOn: addDays(today, -20) },
    { title: "Monthly birthday lunch", description: "Lunch for everyone with a birthday this month, and anyone who wants cake.", location: "Level 17, Common area", startsOn: addWorkingDays(today, -6), startTime: "12:30", endTime: "13:30" },
    { title: "Fire drill", description: "Building-wide evacuation drill. Assemble at the car park entrance.", location: "Whole building", startsOn: addWorkingDays(today, 3), startTime: "10:30", endTime: "11:00" },
  ];
}

export function presentationAnnouncements(cal: PresentationCalendar): Array<{
  key: string; title: string; body: string; priority: "normal" | "important"; status: "published" | "draft";
  department?: string; publishedOn?: string; expiresOn?: string;
}> {
  const { today, addDays, addWorkingDays } = cal;
  const anishaStart = joinedOn(cal, 9221);
  const drill = addWorkingDays(today, 3);
  const cycle = reviewQuarters(today).open;
  const quarter = `Q${Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1}`;
  return [
    {
      key: "welcome-anisha", title: "Welcome Anna Kaur to HR", priority: "normal", status: "published",
      publishedOn: anishaStart,
      body: `Anna joined us on ${formatShortDay(anishaStart)} as HR Assistant, working with Melissa on onboarding and employee records. She sits on Level 17 - do say hello.`,
    },
    {
      key: "hiring-platform", title: "We are hiring: Engineering and Support", priority: "normal", status: "published",
      publishedOn: addDays(today, -18),
      body: "Two roles are open: a software engineer and a support executive. The referral bonus applies to both. Ryan has the details, and referrals go through HR.",
    },
    {
      key: "fire-drill", title: `Fire drill on ${formatDay(drill)}`, priority: "normal", status: "published",
      publishedOn: addDays(today, -6), expiresOn: addDays(drill, 1),
      body: `Building management will run an evacuation drill on ${formatDay(drill)} at 10:30. When the alarm sounds, leave by the nearest stairwell and assemble at the car park entrance. It takes about twenty minutes.`,
    },
    {
      key: "review-cycle", title: `${cycle.name}: self-reviews close soon`, priority: "important", status: "published",
      publishedOn: addDays(today, -3),
      body: `Self-reviews for the ${cycle.name} cycle are due on ${formatDay(addWorkingDays(today, 3))}, and managers have the following week to write theirs. The form is under Growth, and Farah's team can help if anything is unclear.`,
    },
    {
      key: "town-hall-agenda", title: `${quarter} town hall: agenda and questions`, priority: "normal", status: "draft",
      body: "Draft agenda for the quarterly town hall: results, the platform roadmap, hiring, and an open question session. Send questions ahead of time so we can group them.",
    },
  ];
}

export const presentationLifecycleTemplates: Array<{
  key: string; kind: "onboarding" | "offboarding"; name: string; description: string;
  tasks: Array<{ title: string; instructions?: string; role: "employee" | "manager" | "hr"; offset: number }>;
}> = [
  {
    key: "onboarding", kind: "onboarding", name: "New joiner onboarding", description: "Everything a new colleague needs in their first month at Meridian.",
    tasks: [
      { title: "Prepare laptop and accounts", instructions: "Raise the IT request at least three working days before the start date.", role: "hr", offset: -3 },
      { title: "Send the welcome pack", instructions: "Company handbook, benefits summary and the first-week schedule.", role: "hr", offset: -1 },
      { title: "First-day welcome and office tour", role: "manager", offset: 0 },
      { title: "Set up payroll and statutory details", instructions: "Bank details, EPF and tax file number, collected through HR.", role: "hr", offset: 1 },
      { title: "Meet the team and agree the first project", role: "manager", offset: 3 },
      { title: "Complete security and data-protection training", role: "employee", offset: 7 },
      { title: "Set first-quarter goals with your manager", role: "employee", offset: 14 },
      { title: "Thirty-day check-in", instructions: "Half an hour on how the first month went, what is unclear and what to change.", role: "manager", offset: 30 },
    ],
  },
  {
    key: "offboarding", kind: "offboarding", name: "Leaver offboarding", description: "Closing out an employment properly, in the right order.",
    tasks: [
      { title: "Acknowledge the resignation in writing", role: "hr", offset: -21 },
      { title: "Agree the handover plan", instructions: "Name the person taking each responsibility, and the date it moves.", role: "manager", offset: -14 },
      { title: "Complete the handover notes", role: "employee", offset: -5 },
      { title: "Return laptop, access card and equipment", role: "employee", offset: 0 },
      { title: "Revoke system access", instructions: "On the last working day, after the handover is confirmed.", role: "hr", offset: 0 },
      { title: "Final pay and exit interview", role: "hr", offset: 3 },
    ],
  },
];

/**
 * Two people still settling in and one leaving at the end of the month. The
 * completed tasks are the ones that would genuinely be done by now, so the
 * remaining ones are what HR and the manager actually have to do.
 */
export function presentationLifecyclePlans(cal: PresentationCalendar): Array<{
  employeeId: number; template: string; startsOn: string; targetDate: string; done: number[]; exitStatus?: "resigned" | "terminated" | "inactive";
}> {
  const { today, addDays, addWorkingDays } = cal;
  const haziq = joinedOn(cal, 9208);
  const anisha = joinedOn(cal, 9221);
  return [
    // Danny joined six weeks ago: nearly through, with the goal-setting task and
    // the thirty-day check-in still open.
    { employeeId: 9208, template: "onboarding", startsOn: haziq, targetDate: addDays(haziq, 30), done: [1, 2, 3, 4, 5, 6] },
    // Anna joined last week: the later tasks are still ahead of her.
    { employeeId: 9221, template: "onboarding", startsOn: anisha, targetDate: addDays(anisha, 30), done: [1, 2, 3, 4] },
    // Kenny resigned; his last working day is the end of this month.
    { employeeId: 9234, template: "offboarding", startsOn: addDays(today, -18), targetDate: addWorkingDays(today, 10), done: [1, 2], exitStatus: "resigned" },
  ];
}

export function presentationRecognitions(cal: PresentationCalendar): Array<{
  giver: number; receiver: number; category: "teamwork" | "above_and_beyond" | "customer_focus" | "problem_solving" | "mentoring";
  message: string; visibility: "company" | "private"; givenOn: string;
}> {
  const { today, addDays } = cal;
  return [
    { giver: 9203, receiver: 9204, category: "mentoring", message: "Thank you for pairing with Danny every afternoon in his first fortnight. He is contributing already, and that is largely your doing.", visibility: "company", givenOn: addDays(today, -24) },
    { giver: 9209, receiver: 9212, category: "problem_solving", message: "You found the cause of the Friday night deployment failure in under an hour and wrote it up so it cannot happen again.", visibility: "company", givenOn: addDays(today, -33) },
    { giver: 9231, receiver: 9233, category: "customer_focus", message: "Kestrel Retail said your handling of their migration weekend was the best support they have had from any vendor.", visibility: "company", givenOn: addDays(today, -26) },
    { giver: 9218, receiver: 9219, category: "above_and_beyond", message: "You covered both onboarding cohorts while we were short-handed and neither joiner noticed a thing.", visibility: "company", givenOn: addDays(today, -21) },
    { giver: 9205, receiver: 9207, category: "teamwork", message: "Thanks for staying late to finish the regression run before the release. It made the whole thing calm instead of frantic.", visibility: "company", givenOn: addDays(today, -14) },
    { giver: 9213, receiver: 9217, category: "above_and_beyond", message: "The research summary changed the roadmap. It is rare that six interviews are that useful.", visibility: "company", givenOn: addDays(today, -11) },
    { giver: 9222, receiver: 9223, category: "above_and_beyond", message: "Last month's payroll closed a day early and with no corrections. Thank you.", visibility: "company", givenOn: addDays(today, -8) },
    { giver: 9204, receiver: 9205, category: "problem_solving", message: "The billing reconciliation fix was neat, and the tests you added around it are better than the code they cover.", visibility: "company", givenOn: addDays(today, -4) },
    { giver: 9203, receiver: 9206, category: "teamwork", message: "You picked up the on-call handover at short notice and kept everyone informed. Quietly done and much appreciated.", visibility: "private", givenOn: addDays(today, -2) },
  ];
}

export function presentationGoals(cal: PresentationCalendar): Array<{
  owner: number; setBy: number; title: string; description: string; startsOn: string; dueOn: string;
  status: "active" | "completed"; progress: number; visibility: "private" | "team" | "company"; completedOn?: string;
  updates: Array<{ by: number; on: string; from: number; to: number; note?: string; status?: "active" | "completed" }>;
}> {
  const { today, addDays } = cal;
  return [
    {
      owner: 9205, setBy: 9203, title: "Cut billing service p95 latency to under 400 ms", description: "The billing service is the slowest path in the product. Profile it, fix the two worst queries and keep the improvement under load.",
      startsOn: addDays(today, -74), dueOn: addDays(today, 16), status: "active", progress: 65, visibility: "team",
      updates: [
        { by: 9205, on: addDays(today, -45), from: 0, to: 30, note: "Profiling done. Two N+1 queries in the invoice summary are most of it." },
        { by: 9205, on: addDays(today, -12), from: 30, to: 65, note: "First query fixed and deployed; p95 is down to 620 ms." },
      ],
    },
    {
      owner: 9205, setBy: 9205, title: "Finish the platform on-call handbook", description: "Write down what the platform team actually does on call, so the next joiner does not have to ask.",
      startsOn: addDays(today, -60), dueOn: addDays(today, -5), status: "active", progress: 70, visibility: "team",
      updates: [{ by: 9205, on: addDays(today, -20), from: 40, to: 70, note: "Escalation paths and the runbook index are written. The alert catalogue is left." }],
    },
    {
      owner: 9204, setBy: 9203, title: "Move deployments to the new pipeline", description: "Every service deploys through the new pipeline, with a rollback that has been tested rather than assumed.",
      startsOn: addDays(today, -88), dueOn: addDays(today, 30), status: "active", progress: 55, visibility: "team",
      updates: [{ by: 9204, on: addDays(today, -26), from: 25, to: 55, note: "Six of eleven services moved. Rollback rehearsed twice." }],
    },
    {
      owner: 9207, setBy: 9203, title: "Automate the release regression suite", description: "The release checklist takes a day by hand. Automate the parts that are the same every time.",
      startsOn: addDays(today, -52), dueOn: addDays(today, 24), status: "active", progress: 40, visibility: "team",
      updates: [{ by: 9207, on: addDays(today, -9), from: 15, to: 40, note: "Smoke suite runs on every build now." }],
    },
    {
      owner: 9206, setBy: 9206, title: "Take over the reporting service", description: "Become the person who can safely change the reporting service without help.",
      startsOn: addDays(today, -40), dueOn: addDays(today, 50), status: "active", progress: 25, visibility: "team",
      updates: [],
    },
    {
      owner: 9203, setBy: 9202, title: "Halve the platform on-call load", description: "Nobody should be woken twice in a week. Cut the alerts that do not need a person, and share the rota more widely.",
      startsOn: addDays(today, -84), dueOn: addDays(today, 36), status: "active", progress: 60, visibility: "team",
      updates: [
        { by: 9203, on: addDays(today, -40), from: 20, to: 45, note: "Nine alerts retired, four rewritten to page only on customer impact." },
        { by: 9203, on: addDays(today, -6), from: 45, to: 60, note: "Two nights paged last month, against nine a quarter ago." },
      ],
    },
    {
      owner: 9203, setBy: 9203, title: "Grow two engineers into senior scope", description: "Give Ben and Aisha work with real ownership, and the support to carry it.",
      startsOn: addDays(today, -95), dueOn: addDays(today, 70), status: "active", progress: 35, visibility: "team",
      updates: [{ by: 9203, on: addDays(today, -16), from: 15, to: 35, note: "Both now lead their own workstream; reviewing progress at the mid-year cycle." }],
    },
    {
      owner: 9217, setBy: 9213, title: "Run six discovery interviews for the analytics work", description: "Understand how customers actually read the reports before we redesign them.",
      startsOn: addDays(today, -62), dueOn: addDays(today, -12), status: "completed", progress: 100, visibility: "company", completedOn: addDays(today, -13),
      updates: [
        { by: 9217, on: addDays(today, -30), from: 30, to: 80, note: "Five interviews done, one rescheduled." },
        { by: 9217, on: addDays(today, -13), from: 80, to: 100, note: "Summary shared with product and engineering.", status: "completed" },
      ],
    },
    {
      owner: 9233, setBy: 9232, title: "First response under two hours for priority tickets", description: "Hold first response under two hours for priority-one tickets through the quarter.",
      startsOn: addDays(today, -80), dueOn: addDays(today, 12), status: "active", progress: 80, visibility: "team",
      updates: [{ by: 9233, on: addDays(today, -7), from: 60, to: 80, note: "Averaging 84 minutes this month." }],
    },
    {
      owner: 9228, setBy: 9226, title: "Close two enterprise accounts this quarter", description: "Two signed enterprise agreements, with the onboarding date agreed at signature.",
      startsOn: addDays(today, -78), dueOn: addDays(today, 14), status: "active", progress: 50, visibility: "team",
      updates: [{ by: 9228, on: addDays(today, -15), from: 20, to: 50, note: "One signed, one at legal review." }],
    },
    {
      owner: 9219, setBy: 9218, title: "Cut time-to-offer to under three weeks", description: "From first interview to written offer, for every open engineering role.",
      startsOn: addDays(today, -70), dueOn: addDays(today, 40), status: "active", progress: 45, visibility: "team",
      updates: [{ by: 9219, on: addDays(today, -18), from: 20, to: 45, note: "Interview loop shortened from five stages to three." }],
    },
  ];
}

/**
 * One closed cycle for history and one open cycle that is the reason the
 * "Reviews to write" widget has anything in it: the platform manager has two
 * self-reviews waiting for her and one review she has already written.
 */
export function presentationReviewCycles(cal: PresentationCalendar): Array<{
  key: string; name: string; periodStart: string; periodEnd: string; selfDueOn: string; managerDueOn: string;
  status: "open" | "closed"; openedOn: string; closedOn?: string; departments: string[];
  reviews: Array<{ employee: number; self?: [number, string, string]; manager?: [number, string, string, number]; response?: [string, string] }>;
}> {
  const { today, addDays, addWorkingDays } = cal;
  const { open, closed } = reviewQuarters(today);
  // The finished cycle ran in the weeks after its quarter closed.
  const closedOpened = addDays(closed.end, 7);
  const openedOn = addDays(today, -10) > open.end ? addDays(today, -10) : addDays(open.end, 1);
  return [
    {
      key: "previous", name: closed.name, periodStart: closed.start, periodEnd: closed.end,
      selfDueOn: addDays(closedOpened, 14), managerDueOn: addDays(closedOpened, 28), status: "closed",
      openedOn: closedOpened, closedOn: addDays(closedOpened, 35), departments: [],
      reviews: [
        {
          employee: 9205,
          self: [3, "Shipped the invoicing rewrite and picked up the reporting service when Ravi was away.", addDays(closedOpened, 9)],
          manager: [4, "Ben took on work outside his comfort zone twice this quarter and both landed well. Next: more design input earlier.", addDays(closedOpened, 23), 9203],
          response: ["Thank you. I would like to take the lead on the reporting work next.", addDays(closedOpened, 24)],
        },
        {
          employee: 9204,
          self: [4, "Led the pipeline migration and mentored two engineers through it.", addDays(closedOpened, 8)],
          manager: [4, "Ravi is the reason the migration was uneventful. The mentoring is what I value most.", addDays(closedOpened, 22), 9203],
        },
      ],
    },
    {
      key: "current", name: open.name, periodStart: open.start, periodEnd: open.end,
      selfDueOn: addWorkingDays(today, 3), managerDueOn: addWorkingDays(today, 10),
      status: "open", openedOn, departments: ["Engineering", "Product"],
      reviews: [
        // Written already, so the cycle shows progress rather than an empty list.
        {
          employee: 9204,
          self: [4, "Pipeline work is on track and I have kept the on-call load off the rest of the team.", addDays(today, -7)],
          manager: [4, "Ravi carries more than his share quietly. We agreed he will hand over half of on-call this quarter.", addDays(today, -5), 9203],
        },
        // Waiting for the manager: this is what her widget counts.
        { employee: 9205, self: [4, "Billing latency is down by a third and the on-call handbook is nearly finished.", addDays(today, -4)] },
        { employee: 9207, self: [3, "Automated the smoke suite; the full regression is still manual.", addDays(today, -2)] },
      ],
    },
  ];
}

/**
 * A tiny deterministic generator (mulberry32).
 *
 * Attendance needs variation to look real, but a rebuilt presentation must be
 * identical for a given day, so Math.random is not an option.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A few people have filled in more of their record, as they would have over
 * time. Deliberately not everyone, and never every field: a directory where
 * every row is complete does not look like a real one.
 */
export const presentationDetails: Array<{
  employeeId: number; address?: string; dateOfBirth?: string; emergencyContactName?: string; emergencyContactPhone?: string;
}> = [
  // Addresses are deliberately fictional: "Contoh" is Malay for "example", and
  // no street or building below exists. Phone numbers use the unallocated
  // 03-0000 block, which cannot ring a real line.
  { employeeId: 9203, address: "12-3A, Residensi Contoh, Jalan Contoh 3, 50450 Kuala Lumpur", dateOfBirth: "1989-04-17", emergencyContactName: "Ali Ahmad", emergencyContactPhone: "+60 3-0000 0103" },
  { employeeId: 9205, address: "8-12, Pangsapuri Contoh Indah, Jalan Contoh 8, 60000 Kuala Lumpur", dateOfBirth: "1995-11-02", emergencyContactName: "Mei Wong", emergencyContactPhone: "+60 3-0000 0105" },
  { employeeId: 9202, address: "27, Jalan Contoh Jaya 2, Taman Contoh, 50490 Kuala Lumpur", dateOfBirth: "1984-02-28" },
  { employeeId: 9218, address: "5-8, Menara Contoh Residences, Jalan Contoh 11, 50470 Kuala Lumpur", dateOfBirth: "1986-07-09", emergencyContactName: "Hassan Idris", emergencyContactPhone: "+60 3-0000 0118" },
  { employeeId: 9208, address: "Unit 14-2, Contoh Court, Jalan Contoh 21, 53300 Kuala Lumpur", dateOfBirth: "2002-01-26", emergencyContactName: "Kamal Ismail", emergencyContactPhone: "+60 3-0000 0108" },
  { employeeId: 9221, dateOfBirth: "2003-05-14", emergencyContactName: "Harjit Singh", emergencyContactPhone: "+60 3-0000 0121" },
  { employeeId: 9226, address: "19, Jalan Contoh Kiara 3, 50480 Kuala Lumpur", dateOfBirth: "1983-09-30" },
  { employeeId: 9231, address: "3-11, Contoh Villa, Jalan Contoh Kiara 5, 50480 Kuala Lumpur", emergencyContactName: "Suresh Menon", emergencyContactPhone: "+60 3-0000 0131" },
  { employeeId: 9234, dateOfBirth: "1993-12-05" },
  { employeeId: 9213, address: "22-6, Residensi Contoh Maju, Jalan Contoh 9, 59100 Kuala Lumpur", dateOfBirth: "1987-03-19" },
];
