import { useParams } from "react-router";
import { Placeholder } from "@/components/student/Placeholder";
import { RequireStudent } from "@/components/student/RequireStudent";

const API = [
  "POST /api/attempts { assignmentId } → AttemptInProgress (start or resume)",
  "GET /api/attempts/:id → AttemptInProgress | AttemptResult",
  "PUT /api/attempts/:id/answers { answers } → { savedAt } (merge)",
  "POST /api/attempts/:id/submit → AttemptResult",
];

/**
 * 🧩 Teammate page — replace this file (route: /tests/:assignmentId/take).
 * Full-screen (no student nav): it lives outside StudentLayout, so it wraps itself with <RequireStudent>.
 */
export default function TakeTest() {
  const { assignmentId } = useParams();
  return (
    <RequireStudent>
      <div className="min-h-dvh bg-app">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:py-10">
          <Placeholder
            title="Take test"
            description={`Assignment #${assignmentId ?? "?"} — full-screen test page (no navigation bar).`}
            figmaFrame="Tests – Take"
            accent="tests"
            file="src/pages/tests/TakeTest.tsx"
            requirementIds={["TEST-2", "TEST-3", "TEST-4", "NFR-4", "NFR-6"]}
            checklist={[
              "On mount: POST /api/attempts { assignmentId } — resumes automatically if an attempt is in progress; restore `answers`",
              "Question types: single (radio), multi (checkbox), truefalse, short (text ≤ 500 chars); show image when imageUrl is set; mark required",
              "Layout like Google Form: one long page or one-per-page, plus a question navigator (answered / unanswered / current)",
              "Autosave (TEST-3): debounce ~1 s → PUT /api/attempts/:id/answers with only the changed answers; show “Saved · 10:42” / “Saving…” / “Offline — will retry”",
              "Countdown from the SERVER clock (TEST-2): offset = serverNow − Date.now() once, remaining = deadlineAt − (Date.now() + offset); never trust the device clock",
              "Time up (TEST-4): stop editing and call GET /api/attempts/:id — the server auto-submits with the saved answers; then go to the result",
              "Review screen before submit: list unanswered/required questions → “Submit” (confirm dialog) → POST /api/attempts/:id/submit",
              "After submit → /tests/result/:attemptId (replace history so Back doesn't return to the test)",
              "Warn on tab close while a save is pending (beforeunload)",
              "Errors: 409/410 (closed, no attempts left, already submitted) → friendly message + link to /tests",
            ]}
            apiReady={API}
            links={[{ to: "/tests", label: "Back to tests" }]}
          />
        </div>
      </div>
    </RequireStudent>
  );
}
