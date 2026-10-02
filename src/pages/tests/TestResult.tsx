import { useParams } from "react-router";
import { Placeholder } from "@/components/student/Placeholder";

/** 🧩 Teammate page — replace this file (route: /tests/result/:attemptId). */
export default function TestResult() {
  const { attemptId } = useParams();
  return (
    <Placeholder
      title="Test result"
      description={`Attempt #${attemptId ?? "?"}`}
      figmaFrame="Tests – Result"
      accent="tests"
      file="src/pages/tests/TestResult.tsx"
      requirementIds={["TEST-5"]}
      checklist={[
        "GET /api/attempts/:attemptId → AttemptResult (if it is still in progress, redirect to /tests/:assignmentId/take)",
        "Score card: “7 / 10”, submitted time, “Submitted automatically when time ran out” when autoSubmitted",
        "Pre → post comparison when both are done, e.g. “Pretest 7 → Posttest 8” (from GET /api/me/status)",
        "Review list only when `review` is not null: your answer, correct answer, ✓ / ✕, points earned (TEST-5)",
        "`review` stays null until you have used all your attempts or the assignment has closed (and only if the instructor enabled answers) — when it is null show: “Answers will be shown after your last attempt or when the test closes”",
        "Never cache or reconstruct answers on the client — always re-fetch GET /api/attempts/:id to see whether the review is available yet",
        "“Try again” when attemptsLeft > 0 (or null = unlimited) and the assignment is still open; “Back to tests”",
        "After a test is submitted, invalidate [\"me\"] queries so the Home test chips update",
      ]}
      apiReady={["GET /api/attempts/:id → AttemptResult", "GET /api/me/status → StudentStatus (pretest/posttest scores)"]}
      links={[
        { to: "/", label: "Back to Home" },
        { to: "/tests", label: "All tests" },
      ]}
    />
  );
}
