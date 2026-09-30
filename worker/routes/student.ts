import { Hono } from "hono";
import type { StudentStatus, StudentTestItem } from "../../shared/contract";
import { requireStudent } from "../auth";
import { studentTestStates, type StudentTestState } from "../engine";
import type { AppEnv } from "../env";

export const studentRoutes = new Hono<AppEnv>();

studentRoutes.use("/me/status", requireStudent);
studentRoutes.use("/me/tests", requireStudent);

/** Prefer an open assignment of that kind, otherwise the most recently created one. */
function pickByKind(states: StudentTestState[], kind: "pretest" | "posttest"): StudentTestState | null {
  const list = states.filter((s) => s.assignment.kind === kind);
  if (list.length === 0) return null;
  return [...list].sort((a, b) => Number(b.item.isOpen) - Number(a.item.isOpen) || b.assignment.id - a.assignment.id)[0];
}

studentRoutes.get("/me/status", async (c) => {
  const s = c.get("student");
  const empty: StudentStatus = { menusLocked: false, requiredPending: [], pretest: null, posttest: null };
  if (!s.enrollment) return c.json(empty);

  const states = await studentTestStates(c.env.DB, s.enrollment.id, s.enrollment.classId, new Date());
  const requiredPending = states
    .filter((st) => st.assignment.required_first === 1 && st.item.isOpen && !st.submittedAny)
    .map((st) => ({ assignmentId: st.assignment.id, title: st.assignment.title }));

  const pre = pickByKind(states, "pretest");
  const post = pickByKind(states, "posttest");
  const status: StudentStatus = {
    menusLocked: requiredPending.length > 0,
    requiredPending,
    pretest: pre
      ? {
          assignmentId: pre.assignment.id,
          title: pre.assignment.title,
          submitted: pre.submittedAny,
          score: pre.item.countedScore,
          maxScore: pre.item.maxScore,
        }
      : null,
    posttest: post
      ? {
          assignmentId: post.assignment.id,
          title: post.assignment.title,
          isOpen: post.item.isOpen,
          submitted: post.submittedAny,
          score: post.item.countedScore,
          maxScore: post.item.maxScore,
        }
      : null,
  };
  return c.json(status);
});

studentRoutes.get("/me/tests", async (c) => {
  const s = c.get("student");
  if (!s.enrollment) return c.json<StudentTestItem[]>([]);
  const states = await studentTestStates(c.env.DB, s.enrollment.id, s.enrollment.classId, new Date());
  return c.json<StudentTestItem[]>(states.map((st) => st.item));
});
