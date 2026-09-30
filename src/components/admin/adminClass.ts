import { createContext, useContext } from "react";
import type { AdminClass } from "@shared/contract";

export const ADMIN_CLASS_KEY = "dm_admin_class";

export interface AdminClassState {
  /** Active classes (sidebar selector source). Empty while loading or when there are none. */
  classes: AdminClass[];
  loading: boolean;
  /** Current class id (persisted in localStorage), null when there are no active classes. */
  classId: number | null;
  currentClass: AdminClass | null;
  setClassId: (id: number | null) => void;
}

export const AdminClassContext = createContext<AdminClassState | null>(null);

/** Current class chosen in the admin sidebar. Pages use it as the default for their filters. */
export function useAdminClass(): AdminClassState {
  const ctx = useContext(AdminClassContext);
  if (!ctx) throw new Error("useAdminClass must be used inside AdminLayout");
  return ctx;
}

/** Pick the class to show: the stored one if it is still active, else the newest active class. */
export function resolveCurrentClass(classes: AdminClass[], stored: number | null): number | null {
  if (classes.length === 0) return null;
  if (stored !== null && classes.some((c) => c.id === stored)) return stored;
  const sorted = [...classes].sort((a, b) => b.academicYear - a.academicYear || b.semester - a.semester || a.section - b.section);
  return sorted[0].id;
}
