import { Hono } from "hono";
import { requireAdmin } from "../../auth";
import type { AppEnv } from "../../env";
import { adminUserRoutes } from "./admins";
import { classRoutes } from "./classes";
import { resultRoutes } from "./results";
import { studentAdminRoutes } from "./students";
import { testAdminRoutes } from "./tests";

/** Everything under /api/admin requires an admin session, re-checked against the admin list on every request. */
export const adminRoutes = new Hono<AppEnv>();
adminRoutes.use("*", requireAdmin);
adminRoutes.route("/", classRoutes);
adminRoutes.route("/", studentAdminRoutes);
adminRoutes.route("/", testAdminRoutes);
adminRoutes.route("/", resultRoutes);
adminRoutes.route("/", adminUserRoutes);
