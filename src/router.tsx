import { createBrowserRouter, Navigate, type RouteObject } from "react-router";

/**
 * All routes. Every page is lazy-loaded so each screen only downloads its own code.
 * Page files export a default React component.
 *
 * 🧩 Teammate areas (placeholders, replace the page files — routes are already wired):
 *    /games/*    → src/pages/games/
 *    /explore/*  → src/pages/explore/
 *    /tests/*    → src/pages/tests/   (the Worker API for tests is ready — see docs/ARCHITECTURE.md §5)
 */
const page = (load: () => Promise<{ default: React.ComponentType }>) => ({
  lazy: async () => ({ Component: (await load()).default }),
});

const studentRoutes: RouteObject[] = [
  { index: true, ...page(() => import("./pages/Home")) },

  // 🧩 Games (teammate)
  { path: "games", ...page(() => import("./pages/games/GamesHub")) },
  { path: "games/balloon-pop", ...page(() => import("./pages/games/BalloonPop")) },
  { path: "games/group-sort", ...page(() => import("./pages/games/GroupSort")) },
  { path: "games/diameter", ...page(() => import("./pages/games/Diameter")) },
  { path: "games/result", ...page(() => import("./pages/games/GameResult")) },

  // 🧩 3D Explore (teammate)
  { path: "explore", ...page(() => import("./pages/explore/Explore3D")) },
  { path: "explore/sarcomere", ...page(() => import("./pages/explore/Sarcomere")) },

  // 🧩 Tests (teammate UI, API ready)
  { path: "tests", ...page(() => import("./pages/tests/TestsList")) },
  { path: "tests/result/:attemptId", ...page(() => import("./pages/tests/TestResult")) },
];

export const routes: RouteObject[] = [
  // Public
  { path: "/join/:code", ...page(() => import("./pages/Join")) },
  { path: "/login", ...page(() => import("./pages/Login")) },
  { path: "/credits", ...page(() => import("./pages/Credits")) },
  { path: "/privacy", ...page(() => import("./pages/Privacy")) },

  // Student (signed in)
  { path: "/onboarding", ...page(() => import("./pages/Onboarding")) },
  {
    path: "/tests/:assignmentId/take", // full-screen test page (no nav) — 🧩 teammate
    ...page(() => import("./pages/tests/TakeTest")),
  },
  { path: "/", ...page(() => import("./components/student/StudentLayout")), children: studentRoutes },

  // Admin
  { path: "/admin/login", ...page(() => import("./pages/admin/AdminLogin")) },
  {
    path: "/admin",
    ...page(() => import("./components/admin/AdminLayout")),
    children: [
      { index: true, element: <Navigate to="classes" replace /> },
      { path: "classes", ...page(() => import("./pages/admin/Classes")) },
      { path: "tests", ...page(() => import("./pages/admin/Tests")) },
      { path: "tests/:testId", ...page(() => import("./pages/admin/TestBuilder")) },
      { path: "tests/:testId/assign", ...page(() => import("./pages/admin/AssignTest")) },
      { path: "results", ...page(() => import("./pages/admin/Results")) },
      { path: "students", ...page(() => import("./pages/admin/Students")) },
      { path: "settings", ...page(() => import("./pages/admin/Settings")) },
    ],
  },

  { path: "*", ...page(() => import("./pages/NotFound")) },
];

export const router = createBrowserRouter(routes);
