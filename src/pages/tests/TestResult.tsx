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
        "Review list only when `review` is not null (the instructor decides — TEST-5): your answer, correct answer, ✓ / ✕, points earned",
        "“Try again” when attemptsLeft > 0 (or null = unlimited) and the assignment is still open; “Back to tests”",
        "After a pretest is submitted, invalidate [\"me\"] queries so Home unlocks Games and 3D Explore",
      ]}
      apiReady={["GET /api/attempts/:id → AttemptResult", "GET /api/me/status → StudentStatus (pretest/posttest scores)"]}
      links={[
        { to: "/", label: "Back to Home" },
        { to: "/tests", label: "All tests" },
      ]}
    />
  );
}
