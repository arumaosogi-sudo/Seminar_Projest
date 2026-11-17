/**
 * API contract shared by the React app (src/) and the Worker (worker/).
 * Request bodies are validated with the zod schemas below; responses use the TS types.
 * All endpoints live under /api and return JSON. Errors: { error: string, code?: string } with 4xx/5xx.
 * Full endpoint list: docs/ARCHITECTURE.md
 */
import { z } from "zod";

/* ───────────── shared primitives ───────────── */

export type Role = "student" | "admin";
export type ClassStatus = "active" | "archived";
export type EnrollmentStatus = "active" | "withdrawn";
export type TestKind = "pretest" | "posttest" | "other";
export type QuestionType = "single" | "multi" | "truefalse" | "short" | LayoutType;
/** Google-Forms-style blocks in the builder: no answer, no points, never graded. */
export type LayoutType = "text" | "image" | "section";
export const LAYOUT_TYPES: readonly LayoutType[] = ["text", "image", "section"];
export const isLayoutType = (t: QuestionType): t is LayoutType => (LAYOUT_TYPES as readonly string[]).includes(t);
/** Uploaded images are served by the Worker at /api/images/:id (see POST /api/admin/images). */
export const UPLOADED_IMAGE_URL = /^\/api\/images\/\d+$/;
export type ScorePolicy = "highest" | "latest" | "first";
export type Availability = "manual" | "scheduled";

export interface ApiError {
  error: string;
  code?: string;
}

/* ───────────── config & auth ───────────── */

export interface AppConfig {
  googleClientId: string; // "" when not configured
  devLogin: boolean; // true only when DEV_LOGIN=true (local dev)
  allowedStudentDomain: string; // primary domain: lamduan.mfu.ac.th
  allowedStudentDomains: string[]; // all accepted student domains, e.g. ["lamduan.mfu.ac.th", "mfu.ac.th"]
  adminPasswordLogin: boolean; // true when ADMIN_USERNAME + ADMIN_PASSWORD_HASH are configured
}

/** POST /api/auth/admin-password — local instructor account (until instructors sign in with Google). */
export const adminPasswordLoginBody = z.object({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(200),
});
export type AdminPasswordLoginBody = z.input<typeof adminPasswordLoginBody>;

export const loginAs = z.enum(["student", "admin"]);

export const googleLoginBody = z.object({
  credential: z.string().min(10), // Google ID token from Sign in with Google
  joinCode: z.string().trim().toUpperCase().optional(),
  as: loginAs.default("student"),
});
export type GoogleLoginBody = z.input<typeof googleLoginBody>;

export const devLoginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  joinCode: z.string().trim().toUpperCase().optional(),
  as: loginAs.default("student"),
});
export type DevLoginBody = z.input<typeof devLoginBody>;

export interface ClassSummary {
  id: number;
  name: string; // "2569/1 · Section 1"
  academicYear: number;
  semester: number;
  section: number;
  joinCode: string;
  status: ClassStatus;
}

/** GET /api/classes/by-code/:code (public; for the join chip on the login page) */
export type PublicClassInfo = Pick<ClassSummary, "id" | "name" | "academicYear" | "semester" | "section" | "status">;

export interface StudentMe {
  role: "student";
  student: {
    id: number;
    studentCode: string;
    email: string;
    firstName: string | null;
    needsOnboarding: boolean; // true while firstName is empty
  };
  enrollment: {
    id: number;
    classId: number;
    className: string;
    status: EnrollmentStatus;
  } | null; // null = logged in but not in any active class yet (must scan a section QR)
  /** Set when a join code was sent but ignored, e.g. already in another section this semester. */
  joinNotice?: string;
}

export interface AdminMe {
  role: "admin";
  admin: { id: number | null; email: string; name: string | null };
}

export type Me = StudentMe | AdminMe;

export const updateMeBody = z.object({
  firstName: z.string().trim().min(1).max(60),
});

/** POST /api/me/join — a signed-in student joins a section with its code (QR scanned after signing in). */
export const joinClassBody = z.object({
  joinCode: z.string().trim().toUpperCase().min(1).max(20),
});

/* ───────────── student: home status & tests ───────────── */

/** GET /api/me/status — drives the Home page (menus locked until required tests are submitted) */
export interface StudentStatus {
  menusLocked: boolean;
  requiredPending: { assignmentId: number; title: string }[];
  pretest: { assignmentId: number; title: string; submitted: boolean; score: number | null; maxScore: number | null } | null;
  posttest: { assignmentId: number; title: string; isOpen: boolean; submitted: boolean; score: number | null; maxScore: number | null } | null;
}

/** GET /api/me/tests — tests assigned to the student's class */
export interface StudentTestItem {
  assignmentId: number;
  testId: number;
  title: string;
  kind: TestKind;
  questionCount: number;
  timeLimitMin: number | null;
  maxAttempts: number | null;
  attemptsUsed: number;
  scorePolicy: ScorePolicy;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  status: "not_open" | "open" | "in_progress" | "submitted" | "closed";
  inProgressAttemptId: number | null;
  countedScore: number | null; // per score policy
  maxScore: number | null;
  lastSubmittedAttemptId: number | null;
}

/** Question as sent to a student — never contains the answer. */
export interface StudentQuestion {
  id: number;
  position: number;
  type: QuestionType;
  prompt: string; // the title for text / section blocks, the caption for image blocks
  description: string; // text / section blocks; "" otherwise
  imageUrl: string | null;
  options: { id: string; text: string }[]; // empty for 'short'; ["true","false"] ids for truefalse
  points: number;
  required: boolean;
}

export type AnswerValue = string | string[] | boolean;

/** POST /api/attempts { assignmentId } → start or resume; GET /api/attempts/:id while in progress */
export interface AttemptInProgress {
  attemptId: number;
  assignmentId: number;
  title: string;
  status: "in_progress";
  startedAt: string;
  deadlineAt: string | null;
  serverNow: string; // use to sync the countdown (never trust the client clock)
  attemptNumber: number;
  maxAttempts: number | null;
  questions: StudentQuestion[];
  answers: Record<string, AnswerValue>;
}

export const startAttemptBody = z.object({ assignmentId: z.number().int().positive() });

export const saveAnswersBody = z.object({
  answers: z.record(z.string(), z.union([z.string().max(500), z.array(z.string().max(100)).max(20), z.boolean()])),
});

/**
 * POST /api/attempts/:id/submit — the body is optional: answers still on the student's device are saved and the
 * attempt submitted in one request (answers are kept in the browser and only checkpointed every few minutes).
 */
export const submitAttemptBody = saveAnswersBody.partial();

/** POST /api/attempts/:id/submit and GET /api/attempts/:id after submission */
export interface AttemptResult {
  attemptId: number;
  assignmentId: number;
  title: string;
  status: "submitted";
  startedAt: string;
  submittedAt: string;
  autoSubmitted: boolean; // true when the server submitted it because time ran out
  score: number;
  maxScore: number;
  attemptNumber: number;
  attemptsLeft: number | null;
  /**
   * Only when the assignment has show_answers = 1 (shown right after submitting). Otherwise null.
   * Graded questions only — title / image / section blocks are left out.
   */
  review: {
    questionId: number;
    position: number;
    type: QuestionType;
    prompt: string;
    options: { id: string; text: string }[];
    yourAnswer: AnswerValue | null;
    correctAnswer: AnswerValue;
    correct: boolean;
    points: number;
    earned: number;
  }[] | null;
}

/* ───────────── games: scores (GAME-7) ───────────── */

/** Every run is scored out of 10; a student's collected score for a game is their best run in any of its modes. */
export const GAME_MAX_SCORE = 10;
export const GAME_IDS = ["balloon-pop", "group-sort", "diameter"] as const;
export type GameId = (typeof GAME_IDS)[number];
export const GAME_LABELS: Record<GameId, string> = {
  "balloon-pop": "Game 1: Balloon Pop",
  "group-sort": "Game 2: Group Sort",
  diameter: "Game 3: Diameter",
};
/** One key per game mode (Group Sort has two); the part before ":" is the game id. */
export const GAME_SCORE_KEYS = ["balloon-pop", "group-sort:memory", "group-sort:conveyor", "diameter"] as const;
export type GameScoreKey = (typeof GAME_SCORE_KEYS)[number];

const shortText = z.string().max(400);

/** POST /api/me/game-runs — the `run` object sent by the games module's onGameFinish. */
export const gameRunBody = z.object({
  runId: z.string().trim().min(8).max(64).regex(/^[\w-]+$/),
  scoreKey: z.enum(GAME_SCORE_KEYS),
  score: z.number().min(0).max(GAME_MAX_SCORE),
  completed: z.boolean().default(true),
  summary: shortText.default(""),
  mistakes: z
    .array(z.object({ prompt: shortText, yours: shortText, answer: shortText, why: shortText.optional() }))
    .max(100)
    .default([]),
});
export type GameRunBody = z.input<typeof gameRunBody>;

export interface GameBest {
  gameId: GameId;
  best: number;
  plays: number;
  lastPlayedAt: string;
}

/** GET /api/admin/game-results?classId=&status= */
export interface AdminGameResults {
  classId: number | null;
  /** Points per game (10); the total is out of maxScore × games.length. */
  maxScore: number;
  games: { gameId: GameId; label: string; players: number; plays: number; meanBest: number | null }[];
  rows: {
    studentCode: string;
    firstName: string | null;
    className: string;
    enrollmentStatus: EnrollmentStatus;
    /** Best run per game (any mode); null when never played */
    games: Record<GameId, { best: number; plays: number; lastPlayedAt: string } | null>;
    /** Sum of the best scores (unplayed games count 0) */
    total: number;
  }[];
}

/* ───────────── admin: classes ───────────── */

export interface AdminClass extends ClassSummary {
  restrictToRoster: boolean;
  studentCount: number; // active enrollments
  rosterCount: number;
  pretestSubmitted: number;
  posttestSubmitted: number;
  createdAt: string;
  archivedAt: string | null;
  /** Instructor who created the class; null for classes made before owners were recorded (visible to everyone). */
  ownerEmail: string | null;
}

export const createClassBody = z.object({
  academicYear: z.number().int().min(2500).max(2700),
  semester: z.number().int().min(1).max(3),
  section: z.number().int().min(1).max(99),
  restrictToRoster: z.boolean().default(false),
});

export const updateClassBody = z.object({
  restrictToRoster: z.boolean().optional(),
  regenerateJoinCode: z.boolean().optional(),
});

/** POST /api/admin/classes/:id/owner · /api/admin/tests/:id/owner (username account only): hand an item to an instructor. */
export const setOwnerBody = z.object({ email: z.string().trim().toLowerCase().email() });

/* ───────────── admin: students ───────────── */

export interface AdminStudentRow {
  enrollmentId: number;
  /** null once the student has been anonymized */
  studentId: number | null;
  studentCode: string;
  firstName: string | null;
  email: string | null;
  classId: number;
  className: string;
  status: EnrollmentStatus;
  joinedAt: string | null;
  lastLoginAt: string | null;
}

export const setEnrollmentStatusBody = z.object({ status: z.enum(["active", "withdrawn"]) });
export const moveEnrollmentBody = z.object({ classId: z.number().int().positive() });

/** GET /api/admin/students/unassigned — signed in with Google but not enrolled in any class (no QR scanned). */
export interface UnassignedStudent {
  studentId: number;
  studentCode: string;
  firstName: string | null;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
}

/** POST /api/admin/students/:id/enroll — the instructor adds a signed-in student to a section. */
export const enrollStudentBody = z.object({ classId: z.number().int().positive() });

/* ───────────── admin: tests & builder ───────────── */

export const questionInput = z.object({
  id: z.number().int().positive().optional(), // omit for new questions
  type: z.enum(["single", "multi", "truefalse", "short", "text", "image", "section"]),
  /** Required for questions; optional title / caption for layout blocks (checked in worker/questionInput.ts). */
  prompt: z.string().trim().max(2000),
  description: z.string().max(4000).default(""),
  /** https:// URL, an uploaded image (/api/images/:id) or a site path under /images/ (no other schemes, no path traversal) */
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) =>
        /^https:\/\/[a-z0-9.-]+(:\d+)?(\/[^\s]*)?$/i.test(v) ||
        UPLOADED_IMAGE_URL.test(v) ||
        (/^\/images\/[^\s]*$/.test(v) && !v.includes("..") && !v.includes("//")),
      { message: "Image URL must start with https:// or /images/, or be an uploaded image" },
    )
    .nullable()
    .optional(),
  options: z.array(z.object({ id: z.string().min(1).max(20), text: z.string().trim().min(1).max(500) })).max(12).default([]),
  /** single: option id · multi: option ids · truefalse: boolean · short: accepted answers */
  answer: z.union([z.string(), z.array(z.string()), z.boolean()]),
  points: z.number().int().min(0).max(100).default(1),
  required: z.boolean().default(true),
});
export type QuestionInput = z.input<typeof questionInput>;

export const saveTestBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).default(""),
  // "other" can still exist in old rows (TestKind), but new / saved tests are a pretest or a posttest.
  kind: z.enum(["pretest", "posttest"]),
  questions: z.array(questionInput).max(200),
});
export type SaveTestBody = z.input<typeof saveTestBody>;

export interface AdminQuestion {
  id: number;
  position: number;
  type: QuestionType;
  prompt: string;
  description: string;
  imageUrl: string | null;
  options: { id: string; text: string }[];
  answer: AnswerValue;
  points: number;
  required: boolean;
}

export interface AdminTestSummary {
  id: number;
  title: string;
  kind: TestKind;
  /** Instructor who created the test; only they (or the emergency account) can edit or delete it. */
  ownerEmail: string | null;
  questionCount: number;
  maxScore: number;
  currentVersion: number;
  assignedClassCount: number;
  attemptCount: number;
  updatedAt: string;
}

export interface AdminTestDetail extends AdminTestSummary {
  description: string;
  questions: AdminQuestion[];
  /** true when students already started the current version → next save creates version currentVersion+1 */
  versionLocked: boolean;
  versions: { versionNo: number; createdAt: string; attemptCount: number }[];
}

export interface AdminTestSaveResult {
  test: AdminTestDetail;
  newVersionCreated: boolean;
}

/* ───────────── admin: assignments ───────────── */

export const assignmentSettings = z
  .object({
    timeLimitMin: z.number().int().min(1).max(600).nullable(),
    maxAttempts: z.number().int().min(1).max(50).nullable(),
    scorePolicy: z.enum(["highest", "latest", "first"]),
    availability: z.enum(["manual", "scheduled"]),
    isOpen: z.boolean(),
    opensAt: z.string().datetime().nullable(),
    closesAt: z.string().datetime().nullable(),
    showAnswers: z.boolean(),
    requiredFirst: z.boolean(),
  })
  .refine((s) => s.availability === "manual" || (s.opensAt !== null && s.closesAt !== null), {
    message: "opensAt and closesAt are required when availability is 'scheduled'",
  });
export type AssignmentSettings = z.infer<typeof assignmentSettings>;

export interface AdminAssignment extends AssignmentSettings {
  id: number;
  testId: number;
  classId: number;
  className: string;
  currentlyOpen: boolean;
  submittedCount: number;
  studentCount: number;
}

/* ───────────── admin: results ───────────── */

export interface ScoreStats {
  n: number;
  mean: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
  maxScore: number | null;
}

export interface AdminResults {
  classId: number | null; // null = all active classes
  tests: { testId: number; title: string; kind: TestKind; maxScore: number; stats: ScoreStats }[];
  /** Paired pre→post comparison when one pretest and one posttest are included */
  paired: { n: number; meanGain: number | null; improved: number } | null;
  /** Histogram of counted scores per test: bins 0..maxScore */
  distribution: { testId: number; bins: { score: number; count: number }[] }[];
  /** % correct per question for each test (latest version attempts) */
  itemAnalysis: { testId: number; items: { questionId: number; position: number; prompt: string; percentCorrect: number; n: number }[] }[];
  rows: {
    studentCode: string;
    firstName: string | null;
    className: string;
    enrollmentStatus: EnrollmentStatus;
    scores: Record<string, number | null>; // key = testId
  }[];
}

/* ───────────── admin: settings ───────────── */

export interface AdminUser {
  id: number | null; // null when the admin comes from the ADMIN_EMAILS var
  email: string;
  name: string | null;
  source: "database" | "env";
}

export const addAdminBody = z.object({ email: z.string().trim().toLowerCase().email(), name: z.string().max(80).optional() });

/** GET /api/admin/usage — Admin → Settings → Storage */
export interface UsageReport {
  dbBytes: number;
  limitBytes: number;
  warnRatio: number;
  approx: { students: number; attempts: number; images: number };
  classes: number;
  /** Question images stored in Cloudflare R2 (migration 0008), against the free 10 GB. */
  imageBytes: number;
  imageLimitBytes: number;
}

export interface AuditEntry {
  id: number;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
  /**
   * Names looked up when the log is read (ids in the entry → what they are called now), so Settings can show a sentence.
   * Missing when the thing has been deleted since; an anonymized student has no student ID.
   */
  names?: { student?: string; className?: string; fromClass?: string; toClass?: string; test?: string };
}
